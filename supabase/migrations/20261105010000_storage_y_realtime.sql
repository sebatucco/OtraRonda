-- =====================================================================
-- Fotos del menú y logos: bucket público "menu".
-- Cada bar sube solo dentro de su carpeta: menu/<bar_id>/archivo.webp
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu', 'menu', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "menu: lectura publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menu');

create policy "menu: miembros suben a su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'menu' and public.is_bar_member(((storage.foldername(name))[1])::uuid));

create policy "menu: miembros editan su carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'menu' and public.is_bar_member(((storage.foldername(name))[1])::uuid));

create policy "menu: miembros borran su carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'menu' and public.is_bar_member(((storage.foldername(name))[1])::uuid));

-- El panel también escucha cambios de mesas (renombrar, pausar).
alter publication supabase_realtime add table public.tables;
