-- Historial de cierres de caja por vendedor + ventas por vendedor en
-- Finanzas (pedido del cliente, notas de voz/video 2026-10-19): el panel de
-- líder de caja (ronda anterior) permite abrir la caja de cada vendedor,
-- pero no deja ver cómo le fue a cada uno después de cerrar. El cliente
-- quiere validar el ticket físico que le entrega cada vendedor contra el
-- resumen del sistema, y llevar cuenta de cuánto vendió cada uno (para
-- incentivos).

-- 1) Historial de turnos de un vendedor (abiertos y cerrados), con el total
--    vendido en cada uno. El propio vendedor ve su historial; el líder/admin
--    puede ver el de cualquiera de su negocio.
create or replace function public.historial_turnos(p_usuario_id uuid default null, p_limite integer default 20)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
  v_target  uuid := coalesce(p_usuario_id, auth.uid());
begin
  if v_negocio is null then
    return '[]'::jsonb;
  end if;
  if v_target <> auth.uid() and not tiene_permiso('apertura_caja', 'editar') then
    raise exception 'Sin permiso';
  end if;

  return coalesce((
    select jsonb_agg(fila order by fila->>'abierto_at' desc)
    from (
      select jsonb_build_object(
        'turno_id', tc.id,
        'abierto_at', tc.abierto_at,
        'cerrado_at', tc.cerrado_at,
        'estado', tc.estado,
        'monto_apertura_bs', tc.monto_apertura_bs,
        'monto_apertura_usd', tc.monto_apertura_usd,
        'monto_cierre_bs', tc.monto_cierre_bs,
        'monto_cierre_usd', tc.monto_cierre_usd,
        'total_ventas_bs', coalesce((
          select sum(p.total_bs) from pedidos p
          where p.turno_id = tc.id and p.estado <> 'cancelado'
        ), 0),
        'ventas', coalesce((
          select count(*) from pedidos p
          where p.turno_id = tc.id and p.estado <> 'cancelado'
        ), 0)
      ) as fila
      from turnos_caja tc
      where tc.negocio_id = v_negocio and tc.usuario_id = v_target
      order by tc.abierto_at desc
      limit greatest(1, least(coalesce(p_limite, 20), 100))
    ) t
  ), '[]'::jsonb);
end $function$;

-- 2) finanzas_periodo: se agrega el desglose de ventas por vendedor (mismo
--    cuerpo que 0020, solo con el bloque nuevo y el campo adicional).
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
  v_ventas_por_vendedor jsonb;
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

  -- Para incentivos: cuánto vendió cada vendedor en el período. "Sin usuario"
  -- cubre ventas viejas o del agente de ventas automático sin usuario_id.
  select coalesce(jsonb_agg(to_jsonb(t) order by t.total_bs desc), '[]'::jsonb) into v_ventas_por_vendedor
  from (
    select coalesce(ru.username, 'Sin usuario') as vendedor, sum(p.total_bs) as total_bs, count(*) as ventas
    from pedidos p
    left join roles_usuario ru on ru.id = p.usuario_id
    where p.negocio_id = v_negocio and p.estado not in ('borrador','cancelado')
      and p.created_at >= p_desde and p.created_at <= v_hasta_fin
    group by coalesce(ru.username, 'Sin usuario')
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
    'pagos_por_proveedor', v_pagos_por_proveedor,
    'ventas_por_vendedor', v_ventas_por_vendedor
  );
end $function$;
