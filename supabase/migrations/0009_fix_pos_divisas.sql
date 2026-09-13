-- Corrige el descuadre de pagos en divisas del POS y agrega manejo de caja
-- física en divisas (apertura/cierre/arqueo), a pedido del cliente (Joel
-- Ferretería, ronda de cambios de 2026-09-08/09).
--
-- Causa raíz del descuadre: precio_venta_bs se fija con tasa_binance
-- (recalcular_precios_producto), pero crear_venta_pos convertía los pagos en
-- USD a bolívares con tasa_bcv (distinta) para el cuadre. Se corrige para que
-- el cuadre use tasa_binance (misma tasa del precio), y el IGTF (cálculo
-- fiscal, independiente del cuadre) siga usando tasa_bcv.

-- 1. Caja física en divisas: columnas nuevas en turnos_caja.
alter table turnos_caja
  add column if not exists monto_apertura_usd numeric not null default 0,
  add column if not exists monto_cierre_usd numeric;

-- 2. abrir_turno: acepta también el monto de apertura en divisa física.
create or replace function public.abrir_turno(
  p_monto_apertura numeric default 0,
  p_monto_apertura_usd numeric default 0
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
  v_turno   uuid;
begin
  if v_negocio is null then
    raise exception 'Usuario sin negocio asignado';
  end if;
  if exists (select 1 from turnos_caja where usuario_id = auth.uid() and estado = 'abierto') then
    raise exception 'Ya tienes un turno de caja abierto';
  end if;

  insert into turnos_caja (negocio_id, usuario_id, monto_apertura_bs, monto_apertura_usd)
  values (v_negocio, auth.uid(), coalesce(p_monto_apertura, 0), coalesce(p_monto_apertura_usd, 0))
  returning id into v_turno;

  return jsonb_build_object('turno_id', v_turno);
end $function$;

-- 3. cerrar_turno: acepta también el monto contado en divisa física.
create or replace function public.cerrar_turno(
  p_turno_id uuid,
  p_monto_cierre numeric,
  p_monto_cierre_usd numeric default 0
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
begin
  if not exists (
    select 1 from turnos_caja
    where id = p_turno_id and negocio_id = v_negocio and estado = 'abierto'
      and (usuario_id = auth.uid() or current_rol() = 'ADMIN')
  ) then
    raise exception 'Turno no encontrado, ya cerrado, o sin permiso';
  end if;

  update turnos_caja
  set monto_cierre_bs = p_monto_cierre,
      monto_cierre_usd = coalesce(p_monto_cierre_usd, 0),
      cerrado_at = now(),
      estado = 'cerrado'
  where id = p_turno_id;

  return arqueo_turno(p_turno_id);
end $function$;

-- 4. arqueo_turno: desglose por método en la moneda nativa en que se cobró
-- (mismo criterio que finanzas_periodo.ventas_por_metodo, ya validado por el
-- cliente), y "esperado" separado por caja física (Bs y USD), para que el
-- cajero cuadre cada caja sin tener que convertir nada a mano.
create or replace function public.arqueo_turno(p_turno_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio       uuid := current_negocio();
  v_turno         record;
  v_total_bs      numeric;
  v_ventas        integer;
  v_pormet        jsonb;
  v_pendiente     numeric;
  v_recibido_bs   numeric;
  v_recibido_usd  numeric;
begin
  select * into v_turno from turnos_caja where id = p_turno_id and negocio_id = v_negocio;
  if v_turno is null then
    raise exception 'Turno no encontrado';
  end if;

  -- Desglose por método, en la moneda nativa del pago (monto_moneda) y su
  -- equivalente en Bs (monto_bs) para referencia.
  select coalesce(jsonb_agg(to_jsonb(t) order by t.monto_bs desc), '[]'::jsonb) into v_pormet
  from (
    select pp.metodo, pp.moneda, sum(pp.monto_moneda) as monto_moneda, sum(pp.monto_bs) as monto_bs
    from pedido_pagos pp
    join pedidos p on p.id = pp.pedido_id
    where p.turno_id = p_turno_id and p.estado <> 'cancelado'
    group by pp.metodo, pp.moneda
  ) t;

  select coalesce(sum(total_bs), 0), count(*) into v_total_bs, v_ventas
  from pedidos
  where turno_id = p_turno_id and estado <> 'cancelado';

  -- Lo efectivamente recibido en cada caja física (montos nativos, sin
  -- convertir), para el arqueo de apertura+ventas por moneda.
  select coalesce(sum(pp.monto_moneda) filter (where pp.moneda = 'BS'), 0),
         coalesce(sum(pp.monto_moneda) filter (where pp.moneda = 'USD'), 0)
    into v_recibido_bs, v_recibido_usd
  from pedido_pagos pp
  join pedidos p on p.id = pp.pedido_id
  where p.turno_id = p_turno_id and p.estado <> 'cancelado';

  select coalesce(sum(pp.monto_bs), 0) - coalesce((
    select sum(c.monto_bs) from cobros_credito c where c.negocio_id = v_negocio
  ), 0)
  into v_pendiente
  from pedido_pagos pp
  join pedidos p on p.id = pp.pedido_id
  where p.negocio_id = v_negocio and pp.metodo = 'Crédito' and p.estado <> 'cancelado';

  return jsonb_build_object(
    'turno_id', v_turno.id,
    'monto_apertura_bs', v_turno.monto_apertura_bs,
    'monto_apertura_usd', v_turno.monto_apertura_usd,
    'monto_cierre_bs', v_turno.monto_cierre_bs,
    'monto_cierre_usd', v_turno.monto_cierre_usd,
    'abierto_at', v_turno.abierto_at,
    'cerrado_at', v_turno.cerrado_at,
    'estado', v_turno.estado,
    'total_ventas_bs', v_total_bs,
    'ventas', v_ventas,
    'por_metodo', v_pormet,
    'total_recibido_bs', v_recibido_bs,
    'total_recibido_usd', v_recibido_usd,
    'esperado_bs', v_turno.monto_apertura_bs + v_recibido_bs,
    'esperado_usd', v_turno.monto_apertura_usd + v_recibido_usd,
    'pendiente_por_cobrar_bs', greatest(0, v_pendiente)
  );
end $function$;

-- 5. crear_venta_pos: el cuadre de pagos en USD usa tasa_binance (misma tasa
-- del precio_venta_bs), no tasa_bcv. El IGTF sigue calculándose sobre tasa_bcv
-- (base fiscal declarativa, independiente del cuadre).
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
  p_aplica_igtf boolean default false
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

  -- Total de la venta (lo que cubre la mercancía): base + IVA. El IGTF se
  -- calcula aparte, por línea de pago, y no se suma aquí.
  v_total := v_base_imponible + v_iva_bs;

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
    'igtf_monto_bs', v_igtf_total_bs
  );
end $function$;

-- 6. Limpieza: elimina los overloads obsoletos de crear_venta_pos de
-- iteraciones anteriores (quedaban 3 firmas distintas acumuladas), para que
-- no haya ambigüedad futura sobre cuál se está llamando.
drop function if exists public.crear_venta_pos(
  jsonb, jsonb, text, text, text, text, text, text, numeric, text
);
drop function if exists public.crear_venta_pos(
  jsonb, jsonb, text, text, text, text, text, text, numeric, text, uuid
);

-- abrir_turno/cerrar_turno: CREATE OR REPLACE con una firma de distinta
-- aridad crea un overload nuevo en vez de reemplazar el existente. Se
-- eliminan las firmas viejas (sin el parámetro _usd) para no dejar
-- ambigüedad.
drop function if exists public.abrir_turno(numeric);
drop function if exists public.cerrar_turno(uuid, numeric);
