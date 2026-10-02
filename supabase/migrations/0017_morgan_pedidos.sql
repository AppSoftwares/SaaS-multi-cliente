begin;
alter table negocios add column morgan_pago_instrucciones text check(length(morgan_pago_instrucciones)<=3000);
alter table pedidos add column morgan_solicitud_id uuid unique,add column morgan_cotizacion jsonb,add column morgan_total_centavos bigint,add column morgan_tasa numeric,add column morgan_total_bs numeric,add column morgan_whatsapp_enviado_en timestamptz,add column morgan_envio_reservado_hasta timestamptz,add column morgan_pago_aprobado_at timestamptz,add column morgan_comprobante_ref text,add column morgan_verificado_por uuid references auth.users(id);
create function public.morgan_importar_pedido(p_datos jsonb) returns uuid language plpgsql security definer set search_path=public as $$
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
revoke all on function public.morgan_importar_pedido(jsonb) from public,anon,authenticated;
grant execute on function public.morgan_importar_pedido(jsonb) to service_role;
create function public.morgan_guard_pedido() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.morgan_solicitud_id is null then return new;end if;
 if tg_op='UPDATE' then
  if old.morgan_solicitud_id is not null and (new.morgan_solicitud_id is distinct from old.morgan_solicitud_id or new.morgan_cotizacion is distinct from old.morgan_cotizacion or new.morgan_total_centavos is distinct from old.morgan_total_centavos or new.morgan_tasa is distinct from old.morgan_tasa or new.morgan_total_bs is distinct from old.morgan_total_bs) then raise exception 'COTIZACION_FIJADA';end if;
  if new.morgan_pago_aprobado_at is distinct from old.morgan_pago_aprobado_at and (auth.uid() is null or not exists(select 1 from roles_usuario where id=auth.uid() and negocio_id=new.negocio_id and rol::text='ADMIN') or nullif(btrim(new.morgan_comprobante_ref),'') is null) then raise exception 'PAGO_REQUIERE_ADMIN_COMPROBANTE';end if;
 end if;
 if (new.estado in ('pagado','procesando','entregado')) and new.morgan_pago_aprobado_at is null then raise exception 'PAGO_REQUIERE_ADMIN_COMPROBANTE';end if;
 new.total_usd:=new.morgan_total_centavos/100.0; new.total_bs:=new.morgan_total_bs;return new;
end $$;
revoke all on function public.morgan_guard_pedido() from public,anon,authenticated;
create trigger morgan_guard before insert or update on pedidos for each row execute function public.morgan_guard_pedido();
create function public.morgan_guard_items() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from pedidos where id=old.pedido_id and morgan_solicitud_id is not null) then raise exception 'COTIZACION_FIJADA';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.morgan_guard_items() from public,anon,authenticated;
create trigger morgan_guard_items before update or delete on pedido_items for each row execute function public.morgan_guard_items();
create function public.morgan_aprobar_pago(p_id uuid,p_comprobante text) returns uuid language plpgsql security definer set search_path=public as $$
declare r public.pedidos;balance numeric;
begin
 if auth.uid() is null or not exists(select 1 from roles_usuario where id=auth.uid() and negocio_id='98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5' and rol::text='ADMIN') then raise exception 'SIN_PERMISO';end if;
 select * into r from pedidos where id=p_id and negocio_id='98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5' and morgan_solicitud_id is not null for update;
 if r.id is null then raise exception 'NO_ENCONTRADO';end if;
 if r.morgan_pago_aprobado_at is not null then return p_id;end if;
 if r.estado='cancelado' then raise exception 'CANCELADO';end if;
 if length(btrim(p_comprobante)) not between 5 and 200 then raise exception 'COMPROBANTE_REQUERIDO';end if;
 update pedidos set morgan_pago_aprobado_at=now(),morgan_comprobante_ref=p_comprobante,morgan_verificado_por=auth.uid() where id=p_id;
 perform aprobar_pago(p_id);
 return p_id;
end $$;
revoke all on function public.morgan_aprobar_pago(uuid,text) from public,anon,service_role;
grant execute on function public.morgan_aprobar_pago(uuid,text) to authenticated;
create function public.morgan_reservar_envio(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 update pedidos set morgan_envio_reservado_hasta=now()+interval '90 seconds' where id=p_id and negocio_id='98c5f4e0-c6ba-4fe0-801a-b08bcf4fe9c5' and morgan_solicitud_id is not null and morgan_whatsapp_enviado_en is null and morgan_pago_aprobado_at is null and estado<>'cancelado' and (morgan_envio_reservado_hasta is null or morgan_envio_reservado_hasta<now());
 get diagnostics n=row_count;return n=1;
end $$;
revoke all on function public.morgan_reservar_envio(uuid) from public,anon,authenticated;
grant execute on function public.morgan_reservar_envio(uuid) to service_role;
commit;
