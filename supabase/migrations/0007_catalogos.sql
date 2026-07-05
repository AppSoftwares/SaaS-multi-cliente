-- ============================================================================
-- 0007_catalogos.sql
-- Catálogos administrables: categorías (madre/sub), marcas y unidades.
-- Productos referencian categoria_id y guardan marca (texto).
-- ============================================================================

-- Categorías jerárquicas (parent_id NULL = categoría madre)
create table if not exists categorias (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocios(id) on delete cascade,
  nombre      text not null,
  parent_id   uuid references categorias(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists idx_categorias_negocio on categorias(negocio_id);
create index if not exists idx_categorias_parent on categorias(parent_id);
create unique index if not exists uq_categoria_nombre
  on categorias(negocio_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));

-- Marcas y unidades (listas simples administrables)
create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_marca on marcas(negocio_id, lower(nombre));

create table if not exists unidades (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_unidad on unidades(negocio_id, lower(nombre));

-- Producto: enlace a categoría estructurada + marca (texto)
alter table productos
  add column if not exists categoria_id uuid references categorias(id) on delete set null,
  add column if not exists marca text;

-- ---------------------------------------------------------------------------
-- RLS: lectura por negocio; inserción por cualquier usuario del negocio
-- (permite crear categorías/marcas al vuelo en la captura); update/delete ADMIN.
-- ---------------------------------------------------------------------------
alter table categorias enable row level security;
alter table marcas     enable row level security;
alter table unidades   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categorias','marcas','unidades'] loop
    execute format('drop policy if exists %1$s_select on %1$s;', t);
    execute format('create policy %1$s_select on %1$s for select using (negocio_id = current_negocio());', t);
    execute format('drop policy if exists %1$s_insert on %1$s;', t);
    execute format('create policy %1$s_insert on %1$s for insert with check (negocio_id = current_negocio());', t);
    execute format('drop policy if exists %1$s_update on %1$s;', t);
    execute format('create policy %1$s_update on %1$s for update using (negocio_id = current_negocio() and current_rol() = ''ADMIN'');', t);
    execute format('drop policy if exists %1$s_delete on %1$s;', t);
    execute format('create policy %1$s_delete on %1$s for delete using (negocio_id = current_negocio() and current_rol() = ''ADMIN'');', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Semillas por negocio (unidades, marcas y categorías comunes de ferretería)
-- ---------------------------------------------------------------------------
create or replace function seed_catalogos(p_negocio uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_madre uuid;
begin
  if not exists (select 1 from unidades where negocio_id = p_negocio) then
    insert into unidades (negocio_id, nombre)
    select p_negocio, u from unnest(array['Unidad','Caja','Par','Juego','Galón','Litro','Metro','Kilogramo','Saco','Rollo','Docena','Bolsa']) u;
  end if;

  if not exists (select 1 from marcas where negocio_id = p_negocio) then
    insert into marcas (negocio_id, nombre)
    select p_negocio, m from unnest(array['Genérica','Truper','Stanley','Bosch','DeWalt','Black+Decker']) m;
  end if;

  if not exists (select 1 from categorias where negocio_id = p_negocio) then
    insert into categorias (negocio_id,nombre) values (p_negocio,'Construcción') returning id into v_madre;
    insert into categorias (negocio_id,nombre,parent_id) select p_negocio,s,v_madre from unnest(array['Cemento','Bloques','Agregados']) s;
    insert into categorias (negocio_id,nombre) values (p_negocio,'Herramientas') returning id into v_madre;
    insert into categorias (negocio_id,nombre,parent_id) select p_negocio,s,v_madre from unnest(array['Manuales','Eléctricas','Accesorios']) s;
    insert into categorias (negocio_id,nombre) values (p_negocio,'Pinturas') returning id into v_madre;
    insert into categorias (negocio_id,nombre,parent_id) select p_negocio,s,v_madre from unnest(array['Interiores','Exteriores','Accesorios']) s;
    insert into categorias (negocio_id,nombre) values (p_negocio,'Plomería') returning id into v_madre;
    insert into categorias (negocio_id,nombre,parent_id) select p_negocio,s,v_madre from unnest(array['Tuberías','Griferías','Conexiones']) s;
    insert into categorias (negocio_id,nombre) values (p_negocio,'Eléctrico') returning id into v_madre;
    insert into categorias (negocio_id,nombre,parent_id) select p_negocio,s,v_madre from unnest(array['Cables','Iluminación','Tomacorrientes']) s;
    insert into categorias (negocio_id,nombre) values (p_negocio,'Hogar') returning id into v_madre;
    insert into categorias (negocio_id,nombre,parent_id) select p_negocio,s,v_madre from unnest(array['Cocina','Baño','Limpieza']) s;
    insert into categorias (negocio_id,nombre) values (p_negocio,'Tornillería') returning id into v_madre;
    insert into categorias (negocio_id,nombre,parent_id) select p_negocio,s,v_madre from unnest(array['Tornillos','Tuercas','Clavos']) s;
  end if;
end $$;

-- Semilla para negocios existentes
do $$ declare n record; begin
  for n in select id from negocios loop perform seed_catalogos(n.id); end loop;
end $$;

-- bootstrap_negocio: al crear un negocio, sembrar catálogos también
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

  perform seed_catalogos(v_negocio);
  return v_negocio;
end $$;
