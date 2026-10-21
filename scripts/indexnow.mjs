// Prévient Bing, Yandex, Seznam, Naver… (protocole IndexNow) des pages nouvelles ou modifiées.
// Lancé par la publication automatique, après la mise en ligne. Usage : node scripts/indexnow.mjs [build-cache/changed-urls.json]
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadJSON } from "./lib.mjs";

const config = loadJSON("site.config.json");
const file = process.argv[2] || join(ROOT, "build-cache/changed-urls.json");
const key = config.indexnow;
if (!key || !existsSync(file)) { console.log("IndexNow : rien à envoyer."); process.exit(0); }
const urls = JSON.parse(readFileSync(file, "utf8"));
if (!urls.length) { console.log("IndexNow : aucune page modifiée."); process.exit(0); }
const site = new URL(config.url);
const own = urls.filter((u) => new URL(u).host === site.host).slice(0, 10000);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: site.host, key, keyLocation: `${site.origin}/${key}.txt`, urlList: own }),
});
console.log(`IndexNow : ${own.length} adresse(s) envoyée(s), réponse ${res.status} ${res.statusText}`);
if (res.status >= 400 && res.status !== 429) process.exitCode = 1;
