-- Coq Civique : comptes (progression) et demandes du livret PDF.
-- À exécuter une fois dans le projet Supabase (SQL Editor ou migration).

-- 1. Progression de révision : une ligne par compte, visible uniquement par son propriétaire
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint progress_taille check (pg_column_size(data) < 200000)
);
alter table public.progress enable row level security;

create policy "progress_lire_la_sienne" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "progress_creer_la_sienne" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "progress_modifier_la_sienne" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.progress to authenticated;

-- 2. Demandes du livret PDF : tout visiteur peut en ajouter une, personne ne peut les lire depuis le site
create table if not exists public.pdf_downloads (
  id         bigint generated always as identity primary key,
  email      text not null check (char_length(email) between 5 and 254 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  newsletter boolean not null default false,
  page       text check (char_length(page) <= 200),
  created_at timestamptz not null default now()
);
alter table public.pdf_downloads enable row level security;

create policy "pdf_enregistrer_une_demande" on public.pdf_downloads
  for insert to anon, authenticated with check (true);
-- Aucune politique de lecture : les adresses ne sont visibles que dans le tableau de bord Supabase.

grant insert on public.pdf_downloads to anon, authenticated;

-- 3. Suppression de son propre compte (la progression est supprimée en cascade)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non connecté';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
