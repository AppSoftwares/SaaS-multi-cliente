-- Roles por módulo (pedido del cliente, 2026-10-05) y módulos Delivery y Patio.
--
-- ADMIN queda como "Gerente general": ve y edita todo y administra usuarios.
-- Los demás roles se definen en permisos_rol (módulo -> 'ver' o 'editar').
-- Toda restricción vive en la base (RLS y funciones SECURITY DEFINER), no solo
-- en la pantalla.
--
-- Módulos: inventario, facturas, caja, finanzas, delivery, patio.
-- Usuarios y claves siguen siendo solo de ADMIN.

-- 1) Roles nuevos. ADD VALUE no se usa en esta misma transacción, así que las
--    reglas usan el texto del rol (no el literal del enum).
alter type rol_usuario add value if not exists 'GERENTE_OPERATIVO';
alter type rol_usuario add value if not exists 'FACTURACION';
alter type rol_usuario add value if not exists 'LIDER_CAJA';
alter type rol_usuario add value if not exists 'VENDEDOR';
alter type rol_usuario add value if not exists 'LIDER_PATIO';
alter type rol_usuario add value if not exists 'DELIVERY';

-- 2) Matriz de permisos
create table if not exists permisos_rol (
  rol     text not null,
  modulo  text not null,
  nivel   text not null check (nivel in ('ver', 'editar')),
  primary key (rol, modulo)
);
alter table permisos_rol enable row level security;
drop policy if exists permisos_rol_select on permisos_rol;
create policy permisos_rol_select on permisos_rol for select using (true);
-- Sin políticas de escritura: solo se cambia por migración.

insert into permisos_rol (rol, modulo, nivel) values
  ('GERENTE_OPERATIVO', 'inventario', 'ver'),
  ('GERENTE_OPERATIVO', 'facturas',   'ver'),
  ('GERENTE_OPERATIVO', 'caja',       'ver'),
  ('GERENTE_OPERATIVO', 'delivery',   'ver'),
  ('GERENTE_OPERATIVO', 'patio',      'ver'),
  ('FACTURACION',       'inventario', 'editar'),
  ('FACTURACION',       'facturas',   'editar'),
  ('LIDER_CAJA',        'caja',       'editar'),
  ('LIDER_CAJA',        'finanzas',   'ver'),
  ('VENDEDOR',          'caja',       'editar'),
  ('LIDER_PATIO',       'delivery',   'ver'),
  ('LIDER_PATIO',       'patio',      'editar'),
  ('LIDER_PATIO',       'inventario', 'ver'),
  ('DELIVERY',          'delivery',   'editar')
on conflict (rol, modulo) do update set nivel = excluded.nivel;

-- 3) Funciones de permiso. ADMIN lo puede todo.
create or replace function public.nivel_permiso(p_modulo text)
 returns text
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_rol text;
begin
  select rol::text into v_rol from roles_usuario where id = auth.uid();
  if v_rol is null then
    return null;
  end if;
  if v_rol = 'ADMIN' then
    return 'editar';
  end if;
  return (select nivel from permisos_rol where rol = v_rol and modulo = p_modulo);
end $function$;

create or replace function public.tiene_permiso(p_modulo text, p_nivel text default 'ver')
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select case
    when nivel_permiso(p_modulo) = 'editar' then true
    when nivel_permiso(p_modulo) = 'ver' then p_nivel = 'ver'
    else false
  end;
$function$;

-- Lo que la app necesita para mostrar u ocultar módulos.
create or replace function public.mis_permisos()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'rol', (select rol::text from roles_usuario where id = auth.uid()),
    'modulos', coalesce((
      select jsonb_object_agg(m, nivel_permiso(m))
      from unnest(array['inventario','facturas','caja','finanzas','delivery','patio']) as m
      where nivel_permiso(m) is not null
    ), '{}'::jsonb)
  );
$function$;

