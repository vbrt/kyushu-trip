-- Reise-App: Datenbank einrichten (Schritt 1 von 3)
-- In Supabase: SQL Editor > New query > alles einfügen > Run
-- Vorher unten bei "editors" die E-Mail-Adressen aller Mitreisenden eintragen (nicht ins öffentliche Repo committen).

-- Wer darf posten?
create table if not exists public.editors (email text primary key);
insert into public.editors (email) values
  ('EMAIL_PERSON_1')
  -- , ('EMAIL_PERSON_2')   -- weitere Mitreisende so ergänzen
on conflict do nothing;
alter table public.editors enable row level security; -- niemand liest die Liste direkt

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_editor() to anon, authenticated;

-- Beiträge
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null check (author ~ '^[a-z0-9_-]{1,20}$'),
  place text check (char_length(place) <= 80),
  status text check (char_length(status) <= 80),
  body text check (char_length(body) <= 4000),
  media jsonb not null default '[]'::jsonb
);
alter table public.posts enable row level security;
create policy "Alle lesen Beiträge" on public.posts for select using (true);
create policy "Redaktion schreibt" on public.posts for insert to authenticated with check (public.is_editor());
create policy "Redaktion ändert" on public.posts for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "Redaktion löscht" on public.posts for delete to authenticated using (public.is_editor());

-- Reaktionen (ohne Account)
create table if not exists public.reactions (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now()
);
alter table public.reactions enable row level security;
create policy "Alle lesen Reaktionen" on public.reactions for select using (true);
create policy "Alle reagieren" on public.reactions for insert to anon, authenticated with check (true);
create policy "Redaktion löscht Reaktionen" on public.reactions for delete to authenticated using (public.is_editor());

-- Kommentare (ohne Account, nur Name)
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create policy "Alle lesen Kommentare" on public.comments for select using (true);
create policy "Alle kommentieren" on public.comments for insert to anon, authenticated with check (true);
create policy "Redaktion löscht Kommentare" on public.comments for delete to authenticated using (public.is_editor());

-- Fotos & Videos (öffentlich lesbar, nur Redaktion lädt hoch)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;
create policy "Redaktion lädt hoch" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_editor());
create policy "Redaktion löscht Dateien" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_editor());
