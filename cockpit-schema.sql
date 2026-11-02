-- Privater Cockpit-Bereich: nur die Redaktion (Tabelle editors) kann lesen und schreiben.
-- In Supabase: SQL Editor > New query > einfügen > Run. Voraussetzung: schema.sql und security.sql sind gelaufen.

create table if not exists public.cockpit_items (
  coll text not null check (coll ~ '^[a-z]{2,20}$'),
  id text not null check (char_length(id) between 1 and 100),
  data jsonb not null check (pg_column_size(data) < 300000),
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);
alter table public.cockpit_items enable row level security;
drop policy if exists "Cockpit lesen" on public.cockpit_items;
drop policy if exists "Cockpit anlegen" on public.cockpit_items;
drop policy if exists "Cockpit ändern" on public.cockpit_items;
drop policy if exists "Cockpit löschen" on public.cockpit_items;
create policy "Cockpit lesen"   on public.cockpit_items for select to authenticated using (public.is_editor());
create policy "Cockpit anlegen" on public.cockpit_items for insert to authenticated with check (public.is_editor());
create policy "Cockpit ändern"  on public.cockpit_items for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "Cockpit löschen" on public.cockpit_items for delete to authenticated using (public.is_editor());
revoke all on public.cockpit_items from anon;

create or replace function public.touch_cockpit() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_touch_cockpit on public.cockpit_items;
create trigger trg_touch_cockpit before insert or update on public.cockpit_items for each row execute function public.touch_cockpit();

-- Privater Dateispeicher für Buchungsbelege (nicht öffentlich)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private', 'private', false, 20971520, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'];
drop policy if exists "Belege lesen" on storage.objects;
drop policy if exists "Belege hochladen" on storage.objects;
drop policy if exists "Belege löschen" on storage.objects;
create policy "Belege lesen"     on storage.objects for select to authenticated using (bucket_id = 'private' and public.is_editor());
create policy "Belege hochladen" on storage.objects for insert to authenticated with check (bucket_id = 'private' and public.is_editor());
create policy "Belege löschen"   on storage.objects for delete to authenticated using (bucket_id = 'private' and public.is_editor());
