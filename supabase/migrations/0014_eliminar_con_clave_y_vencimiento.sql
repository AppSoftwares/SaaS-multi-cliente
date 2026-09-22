-- Pedido del cliente (Joel Ferretería, 2026-09-21):
--  1) Eliminar facturas y proveedores solo con una clave que tenga únicamente el
--     dueño (distinta de la clave de descuentos, que conocen los cajeros).
--  2) Días de crédito por factura y fecha de vencimiento, para alertar las que
--     están por vencer o vencidas.

-- ---------------------------------------------------------------------------
-- 1) Clave de eliminación
-- ---------------------------------------------------------------------------
-- El hash va en una tabla aparte, con RLS y SIN políticas: solo las funciones
-- SECURITY DEFINER pueden leerlo (negocios es legible por todo el negocio, y un
-- hash de una clave corta se podría atacar por fuerza bruta desde el cliente).
create table if not exists negocios_secretos (
  negocio_id uuid primary key references negocios(id) on delete cascade,
  clave_eliminacion_hash text
);
alter table negocios_secretos enable row level security;
revoke all on negocios_secretos from anon, authenticated;

create or replace function public.tiene_clave_eliminacion()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from negocios_secretos
    where negocio_id = current_negocio() and clave_eliminacion_hash is not null
  );
$function$;

create or replace function public.validar_clave_eliminacion(p_clave text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_hash text;
begin
  select clave_eliminacion_hash into v_hash from negocios_secretos where negocio_id = current_negocio();
  if v_hash is null or p_clave is null or p_clave = '' then
    return false;
  end if;
  return crypt(p_clave, v_hash) = v_hash;
end $function$;

-- Si ya hay una clave, para cambiarla hay que dar la actual.
create or replace function public.set_clave_eliminacion(p_clave text, p_clave_actual text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
  v_hash text;
begin
  if current_rol() is distinct from 'ADMIN' then
    raise exception 'Solo un ADMIN puede configurar la clave de eliminación';
  end if;
  if p_clave is null or length(p_clave) < 4 then
    raise exception 'La clave debe tener al menos 4 caracteres';
  end if;
  select clave_eliminacion_hash into v_hash from negocios_secretos where negocio_id = v_negocio;
  if v_hash is not null and (p_clave_actual is null or crypt(p_clave_actual, v_hash) <> v_hash) then
    raise exception 'La clave actual es incorrecta';
  end if;
  insert into negocios_secretos (negocio_id, clave_eliminacion_hash)
  values (v_negocio, crypt(p_clave, gen_salt('bf')))
  on conflict (negocio_id) do update set clave_eliminacion_hash = excluded.clave_eliminacion_hash;
end $function$;

create or replace function public.eliminar_proveedor(p_id uuid, p_clave text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if current_rol() is distinct from 'ADMIN' then
    raise exception 'Solo un ADMIN puede eliminar proveedores';
  end if;
  if not validar_clave_eliminacion(p_clave) then
    raise exception 'Clave de eliminación incorrecta';
  end if;
  delete from proveedores where id = p_id and negocio_id = current_negocio();
  if not found then
    raise exception 'Proveedor no encontrado';
  end if;
end $function$;

-- Elimina una factura (con sus líneas y abonos). Con p_revertir_inventario
-- deshace también su efecto en el inventario: los productos que creó (si no se
-- han vendido ni tienen otros movimientos) y el stock que sumó a productos
-- existentes. Todo o nada: si no se puede revertir, no se elimina nada.
create or replace function public.eliminar_factura(
  p_factura_id uuid,
  p_clave text,
  p_revertir_inventario boolean default false
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_negocio uuid := current_negocio();
  v_fact    record;
  r         record;
  v_actual  integer;
  v_cant    integer;
  v_nueva   integer;
  v_borrados integer := 0;
  v_revertidos integer := 0;
begin
  if v_negocio is null or current_rol() is distinct from 'ADMIN' then
    raise exception 'Solo un ADMIN puede eliminar facturas';
  end if;
  if not validar_clave_eliminacion(p_clave) then
    raise exception 'Clave de eliminación incorrecta';
  end if;
  select * into v_fact from facturas where id = p_factura_id and negocio_id = v_negocio;
  if not found then
    raise exception 'Factura no encontrada';
  end if;

  if p_revertir_inventario and v_fact.estado <> 'borrador' then
    for r in
      select * from factura_items
      where factura_id = p_factura_id and producto_id is not null and aplicado
    loop
      select cantidad into v_actual from productos where id = r.producto_id and negocio_id = v_negocio;
      if not found then
        continue;
      end if;
      v_cant := round(r.cantidad)::integer;

      if r.es_nuevo then
        if exists (select 1 from pedido_items where producto_id = r.producto_id)
           or (select count(*) from movimientos_inventario where producto_id = r.producto_id) <> 1 then
          raise exception 'No se puede revertir el inventario: el producto "%" ya tiene ventas o movimientos posteriores. Elimina la factura sin revertir el inventario.', r.nombre;
        end if;
        update factura_items set producto_id = null where id = r.id;
        delete from movimientos_inventario where producto_id = r.producto_id;
        delete from productos_costos where producto_id = r.producto_id;
        delete from productos where id = r.producto_id;
        v_borrados := v_borrados + 1;
      else
        if v_actual < v_cant then
          raise exception 'No se puede revertir: el stock actual de "%" (%) es menor que lo que sumó la factura (%).', r.nombre, v_actual, v_cant;
        end if;
        v_nueva := v_actual - v_cant;
        update productos set cantidad = v_nueva where id = r.producto_id;
        insert into movimientos_inventario
          (negocio_id, producto_id, tipo, cantidad_afectada, cantidad_resultante, usuario_id, nota)
        values
          (v_negocio, r.producto_id, 'AJUSTE', -v_cant, v_nueva, auth.uid(),
           'Se eliminó la factura ' || coalesce(v_fact.numero_factura, v_fact.id::text) || ' (se revierte su ingreso)');
        v_revertidos := v_revertidos + 1;
      end if;
    end loop;
  end if;

  delete from facturas where id = p_factura_id;

  return jsonb_build_object(
    'eliminada', true,
    'productos_borrados', v_borrados,
    'stock_revertido', v_revertidos
  );
end $function$;

-- Ya no se puede eliminar por la API directa: solo con las funciones de arriba
-- (que exigen la clave). Los borradores siguen pudiéndose descartar.
drop policy if exists proveedores_delete on proveedores;
drop policy if exists pagos_proveedor_delete on pagos_proveedor;
drop policy if exists facturas_delete on facturas;
create policy facturas_delete on facturas
  for delete using (negocio_id = current_negocio() and current_rol() = 'ADMIN' and estado = 'borrador');

-- ---------------------------------------------------------------------------
-- 2) Crédito y vencimiento
-- ---------------------------------------------------------------------------
alter table facturas
  add column if not exists dias_credito integer,
  add column if not exists fecha_vencimiento date;
