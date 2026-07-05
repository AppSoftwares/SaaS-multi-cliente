-- ============================================================================
-- 0001_esquema_inicial.sql
-- Esquema base del inventario de ferretería.
-- Multi-tienda listo desde el día 1: negocio_id en todas las tablas.
-- ============================================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type rol_usuario as enum ('ADMIN', 'ALMACEN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_movimiento as enum ('INGRESO', 'AJUSTE', 'VENTA', 'ALTA');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tabla: negocios (listo para multi-tienda; hoy se siembra 1 fila)
-- ---------------------------------------------------------------------------
create table if not exists negocios (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabla: roles_usuario (vincula auth.users con un negocio y un rol)
-- ---------------------------------------------------------------------------
create table if not exists roles_usuario (
  id          uuid primary key references auth.users(id) on delete cascade,
  negocio_id  uuid not null references negocios(id) on delete cascade,
  rol         rol_usuario not null default 'ALMACEN',
  created_at  timestamptz not null default now()
);
create index if not exists idx_roles_negocio on roles_usuario(negocio_id);

-- ---------------------------------------------------------------------------
-- Tabla: productos (catálogo compartido por negocio)
-- ---------------------------------------------------------------------------
create table if not exists productos (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references negocios(id) on delete cascade,
  sku            text,
  codigo_barras  text,
  nombre         text not null,
  descripcion    text,
  categoria      text,
  unidad_medida  text not null default 'unidad',
  cantidad       integer not null default 0,
  stock_minimo   integer not null default 0,
  precio_venta   numeric(10,2) not null default 0,
  imagen_url     text,
  proveedor      text,
  ubicacion      text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- UNIQUE por negocio (no globales): dos tiendas podrán repetir SKU/código
create unique index if not exists uq_productos_sku
  on productos(negocio_id, sku) where sku is not null;
create unique index if not exists uq_productos_codbarras
  on productos(negocio_id, codigo_barras) where codigo_barras is not null;
create index if not exists idx_productos_negocio on productos(negocio_id);
create index if not exists idx_productos_nombre on productos(negocio_id, lower(nombre));

-- ---------------------------------------------------------------------------
-- Tabla: productos_costos (separada para que la RLS oculte el costo a ALMACEN)
-- ---------------------------------------------------------------------------
create table if not exists productos_costos (
  producto_id   uuid primary key references productos(id) on delete cascade,
  negocio_id    uuid not null references negocios(id) on delete cascade,
  precio_costo  numeric(10,2) not null default 0
);
create index if not exists idx_costos_negocio on productos_costos(negocio_id);

-- ---------------------------------------------------------------------------
-- Tabla: movimientos_inventario (historial / auditoría)
-- ---------------------------------------------------------------------------
create table if not exists movimientos_inventario (
  id                  uuid primary key default gen_random_uuid(),
  negocio_id          uuid not null references negocios(id) on delete cascade,
  producto_id         uuid not null references productos(id) on delete cascade,
  tipo                tipo_movimiento not null,
  cantidad_afectada   integer not null,
  cantidad_resultante integer not null,
  usuario_id          uuid references auth.users(id) on delete set null,
  nota                text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_mov_negocio on movimientos_inventario(negocio_id, created_at desc);
create index if not exists idx_mov_producto on movimientos_inventario(producto_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Trigger updated_at en productos
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_productos_updated on productos;
create trigger trg_productos_updated
  before update on productos
  for each row execute function set_updated_at();