-- 4) Finanzas: antes solo ADMIN; ahora cualquiera con permiso de finanzas.
--    Cuerpo idéntico al anterior salvo la comprobación de rol.
create or replace function public.finanzas_periodo(p_desde date, p_hasta date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
  v_hasta_fin timestamptz := (p_hasta + 1) - interval '1 second';
  v_ventas_bs numeric;
  v_ventas_cant integer;
  v_ventas_usd_recibido numeric;
  v_ventas_bs_recibido numeric;
  v_pagos_usd numeric;
  v_pagos_bs numeric;
  v_pend_usd numeric;
  v_pend_bs numeric;
  v_pend_cant integer;
  v_ventas_por_metodo jsonb;
  v_ventas_por_dia jsonb;
  v_top_productos jsonb;
  v_pagos_por_proveedor jsonb;
begin
  if v_negocio is null then
    return jsonb_build_object('error', 'sin negocio');
  end if;
  if not tiene_permiso('finanzas', 'ver') then
    raise exception 'No tienes permiso para ver finanzas';
  end if;

  select coalesce(sum(total_bs), 0), count(*)
    into v_ventas_bs, v_ventas_cant
  from pedidos
  where negocio_id = v_negocio
    and estado not in ('borrador','cancelado')
    and created_at >= p_desde and created_at <= v_hasta_fin;

  select coalesce(sum(pp.monto_moneda) filter (where pp.moneda = 'USD'), 0),
         coalesce(sum(pp.monto_moneda) filter (where pp.moneda = 'BS'), 0)
    into v_ventas_usd_recibido, v_ventas_bs_recibido
  from pedido_pagos pp
  join pedidos p on p.id = pp.pedido_id
  where p.negocio_id = v_negocio and p.estado not in ('borrador','cancelado')
    and p.created_at >= p_desde and p.created_at <= v_hasta_fin;

  select coalesce(sum(monto) filter (where moneda = 'USD'), 0),
         coalesce(sum(monto) filter (where moneda = 'BS'), 0)
    into v_pagos_usd, v_pagos_bs
  from pagos_proveedor
  where negocio_id = v_negocio
    and created_at >= p_desde and created_at <= v_hasta_fin;

  select coalesce(sum(f.monto_total) filter (where f.moneda = 'USD'), 0),
         coalesce(sum(f.monto_total) filter (where f.moneda = 'BS'), 0),
         count(*)
    into v_pend_usd, v_pend_bs, v_pend_cant
  from facturas f
  where f.negocio_id = v_negocio
    and f.pagada = false
    and f.estado <> 'borrador';

  select coalesce(jsonb_agg(to_jsonb(t) order by t.monto_bs desc), '[]'::jsonb) into v_ventas_por_metodo
  from (
    select pp.metodo, pp.moneda, sum(pp.monto_moneda) as monto_moneda, sum(pp.monto_bs) as monto_bs
    from pedido_pagos pp
    join pedidos p on p.id = pp.pedido_id
    where p.negocio_id = v_negocio and p.estado not in ('borrador','cancelado')
      and p.created_at >= p_desde and p.created_at <= v_hasta_fin
    group by pp.metodo, pp.moneda
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.fecha), '[]'::jsonb) into v_ventas_por_dia
  from (
    select p.created_at::date as fecha, sum(p.total_bs) as total_bs, count(*) as ventas
    from pedidos p
    where p.negocio_id = v_negocio and p.estado not in ('borrador','cancelado')
      and p.created_at >= p_desde and p.created_at <= v_hasta_fin
    group by p.created_at::date
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.cantidad desc), '[]'::jsonb) into v_top_productos
  from (
    select pi.nombre, sum(pi.cantidad) as cantidad, sum(pi.subtotal_bs) as total_bs
    from pedido_items pi
    join pedidos p on p.id = pi.pedido_id
    where p.negocio_id = v_negocio and p.estado not in ('borrador','cancelado')
      and p.created_at >= p_desde and p.created_at <= v_hasta_fin
    group by pi.nombre
    order by sum(pi.cantidad) desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.monto_bs desc), '[]'::jsonb) into v_pagos_por_proveedor
  from (
    select
      coalesce(pr.nombre, 'Sin proveedor') as proveedor,
      sum(pp.monto) filter (where pp.moneda = 'USD') as monto_usd,
      sum(pp.monto) filter (where pp.moneda = 'BS') as monto_bs_directo,
      sum(case
            when pp.moneda = 'USD' then pp.monto * coalesce((select tasa_bcv from negocios where id = v_negocio), 0)
            else pp.monto
          end) as monto_bs
    from pagos_proveedor pp
    join facturas f on f.id = pp.factura_id
    left join proveedores pr on pr.id = f.proveedor_id
    where pp.negocio_id = v_negocio
      and pp.created_at >= p_desde and pp.created_at <= v_hasta_fin
    group by coalesce(pr.nombre, 'Sin proveedor')
  ) t;

  return jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'ventas_bs', v_ventas_bs,
    'ventas_cantidad', v_ventas_cant,
    'ventas_usd_recibido', v_ventas_usd_recibido,
    'ventas_bs_recibido', v_ventas_bs_recibido,
    'pagos_proveedor_usd', v_pagos_usd,
    'pagos_proveedor_bs', v_pagos_bs,
    'facturas_pendientes_usd', v_pend_usd,
    'facturas_pendientes_bs', v_pend_bs,
    'facturas_pendientes_cantidad', v_pend_cant,
    'ventas_por_metodo', v_ventas_por_metodo,
    'ventas_por_dia', v_ventas_por_dia,
    'top_productos', v_top_productos,
    'pagos_por_proveedor', v_pagos_por_proveedor
  );
