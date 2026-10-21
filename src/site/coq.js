// Coq Civique : adresse email du visiteur, progression liée à cette adresse, livret PDF.
// Pas de mot de passe ni de code : l'adresse sert d'identifiant. Appels directs à Supabase
// (fonctions coq_open et coq_save), sans bibliothèque.
(function () {
  "use strict";
  var cfg = window.COQ || {};
  var ON = !!(cfg.sbUrl && cfg.sbKey);
  var K_EMAIL = "coq:email", K_LATER = "coq:plus-tard";
  var RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function rpc(name, args) {
    var body = JSON.stringify(args);
    return fetch(cfg.sbUrl + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { "apikey": cfg.sbKey, "Content-Type": "application/json" },
      body: body,
      keepalive: body.length < 60000,
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  var listeners = [];
  function notify() { listeners.forEach(function (f) { try { f(ID.email()); } catch (e) {} }); }

  var ID = {
    enabled: ON,
    email: function () { return ON ? (lsGet(K_EMAIL) || "") : ""; },
    valid: function (e) { return RE.test(e) && e.length <= 254; },
    open: function (email, newsletter) {
      email = String(email || "").trim().toLowerCase();
      if (!ID.valid(email)) return Promise.reject(new Error("invalid"));
      return rpc("coq_open", { p_email: email, p_newsletter: !!newsletter, p_page: location.pathname.slice(0, 200) })
        .then(function (d) { lsSet(K_EMAIL, email); notify(); return d || {}; });
    },
    load: function () {
      var e = ID.email();
      if (!e) return Promise.resolve({});
      return rpc("coq_open", { p_email: e, p_newsletter: false, p_page: null }).then(function (d) { return d || {}; });
    },
    save: function (data) {
      var e = ID.email();
      if (!e) return Promise.resolve();
      return rpc("coq_save", { p_email: e, p_data: data });
    },
    forget: function () { lsSet(K_EMAIL, null); notify(); },
    report: function (r) { return rpc("coq_resultat", { p_liste: r.liste, p_reussi: !!r.reussi, p_score: r.score == null ? null : r.score, p_prenom: r.prenom || null, p_temoignage: r.temoignage || null, p_publication: !!r.publication }); },
    stats: function () { return rpc("coq_chiffres", {}); },
    // Compteur anonyme d'usage (PDF fait, leçon finie, réponse au quiz de l'accueil) : un nom, un compteur par jour, rien d'autre
    event: function (name) {
      if (!ON || !name) return Promise.resolve();
      return rpc("coq_vue", { p_path: "/~/" + String(name).replace(/[^a-z0-9-]/gi, "").slice(0, 60), p_ref: "" }).catch(function () {});
    },
    onChange: function (f) { listeners.push(f); },
    ask: function (why) { show(why || "", true); },
  };
  window.COQ_ID = ID;
  if (!ON) return;

  // Liens marqués data-ev (téléchargements de PDF) : un compteur anonyme par clic
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("[data-ev]");
    if (t) ID.event(t.getAttribute("data-ev"));
  });

  /* Mesure d'audience anonyme : page vue + site d'origine (aucune donnée personnelle, aucun cookie) */
  try {
    var ref = "";
    if (document.referrer) { var rh = new URL(document.referrer).hostname; if (rh && rh !== location.hostname) ref = rh.replace(/^www\./, ""); }
    rpc("coq_vue", { p_path: location.pathname.slice(0, 200), p_ref: ref.slice(0, 100) }).catch(function () {});
  } catch (e) {}

  /* Chiffres réels et témoignages validés (affichés seulement à partir d'un seuil) */
  var proof = document.querySelector("[data-chiffres]"), tem = document.querySelector("[data-temoignages]");
  if (proof || tem) ID.stats().then(function (c) {
    if (!c) return;
    var fr = function (n) { return Number(n).toLocaleString("fr-FR"); };
    if (proof && c.inscrits >= 50) {
      var t = "Déjà " + fr(c.inscrits) + " personnes révisent avec Coq Civique";
      if (c.resultats >= 20) t += " · " + Math.round(100 * c.reussites / c.resultats) + " % de réussite parmi les " + fr(c.resultats) + " résultats qui nous ont été communiqués";
      proof.textContent = t + "."; proof.hidden = false;
    }
    if (tem && c.temoignages && c.temoignages.length) {
      var L = { nat: "Naturalisation", cr: "Carte de résident", csp: "Carte de séjour pluriannuelle" };
      tem.querySelector(".tlist").innerHTML = c.temoignages.map(function (x) {
        return '<figure class="tcard"><blockquote>« ' + esc(x.texte) + ' »</blockquote><figcaption><b>' + esc(x.prenom || "Anonyme") + '</b>' + (x.score != null ? " · " + esc(x.score) + "/40" : "") + (L[x.liste] ? " · " + L[x.liste] : "") + '</figcaption></figure>';
      }).join("");
      tem.hidden = false;
    }
  }).catch(function () {});

  /* Adresse email : détection des fautes de frappe fréquentes (gmial.com → gmail.com) */
  var DOMS = ["gmail.com", "hotmail.com", "hotmail.fr", "yahoo.com", "yahoo.fr", "outlook.com", "outlook.fr", "live.fr", "icloud.com", "orange.fr", "free.fr", "sfr.fr", "laposte.net", "wanadoo.fr", "gmx.fr", "proton.me"];
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; } for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function suggest(email) {
    var at = email.lastIndexOf("@"); if (at < 1) return null;
    var dom = email.slice(at + 1); if (DOMS.indexOf(dom) >= 0) return null;
    var best = null, bd = 3;
    DOMS.forEach(function (x) { var v = lev(dom, x); if (v < bd) { bd = v; best = x; } });
    return best && bd <= 2 ? email.slice(0, at + 1) + best : null;
  }

  /* ---------- Fenêtre « votre email » ---------- */
  var CSS = "" +
    ".coq-gate{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;justify-content:center;padding:0 10px calc(10px + env(safe-area-inset-bottom));pointer-events:none}" +
    ".coq-gate[hidden]{display:none}" +
    ".coq-card{pointer-events:auto;position:relative;width:100%;max-width:520px;background:#fff;color:#15203B;border:1px solid #DADFE9;border-radius:20px;box-shadow:0 14px 44px rgba(12,18,32,.30);padding:16px 16px 12px;animation:coq-up .35s ease-out;font-size:15px;line-height:1.45}" +
    "@keyframes coq-up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}" +
    "@media (prefers-reduced-motion: reduce){.coq-card{animation:none}}" +
    ".coq-head{display:flex;gap:12px;align-items:center;padding-right:28px}" +
    ".coq-head img{width:46px;height:46px;border-radius:12px;flex:none}" +
    ".coq-card h2{font-family:Fraunces,Georgia,serif;font-weight:800;font-size:19px;line-height:1.15;margin:0;color:#15203B}" +
    ".coq-card p{margin:2px 0 0;color:#56607A}" +
    ".coq-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}" +
    ".coq-row input{flex:1 1 190px;min-width:0;min-height:48px;padding:10px 12px;border-radius:12px;border:1.5px solid #C9D0DE;background:#fff;color:#15203B;font:inherit;font-size:16px}" +
    ".coq-row input:focus{outline:2.5px solid #1F4E9C;outline-offset:1px;border-color:#1F4E9C}" +
    ".coq-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 18px;border-radius:12px;border:1.5px solid #1F4E9C;background:#1F4E9C;color:#fff;font:inherit;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer}" +
    ".coq-btn.alt{background:#fff;color:#15203B;border-color:#DADFE9}" +
    ".coq-btn[disabled]{opacity:.6;cursor:default}" +
    ".coq-check{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:13.5px;color:#56607A;cursor:pointer}" +
    ".coq-check input{margin-top:3px;width:17px;height:17px;flex:none;accent-color:#1F4E9C}" +
    ".coq-err{color:#B00020;font-weight:700;font-size:14px;margin-top:8px!important}" +
    ".coq-note{font-size:12.5px;margin-top:8px!important}" +
    ".coq-note a{color:#1F4E9C}" +
    ".coq-link{background:none;border:0;padding:0;color:#56607A;text-decoration:underline;text-underline-offset:3px;font:inherit;cursor:pointer}" +
    ".coq-x{position:absolute;top:8px;right:8px;width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:#56607A;font-size:24px;line-height:1;cursor:pointer}" +
    ".coq-x:hover{background:#EDF0F6}" +
    ".coq-who{font-weight:700;color:#15203B;word-break:break-all}" +
    ".coq-or{margin-top:12px;padding-top:12px;border-top:1px solid #E2E6EE}";

  var gate = null, why = "";
  var pending = null; // livret demandé avant l'email
  var PDFS = cfg.pdfs && cfg.pdfs.length ? cfg.pdfs : [{ nom: "Livret", url: cfg.pdfUrl, pages: 27 }];
  var pdfBtn = function () {
    var path = function (u) { try { return new URL(u, location.href).pathname; } catch (e) { return u; } };
    var want = pending ? PDFS.filter(function (x) { return path(x.url) === path(pending); }) : [];
    var list = want.length ? want : PDFS;
    return list.map(function (x, i) {
      return '<a class="coq-btn' + (list.length > 1 && i ? " alt" : "") + '" href="' + esc(x.url) + '" download data-coq="pdf" data-ev="livret-' + esc(x.code || "nat") + '">' + (list.length > 1 ? "PDF " + esc(x.nom) : "Télécharger le PDF « " + esc(x.nom) + " » (" + x.pages + " pages)") + '</a>';
    }).join("");
  };
  var onApp = cfg.reviser && location.pathname.indexOf(cfg.reviser) === 0;

  function pad() {
    if (!gate || gate.hidden) { document.body.style.paddingBottom = ""; return; }
    document.body.style.paddingBottom = (gate.firstChild.offsetHeight + 20) + "px";
  }
  function build() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    gate = document.createElement("div"); gate.className = "coq-gate"; gate.hidden = true;
    document.body.appendChild(gate);
    gate.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-coq]"); if (!t) return;
      var a = t.getAttribute("data-coq");
      if (a === "later" || a === "nomail") { ssSet(K_LATER, "1"); hide(); }
      if (a === "go") ssSet(K_LATER, "1");
      if (a === "close") hide();
    });
    gate.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target, input = f.querySelector("input[type=email]"), err = f.querySelector(".coq-err"), btn = f.querySelector("button[type=submit]");
      var value = input.value.trim().toLowerCase();
      if (!ID.valid(value)) {
        err.textContent = "Cette adresse email ne semble pas valide. Vérifiez-la et réessayez.";
        err.hidden = false; input.focus(); pad(); return;
      }
      var sug = suggest(value);
      if (sug && f.getAttribute("data-checked") !== value) {
        f.setAttribute("data-checked", value);
        err.innerHTML = "Vouliez-vous dire <b>" + esc(sug) + "</b> ? <button type=\"button\" class=\"coq-link\" data-fix=\"" + esc(sug) + "\">Oui, corriger</button> · <button type=\"submit\" class=\"coq-link\">Non, continuer</button>";
        err.hidden = false; pad();
        var fx = err.querySelector("[data-fix]"); if (fx) fx.addEventListener("click", function () { input.value = sug; f.setAttribute("data-checked", sug); err.hidden = true; pad(); input.focus(); });
        return;
      }
      err.hidden = true; btn.disabled = true; btn.textContent = "Un instant…";
      ID.open(value, f.querySelector("input[type=checkbox]").checked)
        .then(function () { renderDone(); })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Continuer";
          err.textContent = "L’enregistrement n’a pas fonctionné. Vérifiez votre connexion et réessayez.";
          err.hidden = false; pad();
        });
    });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && gate && !gate.hidden) { ssSet(K_LATER, "1"); hide(); } });
    window.addEventListener("resize", pad);
  }
  function renderForm() {
    var pdf = why === "pdf", save = why === "save";
    gate.innerHTML = '<div class="coq-card" role="dialog" aria-labelledby="coq-t" aria-describedby="coq-d">' +
      '<button class="coq-x" type="button" aria-label="Fermer" data-coq="later">×</button>' +
      '<div class="coq-head"><img src="' + esc(cfg.logo) + '" alt="" width="46" height="46"><div>' +
      '<h2 id="coq-t">' + (pdf ? "Télécharger le livret PDF" : save ? "Gardez votre progression" : "Bienvenue sur Coq Civique") + '</h2>' +
      '<p id="coq-d">' + (pdf ? "Gratuit et sans inscription. Si vous le souhaitez, indiquez votre email : votre progression dans l’application sera gardée sur tous vos appareils." : save ? "Indiquez votre email, sans mot de passe : ce que vous avez déjà appris est conservé et vous le retrouvez sur tous vos appareils." : "Indiquez votre email pour garder votre progression sur tous vos appareils.") + '</p></div></div>' +
      '<form novalidate><div class="coq-row"><input type="email" autocomplete="email" inputmode="email" placeholder="prenom@exemple.fr" aria-label="Votre adresse email" required>' +
      '<button class="coq-btn" type="submit">Continuer</button></div>' +
      '<label class="coq-check"><input type="checkbox"> Recevoir de temps en temps des nouvelles de Coq Civique (facultatif)</label>' +
      '<p class="coq-err" role="alert" hidden></p>' +
      '<p class="coq-note">Pas de mot de passe : votre progression est liée à cette adresse. <a href="' + esc(cfg.privacyUrl) + '">Confidentialité</a>' + (pdf ? '' : ' · <button class="coq-link" type="button" data-coq="later">Plus tard</button>') + '</p>' +
      '</form>' +
      (pdf && pending ? '<div class="coq-row coq-or"><a class="coq-btn alt" href="' + esc(pending) + '" download data-coq="nomail" data-ev="livret-sans-email">Télécharger sans email</a></div>' : '') +
      '</div>';
  }
  function renderDone() {
    gate.innerHTML = '<div class="coq-card" role="dialog" aria-labelledby="coq-t">' +
      '<button class="coq-x" type="button" aria-label="Fermer" data-coq="close">×</button>' +
      '<div class="coq-head"><img src="' + esc(cfg.logo) + '" alt="" width="46" height="46"><div>' +
      '<h2 id="coq-t">C’est noté !</h2><p>Votre progression est liée à <span class="coq-who">' + esc(ID.email()) + '</span>.</p></div></div>' +
      '<div class="coq-row">' + pdfBtn() +
      (onApp ? '<button class="coq-btn alt" type="button" data-coq="close">Continuer</button>' : '<a class="coq-btn alt" href="' + esc(cfg.reviser) + '">Réviser</a>') +
      '</div></div>';
    var b = gate.querySelector("[data-coq=pdf]"); if (b) b.focus();
    pad();
  }
  function show(reason, focus) {
    why = reason;
    if (!gate) build();
    if (ID.email()) renderDone(); else renderForm();
    gate.hidden = false; pad();
    if (focus) { var i = gate.querySelector("input[type=email]"); if (i) i.focus(); }
  }
  function hide() { if (gate) { gate.hidden = true; pad(); } }

  // Liens vers le PDF : sans adresse enregistrée, on la demande d'abord.
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("[data-pdf-link]");
    if (a && ID.email()) ID.event("livret-direct");
    if (!a || ID.email()) return;
    ev.preventDefault(); pending = a.getAttribute("href"); show("pdf", true);
  });

  /* À l'arrivée sur une page du site (souvent depuis Google) : une invitation à apprendre, pas une demande d'email.
     Elle apparaît une fois la réponse lue (quelques secondes ou en faisant défiler la page), en bas de l'écran.
     L'adresse est demandée pour le PDF, et à la fin d'une leçon pour garder la progression. */
  function hasProgress() {
    try { var p = JSON.parse(localStorage.getItem("civique259:v1") || "null"); return !!(p && p.cards && Object.keys(p.cards).length); } catch (e) { return false; }
  }
  function renderInvite() {
    var el = document.querySelector("[data-lecon]");
    var url = el ? el.getAttribute("data-lecon") : cfg.reviser, label = el ? el.getAttribute("data-lecon-label") : "";
    gate.innerHTML = '<div class="coq-card" role="dialog" aria-labelledby="coq-t" aria-describedby="coq-d">' +
      '<button class="coq-x" type="button" aria-label="Fermer" data-coq="later">×</button>' +
      '<div class="coq-head"><img src="' + esc(cfg.mascot || cfg.logo) + '" alt="" width="46" height="46"><div>' +
      '<h2 id="coq-t">' + (label ? "Apprenez-la pour de bon" : "Apprenez l’examen civique, 5 minutes par jour") + '</h2>' +
      '<p id="coq-d">' + (label ? "Elle fait partie de la " + esc(label) + ". Apprenez-la avec Coq Civique, l’appli gratuite : des leçons courtes, puis un quiz." : "Coq Civique, c’est l’appli gratuite pour apprendre pas à pas : des leçons courtes sur les questions officielles, un quiz après chaque leçon et des examens blancs.") + '</p></div></div>' +
      '<div class="coq-row"><a class="coq-btn" href="' + esc(url) + '" data-coq="go">' + (label ? "Commencer cette leçon" : "Commencer à apprendre") + '</a>' +
      '<button class="coq-btn alt" type="button" data-coq="later">Plus tard</button></div>' +
      '<p class="coq-note">Gratuit, sans inscription ni mot de passe.</p></div>';
  }
  function invite() {
    if (!gate) build();
    if (!gate.hidden) return;
    renderInvite(); gate.hidden = false; pad();
  }
  if (!onApp && !ID.email() && !ssGet(K_LATER) && !hasProgress()) {
    var invited = false, go = function () {
      if (invited) return; invited = true;
      window.removeEventListener("scroll", onScroll);
      invite();
    };
    var onScroll = function () { if (window.scrollY > Math.min(600, document.documentElement.scrollHeight * 0.25)) go(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    setTimeout(go, 7000);
  }
})();
