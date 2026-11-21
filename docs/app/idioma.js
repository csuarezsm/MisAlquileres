/* Mis alquileres — idiomas. La app está escrita en español; este módulo traduce lo que se ve en pantalla
   con diccionarios (i18n/<idioma>.js). Las cifras, fechas e importes dentro de una frase se respetan
   mediante marcadores: {e} importe, {f} fecha, {n} número, {m} mes y año, {x} texto libre. © 2026 IT Canarias. */
(function (root) {
  'use strict';
  const IDIOMAS = { es: 'Español', en: 'English', de: 'Deutsch', fr: 'Français', it: 'Italiano' };
  const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIC = { es: {} }, PATRONES = {};
  const RE = { e: '-?(?:\\d{1,3}(?:\\.\\d{3})*|\\d+),\\d{2}\\s€', f: '\\d{2}/\\d{2}/\\d{4}', n: '-?\\d+(?:[.,]\\d+)?', m: `(?:${MESES_ES.join('|')}) \\d{4}`, x: '.+?' };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let lang = 'es';

  function compilar(l) {
    const lista = [];
    for (const k of Object.keys(DIC[l])) {
      if (!/\{[efnmx]\d?\}/.test(k)) continue;
      const tipos = [];
      const fuente = esc(k).replace(/\\\{([efnmx])(\d?)\\\}/g, (m, t, d) => { tipos.push(t + d); return '(' + RE[t] + ')'; });
      lista.push({ re: new RegExp('^' + fuente + '$'), tipos, destino: DIC[l][k], k });
    }
    lista.sort((a, b) => b.k.length - a.k.length); // los más específicos primero
    PATRONES[l] = lista;
  }
  function registrar(l, d) { DIC[l] = Object.assign(DIC[l] || {}, d); compilar(l); }
  const mesL = (m, l) => { if (!m) return m; const [mn, a] = m.split(' '), i = MESES_ES.indexOf(mn); const d = DIC[l] || {}; return i < 0 ? m : `${d[mn] || mn} ${a}`; };
  // Traduce una frase completa en un idioma concreto
  function trad(txt, l) {
    if (l === 'es' || txt == null) return txt;
    const d = DIC[l]; if (!d) return txt;
    const s = String(txt);
    if (Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    for (const p of PATRONES[l] || []) {
      const m = p.re.exec(s); if (!m) continue;
      const vals = {}; p.tipos.forEach((t, i) => { vals[t] = t[0] === 'm' ? mesL(m[i + 1], l) : t[0] === 'x' ? trad(m[i + 1], l) : m[i + 1]; });
      return p.destino.replace(/\{([efnmx]\d?)\}/g, (z, t) => (vals[t] != null ? vals[t] : z));
    }
    if (s.includes(' · ')) return s.split(' · ').map((x) => trad(x, l)).join(' · ');
    if (/^· ./.test(s)) return '· ' + trad(s.slice(2), l);
    if (/. ·$/.test(s)) return trad(s.slice(0, -2), l) + ' ·';
    if (/^[\d\s.,€%+\-–:/()]*$/.test(s)) return s;
    if (MESES_ES.includes(s)) return d[s] || s;
    const mm = new RegExp('^(' + RE.m + ')$').exec(s); if (mm) return mesL(s, l);
    const fd = new RegExp('^(\\d{1,2}) de (' + RE.m + ')$').exec(s); if (fd) return fd[1] + ' ' + mesL(fd[2], l);
    if (root.__faltan) root.__faltan.add(s);
    return s;
  }
  // t('texto', {var}) en el idioma actual; las variables se sustituyen después de traducir
  function t(s, vars) {
    let r = trad(s, lang);
    if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return r;
  }
  const tr = (l) => (s) => trad(s, l);

  // ---------- Traducción de la pantalla ----------
  const hechos = new WeakMap(), ATTR = ['aria-label', 'placeholder', 'title'];
  const conservar = (s) => { const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); return m; };
  function traducirTexto(n) {
    if (lang === 'es') return;
    const v = n.nodeValue; if (!v || !v.trim() || hechos.get(n) === v) return;
    const p = n.parentNode; if (!p || p.closest && p.closest('[data-notr],textarea,script,style')) return;
    const m = conservar(v), r = trad(m[2], lang);
    if (r !== m[2]) { const nuevo = m[1] + r + m[3]; hechos.set(n, nuevo); n.nodeValue = nuevo; } else hechos.set(n, v);
  }
  function traducirElemento(el) {
    if (lang === 'es' || el.nodeType !== 1) return;
    for (const a of ATTR) if (el.hasAttribute(a)) { const v = el.getAttribute(a), k = 'a:' + a; if (el[k] === v) continue; const r = trad(v, lang); el[k] = r; if (r !== v) el.setAttribute(a, r); }
  }
  function traducir(raiz) {
    if (lang === 'es' || !raiz) return;
    if (raiz.nodeType === 3) return traducirTexto(raiz);
    traducirElemento(raiz);
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    while (w.nextNode()) { const n = w.currentNode; if (n.nodeType === 3) traducirTexto(n); else traducirElemento(n); }
  }
  let obs = null;
  function observar() {
    if (obs || typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') traducirTexto(m.target); else if (m.type === 'attributes') traducirElemento(m.target); else m.addedNodes.forEach(traducir); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  function poner(l) {
    lang = IDIOMAS[l] ? l : 'es';
    if (typeof document !== 'undefined') { document.documentElement.lang = lang; if (lang !== 'es') { observar(); traducir(document.body); document.title = trad('Mis alquileres', lang); } }
  }
  function delSistema() {
    const n = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (const x of n) { const c = String(x || '').slice(0, 2).toLowerCase(); if (IDIOMAS[c]) return c; }
    return 'en';
  }
  root.Idioma = { IDIOMAS, registrar, t, tr, trad, poner, traducir, delSistema, mes: mesL, get actual() { return lang; }, dic: (l) => DIC[l] || {} };
})(typeof globalThis !== 'undefined' ? globalThis : this);
