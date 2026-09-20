-- Delivery en Caja (pedido del cliente, 2026-09-20): al cerrar una venta el
-- cliente puede pedir que se la lleven. Se registra tipo_entrega='delivery',
-- la dirección de entrega y el costo (en USD, convertido a Bs con tasa_binance)
-- que se suma al total a cobrar. pedidos ya tenía tipo_entrega, direccion y
-- costo_delivery (migración 0008): costo_delivery guarda el monto en Bs.
--
-- La firma cambia (3 parámetros nuevos con default), así que se elimina la
-- versión de 13 parámetros para no dejar dos overloads.

drop function if exists public.crear_venta_pos(
  jsonb, jsonb, text, text, text, text, text, text, numeric, text, uuid, boolean, boolean
);

create or replace function public.crear_venta_pos(
  p_items jsonb,
  p_pagos jsonb,
  p_cliente_cedula text default null::text,
  p_cliente_nombre text default null::text,
  p_cliente_apellido text default null::text,
  p_cliente_direccion text default null::text,
  p_cliente_telefono text default null::text,
  p_descuento_general_tipo text default null::text,
  p_descuento_general_valor numeric default null::numeric,
  p_clave_descuentos text default null::text,
  p_turno_id uuid default null::uuid,
  p_aplica_iva boolean default false,
  p_aplica_igtf boolean default false,
  p_tipo_entrega text default null::text,
  p_costo_delivery_usd numeric default 0,
  p_direccion_entrega text default null::text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio         uuid := current_negocio();
  v_pedido          uuid;
  v_numero          bigint;
  v_item            jsonb;
  v_pago            jsonb;
  v_pid             uuid;
  v_cant            integer;
  v_prod            record;
  v_subtotal_bruto  numeric := 0;
  v_desc_items      numeric := 0;
  v_desc_general    numeric := 0;
  v_base_general    numeric;
  v_base_imponible  numeric := 0;
  v_iva_tasa        numeric;
  v_igtf_tasa       numeric;
  v_iva_bs          numeric := 0;
  v_igtf_total_bs   numeric := 0;
  v_total           numeric := 0;
  v_pagos_total_bs  numeric := 0;
  v_cliente_id      uuid;
  v_tasa_bcv        numeric;
  v_tasa_binance    numeric;
  v_linea_bruto     numeric;
  v_linea_desc      numeric;
  v_item_tipo       text;
  v_item_valor      numeric;
  v_hay_descuento   boolean := false;
  v_moneda_pago     text;
  v_monto_pago      numeric;
  v_monto_pago_bs   numeric;
  v_igtf_pago_bs    numeric;
  v_tolerancia      numeric;
  v_es_delivery     boolean := coalesce(p_tipo_entrega, '') = 'delivery';
  v_delivery_bs     numeric := 0;
begin
  if v_negocio is null then
    raise exception 'Usuario sin negocio asignado';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pagos is null or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene método de pago';
  end if;
  if coalesce(p_tipo_entrega, '') not in ('', 'delivery', 'retiro') then
    raise exception 'Tipo de entrega inválido: %', p_tipo_entrega;
  end if;

  select tasa_bcv, tasa_binance, iva_tasa, igtf_tasa into v_tasa_bcv, v_tasa_binance, v_iva_tasa, v_igtf_tasa
  from negocios where id = v_negocio;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item->>'producto_id')::uuid;
    if not exists (select 1 from productos where id = v_pid and negocio_id = v_negocio) then
      raise exception 'Producto % no existe en tu negocio', v_pid;
    end if;
    if coalesce((v_item->>'descuento_valor')::numeric, 0) > 0 then
      v_hay_descuento := true;
    end if;
  end loop;
  if coalesce(p_descuento_general_valor, 0) > 0 then
    v_hay_descuento := true;
  end if;

  if v_hay_descuento and not validar_clave_descuento(p_clave_descuentos) then
    raise exception 'Clave de descuento inválida';
  end if;

  if p_cliente_cedula is not null and p_cliente_cedula <> '' then
    select id into v_cliente_id from clientes
    where negocio_id = v_negocio and cedula = p_cliente_cedula;

    if v_cliente_id is null then
      insert into clientes (negocio_id, cedula, nombre, apellido, telefono, direccion)
      values (v_negocio, p_cliente_cedula, nullif(p_cliente_nombre, ''), nullif(p_cliente_apellido, ''),
              nullif(p_cliente_telefono, ''), nullif(p_cliente_direccion, ''))
      returning id into v_cliente_id;
    else
      update clientes set
        nombre    = coalesce(nullif(p_cliente_nombre, ''), nombre),
        apellido  = coalesce(nullif(p_cliente_apellido, ''), apellido),
        telefono  = coalesce(nullif(p_cliente_telefono, ''), telefono),
        direccion = coalesce(nullif(p_cliente_direccion, ''), direccion)
      where id = v_cliente_id;
    end if;
  end if;

  insert into pedidos (
    negocio_id, estado, origen, usuario_id, cliente_id,
    cliente_cedula, cliente_nombre, cliente_apellido, cliente_direccion, cliente_telefono, turno_id
  ) values (
    v_negocio, 'pagado', 'pos', auth.uid(), v_cliente_id,
    nullif(p_cliente_cedula, ''), nullif(p_cliente_nombre, ''), nullif(p_cliente_apellido, ''),
    nullif(p_cliente_direccion, ''), nullif(p_cliente_telefono, ''), p_turno_id
  )
  returning id, numero_venta into v_pedido, v_numero;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid        := (v_item->>'producto_id')::uuid;
    v_cant       := (v_item->>'cantidad')::integer;
    v_item_tipo  := nullif(v_item->>'descuento_tipo', '');
    v_item_valor := coalesce((v_item->>'descuento_valor')::numeric, 0);

    select nombre, precio_venta_bs into v_prod from productos where id = v_pid;

    v_linea_bruto := v_cant * v_prod.precio_venta_bs;
    if v_item_tipo = 'porcentaje' then
      v_linea_desc := round(v_linea_bruto * least(greatest(v_item_valor, 0), 100) / 100, 2);
    elsif v_item_tipo = 'monto' then
      v_linea_desc := least(greatest(v_item_valor, 0), v_linea_bruto);
    else
      v_linea_desc := 0;
    end if;

    insert into pedido_items (
      pedido_id, producto_id, nombre, cantidad, precio_bs, subtotal_bs,
      descuento_tipo, descuento_valor, descuento_monto_bs
    ) values (
      v_pedido, v_pid, v_prod.nombre, v_cant, v_prod.precio_venta_bs, v_linea_bruto - v_linea_desc,
      v_item_tipo, nullif(v_item_valor, 0), v_linea_desc
    );

    v_subtotal_bruto := v_subtotal_bruto + v_linea_bruto;
    v_desc_items      := v_desc_items + v_linea_desc;

    perform registrar_movimiento(v_pid, 'VENTA', v_cant, 'Venta POS #' || v_numero);
  end loop;

  v_base_general := v_subtotal_bruto - v_desc_items;
  if p_descuento_general_tipo = 'porcentaje' then
    v_desc_general := round(v_base_general * least(greatest(coalesce(p_descuento_general_valor, 0), 0), 100) / 100, 2);
  elsif p_descuento_general_tipo = 'monto' then
    v_desc_general := least(greatest(coalesce(p_descuento_general_valor, 0), 0), v_base_general);
  end if;

  -- Base imponible: la venta ya con descuentos, antes de impuestos.
  v_base_imponible := v_base_general - v_desc_general;

  if p_aplica_iva then
    v_iva_bs := round(v_base_imponible * coalesce(v_iva_tasa, 16) / 100, 2);
  end if;

  -- Delivery: se cobra en USD y se convierte con tasa_binance (misma tasa que
  -- fija los precios). No lleva IVA: se suma después de los impuestos.
  if v_es_delivery then
    if v_tasa_binance is null or v_tasa_binance <= 0 then
      raise exception 'No hay tasa Binance configurada para calcular el delivery';
    end if;
    v_delivery_bs := round(greatest(coalesce(p_costo_delivery_usd, 0), 0) * v_tasa_binance, 2);
  end if;

  -- Total de la venta (lo que cubre la mercancía): base + IVA + delivery. El
  -- IGTF se calcula aparte, por línea de pago, y no se suma aquí.
  v_total := v_base_imponible + v_iva_bs + v_delivery_bs;

  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    v_moneda_pago := coalesce(v_pago->>'moneda', 'BS');
    v_monto_pago  := (v_pago->>'monto')::numeric;

    if v_moneda_pago = 'USD' then
      -- Se convierte con tasa_binance: es la misma tasa con la que se fijó
      -- precio_venta_bs, así el cuadre de la venta es consistente sin
      -- importar cuánto de la venta se pagó en divisa. La tasa_bcv se
      -- reserva para el cálculo fiscal del IGTF (más abajo).
      if v_tasa_binance is null or v_tasa_binance <= 0 then
        raise exception 'No hay tasa Binance configurada para convertir un pago en USD';
      end if;
      v_monto_pago_bs := round(v_monto_pago * v_tasa_binance, 2);
    else
      v_monto_pago_bs := v_monto_pago;
    end if;

    v_igtf_pago_bs := 0;
    if p_aplica_igtf and v_moneda_pago = 'USD' then
      if v_tasa_bcv is null or v_tasa_bcv <= 0 then
        raise exception 'No hay tasa BCV configurada para calcular el IGTF';
      end if;
      v_igtf_pago_bs := round(v_monto_pago * v_tasa_bcv * coalesce(v_igtf_tasa, 3) / 100, 2);
      v_igtf_total_bs := v_igtf_total_bs + v_igtf_pago_bs;
    end if;

    insert into pedido_pagos (pedido_id, metodo, moneda, monto_moneda, monto_bs, referencia, igtf_monto_bs)
    values (v_pedido, v_pago->>'metodo', v_moneda_pago, v_monto_pago, v_monto_pago_bs,
            nullif(v_pago->>'referencia', ''), v_igtf_pago_bs);

    -- El IGTF es un cobro adicional al cliente sobre el pago en divisas, no
    -- se descuenta del monto que cubre la venta: no participa en el cuadre
    -- de pagos vs. total_bs (solo se acumula para reporte/declaración).
    v_pagos_total_bs := v_pagos_total_bs + v_monto_pago_bs;
  end loop;

  v_tolerancia := greatest(0.5, coalesce(v_tasa_binance, 0) * 0.01);
  if abs(round(v_pagos_total_bs, 2) - round(v_total, 2)) > v_tolerancia then
    raise exception 'Los pagos (%) no cuadran con el total de la venta (%)', v_pagos_total_bs, v_total;
  end if;

  update pedidos set
    total_bs            = v_total,
    subtotal_bs          = v_subtotal_bruto,
    descuento_tipo       = p_descuento_general_tipo,
    descuento_valor      = nullif(coalesce(p_descuento_general_valor, 0), 0),
    descuento_monto_bs   = v_desc_general,
    base_imponible_bs    = v_base_imponible,
    aplica_iva           = p_aplica_iva,
    iva_monto_bs         = v_iva_bs,
    aplica_igtf          = p_aplica_igtf,
    igtf_monto_bs         = v_igtf_total_bs,
    tipo_entrega         = case when v_es_delivery then 'delivery'::tipo_entrega else null end,
    costo_delivery       = v_delivery_bs,
    direccion            = case when v_es_delivery
                                then nullif(coalesce(nullif(p_direccion_entrega, ''), p_cliente_direccion, ''), '')
                                else null end,
    updated_at           = now()
  where id = v_pedido;

  return jsonb_build_object(
    'pedido_id', v_pedido,
    'numero_venta', v_numero,
    'total_bs', v_total,
    'subtotal_bs', v_subtotal_bruto,
    'descuento_monto_bs', v_desc_items + v_desc_general,
    'base_imponible_bs', v_base_imponible,
    'iva_monto_bs', v_iva_bs,
    'igtf_monto_bs', v_igtf_total_bs,
    'delivery_monto_bs', v_delivery_bs
  );
end $function$;;
