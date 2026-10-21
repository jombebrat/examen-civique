/* Coq Civique : sujets d'examen civique de 40 questions en PDF, fabriqués dans le navigateur (jsPDF).
   Le même fichier sert à la page /examen-civique-40-questions-pdf/ et à tools/examen40/exemples.mjs (sujets d'exemple).
   Format : 28 questions de connaissance de la liste choisie (réparties selon le poids de chaque thème) + 12 mises en situation,
   comme l'examen blanc de l'application. Un sujet est défini par sa liste et son numéro (ex. NAT-4821) : même numéro, même sujet. */
(function (root) {
  "use strict";
  var N = 40, PASS = 32, MINUTES = 45, SIT_PER_THEME = [3, 2, 3, 1, 3], LETTERS = ["A", "B", "C", "D"];

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedOf(code, num) {
    var h = 2166136261, s = code + "-" + num;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffle(arr, r) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }

  /* data (data/examen40.json) : { themes: [{t}], lists: {code: {nom, q: [[id, thème, numéro, texte?]]}}, q: {id: [question, bonne, [mauvaises], url]}, s: [[id, thème, situation, question, bonne, [mauvaises], url]] } */
  function build(data, code, num) {
    var L = data.lists[code];
    if (!L) throw new Error("Liste inconnue : " + code);
    var r = rng(seedOf(code, num));
    var cards = L.q.map(function (e) { var b = data.q[e[0]]; return { t: e[1], q: e[3] || b[0], c: b[1], w: b[2], u: b[3], sit: false }; });
    var sits = data.s.map(function (x) { return { t: x[1], s: x[2], q: x[3], c: x[4], w: x[5], u: x[6], sit: true }; });
    var sitN = SIT_PER_THEME.reduce(function (a, b) { return a + b; }, 0), know = N - sitN, total = cards.length;
    var quotas = data.themes.map(function (t) {
      var n = cards.filter(function (c) { return c.t === t.t; }).length, q = know * n / total;
      return { t: t.t, n: Math.floor(q), r: q - Math.floor(q) };
    });
    var left = know - quotas.reduce(function (s, q) { return s + q.n; }, 0);
    quotas.slice().sort(function (a, b) { return b.r - a.r; }).forEach(function (q) { if (left > 0) { q.n++; left--; } });
    var picked = [];
    quotas.forEach(function (q) { picked = picked.concat(shuffle(cards.filter(function (c) { return c.t === q.t; }), r).slice(0, q.n)); });
    data.themes.forEach(function (t, i) { picked = picked.concat(shuffle(sits.filter(function (c) { return c.t === t.t; }), r).slice(0, SIT_PER_THEME[i] || 0)); });
    var items = shuffle(picked, r).map(function (c) {
      var opts = shuffle([{ h: c.c, ok: true }].concat(c.w.map(function (h) { return { h: h, ok: false }; })), r), good = 0;
      opts.forEach(function (o, i) { if (o.ok) good = i; });
      return { sit: c.sit, s: c.s || "", q: c.q, opts: opts.map(function (o) { return o.h; }), good: good, c: c.c, u: c.u };
    });
    return { code: code, num: num, id: code.toUpperCase() + "-" + num, nom: L.nom, items: items };
  }

  /* Mise en page A4. o : { site, key (corrigé, oui par défaut), date (date fixe pour les exemples), fileId } */
  function render(JsPDF, ex, o) {
    o = o || {};
    var doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
    var W = 210, H = 297, M = 17, CW = W - 2 * M, TOP = 18, BOTTOM = 20;
    var BLUE = [31, 78, 156], INK = [24, 29, 40], MUTED = [92, 100, 117], LINE = [205, 212, 226], SOFT = [238, 242, 250], GOOD = [21, 115, 60];
    var site = (o.site || "https://coqcivique.com/").replace(/\/?$/, "/"), host = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
    var y = TOP;
    doc.setProperties({
      title: "Examen civique : sujet de 40 questions " + ex.id + " (" + ex.nom + ")",
      subject: "Sujet d’entraînement gratuit à l’examen civique, avec corrigé",
      author: "Coq Civique", keywords: "examen civique, 40 questions, PDF gratuit, examen blanc, " + ex.nom, creator: host,
    });
    if (o.date) doc.setCreationDate(o.date);
    if (o.fileId) doc.setFileId(o.fileId);
    doc.setLineHeightFactor(1.22);

    function col(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function font(style, size) { doc.setFont("helvetica", style); doc.setFontSize(size); }
    function lh(size) { return size * 0.3528 * 1.22; }
    function split(text, style, size, width) { font(style, size); return doc.splitTextToSize(text, width); }
    function text(t, x, yy, style, size, c, opt) { font(style, size); col(c || INK); doc.text(t, x, yy, opt || { baseline: "top" }); }
    function newPage() { doc.addPage(); y = TOP; }

    /* Bandeau tricolore en haut de chaque page */
    function flag() {
      doc.setFillColor(0, 85, 164); doc.rect(0, 0, W / 3, 2.2, "F");
      doc.setFillColor(226, 230, 238); doc.rect(W / 3, 0, W / 3, 2.2, "F");
      doc.setFillColor(225, 0, 15); doc.rect(2 * W / 3, 0, W / 3, 2.2, "F");
    }
    /* En-tête de la première page : logo, nom, adresse du site et pastille « gratuit » */
    var LOGO = 17;
    if (o.logo) doc.addImage(o.logo, "JPEG", M, 9, LOGO, LOGO, "logo");
    var bx = o.logo ? M + LOGO + 4 : M;
    text("Coq Civique", bx, 10.5, "bold", 17, BLUE);
    text("L’appli gratuite pour apprendre l’examen civique", bx, 18, "normal", 9.5, INK);
    text(host, bx, 22.4, "bold", 9.5, BLUE);
    font("bold", 9); var badge = "GRATUIT · SANS INSCRIPTION", bw = doc.getTextWidth(badge) + 8;
    doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]); doc.roundedRect(W - M - bw, 12, bw, 7, 3.5, 3.5, "F");
    doc.setTextColor(255, 255, 255); doc.text(badge, W - M - bw / 2, 15.5, { align: "center", baseline: "middle" });
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.3); doc.line(M, 30, W - M, 30);
    y = 35;
    text("Examen civique : sujet de 40 questions", M, y, "bold", 19, INK); y += 9;
    text(ex.nom + " · Sujet n° " + ex.id, M, y, "bold", 12, BLUE); y += 8;
    var rules = [
      "40 questions comme à l’examen : 28 questions de connaissance de la liste officielle « " + ex.nom + " » et 12 mises en situation.",
      MINUTES + " minutes. Une seule bonne réponse par question : cochez sa case. Une question sans réponse compte comme une erreur.",
      "Réussite à partir de " + PASS + " bonnes réponses sur " + N + "." + (o.key === false ? "" : " Le corrigé est à la fin du document."),
    ];
    var ruleLines = rules.map(function (r) { return split(r, "normal", 9.5, CW - 12); });
    var boxH = 6 + ruleLines.reduce(function (s, l) { return s + l.length * lh(9.5) + 1.2; }, 0);
    doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]); doc.roundedRect(M, y, CW, boxH, 2, 2, "F");
    var ry = y + 3.2;
    ruleLines.forEach(function (l) {
      doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]); doc.circle(M + 4.5, ry + 1.6, 0.7, "F");
      text(l, M + 8, ry, "normal", 9.5, INK); ry += l.length * lh(9.5) + 1.2;
    });
    y += boxH + 6;
    font("normal", 10); col(INK);
    var fields = [["Nom :", 62], ["Date :", 36], ["Score :", 22]], fx = M;
    fields.forEach(function (f, i) {
      doc.text(f[0], fx, y, { baseline: "top" });
      var tw = doc.getTextWidth(f[0]) + 2;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.3); doc.line(fx + tw, y + 4, fx + tw + f[1], y + 4);
      fx += tw + f[1] + 6;
      if (i === 2) doc.text("/ " + N, fx - 4, y, { baseline: "top" });
    });
    y += 11;

    /* Questions : chaque bloc est mesuré avant d'être dessiné, pour ne jamais être coupé entre deux pages */
    var X = M + 9, QW = CW - 9;
    function block(it, i, draw) {
      var yy = y, h = 0;
      if (draw) text((i + 1) + ".", M, yy, "bold", 11, BLUE);
      if (it.sit) {
        if (draw) text("MISE EN SITUATION", X, yy + 0.4, "bold", 7.5, MUTED);
        h += 4.2;
        var sl = split(it.s, "italic", 10.5, QW);
        if (draw) text(sl, X, yy + h, "italic", 10.5, INK);
        h += sl.length * lh(10.5) + 1;
      }
      var ql = split(it.q, "bold", 10.5, QW);
      if (draw) text(ql, X, yy + h, "bold", 10.5, INK);
      h += ql.length * lh(10.5) + 1.8;
      it.opts.forEach(function (op, k) {
        var ol = split(LETTERS[k] + ".  " + op, "normal", 10.5, QW - 7);
        if (draw) {
          doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2]); doc.setLineWidth(0.35); doc.rect(X, yy + h + 0.3, 3.6, 3.6);
          text(ol, X + 6.5, yy + h, "normal", 10.5, INK);
        }
        h += Math.max(ol.length * lh(10.5), 4.4) + 1.3;
      });
      return h + 4.2;
    }
    ex.items.forEach(function (it, i) {
      var h = block(it, i, false);
      if (y + h > H - BOTTOM) newPage();
      block(it, i, true);
      y += h;
    });

    /* Corrigé */
    if (o.key !== false) {
      newPage();
      text("Corrigé du sujet " + ex.id, M, y, "bold", 17, INK); y += 8;
      text("Comptez un point par bonne réponse. Réussite à partir de " + PASS + " sur " + N + ".", M, y, "normal", 10, MUTED); y += 8;
      var cw = CW / 10, ch = 11;
      ex.items.forEach(function (it, i) {
        var cx = M + (i % 10) * cw, cy = y + Math.floor(i / 10) * ch;
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.25); doc.rect(cx, cy, cw, ch);
        text(String(i + 1), cx + 1.6, cy + 1.3, "normal", 7.5, MUTED);
        text(LETTERS[it.good], cx + cw / 2, cy + 3.2, "bold", 13, GOOD, { align: "center", baseline: "top" });
      });
      y += 4 * ch + 6;
      text("Mon score :", M, y, "bold", 11, INK);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.3); doc.line(M + 25, y + 4.5, M + 45, y + 4.5);
      text("/ " + N + "     " + PASS + " ou plus : réussi. Visez au moins 35 pour avoir de la marge le jour de l’examen.", M + 47, y, "normal", 10, INK);
      y += 11;
      text("Les bonnes réponses", M, y, "bold", 12, INK); y += 7;
      var AW = CW - 30;
      ex.items.forEach(function (it, i) {
        var al = split(it.c, "normal", 9.5, AW - 13);
        var h = Math.max(al.length * lh(9.5), 4) + 1.6;
        if (y + h > H - BOTTOM) newPage();
        text((i + 1) + ".", M, y, "bold", 9.5, MUTED);
        text(LETTERS[it.good], M + 8, y, "bold", 9.5, GOOD);
        text(al, M + 13, y, "normal", 9.5, INK);
        if (it.u) { font("normal", 8.5); col(BLUE); doc.textWithLink("Explication ›", W - M, y + 0.2, { url: it.u, align: "right", baseline: "top" }); }
        y += h;
      });
    }

    /* Dernier encadré : la mascotte et l'invitation à continuer gratuitement */
    var MAS = o.mascot ? 30 : 0, tx = M + 5 + (MAS ? MAS + 4 : 0), tw = CW - 10 - (MAS ? MAS + 4 : 0);
    var ctaLines = split("Revoyez vos erreurs gratuitement sur " + host + " : leçons de 5 minutes, quiz et examens blancs en ligne, et un nouveau sujet PDF à chaque clic.", "normal", 10, tw);
    var ctaH = Math.max(14 + ctaLines.length * lh(10), MAS + 6);
    if (y + ctaH + 6 > H - BOTTOM) newPage(); else y += 4;
    doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]); doc.roundedRect(M, y, CW, ctaH, 3, 3, "F");
    if (MAS) { doc.setFillColor(255, 255, 255); doc.roundedRect(M + 3, y + 3, MAS, MAS, 3, 3, "F"); doc.addImage(o.mascot, "JPEG", M + 3, y + 3, MAS, MAS, "mascot"); }
    text("Bravo, continuez comme ça !", tx, y + 4, "bold", 12, BLUE);
    text(ctaLines, tx, y + 10.5, "normal", 10, INK);
    font("bold", 10); col(BLUE); doc.text(host, tx, y + 10.5 + ctaLines.length * lh(10) + 1, { baseline: "top" });
    doc.link(M, y, CW, ctaH, { url: site + "reviser/" });

    /* Bandeau et pied de page sur chaque page : logo et adresse du site, pour qu'on sache d'où vient la feuille */
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      flag();
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(0.25); doc.line(M, H - 14, W - M, H - 14);
      var fx = M;
      if (o.logo) { doc.addImage(o.logo, "JPEG", M, H - 12.2, 6.5, 6.5, "logo"); fx = M + 8.5; }
      font("bold", 9); col(BLUE); doc.text(host, fx, H - 10.6, { baseline: "top" });
      var hw = doc.getTextWidth(host);
      font("normal", 7.5); col(MUTED);
      doc.text("  ·  gratuit, sans inscription  ·  sujet " + ex.id + "  ·  site indépendant et non officiel", fx + hw, H - 10.2, { baseline: "top" });
      doc.text(p + " / " + pages, W - M, H - 10.2, { align: "right", baseline: "top" });
    }
    return doc;
  }

  var api = { build: build, render: render, N: N, PASS: PASS };
  root.CoqExam40 = api;

  /* ---------- Page du site ---------- */
  if (typeof document === "undefined") return;
  var form = document.getElementById("gen40");
  if (!form) return;
  var cfg = JSON.parse(form.getAttribute("data-cfg") || "{}");
  var status = form.querySelector(".gen-status"), btn = form.querySelector("button[type=submit]");
  var dataP = null, libP = null;
  function loadData() {
    if (!dataP) dataP = fetch(cfg.data).then(function (r) { if (!r.ok) throw new Error("data"); return r.json(); });
    return dataP;
  }
  var imgP = null;
  function dataUrl(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error("img"); return r.blob(); }).then(function (b) {
      return new Promise(function (ok, ko) { var f = new FileReader(); f.onload = function () { ok(f.result); }; f.onerror = ko; f.readAsDataURL(b); });
    });
  }
  // Logo et mascotte : facultatifs, le sujet se fait même s'ils ne se chargent pas
  function loadImages() {
    if (!imgP) imgP = Promise.all([cfg.logo ? dataUrl(cfg.logo).catch(function () { return null; }) : null, cfg.mascot ? dataUrl(cfg.mascot).catch(function () { return null; }) : null]);
    return imgP;
  }
  function loadLib() {
    if (root.jspdf && root.jspdf.jsPDF) return Promise.resolve(root.jspdf.jsPDF);
    if (!libP) libP = new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = cfg.lib; s.async = true;
      s.onload = function () { root.jspdf && root.jspdf.jsPDF ? ok(root.jspdf.jsPDF) : ko(new Error("lib")); };
      s.onerror = function () { libP = null; ko(new Error("lib")); };
      document.head.appendChild(s);
    });
    return libP;
  }
  // Lien vers un sujet précis (?sujet=nat-4821) : utile pour donner le même sujet à tout un groupe
  var asked = (function () {
    var m = /[?&]sujet=(nat|cr|csp)-(\d{4})\b/i.exec(location.search);
    return m ? { code: m[1].toLowerCase(), num: +m[2] } : null;
  })();
  if (asked) {
    var radio = form.querySelector('input[name=liste][value="' + asked.code + '"]');
    if (radio) radio.checked = true;
    btn.textContent = "Télécharger le sujet " + asked.code.toUpperCase() + "-" + asked.num;
  }
  // Préparer en avance, sans bloquer la page
  var warm = function () { loadData().catch(function () {}); loadImages(); };
  if ("requestIdleCallback" in root) root.requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);

  function say(html) { status.innerHTML = html; }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var code = (form.querySelector("input[name=liste]:checked") || {}).value || "nat";
    var key = !!(form.querySelector("input[name=corrige]") || { checked: true }).checked;
    var num = asked && asked.code === code ? asked.num : 1000 + Math.floor(Math.random() * 9000);
    asked = null;
    btn.disabled = true; say("Préparation du sujet…");
    Promise.all([loadLib(), loadData(), loadImages()]).then(function (res) {
      var ex = build(res[1], code, num), doc = render(res[0], ex, { site: cfg.site, key: key, logo: res[2][0], mascot: res[2][1] });
      doc.save("examen-civique-40-questions-" + ex.id.toLowerCase() + ".pdf");
      var link = location.origin + location.pathname + "?sujet=" + ex.id.toLowerCase();
      say("<b>Sujet " + ex.id + " téléchargé.</b> Chaque clic donne un nouveau sujet. " +
        '<a href="' + link + '">Lien de ce sujet</a> (pour le donner à quelqu’un).');
      btn.textContent = "Un autre sujet PDF";
      try { if (root.COQ_ID && root.COQ_ID.event) root.COQ_ID.event("pdf40-" + code); } catch (e) {}
    }).catch(function () {
      say("Le sujet n’a pas pu être préparé. Vérifiez votre connexion et réessayez, ou utilisez un des sujets ci-dessous.");
    }).then(function () { btn.disabled = false; });
  });
})(typeof window !== "undefined" ? window : globalThis);
