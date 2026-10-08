begin;
create or replace function public.morgan_guard_pedido() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.morgan_solicitud_id is null then
  if tg_op='UPDATE' and old.morgan_solicitud_id is not null then raise exception 'COTIZACION_FIJADA';end if;
  return new;
 end if;
 if tg_op='INSERT' and current_setting('morgan.importando',true) is distinct from new.morgan_solicitud_id::text then raise exception 'IMPORTACION_REQUERIDA';end if;
 if tg_op='UPDATE' and old.morgan_solicitud_id is not null and (new.id is distinct from old.id or new.negocio_id is distinct from old.negocio_id or new.cliente_id is distinct from old.cliente_id) then raise exception 'COTIZACION_FIJADA';end if;
 if tg_op='UPDATE' then
  if old.morgan_solicitud_id is not null and (new.morgan_solicitud_id is distinct from old.morgan_solicitud_id or new.morgan_cotizacion is distinct from old.morgan_cotizacion or new.morgan_total_centavos is distinct from old.morgan_total_centavos or new.morgan_tasa is distinct from old.morgan_tasa or new.morgan_total_bs is distinct from old.morgan_total_bs) then raise exception 'COTIZACION_FIJADA';end if;
  if new.morgan_pago_aprobado_at is distinct from old.morgan_pago_aprobado_at and (auth.uid() is null or not exists(select 1 from roles_usuario where id=auth.uid() and negocio_id=new.negocio_id and rol::text='ADMIN') or nullif(btrim(new.morgan_comprobante_ref),'') is null) then raise exception 'PAGO_REQUIERE_ADMIN_COMPROBANTE';end if;
 end if;
 if (new.estado in ('pagado','procesando','entregado')) and new.morgan_pago_aprobado_at is null then raise exception 'PAGO_REQUIERE_ADMIN_COMPROBANTE';end if;
 new.total_usd:=new.morgan_total_centavos/100.0; new.total_bs:=new.morgan_total_bs;return new;
end $$;
commit;
