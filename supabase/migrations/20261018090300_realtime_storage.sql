-- Private storage -----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('reports', 'reports', false, 26214400, array['application/pdf', 'text/csv']),
  ('case-attachments', 'case-attachments', false, 26214400,
    array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'text/csv',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members read organization files" on storage.objects;
create policy "members read organization files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('reports', 'case-attachments')
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists "analysts upload organization files" on storage.objects;
create policy "analysts upload organization files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('reports', 'case-attachments')
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin', 'analyst')
  );

drop policy if exists "analysts update organization files" on storage.objects;
create policy "analysts update organization files"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('reports', 'case-attachments')
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() in ('admin', 'analyst')
  )
  with check (
    bucket_id in ('reports', 'case-attachments')
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists "admins delete organization files" on storage.objects;
create policy "admins delete organization files"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('reports', 'case-attachments')
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.current_role() = 'admin'
  );

-- Realtime ------------------------------------------------------------------------
alter table public.transactions replica identity full;
alter table public.alerts replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'alerts'
  ) then
    alter publication supabase_realtime add table public.alerts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
