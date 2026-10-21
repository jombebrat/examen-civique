# Coq Civique na data.gouv.fr — uputstvo i tekstovi

Cilj: organizacija **Coq Civique** na data.gouv.fr, dva skupa podataka (naši podaci, javno i besplatno) i jedna „réutilisation“ (naša aplikacija).
Tako to rade i konkurenti: leqcmcivique.fr ima organizaciju sa 3 skupa podataka, a qcmexamencivique.fr („Admin civique“) ima skupove „Examen civique NT / CR / CSP“.

Fajlovi su na sajtu i ažuriraju se sami pri svakoj objavi. Na data.gouv.fr ih dodaješ kao **linkove**, ne kao upload:

- https://coqcivique.com/data/opendata/examen-civique-questions.csv
- https://coqcivique.com/data/opendata/examen-civique-questions.json
- https://coqcivique.com/data/opendata/examen-civique-mises-en-situation.csv
- https://coqcivique.com/data/opendata/examen-civique-mises-en-situation.json

Slike su u ovom folderu: `logo-coq-civique.png` (logo organizacije), `capture-application.png` (slika za réutilisation).

## Stanje (21. oktobar 2026, uveče)

- Organizacija: https://www.data.gouv.fr/organizations/coq-civique (logo i sajt u redu)
- Skup podataka 1, objavljen, oba linka proverena (status 200): https://www.data.gouv.fr/datasets/examen-civique-questions-des-trois-listes-officielles-mises-en-correspondance-avec-propositions-de-reponses
  - Sitnica: oznaka „livre-de-citoyen“ treba da glasi „livret-du-citoyen“.
