-- ============================================================================
-- 0004_storage.sql
-- Bucket público de imágenes de productos + políticas de subida.
-- ============================================================================

-- Bucket público (lectura anónima de las imágenes vía publicUrl)
insert into storage.buckets (id, name, public)
values ('productos-img', 'productos-img', true)
on conflict (id) do nothing;

-- Subida / actualización / borrado: solo usuarios autenticados
drop policy if exists productos_img_insert on storage.objects;
create policy productos_img_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos-img');

drop policy if exists productos_img_update on storage.objects;
create policy productos_img_update on storage.objects
  for update to authenticated
  using (bucket_id = 'productos-img');

drop policy if exists productos_img_delete on storage.objects;
create policy productos_img_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos-img');

-- Lectura pública
drop policy if exists productos_img_select on storage.objects;
create policy productos_img_select on storage.objects
  for select to public
  using (bucket_id = 'productos-img');
