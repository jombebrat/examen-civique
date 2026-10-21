// Génère le site statique dans dist/ à partir de data/*.json, content/ et site.config.json.
// Usage : node scripts/build.mjs [--base-url https://exemple.com]
import { mkdirSync, writeFileSync, rmSync, cpSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { ROOT, loadJSON, esc, typo, plain, detailHtml, questionSlugs } from "./lib.mjs";

const data = loadJSON("data/questions.json");
const listes = loadJSON("data/listes.json");
const situations = loadJSON("data/situations.json").situations;
const EN = existsSync(join(ROOT, "data/en.json")) ? loadJSON("data/en.json") : { q: {}, s: {} };
const ALTS = [["fr", "/"], ["en", "/en/"], ["ar", "/ar/"], ["x-default", "/"]];
const config = loadJSON("site.config.json");
const argUrl = (() => { const i = process.argv.indexOf("--base-url"); return i > 0 ? process.argv[i + 1] : ""; })();
// Toujours https en ligne (GitHub Pages peut annoncer http:// tant que le certificat n'est pas prêt).
const SITE_URL = (argUrl || process.env.SITE_URL || config.url).replace(/\/+$/, "")
  .replace(/^http:\/\/(?!localhost|127\.0\.0\.1)/, "https://");
const BASE = new URL(SITE_URL + "/");
const PREFIX = BASE.pathname.replace(/\/$/, "");
const href = (p) => PREFIX + p;
const abs = (p) => BASE.origin + PREFIX + p;
const DIST = join(ROOT, "dist");
const NAME = config.nom;
const TODAY = new Date().toISOString().slice(0, 10);
const UPDATED = data.source.mise_a_jour || TODAY;
const dateFr = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const themes = data.themes;
const questions = data.questions;
const slugs = questionSlugs(questions);
const themeById = Object.fromEntries(themes.map((t) => [t.id, t]));
const qById = new Map(questions.map((q) => [q.id, q]));
const qPath = (q) => `/questions/${themeById[q.theme].slug}/${slugs.get(q.id)}/`;
const tPath = (t) => `/questions/${t.slug}/`;
const isNat = (q) => /^[1-5]-\d+$/.test(q.id);
const natQ = questions.filter(isNat);
const byTheme = (id) => natQ.filter((q) => q.theme === id);
const TOTAL = natQ.length;

/* Les trois listes officielles : naturalisation (questions.json) + CSP et CR (listes.json) */
const LISTS = [
  { code: "nat", nom: "Naturalisation", court: "Naturalisation", path: "/questions/", count: TOTAL, sous: "Demande de nationalité française" },
  { code: "cr", nom: listes.cr.nom, court: listes.cr.court, path: `/${listes.cr.slug}/`, count: listes.cr.questions.length, sous: "Première demande de carte de résident" },
  { code: "csp", nom: listes.csp.nom, court: listes.csp.court, path: `/${listes.csp.slug}/`, count: listes.csp.questions.length, sous: "Première demande de carte pluriannuelle" },
];
const LIST = Object.fromEntries(LISTS.map((l) => [l.code, l]));
// Pour chaque question : listes où elle figure, avec thème, numéro et formulation officielle si différente
const member = new Map(questions.map((q) => [q.id, []]));
for (const q of natQ) member.get(q.id).push({ code: "nat", theme: q.theme, numero: q.numero });
for (const code of ["cr", "csp"]) for (const e of listes[code].questions) member.get(e.id).push({ code, theme: e.theme, numero: e.numero, texte: e.texte });

// Leçons de l'application : même découpage que src/app/app.html (thème par thème, ~8 questions, ordre officiel)
const LESSON_SIZE = 8;
const chunkSizes = (n) => { if (!n) return []; const k = Math.ceil(n / LESSON_SIZE), base = Math.floor(n / k), extra = n % k; return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)); };
const LESSON_OF = Object.fromEntries(LISTS.map((l) => {
  const first = new Map();
  for (const q of questions) { const m = member.get(q.id).find((x) => x.code === l.code); if (m) first.set(q.id, m); }
  const map = new Map();
  for (const t of themes) {
    const ids = [...first.entries()].filter(([, m]) => m.theme === t.id).sort((a, b) => a[1].numero - b[1].numero).map(([id]) => id);
    let at = 0;
    chunkSizes(ids.length).forEach((sz, i) => { ids.slice(at, at + sz).forEach((id) => map.set(id, { t: t.id, i: i + 1, n: sz })); at += sz; });
  }
  return [l.code, map];
}));

const sitemap = [];
// Version des fichiers statiques : change dès que site.css ou coq.js change (évite l'ancien style en cache)
const V = (() => { const h = createHash("sha256"); for (const f of ["src/site/site.css", "src/site/coq.js", "src/site/pwa.js", "src/site/sw.js", "src/site/examen40.js", "src/app/app.html", "data/questions.json", "data/listes.json", "data/situations.json", "data/en.json", "data/ar.json"]) h.update(readFileSync(join(ROOT, f))); return h.digest("hex").slice(0, 10); })();
// Application installable (PWA) : manifeste, service worker, invitation à installer
const pwaHead = () => `<link rel="manifest" href="${href("/manifest.webmanifest")}">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${esc(NAME)}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">`;
const pwaScripts = () => `<script>window.COQ_PWA=${JSON.stringify({ sw: href("/sw.js"), scope: href("/"), icon: href("/assets/icon-192.png"), guide: href("/installer-application/"), app: href("/reviser/") })};</script>
<script src="${href("/assets/pwa.js")}?v=${V}" defer></script>`;
const SB = config.supabase || {};
// Adresse email + progression en ligne + livret PDF : actifs si l'adresse et la clé publique Supabase sont renseignées.
const SB_ON = Boolean(SB.url && SB.cle_publique && SB.actif !== false);
const PDF_PATH = "/assets/coq-civique-examen-civique.pdf";
// Livrets PDF par liste (produits par tools/pdf/render_pdf.py, inventaire dans assets/livrets.json)
const LIVRETS_INV = existsSync(join(ROOT, "assets/livrets.json")) ? JSON.parse(readFileSync(join(ROOT, "assets/livrets.json"), "utf8")) : {};
const COVERS = { nat: "/assets/livret-couverture.png", cr: "/assets/livret-couverture-cr.png", csp: "/assets/livret-couverture-csp.png" };
const LIVRETS = ["nat", "cr", "csp"].filter((c) => LIVRETS_INV[c]).map((c) => ({ code: c, url: `/assets/${LIVRETS_INV[c].fichier}`, pages: LIVRETS_INV[c].pages, questions: LIVRETS_INV[c].questions, cover: COVERS[c] }));
const LIVRET = Object.fromEntries(LIVRETS.map((l) => [l.code, l]));
const sbScripts = () => SB_ON ? `<script>window.COQ=${JSON.stringify({ sbUrl: SB.url, sbKey: SB.cle_publique, pdfUrl: href(PDF_PATH), pdfs: LIVRETS.map((l) => ({ code: l.code, nom: { nat: "Naturalisation", cr: "Carte de résident", csp: "Carte de séjour pluriannuelle" }[l.code], url: href(l.url), pages: l.pages })), logo: href("/assets/icon-192.png"), mascot: href("/assets/mascotte-fin.jpg"), reviser: href("/reviser/"), privacyUrl: href("/mentions-legales/#donnees") }).replace(/</g, "\\u003c")};</script>
<script src="${href("/assets/coq.js")}?v=${V}" defer></script>` : "";