end $function$;

-- 5) Políticas: productos, costos, facturas y proveedores según la matriz.
drop policy if exists productos_insert on productos;
create policy productos_insert on productos for insert
  with check (negocio_id = current_negocio() and (tiene_permiso('inventario', 'editar') or tiene_permiso('facturas', 'editar')));

drop policy if exists productos_update on productos;
create policy productos_update on productos for update
  using (negocio_id = current_negocio() and (tiene_permiso('inventario', 'editar') or tiene_permiso('facturas', 'editar')))
  with check (negocio_id = current_negocio() and (tiene_permiso('inventario', 'editar') or tiene_permiso('facturas', 'editar')));

drop policy if exists productos_delete on productos;
create policy productos_delete on productos for delete
  using (negocio_id = current_negocio() and current_rol() = 'ADMIN');

drop policy if exists costos_admin_all on productos_costos;
drop policy if exists productos_costos_select on productos_costos;
create policy productos_costos_select on productos_costos for select
  using (negocio_id = current_negocio() and (tiene_permiso('facturas', 'ver') or tiene_permiso('inventario', 'editar')));
drop policy if exists productos_costos_write on productos_costos;
create policy productos_costos_write on productos_costos for all
  using (negocio_id = current_negocio() and (tiene_permiso('facturas', 'editar') or tiene_permiso('inventario', 'editar')))
  with check (negocio_id = current_negocio() and (tiene_permiso('facturas', 'editar') or tiene_permiso('inventario', 'editar')));

drop policy if exists facturas_select on facturas;
create policy facturas_select on facturas for select
  using (negocio_id = current_negocio() and tiene_permiso('facturas', 'ver'));
drop policy if exists facturas_insert on facturas;
create policy facturas_insert on facturas for insert
  with check (negocio_id = current_negocio() and tiene_permiso('facturas', 'editar'));
drop policy if exists facturas_update on facturas;
create policy facturas_update on facturas for update
  using (negocio_id = current_negocio() and tiene_permiso('facturas', 'editar'))
  with check (negocio_id = current_negocio() and tiene_permiso('facturas', 'editar'));
drop policy if exists facturas_delete on facturas;
create policy facturas_delete on facturas for delete
  using (negocio_id = current_negocio() and tiene_permiso('facturas', 'editar') and estado = 'borrador');

drop policy if exists factura_items_select on factura_items;
create policy factura_items_select on factura_items for select
  using (exists (select 1 from facturas f where f.id = factura_items.factura_id and f.negocio_id = current_negocio())
         and tiene_permiso('facturas', 'ver'));
drop policy if exists factura_items_insert on factura_items;
create policy factura_items_insert on factura_items for insert
  with check (exists (select 1 from facturas f where f.id = factura_items.factura_id and f.negocio_id = current_negocio())
              and tiene_permiso('facturas', 'editar'));
drop policy if exists factura_items_update on factura_items;
create policy factura_items_update on factura_items for update
  using (exists (select 1 from facturas f where f.id = factura_items.factura_id and f.negocio_id = current_negocio())
         and tiene_permiso('facturas', 'editar'));
drop policy if exists factura_items_delete on factura_items;
create policy factura_items_delete on factura_items for delete
  using (exists (select 1 from facturas f where f.id = factura_items.factura_id and f.negocio_id = current_negocio())
         and tiene_permiso('facturas', 'editar'));

drop policy if exists pagos_proveedor_select on pagos_proveedor;
create policy pagos_proveedor_select on pagos_proveedor for select
  using (negocio_id = current_negocio() and tiene_permiso('facturas', 'ver'));
drop policy if exists pagos_proveedor_insert on pagos_proveedor;
create policy pagos_proveedor_insert on pagos_proveedor for insert
  with check (negocio_id = current_negocio() and tiene_permiso('facturas', 'editar'));
drop policy if exists pagos_proveedor_delete on pagos_proveedor;
create policy pagos_proveedor_delete on pagos_proveedor for delete
  using (negocio_id = current_negocio() and current_rol() = 'ADMIN');

drop policy if exists proveedores_insert on proveedores;
create policy proveedores_insert on proveedores for insert
  with check (negocio_id = current_negocio() and tiene_permiso('facturas', 'editar'));
drop policy if exists proveedores_update on proveedores;
create policy proveedores_update on proveedores for update
  using (negocio_id = current_negocio() and tiene_permiso('facturas', 'editar'));
drop policy if exists proveedores_delete on proveedores;
create policy proveedores_delete on proveedores for delete
  using (negocio_id = current_negocio() and current_rol() = 'ADMIN');

