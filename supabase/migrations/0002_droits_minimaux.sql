-- Coq Civique : ne laisser au site que les droits strictement nécessaires.
-- Déjà appliquée au projet Supabase « coq-civique » (migration droits_minimaux).

-- Livret PDF : ajouter une demande, rien d'autre (ni lecture, ni modification, ni suppression).
revoke all on public.pdf_downloads from anon, authenticated;
grant insert on public.pdf_downloads to anon, authenticated;

-- Progression : réservée aux comptes connectés, chacun limité à sa ligne par les règles RLS.
revoke all on public.progress from anon, authenticated;
grant select, insert, update on public.progress to authenticated;
