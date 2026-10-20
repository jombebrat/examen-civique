// Génère le site statique dans dist/ à partir de data/*.json, content/ et site.config.json.
// Usage : node scripts/build.mjs [--base-url https://exemple.com]
import { mkdirSync, writeFileSync, rmSync, cpSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { ROOT, loadJSON, esc, typo, plain, detailHtml, questionSlugs } from "./lib.mjs";

const data = loadJSON("data/questions.json");
const listes = loadJSON("data/listes.json");
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

const sitemap = [];
const SB = config.supabase || {};
// Adresse email + progression en ligne + livret PDF : actifs si l'adresse et la clé publique Supabase sont renseignées.
const SB_ON = Boolean(SB.url && SB.cle_publique && SB.actif !== false);
const PDF_PATH = "/assets/coq-civique-examen-civique.pdf";
const sbScripts = () => SB_ON ? `<script>window.COQ=${JSON.stringify({ sbUrl: SB.url, sbKey: SB.cle_publique, pdfUrl: href(PDF_PATH), logo: href("/assets/icon-192.png"), reviser: href("/reviser/"), privacyUrl: href("/mentions-legales/#donnees") }).replace(/</g, "\\u003c")};</script>
<script src="${href("/assets/coq.js")}" defer></script>` : "";

function write(path, html) {
  const file = join(DIST, path.endsWith("/") ? path + "index.html" : path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
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

function layout({ title, description, path, body, jsonld = [], canonical = path, theme = null, index = true, ogType = "website" }) {
  if (index && canonical === path && !path.endsWith(".html")) sitemap.push(path);
  const color = theme ? ` style="--c:var(--t${theme})"` : "";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(canonical)}">
${index ? "" : '<meta name="robots" content="noindex">\n'}<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(canonical)}">
<meta name="theme-color" content="#1F4E9C">
<link rel="icon" type="image/png" sizes="32x32" href="${href("/assets/icon-32.png")}">
<link rel="icon" type="image/png" sizes="192x192" href="${href("/assets/icon-192.png")}">
<link rel="apple-touch-icon" href="${href("/assets/icon-180.png")}">
<meta property="og:image" content="${abs("/assets/og-image.png")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="${href("/assets/fonts/atkinson-400.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${href("/assets/fonts/fraunces-800.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${href("/assets/site.css")}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body${color}>
<a class="skip" href="#contenu">Aller au contenu</a>
<div class="flag" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="wrap top">
  <a class="brand" href="${href("/")}"><img src="${href("/assets/icon-64.png")}" width="32" height="32" alt="">${esc(NAME)}</a>
  <nav class="nav" aria-label="Navigation principale">
    <a class="hide-sm" href="${href("/questions/")}">Questions</a>
    <a class="hide-sm" href="${href("/guide/")}">Guides</a>
    <a class="btn small" href="${href(PDF_PATH)}" data-pdf-link download>PDF</a>
    <a class="btn primary small" href="${href("/reviser/")}">Réviser</a>
  </nav>
</header>
<main id="contenu" class="wrap">
${body}
</main>
<footer class="wrap">
  <div class="links">
    <a href="${href("/questions/")}">Naturalisation</a>
    <a href="${href(LIST.cr.path)}">Carte de résident</a>
    <a href="${href(LIST.csp.path)}">Carte de séjour pluriannuelle</a>
    <a href="${href("/reviser/")}">QCM et examen blanc</a>
    <a href="${href("/preparer-examen-civique-en-7-jours/")}">Plan en 7 jours</a>
    <a href="${href("/guide/")}">Guides</a>
    <a href="${href("/a-propos/")}">À propos</a>
    <a href="${href("/conditions-utilisation/")}">Conditions d’utilisation</a>
    <a href="${href("/mentions-legales/")}">Mentions légales et confidentialité</a>
  </div>
  <p>${esc(NAME)} est un site indépendant et non officiel, sans lien avec le ministère de l’Intérieur. Questions : listes officielles des questions de connaissance (naturalisation, carte de résident, carte de séjour pluriannuelle). Réponses rédigées par ${esc(NAME)}, notamment d’après le Livret du citoyen (édition mai 2026).</p>
</footer>
${sbScripts()}
</body>
</html>
`;
}

const listCards = (current = "") => `<div class="lists">${LISTS.map((l) => `<a class="list-card${l.code === current ? " on" : ""}" href="${href(l.path)}"><b>${esc(l.nom)}</b><span>${l.count}\u00a0questions</span><small>${esc(l.sous)}</small></a>`).join("")}</div>`;

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
    ["Ce site est-il officiel ?", "Non. C’est un site indépendant et gratuit de révision, sans lien avec le ministère de l’Intérieur. L’inscription à l’examen se fait auprès d’un centre agréé."],
    ["Faut-il créer un compte ?", "Non. Il suffit d’indiquer votre adresse email, sans mot de passe : votre progression y est liée et vous la retrouvez sur votre téléphone comme sur votre ordinateur. La même adresse donne accès au livret PDF."],
  ];
  const body = `
<section class="hero hero-m">
  <div class="hero-text">
  <div class="eyebrow">Examen civique 2026 · listes officielles</div>
  <h1>Examen civique : QCM gratuit, questions et réponses</h1>
  <p class="lead">Les questions officielles de l’examen civique pour la naturalisation, la carte de résident et la carte de séjour pluriannuelle, avec une réponse claire pour chacune. Révisez avec des cartes, des quiz et des examens blancs chronométrés.</p>
  <div class="ctas"><a class="btn primary" href="${href("/reviser/")}">Commencer le QCM</a><a class="btn" href="${href("/preparer-examen-civique-en-7-jours/")}">Mon plan en 7 jours</a></div>
  </div>
  <div class="mascot"><video muted playsinline preload="auto" width="480" height="480" poster="${href("/assets/mascotte-debut.jpg")}" aria-hidden="true"><source src="${href("/assets/mascotte.mp4")}" type="video/mp4"><source src="${href("/assets/mascotte.webm")}" type="video/webm"></video></div>
  <script>(function(){var v=document.querySelector(".mascot video");if(!v)return;var end=${JSON.stringify(href("/assets/mascotte-fin.jpg"))};function still(){v.removeAttribute("src");v.poster=end;v.querySelectorAll("source").forEach(function(s){s.remove()});v.load();}if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches){still();return;}var p=v.play();if(p&&p.catch)p.catch(still);})();</script>
  <div class="facts">
    <div class="fact"><b>40</b><span>questions à l’examen</span></div>
    <div class="fact"><b>45 min</b><span>durée maximale</span></div>
    <div class="fact"><b>32/40</b><span>pour réussir (80 %)</span></div>
    <div class="fact"><b>3</b><span>listes officielles</span></div>
  </div>
</section>
<section class="block"><h2>Choisissez votre liste</h2>
<p class="sub">Les questions de connaissance de l’examen sont tirées de la liste officielle de votre démarche.</p>
${listCards()}
</section>
<section class="block story">
  ${mascotImg("story-img")}
  <div><h2>Pourquoi j’ai créé Coq Civique</h2>
  <p>Je m’appelle Jovan. Comme vous, je dois passer l’examen civique. Quand j’ai ouvert la liste officielle, j’ai trouvé des centaines de questions… et aucune réponse. Je voulais être prêt en 7 jours, et aider mes proches qui devaient le passer eux aussi.</p>
  <p>Alors j’ai rédigé une réponse claire pour chaque question, puis j’ai construit l’outil dont nous avions besoin : des cartes qui reviennent quand on se trompe, des quiz comme le jour de l’examen et des examens blancs chronométrés. Le voici, gratuit, pour vous aussi.</p>
  <p class="sign">— Jovan, créateur de ${esc(NAME)} · <a href="${href("/a-propos/")}">Lire l’histoire</a></p></div>
</section>
<section class="block"><h2>Prêt en 7 jours</h2>
  <ol class="plan7">
    <li><b>Jour 1</b> Principes et valeurs de la République</li>
    <li><b>Jour 2</b> Système institutionnel et politique</li>
    <li><b>Jour 3</b> Droits et devoirs</li>
    <li><b>Jour 4</b> Histoire, géographie et culture</li>
    <li><b>Jour 5</b> Vivre dans la société française</li>
    <li><b>Jour 6</b> Examens blancs et questions manquées</li>
    <li><b>Jour 7</b> Dernier examen blanc et mises en situation</li>
  </ol>
  <p style="margin-top:14px"><a class="btn primary" href="${href("/preparer-examen-civique-en-7-jours/")}">Voir le plan jour par jour</a></p>
</section>
<section class="block"><h2>Les 5 thèmes de l’examen</h2><p class="sub">Liste « naturalisation » ; les listes carte de résident et carte de séjour pluriannuelle suivent les mêmes thèmes.</p><div class="themes">${rows}</div></section>
<section class="block"><h2>Trois façons de réviser</h2>
  <div class="modes">
    <div><h3>Cartes</h3><p>Lisez la question, retrouvez la réponse, dites si vous la saviez. Les questions manquées reviennent plus souvent.</p></div>
    <div><h3>Quiz QCM</h3><p>Quatre propositions et une seule bonne réponse, comme le jour de l’examen, avec l’explication après chaque question.</p></div>
    <div><h3>Examen blanc</h3><p>40 questions des 5 thèmes en 45 minutes. Votre score, et la liste des questions à retravailler.</p></div>
  </div>
  <p style="margin-top:16px"><a class="btn primary" href="${href("/reviser/")}">Réviser maintenant</a></p>
</section>
<section class="block pdf" id="pdf">
  <img src="${href("/assets/livret-couverture.png")}" alt="Couverture du livret PDF Coq Civique" width="331" height="468" loading="lazy">
  <div><h2>Le livret de révision en PDF</h2>
  <p class="pdf-lead">Les ${TOTAL} questions de la liste « naturalisation » et leurs réponses sur 27 pages A4, à imprimer : l’essentiel de chaque thème, une colonne réponse à cacher pour s’interroger, et une fiche mémo pour la veille de l’examen.</p>
  <p><a class="btn primary" href="${href(PDF_PATH)}" data-pdf-link download>Télécharger le PDF (27 pages)</a></p>
  <p class="pdf-note">Gratuit : il suffit d’indiquer votre adresse email.</p></div>
</section>
<section class="block faq"><h2>Questions fréquentes</h2>
${faq.map(([q, a]) => `<details><summary>${typo(q)}</summary><p>${typo(a)}</p></details>`).join("\n")}
</section>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: abs("/"), inLanguage: "fr" },
    { "@context": "https://schema.org", "@type": "Organization", name: NAME, url: abs("/"), logo: abs("/assets/icon-512.png"), founder: { "@type": "Person", name: "Jovan Pavlovic" } },
  ];
  write("/", layout({
    title: `Examen civique 2026 : QCM gratuit, questions officielles et réponses | ${NAME}`,
    description: `QCM gratuit de l’examen civique : les questions officielles (naturalisation, carte de résident, carte de séjour pluriannuelle) avec leurs réponses, examens blancs et livret PDF.`,
    path: "/", body, jsonld: ld,
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
    title: `Examen civique naturalisation : les ${TOTAL} questions et réponses (QCM) | ${NAME}`,
    description: `La liste officielle des ${TOTAL} questions de connaissance de l’examen civique pour la naturalisation, classées par thème, avec leurs réponses et un QCM gratuit.`,
    path: "/questions/", jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<h1 style="font-size:clamp(28px,6vw,40px)">Examen civique naturalisation : les ${TOTAL} questions</h1>
<p class="lead">La liste officielle des questions de connaissance pour la naturalisation (publiée le 12 décembre 2025), dans l’ordre de la liste, avec un lien vers chaque réponse.</p>
<div class="cta"><p>Révisez cette liste avec des cartes, un QCM et des examens blancs de 40 questions.</p><a class="btn primary" href="${href("/reviser/?liste=nat")}">QCM naturalisation</a></div>
<h2 class="sr-title">Autres listes</h2>${listCards("nat")}
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
    title: `Examen civique ${longName} : ${info.count} questions-réponses et QCM | ${NAME}`,
    description: clip(`Les ${info.count} questions officielles de l’examen civique pour la ${longName}, avec leurs réponses, classées par thème. QCM et examen blanc gratuits.`),
    path: info.path, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<div class="eyebrow">Liste officielle · ${esc(info.court)}</div>
<h1 style="font-size:clamp(28px,6vw,40px)">Examen civique ${esc(longName)} : les ${info.count} questions et réponses</h1>
<p class="lead">La liste officielle des questions de connaissance pour une ${esc(code === "csp" ? "première carte de séjour pluriannuelle" : "première carte de résident")}, dans l’ordre publié par le ministère de l’Intérieur, avec une réponse courte pour chacune. ${common} de ces questions figurent aussi dans la liste « naturalisation ».</p>
<div class="cta"><p>À l’examen : 40 questions en 45 minutes, dont 28 questions de connaissance tirées de cette liste et 12 mises en situation. Il faut 32 bonnes réponses.</p><a class="btn primary" href="${href(`/reviser/?liste=${code}`)}">QCM ${esc(info.court)}</a></div>
${listCards(code)}
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
<div class="cta" style="background:var(--surface);border:1px solid var(--line)"><p>Toutes les questions dans un livret PDF de 27 pages, à imprimer.</p><a class="btn" href="${href(PDF_PATH)}" data-pdf-link download>Télécharger le PDF</a></div>`,
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
  if (q.livret_pages) src.push(`Source : Livret du citoyen (édition mai 2026), p.\u00a0${esc(q.livret_pages)}.`);
  if (!q.livret_pages && !q.reponse_hors_livret) src.push(`Réponse rédigée par ${esc(NAME)} d’après les textes officiels.`);
  src.push(`Mis à jour le ${dateFr(UPDATED)} · <a href="${reportLink(plain(q.question), qPath(q))}">Signaler une erreur</a>`);
  const det = detailHtml(q);
  const desc = clip(`${plain(q.reponse)} ${plain(q.explication || "")}`.trim());
  const seen = new Set();
  const badges = ms.filter((m) => !seen.has(m.code) && seen.add(m.code)).map((m) => `<a class="lbadge" href="${href(LIST[m.code].path)}">${esc(LIST[m.code].nom)} <b>n°\u00a0${m.theme}-${m.numero}</b></a>`).join("");
  const variants = [...new Map(ms.filter((m) => m.texte).map((m) => [m.texte, m])).values()];
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
  ${variants.length ? `<div class="variants"><h2>Autres formulations officielles</h2><ul>${variants.map((m) => `<li>« ${typo(m.texte)} » <small>(${esc(LIST[m.code].nom)}, n°\u00a0${m.theme}-${m.numero})</small></li>`).join("")}</ul></div>` : ""}
</article>
<div class="cta"><p>Entraînez-vous avec un QCM sur les questions de votre liste : cartes, quiz et examen blanc, gratuit.</p><a class="btn primary" href="${href(`/reviser/?liste=${main.code}&theme=${main.theme}`)}">Faire le QCM</a></div>
<nav class="pager" aria-label="Questions voisines">
  ${prev ? `<a href="${href(qPath(prev))}"><span>‹ Question précédente</span><b>${typo(prev.question)}</b></a>` : "<span></span>"}
  ${next ? `<a class="next" href="${href(qPath(next))}"><span>Question suivante ›</span><b>${typo(next.question)}</b></a>` : "<span></span>"}
</nav>
<section class="block"><h2 style="font-size:21px">Dans le même thème</h2>
<ul class="related">${related.map((r) => `<li><a href="${href(qPath(r))}">${typo(r.question)}</a></li>`).join("")}</ul>
<p><a href="${href(main.code === "nat" ? tPath(t) : `${LIST[main.code].path}#theme-${main.theme}`)}">Toutes les questions du thème « ${typo(t.titre_court)} » (${esc(LIST[main.code].nom)}) ›</a></p></section>`,
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
  const appData = { themes: themes.map((t) => ({ t: t.id, name: typo(t.titre) })), lists: LISTS.map((l) => ({ code: l.code, nom: l.nom, court: l.court, count: l.count })), cards };
  const tpl = readFileSync(join(ROOT, "src/app/app.html"), "utf8");
  const title = `QCM examen civique gratuit : cartes, quiz et examen blanc | ${NAME}`;
  const desc = `QCM gratuit de l’examen civique : révisez les questions officielles de votre liste (naturalisation, carte de résident ou CSP) avec des cartes, des quiz et des examens blancs de 40 questions en 45 minutes.`;
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
    .replace("__SUPABASE__", () => sbScripts())
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
const fillVars = (html) => html
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
    description: "Tout comprendre de l’examen civique : déroulement, inscription, qui doit le passer, mises en situation et plan de révision en 7 jours.",
    path: "/guide/", jsonld: [breadcrumbLd(hubItems)],
    body: `${crumbs(hubItems)}<h1 style="font-size:clamp(28px,6vw,40px)">Guides de l’examen civique</h1>
<p class="lead">Les réponses aux questions pratiques, vérifiées sur les sites officiels.</p>
<ul class="guides">${[{ slug: null, meta: { h1: "Préparer l’examen civique en 7 jours", description: "Le plan de révision jour par jour, avec les questions à travailler." } }, ...guides].map((g) => `<li><a href="${href(g.slug ? `/guide/${g.slug}/` : "/preparer-examen-civique-en-7-jours/")}"><b>${typo(g.meta.h1)}</b><span>${typo(g.meta.description)}</span></a></li>`).join("")}</ul>`,
  }));
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
<h3>Destinataires et prestataires</h3>
<p>Vos données sont destinées uniquement à l’éditeur du site. Base de données : Supabase${SB.region ? ` (données hébergées dans la région ${esc(SB.region)})` : ""}. Hébergement du site : GitHub Pages, qui enregistre, comme tout hébergeur, des données techniques de connexion (adresse IP) pour assurer la sécurité du service. Ces prestataires agissent dans le cadre d’accords de traitement des données ; lorsqu’ils peuvent accéder aux données depuis un pays hors de l’Union européenne, ce transfert est encadré par les clauses contractuelles types de la Commission européenne. Vos données ne sont ni vendues ni cédées à des tiers.</p>
<h3>Vos droits</h3>
<p>Vous pouvez accéder à vos données, les rectifier, les effacer, en limiter l’utilisation, vous y opposer, en demander la portabilité et retirer votre consentement : écrivez à ${contact}. Nous répondons dans un délai d’un mois. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).</p>
<h3>Stockage dans votre navigateur</h3>
<p>Le site n’utilise ni cookie ni outil de mesure d’audience. Il enregistre dans votre navigateur votre progression et, si vous l’avez indiquée, votre adresse email, pour ne pas vous la redemander à chaque visite. Ces informations sont strictement nécessaires au fonctionnement du service.</p>` : `
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
mkdirSync(join(DIST, "data"), { recursive: true });
cpSync(join(ROOT, "data/questions.json"), join(DIST, "data/questions.json"));
cpSync(join(ROOT, "data/listes.json"), join(DIST, "data/listes.json"));
home();
questionsIndex();
listPage("cr");
listPage("csp");
themes.forEach(themePage);
questions.forEach(questionPage);
appPage();
contentPages();
legal();
writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(sitemap)].map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
writeFileSync(join(DIST, ".nojekyll"), "");
console.log(`Site généré dans dist/ : ${new Set(sitemap).size} pages indexables, adresse ${SITE_URL}`);
