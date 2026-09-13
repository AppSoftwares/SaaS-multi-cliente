-- ============================================================================
-- 0005_precio_bolivares.sql
-- Precio en bolívares y "precio USD con conversión" (ajuste por prima Binance/BCV).
-- El ADMIN actualiza las tasas con un botón y se recalculan todos los precios.
-- ============================================================================

-- Tasas guardadas a nivel de negocio
alter table negocios
  add column if not exists tasa_bcv           numeric(14,4),
  add column if not exists tasa_binance       numeric(14,4),
  add column if not exists tasa_actualizada_at timestamptz;

-- Precios derivados en productos (visibles para todos los roles: se usan para cobrar)
alter table productos
  add column if not exists precio_venta_bs           numeric(14,2) not null default 0,
  add column if not exists precio_venta_usd_ajustado numeric(12,2) not null default 0;

-- ---------------------------------------------------------------------------
-- Trigger: recalcula los precios derivados desde las tasas del negocio.
--   ajustado = P * BINANCE / BCV      (precio en USD que se cotiza)
--   bs       = P * BINANCE            (bolívares a cobrar = ajustado * BCV)
-- Única fuente de verdad de la fórmula. Si no hay tasas, deja los campos en 0.
-- ---------------------------------------------------------------------------
create or replace function recalcular_precios_producto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_bcv     numeric;
  v_binance numeric;
begin
  select tasa_bcv, tasa_binance into v_bcv, v_binance
  from negocios where id = new.negocio_id;

  if v_bcv is not null and v_bcv > 0 and v_binance is not null and v_binance > 0 then
    new.precio_venta_usd_ajustado := round(new.precio_venta * v_binance / v_bcv, 2);
    new.precio_venta_bs           := round(new.precio_venta * v_binance, 2);
  else
    new.precio_venta_usd_ajustado := 0;
    new.precio_venta_bs           := 0;
  end if;
  return new;
end $$;

drop trigger if exists trg_recalcular_precios on productos;
create trigger trg_recalcular_precios
  before insert or update on productos
  for each row execute function recalcular_precios_producto();

-- ---------------------------------------------------------------------------
-- RPC: actualiza las tasas del negocio y recalcula TODO el catálogo. Solo ADMIN.
-- ---------------------------------------------------------------------------
create or replace function actualizar_precios_bs(
  p_bcv     numeric,
  p_binance numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := current_negocio();
  v_count   integer;
begin
  if current_rol() is distinct from 'ADMIN' then
    raise exception 'Solo un ADMIN puede actualizar las tasas';
  end if;
  if p_bcv is null or p_bcv <= 0 or p_binance is null or p_binance <= 0 then
    raise exception 'Las tasas deben ser mayores a 0';
  end if;

  update negocios
    set tasa_bcv = p_bcv, tasa_binance = p_binance, tasa_actualizada_at = now()
  where id = v_negocio;

  -- Toca las filas para disparar el trigger de recálculo
  update productos set updated_at = now() where negocio_id = v_negocio;
  get diagnostics v_count = row_count;

  return jsonb_build_object('actualizados', v_count, 'tasa_bcv', p_bcv, 'tasa_binance', p_binance);
end $$;
