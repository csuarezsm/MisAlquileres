/* Mis alquileres — interfaz. © 2026 IT Canarias. Las reglas están en nucleo.js; aquí solo se pinta y se recoge lo que escribe el usuario. */
(function () {
  'use strict';
  const APP_VERSION = '1.5.0';
  const { Almacen, Archivos, Avisos, Tienda, Adjuntos, Drive, Bloqueo, NATIVO } = window.Plataforma;
  const $ = (q, el) => (el || document).querySelector(q);
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = MA.euros;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fecha = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
  const fmes = (m) => `${MESES[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const aTexto = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, ''));
  const clave = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const por = (l, i) => l.find((x) => x.id === i);

  let S = MA.nuevo(), HOY = hoyLocal();
  const V = { mes: HOY.slice(0, 7), anio: HOY.slice(0, 4), renta: +HOY.slice(0, 4) - 1, archivados: false, filtros: {} };

  // ---------- Apariencia (se guarda en el propio móvil y se aplica antes de pintar) ----------
  const AP_DEF = { tema: 'auto', acento: '#e8b004', cab: 'oscura', fs: 1, contraste: false };
  const ACENTOS = [['#e8b004', 'Amarillo picón'], ['#0f7c6e', 'Verde mar'], ['#2c62c6', 'Azul'], ['#b23a48', 'Granate'], ['#6d4bb1', 'Morado'], ['#4a555c', 'Grafito']];
  function leerAp() { try { return { ...AP_DEF, ...JSON.parse(localStorage.getItem('ma.ap') || '{}') }; } catch (e) { return { ...AP_DEF }; } }
  const rgbDe = (hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16));
  const mezcla = (a, b, k) => '#' + a.map((x, i) => Math.round(x * k + b[i] * (1 - k)).toString(16).padStart(2, '0')).join('');
  // El hueco bajo el contenido sigue a la altura real de la barra inferior (crece con el tamaño de letra y la zona segura)
  function medirBarra() { const b = $('.barra'); if (b) document.documentElement.style.setProperty('--barra', b.offsetHeight + 'px'); }
  if (typeof ResizeObserver !== 'undefined' && $('.barra')) new ResizeObserver(medirBarra).observe($('.barra'));
  addEventListener('resize', medirBarra);
  function aplicarAp(a) {
    const r = document.documentElement, oscuro = a.tema === 'oscuro' || (a.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches), c = rgbDe(a.acento);
    if (a.tema === 'auto') delete r.dataset.tema; else r.dataset.tema = a.tema;
    if (a.contraste) r.dataset.contraste = 'alto'; else delete r.dataset.contraste;
    if (a.cab === 'acento') r.dataset.cab = 'acento'; else delete r.dataset.cab;
    const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    r.style.setProperty('--acc', a.acento); r.style.setProperty('--onacc', lum > 0.55 ? '#14191c' : '#ffffff');
    r.style.setProperty('--accsuave', oscuro ? mezcla(c, [28, 34, 38], 0.3) : mezcla(c, [255, 255, 255], 0.22));
    r.style.setProperty('--fs', String(a.fs));
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = a.cab === 'acento' ? a.acento : oscuro ? '#0c0f11' : '#1c2226';
  }
  aplicarAp(leerAp());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarAp(leerAp()));

  // ---------- Guardado ----------
  let tGuardar = null;
  function guardar() {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(async () => {
      const txt = MA.exportar(S);
      await Almacen.guardar(txt);
      copiaProgramada();
      if (Avisos.disponible) Avisos.programar(S.ajustes.avisos ? [...MA.proximosAvisos(S, HOY, 60), ...avisoCopia()] : [], S.ajustes.horaAvisos || 9);
    }, 300);
  }
  // ---------- Bloqueo con huella o PIN (se guarda en el propio móvil, no va en las copias) ----------
  const BLOQ_DEF = { activo: false, minutos: 1, ocultar: false };
  const leerBloq = () => { try { return { ...BLOQ_DEF, ...JSON.parse(localStorage.getItem('ma.bloqueo') || '{}') }; } catch (e) { return { ...BLOQ_DEF }; } };
  let bloqueada = false, salida = 0, pidiendo = false;
  function bloquear() { if (!Bloqueo.disponible || !leerBloq().activo) return; bloqueada = true; $('#candado').hidden = false; document.body.classList.add('bloqueada'); desbloquear(); }
  async function desbloquear() {
    if (pidiendo) return; pidiendo = true;
    try { await Bloqueo.autenticar(Idioma.t('Desbloquear Mis alquileres')); bloqueada = false; salida = 0; $('#candado').hidden = true; document.body.classList.remove('bloqueada'); }
    catch (e) { /* sigue bloqueada; puede volver a pulsar «Desbloquear» */ } finally { pidiendo = false; }
  }
  if ($('#candado')) $('#candado [data-x=desbloquear]').onclick = desbloquear;
  document.addEventListener('visibilitychange', () => {
    const b = leerBloq(); if (!b.activo || pidiendo) return;
    if (document.hidden) salida = Date.now(); else if (!bloqueada && salida && Date.now() - salida >= b.minutos * 60000) bloquear();
  });
  Bloqueo.proteger(leerBloq().ocultar); bloquear();

  // ---------- Copias de seguridad programadas ----------
  const FREC = { diaria: 1, semanal: 7, mensual: 30 };
  const confCopias = () => ({ frecuencia: 'diaria', adjuntos: true, guardar: 7, ...(S.ajustes.copias || {}) });
  const utf8 = (s) => new TextEncoder().encode(s);
  // Copia completa: datos.json y, si se pide, los documentos y fotos en adjuntos/ (ZIP). Sin adjuntos basta el .json.
  async function crearCopia(conAdjuntos) {
    const txt = MA.exportar(S);
    if (!conAdjuntos || !S.adjuntos.length) return { nombre: `mis-alquileres-${HOY}.json`, bytes: utf8(txt), mime: 'application/json' };
    const arch = [{ nombre: 'datos.json', datos: txt }], faltan = [];
    for (const a of S.adjuntos) { try { const b = await Adjuntos.leer(a.archivo); if (b) arch.push({ nombre: 'adjuntos/' + a.archivo, datos: b }); else faltan.push(a.nombre); } catch (e) { faltan.push(a.nombre); } }
    arch.push({ nombre: 'LEEME.txt', datos: `Copia de Mis alquileres del ${fecha(HOY)}.\nPara recuperarla: Más › Ajustes y copias › Recuperar una copia, y elige este archivo ZIP.\n${faltan.length ? '\nNo se pudieron incluir: ' + faltan.join(', ') + '\n' : ''}` });
    return { nombre: `mis-alquileres-${HOY}-completa.zip`, bytes: Exportar.zip(arch), mime: 'application/zip' };
  }
  let copiando = false;
  // Se hace al abrir o volver a la app cuando toca: en el móvil y, si está conectado, en Google Drive.
  // Si una de las dos falla, se reintenta la próxima vez sin repetir la que salió bien.
  async function copiaProgramada(forzar) {
    const c = confCopias(), f = FREC[c.frecuencia], conDrive = c.drive && Drive.disponible;
    if (!(Archivos.enMovil || conDrive) || copiando || (!forzar && (!f || !S.contratos.length || S.ejemplo))) return false;
    const tocaMovil = Archivos.enMovil && (forzar || !c.ultima || MA.diasEntre(c.ultima, HOY) >= f);
    const tocaDrive = conDrive && (forzar || !c.driveUltima || MA.diasEntre(c.driveUltima, HOY) >= f);
    if (!tocaMovil && !tocaDrive) return false;
    copiando = true; const r = { ...c }; let ok = false;
    try {
      const k = await crearCopia(c.adjuntos);
      if (tocaMovil) { try { await Archivos.copiaEnMovil(k.nombre, k.bytes, c.guardar); r.ultima = HOY; r.error = null; ok = true; } catch (e) { r.error = HOY; } }
      if (tocaDrive) { try { await Drive.subir(k.nombre, k.bytes, k.mime, c.guardar); r.driveUltima = HOY; r.driveError = null; ok = true; } catch (e) { r.driveError = HOY; } }
    } catch (e) { r.error = HOY; }
    finally { S.ajustes.copias = { ...confCopias(), ...r }; copiando = false; guardar(); }
    return ok;
  }
  // Si pasa la fecha de la copia sin abrir la app, un aviso recuerda abrirla (la copia se hace al abrir)
  function avisoCopia() {
    const c = confCopias(); if (!Archivos.enMovil || !FREC[c.frecuencia] || !S.contratos.length) return [];
    let f = c.ultima ? MA.masDias(c.ultima, FREC[c.frecuencia] + 1) : MA.masDias(HOY, 1); if (f <= HOY) f = MA.masDias(HOY, 1);
    return [{ id: 990001, fecha: f, titulo: Idioma.t('Copia de seguridad pendiente'), texto: Idioma.t('Abre Mis alquileres y se hará la copia programada.') }];
  }
  async function recuperarBytes(bytes, nombre) {
    let txt, z = null;
    if (/\.zip$/i.test(nombre) || (bytes[0] === 0x50 && bytes[1] === 0x4b)) { z = await Tablas.unzip(bytes); txt = await z.texto('datos.json'); if (!txt) throw Object.assign(new Error('El ZIP no es una copia de Mis alquileres'), { code: 'COPIA' }); }
    else txt = new TextDecoder().decode(bytes);
    const n = MA.importar(txt); n.pro = S.pro; let rec = 0;
    if (z) for (const a of n.adjuntos) { const b = await z.bytes('adjuntos/' + a.archivo); if (b) { await Adjuntos.escribir(a.archivo, b, a.mime); rec++; } }
    S = n; alDia(); guardar(); cerrar(); location.hash = '#inicio'; pinta();
    toast(z ? `Copia recuperada, con ${rec} documentos y fotos` : 'Copia recuperada');
  }
  function resumenCopias() {
    const c = confCopias(); if (!Archivos.enMovil && !Drive.disponible) return 'Disponibles en la app de Android';
    if (!FREC[c.frecuencia]) return 'Desactivadas';
    const u = [c.ultima, c.drive ? c.driveUltima : null].filter(Boolean).sort().pop();
    return [{ diaria: 'Cada día', semanal: 'Cada semana', mensual: 'Cada mes' }[c.frecuencia], c.adjuntos ? 'Con documentos y fotos' : 'Solo los datos',
      c.drive ? 'Móvil y Google Drive' : 'Solo en el móvil', u ? 'Última: ' + fecha(u) : ''].filter(Boolean).join(' · ');
  }
  // Informe de la Renta del año elegido: de todo (tu parte) o de otro titular
  const informe = () => MA.informeTitular(MA.informeRenta(S, V.renta, HOY), S, V.titular || (MA.titulares(S).length > 1 ? 'yo' : null));
  function alDia() { HOY = hoyLocal(); if (MA.generarCargos(S, HOY) + MA.generarGastos(S, HOY)) guardar(); }

  // ---------- Avisos en pantalla ----------
  let tToast = null;
  // toast(mensaje) · toast(mensaje, 'Acción', fn) · toast(mensaje, [['Acción', fn], ['Otra', fn2]])
  function toast(msg, accion, fn) {
    const acc = Array.isArray(accion) ? accion : accion ? [[accion, fn]] : [], t = $('#toast');
    t.innerHTML = `<span>${h(msg)}</span><span>${acc.map((a, i) => `<button data-t="${i}">${h(a[0])}</button>`).join('')}</span>`; t.hidden = false;
    t.querySelectorAll('button').forEach((b) => { b.onclick = () => { t.hidden = true; acc[+b.dataset.t][1](); }; });
    clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, acc.length ? 8000 : 3500);
  }
  function fallo(e) { if (e && e.code === 'LIMITE') return hojaPro(e.message); toast(e && e.code ? e.message : 'Algo ha fallado. Inténtalo de nuevo.'); if (!e || !e.code) console.error(e); }
  // Ejecuta un cambio, guarda y repinta
  function haz(fn, despues) { try { const r = fn(); guardar(); pinta(); if (despues) despues(r); return true; } catch (e) { fallo(e); return false; } }

  // ---------- Hoja inferior (diálogo) ----------
  let focoPrevio = null;
  function hoja(titulo, cuerpo, alMontar) {
    const el = $('#hoja');
    if (el.hidden) focoPrevio = document.activeElement;
    el.innerHTML = `<button class="cerrar" data-a="cerrar" aria-label="Cerrar">✕</button><h2 id="hoja-t">${h(titulo)}</h2>${cuerpo}`;
    el.hidden = false; $('#fondo').hidden = false; el.scrollTop = 0;
    if (alMontar) alMontar(el);
    el.querySelectorAll('[data-docs]').forEach(montarDocs);
    ($('input:not([type=hidden]):not([type=file]),select,textarea', el) || $('.cerrar', el)).focus({ preventScroll: true });
  }
  function cerrar() { $('#hoja').hidden = true; $('#fondo').hidden = true; if (focoPrevio && focoPrevio.focus) focoPrevio.focus(); }
  document.addEventListener('keydown', (e) => {
    const el = $('#hoja'); if (el.hidden) return;
    if (e.key === 'Escape') return cerrar();
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll('button,input,select,textarea,a[href]')].filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---------- Formularios ----------
  function campos(defs, v) {
    return defs.map((d) => {
      if (d.h) return `<div class="form-sec">${h(d.h)}</div>`;
      if (d.det) return `<details class="mas-op"><summary>${h(d.det)}</summary>`;
      if (d.detFin) return '</details>';
      if (d.html) return d.html;
      const val = v[d.k] != null ? v[d.k] : d.def != null ? d.def : '', ay = d.ayuda ? `<small>${h(d.ayuda)}</small>` : '', req = d.req ? ' required' : '';
      if (d.t === 'check') return `<label class="f chk"><input type="checkbox" name="${d.k}"${val ? ' checked' : ''}><span>${h(d.e)}${ay}</span></label>`;
      if (d.t === 'select') return `<label class="f">${h(d.e)}<select name="${d.k}"${req}>${d.op.map(([a, b]) => `<option value="${h(a)}"${String(a) === String(val) ? ' selected' : ''}>${h(b)}</option>`).join('')}</select>${ay}</label>`;
      if (d.t === 'area') return `<label class="f">${h(d.e)}<textarea name="${d.k}" rows="5">${h(val)}</textarea>${ay}</label>`;
      const tipo = d.t === 'dinero' ? 'text" inputmode="decimal' : d.t === 'num' ? 'text" inputmode="decimal' : d.t || 'text';
      return `<label class="f">${h(d.e)}<input type="${tipo}" name="${d.k}" value="${h(d.t === 'dinero' ? aTexto(val === '' ? null : val) : val)}"${req} autocomplete="off">${ay}</label>`;
    }).join('');
  }
  function leer(form, defs) {
    const o = {};
    for (const d of defs) {
      if (!d.k) continue; const el = form.elements[d.k]; if (!el) continue;
      const t = el.value != null ? String(el.value).trim() : '';
      if (d.t === 'check') o[d.k] = el.checked;
      else if (d.t === 'dinero') o[d.k] = t === '' ? null : MA.centimos(t);
      else if (d.t === 'num') { o[d.k] = t === '' ? null : Number(t.replace(',', '.')); if (o[d.k] != null && !Number.isFinite(o[d.k])) throw Object.assign(new Error(`Valor no válido: ${d.e}`), { code: 'DATOS' }); }
      else o[d.k] = t;
    }
    return o;
  }
  function formulario({ titulo, defs, valores, boton, alGuardar, pie, despues, alMontar }) {
    hoja(titulo, `<form novalidate><div class="error" hidden role="alert"></div>${campos(defs, valores || {})}<button class="btn pri ancho" type="submit">${h(boton || 'Guardar')}</button></form>${pie || ''}`, (el) => {
      const f = $('form', el); let enviando = false;
      f.onsubmit = (e) => {
        e.preventDefault(); if (enviando) return; enviando = true;
        const mal = (x) => { enviando = false; if (x.code === 'LIMITE') return fallo(x); const b = $('.error', f); b.textContent = x.code ? x.message : 'No se ha podido guardar.'; b.hidden = false; b.scrollIntoView({ block: 'nearest' }); if (!x.code) console.error(x); };
        const bien = (r) => { guardar(); cerrar(); pinta(); if (despues) despues(r); };
        try { const r = alGuardar(leer(f, defs), f); if (r && typeof r.then === 'function') r.then(bien, mal); else bien(r); } catch (x) { mal(x); }
      };
      if (alMontar) alMontar(f);
    });
  }
  function confirma(titulo, texto, boton, fn, pedirMotivo) {
    hoja(titulo, `<p class="sub">${h(texto)}</p>${pedirMotivo ? '<label class="f">Motivo<input name="motivo" autocomplete="off"></label>' : ''}<div class="acc"><button class="btn rojo" data-x="si">${h(boton)}</button><button class="btn" data-a="cerrar">Cancelar</button></div>`,
      (el) => { $('[data-x=si]', el).onclick = () => { const m = pedirMotivo ? $('input', el).value : ''; cerrar(); fn(m); }; });
  }

  // ---------- Mensajes por WhatsApp ----------
  function telWa(t) { const n = String(t || '').replace(/\D/g, ''); return n.length === 9 ? '34' + n : n.replace(/^00/, ''); }
  const pila = (n) => String(n || '').trim().split(/\s+/)[0];
  function enviar(titulo, tel, texto, alEnviar) {
    hoja(titulo, `<label class="f">Mensaje<textarea id="msj" rows="8">${h(texto)}</textarea></label>
      <div class="acc"><button class="btn pri" data-x="wa">${tel ? 'Abrir WhatsApp' : 'Compartir'}</button><button class="btn" data-x="copiar">Copiar</button></div>
      <p class="sub">${tel ? 'Se abre WhatsApp con el texto preparado; lo envías tú.' : 'Este inquilino no tiene teléfono guardado: elige WhatsApp y el contacto al compartir, o añade su teléfono en su ficha.'}</p>`, (el) => {
      $('[data-x=wa]', el).onclick = () => { const t = $('#msj', el).value; if (alEnviar) alEnviar(); cerrar();
        if (tel) window.Plataforma.abrir(`https://wa.me/${telWa(tel)}?text=${encodeURIComponent(t)}`);
        else Archivos.compartirTexto(t).then((r) => { if (r === 'copiado') toast('Mensaje copiado: pégalo en WhatsApp'); }).catch(() => {}); };
      $('[data-x=copiar]', el).onclick = async () => { try { await navigator.clipboard.writeText($('#msj', el).value); toast('Mensaje copiado'); } catch (e) { toast('No se ha podido copiar'); } };
    });
  }
  const comunes = () => ({ propietario: S.ajustes.propietario || '', forma_pago: S.ajustes.formaPago || '' });
  const langDe = (q) => (q && q.idioma) || Idioma.actual;
  // Plantilla de un mensaje en un idioma: la personalizada si la hay; si no, la de serie de ese idioma
  function plantilla(k, l) {
    if (l === 'es') return S.plantillas[k] || MA.PLANTILLAS[k];
    const pi = (S.plantillasI || {})[l]; if (pi && pi[k]) return pi[k];
    return Idioma.dic(l)['plantilla.' + k] || S.plantillas[k];
  }
  function texto(k, q, vars) {
    const l = langDe(q), v = { ...comunes(), ...vars };
    for (const x of ['mes', 'periodo']) if (v[x]) v[x] = Idioma.mes(v[x], l);
    if (v.indice) v.indice = Idioma.tr(l)(v.indice);
    return MA.mensaje(plantilla(k, l), v);
  }
  function msgCobro(c, tipo) {
    if (!tipo) { const e = MA.escalon(c, HOY); tipo = e === 2 ? 'atraso2' : c.estado === 'atrasado' || c.vence < HOY ? 'atraso' : 'cobro'; }
    const v = { ...comunes(), nombre: pila(c.inquilino), inmueble: c.inmueble, mes: fmes(c.periodo), importe: eur(c.importe), deuda: eur(c.pendiente), fecha_cobro: fecha(c.vence), importe_pagado: eur(c.pagado), fecha_pago: fecha(c.fechaPago) };
    enviar('Mensaje a ' + c.inquilino, c.telefono, texto(tipo, por(S.inquilinos, c.inquilinoId), v), () => { if (tipo !== 'recibo') { por(S.cargos, c.id).recordatorio = HOY; guardar(); } });
  }

  // ---------- Iconos ----------
  const IC = { casa: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>', persona: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    grafico: '<path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/>', renta: '<path d="M7 3h10l2 2v16H5V5z"/><path d="M9 9h6M9 13h6M9 17h3"/>', banco: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    informe: '<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v11"/>', ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    paleta: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.3-1.6-1.3-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4c0-4.4-4-7.9-9-7.9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    estrella: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', ayuda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.5"/><path d="M12 17h.01"/>',
    chev: '<path d="M9 5l7 7-7 7"/>', mensaje: '<path d="M4 5h16v11H9l-5 4z"/>', campana: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    nube: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 17.5 18z"/>', subir: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', bajar: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    candado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    borrar: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    euro: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.6a4 4 0 1 0 0 6.8"/><path d="M7 11h6M7 13.5h6"/>', doc: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h4"/>',
    alerta: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4M12 17h.01"/>', gasto: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', llave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    mas: '<path d="M12 5v14M5 12h14"/>', usuario: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>', clip: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 7"/>' };
  const svg = (k) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ''}</svg>`;
  // Elemento de lista: destino '#vista' (enlace) o nombre de acción; extra = atributos adicionales
  const item = (dest, ic, titulo, sub, extra) => { const enl = dest[0] === '#', tag = enl ? 'a' : 'button';
    return `<${tag} ${enl ? `href="${dest}"` : `data-a="${dest}"`} ${extra || ''}>${ic ? `<span class="ic">${svg(ic)}</span>` : ''}<span class="txt">${h(titulo)}${sub ? `<small>${h(sub)}</small>` : ''}</span><span class="chev">${svg('chev')}</span></${tag}>`; };

  // ---------- Etiquetas de estado ----------
  const E_CARGO = { pendiente: ['Pendiente', ''], parcial: ['A medias', 'avi'], atrasado: ['Atrasado', 'mal'], pagado: ['Cobrado', 'ok'], anulado: ['Anulado', 'gris'] };
  const E_GASTO = { previsto: ['Previsto', ''], vencido: ['Sin pagar', 'mal'], por_confirmar: ['Por confirmar', 'avi'], pagado: ['Pagado', 'ok'], anulado: ['Anulado', 'gris'] };
  const E_CONTRATO = { vigente: ['Vigente', 'ok'], futuro: ['Empieza pronto', ''], por_vencer: ['Vence pronto', 'avi'], vencido: ['Vencido', 'mal'], finalizado: ['Finalizado', 'gris'], rescindido: ['Rescindido', 'gris'] };
  const chip = (m, e) => `<span class="chip ${m[e][1]}">${m[e][0]}</span>`;

  // ---------- Tarjetas ----------
  function cobroTar(c, conMes) {
    const vivo = c.estado !== 'pagado' && c.estado !== 'anulado';
    return `<div class="tar toca${c.estado === 'anulado' ? ' apagada' : ''}" data-a="cobro" data-id="${c.id}">
      <div class="fila"><span class="tit" data-notr>${h(c.inquilino)}</span><span class="imp">${eur(vivo ? c.pendiente : c.importe)}</span></div>
      <div class="fila"><span class="sub" data-notr>${h(c.inmueble)}</span>${chip(E_CARGO, c.estado)}</div>
      <div class="sub">${conMes ? `${fmes(c.periodo)}, ` : ''}${vivo ? `vence el ${fecha(c.vence)}` : c.fechaPago ? `cobrado el ${fecha(c.fechaPago)}` : ''}${c.estimado ? ' (estimado)' : ''}</div>
      ${vivo ? `<div class="acc"><button class="btn pri peq" data-a="cobrado" data-id="${c.id}" data-k="${clave()}">Cobrado</button><button class="btn peq" data-a="avisar" data-id="${c.id}">Avisar</button>${c.recordatorio ? `<span class="sub">Avisado el ${fecha(c.recordatorio)}</span>` : ''}</div>` : ''}</div>`;
  }
  // Recibos atrasados agrupados por contrato: una tarjeta por inquilino con el total
  function deudas() {
    const m = new Map();
    for (const c of MA.cargos(S, HOY, (x) => !x.anulado)) {
      if (!(c.estado === 'atrasado' || (c.estado === 'parcial' && c.vence < HOY))) continue;
      const d = m.get(c.contratoId) || { contratoId: c.contratoId, inquilino: c.inquilino, inmueble: c.inmueble, telefono: c.telefono, cargos: [], total: 0, esc: 0, recordado: null };
      d.cargos.push(c); d.total += c.pendiente; d.esc = Math.max(d.esc, MA.escalon(c, HOY)); if (c.recordatorio && (!d.recordado || c.recordatorio > d.recordado)) d.recordado = c.recordatorio; m.set(c.contratoId, d);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }
  function deudaTar(d) {
    const n = d.cargos.length, desde = d.cargos[0].vence, toca = d.esc && !(d.recordado && d.recordado >= MA.masDias(HOY, -2));
    return `<div class="tar toca alerta" data-a="contrato" data-id="${d.contratoId}">
      <div class="fila"><span class="tit" data-notr>${h(d.inquilino)}</span><span class="imp">${eur(d.total)}</span></div>
      <div class="sub" data-notr>${h(d.inmueble)}</div>
      <div class="sub">${n === 1 ? `${fmes(d.cargos[0].periodo)}, vencido hace ${MA.diasEntre(desde, HOY)} días` : `${n} recibos sin pagar desde el ${fecha(desde)}`}</div>
      ${toca ? `<div class="sub"><span class="chip ${d.esc === 2 ? 'mal' : 'avi'}">${d.esc === 2 ? 'Toca un recordatorio firme' : 'Toca recordárselo'}</span></div>` : d.recordado ? `<div class="sub">Avisado el ${fecha(d.recordado)}</div>` : ''}
      <div class="acc"><button class="btn pri peq" data-a="cobrarDeuda" data-id="${d.contratoId}">Cobrar</button><button class="btn peq" data-a="avisarDeuda" data-id="${d.contratoId}">Avisar</button></div></div>`;
  }
  function gastoTar(g) {
    const pte = !g.pagado && !g.anulado;
    return `<div class="tar toca${g.anulado ? ' apagada' : ''}" data-a="gasto" data-id="${g.id}">
      <div class="fila"><span class="tit" data-notr>${h(g.concepto)}</span><span class="imp">${eur(g.importe)}</span></div>
      <div class="fila"><span class="sub" data-notr>${h(g.inmueble)}</span>${chip(E_GASTO, g.estado)}</div>
      <div class="sub">${g.pagado ? `Pagado el ${fecha(g.pagado.fecha)}` : `Fecha: ${fecha(g.fecha)}`}${g.estimado ? ' (estimado)' : ''}</div>
      ${g.porCobrar > 0 ? `<div class="sub">Por cobrar al inquilino: <b>${eur(g.porCobrar)}</b></div>` : ''}
      ${pte && g.fecha <= HOY ? `<div class="acc"><button class="btn pri peq" data-a="gastoPagado" data-id="${g.id}">${g.estado === 'por_confirmar' ? 'Confirmar pago' : 'Pagado'}</button></div>` : ''}</div>`;
  }
  function contratoTar(ct) {
    const q = por(S.inquilinos, ct.inquilinoId) || {}, p = por(S.inmuebles, ct.inmuebleId) || {}, sit = MA.situacionContrato(ct, HOY), fin = MA.finEfectivo(ct);
    const deuda = MA.cargos(S, HOY, (c) => c.contratoId === ct.id).filter((c) => c.estado === 'atrasado').reduce((t, c) => t + c.pendiente, 0);
    return `<div class="tar toca${ct.estado !== 'activo' ? ' apagada' : ''}${deuda ? ' alerta' : ''}" data-a="contrato" data-id="${ct.id}">
      <div class="fila"><span class="tit" data-notr>${h(q.nombre)}</span><span class="imp">${eur(MA.rentaActual(ct, HOY))}</span></div>
      <div class="fila"><span class="sub" data-notr>${h(p.nombre)}</span>${chip(E_CONTRATO, sit)}</div>
      <div class="sub">${fin ? `Del ${fecha(ct.inicio)} al ${fecha(fin)}` : `Desde el ${fecha(ct.inicio)}, sin fecha de fin`}</div>
      ${deuda ? `<div class="sub">Debe <b>${eur(deuda)}</b></div>` : ''}</div>`;
  }
  function tareaTar(x) {
    const d = x.dias == null ? '' : x.dias < 0 ? ` · hace ${-x.dias} días` : x.dias === 0 ? ' · hoy' : ` · en ${x.dias} días`;
    const T = { actualizacion: ['Actualizar la renta', `${x.titulo} · ${fecha(x.fecha)} (${x.indice === 'fijo' ? 'pactado' : String(x.indice || '').toUpperCase()})`, 'actualizar', 'avi'],
      fianza_deposito: ['Depositar la fianza', `${x.titulo} · ${eur(x.importe)} · plazo hasta el ${fecha(x.fecha)}`, 'deposito', x.dias < 0 ? 'mal' : 'avi'],
      fianza_devolver: ['Devolver la fianza', `${x.titulo} · ${eur(x.importe)} · antes del ${fecha(x.fecha)}`, 'contrato', x.dias < 0 ? 'mal' : 'avi'],
      fianza_recuperar: ['Recuperar la fianza depositada', `${x.titulo} · ${x.organismo || ''}`, 'contrato', ''],
      copia: ['Guarda una copia de tus datos', `${x.titulo}. Guárdala en Google Drive o envíatela por correo.`, 'copia', 'avi'] }[x.tipo];
    return `<div class="tar toca" data-a="${T[2]}" data-id="${x.id}"><div class="fila"><span class="tit">${h(T[0])}</span><span class="chip ${T[3]}">${x.tipo === 'copia' ? 'Copia' : 'Pendiente'}</span></div><div class="sub">${h(T[1])}${h(d)}</div></div>`;
  }
  const vacio = (t, s, boton) => `<div class="vacio"><b>${h(t)}</b><p>${h(s)}</p>${boton ? `<div class="acc centro"><button class="btn pri" data-a="${boton[0]}">${h(boton[1])}</button></div>` : ''}</div>`;
  const sec = (t, lado, cuerpo, neutro) => (cuerpo ? `<section class="sec"><h2>${h(t)}${lado ? `<b${neutro ? ' class="neutro"' : ''}>${h(lado)}</b>` : ''}</h2>${cuerpo}</section>` : '');

  // ---------- Vistas ----------
  const VISTAS = {
    inicio() {
      if (!S.inmuebles.length) return `<div class="vacio"><b>Empieza en un minuto</b><p>Apunta el inmueble, quién lo alquila y cuánto paga. La app creará los recibos de cada mes y te avisará.</p>
        <div class="acc centro"><button class="btn pri" data-a="altaRapida">Alta rápida</button></div>
        <div class="acc centro"><button class="btn" data-a="importarCartera">Importar desde Excel</button><button class="btn" data-a="nuevoInmueble">Paso a paso</button></div>
        <div class="acc centro"><button class="btn txt" data-a="restaurar">¿Ya usabas la app? Recuperar una copia</button></div>
        <div class="acc centro"><button class="btn txt" data-a="ejemplo">Probar con datos de ejemplo</button></div></div>`;
      if (!S.contratos.length) return vacio('Ahora, el contrato', 'Indica quién alquila el inmueble, desde cuándo y cuánto paga.', ['nuevoContrato', 'Crear contrato']);
      const k = MA.panel(S, HOY), cs = MA.cargos(S, HOY, (c) => !c.anulado), gs = MA.gastos(S, HOY, (g) => !g.anulado), finMes = MA.masMeses(HOY.slice(0, 7) + '-01', 1);
      const ds = deudas(), mes = cs.filter((c) => (c.estado === 'pendiente' || c.estado === 'parcial') && c.vence >= HOY && c.vence < finMes);
      const vencen = S.contratos.filter((ct) => ['por_vencer', 'vencido'].includes(MA.situacionContrato(ct, HOY)));
      const gPte = gs.filter((g) => !g.pagado && g.fecha < finMes).reverse(), gCob = gs.filter((g) => g.porCobrar > 0 && g.pagado);
      const m = k.mesActual, tareas = MA.avisosApp(S, HOY).filter((x) => /^(actualizacion|fianza_|copia)/.test(x.tipo));
      return `${S.ejemplo ? `<div class="nota esp">Estás viendo datos de ejemplo. Cuando quieras, bórralos y empieza con los tuyos.<div class="acc"><button class="btn pri peq" data-a="finEjemplo">Borrar el ejemplo y empezar</button></div></div>` : ''}<section class="mes"><div class="et">Cobrado en ${fmes(k.mes)}</div><div class="grande">${eur(m.cobrado)}</div><div class="de">de ${eur(m.esperado)}</div>
          <div class="barra-mes"><i data-w="${m.porcentaje || 0}"></i></div>
          <div class="pie"><span>Por cobrar <b>${eur(m.pendiente)}</b></span>${k.morosidad.deuda ? `<span>Atrasos <b>${eur(k.morosidad.deuda)}</b></span>` : ''}<span>Ocupación <b>${k.cartera.ocupacion == null ? '—' : String(k.cartera.ocupacion).replace('.', ',') + ' %'}</b></span></div></section>
        ${sec('Te deben', ds.length > 1 ? eur(ds.reduce((t, d) => t + d.total, 0)) : '', ds.map(deudaTar).join(''))}
        ${sec('Para hacer', '', tareas.map(tareaTar).join(''))}
        ${sec('Por cobrar este mes', '', mes.map((c) => cobroTar(c)).join(''))}
        ${sec('Contratos que vencen', '', vencen.map(contratoTar).join(''))}
        ${sec('Gastos por atender', '', gPte.map(gastoTar).join(''))}
        ${sec('Por cobrar al inquilino', eur(k.gastosPorCobrar), gCob.map(gastoTar).join(''), true)}
        ${!ds.length && !mes.length && !vencen.length && !gPte.length && !gCob.length && !tareas.length ? vacio('Todo al día', 'No hay cobros, contratos ni gastos pendientes de atender.') : ''}`;
    },
    cobros() {
      const cs = MA.cargos(S, HOY, (c) => c.periodo === V.mes), vivos = cs.filter((c) => c.estado !== 'anulado');
      const esp = vivos.reduce((t, c) => t + c.importe, 0), cob = vivos.reduce((t, c) => t + Math.min(c.pagado, c.importe), 0);
      return `<div class="nav"><button data-a="mes" data-d="-1" aria-label="Mes anterior">‹</button><b>${fmes(V.mes)}</b><button data-a="mes" data-d="1" aria-label="Mes siguiente"${V.mes >= HOY.slice(0, 7) ? ' disabled' : ''}>›</button></div>
        <div class="kpis"><div class="kpi"><span>Cobrado</span><b>${eur(cob)}</b></div><div class="kpi"><span>Pendiente</span><b>${eur(esp - cob)}</b></div></div>
        ${S.contratos.length ? '<button class="btn ancho peq esp" data-a="extracto">Apuntar cobros desde el extracto del banco</button>' : ''}
        ${cs.map((c) => cobroTar(c)).join('') || vacio('Sin recibos este mes', 'Los recibos se crean solos a partir de los contratos.')}`;
    },
    gastos() {
      const gs = MA.gastos(S, HOY, (g) => g.fecha.slice(0, 4) === V.anio), vivos = gs.filter((g) => !g.anulado);
      const pag = vivos.filter((g) => g.pagado).reduce((t, g) => t + g.importe, 0), pte = vivos.filter((g) => !g.pagado).reduce((t, g) => t + g.importe, 0);
      return `<div class="nav"><button data-a="anio" data-d="-1" aria-label="Año anterior">‹</button><b>${V.anio}</b><button data-a="anio" data-d="1" aria-label="Año siguiente">›</button></div>
        <div class="kpis"><div class="kpi"><span>Pagado</span><b>${eur(pag)}</b></div><div class="kpi"><span>Previsto o sin pagar</span><b>${eur(pte)}</b></div></div>
        ${gs.map(gastoTar).join('') || vacio('Sin gastos este año', 'Añade un gasto suelto aquí, o los gastos periódicos (IBI, comunidad…) en la ficha de cada inmueble.')}
        ${S.inmuebles.length ? '<button class="fab" data-a="nuevoGasto">+ Gasto</button>' : ''}`;
    },
    contratos() {
      const l = S.contratos.slice().sort((a, b) => (a.estado === 'activo' ? 0 : 1) - (b.estado === 'activo' ? 0 : 1) || (a.fin || '9999').localeCompare(b.fin || '9999'));
      return `${l.map(contratoTar).join('') || vacio('Sin contratos', 'Crea el primero para que la app genere los recibos mensuales.')}
        ${S.inmuebles.length ? '<button class="fab" data-a="nuevoContrato">+ Contrato</button>' : ''}`;
    },
    mas() {
      const n = (x) => x.filter((y) => !y.archivado).length;
      return `${sec('Cartera', '', `<div class="lista">${item('#inmuebles', 'casa', 'Inmuebles', `${n(S.inmuebles)} en cartera`)}${item('#inquilinos', 'persona', 'Inquilinos', `${n(S.inquilinos)} en total`)}</div>`)}
        ${sec('Cuentas e informes', '', `<div class="lista">${item('#panel', 'grafico', 'Panel', 'Ocupación, deudas y rentabilidad')}${item('#informes', 'informe', 'Informes y listados', 'Todo en Excel o PDF, con filtros')}${item('#renta', 'renta', 'Informe para la Renta', 'Ingresos y gastos deducibles de cada año')}</div>`)}
        ${sec('Herramientas', '', `<div class="lista">${item('extracto', 'banco', 'Extracto del banco', 'Apunta cobros y recibos domiciliados de una vez')}${item('importarCartera', 'subir', 'Importar desde Excel', 'Inmuebles, inquilinos y contratos')}</div>`)}
        ${sec('La app', '', `<div class="lista">${item('#ajustes', 'ajustes', 'Ajustes y copias', 'Tus datos, mensajes, avisos y copia de seguridad')}${item('#apariencia', 'paleta', 'Apariencia e idioma', 'Colores, tamaño de letra e idioma')}
          ${item('pro', 'estrella', S.pro ? 'Versión completa activada' : 'Versión completa', S.pro ? 'Inmuebles sin límite' : 'Gratis con un inmueble; pago único para añadir más')}${item('ayuda', 'ayuda', 'Ayuda', 'Cómo funciona y qué significan los estados')}</div>`)}
        <p class="sub centro">Mis alquileres ${APP_VERSION} · © 2026 IT Canarias</p>`;
    },
    inmuebles() {
      const l = S.inmuebles.filter((p) => V.archivados || !p.archivado).sort((a, b) => a.nombre.localeCompare(b.nombre));
      const hayArch = S.inmuebles.some((p) => p.archivado);
      return `${l.map((p) => { const ct = S.contratos.find((c) => c.inmuebleId === p.id && c.estado === 'activo' && c.inicio <= HOY && (!c.fin || c.fin >= HOY)), q = ct ? por(S.inquilinos, ct.inquilinoId) : null;
        return `<div class="tar toca${p.archivado ? ' apagada' : ''}" data-a="inmueble" data-id="${p.id}"><div class="fila"><span class="tit">${h(p.nombre)}</span><span class="imp">${ct ? eur(MA.rentaActual(ct, HOY)) + '/mes' : ''}</span></div>
          <div class="fila"><span class="sub">${h(p.tipo)}${q ? ' · ' + h(q.nombre) : ''}</span>${p.archivado ? '<span class="chip gris">Archivado</span>' : q ? '<span class="chip ok">Alquilado</span>' : '<span class="chip avi">Libre</span>'}</div></div>`; }).join('') || vacio('Sin inmuebles', 'Añade tu primer inmueble: plaza de garaje, trastero, vivienda, local…')}
        ${hayArch ? `<button class="btn ancho" data-a="verArchivados">${V.archivados ? 'Ocultar archivados' : 'Ver archivados'}</button>` : ''}<button class="fab" data-a="nuevoInmueble">+ Inmueble</button>`;
    },
    inquilinos() {
      const l = S.inquilinos.slice().sort((a, b) => (a.archivado ? 1 : 0) - (b.archivado ? 1 : 0) || a.nombre.localeCompare(b.nombre));
      return `${l.map((q) => { const ps = S.contratos.filter((c) => c.inquilinoId === q.id && c.estado === 'activo').map((c) => (por(S.inmuebles, c.inmuebleId) || {}).nombre);
        return `<div class="tar toca${q.archivado ? ' apagada' : ''}" data-a="inquilino" data-id="${q.id}"><div class="tit">${h(q.nombre)}</div><div class="sub">${h(ps.join(', ') || 'Sin contrato activo')}${q.telefono ? ' · ' + h(q.telefono) : ''}</div></div>`; }).join('') || vacio('Sin inquilinos', 'Puedes añadirlos aquí o al crear un contrato.')}
        <button class="fab" data-a="nuevoInquilino">+ Inquilino</button>`;
    },
    panel() {
      const k = MA.panel(S, HOY), c = k.cartera, pc = (n) => (n == null ? '—' : String(n).replace('.', ',') + ' %');
      if (!S.inmuebles.length) return vacio('Aún no hay datos', 'El panel se rellena cuando tengas inmuebles, contratos y cobros.');
      const max = Math.max(1, ...k.serie.map((x) => Math.max(x.ingresos, x.gastos + x.cuotas)));
      const barras = k.serie.map((x, i) => { const a = Math.round((x.ingresos / max) * 80), b = Math.round(((x.gastos + x.cuotas) / max) * 80), X = 6 + i * 26;
        return `<rect class="in" x="${X}" y="${90 - a}" width="10" height="${a}" rx="2"/><rect class="ga" x="${X + 11}" y="${90 - b}" width="10" height="${b}" rx="2"/><text x="${X + 10}" y="102" text-anchor="middle">${MESES[+x.mes.slice(5) - 1].slice(0, 3)}</text>`; }).join('');
      return `<div class="kpis"><div class="kpi"><span>Ocupación</span><b>${pc(c.ocupacion)}</b></div><div class="kpi"><span>Renta mensual</span><b>${eur(c.rentaMensual)}</b></div>
          <div class="kpi"><span>Deuda de inquilinos</span><b>${eur(k.morosidad.deuda)}</b></div><div class="kpi"><span>Fianzas en depósito</span><b>${eur(c.fianzas)}</b></div></div>
        ${sec('Últimos 12 meses', '', `<div class="tar"><svg class="graf" viewBox="0 0 320 106" role="img" aria-label="Ingresos y gastos por mes">${barras}</svg><div class="ley"><span><i></i>Cobrado</span><span><i class="ga"></i>Gastos e hipoteca</span></div>
          <table class="t"><tr><td>Cobrado</td><td>${eur(k.ultimos12.ingresos)}</td></tr><tr><td>Gastos (menos lo recuperado)</td><td>${eur(k.ultimos12.gastos)}</td></tr><tr><td>Cuotas de hipoteca</td><td>${eur(k.ultimos12.cuotas)}</td></tr><tr><td><b>Lo que te queda</b></td><td><b>${eur(k.ultimos12.flujo)}</b></td></tr></table></div>`)}
        ${sec('Por inmueble (12 meses)', '', `<div class="filas">${k.inmuebles.map((x) => `<button class="fila-l" data-a="inmueble" data-id="${x.id}"><span><b data-notr>${h(x.nombre)}</b><br><span class="sub">Cobrado ${eur(x.ingresos)}${x.neta != null ? `, rentabilidad ${pc(x.neta)}` : ''}</span></span><span class="der"><span class="imp">${eur(x.neto)}</span><span class="sub">neto</span></span></button>`).join('')}</div>
          <p class="sub esp">La rentabilidad se calcula sobre el precio de compra más gastos, o sobre el valor que hayas indicado.</p>`)}
        ${c.deudaHipotecaria ? sec('Patrimonio', '', `<div class="kpis"><div class="kpi"><span>Deuda hipotecaria</span><b>${eur(c.deudaHipotecaria)}</b></div><div class="kpi"><span>Valor menos deuda</span><b>${eur(c.patrimonio)}</b></div></div>`) : ''}`;
    },
    renta() {
      const tits = MA.titulares(S); if (V.titular && !tits.some((x) => x.clave === V.titular)) V.titular = undefined;
      const inf = informe(), t = inf.totales, act = inf.inmuebles.filter((x) => !x.sinActividad);
      const fila = (a, b, n) => `<tr><td>${n ? '<b>' + h(a) + '</b>' : h(a)}</td><td>${n ? '<b>' + b + '</b>' : b}</td></tr>`;
      return `<div class="nav"><button data-a="anioRenta" data-d="-1" aria-label="Año anterior">‹</button><b>Ejercicio ${V.renta}</b><button data-a="anioRenta" data-d="1" aria-label="Año siguiente"${V.renta >= +HOY.slice(0, 4) ? ' disabled' : ''}>›</button></div>
        <p class="nota">Resumen orientativo para preparar la declaración. Revísalo con Renta Web o con tu asesor: depende de que los datos estén completos.</p>
        ${tits.length > 1 ? `<label class="f">Titular<select data-titular>${tits.map((x) => `<option value="${x.clave === 'yo' ? '' : h(x.clave)}"${(V.titular || '') === (x.clave === 'yo' ? '' : x.clave) ? ' selected' : ''}>${x.yo ? h(Idioma.t('Tú') + (x.nombre ? ' (' + x.nombre + ')' : '')) : h(x.nombre)}</option>`).join('')}</select></label>` : ''}
        ${act.length ? `<div class="kpis"><div class="kpi"><span>Ingresos</span><b>${eur(t.ingresos)}</b></div><div class="kpi"><span>Gastos deducibles</span><b>${eur(t.gastos)}</b></div>
          <div class="kpi"><span>Rendimiento neto</span><b>${eur(t.neto)}</b></div><div class="kpi"><span>Tras reducción</span><b>${eur(t.reducido)}</b></div></div>` : ''}
        <div class="acc"><button class="btn pri" data-a="rentaPdf">Informe en PDF</button><button class="btn" data-a="rentaCsv">CSV para Excel</button></div><div class="esp"></div>
        ${inf.inmuebles.map((x) => `<section class="sec"><h2>${h(x.nombre)}<b>${x.sinActividad ? 'Sin alquiler' : eur(x.rendimientoReducido)}</b></h2><div class="tar">
          ${x.sinActividad ? '' : `<p class="sub">${x.diasAlquilado} días alquilado${x.diasVacio ? ` · ${x.diasVacio} sin alquilar` : ''}${x.referencia ? ' · ' + h(x.referencia) : ''}</p>
          <table class="t">${fila('Ingresos íntegros', eur(x.ingresos.total), 1)}${Object.entries(x.gastos).filter(([, v]) => v).map(([k, v]) => fila(inf.grupos[k], eur(v))).join('')}
            ${x.exceso ? fila('Exceso para años siguientes', '− ' + eur(x.exceso)) : ''}${x.arrastreAplicado ? fila('Excesos de años anteriores', eur(x.arrastreAplicado)) : ''}
            ${fila('Rendimiento neto', eur(x.rendimientoNeto), 1)}${x.reduccion ? fila(`Reducción ${String(x.reduccionPct).replace('.', ',')} %`, '− ' + eur(x.reduccion)) : ''}
            ${x.retenciones ? fila('Retenciones', eur(x.retenciones)) : ''}</table>`}
          ${x.imputacion ? `<p class="sub">Imputación por ${x.imputacion.dias} días sin alquilar: <b>${eur(x.imputacion.importe)}</b></p>` : ''}
          ${x.avisos.length ? `<div class="nota">${x.avisos.map(h).join('<br>')}</div>` : ''}
          <div class="acc"><button class="btn peq" data-a="datosFiscales" data-id="${x.id}">Datos catastrales y de compra</button></div></div></section>`).join('') || vacio('Sin datos de ese año', 'No hay inmuebles en propiedad ese año.')}`;
    },
    ajustes() {
      return `${sec('Tus datos y avisos', '', `<div class="lista">${item('misDatos', 'usuario', 'Mis datos', S.ajustes.propietario || 'Tu nombre y DNI para mensajes y recibos')}${item('plantillas', 'mensaje', 'Mensajes', 'Textos de los avisos por WhatsApp')}
          ${item('avisosConf', 'campana', 'Avisos en el móvil', !Avisos.disponible ? 'Disponibles en la app de Android' : S.ajustes.avisos ? `Activados, a las ${S.ajustes.horaAvisos || 9}:00` : 'Desactivados')}${item('#apariencia', 'paleta', 'Apariencia e idioma', 'Colores, tamaño de letra e idioma')}${item('seguridad', 'candado', 'Bloqueo con huella o PIN', !Bloqueo.disponible ? 'Disponible en la app de Android' : leerBloq().activo ? 'Activado' : 'Desactivado')}</div>`)}
        ${sec('Copia de seguridad', '', `<p class="nota">Tus datos están solo en este móvil. Si lo pierdes o lo cambias, la copia es la forma de recuperarlos.</p>
          <div class="lista">${item('copiasConf', 'reloj', 'Copias automáticas', resumenCopias())}${item('copia', 'nube', 'Guardar una copia ahora', S.ajustes.ultimaCopia ? 'Para Drive o el correo. Última: ' + fecha(S.ajustes.ultimaCopia) : 'Para Drive o el correo')}${item('restaurar', 'bajar', 'Recuperar una copia', 'Sustituye los datos actuales')}</div>
          ${confCopias().error && confCopias().error >= (confCopias().ultima || '') ? '<p class="nota esp">La última copia automática no se ha podido guardar. Revisa el espacio libre o guarda una copia a mano.</p>' : ''}
          ${confCopias().drive && confCopias().driveError && confCopias().driveError >= (confCopias().driveUltima || '') ? '<p class="nota esp">La última copia no se ha podido subir a Google Drive (sin conexión o sin permiso). Se volverá a intentar al abrir la app.</p>' : ''}`)}
        ${sec('Importar y exportar', '', `<div class="lista">${item('#informes', 'informe', 'Informes y listados', 'Excel o PDF de todo lo que tienes')}${item('importarCartera', 'subir', 'Importar desde Excel', 'Inmuebles, inquilinos y contratos')}${item('plantillaCartera', 'bajar', 'Descargar la plantilla', 'Para preparar la importación')}</div>`)}
        ${sec('Otros', '', `<div class="lista">${item('historial', 'reloj', 'Historial de cambios', 'Cobros, anulaciones y cambios anotados')}${item('privacidad', 'escudo', 'Privacidad', 'Qué datos guarda la app y dónde')}${item('borrarTodo', 'borrar', 'Borrar todos los datos', 'Deja la app como recién instalada')}</div>`)}`;
    },
    apariencia() {
      const a = leerAp(), b = (k, v, txt) => `<button data-a="ap" data-k="${k}" data-v="${v}" aria-pressed="${String(a[k]) === String(v)}">${h(txt)}</button>`;
      return `<section class="mes"><div class="et">Así se verá</div><div class="grande">${eur(65000)}</div><div class="de">de ${eur(85000)}</div><div class="barra-mes"><i data-w="76"></i></div></section>
        <div class="form-sec">Idioma</div><div class="lista">${Object.entries(Idioma.IDIOMAS).map(([c, nom]) => `<button data-a="idioma" data-v="${c}" aria-pressed="${Idioma.actual === c}"><span class="txt" data-notr>${nom}</span>${Idioma.actual === c ? `<span class="chip ok">✓</span>` : ''}</button>`).join('')}</div>
        <div class="form-sec">Tema</div><div class="segm">${b('tema', 'auto', 'Automático')}${b('tema', 'claro', 'Claro')}${b('tema', 'oscuro', 'Oscuro')}</div>
        <div class="form-sec">Color</div><div class="muestras">${ACENTOS.map(([c, nom]) => `<button class="muestra" data-a="ap" data-k="acento" data-v="${c}" aria-pressed="${a.acento === c}" aria-label="${h(nom)}" data-color="${c}"></button>`).join('')}</div>
        <div class="form-sec">Cabecera</div><div class="segm">${b('cab', 'oscura', 'Oscura')}${b('cab', 'acento', 'Del color elegido')}</div>
        <div class="form-sec">Tamaño de letra</div><div class="segm">${b('fs', 0.9, 'Pequeña')}${b('fs', 1, 'Normal')}${b('fs', 1.15, 'Grande')}${b('fs', 1.3, 'Muy grande')}</div>
        <div class="form-sec">Contraste</div><div class="segm">${b('contraste', false, 'Normal')}${b('contraste', true, 'Alto')}</div>
        <p class="sub">El color elegido también se usa en los recibos y en los informes en PDF.</p>`;
    },
    informes() {
      const F = V.filtros, op = (l, sel) => l.map((x) => `<option value="${x.id}"${sel === x.id ? ' selected' : ''}>${h(x.nombre)}</option>`).join('');
      const inf = (k, txt, sub, pdf) => `<div class="tar"><div class="tit">${h(txt)}</div>${sub ? `<div class="sub">${h(sub)}</div>` : ''}
        <div class="acc"><button class="btn peq" data-a="inf" data-k="${k}" data-f="xlsx">Excel</button>${pdf === false ? '' : `<button class="btn peq" data-a="inf" data-k="${k}" data-f="pdf">PDF</button>`}</div></div>`;
      return `<div class="tar"><div class="filtros">
          <label class="f">Inmueble<select data-filtro="inmuebleId"><option value="">Todos</option>${op(S.inmuebles, F.inmuebleId)}</select></label>
          <label class="f">Inquilino<select data-filtro="inquilinoId"><option value="">Todos</option>${op(S.inquilinos, F.inquilinoId)}</select></label>
          <label class="f">Desde<input type="date" data-filtro="desde" value="${F.desde || ''}"></label>
          <label class="f">Hasta<input type="date" data-filtro="hasta" value="${F.hasta || ''}"></label></div>
          <p class="sub">Las fechas se aplican a recibos, cobros, gastos, cuadro de hipoteca e historial.</p></div>
        <div class="acc esp"><button class="btn pri ancho" data-a="libroCompleto">Todo en un Excel (una hoja por listado)</button></div>
        ${sec('Cobros y deudas', '', inf('recibos', 'Recibos de alquiler', 'Cada mes, lo cobrado y lo pendiente') + inf('cobros', 'Cobros recibidos', 'Cada pago, con su fecha y método') + inf('deudas', 'Deudas por inquilino', 'Quién debe, cuánto y desde cuándo')
          + `<div class="tar"><div class="tit">Extracto de un inquilino</div><div class="sub">Lo que ha pagado y lo que debe, para enviárselo. Elige el inquilino arriba.</div><div class="acc"><button class="btn peq" data-a="extractoInq">PDF</button></div></div>`)}
        ${sec('Cartera', '', inf('inmuebles', 'Inmuebles') + inf('inquilinos', 'Inquilinos', 'Datos de contacto') + inf('contratos', 'Contratos', 'Fechas, renta, fianza y estado'))}
        ${sec('Gastos y finanzas', '', inf('gastos', 'Gastos') + inf('fianzas', 'Fianzas', 'Entregas, devoluciones y depósitos') + inf('hipotecas', 'Cuadro de hipoteca', 'Cuotas, intereses y capital pendiente') + inf('rentabilidad', 'Rentabilidad por inmueble', 'Últimos 12 meses'))}
        ${sec('Otros', '', inf('historial', 'Historial de cambios') + `<div class="tar"><div class="tit">Documentos y fotos</div><div class="sub">Todos los adjuntos en un archivo ZIP, ordenados por carpetas.</div><div class="acc"><button class="btn peq" data-a="zipDocs">ZIP</button></div></div>`
          + `<div class="tar"><div class="tit">Informe para la Renta</div><div class="sub">Por año, en PDF o Excel.</div><div class="acc"><a class="btn peq" href="#renta">Abrir</a></div></div>`)}`;
    },
  };
  const TITULOS = { inicio: 'Mis alquileres', cobros: 'Cobros', gastos: 'Gastos', contratos: 'Contratos', mas: 'Más', inmuebles: 'Inmuebles', inquilinos: 'Inquilinos', panel: 'Panel', ajustes: 'Ajustes y copias', renta: 'Informe para la Renta', informes: 'Informes y listados', apariencia: 'Apariencia e idioma' };
  const vistaActual = () => { const v = location.hash.slice(1); return VISTAS[v] ? v : 'inicio'; };
  function pinta() {
    const v = vistaActual(), el = $('#vista');
    $('#titulo').textContent = TITULOS[v]; $('#subtitulo').textContent = v === 'inicio' ? `${+HOY.slice(8)} de ${fmes(HOY.slice(0, 7))}` : '';
    const y = el.scrollTop; el.innerHTML = VISTAS[v](); el.scrollTop = y;
    for (const i of el.querySelectorAll('[data-w]')) i.style.width = Math.min(100, +i.dataset.w) + '%';
    const sub = ['inmuebles', 'inquilinos', 'panel', 'ajustes', 'renta', 'informes', 'apariencia'].includes(v), principal = sub ? 'mas' : v;
    $('#atras').hidden = !sub;
    for (const b of el.querySelectorAll('[data-color]')) b.style.background = b.dataset.color;
    for (const a of document.querySelectorAll('.barra a')) { const on = a.dataset.v === principal; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  }

  // ---------- Fichas y formularios de cada cosa ----------
  const opInmuebles = () => S.inmuebles.filter((p) => !p.archivado).map((p) => [p.id, p.nombre]);
  const D_INMUEBLE = [{ k: 'nombre', e: 'Nombre', req: 1, ayuda: 'Por ejemplo: Plaza 12, Piso de la calle Real…' }, { k: 'tipo', e: 'Tipo', t: 'select', op: MA.TIPOS.map((t) => [t, t]) },
    { k: 'direccion', e: 'Dirección' }, { k: 'referencia', e: 'Referencia catastral' }, { k: 'porUnidades', t: 'check', e: 'Se alquila por habitaciones o unidades', ayuda: 'Permite varios contratos a la vez en este inmueble.' },
    { h: 'Compra y valor (opcional)' }, { k: 'compraPrecio', e: 'Precio de compra', t: 'dinero' }, { k: 'compraGastos', e: 'Gastos de compra (impuestos, notaría, reforma)', t: 'dinero' }, { k: 'compraFecha', e: 'Fecha de compra', t: 'date' },
    { k: 'valor', e: 'Valor actual estimado', t: 'dinero' },
    { h: 'Para el informe de la Renta (opcional)' }, { k: 'valorCatastral', e: 'Valor catastral total', t: 'dinero', ayuda: 'Viene en el recibo del IBI.' },
    { k: 'valorCatastralConstruccion', e: 'Valor catastral de la construcción', t: 'dinero', ayuda: 'También en el recibo del IBI. Sirve para calcular la amortización.' },
    { k: 'imputacionPct', e: 'Imputación de rentas por días vacíos', t: 'select', op: [[1.1, '1,1 % (valor catastral revisado desde 1994)'], [2, '2 % (no revisado)']] },
    { k: 'notas', e: 'Notas', t: 'area' }];
  function formInmueble(p) {
    formulario({ titulo: p ? 'Editar inmueble' : 'Nuevo inmueble', defs: p ? D_INMUEBLE : [...D_INMUEBLE.slice(0, 5), { k: 'tipicos', t: 'check', e: 'Añadir los gastos habituales de este tipo (IBI, comunidad…)', def: true }, ...D_INMUEBLE.slice(5)], valores: p || { tipo: 'Plaza de garaje' },
      alGuardar: (d) => { if (p) return MA.editarInmueble(S, p.id, d); const n = MA.crearInmueble(S, d, HOY); if (d.tipicos) MA.cargarTipicos(S, n.id, HOY); return n; },
      despues: (n) => { if (!p) fichaInmueble(n.id); } });
  }
  function fichaInmueble(i) {
    const p = por(S.inmuebles, i); if (!p) return cerrar();
    const k = MA.panel(S, HOY).inmuebles.find((x) => x.id === i), hip = MA.situacionHipoteca(p.hipoteca, HOY), cs = S.conceptos.filter((c) => c.inmuebleId === i && !c.hipoteca);
    const cts = S.contratos.filter((c) => c.inmuebleId === i).sort((a, b) => (a.estado === 'activo' ? 0 : 1) - (b.estado === 'activo' ? 0 : 1) || b.inicio.localeCompare(a.inicio));
    hoja(p.nombre, `<p class="sub">${h(p.tipo)}${p.direccion ? `<br><span data-notr>${h(p.direccion)}</span>` : ''}</p>
      ${k ? `<div class="kpis esp"><div class="kpi"><span>Cobrado en 12 meses</span><b>${eur(k.ingresos)}</b></div><div class="kpi"><span>Neto en 12 meses</span><b>${eur(k.neto)}</b></div></div>` : ''}
      <h3>Contratos</h3>${cts.length ? `<div class="filas">${cts.map((ct) => `<button class="fila-l" data-a="contrato" data-id="${ct.id}"><span><b data-notr>${h((por(S.inquilinos, ct.inquilinoId) || {}).nombre)}</b><br><span class="sub">Desde el ${fecha(ct.inicio)}</span></span><span class="der"><span class="imp">${eur(MA.rentaActual(ct, HOY))}</span>${chip(E_CONTRATO, MA.situacionContrato(ct, HOY))}</span></button>`).join('')}</div>`
        : `<p class="sub">Sin contratos.</p>`}
      ${!p.archivado ? `<div class="acc"><button class="btn peq" data-a="nuevoContrato" data-id="${i}">${svg('mas')} Nuevo contrato</button></div>` : ''}
      <h3>Gastos periódicos</h3>${cs.length ? `<div class="filas">${cs.map((c) => `<button class="fila-l" data-a="concepto" data-id="${c.id}"><span><b data-notr>${h(c.concepto)}</b><br><span class="sub">${h(c.periodicidad)}, ${h(MA.RESPONSABLES[c.responsable].toLowerCase())}${c.domiciliado ? ', domiciliado' : ''}${c.activo ? '' : ', dado de baja'}</span></span><span class="imp">${c.importe ? eur(c.importe) : '—'}</span></button>`).join('')}</div>` : '<p class="sub">Ninguno todavía.</p>'}
      ${cs.some((c) => c.activo && c.responsable !== 'inquilino' && !c.importe) ? '<p class="nota esp">Los gastos sin importe no se apuntan: toca cada uno y ponle el importe.</p>' : ''}
      <div class="acc"><button class="btn peq" data-a="nuevoConcepto" data-id="${i}">${svg('mas')} Añadir gasto periódico</button><button class="btn txt peq" data-a="tipicos" data-id="${i}">Añadir los habituales</button></div>
      <h3>Hipoteca</h3>${hip ? `<div class="filas"><button class="fila-l" data-a="hipoteca" data-id="${i}"><span><b>Cuota ${eur(hip.cuota)}</b><br><span class="sub">${hip.restantes} cuotas pendientes, hasta el ${fecha(hip.fin)}</span></span><span class="der"><span class="imp">${eur(hip.pendiente)}</span><span class="sub">pendiente</span></span></button></div>`
        : `<div class="acc"><button class="btn peq" data-a="hipoteca" data-id="${i}">${svg('mas')} Añadir hipoteca</button></div>`}
      ${docsHtml('inmueble', i)}
      <details class="mas-op"><summary>Más acciones</summary><div class="acc"><button class="btn peq" data-a="editarInmueble" data-id="${i}">Editar datos</button><button class="btn peq" data-a="datosFiscales" data-id="${i}">Datos catastrales y de compra</button>
        <button class="btn peq" data-a="archivarInmueble" data-id="${i}">${p.archivado ? 'Recuperar' : 'Archivar'}</button><button class="btn rojo peq" data-a="eliminarInmueble" data-id="${i}">Eliminar</button></div></details>`);
  }
  const D_CONCEPTO = [{ k: 'concepto', e: 'Concepto', req: 1 }, { k: 'categoria', e: 'Categoría', t: 'select', op: Object.entries(MA.CATEGORIAS).filter(([a]) => a !== 'financiacion') },
    { k: 'responsable', e: '¿Quién lo paga?', t: 'select', op: Object.entries(MA.RESPONSABLES) }, { k: 'porcentaje', e: 'Si se lo cobras al inquilino, ¿qué porcentaje?', t: 'num', def: 100 },
    { k: 'importe', e: 'Importe de cada recibo', t: 'dinero' }, { k: 'periodicidad', e: 'Cada cuánto', t: 'select', op: Object.keys(MA.PERIODICIDADES).map((x) => [x, x]) },
    { k: 'mesInicio', e: 'Mes del primer recibo del año', t: 'select', op: MESES.map((m, i) => [i + 1, m]) }, { k: 'dia', e: 'Día del mes', t: 'num', def: 1 }, { k: 'desde', e: 'Desde qué mes', t: 'month' },
    { k: 'domiciliado', t: 'check', e: 'Domiciliado en el banco', ayuda: 'Al llegar la fecha quedará «por confirmar» hasta que compruebes el cargo.' }];
  function formConcepto(c, inmuebleId) {
    formulario({ titulo: c ? c.concepto : 'Nuevo gasto periódico', defs: D_CONCEPTO, valores: c || { categoria: 'otro', responsable: 'propietario', periodicidad: 'anual', mesInicio: 1, desde: HOY.slice(0, 7) },
      alGuardar: (d) => (c ? MA.editarConcepto(S, c.id, d, HOY) : MA.crearConcepto(S, { inmuebleId, ...d }, HOY)), despues: () => fichaInmueble(c ? c.inmuebleId : inmuebleId),
      pie: c ? `<div class="acc"><button class="btn rojo" data-a="eliminarConcepto" data-id="${c.id}">Dar de baja este gasto</button></div>` : '' });
  }
  function formHipoteca(i) {
    const p = por(S.inmuebles, i), v = p.hipoteca || {};
    formulario({ titulo: 'Hipoteca de ' + p.nombre, valores: v, defs: [{ k: 'importe', e: 'Importe prestado', t: 'dinero', req: 1 }, { k: 'tin', e: 'Interés anual (%)', t: 'num' }, { k: 'anios', e: 'Plazo en años', t: 'num', req: 1 },
      { k: 'inicio', e: 'Fecha de la primera cuota', t: 'date', req: 1 }, { k: 'cuota', e: 'Cuota mensual real (opcional)', t: 'dinero', ayuda: 'Si la dejas vacía se calcula con el sistema francés.' }],
      alGuardar: (d) => MA.ponerHipoteca(S, i, d, HOY), despues: () => fichaInmueble(i),
      pie: p.hipoteca ? `<div class="acc"><button class="btn rojo" data-a="quitarHipoteca" data-id="${i}">Quitar la hipoteca</button></div>` : '<p class="sub">Las cuotas anteriores a hoy se apuntan como pagadas y marcadas «estimado».</p>' });
  }
  const D_INQUILINO = [{ k: 'nombre', e: 'Nombre y apellidos', req: 1 }, { k: 'telefono', e: 'Teléfono (para WhatsApp)', t: 'tel' },
    { k: 'idioma', e: 'Idioma de sus mensajes y recibos', t: 'select', op: [['', 'El de la app'], ...Object.entries(Idioma.IDIOMAS)] }, { k: 'dni', e: 'DNI / NIE' }, { k: 'email', e: 'Correo', t: 'email' }, { k: 'domicilio', e: 'Domicilio' }, { k: 'notas', e: 'Notas', t: 'area' }];
  function formInquilino(q) {
    formulario({ titulo: q ? 'Editar inquilino' : 'Nuevo inquilino', defs: D_INQUILINO, valores: q, alGuardar: (d) => (q ? MA.editarInquilino(S, q.id, d) : MA.crearInquilino(S, d)),
      pie: q ? `<div class="acc">${q.telefono ? `<button class="btn" data-a="chat" data-id="${q.id}">Abrir WhatsApp</button>` : ''}<button class="btn" data-a="archivarInquilino" data-id="${q.id}">${q.archivado ? 'Recuperar' : 'Archivar'}</button><button class="btn rojo" data-a="eliminarInquilino" data-id="${q.id}">Eliminar</button></div>` : '' });
  }
  const D_ACTUALIZACION = [['auto', 'Según la ley (IRAV o IPC)'], ['irav', 'IRAV'], ['ipc', 'IPC'], ['fijo', 'Porcentaje fijo pactado'], ['ninguna', 'No se actualiza']];
  function formContrato(inmuebleId) {
    if (!opInmuebles().length) return toast('Añade antes un inmueble');
    const qs = S.inquilinos.filter((q) => !q.archivado).map((q) => [q.id, q.nombre]);
    formulario({ titulo: 'Nuevo contrato', boton: 'Crear contrato', valores: { inmuebleId, inicio: HOY, diaCobro: 1, avisoMeses: 1, actualizacion: 'auto', inquilinoId: qs.length ? qs[0][0] : 'nuevo' },
      defs: [{ k: 'inmuebleId', e: 'Inmueble', t: 'select', op: opInmuebles() }, { k: 'inquilinoId', e: 'Inquilino', t: 'select', op: [...qs, ['nuevo', '+ Nuevo inquilino…']] },
        { html: '<div id="nuevoInq">' }, { k: 'nNombre', e: 'Nombre del inquilino' }, { k: 'nTelefono', e: 'Teléfono (para WhatsApp)', t: 'tel' }, { html: '</div>' },
        { k: 'importe', e: 'Renta mensual', t: 'dinero', req: 1 }, { html: '<div class="dos">' }, { k: 'inicio', e: 'Desde', t: 'date', req: 1 }, { k: 'diaCobro', e: 'Día de cobro', t: 'num' }, { html: '</div>' },
        { det: 'Más opciones: fin, fianza, avisos y actualización' }, { k: 'fin', e: 'Fecha de fin (vacía si no tiene)', t: 'date' },
        { k: 'fianza', e: 'Fianza acordada', t: 'dinero' }, { k: 'avisoMeses', e: 'Avisar del vencimiento con (meses)', t: 'num' },
        { k: 'actualizacion', e: 'Actualización anual de la renta', t: 'select', op: D_ACTUALIZACION, ayuda: 'Vivienda firmada desde el 26/05/2023: IRAV. Antes, o para otros usos: lo que diga el contrato (normalmente IPC).' },
        { k: 'historicoCobrado', t: 'check', e: 'Dar por cobrados los meses anteriores a este', ayuda: 'Solo si el contrato empezó antes de usar la app. Quedarán marcados como estimados.' }, { k: 'notas', e: 'Notas', t: 'area' }, { detFin: 1 }],
      alMontar: (f) => { const ver = () => { $('#nuevoInq', f).hidden = f.elements.inquilinoId.value !== 'nuevo'; }; f.elements.inquilinoId.onchange = ver; ver(); },
      despues: (ct) => { if (ct && ct.fianza) toast('Contrato creado. Cuando cobres la fianza, apúntala en el contrato.'); },
      alGuardar: (d) => {
        if (d.importe == null) throw Object.assign(new Error('Indica la renta mensual'), { code: 'IMPORTE' });
        let inq = Number(d.inquilinoId), creado = null;
        if (d.inquilinoId === 'nuevo') { creado = MA.crearInquilino(S, { nombre: d.nNombre, telefono: d.nTelefono }); inq = creado.id; }
        if (d.actualizacion === 'auto') delete d.actualizacion;
        try { return MA.crearContrato(S, { ...d, inmuebleId: Number(d.inmuebleId), inquilinoId: inq, fin: d.fin || null, fianza: d.fianza || 0, diaCobro: d.diaCobro == null ? 1 : d.diaCobro, avisoMeses: d.avisoMeses == null ? 1 : d.avisoMeses }, HOY); }
        catch (e) { if (creado) MA.eliminarInquilino(S, creado.id); throw e; }
      } });
  }
  function fichaContrato(i) {
    const ct = por(S.contratos, i); if (!ct) return cerrar();
    const q = por(S.inquilinos, ct.inquilinoId) || {}, p = por(S.inmuebles, ct.inmuebleId) || {}, sit = MA.situacionContrato(ct, HOY), saldo = MA.saldoFianza(S, i), fin = MA.finEfectivo(ct);
    const cs = MA.cargos(S, HOY, (c) => c.contratoId === i).reverse(), fz = S.fianzas.filter((f) => f.contratoId === i && !f.anulado), act = MA.actualizacionPendiente(S, ct, HOY), dep = ct.deposito || {};
    const deuda = cs.filter((c) => c.estado === 'atrasado' || (c.estado === 'parcial' && c.vence < HOY)).reduce((t, c) => t + c.pendiente, 0), activo = ct.estado === 'activo';
    const conFianza = ct.fianza > 0 || fz.length || saldo > 0;
    hoja(q.nombre, `<p class="sub" data-notr>${h(p.nombre)}</p><p class="esp">${chip(E_CONTRATO, sit)} <span class="sub">${fin ? `del ${fecha(ct.inicio)} al ${fecha(fin)}` : `desde el ${fecha(ct.inicio)}`}, cobro el día ${ct.diaCobro}</span></p>
      <div class="kpis"><div class="kpi"><span>Renta</span><b>${eur(MA.rentaActual(ct, HOY))}</b></div><div class="kpi"><span>${deuda ? 'Debe' : 'Situación'}</span><b>${deuda ? eur(deuda) : 'Al día'}</b></div></div>
      ${act ? `<div class="nota">Toca actualizar la renta el ${fecha(act.fecha)} (${act.indice === 'fijo' ? 'porcentaje pactado' : act.indice.toUpperCase()}).<div class="acc"><button class="btn pri peq" data-a="actualizar" data-id="${i}">Actualizar la renta</button></div></div>` : ''}
      <div class="acc">${deuda ? `<button class="btn pri" data-a="cobrarDeuda" data-id="${i}">Cobrar</button><button class="btn" data-a="avisarDeuda" data-id="${i}">Avisar</button>` : ''}${q.telefono ? `<button class="btn" data-a="chat" data-id="${q.id}">WhatsApp</button>` : ''}<button class="btn" data-a="extractoInq" data-id="${q.id}">Extracto</button></div>
      <h3>Recibos</h3><div class="filas">${cs.slice(0, 24).map((c) => `<button class="fila-l" data-a="cobro" data-id="${c.id}"><span><b>${fmes(c.periodo)}</b><br><span class="sub">${c.pagado ? `Cobrado ${eur(c.pagado)}` : `Vence el ${fecha(c.vence)}`}</span></span><span class="der"><span class="imp">${eur(c.importe)}</span>${chip(E_CARGO, c.estado)}</span></button>`).join('') || '<p class="sub">Aún no hay recibos.</p>'}</div>
      ${cs.length > 24 ? `<p class="sub">Y ${cs.length - 24} recibos anteriores: están en Cobros y en Informes y listados.</p>` : ''}
      <h3>Renta</h3><table class="t">${ct.rentas.map((r) => `<tr><td>Desde ${fmes(r.desde)}</td><td>${eur(r.importe)}</td></tr>`).join('')}</table>
      <p class="sub">Actualización anual: ${h(MA.INDICES[ct.actualizacion] || '—')}${ct.actualizacion === 'fijo' && ct.actualizacionPct != null ? ' (' + MA.pctTexto(ct.actualizacionPct) + ')' : ''}</p>
      ${conFianza ? `<h3>Fianza</h3><div class="kpis"><div class="kpi"><span>Acordada</span><b>${eur(ct.fianza)}</b></div><div class="kpi"><span>En tu poder</span><b>${eur(saldo)}</b></div></div>
        ${fz.length ? `<table class="t">${fz.map((f) => `<tr><td>${fecha(f.fecha)}, ${f.tipo}</td><td>${eur(f.importe)}</td></tr>`).join('')}</table>` : ''}
        ${dep.fecha ? `<p class="sub">Depositada en ${h(dep.organismo)} el ${fecha(dep.fecha)}${dep.referencia ? ` (ref. ${h(dep.referencia)})` : ''}${dep.recuperado ? `. Recuperada el ${fecha(dep.recuperado)}` : ''}.</p>${!activo && !dep.recuperado ? `<div class="acc"><button class="btn peq" data-a="recuperarDeposito" data-id="${i}">Ya la he recuperado del organismo</button></div>` : ''}`
          : !dep.noAplica && saldo > 0 ? `<p class="nota">Fianza sin depositar. En Canarias se deposita en el Instituto Canario de la Vivienda en el mes siguiente a la firma.</p><div class="acc"><button class="btn peq" data-a="deposito" data-id="${i}">Registrar el depósito</button><button class="btn txt peq" data-a="depositoNoAplica" data-id="${i}">No hay que depositarla</button></div>` : ''}
        <div class="acc">${!saldo ? `<button class="btn peq" data-a="fianza" data-id="${i}" data-t="recibida">Apuntar fianza recibida</button>` : `<button class="btn peq" data-a="fianza" data-id="${i}" data-t="devuelta">Devolver</button><button class="btn peq" data-a="fianza" data-id="${i}" data-t="retenida">Retener una parte</button>`}</div>` : ''}
      ${docsHtml('contrato', i)}
      <details class="mas-op"><summary>Más acciones</summary><div class="acc">${activo ? `<button class="btn peq" data-a="revisar" data-id="${i}">Cambiar la renta</button><button class="btn peq" data-a="renovar" data-id="${i}">Renovar</button><button class="btn peq" data-a="editarContrato" data-id="${i}">Editar</button>` : `<button class="btn peq" data-a="renovar" data-id="${i}">Reactivar y renovar</button>`}
        ${ct.fin && activo ? `<button class="btn peq" data-a="avisoFin" data-id="${i}">Avisar del vencimiento</button>` : ''}${!conFianza ? `<button class="btn peq" data-a="fianza" data-id="${i}" data-t="recibida">Apuntar fianza</button>` : ''}
        ${activo ? `<button class="btn peq" data-a="finalizar" data-id="${i}">Finalizar</button>` : ''}<button class="btn rojo peq" data-a="eliminarContrato" data-id="${i}">Eliminar</button></div></details>`);
  }
  function fichaCobro(i) {
    const c = MA.cargos(S, HOY, (x) => x.id === i)[0]; if (!c) return cerrar();
    const ps = S.pagos.filter((p) => p.cargoId === i).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id), vivo = c.estado !== 'pagado' && c.estado !== 'anulado';
    hoja(`${c.inquilino} · ${fmes(c.periodo)}`, `<p>${chip(E_CARGO, c.estado)} <span class="sub">${h(c.inmueble)} · vence ${fecha(c.vence)}</span></p>
      <div class="kpis"><div class="kpi"><span>Renta</span><b>${eur(c.importe)}</b></div><div class="kpi"><span>Pendiente</span><b>${eur(c.pendiente)}</b></div></div>
      ${c.anulado ? `<p class="nota">Anulado el ${fecha(c.anulado.fecha)}: ${h(c.anulado.motivo)}</p>` : ''}
      ${vivo ? `<h3>Registrar un cobro</h3><form id="fpago" novalidate><div class="error" hidden role="alert"></div><div class="dos">${campos([{ k: 'importe', e: 'Importe', t: 'dinero' }, { k: 'fecha', e: 'Fecha', t: 'date' }], { importe: c.pendiente, fecha: HOY })}</div>
        ${campos([{ k: 'metodo', e: 'Método', t: 'select', op: ['Transferencia', 'Bizum', 'Efectivo', 'Domiciliación', 'Otro'].map((x) => [x, x]) }, { k: 'repartir', t: 'check', e: 'Si sobra, aplicarlo a otros recibos pendientes de este contrato' }], { metodo: c.metodo || 'Transferencia' })}
        <button class="btn pri ancho" type="submit">Registrar cobro</button></form>` : ''}
      ${ps.length ? `<h3>Cobros de este recibo</h3>${ps.map((p) => `<div class="tar${p.anulado ? ' apagada' : ''}"><div class="fila"><span>${fecha(p.fecha)} · ${h(p.metodo || '—')}${p.origen === 'estimado' ? ' · estimado' : ''}</span><span class="imp">${eur(p.importe)}</span></div>
        ${p.anulado ? `<div class="sub">Anulado el ${fecha(p.anulado.fecha)}: ${h(p.anulado.motivo)}</div>` : `<div class="acc"><button class="btn peq rojo" data-a="anularPago" data-id="${p.id}" data-c="${i}">Anular este cobro</button></div>`}</div>`).join('')}` : ''}
      <h3>Más</h3><div class="acc">${vivo ? `<button class="btn" data-a="avisar" data-id="${i}">Avisar al inquilino</button>` : ''}${c.pagado ? `<button class="btn pri" data-a="reciboPdf" data-id="${i}">Recibo en PDF</button><button class="btn" data-a="recibo" data-id="${i}">Confirmar por WhatsApp</button>` : ''}
        ${!c.anulado ? `<button class="btn" data-a="ajustarCargo" data-id="${i}">Cambiar el importe</button>` : ''}${c.anulado ? `<button class="btn" data-a="restaurarCargo" data-id="${i}">Recuperar el recibo</button>` : !c.pagado ? `<button class="btn rojo" data-a="anularCargo" data-id="${i}">Anular el recibo</button>` : ''}</div>`, (el) => {
      const f = $('#fpago', el); if (!f) return; const k = clave(); let enviando = false;
      f.onsubmit = (e) => { e.preventDefault(); if (enviando) return; enviando = true;
        try { const d = leer(f, [{ k: 'importe', t: 'dinero' }, { k: 'fecha' }, { k: 'metodo' }, { k: 'repartir', t: 'check' }]);
          if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' });
          MA.registrarPago(S, { cargoId: i, ...d, clave: k }, HOY); guardar(); pinta(); fichaCobro(i); toast('Cobro registrado'); }
        catch (x) { enviando = false; const b = $('.error', f); b.textContent = x.code ? x.message : 'No se ha podido registrar.'; b.hidden = false; } };
    });
  }
  function formGasto() {
    formulario({ titulo: 'Nuevo gasto', valores: { fecha: HOY, categoria: 'mantenimiento', pagado: true }, defs: [{ k: 'inmuebleId', e: 'Inmueble', t: 'select', op: opInmuebles() }, { k: 'concepto', e: 'Concepto', req: 1 },
      { k: 'categoria', e: 'Categoría', t: 'select', op: Object.entries(MA.CATEGORIAS).filter(([a]) => a !== 'financiacion') }, { k: 'importe', e: 'Importe', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' },
      { k: 'pagado', t: 'check', e: 'Ya está pagado' }, { k: 'repercutir', e: 'Parte que le cobras al inquilino (opcional)', t: 'dinero' }, { k: 'notas', e: 'Notas', t: 'area' }],
      alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.crearGasto(S, { ...d, inmuebleId: Number(d.inmuebleId), repercutir: d.repercutir || 0 }, HOY); } });
  }
  function fichaGasto(i) {
    const g = MA.gastos(S, HOY, (x) => x.id === i)[0]; if (!g) return cerrar();
    const rs = S.reembolsos.filter((r) => r.gastoId === i), pte = !g.pagado && !g.anulado;
    hoja(`${g.concepto} · ${g.inmueble}`, `<p>${chip(E_GASTO, g.estado)} <span class="sub">${h(MA.CATEGORIAS[g.categoria])} · ${h(g.periodo)} · ${fecha(g.fecha)}</span></p>
      <div class="kpis"><div class="kpi"><span>Importe${g.estimado ? ' (estimado)' : ''}</span><b>${eur(g.importe)}</b></div><div class="kpi"><span>${g.pagado ? 'Pagado el' : 'Estado'}</span><b>${g.pagado ? fecha(g.pagado.fecha) : E_GASTO[g.estado][0]}</b></div></div>
      ${g.anulado ? `<p class="nota">Anulado el ${fecha(g.anulado.fecha)}: ${h(g.anulado.motivo)}</p>` : ''}
      ${pte ? `<h3>Marcar como pagado</h3><form id="fgasto" novalidate><div class="error" hidden role="alert"></div><div class="dos">${campos([{ k: 'importe', e: 'Importe real', t: 'dinero' }, { k: 'fecha', e: 'Fecha de pago', t: 'date' }], { importe: g.importe, fecha: g.fecha <= HOY ? g.fecha : HOY })}</div><button class="btn pri ancho" type="submit">Pagado</button></form>` : ''}
      ${g.partes && !g.anulado ? `<h3>Reparto entre los inquilinos</h3><p class="sub">${eur(g.repercutir)} a partes iguales entre ${g.partes.length} inquilinos.</p><div class="filas">${g.partes.map((x) => `<div class="fila-l"><span><b data-notr>${h(x.inquilino)}</b><br><span class="sub">${x.pendiente ? `${h(Idioma.t('Debe'))} ${eur(x.pendiente)}` : h(Idioma.t('Ya ha pagado'))} · ${eur(x.importe)}</span></span>${x.pendiente ? `<span class="der"><button class="btn pri peq" data-a="cobrarGasto" data-id="${i}" data-c="${x.contratoId}">Cobrar</button><button class="btn peq" data-a="avisarGasto" data-id="${i}" data-c="${x.contratoId}">Avisar</button></span>` : ''}</div>`).join('')}</div>
        ${rs.map((r) => `<div class="tar${r.anulado ? ' apagada' : ''}"><div class="fila"><span>${fecha(r.fecha)} · <span data-notr>${h((g.partes.find((x) => x.contratoId === r.contratoId) || {}).inquilino || '')}</span>${r.anulado ? ' · anulado' : ''}</span><span class="imp">${eur(r.importe)}</span></div>${r.anulado ? '' : `<div class="acc"><button class="btn peq rojo" data-a="anularReembolso" data-id="${r.id}" data-g="${i}">Anular</button></div>`}</div>`).join('')}` : ''}
      ${g.repercutir > 0 && !g.anulado && !g.partes ? `<h3>Cobro al inquilino</h3><p class="sub">${h(g.inquilino)} debe pagarte ${eur(g.repercutir)}. Cobrado: ${eur(g.cobrado)}.</p>
        ${rs.map((r) => `<div class="tar${r.anulado ? ' apagada' : ''}"><div class="fila"><span>${fecha(r.fecha)}${r.anulado ? ' · anulado' : ''}</span><span class="imp">${eur(r.importe)}</span></div>${r.anulado ? '' : `<div class="acc"><button class="btn peq rojo" data-a="anularReembolso" data-id="${r.id}" data-g="${i}">Anular</button></div>`}</div>`).join('')}
        ${g.porCobrar > 0 ? `<div class="acc"><button class="btn pri" data-a="cobrarGasto" data-id="${i}">Registrar cobro</button><button class="btn" data-a="avisarGasto" data-id="${i}">Avisar al inquilino</button></div>` : ''}` : ''}
      ${docsHtml('gasto', i)}
      <h3>Más</h3><div class="acc">${g.pagado && !g.anulado ? `<button class="btn" data-a="desconfirmar" data-id="${i}">No está pagado (recibo devuelto)</button>` : ''}${!g.anulado ? `<button class="btn rojo" data-a="anularGasto" data-id="${i}">Anular el gasto</button>` : ''}</div>`, (el) => {
      const f = $('#fgasto', el); if (!f) return;
      f.onsubmit = (e) => { e.preventDefault();
        try { const d = leer(f, [{ k: 'importe', t: 'dinero' }, { k: 'fecha' }]); MA.confirmarGasto(S, i, { importe: d.importe == null ? undefined : d.importe, fecha: d.fecha || undefined }, HOY); guardar(); pinta(); fichaGasto(i); }
        catch (x) { const b = $('.error', f); b.textContent = x.code ? x.message : 'No se ha podido guardar.'; b.hidden = false; } };
    });
  }

  // ---------- Documentos y fotos ----------
  const docsHtml = (tipo, id) => `<h3>Documentos y fotos</h3><div class="docs" data-docs="${tipo}:${id}"></div>
    <div class="acc"><label class="btn peq">+ Añadir foto o documento<input type="file" accept="image/*,application/pdf" data-adjuntar="${tipo}:${id}" hidden></label></div>`;
  async function montarDocs(el) {
    const [tipo, id] = el.dataset.docs.split(':'), l = MA.adjuntosDe(S, tipo, +id);
    el.innerHTML = l.length ? l.map((a) => `<button class="doc" data-a="verDoc" data-id="${a.id}" aria-label="${h(a.nombre)}">${/^image\//.test(a.mime) ? `<img alt="" data-arch="${h(a.archivo)}">` : `<span>📄</span>`}<small>${h(a.nombre)}</small></button>`).join('')
      : '<p class="sub">Contrato firmado, DNI, facturas, fotos del estado al entrar y al salir…</p>';
    for (const img of el.querySelectorAll('img[data-arch]')) Adjuntos.url(img.dataset.arch).then((u) => { if (u) img.src = u; }).catch(() => {});
  }
  function abrirPadre(tipo, id) { ({ inmueble: fichaInmueble, contrato: fichaContrato, gasto: fichaGasto, inquilino: (x) => formInquilino(por(S.inquilinos, x)) })[tipo](id); }
  document.addEventListener('change', (e) => { if (e.target.dataset && e.target.dataset.titular != null) { V.titular = e.target.value || undefined; pinta(); return; } const f = e.target.dataset && e.target.dataset.filtro; if (!f) return; const v = e.target.value; V.filtros[f] = !v ? undefined : /Id$/.test(f) ? Number(v) : v; });
  document.addEventListener('change', async (e) => {
    const inp = e.target; if (!inp.dataset || !inp.dataset.adjuntar || !inp.files[0]) return;
    const [tipo, id] = inp.dataset.adjuntar.split(':'), f = inp.files[0];
    toast('Guardando…');
    try { const g = await Adjuntos.guardar(f); MA.agregarAdjunto(S, { tipo, id: +id, ...g }, HOY); guardar(); abrirPadre(tipo, +id); toast('Documento guardado'); }
    catch (x) { toast(x.code ? x.message : 'No se ha podido guardar el archivo'); }
  });

  // ---------- Extracto del banco: revisión antes de apuntar ----------
  function revisarExtracto(pr) {
    const utiles = pr.filter((x) => x.tipo === 'cobro' || x.tipo === 'gasto'), ya = pr.filter((x) => x.tipo === 'ya').length, nada = pr.filter((x) => x.tipo === 'nada');
    hoja('Revisa antes de apuntar', `<p class="sub">${pr.length} movimientos leídos · ${utiles.length} coinciden${ya ? ` · ${ya} ya estaban apuntados` : ''}.</p>
      ${utiles.length ? utiles.map((x, n) => `<label class="f chk tar"><input type="checkbox" data-n="${n}"${x.confianza === 'alta' ? ' checked' : ''}><span><b>${fecha(x.fecha)} · ${eur(Math.abs(x.importe))}</b> ${x.tipo === 'cobro' ? '→ cobro' : '→ gasto pagado'}<br>
        <span class="sub">${h(x.motivo)}</span><br><small class="sub">Banco: ${h(x.concepto || '—')}</small>${x.confianza === 'alta' ? '' : '<br><span class="chip avi">Comprueba</span>'}</span></label>`).join('')
        + '<button class="btn pri ancho" data-x="aplicar">Apuntar los marcados</button>' : '<p class="nota">No hay movimientos que coincidan con recibos o gastos pendientes.</p>'}
      ${nada.length ? `<h3>Sin coincidencia (${nada.length})</h3><p class="sub">Si alguno es un cobro, apúntalo a mano desde el recibo.</p>${nada.slice(0, 30).map((x) => `<div class="sub">${fecha(x.fecha)} · ${eur(x.importe)} · ${h((x.concepto || '').slice(0, 60))}</div>`).join('')}` : ''}`, (el) => {
      const b = $('[data-x=aplicar]', el); if (!b) return;
      b.onclick = () => { const marc = [...el.querySelectorAll('input[data-n]:checked')].map((i) => utiles[+i.dataset.n]);
        if (!marc.length) return toast('No has marcado ninguno');
        const r = MA.aplicarConciliacion(S, marc, HOY); guardar(); cerrar(); pinta();
        toast(`Apuntados ${r.cobros} cobros y ${r.gastos} gastos${r.errores.length ? ` · ${r.errores.length} con error` : ''}`); };
    });
  }

  // ---------- Botones de las notificaciones ----------
  function alPulsarAviso(accion, d) {
    try {
      alDia();
      if (accion === 'cobrado' && d.contratoId && d.periodo) {
        const r = MA.cobroDesdeAviso(S, d, HOY); guardar(); pinta();
        if (r.repetido) return toast('Ese recibo ya estaba cobrado');
        return toast(`Cobrado ${eur(r.importe)}`, [['Enviar recibo', () => A.reciboPdf(r.cargoId)], ['Deshacer', () => haz(() => S.pagos.filter((p) => p.cargoId === r.cargoId && !p.anulado).forEach((p) => MA.anularPago(S, p.id, 'Marcado por error', HOY)))]]);
      }
      const c = d.contratoId && d.periodo ? S.cargos.find((x) => x.contratoId === d.contratoId && x.periodo === d.periodo) : null;
      if (accion === 'avisar' && c) return msgCobro(MA.cargos(S, HOY, (x) => x.id === c.id)[0]);
      if (c) return fichaCobro(c.id);
      if (d.gastoId) return fichaGasto(d.gastoId);
      if (d.contratoId) return fichaContrato(d.contratoId);
    } catch (e) { fallo(e); }
  }

  // ---------- Versión completa ----------
  async function hojaPro(motivo) {
    if (S.pro) return hoja('Versión completa', '<p>Ya tienes la versión completa: puedes añadir todos los inmuebles que quieras. Gracias.</p>');
    hoja('Versión completa', `${motivo ? `<p class="nota">${h(motivo)}</p>` : ''}<p>La app es gratuita con un inmueble. Con un <b>pago único</b> añades todos los que quieras, para siempre y sin suscripción.</p>
      ${Tienda.disponible ? `<div class="acc"><button class="btn pri ancho" data-x="comprar" disabled>Consultando precio…</button><button class="btn ancho" data-x="recuperar">Ya la compré: recuperar la compra</button></div>`
        : '<p class="sub">La compra se hace desde la app de Android, a través de Google Play.</p>'}`, (el) => {
      if (!Tienda.disponible) return;
      const b = $('[data-x=comprar]', el);
      Tienda.precio().then((p) => { b.textContent = p ? `Desbloquear por ${p}` : 'Desbloquear'; b.disabled = false; }).catch(() => { b.textContent = 'Google Play no está disponible ahora'; });
      const activa = () => { S.pro = true; localStorage.setItem('ma.pro', '1'); cerrar(); pinta(); toast('Versión completa activada'); };
      b.onclick = async () => { b.disabled = true; try { if (await Tienda.comprar()) activa(); else { toast('La compra está pendiente de confirmación'); b.disabled = false; } } catch (e) { toast('No se ha completado la compra'); b.disabled = false; } };
      $('[data-x=recuperar]', el).onclick = async () => { try { if (await Tienda.tiene()) activa(); else toast('No hay ninguna compra en esta cuenta de Google'); } catch (e) { toast('No se ha podido consultar Google Play'); } };
    });
  }
  async function comprobarCompra() {
    S.pro = localStorage.getItem('ma.pro') === '1';
    if (!Tienda.disponible) return;
    try { const t = await Tienda.tiene(); if (t !== S.pro) { S.pro = t; localStorage.setItem('ma.pro', t ? '1' : '0'); pinta(); } } catch (e) { /* sin conexión: vale lo último conocido */ }
  }

  // ---------- Acciones (un solo manejador de clics) ----------
  const A = {
    cerrar, ayuda() { hoja('Ayuda', AYUDA); }, pro() { hojaPro(); },
    mes(_, el) { V.mes = MA.mesMas(V.mes, +el.dataset.d); pinta(); }, anio(_, el) { V.anio = String(+V.anio + +el.dataset.d); pinta(); }, verArchivados() { V.archivados = !V.archivados; pinta(); },
    nuevoInmueble() { if (!MA.puedeCrearInmueble(S)) return hojaPro('La versión gratuita admite un inmueble.'); formInmueble(); }, inmueble: fichaInmueble, editarInmueble(i) { formInmueble(por(S.inmuebles, i)); },
    archivarInmueble(i) { const p = por(S.inmuebles, i); if (haz(() => MA.archivarInmueble(S, i, !p.archivado, HOY))) fichaInmueble(i); },
    eliminarInmueble(i) { confirma('Eliminar inmueble', 'Solo se puede eliminar si no tiene contratos ni gastos pagados. Si tiene historial, archívalo.', 'Eliminar', () => haz(() => MA.eliminarInmueble(S, i))); },
    tipicos(i) { haz(() => MA.cargarTipicos(S, i, HOY), (n) => { fichaInmueble(i); toast(n ? `Añadidos ${n} conceptos: ponles importe` : 'Ya estaban todos'); }); },
    nuevoConcepto(i) { formConcepto(null, i); }, concepto(i) { formConcepto(por(S.conceptos, i)); },
    eliminarConcepto(i) { const c = por(S.conceptos, i); haz(() => MA.eliminarConcepto(S, i, HOY), () => fichaInmueble(c.inmuebleId)); },
    hipoteca: formHipoteca, quitarHipoteca(i) { haz(() => MA.ponerHipoteca(S, i, null, HOY), () => fichaInmueble(i)); },
    nuevoInquilino() { formInquilino(); }, inquilino(i) { formInquilino(por(S.inquilinos, i)); }, chat(i) { window.Plataforma.abrir('https://wa.me/' + telWa(por(S.inquilinos, i).telefono)); },
    archivarInquilino(i) { const q = por(S.inquilinos, i); haz(() => MA.archivarInquilino(S, i, !q.archivado), cerrar); }, eliminarInquilino(i) { haz(() => MA.eliminarInquilino(S, i), cerrar); },
    nuevoContrato: formContrato, contrato: fichaContrato,
    editarContrato(i) { const ct = por(S.contratos, i); formulario({ titulo: 'Editar contrato', valores: ct, defs: [{ k: 'inicio', e: 'Fecha de inicio', t: 'date' }, { k: 'fin', e: 'Fecha de fin (vacía si no tiene)', t: 'date' }, { k: 'diaCobro', e: 'Día de cobro', t: 'num' },
      { k: 'fianza', e: 'Fianza acordada', t: 'dinero' }, { k: 'avisoMeses', e: 'Avisar del vencimiento con (meses)', t: 'num' },
      { h: 'Actualización anual' }, { k: 'actualizacion', e: 'Índice', t: 'select', op: D_ACTUALIZACION.slice(1) }, { k: 'actualizacionPct', e: 'Porcentaje fijo (solo si es pactado)', t: 'num' },
      { h: 'Para la Renta' }, { k: 'uso', e: 'Uso', t: 'select', op: [['vivienda', 'Vivienda del inquilino (tiene reducción)'], ['otro', 'Otro uso: garaje, local, temporada…']] },
      { k: 'firma', e: 'Fecha de firma (si es distinta del inicio)', t: 'date' },
      { k: 'reduccion', e: 'Reducción en el IRPF', t: 'select', op: [['', 'Automática (60 % antes del 26/05/2023, 50 % después)'], [0, 'Sin reducción'], [50, '50 %'], [60, '60 %'], [70, '70 %'], [90, '90 %']] },
      { k: 'retencion', t: 'check', e: 'El inquilino me practica retención (19 %)', ayuda: 'Habitual cuando alquilas un local a una empresa o autónomo.' }, { k: 'notas', e: 'Notas', t: 'area' }],
      alGuardar: (d) => MA.editarContrato(S, i, { ...d, fin: d.fin || null, fianza: d.fianza || 0, firma: d.firma || null }, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Para cambiar la renta usa «Cambiar la renta»: así queda guardado desde qué mes se aplica.</p>' }); },
    revisar(i) { const ct = por(S.contratos, i); formulario({ titulo: 'Cambiar la renta', valores: { desde: MA.mesMas(HOY.slice(0, 7), 1), importe: MA.rentaActual(ct, HOY) }, defs: [{ k: 'importe', e: 'Nueva renta mensual', t: 'dinero', req: 1 }, { k: 'desde', e: 'Se aplica desde el mes', t: 'month', req: 1 }],
      alGuardar: (d) => MA.revisarRenta(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Los recibos ya cobrados, total o parcialmente, conservan su importe.</p>' }); },
    renovar(i) { const ct = por(S.contratos, i), f = MA.finEfectivo(ct); formulario({ titulo: 'Renovar contrato', boton: 'Renovar', valores: { fin: f ? MA.masDias(MA.masMeses(MA.masDias(f, 1), 12), -1) : '', importe: MA.rentaActual(ct, HOY) },
      defs: [{ k: 'fin', e: 'Nueva fecha de fin (vacía si pasa a no tener)', t: 'date' }, { k: 'importe', e: 'Renta mensual desde la renovación', t: 'dinero' }],
      alGuardar: (d) => MA.renovarContrato(S, i, { fin: d.fin || null, importe: d.importe != null && d.importe !== MA.rentaActual(ct, HOY) ? d.importe : null }, HOY), despues: () => fichaContrato(i) }); },
    finalizar(i) { formulario({ titulo: 'Finalizar contrato', boton: 'Finalizar', valores: { fecha: HOY, estado: 'finalizado' }, defs: [{ k: 'fecha', e: 'Último día del contrato', t: 'date', req: 1 }, { k: 'estado', e: 'Motivo', t: 'select', op: [['finalizado', 'Ha terminado'], ['rescindido', 'Se ha rescindido antes de tiempo']] },
      { k: 'llaves', e: 'Día en que te devuelve las llaves', t: 'date', ayuda: 'Desde ese día tienes un mes para devolver la fianza; después genera intereses.' }],
      alGuardar: (d) => MA.finalizarContrato(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Los recibos posteriores sin cobros se anulan. Los cobros y el historial se conservan.</p>' }); },
    eliminarContrato(i) { confirma('Eliminar contrato', 'Solo se puede eliminar un contrato sin cobros ni fianza (por ejemplo, uno creado por error). Si ya tiene historial, finalízalo.', 'Eliminar', () => haz(() => MA.eliminarContrato(S, i))); },
    avisoFin(i) { const ct = por(S.contratos, i), q = por(S.inquilinos, ct.inquilinoId), p = por(S.inmuebles, ct.inmuebleId);
      enviar('Mensaje a ' + q.nombre, q.telefono, texto('vencimiento', q, { nombre: pila(q.nombre), inmueble: p.nombre, fecha_fin: fecha(ct.fin) }), () => { ct.avisoEnviado = HOY; guardar(); }); },
    fianza(i, el) { const t = el.dataset.t, ct = por(S.contratos, i), k = clave(); formulario({ titulo: { recibida: 'Fianza recibida', devuelta: 'Devolver fianza', retenida: 'Retener fianza' }[t], valores: { importe: t === 'recibida' ? ct.fianza || '' : MA.saldoFianza(S, i), fecha: HOY },
      defs: [{ k: 'importe', e: 'Importe', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' }, { k: 'notas', e: t === 'retenida' ? 'Motivo de la retención' : 'Notas' }],
      alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.registrarFianza(S, { contratoId: i, tipo: t, ...d, clave: k }, HOY); }, despues: () => fichaContrato(i) }); },
    cobro: fichaCobro,
    cobrado(i, el) { const c = MA.cargos(S, HOY, (x) => x.id === i)[0]; if (!c || !c.pendiente) return;
      haz(() => MA.registrarPago(S, { cargoId: i, importe: c.pendiente, metodo: c.metodo || '', clave: el.dataset.k }, HOY), (r) => { if (!r.repetido) toast(`Cobrado ${eur(c.pendiente)} de ${c.inquilino}`,
        [['Enviar recibo', () => A.reciboPdf(i)], ['Deshacer', () => haz(() => r.pagos.forEach((p) => MA.anularPago(S, p, 'Marcado por error', HOY)))]]); }); },
    avisar(i) { msgCobro(MA.cargos(S, HOY, (x) => x.id === i)[0]); }, recibo(i) { msgCobro(MA.cargos(S, HOY, (x) => x.id === i)[0], 'recibo'); },
    anularPago(i, el) { confirma('Anular este cobro', 'El cobro dejará de contar, pero seguirá en el historial como anulado.', 'Anular', (m) => haz(() => MA.anularPago(S, i, m, HOY), () => fichaCobro(+el.dataset.c)), true); },
    anularCargo(i) { confirma('Anular el recibo', 'Úsalo si ese mes no corresponde cobrar. Podrás recuperarlo después.', 'Anular', (m) => haz(() => MA.anularCargo(S, i, m, HOY), () => fichaCobro(i)), true); },
    restaurarCargo(i) { haz(() => MA.restaurarCargo(S, i, HOY), () => fichaCobro(i)); },
    ajustarCargo(i) { const c = por(S.cargos, i); formulario({ titulo: 'Cambiar el importe del recibo', valores: { importe: c.importe }, defs: [{ k: 'importe', e: 'Importe de este mes', t: 'dinero', req: 1 }], alGuardar: (d) => MA.ajustarCargo(S, i, d.importe == null ? -1 : d.importe, HOY), despues: () => fichaCobro(i),
      pie: '<p class="sub">Solo cambia este recibo. Para cambiar la renta de aquí en adelante, usa «Cambiar la renta» en el contrato.</p>' }); },
    nuevoGasto() { if (!opInmuebles().length) return toast('Añade antes un inmueble'); formGasto(); }, gasto: fichaGasto,
    gastoPagado(i) { haz(() => MA.confirmarGasto(S, i, {}, HOY), () => toast('Gasto marcado como pagado', 'Deshacer', () => haz(() => MA.desconfirmarGasto(S, i, 'Marcado por error', HOY)))); },
    desconfirmar(i) { haz(() => MA.desconfirmarGasto(S, i, 'Recibo devuelto o marcado por error', HOY), () => fichaGasto(i)); },
    anularGasto(i) { confirma('Anular el gasto', 'Dejará de contar en las cuentas, pero seguirá visible como anulado.', 'Anular', (m) => haz(() => MA.anularGasto(S, i, m, HOY), () => fichaGasto(i)), true); },
    cobrarGasto(i, el) { const g = MA.gastos(S, HOY, (x) => x.id === i)[0], k = clave(), c = el && el.dataset.c ? Number(el.dataset.c) : null, x = c && g.partes ? g.partes.find((y) => y.contratoId === c) : null;
      formulario({ titulo: x ? `${g.concepto} · ${x.inquilino}` : 'Cobro de ' + g.concepto, valores: { importe: x ? x.pendiente : g.porCobrar, fecha: HOY }, defs: [{ k: 'importe', e: 'Importe recibido', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' }],
      alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.registrarReembolso(S, { gastoId: i, ...d, contratoId: c == null ? undefined : c, clave: k }, HOY); }, despues: () => fichaGasto(i) }); },
    anularReembolso(i, el) { haz(() => MA.anularReembolso(S, i, 'Anulado', HOY), () => fichaGasto(+el.dataset.g)); },
    avisarGasto(i, el) { const g = MA.gastos(S, HOY, (x) => x.id === i)[0], c = el && el.dataset.c ? Number(el.dataset.c) : null, x = c && g.partes ? g.partes.find((y) => y.contratoId === c) : null;
      const nom = x ? x.inquilino : g.inquilino, tel = x ? x.telefono : g.telefono, cid = x ? x.contratoId : g.contratoId;
      enviar('Mensaje a ' + nom, tel, texto('gasto', cid ? por(S.inquilinos, (por(S.contratos, cid) || {}).inquilinoId) : null, { nombre: pila(nom), inmueble: g.inmueble, concepto: g.concepto, periodo: g.periodo, importe: eur(x ? x.pendiente : g.porCobrar) }), () => { por(S.gastos, i).recordatorio = HOY; guardar(); }); },
    misDatos() { formulario({ titulo: 'Mis datos', valores: S.ajustes, defs: [{ k: 'propietario', e: 'Tu nombre (firma de los mensajes y los recibos)' }, { k: 'dni', e: 'Tu DNI/NIF (aparece en los recibos)' }, { k: 'domicilio', e: 'Tu domicilio (opcional, para los recibos)' }, { k: 'formaPago', e: 'Forma de pago que indicas al inquilino', ayuda: 'Por ejemplo: Bizum al 600 000 000 o transferencia a ES00…' }], alGuardar: (d) => Object.assign(S.ajustes, d) }); },
    plantillas() { const n = { cobro: 'Recordatorio de cobro', atraso: 'Pago atrasado (a los 3 días)', atraso2: 'Pago atrasado (a los 10 días)', recibo: 'Confirmación de pago', recibo_pdf: 'Envío del recibo en PDF', gasto: 'Cobro de un gasto', vencimiento: 'Vencimiento de contrato', actualizacion: 'Actualización anual de la renta' };
      const l = Idioma.actual, val = Object.fromEntries(Object.keys(n).map((k) => [k, plantilla(k, l)]));
      formulario({ titulo: 'Mensajes', valores: val, defs: Object.keys(n).map((k) => ({ k, e: n[k], t: 'area' })), alGuardar: (d) => {
        if (l === 'es') { for (const k of Object.keys(n)) S.plantillas[k] = d[k] || MA.PLANTILLAS[k]; return; }
        S.plantillasI = S.plantillasI || {}; S.plantillasI[l] = {}; for (const k of Object.keys(n)) if (d[k] && d[k] !== Idioma.dic(l)['plantilla.' + k]) S.plantillasI[l][k] = d[k]; },
        pie: '<p class="sub">Entre llaves van los datos que se rellenan solos: {nombre}, {inmueble}, {mes}, {importe}, {deuda}, {fecha_cobro}, {forma_pago}, {propietario}… Si dejas un mensaje vacío vuelve el texto original.</p>' }); },
    avisosConf() { if (!Avisos.disponible) return toast('Los avisos están disponibles en la app de Android');
      formulario({ titulo: 'Avisos en el móvil', valores: { avisos: !!S.ajustes.avisos, horaAvisos: S.ajustes.horaAvisos || 9 }, defs: [{ k: 'avisos', t: 'check', e: 'Avisarme de cobros, vencimientos y gastos', ayuda: 'El día que vence cada recibo, cuando hay atrasos y cuando un contrato está a punto de terminar.' },
        { k: 'horaAvisos', e: 'Hora del aviso', t: 'select', op: [7, 8, 9, 10, 12, 14, 17, 19, 20].map((x) => [x, x + ':00']) }],
        alGuardar: (d) => { S.ajustes.avisos = d.avisos; S.ajustes.horaAvisos = Number(d.horaAvisos); if (d.avisos) Avisos.permiso(true).then((ok) => { if (!ok) { S.ajustes.avisos = false; guardar(); pinta(); toast('Android no ha dado permiso para mostrar avisos'); } else guardar(); }); } }); },
    async copia() { try { const c = confCopias(); if (c.adjuntos && S.adjuntos.length) toast('Preparando la copia…'); const k = await crearCopia(c.adjuntos);
      await Archivos.compartirBytes(k.nombre, k.bytes, k.mime); S.ajustes.ultimaCopia = HOY; guardar(); pinta(); toast('Copia preparada'); } catch (e) { toast('No se ha guardado la copia'); } },
    async seguridad() {
      if (!Bloqueo.disponible) return toast('El bloqueo está disponible en la app de Android');
      const b = leerBloq();
      formulario({ titulo: 'Bloqueo con huella o PIN', valores: { activo: b.activo, minutos: b.minutos, ocultar: b.ocultar },
        defs: [{ html: '<p class="sub">Usa el mismo método con el que desbloqueas el móvil: huella, cara, PIN, patrón o contraseña. La app no guarda ninguna clave.</p>' },
          { k: 'activo', t: 'check', e: 'Pedir huella o PIN al abrir la app' },
          { k: 'minutos', e: 'Volver a pedirlo si sales de la app durante', t: 'select', op: [[0, 'Al momento'], [1, '1 minuto'], [5, '5 minutos'], [15, '15 minutos'], [60, '1 hora']] },
          { k: 'ocultar', t: 'check', e: 'Ocultar el contenido en apps recientes y en capturas de pantalla' }],
        alGuardar: async (d) => {
          const n = { activo: !!d.activo, minutos: Number(d.minutos) || 0, ocultar: !!d.ocultar };
          if (n.activo) {
            const e = await Bloqueo.estado();
            if (!e.disponible) throw Object.assign(new Error(e.motivo === 'SIN_BLOQUEO' ? 'Primero pon un bloqueo de pantalla en el móvil (huella o PIN) en los ajustes de Android.' : 'Este móvil no permite usar el bloqueo.'), { code: 'BLOQUEO' });
            if (!b.activo) { pidiendo = true; try { await Bloqueo.autenticar(Idioma.t('Confirma que eres tú')); } catch (x) { throw Object.assign(new Error('No se ha confirmado la huella o el PIN'), { code: 'BLOQUEO' }); } finally { pidiendo = false; } }
          }
          try { localStorage.setItem('ma.bloqueo', JSON.stringify(n)); } catch (x) { /* */ }
          Bloqueo.proteger(n.ocultar);
        },
        despues: () => { toast(leerBloq().activo ? 'Bloqueo activado' : 'Bloqueo desactivado'); pinta(); } });
    },
    async copiasConf() { if (!Archivos.enMovil && !Drive.disponible) return toast('Las copias automáticas están disponibles en la app de Android');
      const c = confCopias(), l = await Archivos.copiasEnMovil(), kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
      formulario({ titulo: 'Copias automáticas', valores: { frecuencia: FREC[c.frecuencia] ? c.frecuencia : 'nunca', adjuntos: c.adjuntos, guardar: c.guardar },
        defs: [{ html: '<p class="sub">Se hacen solas al abrir la app cuando toca y se guardan en este móvil, en Documentos › MisAlquileres. Con los avisos activados, te recuerda abrirla si pasa la fecha.</p>' },
          { k: 'frecuencia', e: 'Cada cuánto', t: 'select', op: [['diaria', 'Cada día'], ['semanal', 'Cada semana'], ['mensual', 'Cada mes'], ['nunca', 'Nunca']] },
          { k: 'adjuntos', t: 'check', e: 'Incluir los documentos y fotos', ayuda: 'La copia será un ZIP con todo. Ocupa más, pero lo recupera todo de una vez.' },
          { k: 'guardar', e: 'Copias que se conservan', t: 'select', op: [3, 5, 7, 10, 15, 30].map((x) => [x, String(x)]) }],
        pie: `${Drive.disponible ? `<h3>Google Drive</h3>${c.drive ? `<p class="sub">Las copias también se suben a la carpeta «Mis alquileres» de tu Google Drive.</p>${c.driveCuenta ? `<p class="sub">Cuenta: <b data-notr>${h(c.driveCuenta)}</b></p>` : ''}${c.driveUltima ? `<p class="sub">${h('Última: ' + fecha(c.driveUltima))}</p>` : ''}
            <div class="acc"><button class="btn peq" data-a="driveCopias">Ver copias en Drive</button><button class="btn txt peq" data-a="desconectarDrive">Desconectar</button></div>`
            : `<p class="sub">Guárdalas también en tu Google Drive: si pierdes o cambias de móvil, las recuperas desde allí. La app solo ve los archivos que ella misma crea.</p><div class="acc"><button class="btn pri" data-a="conectarDrive">Guardar también en Google Drive</button></div>`}` : ''}
          <div class="acc esp"><button class="btn" data-a="copiaYa">Hacer una copia ahora</button></div>
          <h3>Copias en este móvil</h3>${l.length ? `<div class="filas">${l.map((x) => `<div class="fila-l"><span><b>${fecha((x.nombre.match(/\d{4}-\d{2}-\d{2}/) || [''])[0])}</b><br><span class="sub">${/\.zip$/.test(x.nombre) ? 'Con documentos y fotos' : 'Solo los datos'}${x.tam ? ' · ' + kb(x.tam) : ''}</span></span><span class="der"><button class="btn peq" data-a="enviarCopia" data-n="${h(x.nombre)}">Enviar</button><button class="btn peq" data-a="recuperarCopia" data-n="${h(x.nombre)}">Recuperar</button></span></div>`).join('')}</div>` : '<p class="sub">Todavía no hay ninguna.</p>'}
          ${c.drive ? '' : '<p class="nota esp">Si pierdes o cambias de móvil, estas copias se van con él. De vez en cuando, pulsa «Enviar» y guárdala en Drive o en tu correo.</p>'}`,
        alGuardar: (d) => { S.ajustes.copias = { ...c, frecuencia: d.frecuencia, adjuntos: !!d.adjuntos, guardar: Number(d.guardar) || 7 }; },
        despues: () => { copiaProgramada(); toast('Copias automáticas guardadas'); } }); },
    async copiaYa() { toast('Haciendo la copia…'); if (await copiaProgramada(true)) { toast(confCopias().drive ? 'Copia guardada en el móvil y en Google Drive' : 'Copia guardada en el móvil'); A.copiasConf(); } else toast('No se ha podido guardar la copia'); },
    async conectarDrive() {
      try { await Drive.conectar(true); toast('Conectando con Google Drive…'); const cuenta = await Drive.cuenta();
        S.ajustes.copias = { ...confCopias(), drive: true, driveCuenta: cuenta, driveError: null, driveUltima: null }; guardar();
        if (FREC[confCopias().frecuencia] && S.contratos.length) await copiaProgramada(true);
        toast(confCopias().driveUltima ? 'Conectado. Primera copia subida a Google Drive' : 'Conectado con Google Drive'); A.copiasConf();
      } catch (e) { toast(e && e.code === 'CANCELADO' ? 'No se ha conectado con Google Drive' : 'No se ha podido conectar con Google Drive. Comprueba la conexión.'); } },
    desconectarDrive() { confirma('Desconectar Google Drive', 'Las copias dejarán de subirse a Google Drive. Las que ya están allí no se borran.', 'Desconectar', async () => {
      await Drive.desconectar(); S.ajustes.copias = { ...confCopias(), drive: false, driveCuenta: null }; guardar(); toast('Google Drive desconectado'); A.copiasConf(); }); },
    async driveCopias() {
      let l; try { if (!Drive.token) await Drive.conectar(true); toast('Buscando copias en Google Drive…'); l = await Drive.lista(); } catch (e) { return toast(e && e.code === 'CANCELADO' ? 'No se ha conectado con Google Drive' : 'No se ha podido consultar Google Drive'); }
      const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
      hoja('Copias en Google Drive', `${l.length ? `<div class="filas">${l.map((x) => `<div class="fila-l"><span><b>${fecha((x.nombre.match(/\d{4}-\d{2}-\d{2}/) || [''])[0])}</b><br><span class="sub">${/\.zip$/.test(x.nombre) ? 'Con documentos y fotos' : 'Solo los datos'}${x.tam ? ' · ' + kb(x.tam) : ''}</span></span><span class="der"><button class="btn peq" data-a="driveRecuperar" data-n="${h(x.id)}" data-f="${h(x.nombre)}">Recuperar</button></span></div>`).join('')}</div>`
        : '<p class="sub">No hay copias de Mis alquileres en este Google Drive.</p>'}<p class="sub esp">Están en la carpeta «Mis alquileres» de tu Google Drive.</p>`); },
    driveRecuperar(_, el) { const id = el.dataset.n, n = el.dataset.f; confirma('Recuperar esta copia', 'Los datos actuales se sustituirán por los de la copia del ' + fecha((n.match(/\d{4}-\d{2}-\d{2}/) || [''])[0]) + '.', 'Recuperar', async () => {
      try { toast('Descargando la copia…'); const c = confCopias(); await recuperarBytes(await Drive.bajar(id), n); S.ajustes.copias = { ...confCopias(), drive: true, driveCuenta: c.driveCuenta || confCopias().driveCuenta }; guardar(); } catch (x) { x && x.code ? fallo(x) : toast('No se ha podido descargar la copia'); } }); },
    enviarCopia(_, el) { Archivos.compartirDeMovil(el.dataset.n).catch(() => toast('No se ha podido enviar')); },
    recuperarCopia(_, el) { const n = el.dataset.n; confirma('Recuperar esta copia', 'Los datos actuales se sustituirán por los de la copia del ' + fecha((n.match(/\d{4}-\d{2}-\d{2}/) || [''])[0]) + '.', 'Recuperar', async () => { try { await recuperarBytes(await Archivos.leerDeMovil(n), n); } catch (x) { fallo(x); } }); },
    restaurar() { hoja('Recuperar una copia', '<p class="nota">Los datos actuales se sustituirán por los de la copia. Si quieres conservarlos, guarda antes una copia.</p><label class="f">Archivo de copia (.json o .zip)<input type="file" id="fcopia" accept=".json,.zip,application/json,application/zip"></label>' + (Drive.disponible ? '<div class="acc"><button class="btn" data-a="driveCopias">Recuperar desde Google Drive</button></div>' : ''), (el) => {
      $('#fcopia', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
        try { await recuperarBytes(new Uint8Array(await f.arrayBuffer()), f.name); } catch (x) { fallo(x); } }; }); },
    csv(_, el) { const t = el.dataset.t; Archivos.compartir(`${t.toLowerCase()}-${HOY}.csv`, MA['csv' + t](S, HOY), 'text/csv').catch(() => toast('No se ha podido exportar')); },
    historial() { const n = { pago: 'Cobro', pago_anulado: 'Cobro anulado', recibo_anulado: 'Recibo anulado', recibo_restaurado: 'Recibo recuperado', recibo_ajustado: 'Importe de recibo cambiado', contrato_creado: 'Contrato creado', contrato_editado: 'Contrato editado',
      contrato_finalizado: 'Contrato finalizado', contrato_rescindido: 'Contrato rescindido', contrato_renovado: 'Contrato renovado', renta_revisada: 'Renta cambiada', gasto_creado: 'Gasto añadido', gasto_confirmado: 'Gasto pagado', gasto_desconfirmado: 'Gasto vuelto a pendiente',
      gasto_anulado: 'Gasto anulado', reembolso: 'Cobro de gasto al inquilino', inmueble_creado: 'Inmueble añadido', inmueble_archivado: 'Inmueble archivado', inmueble_recuperado: 'Inmueble recuperado', fianza_recibida: 'Fianza recibida', fianza_devuelta: 'Fianza devuelta', fianza_retenida: 'Fianza retenida' };
      const l = S.registro.slice(-150).reverse();
      hoja('Historial de cambios', l.length ? `<table class="t">${l.map((r) => `<tr><td>${fecha(r.fecha)} · ${h(n[r.que] || r.que)}</td><td>${r.detalle && r.detalle.importe != null ? eur(r.detalle.importe) : ''}</td></tr>`).join('')}</table>` : '<p class="sub">Aún no hay cambios anotados.</p>'); },
    privacidad() { hoja('Privacidad', PRIVACIDAD); },
    atras() { location.hash = '#mas'; },
    ap(_, el) { const a = leerAp(), k = el.dataset.k; let v = el.dataset.v; if (k === 'fs') v = Number(v); if (k === 'contraste') v = v === 'true'; a[k] = v;
      try { localStorage.setItem('ma.ap', JSON.stringify(a)); } catch (e) { /* sin almacenamiento: solo esta sesión */ } aplicarAp(a); pinta(); },
    async idioma(_, el) { S.ajustes.idioma = el.dataset.v; try { localStorage.setItem('ma.idioma', el.dataset.v); } catch (e) { /* */ } try { await guardar(); } catch (e) { /* se guarda al volver a abrir */ } location.reload(); },
    // Deudas agrupadas
    cobrarDeuda(i) { const d = deudas().find((x) => x.contratoId === i); if (!d) return fichaContrato(i); const k = clave(), q = por(S.inquilinos, (por(S.contratos, i) || {}).inquilinoId);
      formulario({ titulo: 'Cobrar a ' + d.inquilino, boton: 'Registrar cobro', valores: { importe: d.total, fecha: HOY, metodo: d.cargos[0].metodo || 'Transferencia' },
        defs: [{ html: `<p class="sub">${d.cargos.map((c) => `${fmes(c.periodo)}: ${eur(c.pendiente)}`).join('<br>')}</p><p class="sub esp">Si cobras menos del total, se aplica primero a los meses más antiguos.</p>` },
          { k: 'importe', e: 'Importe', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' }, { k: 'metodo', e: 'Método', t: 'select', op: ['Transferencia', 'Bizum', 'Efectivo', 'Domiciliación', 'Otro'].map((x) => [x, x]) }],
        alGuardar: (v) => { if (v.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.registrarPago(S, { cargoId: d.cargos[0].id, importe: v.importe, fecha: v.fecha || HOY, metodo: v.metodo, repartir: true, clave: k }, HOY); },
        despues: (r) => { if (r.repetido) return; const cg = [...new Set(r.pagos.map((p) => por(S.pagos, p).cargoId))]; toast(`Cobrado ${eur(r.pagos.reduce((t, p) => t + por(S.pagos, p).importe, 0))}`,
          [['Enviar recibo', () => A.reciboPdf(cg[cg.length - 1])], ['Deshacer', () => haz(() => r.pagos.forEach((p) => MA.anularPago(S, p, 'Marcado por error', HOY)))]]); } }); void q; },
    avisarDeuda(i) { const d = deudas().find((x) => x.contratoId === i); if (!d) return; if (d.cargos.length === 1) return msgCobro(d.cargos[0]);
      const q = por(S.inquilinos, (por(S.contratos, i) || {}).inquilinoId), l = langDe(q), meses = d.cargos.map((c) => Idioma.mes(fmes(c.periodo), l));
      const lista = meses.length > 1 ? meses.slice(0, -1).join(', ') + ' ' + Idioma.tr(l)('y') + ' ' + meses[meses.length - 1] : meses[0];
      enviar('Mensaje a ' + d.inquilino, d.telefono, texto(d.esc === 2 ? 'atraso2' : 'atraso', q, { nombre: pila(d.inquilino), inmueble: d.inmueble, mes: lista, deuda: eur(d.total), fecha_cobro: fecha(d.cargos[0].vence), importe: eur(d.total) }),
        () => { d.cargos.forEach((c) => { por(S.cargos, c.id).recordatorio = HOY; }); guardar(); pinta(); }); },
    // Informes y listados
    inf(_, el) { const k = el.dataset.k, fmt = el.dataset.f, tab = Exportar.crear(S, k, V.filtros, HOY), nom = `${Idioma.t(Exportar.LISTADOS[k].titulo).toLowerCase().replace(/\s+/g, '-')}-${HOY}`;
      const p = fmt === 'xlsx' ? Archivos.compartirBytes(nom + '.xlsx', Exportar.xlsx([tab]), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        : Archivos.compartirBytes(nom + '.pdf', PDF.listado(tab, { t: Idioma.t, acento: leerAp().acento, hoy: HOY, propietario: S.ajustes.propietario }), 'application/pdf');
      p.catch(() => toast('No se ha podido exportar')); },
    libroCompleto() { Archivos.compartirBytes(`mis-alquileres-${HOY}.xlsx`, Exportar.libroCompleto(S, HOY), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').catch(() => toast('No se ha podido exportar')); },
    extractoInq(i) { const id = i || V.filtros.inquilinoId; if (!id) return toast('Elige primero el inquilino en los filtros');
      const q = por(S.inquilinos, id), l = langDe(q), e = Exportar.extractoInquilino(S, id, i ? {} : V.filtros, HOY);
      Archivos.compartirBytes(`${Idioma.tr(l)('extracto')}-${q.nombre.toLowerCase().replace(/\s+/g, '-')}-${HOY}.pdf`, PDF.extracto(e, { t: Idioma.tr(l), acento: leerAp().acento, propietario: S.ajustes.propietario, formaPago: S.ajustes.formaPago }), 'application/pdf').catch(() => toast('No se ha podido crear el extracto')); },
    async zipDocs() { if (!S.adjuntos.length) return toast('No hay documentos ni fotos');
      toast('Preparando el archivo…'); const nom = { inmueble: (x) => (por(S.inmuebles, x) || {}).nombre, contrato: (x) => { const c = por(S.contratos, x) || {}; return `${(por(S.inquilinos, c.inquilinoId) || {}).nombre} - ${(por(S.inmuebles, c.inmuebleId) || {}).nombre}`; }, gasto: (x) => (por(S.gastos, x) || {}).concepto, inquilino: (x) => (por(S.inquilinos, x) || {}).nombre };
      const limpio = (s) => String(s || 'sin nombre').replace(/[\\/:*?"<>|]/g, ' ').trim(), usados = {}, arch = [];
      for (const a of S.adjuntos) { try { const b = await Adjuntos.leer(a.archivo); if (!b) continue; let n = `${Idioma.t({ inmueble: 'Inmuebles', contrato: 'Contratos', gasto: 'Gastos', inquilino: 'Inquilinos' }[a.tipo])}/${limpio(nom[a.tipo](a.refId))}/${limpio(a.nombre)}`;
        if (usados[n]) n = n.replace(/(\.\w+)?$/, ` (${++usados[n]})$1`); else usados[n] = 1; arch.push({ nombre: n, datos: b }); } catch (e) { /* ese archivo ya no está */ } }
      Archivos.compartirBytes(`documentos-${HOY}.zip`, Exportar.zip(arch), 'application/zip').catch(() => toast('No se ha podido crear el ZIP')); },
    // 1. Recibo en PDF
    reciboPdf(i) { try { const r = MA.datosRecibo(S, i, HOY); guardar(); const c = MA.cargos(S, HOY, (x) => x.id === i)[0], q = por(S.inquilinos, c.inquilinoId), l = langDe(q);
      r.mes = Idioma.mes(r.mes, l); if (l !== 'es') r.letras = '';
      Archivos.compartirBytes(`${Idioma.tr(l)('recibo')}-${r.numero}.pdf`, PDF.recibo(r, { t: Idioma.tr(l), acento: leerAp().acento }), 'application/pdf', texto('recibo_pdf', q, { nombre: pila(c.inquilino), inmueble: c.inmueble, mes: fmes(c.periodo) }))
        .catch(() => toast('No se ha enviado el recibo')); if (!S.ajustes.dni && !S.ajustes.propietario) toast('Pon tu nombre y DNI en Ajustes › Mis datos para que salgan en el recibo'); } catch (e) { fallo(e); } },
    // 4. Extracto del banco
    extracto() { hoja('Extracto del banco', `<p>Descarga desde la web o la app de tu banco los movimientos de la cuenta donde cobras, en <b>Excel (.xlsx)</b> o <b>CSV</b>, y elígelo aquí. La app buscará qué transferencias y Bizum corresponden a cada recibo y qué cargos son tus gastos domiciliados.</p>
      <label class="f">Archivo del extracto<input type="file" id="fext" accept=".csv,.xlsx,.txt,.n43,.aeb,.q43,.c43,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p class="sub">Nada se apunta hasta que lo revises y confirmes. Los movimientos ya importados se reconocen y no se duplican.</p>`, (el) => {
      $('#fext', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
        try { const movs = await Tablas.leerExtracto(f.name, await f.arrayBuffer()); revisarExtracto(MA.conciliar(S, movs, HOY)); } catch (x) { toast(x.message || 'No se ha podido leer el archivo'); } }; }); },
    // 5. Renta
    anioRenta(_, el) { V.renta += +el.dataset.d; pinta(); },
    rentaPdf() { const inf = informe(); Archivos.compartirBytes(`renta-${V.renta}${inf.titular && !inf.titular.yo ? '-' + inf.titular.nombre.toLowerCase().replace(/\s+/g, '-') : ''}.pdf`, PDF.renta(inf, inf.titular && !inf.titular.yo ? inf.titular.nombre : S.ajustes.propietario, { t: Idioma.t, acento: leerAp().acento }), 'application/pdf').catch(() => toast('No se ha podido crear el PDF')); },
    rentaCsv() { Archivos.compartir(`renta-${V.renta}.csv`, MA.csvRenta(informe()), 'text/csv').catch(() => toast('No se ha podido exportar')); },
    datosFiscales(i) { const p = por(S.inmuebles, i), ts = MA.partes(p), yo = ts.find((x) => x.yo), otros = ts.filter((x) => !x.yo);
      const v = { ...p, miPct: yo ? yo.pct : 0 }; otros.slice(0, 3).forEach((x, n) => { v[`c${n}Nombre`] = x.nombre; v[`c${n}Nif`] = x.nif; v[`c${n}Pct`] = x.pct; });
      const co = (n) => [{ k: `c${n}Nombre`, e: `Otro titular ${n + 1}: nombre` }, { html: '<div class="dos">' }, { k: `c${n}Nif`, e: 'DNI/NIF' }, { k: `c${n}Pct`, e: 'Porcentaje', t: 'num' }, { html: '</div>' }];
      formulario({ titulo: 'Datos de ' + p.nombre, valores: v, defs: [{ k: 'referencia', e: 'Referencia catastral' }, ...D_INMUEBLE.filter((d) => ['valorCatastral', 'valorCatastralConstruccion', 'imputacionPct', 'compraPrecio', 'compraGastos', 'compraFecha'].includes(d.k)),
        { h: 'Titulares' }, { html: '<p class="sub">Si el inmueble es de varias personas (por ejemplo, un matrimonio al 50 %), indica la parte de cada uno. El informe de la Renta se podrá sacar por titular.</p>' },
        { k: 'miPct', e: 'Tu parte (%)', t: 'num' }, { det: 'Otros titulares' }, ...co(0), ...co(1), ...co(2), { detFin: 1 }],
        alGuardar: (d) => { const l = [{ yo: true, nombre: '', nif: '', pct: d.miPct == null ? 100 : Number(d.miPct) }].filter((x) => x.pct > 0);
          for (const n of [0, 1, 2]) if (d[`c${n}Nombre`]) l.push({ nombre: d[`c${n}Nombre`], nif: d[`c${n}Nif`] || '', pct: Number(d[`c${n}Pct`]) || 0 });
          const x = { ...d }; for (const k of Object.keys(x)) if (/^(miPct|c\dNombre|c\dNif|c\dPct)$/.test(k)) delete x[k];
          return MA.editarInmueble(S, i, { ...x, titulares: l.length === 1 && l[0].yo && l[0].pct === 100 ? [] : l }); } }); },
    // 6. Actualización anual
    actualizar(i) { const ct = por(S.contratos, i), u = MA.actualizacionPendiente(S, ct, HOY); if (!u) return fichaContrato(i);
      const q = por(S.inquilinos, ct.inquilinoId), p = por(S.inmuebles, ct.inmuebleId);
      formulario({ titulo: 'Actualizar la renta', boton: 'Aplicar', valores: { pct: u.pctPactado != null ? String(u.pctPactado).replace('.', ',') : '' }, defs: [{ html: `<p>${h(q.nombre)} · ${h(p.nombre)}: el <b>${fecha(u.fecha)}</b> se cumple un año más de contrato. Renta actual: <b>${eur(u.renta)}</b>.</p>
          <p class="sub">${u.indice === 'irav' ? 'Para vivienda firmada desde el 26/05/2023 se aplica el <b>IRAV</b>, que publica el INE cada mes: usa el último publicado.' : u.indice === 'ipc' ? 'Se aplica la variación del <b>IPC</b> que diga el contrato (normalmente la interanual del último mes publicado por el INE).' : 'Se aplica el porcentaje pactado en el contrato.'} Debes comunicárselo al inquilino por escrito.</p>` },
        { k: 'pct', e: 'Porcentaje de subida (por ejemplo 2,4)', t: 'num', req: 1 }],
        alGuardar: (d) => MA.aplicarActualizacion(S, i, { pct: d.pct, fecha: u.fecha }, HOY),
        despues: (r) => enviar('Mensaje a ' + q.nombre, q.telefono, texto('actualizacion', q, { nombre: pila(q.nombre), inmueble: p.nombre, mes: fmes(u.mes), antes: eur(r.antes), ahora: eur(r.ahora), indice: u.indice === 'fijo' ? 'porcentaje pactado' : u.indice.toUpperCase(), porcentaje: MA.pctTexto(r.pct) })),
        pie: `<div class="acc"><button class="btn peq" data-a="ine">Consultar en ine.es</button><button class="btn peq" data-a="omitirActualizacion" data-id="${i}">Este año no la aplico</button></div>` }); },
    ine() { window.Plataforma.abrir('https://www.ine.es/'); },
    omitirActualizacion(i) { const u = MA.actualizacionPendiente(S, por(S.contratos, i), HOY); if (u) haz(() => MA.omitirActualizacion(S, i, u.fecha, HOY), cerrar); },
    // 10. Depósito de la fianza
    deposito(i) { formulario({ titulo: 'Depósito de la fianza', valores: { organismo: 'Instituto Canario de la Vivienda', fecha: HOY }, defs: [{ k: 'organismo', e: 'Organismo' }, { k: 'fecha', e: 'Fecha del depósito', t: 'date', req: 1 }, { k: 'referencia', e: 'Número o referencia del depósito' }],
      alGuardar: (d) => MA.registrarDeposito(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Guarda el justificante en «Documentos y fotos» del contrato.</p>' }); },
    depositoNoAplica(i) { haz(() => MA.registrarDeposito(S, i, { noAplica: true }, HOY), () => fichaContrato(i)); },
    recuperarDeposito(i) { formulario({ titulo: 'Fianza recuperada', valores: { fecha: HOY }, defs: [{ k: 'fecha', e: 'Fecha en que te la devolvió el organismo', t: 'date', req: 1 }], alGuardar: (d) => MA.recuperarDeposito(S, i, d.fecha, HOY), despues: () => fichaContrato(i) }); },
    // 9. Alta rápida e importación
    altaRapida() { if (!MA.puedeCrearInmueble(S)) return hojaPro('La versión gratuita admite un inmueble.');
      formulario({ titulo: 'Alta rápida', boton: 'Crear todo', valores: { tipo: 'Plaza de garaje', inicio: HOY, diaCobro: 1, tipicos: true }, defs: [{ k: 'inmueble', e: 'Inmueble', req: 1, ayuda: 'Por ejemplo: Plaza 12 o Piso Calle Real' }, { k: 'tipo', e: 'Tipo', t: 'select', op: MA.TIPOS.map((x) => [x, x]) },
        { k: 'inquilino', e: 'Inquilino', req: 1 }, { k: 'telefono', e: 'Su teléfono (para WhatsApp)', t: 'tel' }, { k: 'importe', e: 'Renta mensual', t: 'dinero', req: 1 }, { k: 'diaCobro', e: 'Día de cobro', t: 'num' },
        { k: 'inicio', e: 'Desde', t: 'date', req: 1 }, { k: 'fianza', e: 'Fianza (opcional)', t: 'dinero' }, { k: 'historicoCobrado', t: 'check', e: 'Dar por cobrados los meses anteriores a este', ayuda: 'Solo si empezó antes de usar la app. Quedan marcados como estimados.' },
        { k: 'tipicos', t: 'check', e: 'Añadir los gastos habituales (IBI, comunidad…)' }],
        alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica la renta mensual'), { code: 'IMPORTE' }); return MA.altaRapida(S, d, HOY); }, despues: () => toast('Listo: ya tienes los recibos de cada mes') }); },
    plantillaCartera() { Archivos.compartir('plantilla-mis-alquileres.csv', '\ufeff' + MA.PLANTILLA_CARTERA, 'text/csv').catch(() => {}); },
    importarCartera() { hoja('Importar desde Excel', `<p>Prepara una hoja con una fila por contrato y las columnas <b>Inmueble, Tipo, Dirección, Inquilino, Teléfono, DNI, Inicio, Fin, Renta, Día de cobro y Fianza</b>, como en la plantilla. Guárdala como <b>.xlsx</b> o <b>CSV</b> y elígela aquí.</p>
      <div class="acc"><button class="btn peq" data-a="plantillaCartera">Descargar la plantilla</button></div><label class="f">Archivo<input type="file" id="fcar" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>`, (el) => {
      $('#fcar', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
        try { const r = MA.importarCartera(S, await Tablas.leerArchivo(f.name, await f.arrayBuffer()), HOY); MA.generarGastos(S, HOY); guardar(); pinta();
          hoja('Importación terminada', `<p>Creados: <b>${r.inmuebles}</b> inmuebles, <b>${r.inquilinos}</b> inquilinos y <b>${r.contratos}</b> contratos.</p>${r.errores.length ? `<div class="nota">${r.errores.map(h).join('<br>')}</div>` : ''}${r.limite ? '<div class="acc"><button class="btn pri" data-a="pro">Desbloquear la versión completa</button></div>' : ''}`); }
        catch (x) { toast(x.message || 'No se ha podido leer el archivo'); } }; }); },
    // 7. Documentos
    verDoc(i) { const a = por(S.adjuntos, i); if (!a) return; const foto = /^image\//.test(a.mime);
      hoja(a.nombre, `${foto ? '<img id="docimg" alt="">' : `<p class="sub">${h(a.mime || 'Documento')} · ${Math.max(1, Math.round(a.tam / 1024))} KB</p>`}<p class="sub">Añadido el ${fecha(a.fecha)}</p>
        <div class="acc"><button class="btn pri" data-a="compartirDoc" data-id="${i}">${foto ? 'Compartir' : 'Abrir o compartir'}</button><button class="btn" data-a="volverDoc" data-id="${i}">Volver</button><button class="btn rojo" data-a="borrarDoc" data-id="${i}">Eliminar</button></div>`,
        async (el) => { if (foto) { const u = await Adjuntos.url(a.archivo); if (u) $('#docimg', el).src = u; } }); },
    compartirDoc(i) { Adjuntos.compartir(por(S.adjuntos, i)).catch(() => toast('No se ha podido abrir')); },
    volverDoc(i) { const a = por(S.adjuntos, i); abrirPadre(a.tipo, a.refId); },
    borrarDoc(i) { const a = por(S.adjuntos, i); confirma('Eliminar documento', `Se eliminará «${a.nombre}» de la app.`, 'Eliminar', () => { const arch = MA.quitarAdjunto(S, i); Adjuntos.borrar(arch); guardar(); abrirPadre(a.tipo, a.refId); }); },
    ejemplo() {
      const s = MA.nuevo(), H = HOY, m = (n) => MA.masMeses(H.slice(0, 7) + '-01', n); s.pro = true; s.ejemplo = true; s.ajustes.propietario = 'María Santana Perdomo';
      const a = MA.crearInmueble(s, { nombre: 'Piso Calle Real 4', tipo: 'Vivienda', direccion: 'C/ Real 4, 2.º B, Arrecife', compraPrecio: 12000000, compraFecha: '2018-03-15' }, H);
      const b = MA.crearInmueble(s, { nombre: 'Plaza de garaje 12', tipo: 'Plaza de garaje', direccion: 'Edif. Las Palmeras, sótano' }, H);
      const c = MA.crearInmueble(s, { nombre: 'Trastero 3', tipo: 'Trastero' }, H);
      const qa = MA.crearInquilino(s, { nombre: 'Ana Pérez Gil', telefono: '600111222' }), qb = MA.crearInquilino(s, { nombre: 'Luis Gómez' }), qc = MA.crearInquilino(s, { nombre: 'Marta Cabrera' });
      MA.crearContrato(s, { inmuebleId: a.id, inquilinoId: qa.id, inicio: m(-14), importe: 75000, fianza: 75000, diaCobro: 1 }, H);
      MA.crearContrato(s, { inmuebleId: b.id, inquilinoId: qb.id, inicio: m(-6), importe: 6000, diaCobro: 5 }, H);
      MA.crearContrato(s, { inmuebleId: c.id, inquilinoId: qc.id, inicio: m(-3), importe: 4000, diaCobro: 10 }, H);
      for (const cg of s.cargos) if (cg.periodo < m(-1).slice(0, 7) || cg.contratoId === 2) MA.registrarPago(s, { cargoId: cg.id, importe: cg.importe, fecha: cg.vence > H ? H : cg.vence, metodo: 'Bizum' }, H);
      MA.crearConcepto(s, { inmuebleId: a.id, concepto: 'Comunidad', categoria: 'comunidad', periodicidad: 'mensual', importe: 4550, dia: 5, domiciliado: true }, H);
      MA.crearConcepto(s, { inmuebleId: a.id, concepto: 'IBI', categoria: 'impuesto', periodicidad: 'anual', mesInicio: 9, importe: 38000 }, H);
      s.pro = S.pro; S = s; alDia(); guardar(); location.hash = '#inicio'; pinta(); toast('Datos de ejemplo cargados');
    },
    finEjemplo() { confirma('Borrar el ejemplo', 'Se borrarán los datos de ejemplo y la app quedará lista para tus inmuebles.', 'Borrar y empezar', () => { const pro = S.pro; S = MA.nuevo(); S.pro = pro; guardar(); location.hash = '#inicio'; pinta(); }); },
    borrarTodo() { confirma('Borrar todos los datos', 'Se eliminarán inmuebles, inquilinos, contratos, cobros y gastos de este dispositivo. No se puede deshacer: guarda antes una copia si los quieres conservar.', 'Borrar todo', () => { const pro = S.pro; S = MA.nuevo(); S.pro = pro; guardar(); location.hash = '#inicio'; pinta(); toast('Datos borrados'); }); },
  };
  const AYUDA = `<h3>Cómo funciona</h3><p>Añade un <b>inmueble</b>, su <b>inquilino</b> y el <b>contrato</b>. Cada mes la app crea el recibo de alquiler. Cuando te paguen, pulsa <b>Cobrado</b> o abre el recibo para apuntar un pago parcial.</p>
    <h3>Estados de un recibo</h3><p><b>Pendiente</b>: aún no ha vencido. <b>A medias</b>: has cobrado una parte. <b>Atrasado</b>: ha pasado la fecha y falta dinero. <b>Cobrado</b>: completo. <b>Anulado</b>: ese mes no se cobra.</p>
    <h3>Gastos</h3><p>En la ficha de cada inmueble defines los gastos periódicos (IBI, comunidad, seguro…) y quién los paga. <b>Previsto</b>: todavía no toca. <b>Sin pagar</b>: ha pasado la fecha. <b>Por confirmar</b>: está domiciliado; comprueba el cargo en el banco y confírmalo. La app nunca da un gasto por pagado sin que tú lo digas.</p>
    <h3>Nada se pierde</h3><p>Los cobros y gastos no se borran: se anulan y quedan en el historial. Lo marcado como «estimado» es lo anterior a empezar a usar la app.</p>
    <h3>Mensajes y recibos</h3><p>La app prepara el texto y abre WhatsApp; el mensaje lo envías tú. Al marcar «Cobrado» puedes enviar al inquilino el <b>recibo en PDF</b>, numerado. Si se retrasa, a los 3 y a los 10 días te propone un recordatorio, cada vez más firme.</p>
    <h3>Desde la notificación</h3><p>Con los avisos activados, el día de cobro puedes pulsar <b>Cobrado</b> en la propia notificación.</p>
    <h3>Extracto del banco</h3><p>En Cobros o en Más, elige el extracto del banco (Norma 43, Excel o CSV) y la app propone qué ingresos son de cada recibo y qué cargos son tus gastos domiciliados. Revisas y confirmas; nada se apunta solo.</p>
    <h3>Renta</h3><p>Más › Informe para la Renta resume por inmueble los ingresos, los gastos deducibles, la amortización y la reducción. Para la amortización y la imputación de días vacíos necesita el valor catastral (está en el recibo del IBI). Es orientativo: revísalo antes de presentar.</p>
    <h3>Subida anual y fianza</h3><p>La app te avisa cuando toca actualizar la renta (IRAV o IPC, según el contrato), cuando hay que depositar la fianza y cuando hay que devolverla tras la entrega de llaves.</p>
    <h3>Tus datos</h3><p>Están solo en este dispositivo. La app hace copias automáticas en el móvil (Más › Ajustes y copias › Copias automáticas), con los documentos y fotos si lo eliges. De vez en cuando, envía una a Drive o a tu correo por si pierdes el móvil.</p>
    <h3>Varios titulares</h3><p>Si un inmueble es de varias personas, indica la parte de cada una en sus datos catastrales y de compra. El informe de la Renta se puede sacar por titular.</p>
    <h3>Habitaciones</h3><p>Si un inmueble se alquila por habitaciones, los gastos que cobras a los inquilinos (luz, agua, internet…) se reparten a partes iguales entre los que haya ese mes, y cada uno paga su parte.</p>
    <h3>Bloqueo</h3><p>En Más › Ajustes y copias puedes pedir la huella o el PIN del móvil al abrir la app.</p>
    <h3>Cuentas orientativas</h3><p>Las cifras del panel son un resumen de lo que has apuntado. No sustituyen a tu contabilidad ni a un asesor fiscal.</p>`;
  const PRIVACIDAD = `<p>Mis alquileres guarda todos los datos <b>solo en este dispositivo</b>. No hay cuentas, no se envía nada a servidores de IT Canarias ni de terceros, y no hay publicidad ni seguimiento.</p>
    <p>Los datos de tus inquilinos (nombre, teléfono, DNI) los introduces tú y eres responsable de ellos. Salen del dispositivo únicamente cuando tú compartes una copia, una exportación o un mensaje, o cuando activas las copias en tu propio Google Drive.</p>
    <p>La compra de la versión completa la gestiona Google Play; la app solo recibe si está comprada. Para borrar todos los datos usa «Borrar todos los datos» o desinstala la app.</p>
    <p class="sub">IT Canarias · itcanarias.com</p>`;

  const RAPIDAS = new Set(['cobrado', 'gastoPagado']); let tRapida = 0, uRapida = '';
  document.addEventListener('click', (e) => {
    if (e.target.id === 'fondo') return cerrar();
    const el = e.target.closest('[data-a]'); if (!el) return;
    const fn = A[el.dataset.a]; if (!fn) return;
    e.preventDefault(); e.stopPropagation();
    // Tras un cobro rápido la lista se recoloca: una segunda pulsación seguida no debe caer en el recibo siguiente
    if (RAPIDAS.has(el.dataset.a)) { if (uRapida === el.dataset.a && Date.now() - tRapida < 600) return; tRapida = Date.now(); uRapida = el.dataset.a; }
    try { fn(el.dataset.id ? Number(el.dataset.id) : undefined, el); } catch (x) { fallo(x); }
  });
  window.addEventListener('hashchange', () => { cerrar(); $('#vista').scrollTop = 0; pinta(); });
  window.Plataforma.alVolver(() => { const antes = HOY; alDia(); if (HOY !== antes) pinta(); copiaProgramada(); });

  // ---------- Arranque ----------
  (async function arrancar() {
    let lg = null; try { lg = localStorage.getItem('ma.idioma'); } catch (e) { /* */ }
    try { const txt = await Almacen.cargar(); if (txt) S = MA.importar(txt); } catch (e) { console.error(e); toast('No se han podido leer los datos guardados'); }
    Idioma.poner(lg || S.ajustes.idioma || Idioma.delSistema()); S.ajustes.idioma = Idioma.actual;
    await comprobarCompra(); alDia(); pinta(); guardar();
    Avisos.preparar(alPulsarAviso);
    if (!NATIVO && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.__ma = { get S() { return S; }, pinta }; // para las pruebas automáticas
  })();
})();
