-- pgcrypto está instalado en el esquema "extensions" (Supabase), pero las
-- funciones de claves tenían search_path = public: crypt() y gen_salt() no se
-- encontraban y guardar/validar una clave fallaba siempre.
--
-- Consecuencia que ya existía: la clave de descuentos de Caja NUNCA pudo
-- guardarse (ningún negocio tiene clave_descuentos_hash) y, sin clave, los
-- descuentos del POS eran imposibles. Se corrige eso y las funciones de la
-- clave de eliminación (0014), que heredaron el mismo search_path.

create or replace function public.set_clave_descuentos(p_clave text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if current_rol() is distinct from 'ADMIN' then
    raise exception 'Solo un ADMIN puede configurar la clave de descuentos';
  end if;
  if p_clave is null or length(p_clave) < 4 then
    raise exception 'La clave debe tener al menos 4 caracteres';
  end if;
  update negocios set clave_descuentos_hash = crypt(p_clave, gen_salt('bf')) where id = current_negocio();
end $function$;

create or replace function public.validar_clave_descuento(p_clave text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text;
begin
  select clave_descuentos_hash into v_hash from negocios where id = current_negocio();
  if v_hash is null or p_clave is null or p_clave = '' then
    return false;
  end if;
  return crypt(p_clave, v_hash) = v_hash;
end $function$;

create or replace function public.validar_clave_eliminacion(p_clave text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
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

create or replace function public.set_clave_eliminacion(p_clave text, p_clave_actual text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
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

-- eliminar_proveedor / eliminar_factura llaman a validar_clave_eliminacion (que
-- ya usa el search_path correcto); no necesitan cambios.