// Empreinte du contenu de chaque page (titre, description, <main>) : sert aux dates du sitemap et à IndexNow
const PAGE_HASH = new Map();
function write(path, html) {
  const file = join(DIST, path.endsWith("/") ? path + "index.html" : path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  const main = html.match(/<main[\s\S]*?<\/main>/);
  const head = (html.match(/<title>[\s\S]*?<\/title>/) || [""])[0] + (html.match(/<meta name="description"[^>]*>/) || [""])[0];
  if (main) PAGE_HASH.set(path, createHash("sha256").update(head + main[0]).digest("hex").slice(0, 16));
}
function clip(s, n = 155) {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}
const breadcrumbLd = (items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
});
const crumbs = (items) => `<nav class="crumbs" aria-label="Fil d’Ariane"><ol>${items.map(([name, path], i) =>
  i === items.length - 1 ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${href(path)}">${esc(name)}</a></li>`).join("")}</ol></nav>`;
const reportLink = (what, path) => `mailto:${esc(config.editeur.contact)}?subject=${encodeURIComponent(`Erreur signalée : ${what}`)}&body=${encodeURIComponent(`Page : ${abs(path)}\n\nCe qui me semble faux :\n`)}`;
const mascotImg = (cls = "") => `<img class="${cls}" src="${href("/assets/mascotte-fin.jpg")}" width="480" height="480" alt="" loading="lazy">`;

function layout({ title, description, path, body, jsonld = [], canonical = path, theme = null, index = true, ogType = "website", wide = false, lang = "fr", alternates = [] }) {
  if (index && canonical === path && !path.endsWith(".html")) sitemap.push(path);
  const color = theme ? ` style="--c:var(--t${theme})"` : "";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(canonical)}">
${index ? "" : '<meta name="robots" content="noindex">\n'}<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="${{ en: "en_GB", ar: "ar_AR" }[lang] || "fr_FR"}">
${alternates.map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${abs(p)}">`).join("\n")}
<meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(canonical)}">
<meta name="theme-color" content="#1F4E9C">
<link rel="icon" href="${href("/favicon.ico")}" sizes="48x48">
<link rel="icon" type="image/png" sizes="96x96" href="${href("/assets/icon-96.png")}">
<link rel="icon" type="image/png" sizes="192x192" href="${href("/assets/icon-192.png")}">
<link rel="apple-touch-icon" href="${href("/assets/icon-180.png")}">
${pwaHead()}
<meta property="og:image" content="${abs("/assets/og-image.png")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="${href("/assets/fonts/atkinson-400.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${href("/assets/fonts/fraunces-800.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${href("/assets/site.css")}?v=${V}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body${color}${wide ? ' class="home"' : ""}>
<a class="skip" href="#contenu">Aller au contenu</a>
<div class="flag" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="site-head"><div class="wrap wide top">
  <a class="brand" href="${href("/")}"><img src="${href("/assets/icon-64.png")}" width="32" height="32" alt="">${esc(NAME)}</a>
  <nav class="nav" aria-label="Navigation principale">
    <a class="hide-sm" href="${href("/questions/")}">Questions</a>
    <a class="hide-sm" href="${href("/guide/")}">Guides</a>
    <a class="btn small" href="${href("/examen-civique-pdf/")}">PDF</a>
    <a class="btn primary small" href="${href("/reviser/")}">Apprendre</a>
  </nav>
</div></header>
<main id="contenu" class="wrap${wide ? " wide" : ""}">
${body}
</main>
<footer class="site-foot"><div class="wrap wide">
  <div class="fcols">
    <div class="fbrand"><a class="brand" href="${href("/")}"><img src="${href("/assets/icon-64.png")}" width="32" height="32" alt="">${esc(NAME)}</a>
      <p>L’appli gratuite pour apprendre l’examen civique pas à pas, créée par Jovan pour se préparer en 7 jours, avec ses proches.</p></div>
    <div><h3>Listes officielles</h3>
      <a href="${href("/questions/")}">Naturalisation</a>
      <a href="${href(LIST.cr.path)}">Carte de résident</a>
      <a href="${href(LIST.csp.path)}">Carte de séjour pluriannuelle</a></div>
    <div><h3>Apprendre</h3>
      <a href="${href("/reviser/")}">Apprendre (leçons et quiz)</a>
      <a href="${href("/examen-blanc/")}">Examen blanc</a>
      <a href="${href("/mises-en-situation/")}">Mises en situation</a>
      <a href="${href("/preparer-examen-civique-en-7-jours/")}">Plan en 7 jours</a>
      <a href="${href("/examen-civique-pdf/")}">Livrets PDF</a>
      <a href="${href(EX40_PATH)}">Sujets PDF de 40 questions</a>
      <a href="${href("/installer-application/")}">Application</a></div>
    <div><h3>Comprendre</h3>
      <a href="${href("/guide/deroulement-examen-civique/")}">Déroulement de l’examen</a>
      <a href="${href("/guide/qui-doit-passer-examen-civique/")}">Qui doit le passer</a>
      <a href="${href("/guide/inscription-examen-civique/")}">Inscription et centres</a>
      <a href="${href("/guide/prix-examen-civique/")}">Prix de l’examen</a>
      <a href="${href("/guide/resultat-examen-civique/")}">Résultat et attestation</a>
      <a href="${href("/livret-du-citoyen/")}">Livret du citoyen</a>
      <a href="${href("/guide/entretien-naturalisation/")}">Entretien de naturalisation</a>
      <a href="${href("/guide/")}">Tous les guides</a></div>
    <div><h3>Le site</h3>
      <a href="${href("/a-propos/")}">À propos</a>
      <a href="${href("/mises-a-jour/")}">Mises à jour</a>
      <a href="${href("/conditions-utilisation/")}">Conditions d’utilisation</a>
      <a href="${href("/mentions-legales/")}">Mentions légales et confidentialité</a>
      <a href="mailto:${esc(config.editeur.contact)}">Contact</a>
      <a href="${href("/en/")}" hreflang="en" lang="en">English</a>
      <a href="${href("/ar/")}" hreflang="ar" lang="ar" dir="rtl">العربية</a></div>
  </div>
  <p class="fnote">${esc(NAME)} est un site indépendant et non officiel, sans lien avec le ministère de l’Intérieur. Questions : listes officielles des questions de connaissance (naturalisation, carte de résident, carte de séjour pluriannuelle). Réponses rédigées par ${esc(NAME)}, notamment d’après le Livret du citoyen (édition mai 2026).</p>
</div></footer>
${sbScripts()}
${pwaScripts()}
</body>
</html>
`;
}

const LIST_COLOR = { nat: "var(--t1)", cr: "var(--red)", csp: "var(--t2)" };
const listCards = (current = "") => `<div class="lists">${LISTS.map((l) => `<a class="list-card${l.code === current ? " on" : ""}" href="${href(l.path)}" style="--lc:${LIST_COLOR[l.code]}"><span class="lk">Liste officielle</span><b>${esc(l.nom)}</b><span class="num">${l.count}<small> questions</small></span><small>${esc(l.sous)}</small><span class="go">${l.code === current ? "Vous êtes ici" : "Voir les questions →"}</span></a>`).join("")}</div>`;

/* ---------- Accueil ---------- */
function home() {
  const rows = themes.map((t) => {
    const qs = byTheme(t.id);
    const ex = qs.slice(0, 2).map((q) => typo(q.question)).join(" · ");
    return `<a class="theme-row" href="${href(tPath(t))}" style="--c:var(--t${t.id})"><span class="num">0${t.id}</span>
      <span><span class="tt">${typo(t.titre)}</span><span class="ex">${ex}</span></span><span class="ct">${qs.length}\u00a0questions</span></a>`;
  }).join("\n");
  const faq = [
    ["Comment se passe l’examen civique ?", "C’est un QCM de 40 questions, à faire en 45 minutes au maximum sur tablette ou ordinateur, dans un centre agréé. Il comprend 28 questions de connaissance, tirées de la liste officielle de votre démarche, et 12 mises en situation. Chaque question propose 4 réponses, dont une seule est juste."],
    ["Quel score faut-il pour réussir ?", "Il faut au moins 32 bonnes réponses sur 40, soit 80 %. Une absence de réponse compte comme une erreur : répondez à toutes les questions."],
    ["Quelle liste de questions dois-je réviser ?", `Celle de votre démarche : naturalisation (${LIST.nat.count} questions), carte de résident (${LIST.cr.count} questions) ou carte de séjour pluriannuelle (${LIST.csp.count} questions). Beaucoup de questions sont communes aux trois listes. Sur la page « Réviser », choisissez votre liste : les cartes, les quiz et les examens blancs s’adaptent.`],
    ["D’où viennent les questions et les réponses ?", "Les questions sont celles des listes officielles publiées par le ministère de l’Intérieur. Les réponses sont rédigées par Coq Civique, notamment d’après le Livret du citoyen (édition mai 2026) et les textes officiels ; chaque page indique sa source et permet de signaler une erreur."],
    ["Est-ce vraiment gratuit ?", "Oui : leçons, QCM, examens blancs, livrets PDF et sujets de 40 questions sont gratuits, sans inscription et sans publicité. Le ministère de l’Intérieur rappelle d’ailleurs que la préparation à l’examen civique peut se faire gratuitement, et que les sites qui font payer l’accès à des contenus ne sont pas gérés par le ministère."],
    ["Ce site est-il officiel ?", "Non. C’est un site indépendant et gratuit de révision, sans lien avec le ministère de l’Intérieur. L’inscription à l’examen se fait auprès d’un centre agréé."],
    ["Comment fonctionne l’apprentissage ?", "Comme une application de langue : chaque thème est découpé en leçons de 5 minutes. Vous lisez d’abord les réponses, puis un petit quiz vérifie que vous les avez retenues ; les erreurs reviennent jusqu’à ce qu’elles soient sues. Un objectif du jour et votre série de jours vous aident à garder le rythme."],
    ["Faut-il créer un compte ?", "Non. Vous pouvez commencer à apprendre tout de suite. Pour ne rien perdre et retrouver votre progression sur votre téléphone comme sur votre ordinateur, indiquez simplement votre adresse email, sans mot de passe : ce que vous avez déjà appris est conservé. La même adresse donne accès au livret PDF."],
  ];
  const days = [["Principes et valeurs de la République", "/reviser/?theme=1"], ["Système institutionnel et politique", "/reviser/?theme=2"], ["Droits et devoirs", "/reviser/?theme=3"], ["Histoire, géographie et culture", "/reviser/?theme=4"], ["Vivre dans la société française", "/reviser/?theme=5"], ["Examens blancs et questions manquées", "/reviser/"], ["Dernier examen blanc et mises en situation", "/guide/mises-en-situation-examen-civique/"]];
  const CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const body = `
<section class="band band-hero">
  <div class="hero hero-m">
    <div class="hero-text">
      <div class="eyebrow">Examen civique 2026 · listes officielles</div>
      <h1>${typo("Apprenez l’examen civique, 5 minutes par jour")}</h1>
      <p class="lead">${typo("L’appli 100 % gratuite et sans inscription pour apprendre les questions officielles pas à pas : des leçons courtes, un quiz après chaque leçon et des examens blancs. Pour la naturalisation, la carte de résident et la carte de séjour pluriannuelle.")}</p>
      <div class="ctas"><a class="btn primary big" href="${href("/reviser/")}">Commencer à apprendre</a><a class="btn big" href="${href("/preparer-examen-civique-en-7-jours/")}">Mon plan en 7 jours</a></div>
      <ul class="trust"><li>${CHECK}100 % gratuit</li><li>${CHECK}Sans inscription</li><li>${CHECK}Leçons de 5 minutes</li><li>${CHECK}Listes officielles 2026</li></ul>
      <p class="proof" data-chiffres hidden></p>
    </div>
    <div class="mascot"><video muted playsinline preload="auto" width="480" height="480" poster="${href("/assets/mascotte-debut.jpg")}" aria-hidden="true"><source src="${href("/assets/mascotte.mp4")}" type="video/mp4"><source src="${href("/assets/mascotte.webm")}" type="video/webm"></video></div>
  </div>
  <script>(function(){var v=document.querySelector(".mascot video");if(!v)return;var end=${JSON.stringify(href("/assets/mascotte-fin.jpg"))};function still(){v.removeAttribute("src");v.poster=end;v.querySelectorAll("source").forEach(function(s){s.remove()});v.load();}if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches){still();return;}var p=v.play();if(p&&p.catch)p.catch(still);})();</script>
  <div class="facts">
    <div class="fact"><b>40</b><span>questions à l’examen</span></div>
    <div class="fact"><b>45 min</b><span>durée maximale</span></div>
    <div class="fact"><b>32/40</b><span>pour réussir (80 %)</span></div>
    <div class="fact"><b>3</b><span>listes officielles</span></div>
  </div>
</section>

<section class="band alt" id="listes">
  <div class="shead"><div class="eyebrow">Votre démarche</div><h2>Choisissez votre liste</h2>
  <p>Les 28 questions de connaissance de l’examen sont tirées de la liste officielle de votre démarche. Beaucoup de questions sont communes aux trois listes.</p></div>
  ${listCards()}
</section>

<section class="band">
  <div class="story">
    ${mascotImg("story-img")}
    <div>
      <div class="eyebrow">Notre histoire</div>
      <h2>Pourquoi j’ai créé Coq Civique</h2>
      <p>Je m’appelle Jovan. Comme vous, je dois passer l’examen civique. Quand j’ai ouvert la liste officielle, j’ai trouvé des centaines de questions… et aucune réponse. Je voulais être prêt en 7 jours, et aider mes proches qui devaient le passer eux aussi.</p>
      <p>Alors j’ai rédigé une réponse claire pour chaque question, puis j’ai construit l’outil dont nous avions besoin. Le voici, gratuit, pour vous aussi.</p>
      <p class="sign">— Jovan, créateur de ${esc(NAME)}</p>
      <a class="btn" href="${href("/a-propos/")}">Lire l’histoire</a>
    </div>
  </div>
  <div class="temoignages" data-temoignages hidden><h3>Ils ont réussi leur examen</h3><div class="tlist"></div>
  <p class="tnote">Témoignages publiés avec l’accord de leurs auteurs, après vérification.</p></div>
</section>

<section class="band alt">
  <div class="shead"><div class="eyebrow">La méthode</div><h2>Prêt en 7 jours</h2>
  <p>Un thème par jour pendant cinq jours, puis deux jours en conditions réelles. Comptez 45 minutes à une heure par jour.</p></div>
  <ol class="plan7">${days.map(([t, u], i) => `<li><a href="${href(u)}"><span class="d">Jour ${i + 1}</span><span class="t">${typo(t)}</span></a></li>`).join("")}</ol>
  <p class="more"><a class="btn primary" href="${href("/preparer-examen-civique-en-7-jours/")}">Voir le plan jour par jour</a></p>
</section>

<section class="band">
  <div class="shead"><div class="eyebrow">Le programme</div><h2>Les 5 thèmes de l’examen</h2>
  <p>Les trois listes suivent les mêmes thèmes. Exemples tirés de la liste « naturalisation ».</p></div>
  <div class="themes">${rows}</div>
</section>

<section class="band alt">
  <div class="shead"><div class="eyebrow">La méthode</div><h2>On apprend, puis on vérifie</h2>
  <p>${typo("Comme pour apprendre une langue : un parcours de leçons courtes, et les questions que vous ne savez pas encore reviennent plus souvent.")}</p></div>
  <div class="modes">
    <div><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2"/><path d="M8 8h6M8 11h4"/></svg></span><h3>1. Des leçons de 5 minutes</h3><p>${typo("Chaque thème est découpé en petites leçons d’environ 8 questions. Vous lisez les réponses, avec une explication simple.")}</p></div>
    <div><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="5" cy="18" r="1.6"/><path d="M10 6h10M10 12h10M10 18h10"/></svg></span><h3>2. Un quiz pour retenir</h3><p>${typo("Après chaque leçon, un QCM comme le jour de l’examen. Une erreur ? La question revient à la fin, puis dans vos révisions.")}</p></div>
    <div><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg></span><h3>3. L’examen blanc</h3><p>Au format officiel : 28 questions de votre liste et 12 mises en situation, en 45 minutes. Votre score et les questions à retravailler. <a href="${href("/examen-blanc/")}">En savoir plus</a></p></div>
    <div><span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v10H9l-5 4z"/><path d="M9 9h6M9 12h4"/></svg></span><h3>4. Les mises en situation</h3><p>${situations.length} cas de la vie quotidienne pour s’entraîner aux 12 questions non publiées de l’examen. <a href="${href("/mises-en-situation/")}">Voir les exemples</a></p></div>
  </div>
  <p class="more"><a class="btn primary" href="${href("/reviser/")}">Commencer à apprendre</a></p>
</section>

<section class="band" id="pdf">
  <div class="shead"><div class="eyebrow">À imprimer</div><h2>Les livrets de révision en PDF</h2>
  <p>${typo("Toutes les questions de votre liste et leurs réponses, au format A4 : l’essentiel de chaque thème, une colonne réponse à cacher pour s’interroger, et une fiche mémo pour la veille de l’examen. Gratuit, sans inscription.")}</p></div>
  <div class="livrets">${LIVRETS.map((l) => `<div class="livret"><img src="${href(l.cover)}" alt="Couverture du livret ${esc(LIST[l.code].nom)}" width="331" height="468" loading="lazy"><div><b>${esc(LIST[l.code].nom)}</b><span>${l.questions} questions · ${l.pages} pages</span><a class="btn primary" href="${href(l.url)}" data-pdf-link download>Télécharger le PDF</a></div></div>`).join("")}</div>
  <p class="more"><a href="${href(EX40_PATH)}">${typo("Un sujet de 40 questions comme à l’examen, en PDF ›")}</a> · <a href="${href("/examen-civique-pdf/")}">${typo("Le contenu des livrets et les documents officiels ›")}</a></p>
</section>

<section class="band alt" id="guides">
  <div class="shead"><div class="eyebrow">Guides</div><h2>Tout savoir sur l’examen civique</h2>
  <p>Les réponses aux questions pratiques, vérifiées sur les sites officiels.</p></div>
  <ul class="guides">${[
    ["/guide/deroulement-examen-civique/", "Comment se passe l’examen", "Format, durée, score à obtenir et attestation."],
    ["/guide/qui-doit-passer-examen-civique/", "Qui doit le passer ?", "Carte de séjour pluriannuelle, carte de résident, naturalisation et dispenses."],
    ["/guide/inscription-examen-civique/", "Où passer l’examen ?", "Les centres agréés et les étapes de l’inscription."],
    ["/guide/prix-examen-civique/", "Combien coûte l’examen ?", "Pas de tarif national : des exemples réels de prix."],
    ["/guide/resultat-examen-civique/", "Le résultat en combien de jours ?", "Délai, attestation de réussite et que faire en cas d’échec."],
    ["/guide/niveau-de-francais-titre-de-sejour-naturalisation/", "Niveau de français exigé", "A2, B1 ou B2 selon votre démarche, et comment le prouver."],
    ["/livret-du-citoyen/", "Le Livret du citoyen", "Le sommaire du livret officiel et les questions de l’examen par chapitre."],
    ["/guide/entretien-naturalisation/", "L’entretien de naturalisation", "Comment se passe l’entretien en préfecture et comment s’y préparer."],
  ].map(([u, t, d]) => `<li><a href="${href(u)}"><b>${typo(t)}</b><span>${typo(d)}</span></a></li>`).join("")}</ul>
  <p class="more"><a class="btn" href="${href("/guide/")}">Tous les guides</a></p>
</section>

<section class="band faq">
  <div class="shead"><div class="eyebrow">FAQ</div><h2>Questions fréquentes</h2></div>
  <div class="faq-list">
${faq.map(([q, a]) => `<details><summary>${typo(q)}</summary><p>${typo(a)}</p></details>`).join("\n")}
  </div>
</section>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: NAME, alternateName: ["CoqCivique", "coqcivique.com"], url: abs("/"), inLanguage: "fr" },
    { "@context": "https://schema.org", "@type": "Organization", name: NAME, url: abs("/"), logo: abs("/assets/icon-512.png"), founder: { "@type": "Person", name: "Jovan Pavlovic" } },
  ];
  write("/", layout({
    title: `Examen civique 2026 : test gratuit et QCM pour apprendre les questions officielles | ${NAME}`,
    description: `Test civique gratuit et sans inscription pour apprendre l’examen civique pas à pas : leçons de 5 minutes sur les questions officielles, QCM, examens blancs et PDF.`,
    path: "/", body, jsonld: ld, wide: true, alternates: ALTS,
  }));
}