-- 6) Entregas: cada venta con delivery crea una entrega que pasa por patio.
create table if not exists entregas (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references negocios(id) on delete cascade,
  pedido_id         uuid not null unique references pedidos(id) on delete cascade,
  estado            text not null default 'pendiente_patio'
                    check (estado in ('pendiente_patio', 'listo', 'en_ruta', 'entregado', 'incidencia')),
  verificado_por    uuid,
  verificado_at     timestamptz,
  repartidor_id     uuid,
  en_ruta_at        timestamptz,
  entregado_at      timestamptz,
  nota              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_entregas_negocio_estado on entregas(negocio_id, estado);
alter table entregas enable row level security;

drop policy if exists entregas_select on entregas;
create policy entregas_select on entregas for select
  using (negocio_id = current_negocio() and (tiene_permiso('delivery', 'ver') or tiene_permiso('patio', 'ver')));

create or replace function public.crear_entrega_desde_pedido()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.tipo_entrega = 'delivery' then
    insert into entregas (negocio_id, pedido_id)
    values (new.negocio_id, new.id)
    on conflict (pedido_id) do nothing;
  end if;
  return new;
end $function$;

drop trigger if exists trg_crear_entrega on pedidos;
create trigger trg_crear_entrega
  after insert or update of tipo_entrega on pedidos
  for each row execute function crear_entrega_desde_pedido();

-- Las transiciones pasan por funciones: así el orden (patio -> ruta -> entregada) lo controla el servidor.
create or replace function public.patio_verificar_entrega(p_id uuid, p_ok boolean default true, p_nota text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not tiene_permiso('patio', 'editar') then
    raise exception 'No tienes permiso para verificar entregas en patio';
  end if;
  update entregas
     set estado = case when p_ok then 'listo' else 'incidencia' end,
         verificado_por = auth.uid(),
         verificado_at = now(),
         nota = coalesce(p_nota, nota),
         updated_at = now()
   where id = p_id and negocio_id = current_negocio()
     and estado in ('pendiente_patio', 'incidencia');
  if not found then
    raise exception 'La entrega no existe o ya no está pendiente de patio';
  end if;
end $function$;

create or replace function public.entrega_tomar(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not tiene_permiso('delivery', 'editar') then
    raise exception 'No tienes permiso para tomar entregas';
  end if;
  update entregas
     set estado = 'en_ruta', repartidor_id = auth.uid(), en_ruta_at = now(), updated_at = now()
   where id = p_id and negocio_id = current_negocio() and estado = 'listo';
  if not found then
    raise exception 'La entrega debe estar verificada por patio antes de salir';
  end if;
end $function$;

create or replace function public.entrega_cerrar(p_id uuid, p_entregado boolean, p_nota text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not tiene_permiso('delivery', 'editar') then
    raise exception 'No tienes permiso para cerrar entregas';
  end if;
  update entregas
     set estado = case when p_entregado then 'entregado' else 'incidencia' end,
         entregado_at = now(),
         nota = coalesce(p_nota, nota),
         updated_at = now()
   where id = p_id and negocio_id = current_negocio()
     and estado = 'en_ruta' and repartidor_id = auth.uid();
  if not found then
    raise exception 'La entrega no está en ruta a tu nombre';
  end if;
end $function$;

-- 7) Guardas de escritura. Las funciones de venta y de movimientos no revisan
--    el rol, así que se revisa aquí. Sin sesión (n8n, agente de WhatsApp con
--    service role) no se bloquea: auth.uid() es null.
create or replace function public.guard_caja()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and not tiene_permiso('caja', 'editar') then
    raise exception 'No tienes permiso para operar la caja';
  end if;
  return new;
end $function$;

drop trigger if exists trg_guard_caja_pedidos on pedidos;
create trigger trg_guard_caja_pedidos before insert on pedidos
  for each row execute function guard_caja();
drop trigger if exists trg_guard_caja_turnos on turnos_caja;
create trigger trg_guard_caja_turnos before insert or update on turnos_caja
  for each row execute function guard_caja();

create or replace function public.guard_movimientos()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is not null
     and not (tiene_permiso('inventario', 'editar') or tiene_permiso('facturas', 'editar') or tiene_permiso('caja', 'editar')) then
    raise exception 'No tienes permiso para mover el inventario';
  end if;
  return new;
end $function$;

drop trigger if exists trg_guard_movimientos on movimientos_inventario;
create trigger trg_guard_movimientos before insert on movimientos_inventario
  for each row execute function guard_movimientos();

revoke execute on function public.patio_verificar_entrega(uuid, boolean, text) from anon;
revoke execute on function public.entrega_tomar(uuid) from anon;
revoke execute on function public.entrega_cerrar(uuid, boolean, text) from anon;
revoke execute on function public.mis_permisos() from anon;
