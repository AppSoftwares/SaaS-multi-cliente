-- ============================================================================
-- 0002_rls_y_helpers.sql
-- Helpers de sesión (security definer) + Row Level Security por negocio y rol.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers: leen el rol y negocio del usuario autenticado desde roles_usuario.
-- SECURITY DEFINER para poder consultarse dentro de las políticas sin recursión.
-- ---------------------------------------------------------------------------
create or replace function current_negocio()
returns uuid
language sql stable security definer set search_path = public as $$
  select negocio_id from roles_usuario where id = auth.uid();
$$;

create or replace function current_rol()
returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from roles_usuario where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Habilitar RLS
-- ---------------------------------------------------------------------------
alter table negocios              enable row level security;
alter table roles_usuario         enable row level security;
alter table productos             enable row level security;
alter table productos_costos      enable row level security;
alter table movimientos_inventario enable row level security;

-- ---------------------------------------------------------------------------
-- negocios: el usuario ve/gestiona solo su propio negocio (ADMIN puede editar)
-- ---------------------------------------------------------------------------
drop policy if exists negocios_select on negocios;
create policy negocios_select on negocios
  for select using (id = current_negocio());

drop policy if exists negocios_update on negocios;
create policy negocios_update on negocios
  for update using (id = current_negocio() and current_rol() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- roles_usuario: cada quien ve su fila; ADMIN gestiona los roles de su negocio
-- ---------------------------------------------------------------------------
drop policy if exists roles_select_propio on roles_usuario;
create policy roles_select_propio on roles_usuario
  for select using (id = auth.uid() or negocio_id = current_negocio());

drop policy if exists roles_admin_insert on roles_usuario;
create policy roles_admin_insert on roles_usuario
  for insert with check (negocio_id = current_negocio() and current_rol() = 'ADMIN');

drop policy if exists roles_admin_update on roles_usuario;
create policy roles_admin_update on roles_usuario
  for update using (negocio_id = current_negocio() and current_rol() = 'ADMIN');

drop policy if exists roles_admin_delete on roles_usuario;
create policy roles_admin_delete on roles_usuario
  for delete using (negocio_id = current_negocio() and current_rol() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- productos: todos los del negocio leen; ALMACEN y ADMIN insertan/actualizan;
-- solo ADMIN borra.
-- ---------------------------------------------------------------------------
drop policy if exists productos_select on productos;
create policy productos_select on productos
  for select using (negocio_id = current_negocio());

drop policy if exists productos_insert on productos;
create policy productos_insert on productos
  for insert with check (negocio_id = current_negocio());

drop policy if exists productos_update on productos;
create policy productos_update on productos
  for update using (negocio_id = current_negocio());

drop policy if exists productos_delete on productos;
create policy productos_delete on productos
  for delete using (negocio_id = current_negocio() and current_rol() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- productos_costos: SOLO ADMIN del negocio (oculta el costo a ALMACEN vía RLS)
-- ---------------------------------------------------------------------------
drop policy if exists costos_admin_all on productos_costos;
create policy costos_admin_all on productos_costos
  for all
  using (negocio_id = current_negocio() and current_rol() = 'ADMIN')
  with check (negocio_id = current_negocio() and current_rol() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- movimientos_inventario: lectura del negocio; inserción directa bloqueada
-- (se escribe solo vía RPC security definer). Permitimos SELECT.
-- ---------------------------------------------------------------------------
drop policy if exists mov_select on movimientos_inventario;
create policy mov_select on movimientos_inventario
  for select using (negocio_id = current_negocio());
-- (sin policy de INSERT: las escrituras pasan por registrar_movimiento())
