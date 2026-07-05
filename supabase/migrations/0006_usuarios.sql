-- ============================================================================
-- 0006_usuarios.sql
-- Gestión de usuarios: username/email en roles_usuario para listarlos sin
-- consultar auth.users desde el cliente. bootstrap poblado con esos datos.
-- ============================================================================

alter table roles_usuario
  add column if not exists username text,
  add column if not exists email    text;

-- bootstrap_negocio: el primer usuario crea su negocio, queda como ADMIN y se
-- guardan su email y un username derivado. Idempotente.
create or replace function bootstrap_negocio(p_nombre text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid;
  v_email   text;
begin
  select negocio_id into v_negocio from roles_usuario where id = auth.uid();
  if v_negocio is not null then
    return v_negocio;
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into negocios (nombre) values (coalesce(nullif(p_nombre,''), 'Mi Ferretería'))
  returning id into v_negocio;

  insert into roles_usuario (id, negocio_id, rol, username, email)
  values (auth.uid(), v_negocio, 'ADMIN', split_part(coalesce(v_email,'admin'), '@', 1), v_email);

  return v_negocio;
end $$;
