-- Landing + tienda pública (pedido del cliente, 2026-10-08): catálogo público
-- con carrito que arma el pedido y lo manda por WhatsApp. Va en una tabla
-- aparte (productos_tienda), no en `productos`: así no se expone el
-- inventario completo ni el costo, y el negocio elige qué publicar con su
-- propia foto y descripción (mismo patrón ya usado en Farmacia Casana).

create table if not exists productos_tienda (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references negocios(id) on delete cascade,
  producto_id   uuid references productos(id) on delete set null,
  nombre        text not null,
  descripcion   text,
  categoria     text,
  precio_usd    numeric(12,2) not null default 0,
  imagen_url    text,
  destacado     boolean not null default false,
  activo        boolean not null default true,
  orden         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_productos_tienda_negocio on productos_tienda(negocio_id, activo, orden);

alter table productos_tienda enable row level security;

-- Pública: cualquiera (con o sin sesión) ve los productos activos. Sin esto,
-- un visitante sin cuenta no puede leer nada (RLS cierra todo por defecto).
drop policy if exists productos_tienda_select_publico on productos_tienda;
create policy productos_tienda_select_publico on productos_tienda
  for select using (activo = true);

-- El negocio ve y administra los suyos (publicados o no) si tiene permiso de
-- inventario o de facturas (compras), igual que el resto del catálogo.
drop policy if exists productos_tienda_select_panel on productos_tienda;
create policy productos_tienda_select_panel on productos_tienda
  for select using (negocio_id = current_negocio());

drop policy if exists productos_tienda_write on productos_tienda;
create policy productos_tienda_write on productos_tienda
  for all
  using (negocio_id = current_negocio() and (tiene_permiso('inventario', 'editar') or tiene_permiso('facturas', 'editar')))
  with check (negocio_id = current_negocio() and (tiene_permiso('inventario', 'editar') or tiene_permiso('facturas', 'editar')));

create or replace function public.set_updated_at_tienda()
 returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_productos_tienda_updated on productos_tienda;
create trigger trg_productos_tienda_updated before update on productos_tienda
  for each row execute function set_updated_at_tienda();

-- Productos de ejemplo para que la tienda no se vea vacía mientras se publican
-- los reales (fotos de Wikimedia Commons, licencia libre, verificadas). Se
-- pueden borrar o editar desde el panel cuando se vaya a producción.
insert into productos_tienda (negocio_id, nombre, descripcion, categoria, precio_usd, imagen_url, destacado, orden)
select '98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5', v.nombre, v.descripcion, v.categoria, v.precio_usd, v.imagen_url, v.destacado, v.orden
from (values
  ('Taladro percutor inalámbrico', 'Taladro percutor con batería recargable, ideal para pared y madera.', 'Herramientas',
   45.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Cordless%20Drill%20-%20unbranded.jpg?width=640', true, 1),
  ('Martillo de uña', 'Martillo de carpintero, mango ergonómico antideslizante.', 'Herramientas',
   8.50, 'https://commons.wikimedia.org/wiki/Special:FilePath/Hammer2.jpg?width=640', false, 2),
  ('Cinta métrica 5 m', 'Cinta métrica retráctil, carcasa resistente a caídas.', 'Herramientas',
   6.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Plastic%20tape%20measure.jpg?width=640', false, 3),
  ('Juego de destornilladores', 'Set de destornilladores con puntas intercambiables.', 'Herramientas',
   12.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Screwdriver%20set%20with%20great%20variety%20of%20bits%20and%20ratchet%20screwdriver.jpg?width=640', false, 4),
  ('Pintura blanca 1 galón', 'Pintura de caucho para interiores, acabado mate.', 'Pintura',
   18.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Paint%20bucket%20and%20brush.jpg?width=640', true, 5),
  ('Rodillo para pintar', 'Rodillo de felpa con mango, para pared y techo.', 'Pintura',
   5.50, 'https://commons.wikimedia.org/wiki/Special:FilePath/Farbroller.jpg?width=640', false, 6),
  ('Tomacorriente doble', 'Tomacorriente doble polarizado, color blanco.', 'Electricidad',
   4.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Electrical-Outlet-8830c.jpg?width=640', false, 7),
  ('Llave de tubo (stillson)', 'Llave de tubo para instalaciones de plomería.', 'Plomería',
   14.00, 'https://commons.wikimedia.org/wiki/Special:FilePath/Pipe-Wrench%20173087-480x360%20(4904403361).jpg?width=640', false, 8)
) as v(nombre, descripcion, categoria, precio_usd, imagen_url, destacado, orden)
where not exists (select 1 from productos_tienda where negocio_id = '98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5');
