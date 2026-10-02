begin;
create or replace function public.morgan_importar_pedido(p_datos jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_neg constant uuid:='98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5';v_sid uuid:=(p_datos->>'solicitud_id')::uuid;v_id uuid;old_data jsonb;v_cliente uuid;v_total bigint;v_tasa numeric;v_bs numeric;it jsonb;v_origin uuid;
begin
 if jsonb_typeof(p_datos->'items')<>'array' or jsonb_array_length(p_datos->'items') not between 1 and 30 or coalesce(p_datos->>'telefono','')!~'^58[0-9]{10}$' then raise exception 'DATOS_INVALIDOS'; end if;
 perform pg_advisory_xact_lock(hashtextextended('morgan:'||v_sid::text,0));
 select id,morgan_cotizacion into v_id,old_data from pedidos where negocio_id=v_neg and morgan_solicitud_id=v_sid;
 if v_id is not null then if old_data<>p_datos then raise exception 'COTIZACION_FIJADA'; end if;return v_id;end if;
 v_total:=coalesce((p_datos->>'delivery_centavos')::bigint,0)+coalesce((p_datos->>'ajuste_centavos')::bigint,0);
 for it in select value from jsonb_array_elements(p_datos->'items') loop
  if (it->>'cantidad')::int not between 1 and 100 or (it->>'precio_centavos')::bigint not between 0 and 100000000 then raise exception 'ITEM_INVALIDO'; end if;
  v_origin:=(it->>'plato_id')::uuid;
  if v_origin is not null and not exists(select 1 from morgan_catalogo_fuente where id=v_origin) then raise exception 'PRODUCTO_AJENO';end if;
  v_total:=v_total+(it->>'cantidad')::bigint*(it->>'precio_centavos')::bigint;
 end loop;
 if v_total not between 0 and 100000000 then raise exception 'TOTAL_INVALIDO';end if;
 v_tasa:=(p_datos->'cambio'->>'tasa')::numeric;
 if v_tasa is null then select tasa_bcv into v_tasa from negocios where id=v_neg;end if;
 if v_tasa is null or v_tasa<=0 or v_tasa>1000000 then raise exception 'CONFIGURA_TASA';end if;
 v_bs:=round(v_total*v_tasa/100,2);
 perform set_config('morgan.importando',v_sid::text,true);
 perform pg_advisory_xact_lock(hashtextextended(v_neg::text||':'||(p_datos->>'telefono'),0));
 select id into v_cliente from clientes where negocio_id=v_neg and telefono=p_datos->>'telefono' limit 1;
 if v_cliente is null then insert into clientes(negocio_id,nombre,telefono) values(v_neg,p_datos->>'nombre',p_datos->>'telefono') returning id into v_cliente;end if;
 insert into pedidos(negocio_id,cliente_id,estado,tipo_entrega,direccion,lat,lng,costo_delivery,total_usd,total_bs,subtotal_bs,base_imponible_bs,cliente_nombre,cliente_telefono,cliente_direccion,morgan_solicitud_id,morgan_cotizacion,morgan_total_centavos,morgan_tasa,morgan_total_bs) values(v_neg,v_cliente,'esperando_pago',(p_datos->>'tipo_entrega')::tipo_entrega,p_datos->>'direccion',(p_datos->>'lat')::numeric,(p_datos->>'lng')::numeric,(p_datos->>'delivery_centavos')::numeric*v_tasa/100,v_total/100.0,v_bs,v_bs-(p_datos->>'delivery_centavos')::numeric*v_tasa/100,v_bs-(p_datos->>'delivery_centavos')::numeric*v_tasa/100,p_datos->>'nombre',p_datos->>'telefono',p_datos->>'direccion',v_sid,p_datos,v_total,v_tasa,v_bs) returning id into v_id;
 for it in select value from jsonb_array_elements(p_datos->'items') loop v_origin:=(it->>'plato_id')::uuid;insert into pedido_items(pedido_id,producto_id,nombre,cantidad,precio_bs,subtotal_bs) values(v_id,v_origin,concat_ws(' · ',it->>'nombre',nullif(it->>'nota','')),(it->>'cantidad')::int,round((it->>'precio_centavos')::numeric*v_tasa/100,2),round((it->>'cantidad')::int*(it->>'precio_centavos')::numeric*v_tasa/100,2));end loop;
 if coalesce((p_datos->>'ajuste_centavos')::numeric,0)<>0 then
  it:=jsonb_build_object('nombre','Ajuste del presupuesto Morgan','cantidad',1,'precio_centavos',(p_datos->>'ajuste_centavos')::numeric);v_origin:=null;insert into pedido_items(pedido_id,producto_id,nombre,cantidad,precio_bs,subtotal_bs) values(v_id,v_origin,concat_ws(' · ',it->>'nombre',nullif(it->>'nota','')),(it->>'cantidad')::int,round((it->>'precio_centavos')::numeric*v_tasa/100,2),round((it->>'cantidad')::int*(it->>'precio_centavos')::numeric*v_tasa/100,2));
 end if;
 
 return v_id;
end $$;
create or replace function public.morgan_guard_items() returns trigger language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
 if tg_op<>'INSERT' and exists(select 1 from pedidos where id=old.pedido_id and morgan_solicitud_id is not null) then raise exception 'COTIZACION_FIJADA';end if;
 if tg_op<>'DELETE' then
  select morgan_solicitud_id into sid from pedidos where id=new.pedido_id;
  if sid is not null and (tg_op<>'INSERT' or current_setting('morgan.importando',true) is distinct from sid::text) then raise exception 'COTIZACION_FIJADA';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger morgan_guard_items on pedido_items;
create trigger morgan_guard_items before insert or update or delete on pedido_items for each row execute function public.morgan_guard_items();
commit;
