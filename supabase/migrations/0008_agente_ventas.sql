-- ============================================================================
-- 0008_agente_ventas.sql
-- Esquema para el agente de ventas "Morgan" (Telegram/WhatsApp vía n8n).
-- El agente accede por conexión Postgres directa (rol postgres → bypassa RLS).
-- ============================================================================

-- Enums
do $$ begin
  create type estado_pedido as enum
    ('borrador','confirmado','esperando_pago','pagado','procesando','entregado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_entrega as enum ('delivery','retiro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Clientes del bot
-- ---------------------------------------------------------------------------
create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references negocios(id) on delete cascade,
  telegram_id bigint unique,
  nombre      text,
  telefono    text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Estado de conversación + handoff a humano
-- ---------------------------------------------------------------------------
create table if not exists conversaciones (
  telegram_id bigint primary key,
  negocio_id  uuid not null references negocios(id) on delete cascade,
  modo        text not null default 'bot' check (modo in ('bot','humano')),
  estado      text default 'navegando',
  datos       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Carrito (un renglón por producto, por chat)
-- ---------------------------------------------------------------------------
create table if not exists carritos (
  id          uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  negocio_id  uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad    integer not null default 1 check (cantidad > 0),
  created_at  timestamptz not null default now(),
  unique (telegram_id, producto_id)
);
create index if not exists idx_carritos_chat on carritos(telegram_id);

-- ---------------------------------------------------------------------------
-- Pedidos + items
-- ---------------------------------------------------------------------------
create table if not exists pedidos (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references negocios(id) on delete cascade,
  telegram_id       bigint,
  cliente_id        uuid references clientes(id) on delete set null,
  estado            estado_pedido not null default 'borrador',
  tipo_entrega      tipo_entrega,
  lat               double precision,
  lng               double precision,
  direccion         text,
  costo_delivery    numeric(14,2) not null default 0,
  total_bs          numeric(14,2) not null default 0,
  total_usd         numeric(12,2) not null default 0,
  metodo_pago       text,
  comprobante_file_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_pedidos_negocio on pedidos(negocio_id, created_at desc);
create index if not exists idx_pedidos_chat on pedidos(telegram_id);

create table if not exists pedido_items (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references pedidos(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  nombre      text not null,
  cantidad    integer not null,
  precio_bs   numeric(14,2) not null,
  subtotal_bs numeric(14,2) not null
);
create index if not exists idx_pedido_items_pedido on pedido_items(pedido_id);

-- ---------------------------------------------------------------------------
-- Métodos de pago (editables por el admin)
-- ---------------------------------------------------------------------------
create table if not exists metodos_pago (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  tipo       text not null,
  datos      text not null,
  activo     boolean not null default true
);

-- ---------------------------------------------------------------------------
-- RLS: la app (admin) puede leer pedidos por negocio; el bot escribe por
-- conexión directa (rol postgres, bypassa RLS) y por funciones SECURITY DEFINER.
-- ---------------------------------------------------------------------------
alter table pedidos       enable row level security;
alter table pedido_items  enable row level security;
alter table metodos_pago  enable row level security;
alter table clientes      enable row level security;

drop policy if exists pedidos_select on pedidos;
create policy pedidos_select on pedidos for select using (negocio_id = current_negocio());

drop policy if exists pedido_items_select on pedido_items;
create policy pedido_items_select on pedido_items for select
  using (exists (select 1 from pedidos p where p.id = pedido_id and p.negocio_id = current_negocio()));

drop policy if exists metodos_pago_all on metodos_pago;
create policy metodos_pago_all on metodos_pago for all
  using (negocio_id = current_negocio()) with check (negocio_id = current_negocio());

drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select using (negocio_id = current_negocio());

-- ---------------------------------------------------------------------------
-- Función: crear_pedido — arma el pedido desde el carrito y lo deja 'confirmado'
-- ---------------------------------------------------------------------------
create or replace function crear_pedido(
  p_telegram_id  bigint,
  p_negocio_id   uuid,
  p_tipo_entrega tipo_entrega default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pedido uuid; v_total numeric := 0; v_count int;
begin
  select count(*) into v_count from carritos where telegram_id = p_telegram_id and negocio_id = p_negocio_id;
  if v_count = 0 then raise exception 'El carrito está vacío'; end if;

  insert into pedidos (negocio_id, telegram_id, estado, tipo_entrega)
  values (p_negocio_id, p_telegram_id, 'confirmado', p_tipo_entrega)
  returning id into v_pedido;

  insert into pedido_items (pedido_id, producto_id, nombre, cantidad, precio_bs, subtotal_bs)
  select v_pedido, p.id, p.nombre, c.cantidad, p.precio_venta_bs, (c.cantidad * p.precio_venta_bs)
  from carritos c join productos p on p.id = c.producto_id
  where c.telegram_id = p_telegram_id and c.negocio_id = p_negocio_id;

  select coalesce(sum(subtotal_bs), 0) into v_total from pedido_items where pedido_id = v_pedido;
  update pedidos set total_bs = v_total, updated_at = now() where id = v_pedido;

  delete from carritos where telegram_id = p_telegram_id and negocio_id = p_negocio_id;

  return jsonb_build_object('pedido_id', v_pedido, 'total_bs', v_total, 'items', v_count);
end $$;

-- ---------------------------------------------------------------------------
-- Función: aprobar_pago — marca 'procesando' y DESCUENTA stock (venta pagada)
-- ---------------------------------------------------------------------------
create or replace function aprobar_pago(p_pedido_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare it record; v_neg uuid; v_nueva int;
begin
  select negocio_id into v_neg from pedidos where id = p_pedido_id;
  if v_neg is null then raise exception 'Pedido no existe'; end if;

  for it in
    select producto_id, cantidad from pedido_items
    where pedido_id = p_pedido_id and producto_id is not null
  loop
    update productos set cantidad = greatest(0, cantidad - it.cantidad)
    where id = it.producto_id
    returning cantidad into v_nueva;

    insert into movimientos_inventario
      (negocio_id, producto_id, tipo, cantidad_afectada, cantidad_resultante, usuario_id, nota)
    values
      (v_neg, it.producto_id, 'VENTA', -it.cantidad, v_nueva, null,
       'Venta por bot (pedido ' || p_pedido_id || ')');
  end loop;

  update pedidos set estado = 'procesando', updated_at = now() where id = p_pedido_id;
  return jsonb_build_object('ok', true, 'pedido_id', p_pedido_id);
end $$;

-- ---------------------------------------------------------------------------
-- Semilla de métodos de pago (placeholders) para negocios existentes
-- ---------------------------------------------------------------------------
do $$ declare n record; begin
  for n in select id from negocios loop
    if not exists (select 1 from metodos_pago where negocio_id = n.id) then
      insert into metodos_pago (negocio_id, tipo, datos) values
        (n.id, 'Pago Móvil', 'Banco: —  ·  Teléfono: —  ·  Cédula/RIF: —'),
        (n.id, 'Zelle', 'Correo: —  ·  Titular: —'),
        (n.id, 'Binance (USDT)', 'ID/Correo Binance: —'),
        (n.id, 'Efectivo', 'Paga al retirar en el local');
    end if;
  end loop;
end $$;
