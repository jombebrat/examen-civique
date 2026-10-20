-- Coq Civique : progression liée à une adresse email, sans mot de passe ni code.
-- Le site n'a aucun accès direct à la table : il passe uniquement par les deux fonctions ci-dessous.

create table if not exists public.learners (
  email      text primary key
             check (char_length(email) between 5 and 254
                    and email = lower(email)
                    and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  newsletter boolean not null default false,
  data       jsonb not null default '{}'::jsonb,
  page       text check (char_length(page) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learners_taille check (pg_column_size(data) < 200000)
);
alter table public.learners enable row level security;
-- Aucune règle d'accès : ni lecture ni écriture directes depuis le site.
revoke all on public.learners from anon, authenticated;

-- Ouvrir (ou créer) la fiche d'une adresse et renvoyer sa progression.
-- L'accord pour les nouvelles n'est jamais retiré ici (seulement ajouté).
create or replace function public.coq_open(p_email text, p_newsletter boolean default false, p_page text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(p_email));
  d jsonb;
begin
  insert into public.learners (email, newsletter, page)
  values (e, coalesce(p_newsletter, false), left(p_page, 200))
  on conflict (email) do update
    set newsletter = public.learners.newsletter or excluded.newsletter
  returning data into d;
  return d;
end;
$$;

-- Enregistrer la progression d'une adresse.
create or replace function public.coq_save(p_email text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(p_email));
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'progression invalide';
  end if;
  insert into public.learners (email, data, updated_at)
  values (e, p_data, now())
  on conflict (email) do update
    set data = excluded.data, updated_at = now();
end;
$$;

revoke all on function public.coq_open(text, boolean, text) from public;
revoke all on function public.coq_save(text, jsonb) from public;
grant execute on function public.coq_open(text, boolean, text) to anon, authenticated;
grant execute on function public.coq_save(text, jsonb) to anon, authenticated;
