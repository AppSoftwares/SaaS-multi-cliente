-- Caja (pedido del cliente, 2026-10-04): la apertura la hace el líder de caja
-- (con el conteo inicial en Bs y $). Los vendedores solo venden y pueden cerrar.
-- Si la caja está cerrada, los vendedores no pueden operar hasta que se abra.

-- 1) Permiso de apertura: solo líder de caja (ADMIN lo tiene implícito).
insert into permisos_rol (rol, modulo, nivel) values ('LIDER_CAJA', 'apertura_caja', 'editar')
on conflict (rol, modulo) do update set nivel = excluded.nivel;

-- 2) Abrir caja: requiere permiso de apertura y una sola caja abierta por negocio.
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
  if not tiene_permiso('apertura_caja', 'editar') then
    raise exception 'Solo el líder de caja puede abrir la caja';
  end if;
  if exists (select 1 from turnos_caja where negocio_id = v_negocio and estado = 'abierto') then
    raise exception 'La caja ya está abierta';
  end if;

  insert into turnos_caja (negocio_id, usuario_id, monto_apertura_bs, monto_apertura_usd)
  values (v_negocio, auth.uid(), coalesce(p_monto_apertura, 0), coalesce(p_monto_apertura_usd, 0))
  returning id into v_turno;

  return jsonb_build_object('turno_id', v_turno);
end $function$;

-- 3) Cerrar caja: lo puede hacer quien tiene permiso de caja (vendedor incluido),
--    no solo quien la abrió.
create or replace function public.cerrar_turno(p_turno_id uuid, p_monto_cierre numeric, p_monto_cierre_usd numeric default 0)
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
      and (usuario_id = auth.uid() or tiene_permiso('caja', 'editar'))
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

-- 4) mis_permisos incluye el nuevo módulo para que la app lo muestre.
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
      from unnest(array['inventario','facturas','caja','apertura_caja','finanzas','delivery','patio']) as m
      where nivel_permiso(m) is not null
    ), '{}'::jsonb)
  );
$function$;
