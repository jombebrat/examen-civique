// Coq Civique : application installable (service worker) et invitation à l'installer.
// iPhone / iPad : instructions « Partager → Sur l'écran d'accueil ». Android / ordinateur : bouton « Installer ».
(function () {
  "use strict";
  var cfg = window.COQ_PWA || {};
  if ("serviceWorker" in navigator && cfg.sw) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(cfg.sw, { scope: cfg.scope || "/" }).catch(function () {});
    });
  }
  var K_LATER = "coq:install-plus-tard", K_VIEWS = "coq:vues";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var deferred = null;
  window.COQ_INSTALL = { standalone: standalone, ios: ios, available: function () { return !!deferred; }, prompt: prompt };

  var SHARE = '<svg class="coq-share" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Partager"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  var CSS = ".coq-inst{position:fixed;left:0;right:0;bottom:0;z-index:55;display:flex;justify-content:center;padding:0 10px calc(10px + env(safe-area-inset-bottom));pointer-events:none}" +
    ".coq-inst>div{pointer-events:auto;position:relative;display:flex;gap:12px;align-items:center;width:100%;max-width:520px;background:#fff;color:#15203B;border:1px solid #DADFE9;border-radius:18px;box-shadow:0 14px 44px rgba(12,18,32,.28);padding:12px 44px 12px 12px;font-size:14.5px;line-height:1.4;animation:coq-up2 .35s ease-out}" +
    "@keyframes coq-up2{from{transform:translateY(130%)}to{transform:none}}@media (prefers-reduced-motion: reduce){.coq-inst>div{animation:none}}" +
    ".coq-inst img{width:44px;height:44px;border-radius:11px;flex:none}" +
    ".coq-inst b{display:block;font-size:15px}" +
    ".coq-inst a{color:#1F4E9C;font-weight:700}" +
    ".coq-inst .coq-share{vertical-align:-3px;color:#1F4E9C}" +
    ".coq-inst button.go{margin-left:auto;flex:none;min-height:40px;padding:8px 14px;border-radius:11px;border:0;background:#1F4E9C;color:#fff;font:inherit;font-weight:700;cursor:pointer}" +
    ".coq-inst button.x{position:absolute;top:6px;right:6px;width:34px;height:34px;border:0;border-radius:10px;background:transparent;color:#56607A;font-size:22px;line-height:1;cursor:pointer}";
  var box = null;
  function hide(later) { if (box) { box.remove(); box = null; } if (later) lsSet(K_LATER, String(Date.now())); }
  function show(html) {
    if (box || standalone) return;
    var gate = document.querySelector(".coq-gate:not([hidden])");
    if (gate) return; // ne pas superposer à la fenêtre « email »
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    box = document.createElement("div"); box.className = "coq-inst"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Installer l’application");
    box.innerHTML = '<div><img src="' + (cfg.icon || "") + '" alt="">' + html + '<button class="x" type="button" aria-label="Fermer">×</button></div>';
    document.body.appendChild(box);
    box.querySelector(".x").addEventListener("click", function () { hide(true); });
    var go = box.querySelector(".go"); if (go) go.addEventListener("click", function () { prompt(); });
  }
  function prompt() {
    if (!deferred) { if (cfg.guide) location.href = cfg.guide; return Promise.resolve(false); }
    deferred.prompt();
    return deferred.userChoice.then(function (c) { deferred = null; hide(c && c.outcome !== "accepted"); return c && c.outcome === "accepted"; }).catch(function () { return false; });
  }
  function eligible() {
    if (standalone) return false;
    var later = +lsGet(K_LATER) || 0;
    if (Date.now() - later < 14 * 864e5) return false;
    var views = (+lsGet(K_VIEWS) || 0) + 1; lsSet(K_VIEWS, String(views));
    var onApp = cfg.app && location.pathname.indexOf(cfg.app) === 0;
    return onApp || views >= 2;
  }
  var ok = eligible();
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    document.querySelectorAll("[data-install]").forEach(function (b) { b.hidden = false; });
    if (ok) setTimeout(function () {
      show('<span><b>Révisez même sans internet</b>Installez l’application gratuite : un geste, et Coq Civique est sur votre téléphone.</span><button class="go" type="button">Installer</button>');
    }, 2500);
  });
  window.addEventListener("appinstalled", function () { hide(false); });
  if (ok && ios) setTimeout(function () {
    show('<span><b>Révisez même sans internet</b>Installez l’application : touchez ' + SHARE + ' en bas de l’écran, puis «\u00a0Sur l’écran d’accueil\u00a0». <a href="' + (cfg.guide || "#") + '">Voir comment\u00a0›</a></span>');
  }, 3500);

  // Boutons « Installer » de la page d'aide
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-install]");
    if (!b) return;
    ev.preventDefault();
    if (deferred) { prompt(); return; }
    var t = document.getElementById(ios ? "iphone" : "android"); if (t) t.scrollIntoView({ behavior: "smooth" });
  });
  if (standalone) document.documentElement.classList.add("is-app");
})();
