// Prévient Bing, Yandex, Seznam, Naver… (protocole IndexNow) des pages nouvelles ou modifiées.
// Lancé par la publication automatique, après la mise en ligne. Usage : node scripts/indexnow.mjs [build-cache/changed-urls.json]
// INDEXNOW_ALL=1 : envoie toutes les adresses du sitemap en ligne (lancement manuel de la publication, option « tout »).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadJSON } from "./lib.mjs";

const config = loadJSON("site.config.json");
const key = config.indexnow;
const site = new URL(config.url);
if (!key) { console.log("IndexNow : pas de clé dans site.config.json."); process.exit(0); }

let urls = [];
if (process.env.INDEXNOW_ALL === "1") {
  const xml = await (await fetch(`${site.origin}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} else {
  const file = process.argv[2] || join(ROOT, "build-cache/changed-urls.json");
  if (existsSync(file)) urls = JSON.parse(readFileSync(file, "utf8"));
}
urls = urls.filter((u) => new URL(u).host === site.host).slice(0, 10000);
if (!urls.length) { console.log("IndexNow : aucune page nouvelle ou modifiée."); process.exit(0); }

// La clé doit être en ligne avant l'envoi
const keyUrl = `${site.origin}/${key}.txt`;
for (let i = 0; i < 6; i++) {
  const r = await fetch(keyUrl, { cache: "no-store" }).catch(() => null);
  if (r && r.ok && (await r.text()).trim() === key) break;
  console.log("IndexNow : clé pas encore en ligne, nouvel essai dans 20 s…");
  await new Promise((ok) => setTimeout(ok, 20000));
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: site.host, key, keyLocation: keyUrl, urlList: urls }),
});
const body = (await res.text()).slice(0, 500);
console.log(`IndexNow : ${urls.length} adresse(s) envoyée(s), réponse ${res.status} ${res.statusText} ${body}`);
// 200 : reçu ; 202 : reçu, clé en cours de vérification
if (res.status >= 400) console.log(`::warning::IndexNow a répondu ${res.status} ${res.statusText} ${body}`);
