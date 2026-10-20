-- Coq Civique : date de l'accord pour les nouvelles (preuve du consentement, RGPD).
alter table public.learners add column if not exists newsletter_at timestamptz;
update public.learners set newsletter_at = created_at where newsletter and newsletter_at is null;

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
  insert into public.learners (email, newsletter, newsletter_at, page)
  values (e, coalesce(p_newsletter, false), case when coalesce(p_newsletter, false) then now() end, left(p_page, 200))
  on conflict (email) do update
    set newsletter = public.learners.newsletter or excluded.newsletter,
        newsletter_at = coalesce(public.learners.newsletter_at, excluded.newsletter_at)
  returning data into d;
  return d;
end;
$$;
