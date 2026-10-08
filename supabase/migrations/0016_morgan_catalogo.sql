begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
-- Catálogo comercial de UN negocio. Costos, usuarios y clientes excluidos.
create view public.morgan_catalogo_fuente with (security_invoker=true) as
select id, left(nombre,160) nombre, left(concat_ws(' · ',descripcion,'Marca: '||marca),1500) descripcion, left(coalesce(nullif(categoria,''),'General'),80) categoria,
 case when (precio_venta_usd_ajustado) between 0 and 1000000 then round((precio_venta_usd_ajustado)*100)::integer else null end precio_centavos,
 (cantidad>0) disponible, (activo) activo, (imagen_url) imagen_url, (sku) sku, (codigo_barras) codigo_barras,
 (unidad_medida) unidad_medida, (cantidad::numeric) cantidad, (precio_venta_bs) precio_bs, null::numeric tiempo_prep_min, (false) destacado, (updated_at)::text actualizado_en
 from public.productos where negocio_id='98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5';
revoke all on public.morgan_catalogo_fuente from public,anon,authenticated;
grant select on public.morgan_catalogo_fuente to service_role;
create function public.morgan_catalogo(p_consulta text default '',p_ids uuid[] default null,p_offset integer default 0,p_limite integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; total bigint; matches bigint; words text[];
begin
 if length(p_consulta)>200 or p_offset not between 0 and 100000 or p_limite not between 1 and 150 or cardinality(p_ids)>30 then raise exception 'CONSULTA_INVALIDA'; end if;
 words:=regexp_split_to_array(lower(translate(regexp_replace(coalesce(p_consulta,''),'[^[:alnum:] ]',' ','g'),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'[[:space:]]+');
 select count(*) into total from morgan_catalogo_fuente where activo;
 select count(*) into matches from morgan_catalogo_fuente p where activo and (p_ids is null or id=any(p_ids)) and (p_ids is not null or not exists(select 1 from unnest(words) w where w<>'' and strpos(lower(translate(concat_ws(' ',p.nombre,p.descripcion,p.categoria,p.sku,p.codigo_barras),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),w)=0));
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (select p.* from morgan_catalogo_fuente p where activo and (p_ids is null or id=any(p_ids)) and (p_ids is not null or not exists(select 1 from unnest(words) w where w<>'' and strpos(lower(translate(concat_ws(' ',p.nombre,p.descripcion,p.categoria,p.sku,p.codigo_barras),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),w)=0)) order by nombre,id offset p_offset limit p_limite) r;
 return jsonb_build_object('fuente','inventario-ferreteria','consultado_en',now(),'total',matches,'total_catalogo',total,'productos',result);
end $$;
revoke all on function public.morgan_catalogo(text,uuid[],integer,integer) from public,anon,authenticated;
grant execute on function public.morgan_catalogo(text,uuid[],integer,integer) to service_role;
commit;
