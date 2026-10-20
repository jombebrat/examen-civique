// Génère le site statique dans dist/ à partir de data/questions.json et site.config.json.
// Usage : node scripts/build.mjs [--base-url https://exemple.com]
import { mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { ROOT, loadJSON, esc, typo, plain, detailHtml, questionSlugs } from "./lib.mjs";

const data = loadJSON("data/questions.json");
const config = loadJSON("site.config.json");
const argUrl = (() => { const i = process.argv.indexOf("--base-url"); return i > 0 ? process.argv[i + 1] : ""; })();
const SITE_URL = (argUrl || process.env.SITE_URL || config.url).replace(/\/+$/, "");
const BASE = new URL(SITE_URL + "/");
const PREFIX = BASE.pathname.replace(/\/$/, "");
const href = (p) => PREFIX + p;
const abs = (p) => BASE.origin + PREFIX + p;
const DIST = join(ROOT, "dist");
const NAME = config.nom;
const TODAY = new Date().toISOString().slice(0, 10);

const themes = data.themes;
const questions = data.questions;
const slugs = questionSlugs(questions);
const themeById = Object.fromEntries(themes.map((t) => [t.id, t]));
const qPath = (q) => `/questions/${themeById[q.theme].slug}/${slugs.get(q.id)}/`;
const tPath = (t) => `/questions/${t.slug}/`;
const byTheme = (id) => questions.filter((q) => q.theme === id);
const TOTAL = questions.length;
const sitemap = [];

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

function layout({ title, description, path, body, jsonld = [], canonical = path, theme = null, index = true }) {
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
${index ? "" : '<meta name="robots" content="noindex">\n'}<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="${esc(NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(canonical)}">
<meta name="theme-color" content="#1F4E9C">
<link rel="icon" href="${href("/assets/favicon.svg")}" type="image/svg+xml">
<link rel="preload" href="${href("/assets/fonts/atkinson-400.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${href("/assets/fonts/fraunces-800.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${href("/assets/site.css")}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body${color}>
<a class="skip" href="#contenu">Aller au contenu</a>
<div class="flag" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="wrap top">
  <a class="brand" href="${href("/")}">${esc(NAME)}</a>
  <nav class="nav" aria-label="Navigation principale">
    <a class="hide-sm" href="${href("/questions/")}">Les 259 questions</a>
    <a class="btn primary small" href="${href("/reviser/")}">Réviser</a>
  </nav>
</header>
<main id="contenu" class="wrap">
${body}
</main>
<footer class="wrap">
  <div class="links">
    <a href="${href("/")}">Accueil</a>
    <a href="${href("/questions/")}">Toutes les questions</a>
    <a href="${href("/reviser/")}">Réviser</a>
    <a href="${href("/mentions-legales/")}">Mentions légales</a>
  </div>
  <p>${esc(NAME)} est un site indépendant et non officiel, sans lien avec le ministère de l’Intérieur. Questions : liste officielle publiée le 12 décembre 2025. Réponses rédigées d’après le Livret du citoyen (édition mai 2026).</p>
</footer>
</body>
</html>
`;
}

/* ---------- Accueil ---------- */
function home() {
  const rows = themes.map((t) => {
    const qs = byTheme(t.id);
    const ex = qs.slice(0, 2).map((q) => typo(q.question)).join(" · ");
    return `<a class="theme-row" href="${href(tPath(t))}" style="--c:var(--t${t.id})"><span class="num">0${t.id}</span>
      <span><span class="tt">${typo(t.titre)}</span><span class="ex">${ex}</span></span><span class="ct">${qs.length}\u00a0questions</span></a>`;
  }).join("\n");
  const faq = [
    ["Combien de questions y a-t-il à l’examen civique ?", "L’examen est un QCM de 40 questions à faire en 45 minutes au maximum. Chaque question propose 4 réponses, dont une seule est juste."],
    ["Quel score faut-il pour réussir ?", "Il faut au moins 80 % de bonnes réponses, soit 32 sur 40. Une erreur ou une absence de réponse vaut 0 : il vaut donc mieux répondre à toutes les questions."],
    ["D’où viennent les questions et les réponses ?", `Les ${TOTAL} questions sont celles de la liste officielle des questions de connaissance pour la naturalisation, publiée le 12 décembre 2025. Les réponses sont rédigées d’après le Livret du citoyen (édition mai 2026) ; quand une information n’y figure pas, elle est signalée « hors livret ».`],
    ["Ce site est-il officiel ?", "Non. C’est un site indépendant de révision, sans lien avec le ministère de l’Intérieur. Pour vous inscrire à l’examen, adressez-vous à un centre d’examen agréé."],
    ["Faut-il créer un compte ?", "Non. La révision est gratuite et sans inscription. Votre progression est enregistrée dans votre navigateur, sur l’appareil que vous utilisez."],
  ];
  const body = `
<section class="hero">
  <div class="eyebrow">Naturalisation · liste officielle du 12 décembre 2025</div>
  <h1>Examen civique : les ${TOTAL} questions et leurs réponses</h1>
  <p class="lead">Toutes les questions de connaissance de l’examen civique pour la naturalisation, avec une réponse claire et expliquée. Révisez avec des cartes, des quiz et des examens blancs chronométrés.</p>
  <div class="ctas"><a class="btn primary" href="${href("/reviser/")}">Commencer à réviser</a><a class="btn" href="${href("/questions/")}">Voir les ${TOTAL} questions</a></div>
  <div class="facts">
    <div class="fact"><b>40</b><span>questions à l’examen</span></div>
    <div class="fact"><b>45 min</b><span>durée maximale</span></div>
    <div class="fact"><b>32/40</b><span>pour réussir (80 %)</span></div>
    <div class="fact"><b>${TOTAL}</b><span>questions officielles</span></div>
  </div>
</section>
<section class="block"><h2>Les 5 thèmes de l’examen</h2><div class="themes">${rows}</div></section>
<section class="block"><h2>Trois façons de réviser</h2>
  <div class="modes">
    <div><h3>Cartes</h3><p>Lisez la question, retrouvez la réponse, dites si vous la saviez. Les questions manquées reviennent plus souvent.</p></div>
    <div><h3>Quiz QCM</h3><p>Quatre propositions et une seule bonne réponse, comme le jour de l’examen, avec l’explication après chaque question.</p></div>
    <div><h3>Examen blanc</h3><p>40 questions des 5 thèmes en 45 minutes. Votre score, et la liste des questions à retravailler.</p></div>
  </div>
  <p style="margin-top:16px"><a class="btn primary" href="${href("/reviser/")}">Réviser maintenant, sans inscription</a></p>
</section>
<section class="block faq"><h2>Questions fréquentes</h2>
${faq.map(([q, a]) => `<details><summary>${typo(q)}</summary><p>${typo(a)}</p></details>`).join("\n")}
</section>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: NAME, url: abs("/"), inLanguage: "fr" },
  ];
  write("/", layout({
    title: `Examen civique 2026 : les ${TOTAL} questions et réponses | ${NAME}`,
    description: `Les ${TOTAL} questions officielles de l’examen civique pour la naturalisation, avec leurs réponses expliquées. Cartes, quiz et examens blancs gratuits, sans inscription.`,
    path: "/", body, jsonld: ld,
  }));
}

/* ---------- Index des questions ---------- */
function questionsIndex() {
  const toc = themes.map((t) => `<a href="#theme-${t.id}" style="--c:var(--t${t.id})"><span>0${t.id}</span> ${typo(t.titre_court)}</a>`).join("");
  const sections = themes.map((t) => `
<section class="block" id="theme-${t.id}" style="--c:var(--t${t.id})">
  <h2><a href="${href(tPath(t))}" style="color:inherit;text-decoration:none">${typo(t.titre)}</a></h2>
  <ol class="qlist">${byTheme(t.id).map((q) => `<li><span class="n">${q.numero}</span><span><a href="${href(qPath(q))}">${typo(q.question)}</a></span></li>`).join("")}</ol>
</section>`).join("");
  const items = [["Accueil", "/"], ["Les questions", "/questions/"]];
  write("/questions/", layout({
    title: `Toutes les questions de l’examen civique (${TOTAL}) | ${NAME}`,
    description: `La liste complète des ${TOTAL} questions de connaissance de l’examen civique (naturalisation), classées par thème, avec leurs réponses.`,
    path: "/questions/", jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<h1 style="font-size:clamp(28px,6vw,40px)">Les ${TOTAL} questions de l’examen civique</h1>
<p class="lead">La liste officielle des questions de connaissance pour la naturalisation, dans l’ordre de la liste, avec un lien vers chaque réponse.</p>
<nav class="toc" aria-label="Thèmes">${toc}</nav>${sections}`,
  }));
}

/* ---------- Pages thème ---------- */
function themePage(t) {
  const qs = byTheme(t.id);
  const items = [["Accueil", "/"], ["Les questions", "/questions/"], [plain(t.titre), tPath(t)]];
  const list = qs.map((q) => `<li><span class="n">${q.numero}</span><span><a href="${href(qPath(q))}">${typo(q.question)}</a><span class="r">${typo(q.reponse)}</span></span></li>`).join("");
  write(tPath(t), layout({
    title: `${plain(t.titre)} : ${qs.length} questions et réponses – Examen civique`,
    description: clip(`Examen civique, thème « ${plain(t.titre)} » : les ${qs.length} questions officielles et leurs réponses, avec l’essentiel à retenir.`),
    path: tPath(t), theme: t.id, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}
<div class="qhead"><div class="eyebrow">Thème ${t.id} · ${qs.length}\u00a0questions</div>
<h1>${typo(t.titre)}</h1></div>
<div class="essentiel"><h2>L’essentiel à retenir</h2><ul>${t.essentiel.map((e) => `<li>${typo(e)}</li>`).join("")}</ul></div>
<section class="block"><h2>Les ${qs.length} questions et leurs réponses</h2><ol class="qlist">${list}</ol></section>
<div class="cta"><p>Entraînez-vous sur ce thème avec des cartes et des quiz.</p><a class="btn primary" href="${href("/reviser/")}">Réviser</a></div>`,
  }));
}

/* ---------- Pages question ---------- */
function questionPage(q, i) {
  const t = themeById[q.theme];
  const qs = byTheme(t.id);
  const prev = questions[i - 1], next = questions[i + 1];
  const canonicalQ = questions.find((x) => x.id === q._canonicalId) || q;
  const related = [];
  for (let k = 1; related.length < 6 && k < qs.length; k++) related.push(qs[(q.numero - 1 + k) % qs.length]);
  const items = [["Accueil", "/"], ["Les questions", "/questions/"], [plain(t.titre_court), tPath(t)], [`Question ${q.numero}`, qPath(q)]];
  const src = [];
  if (q.reponse_hors_livret) src.push(`<span class="tag">hors livret</span> Cette réponse ne figure pas dans le Livret du citoyen.`);
  if (q.livret_pages) src.push(`Source : Livret du citoyen (édition mai 2026), p.\u00a0${esc(q.livret_pages)}.`);
  const det = detailHtml(q);
  const desc = clip(`${plain(q.reponse)} ${plain(q.explication || "")}`.trim());
  write(qPath(q), layout({
    title: `${plain(q.question)} – Réponse examen civique`,
    description: desc, path: qPath(q), canonical: qPath(canonicalQ), theme: t.id, jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}
<article>
  <div class="qhead"><div class="eyebrow">Thème ${t.id} · ${typo(t.titre_court)} · question ${q.numero} sur ${qs.length}</div>
  <h1>${typo(q.question)}</h1></div>
  <div class="answer">
    <div class="lbl">Réponse</div>
    <p class="a">${typo(q.reponse)}</p>
    ${det ? `<p class="d">${det}</p>` : ""}
    ${src.length ? `<p class="src">${src.join("<br>")}</p>` : ""}
  </div>
</article>
<div class="cta"><p>Entraînez-vous sur les ${TOTAL} questions : cartes, quiz et examen blanc, gratuit et sans inscription.</p><a class="btn primary" href="${href("/reviser/")}">Réviser</a></div>
<nav class="pager" aria-label="Questions voisines">
  ${prev ? `<a href="${href(qPath(prev))}"><span>‹ Question précédente</span><b>${typo(prev.question)}</b></a>` : "<span></span>"}
  ${next ? `<a class="next" href="${href(qPath(next))}"><span>Question suivante ›</span><b>${typo(next.question)}</b></a>` : "<span></span>"}
</nav>
<section class="block"><h2 style="font-size:21px">Dans le même thème</h2>
<ul class="related">${related.map((r) => `<li><a href="${href(qPath(r))}">${typo(r.question)}</a></li>`).join("")}</ul>
<p><a href="${href(tPath(t))}">Toutes les questions du thème « ${typo(t.titre_court)} » ›</a></p></section>`,
  }));
}

/* ---------- Application de révision ---------- */
function appPage() {
  const cards = questions.map((q) => ({
    t: q.theme, n: q.numero, q: typo(q.question), a: typo(q.reponse), d: detailHtml(q),
    p: q.livret_pages, h: q.reponse_hors_livret, c: typo(q.qcm.bonne), w: q.qcm.mauvaises.map(typo),
    u: href(qPath(q)),
  }));
  const appData = { themes: themes.map((t) => ({ t: t.id, name: typo(t.titre), count: byTheme(t.id).length })), cards };
  const tpl = readFileSync(join(ROOT, "src/app/app.html"), "utf8");
  const title = `Réviser l’examen civique : cartes, quiz et examen blanc | ${NAME}`;
  const desc = `Révisez les ${TOTAL} questions de l’examen civique avec des cartes, des quiz QCM et des examens blancs de 40 questions en 45 minutes. Gratuit, sans inscription.`;
  sitemap.push("/reviser/");
  write("/reviser/", tpl
    .replaceAll("__TITLE__", esc(title))
    .replaceAll("__DESC__", esc(desc))
    .replaceAll("__CANONICAL__", abs("/reviser/"))
    .replaceAll("__NAME__", esc(NAME))
    .replaceAll("__HOME__", href("/"))
    .replaceAll("__QUESTIONS__", href("/questions/"))
    .replaceAll("__ASSETS__", href("/assets"))
    .replace("__DATA__", () => JSON.stringify(appData).replace(/<\//g, "<\\/")));
}

/* ---------- Mentions légales, 404, sitemap ---------- */
function legal() {
  const e = config.editeur;
  const items = [["Accueil", "/"], ["Mentions légales", "/mentions-legales/"]];
  write("/mentions-legales/", layout({
    title: `Mentions légales et confidentialité | ${NAME}`,
    description: `Mentions légales, hébergement et politique de confidentialité du site ${NAME}.`,
    path: "/mentions-legales/", jsonld: [breadcrumbLd(items)],
    body: `${crumbs(items)}<div class="prose">
<h1 style="font-size:clamp(28px,6vw,38px)">Mentions légales et confidentialité</h1>
<h2>Éditeur du site</h2><p>${esc(e.nom)}<br>Contact : ${esc(e.contact)}</p>
<h2>Hébergement</h2><p>${esc(config.hebergeur)}</p>
<h2>Site non officiel</h2><p>${esc(NAME)} est un site indépendant de révision. Il n’est ni édité ni validé par le ministère de l’Intérieur ou par un centre d’examen. Les questions reprennent la liste officielle des questions de connaissance publiée le 12 décembre 2025 ; les réponses sont rédigées par le site d’après le Livret du citoyen (édition mai 2026) et la Charte des droits et devoirs du citoyen français. Malgré le soin apporté, une erreur reste possible : en cas de doute, reportez-vous aux documents officiels.</p>
<h2>Données personnelles</h2><p>Le site ne collecte aucune donnée personnelle, ne dépose aucun cookie et n’utilise aucun outil de mesure d’audience. Votre progression de révision est enregistrée uniquement dans votre navigateur (stockage local), sur votre appareil ; elle n’est jamais envoyée au site. Vous pouvez l’effacer à tout moment depuis la page « Réviser » ou en supprimant les données de navigation.</p>
<h2>Polices de caractères</h2><p>Fraunces et Atkinson Hyperlegible, sous licence SIL Open Font License, hébergées sur ce site.</p>
</div>`,
  }));
  write("/404.html", layout({
    title: `Page introuvable | ${NAME}`, description: "Cette page n’existe pas.", path: "/404.html", index: false,
    body: `<section class="hero"><h1>Page introuvable</h1><p class="lead">Cette adresse ne correspond à aucune page.</p>
<div class="ctas"><a class="btn primary" href="${href("/questions/")}">Voir les ${TOTAL} questions</a><a class="btn" href="${href("/")}">Accueil</a></div></section>`,
  }));
}

/* ---------- Construction ---------- */
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
cpSync(join(ROOT, "src/site/site.css"), join(DIST, "assets/site.css"));
mkdirSync(join(DIST, "data"), { recursive: true });
cpSync(join(ROOT, "data/questions.json"), join(DIST, "data/questions.json"));
home();
questionsIndex();
themes.forEach(themePage);
questions.forEach(questionPage);
appPage();
legal();
writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(sitemap)].map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`);
writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
writeFileSync(join(DIST, ".nojekyll"), "");
console.log(`Site généré dans dist/ : ${new Set(sitemap).size} pages indexables, adresse ${SITE_URL}`);