- Skup podataka 2 (mises en situation): nije javno vidljiv.
- Réutilisation: nije javno vidljiva.
- Na sajtu: odeljak „Données ouvertes“ na stranici À propos (#donnees-ouvertes).

## Koraci (oko 20 minuta)

1. **Nalog.** Na https://www.data.gouv.fr klikni „Se connecter“ i napravi nalog (može preko ProConnect ili emailom).
2. **Organizacija.** U meniju naloga izaberi „Créer une organisation“. Popuni polja iz odeljka *Organisation* ispod i dodaj logo.
3. **Skup podataka 1.** U organizaciji klikni „Publier un jeu de données“.
   - Proveri da je vlasnik **Coq Civique**, a ne tvoj lični nalog.
   - Popuni polja iz odeljka *Jeu de données 1*.
   - Kod fajlova izaberi „Lien vers un fichier distant“ (link, ne upload) i dodaj CSV i JSON link za pitanja.
4. **Skup podataka 2.** Isto to, sa tekstovima iz *Jeu de données 2* i dva linka za mises en situation.
5. **Réutilisation.** Klikni „Publier une réutilisation“ (vlasnik: Coq Civique).
   - Popuni polja iz odeljka *Réutilisation* i dodaj sliku `capture-application.png`.
   - Poveži oba naša skupa podataka.
6. **Pošalji mi linkove** stranica koje su nastale. Dodaću ih na sajt (stranica „À propos“), da veza ide u oba smera.

Pravila sajta: ton mora biti neutralan, bez reklamiranja, jer u suprotnom moderatori brišu objavu. Tekstovi ispod su pisani tako.
Ne povezujemo tuđe skupove („Examen civique NT“ i slične), jer ih nismo koristili. Naš izvor su zvanične liste ministarstva.

---

## Organisation

**Nom :** Coq Civique

**Site web :** https://coqcivique.com/

**Description :**

> Coq Civique est un site indépendant et gratuit qui aide à préparer l’examen civique demandé pour la carte de séjour pluriannuelle, la carte de résident et la naturalisation. Il a été créé par Jovan Pavlovic.
>
> Nous publions ici, sous Licence Ouverte 2.0, les données structurées pour ce site : les questions des trois listes officielles du ministère de l’Intérieur mises en correspondance, avec des propositions de réponses, ainsi que des exercices de mises en situation.
>
> Coq Civique n’est pas un site officiel et n’a pas de lien avec le ministère de l’Intérieur.

---

## Jeu de données 1

**Titre :** Examen civique : questions des trois listes officielles mises en correspondance, avec propositions de réponses

**Acronyme :** (prazno)

**Description :**

> Ce jeu de données rassemble les questions de connaissance des trois listes officielles de l’examen civique publiées par le ministère de l’Intérieur :
>
> - naturalisation (259 questions, liste du 12 décembre 2025) ;
> - carte de résident (209 questions) ;
> - carte de séjour pluriannuelle (191 questions).
>
> Les listes « carte de résident » et « carte de séjour pluriannuelle » ont été relevées sur formation-civique.interieur.gouv.fr le 21 octobre 2026.
>
> **Ce qu’apporte ce jeu de données.** Beaucoup de questions figurent dans plusieurs listes, parfois avec une formulation différente. Chaque question n’apparaît ici qu’une fois (466 questions distinctes). Elle porte son numéro dans chacune des listes où elle figure, et ses autres formulations officielles. On peut ainsi savoir, par exemple, quelles questions de la liste « carte de séjour pluriannuelle » se retrouvent dans la liste « naturalisation ».
>
> **Contenu de chaque ligne :**
>
> - identifiant, thème (1 à 5) et intitulé du thème ;
> - question ;
> - proposition de réponse, et bonne réponse sous forme de QCM avec trois propositions incorrectes ;
> - courte explication et pages correspondantes du Livret du citoyen (édition mai 2026) ;
> - numéros dans les listes naturalisation, carte de résident et carte de séjour pluriannuelle, et formulations propres à ces deux dernières listes ;
> - adresse de la fiche de la question sur coqcivique.com.
>
> Dans le CSV, les valeurs multiples sont séparées par « | ». Le JSON contient les mêmes données sous forme de listes.
>
> **Avertissement.** Les questions proviennent des listes officielles. Les réponses, explications et propositions incorrectes sont rédigées par Coq Civique, notamment d’après le Livret du citoyen. Elles ne sont pas officielles. En cas de doute, le Livret du citoyen et les sites officiels font foi.
>
> **Mise à jour.** Les fichiers sont mis à jour à chaque modification des listes officielles ou correction d’une réponse. Une erreur ? Écrivez-nous depuis le site.

**Mots-clés :** examen-civique, naturalisation, titre-de-sejour, carte-de-resident, carte-de-sejour-pluriannuelle, citoyennete, integration, qcm, livret-du-citoyen

**Licence :** Licence Ouverte / Open Licence version 2.0

**Fréquence de mise à jour :** Irrégulière

**Couverture temporelle :** 2026 · **Couverture spatiale :** France

**Ressources (lien vers un fichier distant) :**

| Titre de la ressource | URL | Format |
|---|---|---|
| Questions de l’examen civique (3 listes) — CSV | https://coqcivique.com/data/opendata/examen-civique-questions.csv | csv |
| Questions de l’examen civique (3 listes) — JSON | https://coqcivique.com/data/opendata/examen-civique-questions.json | json |

---

## Jeu de données 2

**Titre :** Examen civique : 119 mises en situation d’entraînement corrigées

**Description :**

> L’examen civique comprend 12 « mises en situation » : des situations de la vie quotidienne où il faut choisir le comportement conforme aux principes de la République. Le ministère de l’Intérieur ne publie pas ces questions.
>
> Ce jeu de données propose 119 exercices d’entraînement rédigés par Coq Civique sur les mêmes principes : laïcité, égalité entre les femmes et les hommes, respect de la loi, droits et devoirs. Ils sont répartis sur les cinq thèmes de l’examen.
>
> **Contenu de chaque ligne :**
>
> - identifiant, thème et principe concerné ;
> - situation et question ;
> - bonne réponse et trois propositions incorrectes ;
> - explication ;
> - adresse de l’exercice sur coqcivique.com.
>
> **Avertissement.** Ces exercices ne sont pas les questions officielles de l’examen. Ce sont des exemples rédigés pour s’entraîner.

**Mots-clés :** examen-civique, mises-en-situation, naturalisation, titre-de-sejour, laicite, citoyennete, integration, qcm

**Licence :** Licence Ouverte / Open Licence version 2.0 · **Fréquence :** Irrégulière · **Couverture :** France, 2026

**Ressources (lien vers un fichier distant) :**

| Titre de la ressource | URL | Format |
|---|---|---|
| Mises en situation — CSV | https://coqcivique.com/data/opendata/examen-civique-mises-en-situation.csv | csv |
| Mises en situation — JSON | https://coqcivique.com/data/opendata/examen-civique-mises-en-situation.json | json |

---

## Réutilisation

**Titre :** Apprendre l’examen civique par leçons courtes, QCM, examens blancs et sujets PDF de 40 questions

**URL :** https://coqcivique.com/reviser/

**Type :** Application

**Thématique :** (izaberi najbližu, npr. „Société“ ili „Citoyenneté“, ako postoji)

**Description :**

> Application web gratuite, sans inscription, pour préparer l’examen civique : carte de séjour pluriannuelle, carte de résident et naturalisation.
>
> **Comment les données sont utilisées.** Chaque liste officielle est découpée en leçons d’environ huit questions, thème par thème, dans l’ordre officiel. On lit d’abord les réponses, puis un court quiz vérifie qu’elles sont retenues. Les erreurs reviennent jusqu’à ce qu’elles soient sues.
>
> Les mêmes données servent à :
>
> - des examens blancs au format de l’examen (28 questions de la liste choisie et 12 mises en situation, 45 minutes, seuil de 32 sur 40) ;
> - un générateur de sujets de 40 questions en PDF, avec corrigé ;
> - des livrets PDF à imprimer.
>
> Une aide en anglais et en arabe est disponible pour chaque question.
>
> **Auteur.** Jovan Pavlovic. Coq Civique est un site indépendant, non officiel.

**Jeux de données associés :** les deux jeux de données Coq Civique ci-dessus.

**Image :** `capture-application.png`

**Mots-clés :** examen-civique, application, qcm, naturalisation, titre-de-sejour, apprentissage
