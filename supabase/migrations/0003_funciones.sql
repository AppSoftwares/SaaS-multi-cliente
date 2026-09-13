-- ============================================================================
-- 0003_funciones.sql
-- RPCs: movimientos atómicos, importación por lotes, bootstrap y KPIs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- registrar_movimiento: actualiza stock e inserta movimiento en UNA transacción.
--   p_tipo:
--     'INGRESO' / 'ALTA'  -> stock = stock + p_cantidad   (p_cantidad >= 0)
--     'VENTA'             -> stock = max(0, stock - p_cantidad)
--     'AJUSTE'            -> stock = p_cantidad  (valor absoluto final)
-- Devuelve la cantidad resultante. Bloquea la fila (FOR UPDATE) => sin race.
-- ---------------------------------------------------------------------------
create or replace function registrar_movimiento(
  p_producto_id uuid,
  p_tipo        tipo_movimiento,
  p_cantidad    integer,
  p_nota        text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_negocio   uuid := current_negocio();
  v_actual    integer;
  v_prod_neg  uuid;
  v_nueva     integer;
  v_afectada  integer;
begin
  if v_negocio is null then
    raise exception 'Usuario sin negocio asignado';
  end if;
  if p_cantidad < 0 then
    raise exception 'La cantidad no puede ser negativa';
  end if;

  -- Bloquea la fila del producto para evitar condiciones de carrera
  select cantidad, negocio_id into v_actual, v_prod_neg
  from productos where id = p_producto_id for update;

  if not found then
    raise exception 'Producto % no existe', p_producto_id;
  end if;
  if v_prod_neg <> v_negocio then
    raise exception 'El producto no pertenece a tu negocio';
  end if;

  if p_tipo in ('INGRESO', 'ALTA') then
    v_nueva := v_actual + p_cantidad;
    v_afectada := p_cantidad;
  elsif p_tipo = 'VENTA' then
    v_nueva := greatest(0, v_actual - p_cantidad);
    v_afectada := v_nueva - v_actual;              -- negativo
  elsif p_tipo = 'AJUSTE' then
    v_nueva := p_cantidad;
    v_afectada := v_nueva - v_actual;              -- con signo
  else
    raise exception 'Tipo de movimiento inválido';
  end if;

  update productos set cantidad = v_nueva where id = p_producto_id;

  insert into movimientos_inventario
    (negocio_id, producto_id, tipo, cantidad_afectada, cantidad_resultante, usuario_id, nota)
  values
    (v_negocio, p_producto_id, p_tipo, v_afectada, v_nueva, auth.uid(), p_nota);

  return v_nueva;
end $$;

-- ---------------------------------------------------------------------------
-- importar_movimientos: aplica un lote (Excel de facturación) en UNA transacción.
--   p_modo: 'VENDIDO' (resta -> VENTA) o 'STOCK_FINAL' (fija -> AJUSTE)
--   p_items: jsonb array de { "producto_id": uuid, "cantidad": int }
--   Solo ADMIN. Rollback total si alguna fila falla.
-- Devuelve jsonb { aplicados, resultados: [{producto_id, cantidad_resultante}] }
-- ---------------------------------------------------------------------------
create or replace function importar_movimientos(
  p_items jsonb,
  p_modo  text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_item      jsonb;
  v_tipo      tipo_movimiento;
  v_pid       uuid;
  v_cant      integer;
  v_res       integer;
  v_aplicados integer := 0;
  v_out       jsonb := '[]'::jsonb;
begin
  if current_rol() is distinct from 'ADMIN' then
    raise exception 'Solo un ADMIN puede importar movimientos';
  end if;

  if p_modo = 'VENDIDO' then
    v_tipo := 'VENTA';
  elsif p_modo = 'STOCK_FINAL' then
    v_tipo := 'AJUSTE';
  else
    raise exception 'Modo inválido: %', p_modo;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid  := (v_item->>'producto_id')::uuid;
    v_cant := (v_item->>'cantidad')::integer;
    v_res  := registrar_movimiento(v_pid, v_tipo, v_cant,
                'Importación Excel (' || p_modo || ')');
    v_aplicados := v_aplicados + 1;
    v_out := v_out || jsonb_build_object('producto_id', v_pid, 'cantidad_resultante', v_res);
  end loop;

  return jsonb_build_object('aplicados', v_aplicados, 'resultados', v_out);
end $$;

-- ---------------------------------------------------------------------------
-- bootstrap_negocio: el primer usuario crea su negocio y se asigna como ADMIN.
-- Idempotente: si ya tiene rol, no hace nada.
-- ---------------------------------------------------------------------------
create or replace function bootstrap_negocio(p_nombre text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid;
begin
  select negocio_id into v_negocio from roles_usuario where id = auth.uid();
  if v_negocio is not null then
    return v_negocio;
  end if;

  insert into negocios (nombre) values (coalesce(nullif(p_nombre,''), 'Mi Ferretería'))
  returning id into v_negocio;

  insert into roles_usuario (id, negocio_id, rol)
  values (auth.uid(), v_negocio, 'ADMIN');

  return v_negocio;
end $$;

-- ---------------------------------------------------------------------------
-- kpis_dashboard: métricas para el gerente. Respeta el rol:
--   valor_inventario_costo solo se calcula para ADMIN (usa precio_costo).
-- ---------------------------------------------------------------------------
create or replace function kpis_dashboard()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := current_negocio();
  v_rol     rol_usuario := current_rol();
  v_total_prod   integer;
  v_bajo_stock   integer;
  v_valor_venta  numeric;
  v_valor_costo  numeric;
begin
  if v_negocio is null then
    return jsonb_build_object('error', 'sin negocio');
  end if;

  select count(*),
         count(*) filter (where cantidad <= stock_minimo and stock_minimo > 0),
         coalesce(sum(cantidad * precio_venta), 0)
    into v_total_prod, v_bajo_stock, v_valor_venta
  from productos where negocio_id = v_negocio;

  if v_rol = 'ADMIN' then
    select coalesce(sum(p.cantidad * c.precio_costo), 0)
      into v_valor_costo
    from productos p
    join productos_costos c on c.producto_id = p.id
    where p.negocio_id = v_negocio;
  end if;

  return jsonb_build_object(
    'total_productos', v_total_prod,
    'bajo_stock', v_bajo_stock,
    'valor_inventario_venta', v_valor_venta,
    'valor_inventario_costo', v_valor_costo   -- null si no es ADMIN
  );
end $$;
