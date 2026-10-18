-- Caja por vendedor (pedido del cliente, notas de voz 2026-10-16/17): cada
-- vendedor atiende y cobra en su propio puesto, no en una caja física
-- compartida. La migración 0021 (apertura solo por el líder) bloqueaba por
-- negocio entero: con un turno abierto, cualquier vendedor que entraba al POS
-- veía ESA MISMA caja (montos y todo), como si fuera una sola. El líder debe
-- poder abrirle su propio turno a cada vendedor, con su propio monto inicial
-- en Bs y en $, y que cada uno vea solo el suyo.

-- 1) Abrir caja: ahora admite abrir el turno de OTRO usuario del negocio
--    (p_usuario_id). Sigue exigiendo el permiso de apertura (líder/admin),
--    pero el límite de "una caja abierta" vuelve a ser por usuario, no por
--    negocio completo (así puede haber varios vendedores operando a la vez).
drop function if exists public.abrir_turno(numeric, numeric);

create or replace function public.abrir_turno(
  p_monto_apertura numeric default 0,
  p_monto_apertura_usd numeric default 0,
  p_usuario_id uuid default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
  v_turno   uuid;
  v_target  uuid := coalesce(p_usuario_id, auth.uid());
begin
  if v_negocio is null then
    raise exception 'Usuario sin negocio asignado';
  end if;
  if not tiene_permiso('apertura_caja', 'editar') then
    raise exception 'Solo el líder de caja puede abrir la caja';
  end if;
  if v_target <> auth.uid() and not exists (
    select 1 from roles_usuario where id = v_target and negocio_id = v_negocio
  ) then
    raise exception 'Ese usuario no pertenece a tu negocio';
  end if;
  if exists (select 1 from turnos_caja where usuario_id = v_target and estado = 'abierto') then
    raise exception 'Ese vendedor ya tiene una caja abierta';
  end if;

  insert into turnos_caja (negocio_id, usuario_id, monto_apertura_bs, monto_apertura_usd)
  values (v_negocio, v_target, coalesce(p_monto_apertura, 0), coalesce(p_monto_apertura_usd, 0))
  returning id into v_turno;

  return jsonb_build_object('turno_id', v_turno, 'usuario_id', v_target);
end $function$;

-- 2) Para que el líder elija a quién abrirle: lista vendedores/líderes del
--    negocio con el estado de su caja ahora mismo (abierta o no).
create or replace function public.listar_estado_cajas()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
begin
  if not tiene_permiso('apertura_caja', 'editar') then
    raise exception 'Sin permiso';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'usuario_id', ru.id,
      'username', ru.username,
      'rol', ru.rol::text,
      'turno_id', tc.id,
      'abierto_at', tc.abierto_at,
      'monto_apertura_bs', tc.monto_apertura_bs,
      'monto_apertura_usd', tc.monto_apertura_usd
    ) order by ru.username)
    from roles_usuario ru
    left join turnos_caja tc on tc.usuario_id = ru.id and tc.estado = 'abierto'
    where ru.negocio_id = v_negocio
      and (ru.rol in ('VENDEDOR', 'LIDER_CAJA') or ru.id = auth.uid())
  ), '[]'::jsonb);
end $function$;
