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
    onChange: function (f) { listeners.push(f); },
    ask: function (why) { show(why || "", true); },
  };
  window.COQ_ID = ID;
  if (!ON) return;

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
    ".coq-who{font-weight:700;color:#15203B;word-break:break-all}";

  var gate = null, why = "";
  var pdfBtn = function () { return '<a class="coq-btn" href="' + esc(cfg.pdfUrl) + '" download data-coq="pdf">Télécharger le PDF (27 pages)</a>'; };
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
      if (a === "later") { ssSet(K_LATER, "1"); hide(); }
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
    var pdf = why === "pdf";
    gate.innerHTML = '<div class="coq-card" role="dialog" aria-labelledby="coq-t" aria-describedby="coq-d">' +
      '<button class="coq-x" type="button" aria-label="Fermer" data-coq="later">×</button>' +
      '<div class="coq-head"><img src="' + esc(cfg.logo) + '" alt="" width="46" height="46"><div>' +
      '<h2 id="coq-t">' + (pdf ? "Télécharger le livret PDF" : "Bienvenue sur Coq Civique") + '</h2>' +
      '<p id="coq-d">' + (pdf ? "Indiquez votre email : le téléchargement s’affiche aussitôt." : "Indiquez votre email pour garder votre progression et télécharger le livret PDF.") + '</p></div></div>' +
      '<form novalidate><div class="coq-row"><input type="email" autocomplete="email" inputmode="email" placeholder="prenom@exemple.fr" aria-label="Votre adresse email" required>' +
      '<button class="coq-btn" type="submit">Continuer</button></div>' +
      '<label class="coq-check"><input type="checkbox"> Recevoir de temps en temps des nouvelles de Coq Civique (facultatif)</label>' +
      '<p class="coq-err" role="alert" hidden></p>' +
      '<p class="coq-note">Pas de mot de passe : votre progression est liée à cette adresse. <a href="' + esc(cfg.privacyUrl) + '">Confidentialité</a> · <button class="coq-link" type="button" data-coq="later">Plus tard</button></p>' +
      '</form></div>';
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
    if (!a || ID.email()) return;
    ev.preventDefault(); show("pdf", true);
  });

  // À l'arrivée : on demande l'adresse, sauf si elle est connue ou si « Plus tard » a été choisi pendant cette visite.
  if (!ID.email() && !ssGet(K_LATER)) show("", false);
})();
