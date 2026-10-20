// Client Supabase partagé + formulaire « Télécharger le livret PDF ».
// Actif seulement si site.config.json contient l'adresse et la clé publique Supabase.
(function () {
  "use strict";
  var cfg = window.COQ || {};
  var sb = null;
  try {
    if (cfg.sbUrl && cfg.sbKey && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(cfg.sbUrl, cfg.sbKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
  } catch (e) { sb = null; }
  window.COQ_SB = sb;

  var box = document.querySelector("[data-pdf]");
  if (!box) return;
  if (!sb) { box.hidden = true; return; }
  box.hidden = false;

  var KEY = "coq:pdf-ok";
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var dl = '<a class="btn primary" href="' + esc(cfg.pdfUrl) + '" download>Télécharger le PDF (27 pages)</a>';

  function done() {
    box.querySelector(".pdf-body").innerHTML = '<p class="pdf-ok">Merci ! Votre livret est prêt.</p>' + dl;
  }
  function form(email) {
    box.querySelector(".pdf-body").innerHTML =
      '<form class="pdf-form" novalidate>' +
      '<label for="pdf-email">Votre adresse email</label>' +
      '<div class="pdf-row"><input id="pdf-email" type="email" autocomplete="email" required placeholder="prenom@exemple.fr" value="' + esc(email || "") + '">' +
      '<button class="btn primary" type="submit">Recevoir le PDF</button></div>' +
      '<label class="pdf-check"><input id="pdf-news" type="checkbox"> J’accepte de recevoir de temps en temps des nouvelles de Coq Civique (facultatif, désinscription à tout moment).</label>' +
      '<p class="pdf-note">Votre adresse sert à vous donner accès au livret' + ' et, seulement si vous cochez la case, à vous envoyer des nouvelles. <a href="' + esc(cfg.privacyUrl) + '">Confidentialité</a></p>' +
      '<p class="pdf-err" role="alert" hidden></p></form>';
    var f = box.querySelector("form");
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = f.querySelector("#pdf-email"), err = f.querySelector(".pdf-err"), btn = f.querySelector("button");
      var value = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) || value.length > 254) {
        err.textContent = "Cette adresse email ne semble pas valide. Vérifiez-la et réessayez.";
        err.hidden = false; input.focus(); return;
      }
      err.hidden = true; btn.disabled = true; btn.textContent = "Un instant…";
      sb.from("pdf_downloads").insert({ email: value.toLowerCase(), newsletter: f.querySelector("#pdf-news").checked, page: location.pathname.slice(0, 200) })
        .then(function (res) {
          if (res.error) throw res.error;
          try { localStorage.setItem(KEY, "1"); } catch (e) {}
          done();
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Recevoir le PDF";
          err.textContent = "L’enregistrement n’a pas fonctionné. Vérifiez votre connexion et réessayez dans un instant.";
          err.hidden = false;
        });
    });
  }

  var ok = false;
  try { ok = localStorage.getItem(KEY) === "1"; } catch (e) {}
  if (ok) { done(); return; }
  form("");
  sb.auth.getSession().then(function (r) {
    var s = r && r.data && r.data.session;
    if (s && s.user) done(); // compte connecté : l'email est déjà connu

  }).catch(function () {});
})();