/* ---------- Liste naturalisation (index) ---------- */
function questionsIndex() {
  const toc = themes.map((t) => `<a href="#theme-${t.id}" style="--c:var(--t${t.id})"><span>0${t.id}</span> ${typo(t.titre_court)}</a>`).join("");
  const sections = themes.map((t) => `
<section class="block" id="theme-${t.id}" style="--c:var(--t${t.id})">
  <h2><a href="${href(tPath(t))}" style="color:inherit;text-decoration:none">${typo(t.titre)}</a></h2>
  <ol class="qlist">${byTheme(t.id).map((q) => `<li><span class="n">${q.numero}</span><span><a href="${href(qPath(q))}">${typo(q.question)}</a></span></li>`).join("")}</ol>
</section>`).join("");
  const items = [["Accueil", "/"], ["Naturalisation", "/questions/"]];
  write("/questions/", layout({
    title: `Examen civique naturalisation : les ${TOTAL} questions et réponses (QCM gratuit) | ${NAME}`,
    description: `La liste officielle des ${TOTAL} questions de connaissance de l’examen civique pour la naturalisation, classées par thème, avec leurs réponses et un QCM gratuit.`,
    path: "/questions/", jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<h1 style="font-size:clamp(28px,6vw,40px)">${typo(`Examen civique naturalisation : les ${TOTAL} questions`)}</h1>
<p class="lead">La liste officielle des questions de connaissance pour la naturalisation (publiée le 12 décembre 2025), dans l’ordre de la liste, avec un lien vers chaque réponse.</p>
<div class="cta"><p>Révisez cette liste avec des cartes, un QCM et des examens blancs de 40 questions.</p><a class="btn primary" href="${href("/reviser/?liste=nat")}">QCM naturalisation</a></div>
<h2 class="sr-title">Autres listes</h2>${listCards("nat")}
${LIVRET.nat ? `<div class="cta" style="background:var(--surface);border:1px solid var(--line)"><p>${typo(`Toute la liste « naturalisation » dans un livret PDF de ${LIVRET.nat.pages} pages, à imprimer.`)}</p><a class="btn" href="${href(LIVRET.nat.url)}" data-pdf-link download>Télécharger le PDF</a></div>` : ""}
<nav class="toc" aria-label="Thèmes">${toc}</nav>${sections}`,
  }));
}

/* ---------- Listes CSP et CR ---------- */
function listPage(code) {
  const L = listes[code], info = LIST[code];
  const items = [["Accueil", "/"], [info.nom, info.path]];
  const longName = code === "csp" ? "carte de séjour pluriannuelle (CSP)" : "carte de résident (CR)";
  const toc = themes.map((t) => `<a href="#theme-${t.id}" style="--c:var(--t${t.id})"><span>0${t.id}</span> ${typo(t.titre_court)}</a>`).join("");
  const sections = themes.map((t) => {
    const es = L.questions.filter((e) => e.theme === t.id);
    return `
<section class="block" id="theme-${t.id}" style="--c:var(--t${t.id})">
  <h2>${typo(t.titre)} <small class="count">${es.length}\u00a0questions</small></h2>
  <ol class="qlist">${es.map((e) => { const q = qById.get(e.id); return `<li><span class="n">${e.numero}</span><span><a href="${href(qPath(q))}">${typo(e.texte || q.question)}</a><span class="r">${typo(q.reponse)}</span></span></li>`; }).join("")}</ol>
</section>`;
  }).join("");
  const common = new Set(L.questions.map((e) => e.id).filter((id) => /^[1-5]-\d+$/.test(id))).size;
  write(info.path, layout({
    title: `Examen civique ${longName} : ${info.count} questions-réponses et QCM gratuit | ${NAME}`,
    description: clip(`Les ${info.count} questions officielles de l’examen civique pour la ${longName}, avec leurs réponses, classées par thème. QCM et examen blanc gratuits.`),
    path: info.path, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<div class="eyebrow">Liste officielle · ${esc(info.court)}</div>
<h1 style="font-size:clamp(28px,6vw,40px)">${typo(`Examen civique ${longName} : les ${info.count} questions et réponses`)}</h1>
<p class="lead">La liste officielle des questions de connaissance pour une ${esc(code === "csp" ? "première carte de séjour pluriannuelle" : "première carte de résident")}, dans l’ordre publié par le ministère de l’Intérieur, avec une réponse courte pour chacune. ${common} de ces questions figurent aussi dans la liste « naturalisation ».</p>
<div class="cta"><p>À l’examen : 40 questions en 45 minutes, dont 28 questions de connaissance tirées de cette liste et 12 mises en situation. Il faut 32 bonnes réponses.</p><a class="btn primary" href="${href(`/reviser/?liste=${code}`)}">QCM ${esc(info.court)}</a></div>
${listCards(code)}
${LIVRET[code] ? `<div class="cta" style="background:var(--surface);border:1px solid var(--line)"><p>${typo(`Toute la liste « ${info.nom.toLowerCase()} » dans un livret PDF de ${LIVRET[code].pages} pages, à imprimer.`)}</p><a class="btn" href="${href(LIVRET[code].url)}" data-pdf-link download>Télécharger le PDF</a></div>` : ""}
<nav class="toc" aria-label="Thèmes">${toc}</nav>${sections}
<p class="src" style="margin-top:22px">Source des questions : ${esc(L.source)}. Réponses rédigées par ${esc(NAME)}. <a href="${reportLink(info.nom, info.path)}">Signaler une erreur</a></p>`,
  }));
}

/* ---------- Pages thème (liste naturalisation) ---------- */
function themePage(t) {
  const qs = byTheme(t.id);
  const items = [["Accueil", "/"], ["Naturalisation", "/questions/"], [plain(t.titre), tPath(t)]];
  const list = qs.map((q) => `<li><span class="n">${q.numero}</span><span><a href="${href(qPath(q))}">${typo(q.question)}</a><span class="r">${typo(q.reponse)}</span></span></li>`).join("");
  write(tPath(t), layout({
    title: `${plain(t.titre)} : ${qs.length} questions et réponses – QCM examen civique`,
    description: clip(`Examen civique, thème « ${plain(t.titre)} » : les ${qs.length} questions officielles (naturalisation) et leurs réponses, avec l’essentiel à retenir et un QCM gratuit.`),
    path: tPath(t), theme: t.id, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}
<div class="qhead"><div class="eyebrow">Thème ${t.id} · ${qs.length}\u00a0questions</div>
<h1>${typo(t.titre)}</h1></div>
<div class="essentiel"><h2>L’essentiel à retenir</h2><ul>${t.essentiel.map((e) => `<li>${typo(e)}</li>`).join("")}</ul></div>
<section class="block"><h2>Les ${qs.length} questions et leurs réponses</h2><ol class="qlist">${list}</ol></section>
<div class="cta"><p>Entraînez-vous sur ce thème avec des cartes et un QCM.</p><a class="btn primary" href="${href(`/reviser/?liste=nat&theme=${t.id}`)}">QCM du thème ${t.id}</a></div>
<div class="cta" style="background:var(--surface);border:1px solid var(--line)"><p>Toutes les questions dans un livret PDF de ${LIVRET.nat ? LIVRET.nat.pages : 27} pages, à imprimer.</p><a class="btn" href="${href(PDF_PATH)}" data-pdf-link download>Télécharger le PDF</a></div>`,
  }));
}

/* ---------- Pages question ---------- */
function questionPage(q, i) {
  const t = themeById[q.theme];
  const ms = member.get(q.id);
  const main = ms[0];
  const pool = main.code === "nat" ? byTheme(t.id)
    : [...new Set(listes[main.code].questions.filter((e) => e.theme === main.theme).map((e) => e.id))].map((id) => qById.get(id));
  const at = Math.max(0, pool.findIndex((x) => x.id === q.id));
  const related = [];
  for (let k = 1; related.length < 6 && k < pool.length; k++) related.push(pool[(at + k) % pool.length]);
  const prev = questions[i - 1], next = questions[i + 1];
  const canonicalQ = questions.find((x) => x.id === q._canonicalId) || q;
  const items = [["Accueil", "/"], [LIST[main.code].nom, LIST[main.code].path], [plain(t.titre_court), main.code === "nat" ? tPath(t) : `${LIST[main.code].path}#theme-${main.theme}`], [`Question ${main.numero}`, qPath(q)]];
  const src = [];
  if (q.reponse_hors_livret) src.push(`<span class="tag">hors livret</span> Cette réponse ne figure pas dans le Livret du citoyen.`);
  const chap = livretChap(q.livret_pages);
  if (q.livret_pages) src.push(`Source : <a href="${href(`/livret-du-citoyen/${chap ? `#${chap.id}` : ""}`)}">Livret du citoyen</a> (édition mai 2026), p.\u00a0${esc(q.livret_pages)}.`);
  if (!q.livret_pages && !q.reponse_hors_livret) src.push(`Réponse rédigée par ${esc(NAME)} d’après les textes officiels.`);
  src.push(`Mis à jour le ${dateFr(UPDATED)} · <a href="${reportLink(plain(q.question), qPath(q))}">Signaler une erreur</a>`);
  const det = detailHtml(q);
  const desc = clip(`${plain(q.reponse)} ${plain(q.explication || "")}`.trim());
  const seen = new Set();
  const badges = ms.filter((m) => !seen.has(m.code) && seen.add(m.code)).map((m) => `<a class="lbadge" href="${href(LIST[m.code].path)}">${esc(LIST[m.code].nom)} <b>n°\u00a0${m.theme}-${m.numero}</b></a>`).join("");
  const variants = [...new Map(ms.filter((m) => m.texte).map((m) => [m.texte, m])).values()];
  // Les 4 propositions du QCM, dans un ordre fixe propre à chaque question (la bonne n'est pas toujours la première)
  const hsh = (s) => createHash("md5").update(q.id + s).digest("hex");
  const opts = [{ t: q.qcm.bonne, ok: true }, ...q.qcm.mauvaises.map((t) => ({ t, ok: false }))].sort((a, b) => (hsh(a.t) < hsh(b.t) ? -1 : 1));
  const qcm = `<section class="qcm-block" aria-labelledby="qcm-${q.id}"><h2 id="qcm-${q.id}">Les 4 propositions du QCM</h2>
  <ol class="qopts">${opts.map((o, k) => `<li${o.ok ? ' class="ok"' : ""}><span class="L">${"ABCD"[k]}</span><span>${typo(o.t)}</span>${o.ok ? '<span class="okl">✓ Bonne réponse</span>' : ""}</li>`).join("")}</ol>
  <p class="note">${typo("À l’examen, chaque question propose 4 réponses dont une seule est juste. Ces propositions sont celles de notre QCM d’entraînement.")}</p></section>`;
  const en = EN.q[q.id];
  const les = LESSON_OF[main.code].get(q.id);
  const lesUrl = href(`/reviser/?liste=${main.code}&lecon=${les.t}-${les.i}`);
  const lesLabel = `leçon ${les.i} du thème « ${plain(themeById[les.t].titre_court)} » (${les.n} questions)`;
  const enHelp = en ? `<details class="en-help" lang="en"><summary><b>EN</b>In English</summary><p>${esc(en[0])}</p><p><b>Answer:</b> ${esc(en[1])}</p>${en[2] ? `<p class="end">${esc(en[2])}</p>` : ""}</details>` : "";
  write(qPath(q), layout({
    title: `${plain(q.question)} | QCM examen civique`,
    description: desc, path: qPath(q), canonical: qPath(canonicalQ), theme: t.id, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}
<article>
  <div class="qhead"><div class="eyebrow">Thème ${t.id} · ${typo(t.titre_court)}</div>
  <h1>${typo(q.question)}</h1>
  <div class="lbadges"><span>Listes officielles :</span>${badges}</div></div>
  <div class="answer">
    <div class="lbl">Réponse</div>
    <p class="a">${typo(q.reponse)}</p>
    ${det ? `<p class="d">${det}</p>` : ""}
    <p class="src">${src.join("<br>")}</p>
  </div>
  ${qcm}
  ${enHelp}
  ${variants.length ? `<div class="variants"><h2>Autres formulations officielles</h2><ul>${variants.map((m) => `<li>« ${typo(m.texte)} » <small>(${esc(LIST[m.code].nom)}, n°\u00a0${m.theme}-${m.numero})</small></li>`).join("")}</ul></div>` : ""}
</article>
<div class="cta" data-lecon="${lesUrl}" data-lecon-label="${esc(lesLabel)}"><p>${typo(`Apprenez cette question avec les ${les.n - 1} autres de sa leçon, en 5 minutes : vous lisez les réponses, puis un petit quiz. Gratuit.`)}</p><a class="btn primary" href="${lesUrl}">Apprendre cette leçon</a></div>
<nav class="pager" aria-label="Questions voisines">
  ${prev ? `<a href="${href(qPath(prev))}"><span>‹ Question précédente</span><b>${typo(prev.question)}</b></a>` : "<span></span>"}
  ${next ? `<a class="next" href="${href(qPath(next))}"><span>Question suivante ›</span><b>${typo(next.question)}</b></a>` : "<span></span>"}
</nav>
<section class="block"><h2 style="font-size:21px">Dans le même thème</h2>
<ul class="related">${related.map((r) => `<li><a href="${href(qPath(r))}">${typo(r.question)}</a></li>`).join("")}</ul>
<p><a href="${href(main.code === "nat" ? tPath(t) : `${LIST[main.code].path}#theme-${main.theme}`)}">Toutes les questions du thème « ${typo(t.titre_court)} » (${esc(LIST[main.code].nom)}) ›</a></p></section>`,
  }));
}

/* ---------- Livret du citoyen : sommaire et questions par chapitre ---------- */
const LIVRET_URL = "https://www.immigration.interieur.gouv.fr/sites/dgef/files/medias/documents/2026-07/LIVRET-DU-CITOYEN-2026.pdf";
const LIVRET_NEWS = "https://www.immigration.interieur.gouv.fr/actualites/actualites/mise-a-jour-du-livret-du-citoyen";
// Pages d'après le sommaire du livret (édition mai 2026)
const LIVRET_PARTS = [
  { n: 1, titre: "Principes et valeurs de la République", p: [5, 14], chaps: [
    { id: "devise-et-symboles", num: "I", titre: "La devise et les symboles de la République", p: [6, 9], txt: "Ce que veulent dire liberté, égalité et fraternité, puis les symboles de la France : la fête nationale du 14 juillet, La Marseillaise (avec ses paroles), la langue française, Marianne, le drapeau tricolore et le coq." },
    { id: "principes", num: "II", titre: "Les principes de la République", p: [10, 14], txt: "L’article 1er de la Constitution du 4 octobre 1958 : une République indivisible, laïque, démocratique et sociale. La laïcité y est expliquée en détail." },
  ] },
  { n: 2, titre: "Système institutionnel et politique", p: [15, 23], chaps: [
    { id: "democratie", num: "I", titre: "Démocratie et État de droit", p: [16, 18], txt: "Les principales institutions de l’État et le droit de vote." },
    { id: "territoires", num: "II", titre: "Organisation territoriale de la République", p: [19, 21], txt: "Les communes, les départements, les régions et l’outre-mer." },
    { id: "union-europeenne", num: "III", titre: "L’Union européenne et ses institutions", p: [22, 23], txt: "Les pays membres et leur date d’entrée, et les étapes clés de la construction européenne." },
  ] },
  { n: 3, titre: "Droits et devoirs des citoyens", p: [24, 36], chaps: [
    { id: "droits", num: "I", titre: "Les droits fondamentaux", p: [25, 31], txt: "Les droits liés à la liberté individuelle, à la dignité, à la sûreté et à la justice, les droits politiques et les droits environnementaux." },
    { id: "devoirs", num: "II", titre: "Les obligations et devoirs des citoyens", p: [32, 36], txt: "Respecter les lois, les institutions et les principes de la République, participer à la vie démocratique, contribuer aux charges publiques, défendre la patrie, protéger l’environnement, transmettre les valeurs, l’entraide et la solidarité." },
  ] },
  { n: 4, titre: "Histoire, géographie et culture", p: [37, 60], chaps: [
    { id: "histoire", num: "I", titre: "Principales périodes et personnages", p: [38, 48], txt: "Les grandes étapes de l’histoire de France, du Moyen Âge à nos jours, et les principaux personnages historiques." },
    { id: "geographie", num: "II", titre: "Territoire et géographie", p: [49, 52], txt: "La place de la France dans le monde, son économie et quelques éléments remarquables du territoire." },
    { id: "culture", num: "III", titre: "La culture et le patrimoine", p: [53, 60], txt: "Les musées, des artistes français célèbres, le patrimoine architectural, la langue française, les fêtes nationales, les grands événements sportifs et la gastronomie." },
  ] },
  { n: 5, titre: "Vivre dans la société française", p: [61, 76], chaps: [
    { id: "vie-quotidienne", num: "I", titre: "La vie quotidienne", p: [62, 69], txt: "Se loger, se déplacer, s’assurer (responsabilité civile), vivre ensemble dans l’espace public, préserver l’environnement, la santé et les numéros d’urgence." },
    { id: "travail", num: "II", titre: "Travailler en France", p: [70, 72], txt: "Les règles du travail, le contrat de travail, l’insertion professionnelle, la création d’entreprise et l’accès à l’emploi public." },
    { id: "famille", num: "III", titre: "La vie familiale", p: [73, 76], txt: "Le mariage, les droits des parents et des enfants, les obligations parentales, l’éducation, le numérique et les enfants." },
  ] },
  { n: 0, titre: "Annexes", p: [77, 83], chaps: [
    { id: "annexes", num: "", titre: "Déclaration de 1789, Charte des droits et devoirs, ressources", p: [77, 83], txt: "La Déclaration des droits de l’homme et du citoyen de 1789, la Charte des droits et devoirs du citoyen français (que le candidat signe à l’issue de l’entretien de naturalisation) et des liens vers les textes officiels." },
  ] },
];
const LIVRET_CHAPS = LIVRET_PARTS.flatMap((part) => part.chaps.map((c) => ({ ...c, part })));
function livretChap(pages) {
  const m = String(pages || "").match(/\d+/); if (!m) return null;
  const p = +m[0];
  return LIVRET_CHAPS.find((c) => p >= c.p[0] && p <= c.p[1])
    || (LIVRET_PARTS.find((part) => p >= part.p[0] && p <= part.p[1]) || { chaps: [null] }).chaps[0];
}
const pagesFr = ([a, b]) => (a === b ? `p. ${a}` : `p. ${a} à ${b}`);

function livretPage() {
  const path = "/livret-du-citoyen/";
  const items = [["Accueil", "/"], ["Guides", "/guide/"], ["Livret du citoyen", path]];
  const qOf = (c) => natQ.filter((q) => { const x = livretChap(q.livret_pages); return x && x.id === c.id; });
  const hors = natQ.filter((q) => q.reponse_hors_livret).length;
  const withPage = natQ.filter((q) => q.livret_pages).length;
  const MAJ = "2026-10-21";
  const h1 = "Livret du citoyen 2026 : sommaire et questions de l’examen civique";
  const desc = "Le Livret du citoyen (édition mai 2026) expliqué partie par partie : sommaire, pages clés et questions de l’examen civique qui s’y rapportent. Lien vers le PDF officiel.";
  const rows = LIVRET_PARTS.map((part) => {
    const n = part.chaps.reduce((s, c) => s + qOf(c).length, 0);
    return `<tr><td><a href="#${part.n ? `partie-${part.n}` : "annexes"}">${part.n ? `Partie ${part.n} — ` : ""}${typo(part.titre)}</a></td><td class="n">${pagesFr(part.p)}</td><td class="n">${n || "—"}</td></tr>`;
  }).join("");
  const parts = LIVRET_PARTS.map((part) => {
    const theme = part.n ? themes[part.n - 1] : null;
    return `<h2 id="${part.n ? `partie-${part.n}` : "annexes-titre"}">${part.n ? `Partie ${part.n} — ` : ""}${typo(part.titre)}</h2>
${theme ? `<p>${typo(`Cette partie correspond au thème ${part.n} de l’examen civique :`)} <a href="${href(tPath(theme))}">${typo(theme.titre)}</a>.</p>` : ""}
${part.chaps.map((c) => {
    const qs = qOf(c);
    return `<section class="chap" id="${c.id}"><h3>${c.num ? `${c.num}. ` : ""}${typo(c.titre)} <span class="pg">${pagesFr(c.p)}</span></h3>
<p>${typo(c.txt)}</p>
${qs.length ? `<p><b>${qs.length} question${qs.length > 1 ? "s" : ""} de l’examen</b> (liste naturalisation) s’appuie${qs.length > 1 ? "nt" : ""} sur ces pages :</p>
<ul>${qs.map((q) => `<li><a href="${href(qPath(q))}">${typo(q.question)}</a> <small>p. ${esc(q.livret_pages)}</small></li>`).join("")}</ul>` : ""}</section>`;
  }).join("\n")}`;
  }).join("\n");
  write(path, layout({
    title: `Livret du citoyen 2026 : sommaire, résumé et questions de l’examen civique | ${NAME}`,
    description: desc, path, ogType: "article",
    jsonld: [breadcrumbLd(items), { "@context": "https://schema.org", "@type": "Article", headline: h1, description: desc, inLanguage: "fr", dateModified: MAJ, author: { "@type": "Person", name: "Jovan Pavlovic", url: abs("/a-propos/") }, publisher: { "@type": "Organization", name: NAME, logo: { "@type": "ImageObject", url: abs("/assets/icon-512.png") } }, mainEntityOfPage: abs(path), about: { "@type": "CreativeWork", name: "Livret du citoyen", url: LIVRET_URL } }],
    body: `${crumbs(items)}<article class="prose guide"><div class="eyebrow">Guide · mis à jour le ${dateFr(MAJ)}</div><h1>${typo(h1)}</h1>
<p class="lead">${typo("Le Livret du citoyen est le document de référence du ministère de l’Intérieur pour la naturalisation. Voici son contenu partie par partie, avec, pour chaque chapitre, les questions de l’examen civique qui s’y rapportent.")}</p>
<div class="offbtn"><a class="btn primary" href="${LIVRET_URL}" rel="noopener">Livret officiel en PDF (ministère de l’Intérieur)</a><a class="btn" href="${href("/reviser/?liste=nat")}">Réviser avec le QCM</a></div>
<h2>Qu’est-ce que le Livret du citoyen ?</h2>
<p>${typo("Publié par le ministère de l’Intérieur, il présente les connaissances attendues des candidats à la naturalisation : les principes et valeurs de la République, les institutions, les droits et devoirs, l’histoire, la géographie, la culture et la vie quotidienne en France. Selon son introduction, il « illustre le niveau de connaissances attendues de tout(e) candidat(e) à la naturalisation », invité à l’étudier avant l’examen civique et l’entretien en préfecture.")}</p>
<p>${typo("La version actuelle porte la mention « édition mai 2026 ». Elle a été approuvée par un arrêté du 3 juillet 2026, qui remplace le livret de 2022, et mise en ligne par le ministère le 16 juillet 2026. Elle compte 83 pages et cinq parties, qui suivent les cinq thèmes de l’examen civique.")} <a href="${LIVRET_NEWS}" rel="noopener">Annonce du ministère</a>.</p>
<p>${typo("Le livret est écrit pour la naturalisation, mais ses cinq parties suivent les mêmes thèmes que l’examen pour la carte de séjour pluriannuelle et la carte de résident : il est utile à tous les candidats.")}</p>
<h2>Le sommaire</h2>
<table class="toc-table"><thead><tr><th>Partie</th><th>Pages</th><th>Questions</th></tr></thead><tbody>${rows}</tbody></table>
<p class="src">${typo(`Colonne « Questions » : nombre de questions de la liste naturalisation dont la réponse renvoie à ces pages (${withPage} questions sur ${TOTAL}).`)}</p>
${parts}
<h2>Comment l’utiliser pour réviser ?</h2>
<ul>
<li>${typo("Lisez une partie par jour, en suivant le")} <a href="${href("/preparer-examen-civique-en-7-jours/")}">plan en 7 jours</a>.</li>
<li>${typo("Après chaque partie, faites le QCM du thème correspondant, puis un")} <a href="${href("/examen-blanc/")}">examen blanc</a>.</li>
<li>${typo("Chaque réponse de Coq Civique indique la page du livret : en cas de doute, vérifiez dans le livret officiel.")}</li>
<li>${typo(`${hors} questions de la liste naturalisation portent sur des informations absentes du livret : elles sont signalées « hors livret » sur leur page.`)}</li>
<li>${typo("Pour la naturalisation, le livret sert aussi à préparer")} <a href="${href("/guide/entretien-naturalisation/")}">l’entretien en préfecture</a>.</li>
</ul>
<p class="src">${typo(`Résumé rédigé par ${NAME} d’après le sommaire et le contenu du livret ; il ne remplace pas le document officiel. Site indépendant et non officiel.`)} <a href="${reportLink("Livret du citoyen", path)}">Signaler une erreur</a></p>
</article>
<div class="cta"><p>Révisez les questions du livret avec des cartes, un QCM et des examens blancs gratuits.</p><a class="btn primary" href="${href("/reviser/?liste=nat")}">Faire le QCM</a></div>`,
  }));
}

/* ---------- Livrets PDF ---------- */
function pdfPage() {
  const path = "/examen-civique-pdf/";
  const items = [["Accueil", "/"], ["Livrets PDF", path]];
  const desc = "Examen civique 2026 en PDF gratuit, sans inscription : toutes les questions officielles et leurs réponses (naturalisation 259, carte de résident, CSP) et des sujets de 40 questions avec corrigé.";
  write(path, layout({
    title: `Examen civique 2026 PDF gratuit : questions et réponses à imprimer, sans inscription | ${NAME}`,
    description: desc, path, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<article class="prose"><div class="eyebrow">À imprimer · gratuit</div><h1>${typo("Examen civique en PDF : les questions et réponses à imprimer")}</h1>
<p class="lead">${typo("Un livret par liste officielle : toutes les questions de votre démarche avec leur réponse, à imprimer pour réviser loin des écrans, seul ou en famille. Gratuit, sans inscription.")}</p>
<div class="cta"><p>${typo("Besoin d’un sujet de 40 questions comme à l’examen, avec corrigé ? Un nouveau sujet à chaque clic.")}</p><a class="btn primary" href="${href(EX40_PATH)}">${typo("Sujets de 40 questions en PDF")}</a></div>
</article>
<div class="livrets">${LIVRETS.map((l) => `<div class="livret"><img src="${href(l.cover)}" alt="Couverture du livret ${esc(LIST[l.code].nom)}" width="331" height="468" loading="lazy"><div><b>${esc(LIST[l.code].nom)}</b><span>${l.questions} questions · ${l.pages} pages</span><a class="btn primary" href="${href(l.url)}" data-pdf-link download>Télécharger le PDF</a></div></div>`).join("")}</div>
<article class="prose">
<h2>Ce que contient chaque livret</h2>
<ul>
<li>${typo("Toutes les questions de la liste officielle, dans l’ordre et avec leur numéro, et une réponse claire pour chacune.")}</li>
<li>${typo("L’essentiel de chaque thème en début de chapitre.")}</li>
<li>${typo("Une colonne réponse à cacher avec une feuille, pour vous interroger.")}</li>
<li>${typo("Une fiche mémo pour la veille de l’examen.")}</li>
</ul>
<h2>Quel livret choisir ?</h2>
<p>${typo("Celui de votre démarche : les 28 questions de connaissance de l’examen sont tirées de la liste correspondante.")}</p>
<ul>
<li><b>Carte de séjour pluriannuelle</b> : <a href="${href(LIST.csp.path)}">${LIST.csp.count} questions</a>.</li>
<li><b>Carte de résident</b> : <a href="${href(LIST.cr.path)}">${LIST.cr.count} questions</a>.</li>
<li><b>Naturalisation</b> : <a href="${href("/questions/")}">${LIST.nat.count} questions</a>.</li>
</ul>
<p>${typo("Pas sûr de votre liste ? Lisez")} <a href="${href("/guide/qui-doit-passer-examen-civique/")}">qui doit passer l’examen civique</a>.</p>
<h2>Comment le télécharger ?</h2>
<p>${typo("Cliquez sur « Télécharger le PDF », puis sur « Télécharger sans email » : c’est gratuit et sans inscription. Si vous le souhaitez, indiquez votre adresse email : elle garde votre progression dans l’application sur tous vos appareils, sans mot de passe.")}</p>
<h2>${typo("« 300 questions » : combien y en a-t-il vraiment ?")}</h2>
<p>${typo("Beaucoup de recherches parlent de « 300 questions » : c’est le titre de guides payants vendus en ligne, pas un chiffre officiel. La liste officielle de la naturalisation compte")} ${LIST.nat.count} ${typo("questions, celle de la carte de résident")} ${LIST.cr.count} ${typo("et celle de la carte de séjour pluriannuelle")} ${LIST.csp.count}. ${typo("Nos livrets les contiennent toutes, avec leurs réponses, gratuitement.")}</p>
<h2>Les 12 mises en situation</h2>
<p>${typo("Elles ne sont pas publiées par le ministère et ne figurent donc pas dans les livrets. Entraînez-vous avec nos")} <a href="${href("/mises-en-situation/")}">${situations.length} mises en situation corrigées</a>, ${typo("ou avec un")} <a href="${href(EX40_PATH)}">${typo("sujet complet de 40 questions en PDF")}</a> ${typo("qui en contient 12.")}</p>
<h2>Les documents officiels en PDF</h2>
<ul>
<li><a href="${LIVRET_URL}" rel="noopener">Livret du citoyen</a> (ministère de l’Intérieur) — ${typo("voir aussi notre")} <a href="${href("/livret-du-citoyen/")}">${typo("sommaire avec les questions de l’examen")}</a>.</li>
<li><a href="https://formation-civique.interieur.gouv.fr/examen-civique/" rel="noopener">formation-civique.interieur.gouv.fr</a> : ${typo("programme et listes officielles des questions.")}</li>
<li><a href="https://www.france-education-international.fr/document/manuelcandidatexamencivique" rel="noopener">${typo("Manuel du candidat")}</a> (France Éducation International).</li>
</ul>
<h2>Plutôt sur téléphone ?</h2>
<p>${typo("L’application de révision fonctionne même sans internet, sur iPhone comme sur Android :")} <a href="${href("/installer-application/")}">installer l’application</a>.</p>
</article>`,
  }));
}

/* ---------- Examen blanc ---------- */
function examBlancPage() {
  const path = "/examen-blanc/";
  const items = [["Accueil", "/"], ["Examen blanc", path]];
  const desc = "Simulateur gratuit de l’examen civique, sans inscription : 40 questions en 45 minutes, 28 questions de votre liste officielle et 12 mises en situation, score sur 40 et correction.";
  write(path, layout({
    title: `Examen civique test gratuit : simulateur d’examen blanc de 40 questions (2026) | ${NAME}`,
    description: desc, path, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<article class="prose"><div class="eyebrow">Simulateur · gratuit · sans inscription</div><h1>${typo("Examen blanc de l’examen civique : la simulation en conditions réelles")}</h1>
<p class="lead">${typo("40 questions en 45 minutes, comme le jour de l’examen : 28 questions de votre liste officielle et 12 mises en situation. Votre score sur 40 et la correction de chaque erreur.")}</p>
<div class="offbtn">${LISTS.map((l, k) => `<a class="btn${k === 0 ? " primary" : ""}" href="${href(`/reviser/?liste=${l.code}&start=examen`)}">Examen blanc ${esc(l.nom.toLowerCase())}</a>`).join("")}</div>
<h2>Comment se passe l’examen blanc ?</h2>
<ul>
<li>${typo("40 questions à choix multiples, quatre propositions, une seule bonne réponse.")}</li>
<li>${typo("Un chronomètre de 45 minutes ; vous pouvez revenir sur une question avant de terminer.")}</li>
<li>${typo("28 questions tirées de la liste officielle que vous avez choisie, réparties sur les cinq thèmes, et 12 mises en situation de la vie quotidienne.")}</li>
<li>${typo("Il faut 32 bonnes réponses sur 40 pour réussir ; une question sans réponse compte comme une erreur.")}</li>
<li>${typo("À la fin : votre score, le seuil de 32, et la correction de chaque erreur avec son explication (et une aide en anglais si vous le souhaitez).")}</li>
<li>${typo("Vos résultats sont enregistrés : les questions manquées reviennent plus souvent dans vos révisions.")}</li>
</ul>
<h2>Combien d’examens blancs faire ?</h2>
<p>${typo("Commencez quand vous avez révisé chaque thème une fois. Visez au moins 35 sur 40 pour avoir de la marge le jour J, puis faites un examen blanc par jour jusqu’à l’examen. Les questions se mélangent à chaque fois.")}</p>
<h2>Les 12 mises en situation</h2>
<p>${typo("Le ministère ne les publie pas. Nos exemples reprennent les principes de l’examen : laïcité, égalité, respect de la loi, droits et devoirs. Voir les")} <a href="${href("/mises-en-situation/")}">${situations.length} mises en situation corrigées</a> ${typo("et notre")} <a href="${href("/guide/mises-en-situation-examen-civique/")}">${typo("méthode")}</a>.</p>
<h2>Avant l’examen blanc</h2>
<ul>
<li><a href="${href("/guide/deroulement-examen-civique/")}">${typo("Comment se passe le vrai examen")}</a></li>
<li><a href="${href("/preparer-examen-civique-en-7-jours/")}">${typo("Le plan de révision en 7 jours")}</a></li>
<li><a href="${href("/examen-civique-pdf/")}">${typo("Les questions et réponses en PDF")}</a></li>
<li><a href="${href(EX40_PATH)}">${typo("Un examen blanc de 40 questions en PDF, à imprimer")}</a></li>
</ul>
</article>`,
  }));
}

/* ---------- Sujets de 40 questions en PDF (générateur dans le navigateur) ---------- */
const EX40_PATH = "/examen-civique-40-questions-pdf/";
// Sujets d'exemple produits par tools/examen40/exemples.mjs (inventaire dans assets/examens/examens.json)
const EX40_INV = existsSync(join(ROOT, "assets/examens/examens.json")) ? JSON.parse(readFileSync(join(ROOT, "assets/examens/examens.json"), "utf8")) : {};
function examen40Data() {
  const pdfText = (s) => plain(s).replace(/[  ]/g, " ");
  const used = new Set();
  const lists = Object.fromEntries(LISTS.map((l) => {
    const seen = new Set(), q = [];
    for (const qq of questions) {
      const m = member.get(qq.id).find((x) => x.code === l.code);
      if (!m || seen.has(qq.id)) continue;
      seen.add(qq.id); used.add(qq.id);
      q.push(m.texte ? [qq.id, m.theme, m.numero, pdfText(m.texte)] : [qq.id, m.theme, m.numero]);
    }
    return [l.code, { nom: l.nom, q }];
  }));
  const q = Object.fromEntries(questions.filter((x) => used.has(x.id)).map((x) => [x.id, [pdfText(x.question), pdfText(x.qcm.bonne), x.qcm.mauvaises.map(pdfText), abs(qPath(x))]]));
  const s = situations.map((x) => [x.id, x.theme, pdfText(x.situation), pdfText(x.question), pdfText(x.qcm.bonne), x.qcm.mauvaises.map(pdfText), abs(`/mises-en-situation/#${x.id}`)]);
  return { v: 1, themes: themes.map((t) => ({ t: t.id })), lists, q, s };
}
function examen40Page() {
  const path = EX40_PATH;
  const items = [["Accueil", "/"], ["Livrets PDF", "/examen-civique-pdf/"], ["Sujets de 40 questions", path]];
  const desc = "Examen civique 40 questions en PDF gratuit : un nouveau sujet à chaque clic, au format officiel (28 questions de votre liste + 12 mises en situation), avec corrigé. Sans inscription.";
  const cfg = { data: `${href("/data/examen40.json")}?v=${V}`, lib: href("/assets/vendor/jspdf.umd.min.js"), site: abs("/") };
  const examples = LISTS.filter((l) => EX40_INV[l.code]).map((l) => {
    const e = EX40_INV[l.code];
    return `<li><a href="${href(`/assets/examens/${e.fichier}`)}" download>${esc(l.nom)} : sujet ${esc(e.sujet)}</a> <span class="muted">(PDF, ${e.pages} pages, avec corrigé)</span></li>`;
  }).join("");
  write(path, layout({
    title: `Examen civique 40 questions PDF gratuit : sujets avec corrigé | ${NAME}`,
    description: desc, path, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<article class="prose"><div class="eyebrow">Gratuit · sans inscription · à imprimer</div>
<h1>${typo("Examen civique : 40 questions en PDF, gratuit, avec corrigé")}</h1>
<p class="lead">${typo("Un nouveau sujet à chaque clic, au format de l’examen : 28 questions de votre liste officielle et 12 mises en situation. Imprimez-le, chronométrez 45 minutes, puis corrigez-vous. Sans email, sans compte.")}</p>
<form id="gen40" class="gen40" data-cfg="${esc(JSON.stringify(cfg))}">
<fieldset><legend>Votre démarche</legend>
${LISTS.map((l, i) => `<label class="opt"><input type="radio" name="liste" value="${l.code}"${i === 0 ? " checked" : ""}> <span>${esc(l.nom)}</span> <small>${l.count} questions</small></label>`).join("\n")}
</fieldset>
<label class="chk"><input type="checkbox" name="corrige" checked> ${typo("Ajouter le corrigé à la fin du sujet")}</label>
<button class="btn primary big" type="submit">Télécharger mon sujet PDF</button>
<p class="gen-status" role="status" aria-live="polite"></p>
<noscript><p>${typo("Le générateur a besoin de JavaScript. Vous pouvez télécharger un des sujets prêts à imprimer ci-dessous.")}</p></noscript>
</form>
${examples ? `<h2>${typo("Trois sujets prêts à imprimer")}</h2>
<p>${typo("Pas envie de générer ? Voici un sujet complet pour chaque liste, corrigé compris :")}</p>
<ul>${examples}</ul>` : ""}
<h2>${typo("Comment est fait chaque sujet ?")}</h2>
<ul>
<li>${typo("40 questions à choix multiples, quatre propositions, une seule bonne réponse, comme à l’examen.")}</li>
<li>${typo("28 questions de connaissance tirées de la liste officielle de votre démarche (naturalisation, carte de résident ou carte de séjour pluriannuelle), réparties sur les cinq thèmes selon leur poids dans la liste.")}</li>
<li>${typo("12 mises en situation de la vie quotidienne. Le ministère ne les publie pas : celles-ci sont rédigées par Coq Civique sur les mêmes principes (laïcité, égalité, droits et devoirs).")}</li>
<li>${typo("Le corrigé est sur les dernières pages : une grille des bonnes réponses pour compter vos points, puis chaque réponse avec un lien vers son explication.")}</li>
<li>${typo("Chaque sujet a un numéro (par exemple NAT-4821). Le même numéro donne toujours le même sujet : pratique pour qu’un formateur donne le même sujet à tout un groupe.")}</li>
</ul>
<h2>${typo("Comment s’entraîner avec un sujet PDF")}</h2>
<ol>
<li>${typo("Imprimez le sujet sans les pages du corrigé, ou cachez-les.")}</li>
<li>${typo("Lancez un chronomètre de 45 minutes et répondez à toutes les questions : une question sans réponse compte comme une erreur.")}</li>
<li>${typo("Corrigez-vous avec la grille : il faut au moins 32 bonnes réponses sur 40. Visez 35 pour avoir de la marge le jour de l’examen.")}</li>
<li>${typo("Revoyez chaque erreur avec son explication, puis travaillez le thème concerné dans")} <a href="${href("/reviser/")}">${typo("l’application (leçons de 5 minutes)")}</a>.</li>
<li>${typo("Recommencez avec un nouveau sujet : les questions changent à chaque fois.")}</li>
</ol>
<h2>${typo("Sur papier ou en ligne ?")}</h2>
<p>${typo("Le papier aide à se concentrer, loin des notifications. En ligne, l’")}<a href="${href("/examen-blanc/")}">${typo("examen blanc")}</a> ${typo("se corrige tout seul, avec un vrai chronomètre et une explication pour chaque erreur, et vos questions manquées reviennent dans vos révisions. Les deux sont gratuits : alternez-les.")}</p>
<h2>${typo("Vous cherchez toutes les questions en PDF ?")}</h2>
<p>${typo("Les livrets PDF contiennent la liste complète avec les réponses :")} ${LISTS.map((l) => `${esc(l.nom.toLowerCase())} (${l.count} questions)`).join(", ")}. <a href="${href("/examen-civique-pdf/")}">${typo("Voir les livrets PDF")}</a>.</p>
<h2>${typo("Formateurs et associations")}</h2>
<p>${typo("Vous préparez un groupe à l’examen civique ? Générez un sujet, notez son numéro et partagez le lien du sujet : tout le monde travaille sur les mêmes 40 questions. C’est gratuit, sans compte. Une question, une idée :")} <a href="mailto:${esc(config.editeur.contact)}">${esc(config.editeur.contact)}</a>.</p>
<p class="src">${typo("Site indépendant et non officiel. Questions de connaissance : listes officielles du ministère de l’Intérieur. Réponses et mises en situation rédigées par Coq Civique. Le ministère rappelle que la préparation à l’examen peut se faire gratuitement.")}</p>
</article>
<script src="${href("/assets/examen40.js")}?v=${V}" defer></script>`,
  }));
}

/* ---------- Mises en situation (exercices rédigés par le site) ---------- */
function sitPage() {
  const path = "/mises-en-situation/";
  const items = [["Accueil", "/"], ["Mises en situation", path]];
  const order = (x) => { // position de la bonne réponse : fixe pour chaque exercice
    let h = 0; for (const ch of x.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const opts = [...x.qcm.mauvaises]; opts.splice(h % 4, 0, x.qcm.bonne); return opts;
  };
  const toc = themes.map((t) => `<a href="#theme-${t.id}" style="--c:var(--t${t.id})"><span>0${t.id}</span> ${typo(t.titre_court)}</a>`).join("");
  const sections = themes.map((t) => {
    const xs = situations.filter((x) => x.theme === t.id);
    return `<section class="block" id="theme-${t.id}" style="--c:var(--t${t.id})"><h2>${typo(t.titre)} <small class="count">${xs.length}\u00a0exercices</small></h2>
${xs.map((x) => `<article class="sit-item" id="${x.id}"><div class="sit-meta">${esc(x.principe)}</div><p class="sit-s">${typo(x.situation)}</p><p class="sit-q">${typo(x.question)}</p>
<ol class="sit-opts" type="A">${order(x).map((o) => `<li>${typo(o)}</li>`).join("")}</ol>
<details><summary>Voir la réponse</summary><p class="sit-a">${typo(x.qcm.bonne)}</p><p class="sit-d">${typo(x.explication)}</p></details></article>`).join("\n")}</section>`;
  }).join("");
  write(path, layout({
    title: `Mises en situation de l’examen civique : ${situations.length} exemples corrigés | ${NAME}`,
    description: `Entraînez-vous aux mises en situation de l’examen civique : ${situations.length} cas de la vie quotidienne corrigés et expliqués (travail, école, laïcité, santé, logement…).`,
    path, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<div class="eyebrow">Exercices d’entraînement · non officiels</div>
<h1 style="font-size:clamp(28px,6vw,40px)">${typo(`Mises en situation de l’examen civique : ${situations.length} exemples corrigés`)}</h1>
<p class="lead">${typo("À l’examen, 12 des 40 questions décrivent une situation de la vie quotidienne. Elles ne sont pas publiées : ces exercices, rédigés par Coq Civique, reposent sur les mêmes principes pour vous y préparer.")}</p>
<div class="cta"><p>${typo("Entraînez-vous en QCM : les mises en situation sont aussi incluses dans l’examen blanc au format officiel (28 + 12).")}</p><a class="btn primary" href="${href("/reviser/?theme=sit")}">QCM mises en situation</a></div>
<p>${typo("La méthode pour les réussir est expliquée dans")} <a href="${href("/guide/mises-en-situation-examen-civique/")}">notre guide</a>.</p>
<nav class="toc" aria-label="Thèmes">${toc}</nav>${sections}
<p class="src" style="margin-top:22px">${typo("Exercices rédigés par Coq Civique, mis à jour le")} ${dateFr(UPDATED)}. <a href="${reportLink("Mises en situation", path)}">Signaler une erreur</a></p>`,
  }));
}

/* ---------- Application de révision ---------- */
function appPage() {
  const cards = questions.map((q) => {
    const l = {};
    for (const m of member.get(q.id)) if (!l[m.code]) l[m.code] = m.texte ? [m.theme, m.numero, typo(m.texte)] : [m.theme, m.numero];
    return {
      i: q.id, q: typo(q.question), a: typo(q.reponse), d: detailHtml(q),
      p: q.livret_pages, h: q.reponse_hors_livret, c: typo(q.qcm.bonne), w: q.qcm.mauvaises.map(typo),
      u: href(qPath(q)), l,
    };
  });
  const sits = situations.map((x) => ({ i: x.id, t: x.theme, n: x.numero, s: typo(x.situation), q: typo(x.question), c: typo(x.qcm.bonne), w: x.qcm.mauvaises.map(typo), d: typo(x.explication), p: x.principe }));
  const appData = { site: abs("/"), pdfs: Object.fromEntries(LIVRETS.map((l) => [l.code, { url: href(l.url), pages: l.pages }])), sits, sitUrl: href("/mises-en-situation/"), mascot: href("/assets/mascotte-fin.jpg"), help: { en: `${href("/data/en.json")}?v=${V}`, ar: `${href("/data/ar.json")}?v=${V}` }, themes: themes.map((t) => ({ t: t.id, name: typo(t.titre) })), lists: LISTS.map((l) => ({ code: l.code, nom: l.nom, court: l.court, count: l.count })), cards };
  const tpl = readFileSync(join(ROOT, "src/app/app.html"), "utf8");
  const title = `Test civique gratuit : apprendre l’examen civique avec leçons, QCM et examen blanc | ${NAME}`;
  const desc = `Apprenez l’examen civique pas à pas, 5 minutes par jour : des leçons courtes sur les questions officielles de votre liste (naturalisation, carte de résident ou CSP), un quiz après chaque leçon et des examens blancs. Gratuit, sans inscription.`;
  sitemap.push("/reviser/");
  write("/reviser/", tpl
    .replaceAll("__TITLE__", esc(title))
    .replaceAll("__DESC__", esc(desc))
    .replaceAll("__CANONICAL__", abs("/reviser/"))
    .replaceAll("__NAME__", esc(NAME))
    .replaceAll("__HOME__", href("/"))
    .replaceAll("__QUESTIONS__", href("/questions/"))
    .replaceAll("__ASSETS__", href("/assets"))
    .replaceAll("__OGIMAGE__", abs("/assets/og-image.png"))
    .replace("__PWAHEAD__", () => pwaHead())
    .replace("__SUPABASE__", () => sbScripts() + "\n" + pwaScripts())
    .replace("__DATA__", () => JSON.stringify(appData).replace(/<\//g, "<\\/")));
}

/* ---------- Pages de contenu (content/pages et content/guides) ---------- */
// Chaque fichier HTML commence par un commentaire JSON : {"titre", "description", "h1", "maj", "ordre", "chapo"}.
function readContent(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).filter((f) => f.endsWith(".html")).map((f) => {
    const raw = readFileSync(join(full, f), "utf8");
    const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
    if (!m) throw new Error(`${dir}/${f} : en-tête JSON manquant`);
    return { slug: f.replace(/\.html$/, ""), meta: JSON.parse(m[1]), html: raw.slice(m[0].length) };
  }).sort((a, b) => (a.meta.ordre || 99) - (b.meta.ordre || 99));
}
// Typographie française dans le texte des pages (hors balises) : espaces insécables avant : ; ? ! » et après «
const frSpaces = (html) => html.replace(/>([^<]+)</g, (m, txt) => ">" + txt.replace(/« /g, "«\u00a0").replace(/ ([»?!:;])/g, "\u00a0$1") + "<");
const fillVarsEn = (html) => html
  .replace(/\{\{href:([^}]+)\}\}/g, (_, p) => href(p.trim()))
  .replaceAll("{{nat}}", String(LIST.nat.count)).replaceAll("{{cr}}", String(LIST.cr.count)).replaceAll("{{csp}}", String(LIST.csp.count))
  .replaceAll("{{nom}}", esc(NAME)).replaceAll("{{contact}}", esc(config.editeur.contact));
const fillVars = (html) => frSpaces(html)
  .replace(/\{\{href:([^}]+)\}\}/g, (_, p) => href(p.trim()))
  .replaceAll("{{nat}}", String(LIST.nat.count)).replaceAll("{{cr}}", String(LIST.cr.count)).replaceAll("{{csp}}", String(LIST.csp.count))
  .replaceAll("{{nom}}", esc(NAME)).replaceAll("{{contact}}", esc(config.editeur.contact)).replaceAll("{{editeur}}", esc(config.editeur.nom));
function contentPages() {
  const guides = readContent("content/guides");
  for (const g of guides) {
    const path = `/guide/${g.slug}/`;
    const items = [["Accueil", "/"], ["Guides", "/guide/"], [g.meta.h1, path]];
    write(path, layout({
      title: `${g.meta.titre} | ${NAME}`, description: g.meta.description, path, ogType: "article",
      jsonld: [breadcrumbLd(items), { "@context": "https://schema.org", "@type": "Article", headline: g.meta.h1, description: g.meta.description, inLanguage: "fr", dateModified: g.meta.maj, author: { "@type": "Person", name: "Jovan Pavlovic", url: abs("/a-propos/") }, publisher: { "@type": "Organization", name: NAME, logo: { "@type": "ImageObject", url: abs("/assets/icon-512.png") } }, mainEntityOfPage: abs(path) }],
      body: `${crumbs(items)}<article class="prose guide"><div class="eyebrow">Guide · mis à jour le ${dateFr(g.meta.maj)}</div><h1>${typo(g.meta.h1)}</h1>${g.meta.chapo ? `<p class="lead">${typo(g.meta.chapo)}</p>` : ""}${fillVars(g.html)}
<p class="src">Par Jovan, créateur de ${esc(NAME)}. Site indépendant et non officiel : en cas de doute, référez-vous aux sites officiels cités. <a href="${reportLink(g.meta.h1, path)}">Signaler une erreur</a></p></article>
<div class="cta"><p>Prêt à vous entraîner ? QCM, cartes et examens blancs gratuits.</p><a class="btn primary" href="${href("/reviser/")}">Faire le QCM</a></div>`,
    }));
  }
  const hubItems = [["Accueil", "/"], ["Guides", "/guide/"]];
  write("/guide/", layout({
    title: `Guides de l’examen civique 2026 : déroulement, inscription, dispenses | ${NAME}`,
    description: "Tout comprendre de l’examen civique : déroulement, inscription, qui doit le passer, niveau de français, Livret du citoyen, entretien de naturalisation et plan de révision.",
    path: "/guide/", jsonld: [breadcrumbLd(hubItems)],
    body: `${crumbs(hubItems)}<h1 style="font-size:clamp(28px,6vw,40px)">Guides de l’examen civique</h1>
<p class="lead">Les réponses aux questions pratiques, vérifiées sur les sites officiels.</p>
<ul class="guides">${[
      { url: "/preparer-examen-civique-en-7-jours/", meta: { h1: "Préparer l’examen civique en 7 jours", description: "Le plan de révision jour par jour, avec les questions à travailler." } },
      ...guides.map((g) => ({ url: `/guide/${g.slug}/`, meta: g.meta })),
      { url: "/livret-du-citoyen/", meta: { h1: "Livret du citoyen 2026 : sommaire et questions de l’examen", description: "Le livret officiel partie par partie, avec les questions de l’examen civique qui s’y rapportent." } },
      { url: "/examen-blanc/", meta: { h1: "Examen blanc : la simulation en conditions réelles", description: "40 questions en 45 minutes, score sur 40 et correction de chaque erreur." } },
      { url: "/examen-civique-pdf/", meta: { h1: "Les questions et réponses en PDF", description: "Un livret gratuit à imprimer pour chaque liste officielle." } },
      { url: EX40_PATH, meta: { h1: "Sujets de 40 questions en PDF", description: "Un nouveau sujet au format de l’examen à chaque clic, avec corrigé." } },
    ].map((g) => `<li><a href="${href(g.url)}"><b>${typo(g.meta.h1)}</b><span>${typo(g.meta.description)}</span></a></li>`).join("")}</ul>`,
  }));
  for (const p of readContent("content/en")) {
    const path = p.slug === "index" ? "/en/" : `/en/${p.slug}/`;
    const items = [["Coq Civique", "/"], ["English", path]];
    write(path, layout({
      title: `${p.meta.titre} | ${NAME}`, description: p.meta.description, path, lang: "en", jsonld: [breadcrumbLd(items)],
      alternates: p.slug === "index" ? ALTS : [],
      body: `${crumbs(items)}<article class="prose" lang="en"><div class="eyebrow">In English · updated ${new Date(p.meta.maj + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</div><h1>${esc(p.meta.h1)}</h1>${p.meta.chapo ? `<p class="lead">${esc(p.meta.chapo)}</p>` : ""}${fillVarsEn(p.html)}</article>`,
    }));
  }
  // En arabe : les passages en français sont isolés (<bdi>) pour garder le bon sens de lecture
  const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿŒœ][A-Za-zÀ-ÖØ-öø-ÿŒœ0-9'’.,!?…\-–/: ]*[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9.!?…]|[A-Za-zÀ-ÖØ-öø-ÿŒœ]/g;
  const bidiHtml = (html) => html.replace(/>([^<]+)</g, (m, txt) => ">" + txt.replace(LATIN, "<bdi>$&</bdi>") + "<");
  const bidiText = (t) => esc(t).replace(LATIN, "<bdi>$&</bdi>");
  for (const p of readContent("content/ar")) {
    const path = p.slug === "index" ? "/ar/" : `/ar/${p.slug}/`;
    const items = [["Coq Civique", "/"], ["العربية", path]];
    write(path, layout({
      title: `${p.meta.titre} | ${NAME}`, description: p.meta.description, path, lang: "ar", jsonld: [breadcrumbLd(items)],
      alternates: p.slug === "index" ? ALTS : [],
      body: `${crumbs(items)}<article class="prose" lang="ar" dir="rtl"><div class="eyebrow">بالعربية · آخر تحديث ${new Date(p.meta.maj + "T12:00:00Z").toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</div><h1>${bidiText(p.meta.h1)}</h1>${p.meta.chapo ? `<p class="lead">${bidiText(p.meta.chapo)}</p>` : ""}${bidiHtml(fillVarsEn(p.html))}</article>`,
    }));
  }
  for (const p of readContent("content/pages")) {
    const path = `/${p.slug}/`;
    const items = [["Accueil", "/"], [p.meta.h1, path]];
    write(path, layout({
      title: `${p.meta.titre} | ${NAME}`, description: p.meta.description, path, jsonld: [breadcrumbLd(items)],
      body: `${crumbs(items)}<article class="prose${p.meta.classe ? ` ${p.meta.classe}` : ""}">${p.meta.maj ? `<div class="eyebrow">Mis à jour le ${dateFr(p.meta.maj)}</div>` : ""}<h1>${typo(p.meta.h1)}</h1>${p.meta.chapo ? `<p class="lead">${typo(p.meta.chapo)}</p>` : ""}${fillVars(p.html)}</article>`,
    }));
  }
}

/* ---------- Mentions légales, 404, sitemap ---------- */
function legal() {
  const e = config.editeur;
  const items = [["Accueil", "/"], ["Mentions légales", "/mentions-legales/"]];
  const contact = `<a href="mailto:${esc(e.contact)}">${esc(e.contact)}</a>`;
  const donnees = SB_ON ? `
<p><b>Responsable du traitement :</b> ${esc(e.nom)}, joignable à ${contact}.</p>
<h3>Adresse email et progression</h3>
<p>Si vous indiquez votre adresse email, nous l’enregistrons avec votre progression de révision (questions vues, réponses sues, résultats des examens blancs), la date et la page où vous l’avez indiquée. Finalité : retrouver votre progression sur vos appareils et vous donner accès au livret PDF. Base légale : l’exécution du service que vous demandez. Il n’y a pas de mot de passe : une personne qui saisit votre adresse sur le site peut voir et modifier cette progression. Durée de conservation : 3 ans après votre dernière activité, ou jusqu’à votre demande de suppression.</p>
<h3>Nouvelles de ${esc(NAME)}</h3>
<p>Uniquement si vous cochez la case prévue : envoi occasionnel de nouvelles du site. Base légale : votre consentement, dont nous conservons la date comme preuve, et que vous pouvez retirer à tout moment en nous écrivant ou par le lien présent dans chaque message.</p>
<h3>Résultat d’examen et témoignage (facultatifs)</h3>
<p>Si vous indiquez votre résultat à l’examen, nous enregistrons ce résultat, la liste concernée et, si vous les donnez, votre score, votre prénom avec l’initiale du nom et votre témoignage, sans adresse email. Finalité : établir des statistiques de réussite et, uniquement avec votre accord explicite, publier votre témoignage après vérification. Base légale : votre consentement. Durée : 3 ans. Pour retirer un témoignage publié, écrivez-nous.</p>
<h3>Mesure d’audience</h3>
<p>Nous comptons le nombre de pages vues chaque jour, ainsi que le site d’origine de la visite (par exemple un moteur de recherche). Aucune donnée personnelle n’est enregistrée : ni adresse IP, ni cookie, ni identifiant. Ces chiffres servent uniquement à améliorer le site.</p>
<h3>Destinataires et prestataires</h3>
<p>Vos données sont destinées uniquement à l’éditeur du site. Base de données : Supabase${SB.region ? ` (données hébergées dans la région ${esc(SB.region)})` : ""}. Hébergement du site : GitHub Pages, qui enregistre, comme tout hébergeur, des données techniques de connexion (adresse IP) pour assurer la sécurité du service. Ces prestataires agissent dans le cadre d’accords de traitement des données ; lorsqu’ils peuvent accéder aux données depuis un pays hors de l’Union européenne, ce transfert est encadré par les clauses contractuelles types de la Commission européenne. Vos données ne sont ni vendues ni cédées à des tiers.</p>
<h3>Vos droits</h3>
<p>Vous pouvez accéder à vos données, les rectifier, les effacer, en limiter l’utilisation, vous y opposer, en demander la portabilité et retirer votre consentement : écrivez à ${contact}. Nous répondons dans un délai d’un mois. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).</p>
<h3>Stockage dans votre navigateur</h3>
<p>Le site n’utilise aucun cookie ni traceur publicitaire. Il enregistre dans votre navigateur votre progression et, si vous l’avez indiquée, votre adresse email, pour ne pas vous la redemander à chaque visite. Ces informations sont strictement nécessaires au fonctionnement du service.</p>` : `
<p>Le site ne collecte aucune donnée personnelle, ne dépose aucun cookie et n’utilise aucun outil de mesure d’audience. Votre progression de révision est enregistrée dans votre navigateur (stockage local), sur votre appareil ; elle n’est jamais envoyée au site. Vous pouvez l’effacer à tout moment depuis la page « Réviser » ou en supprimant les données de navigation.</p>`;
  write("/mentions-legales/", layout({
    title: `Mentions légales et confidentialité | ${NAME}`,
    description: `Mentions légales, hébergement et politique de confidentialité du site ${NAME}.`,
    path: "/mentions-legales/", jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<div class="prose">
<h1 style="font-size:clamp(28px,6vw,38px)">Mentions légales et confidentialité</h1>
<h2>Éditeur du site</h2><p>${esc(e.nom)}, à titre non professionnel.<br>Contact : ${contact}</p>
<h2>Hébergement</h2><p>Site : ${esc(config.hebergeur)}</p>
<h2>Site non officiel</h2><p>${esc(NAME)} est un site indépendant de révision. Il n’est ni édité ni validé par le ministère de l’Intérieur ou par un centre d’examen. Les questions reprennent les listes officielles des questions de connaissance publiées par le ministère de l’Intérieur (naturalisation, 12 décembre 2025 ; carte de résident et carte de séjour pluriannuelle, sur formation-civique.interieur.gouv.fr), réutilisées avec mention de leur source. Les réponses sont rédigées par le site, notamment d’après le Livret du citoyen (édition mai 2026) et la Charte des droits et devoirs du citoyen français. Malgré le soin apporté, une erreur reste possible : en cas de doute, reportez-vous aux documents officiels. Voir aussi les <a href="${href("/conditions-utilisation/")}">conditions d’utilisation</a>.</p>
<h2 id="donnees">Données personnelles</h2>${donnees}
<h2>Polices de caractères</h2><p>Fraunces et Atkinson Hyperlegible, sous licence SIL Open Font License, hébergées sur ce site.</p>
</div>`,
  }));
  write("/404.html", layout({
    title: `Page introuvable | ${NAME}`, description: "Cette page n’existe pas.", path: "/404.html", index: false,
    body: `<section class="hero"><h1>Page introuvable</h1><p class="lead">Cette adresse ne correspond à aucune page.</p>
<div class="ctas"><a class="btn primary" href="${href("/questions/")}">Voir les questions</a><a class="btn" href="${href("/")}">Accueil</a></div></section>`,
  }));
}

/* ---------- Construction ---------- */
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
cpSync(join(ROOT, "src/site/site.css"), join(DIST, "assets/site.css"));
cpSync(join(ROOT, "src/site/coq.js"), join(DIST, "assets/coq.js"));
cpSync(join(ROOT, "src/site/pwa.js"), join(DIST, "assets/pwa.js"));
cpSync(join(ROOT, "src/site/examen40.js"), join(DIST, "assets/examen40.js"));
cpSync(join(ROOT, "assets/favicon.ico"), join(DIST, "favicon.ico"));
writeFileSync(join(DIST, "manifest.webmanifest"), JSON.stringify({
  name: `${NAME} – Examen civique`, short_name: NAME, lang: "fr", dir: "ltr",
  description: "QCM gratuit de l’examen civique : questions officielles, réponses, cartes et examens blancs.",
  id: href("/reviser/"), start_url: href("/reviser/?source=app"), scope: href("/"), display: "standalone",
  background_color: "#F4F6FA", theme_color: "#1F4E9C",
  icons: [
    { src: href("/assets/icon-192.png"), sizes: "192x192", type: "image/png" },
    { src: href("/assets/icon-512.png"), sizes: "512x512", type: "image/png" },
    { src: href("/assets/icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));
{
  const fonts = readdirSync(join(ROOT, "assets/fonts")).filter((f) => f.endsWith(".woff2")).map((f) => href(`/assets/fonts/${f}`));
  const pre = [href("/reviser/"), href("/"), href("/installer-application/"), `${href("/assets/site.css")}?v=${V}`, `${href("/assets/coq.js")}?v=${V}`, `${href("/assets/pwa.js")}?v=${V}`,
    href("/assets/icon-64.png"), href("/assets/icon-192.png"), href("/assets/mascotte-fin.jpg"), href("/manifest.webmanifest"), ...fonts];
  writeFileSync(join(DIST, "sw.js"), readFileSync(join(ROOT, "src/site/sw.js"), "utf8")
    .replace("__VERSION__", V).replace("__APP__", href("/reviser/")).replace("__PRECACHE__", JSON.stringify(pre)));
}
mkdirSync(join(DIST, "data"), { recursive: true });
cpSync(join(ROOT, "data/questions.json"), join(DIST, "data/questions.json"));
cpSync(join(ROOT, "data/listes.json"), join(DIST, "data/listes.json"));
cpSync(join(ROOT, "data/en.json"), join(DIST, "data/en.json"));
cpSync(join(ROOT, "data/ar.json"), join(DIST, "data/ar.json"));
writeFileSync(join(DIST, "data/examen40.json"), JSON.stringify(examen40Data()));
home();
questionsIndex();
listPage("cr");
listPage("csp");
themes.forEach(themePage);
questions.forEach(questionPage);
sitPage();
appPage();
livretPage();
pdfPage();
examBlancPage();
examen40Page();
contentPages();
legal();
// Date de dernière modification réelle : celle de la version publiée si le contenu n'a pas changé.
// En publication automatique, build-cache/pages.json est la copie de /pages.json du site en ligne.
const PREV = (() => { try { return JSON.parse(readFileSync(process.env.PREV_PAGES || join(ROOT, "build-cache/pages.json"), "utf8")); } catch { return {}; } })();
const PAGES = {};
for (const p of new Set(sitemap)) {
  const h = PAGE_HASH.get(p) || "";
  const prev = PREV[p];
  PAGES[p] = { h, d: prev && prev.h === h && prev.d ? prev.d : TODAY };
}
writeFileSync(join(DIST, "pages.json"), JSON.stringify(PAGES));
const CHANGED = Object.keys(PAGES).filter((p) => !PREV[p] || PREV[p].h !== PAGES[p].h).map(abs);
mkdirSync(join(ROOT, "build-cache"), { recursive: true });
writeFileSync(join(ROOT, "build-cache/changed-urls.json"), JSON.stringify(CHANGED, null, 1));
if (config.indexnow) writeFileSync(join(DIST, `${config.indexnow}.txt`), config.indexnow);
writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.entries(PAGES).map(([p, x]) => `  <url><loc>${abs(p)}</loc><lastmod>${x.d}</lastmod></url>`).join("\n")}
</urlset>
`);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
writeFileSync(join(DIST, ".nojekyll"), "");
console.log(`Site généré dans dist/ : ${new Set(sitemap).size} pages indexables, ${CHANGED.length} nouvelles ou modifiées, adresse ${SITE_URL}`);
