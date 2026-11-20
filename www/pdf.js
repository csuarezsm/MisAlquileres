/* Mis alquileres — generador de PDF sin librerías: texto, líneas, rectángulos y tablas en Helvetica (WinAnsi).
   Las páginas pueden tener alto fijo (A4) o ajustarse al contenido (recibo). © 2026 IT Canarias. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.PDF = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const base = (ch) => ch.normalize('NFD')[0];
  function ancho(txt, size, negrita) {
    let w = 0;
    for (const ch of String(txt)) { const c = (ch === '€' ? '0' : base(ch)).charCodeAt(0); w += c >= 32 && c <= 126 ? W[c - 32] : 556; }
    return (w * size * (negrita ? 1.06 : 1)) / 1000;
  }
  function recorta(txt, size, max, negrita) {
    txt = String(txt == null ? '' : txt);
    if (ancho(txt, size, negrita) <= max) return txt;
    while (txt.length > 1 && ancho(txt + '…', size, negrita) > max) txt = txt.slice(0, -1);
    return txt + '…';
  }
  function literal(txt) {
    let o = '(';
    for (const ch of String(txt)) {
      let c = ch === '€' ? 0x80 : ch === '–' ? 0x96 : ch === '—' ? 0x97 : ch === '…' ? 0x85 : ch === '•' ? 0x95 : ch === '‘' ? 0x91 : ch === '’' ? 0x92 : ch === '“' ? 0x93 : ch === '”' ? 0x94 : ch.charCodeAt(0);
      if (c > 255) c = 63;
      if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
      else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0');
      else o += String.fromCharCode(c);
    }
    return o + ')';
  }
  const n = (x) => (Math.round(x * 100) / 100).toString();
  const rgb = (c) => c.map(n).join(' ');

  // Coordenadas desde arriba a la izquierda, en puntos. Las operaciones se guardan como funciones del alto final.
  function Documento(opc = {}) {
    const paginas = [];
    let pg = null;
    const doc = {
      ancho: opc.ancho || 595, alto: opc.alto || 842, margen: opc.margen || 44, y: 0, ajustar: !!opc.ajustar,
      pagina() { pg = { ops: [], ancho: doc.ancho, alto: doc.alto }; paginas.push(pg); doc.y = doc.margen; if (doc.alPaginar) doc.alPaginar(doc); return doc; },
      texto(x, y, txt, o = {}) {
        const size = o.size || 10, f = o.negrita ? 'F2' : 'F1', t = o.max ? recorta(txt, size, o.max, o.negrita) : String(txt);
        const xx = o.alinear === 'derecha' ? x - ancho(t, size, o.negrita) : o.alinear === 'centro' ? x - ancho(t, size, o.negrita) / 2 : x;
        const color = o.color || [0.08, 0.1, 0.11];
        pg.ops.push((H) => `${rgb(color)} rg BT /${f} ${size} Tf ${n(xx)} ${n(H - y - size * 0.8)} Td ${literal(t)} Tj ET`);
        return doc;
      },
      linea(x1, y1, x2, y2, o = {}) { pg.ops.push((H) => `${rgb(o.color || [0.82, 0.84, 0.85])} RG ${n(o.grosor || 0.6)} w ${n(x1)} ${n(H - y1)} m ${n(x2)} ${n(H - y2)} l S`); return doc; },
      rect(x, y, w, h, color) { pg.ops.push((H) => `${rgb(color)} rg ${n(x)} ${n(H - y - h)} ${n(w)} ${n(h)} re f`); return doc; },
      parrafo(txt, o = {}) {
        const size = o.size || 10, x = o.x != null ? o.x : doc.margen, max = o.ancho || doc.ancho - x - doc.margen, alto = size * (o.interlinea || 1.4);
        for (const bloque of String(txt).split('\n')) {
          let lin = '';
          const escribe = (t) => { doc.salto(alto); doc.texto(x, doc.y, t, o); doc.y += alto; };
          for (const pal of bloque.split(' ')) { const pr = lin ? lin + ' ' + pal : pal; if (ancho(pr, size, o.negrita) > max && lin) { escribe(lin); lin = pal; } else lin = pr; }
          escribe(lin);
        }
        return doc;
      },
      salto(h) { if (!doc.ajustar && doc.y + h > doc.alto - doc.margen) doc.pagina(); return doc; },
      // Tabla con cabecera repetida en cada página. columnas: [{t, tipo, ancho?}]
      tabla(cols, filas, o = {}) {
        const size = o.size || 8.5, padH = 4, altoF = size * 1.9, x0 = doc.margen, total = doc.ancho - 2 * doc.margen;
        const pesos = cols.map((c, i) => c.ancho || Math.min(4, Math.max(c.tipo === 'euros' ? 1.25 : c.tipo === 'fecha' ? 1.15 : c.tipo === 'num' ? 0.8 : 1,
          ...filas.slice(0, 60).map((f) => String(o.fmt ? o.fmt(f[i], c) : f[i] || '').length / 11), c.t.length / 14)));
        const sumP = pesos.reduce((a, b) => a + b, 0), anchos = pesos.map((p) => (p / sumP) * total);
        const der = (c) => c.tipo === 'euros' || c.tipo === 'num';
        const cab = () => {
          doc.rect(x0, doc.y, total, altoF, o.colorCab || [0.94, 0.95, 0.95]); let x = x0;
          cols.forEach((c, i) => { doc.texto(der(c) ? x + anchos[i] - padH : x + padH, doc.y + altoF * 0.3, c.t, { size: size - 0.5, negrita: true, alinear: der(c) ? 'derecha' : null, max: anchos[i] - 2 * padH }); x += anchos[i]; });
          doc.y += altoF;
        };
        cab();
        const fila = (f, negrita) => {
          if (doc.y + altoF > doc.alto - doc.margen) { doc.pagina(); cab(); }
          let x = x0;
          cols.forEach((c, i) => { const v = o.fmt ? o.fmt(f[i], c) : f[i]; if (v != null && v !== '') doc.texto(der(c) ? x + anchos[i] - padH : x + padH, doc.y + altoF * 0.3, v, { size, negrita, alinear: der(c) ? 'derecha' : null, max: anchos[i] - 2 * padH }); x += anchos[i]; });
          doc.y += altoF; doc.linea(x0, doc.y, x0 + total, doc.y, { color: [0.9, 0.91, 0.91], grosor: 0.4 });
        };
        filas.forEach((f) => fila(f));
        if (o.totales) { doc.linea(x0, doc.y, x0 + total, doc.y, { color: [0.3, 0.3, 0.3], grosor: 0.8 }); fila(o.totales, true); }
        return doc;
      },
      bytes() {
        if (doc.ajustar) pg.alto = Math.ceil(doc.y + doc.margen);
        const objs = [], add = (s) => { objs.push(s); return objs.length; };
        const cat = add(null), pags = add(null), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        const kids = paginas.map((p) => { const s = p.ops.map((f) => f(p.alto)).join('\n'), c = add(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
          return add(`<< /Type /Page /Parent ${pags} 0 R /MediaBox [0 0 ${n(p.ancho)} ${n(p.alto)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`); });
        objs[cat - 1] = `<< /Type /Catalog /Pages ${pags} 0 R >>`;
        objs[pags - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
        let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const xref = [];
        objs.forEach((o, i) => { xref.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xs = out.length;
        out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map((x) => String(x).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${xs}\n%%EOF`;
        const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255;
        return b;
      },
    };
    if (opc.alPaginar) doc.alPaginar = opc.alPaginar;
    return doc.pagina();
  }

  const eur = (c) => (c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
  const f = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  const NEGRO = [0.08, 0.1, 0.11], GRIS = [0.36, 0.4, 0.43], CLARO = [0.94, 0.95, 0.95];
  const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255) : [0.91, 0.69, 0.02]; };
  const suave = (c) => c.map((x) => 1 - (1 - x) * 0.16);
  const id = (s) => s;

  // Recibo de alquiler: tamaño medio folio, alto ajustado al contenido
  function recibo(r, o = {}) {
    const t = o.t || id, acento = hex(o.acento), d = Documento({ ancho: 420, alto: 2000, margen: 26, ajustar: true }), M = d.margen, D = d.ancho - M, A = D - M;
    d.rect(0, 0, d.ancho, 5, acento);
    d.y = 22;
    d.texto(M, d.y, t('Recibo de alquiler'), { size: 16, negrita: true });
    d.texto(D, d.y + 1, `${t('Nº')} ${r.numero}`, { size: 10.5, negrita: true, alinear: 'derecha' });
    d.texto(D, d.y + 16, f(r.fecha), { size: 9, color: GRIS, alinear: 'derecha' });
    d.y += 38;
    // Arrendador e inquilino, en dos columnas
    const col = (x, et, nombre, dni, extra) => { d.texto(x, d.y, t(et), { size: 7.5, color: GRIS }); d.texto(x, d.y + 11, nombre || '—', { size: 10, negrita: true, max: A / 2 - 10 });
      if (dni) d.texto(x, d.y + 25, `${t('DNI/NIF')} ${dni}`, { size: 8, color: GRIS }); if (extra) d.texto(x, d.y + (dni ? 37 : 25), extra, { size: 8, color: GRIS, max: A / 2 - 10 }); };
    col(M, 'Arrendador', r.propietario, r.propietarioDni, r.propietarioDomicilio);
    col(M + A / 2 + 6, 'Inquilino', r.inquilino, r.inquilinoDni);
    d.y += r.propietarioDomicilio ? 52 : 42;
    d.linea(M, d.y, D, d.y); d.y += 10;
    d.texto(M, d.y, t('Concepto'), { size: 7.5, color: GRIS }); d.y += 11;
    d.parrafo(`${t('Alquiler de')} ${r.inmueble}${r.direccion ? ', ' + r.direccion : ''}. ${t('Mes')}: ${r.mes}.`, { size: 9.5, ancho: A, interlinea: 1.35 });
    d.y += 6;
    // Importe destacado
    const alto = 46;
    d.rect(M, d.y, A, alto, suave(acento));
    d.rect(M, d.y, 3, alto, acento);
    d.texto(M + 12, d.y + 8, t(r.completo ? 'Importe recibido' : 'Importe recibido a cuenta'), { size: 7.5, color: GRIS });
    d.texto(M + 12, d.y + 19, eur(r.pagado), { size: 17, negrita: true });
    d.texto(D - 10, d.y + 10, t(r.completo ? 'Mes pagado por completo' : 'Queda pendiente'), { size: 7.5, color: GRIS, alinear: 'derecha' });
    d.texto(D - 10, d.y + 21, r.completo ? `${t('Renta')} ${eur(r.importe)}` : eur(r.pendiente), { size: 11, negrita: true, alinear: 'derecha', color: r.completo ? [0.09, 0.47, 0.3] : [0.72, 0.2, 0.16] });
    d.y += alto + 6;
    if (r.letras) { d.parrafo(`(${r.letras})`, { size: 8, color: GRIS, ancho: A }); }
    // Pagos
    if (r.pagos.length > 1 || r.pagos[0].metodo) {
      d.y += 4;
      for (const p of r.pagos) { d.texto(M, d.y, `${f(p.fecha)}${p.metodo ? '  ·  ' + p.metodo : ''}`, { size: 8.5, color: GRIS }); d.texto(D, d.y, eur(p.importe), { size: 8.5, alinear: 'derecha', color: GRIS }); d.y += 13; }
    }
    // Firma
    d.y += 18;
    d.linea(D - 170, d.y + 22, D, d.y + 22, { color: [0.55, 0.57, 0.58] });
    d.texto(D, d.y + 27, r.propietario || t('El arrendador'), { size: 8.5, alinear: 'derecha', negrita: true });
    d.texto(M, d.y + 27, `${t('Emitido el')} ${f(r.emitido)}`, { size: 7, color: GRIS });
    d.y += 38;
    return d.bytes();
  }

  // Listado: A4 vertical, o apaisado si tiene muchas columnas
  function listado(tabla, o = {}) {
    const t = o.t || id, apaisado = tabla.columnas.length > 6, acento = hex(o.acento);
    const fmt = (v, c) => (v == null || v === '' ? '' : c.tipo === 'euros' ? eur(v) : c.tipo === 'fecha' ? f(v) : c.tipo === 'num' ? String(v).replace('.', ',') : String(v));
    const d = Documento({ ancho: apaisado ? 842 : 595, alto: apaisado ? 595 : 842, margen: 32 });
    d.rect(0, 0, d.ancho, 4, acento);
    d.texto(d.margen, 22, tabla.titulo, { size: 15, negrita: true });
    d.texto(d.ancho - d.margen, 25, `${o.propietario ? o.propietario + ' · ' : ''}${f(o.hoy)}`, { size: 8.5, color: GRIS, alinear: 'derecha' });
    d.y = 44;
    if (tabla.subtitulo) { d.texto(d.margen, d.y, tabla.subtitulo, { size: 9, color: GRIS }); d.y += 16; }
    d.y += 4;
    if (!tabla.filas.length) d.texto(d.margen, d.y + 10, t('No hay datos con estos filtros.'), { size: 10, color: GRIS });
    else d.tabla(tabla.columnas, tabla.filas, { fmt, totales: tabla.totales, size: apaisado ? 8 : 8.5 });
    d.y += 10; d.texto(d.margen, Math.min(d.y, d.alto - d.margen), `${tabla.filas.length} ${t('filas')} · Mis alquileres`, { size: 7, color: GRIS });
    return d.bytes();
  }

  // Extracto de un inquilino
  function extracto(e, o = {}) {
    const t = o.t || id, acento = hex(o.acento), d = Documento({ margen: 40 }), M = d.margen, D = d.ancho - M;
    d.rect(0, 0, d.ancho, 5, acento);
    d.texto(M, 30, t('Extracto de cuenta'), { size: 18, negrita: true });
    d.texto(D, 33, f(e.hoy), { size: 9, color: GRIS, alinear: 'derecha' });
    d.y = 60;
    d.texto(M, d.y, e.inquilino.nombre, { size: 12, negrita: true }); d.y += 16;
    if (e.inquilino.dni) { d.texto(M, d.y, `${t('DNI/NIF')} ${e.inquilino.dni}`, { size: 9, color: GRIS }); d.y += 13; }
    if (o.propietario) { d.texto(M, d.y, `${t('Arrendador')}: ${o.propietario}`, { size: 9, color: GRIS }); d.y += 13; }
    if (e.F.desde || e.F.hasta) { d.texto(M, d.y, `${t('Periodo')}: ${e.F.desde ? f(e.F.desde) : '…'} – ${e.F.hasta ? f(e.F.hasta) : f(e.hoy)}`, { size: 9, color: GRIS }); d.y += 13; }
    d.y += 8;
    const caja = (x, w, et, v, color) => { d.rect(x, d.y, w, 42, CLARO); d.texto(x + 10, d.y + 8, t(et), { size: 8, color: GRIS }); d.texto(x + 10, d.y + 20, eur(v), { size: 13, negrita: true, color: color || NEGRO }); };
    const w = (D - M - 16) / 3;
    caja(M, w, 'Total a pagar', e.total); caja(M + w + 8, w, 'Pagado', e.pagado, [0.09, 0.47, 0.3]); caja(M + 2 * (w + 8), w, 'Pendiente', e.pendiente, e.pendiente ? [0.72, 0.2, 0.16] : NEGRO);
    d.y += 58;
    d.tabla([{ t: t('Vencimiento'), tipo: 'fecha', ancho: 1.1 }, { t: t('Concepto'), ancho: 3.6 }, { t: t('Importe'), tipo: 'euros', ancho: 1.2 }, { t: t('Pagado'), tipo: 'euros', ancho: 1.2 }, { t: t('Pendiente'), tipo: 'euros', ancho: 1.2 }],
      e.lineas.map((l) => [l.fecha, l.concepto, l.cargo, l.abono, l.pendiente]), { fmt: (v, c) => (v == null ? '' : c.tipo === 'euros' ? eur(v) : c.tipo === 'fecha' ? f(v) : v), totales: [null, t('Total'), e.total, e.pagado, e.pendiente], size: 9 });
    d.y += 16;
    if (o.formaPago && e.pendiente) d.parrafo(`${t('Forma de pago')}: ${o.formaPago}`, { size: 9.5 });
    return d.bytes();
  }

  // Informe para la Renta (orientativo)
  function renta(inf, propietario, o = {}) {
    const t = o.t || id, acento = hex(o.acento), d = Documento({ margen: 46 }), M = d.margen, D = d.ancho - M;
    const fila = (a, b, op = {}) => { d.salto(18); d.texto(M + (op.sangria || 0), d.y, a, { size: op.size || 10, negrita: op.negrita, max: D - M - 110 }); d.texto(D, d.y, b, { size: op.size || 10, negrita: op.negrita, alinear: 'derecha' }); d.y += op.size ? op.size + 7 : 16; };
    const titulo = (x) => { d.salto(44); d.y += 12; d.texto(M, d.y, x, { size: 13, negrita: true, max: D - M }); d.y += 19; d.linea(M, d.y - 3, D, d.y - 3); d.y += 5; };
    d.rect(0, 0, d.ancho, 5, acento);
    d.texto(M, 30, `${t('Alquileres')} · ${t('Ejercicio')} ${inf.anio}`, { size: 18, negrita: true }); d.y = 60;
    d.parrafo(`${t('Resumen orientativo de los rendimientos del capital inmobiliario')}${propietario ? ' — ' + propietario : ''}. ${t('Generado el')} ${f(inf.generado)}. ${t('Revísalo con tu asesor o con Renta Web antes de presentar la declaración.')}`, { size: 9, color: GRIS });
    const T2 = inf.totales;
    titulo(t('Resumen'));
    fila(t('Ingresos íntegros'), eur(T2.ingresos)); fila(t('Gastos deducibles'), eur(T2.gastos)); fila(t('Rendimiento neto'), eur(T2.neto), { negrita: true });
    if (T2.reduccion) { fila(t('Reducción por alquiler de vivienda'), '− ' + eur(T2.reduccion)); fila(t('Rendimiento neto reducido'), eur(T2.reducido), { negrita: true }); }
    if (T2.retenciones) fila(t('Retenciones soportadas'), eur(T2.retenciones));
    if (T2.imputacion) fila(t('Imputación de rentas (días sin alquilar)'), eur(T2.imputacion));
    for (const x of inf.inmuebles) {
      titulo(`${x.nombre} · ${t(x.tipo)}`);
      d.parrafo([x.direccion, x.referencia ? t('Referencia catastral') + ': ' + x.referencia : t('Sin referencia catastral')].filter(Boolean).join(' · '), { size: 9, color: GRIS });
      if (x.sinActividad) { d.parrafo(x.avisos.join('\n'), { size: 10 }); if (x.imputacion) fila(t('Imputación de rentas'), eur(x.imputacion.importe)); continue; }
      d.parrafo(`${t('Días en propiedad')}: ${x.diasPropiedad} · ${t('Días alquilado')}: ${x.diasAlquilado}${x.diasVacio ? ' · ' + t('Días sin alquilar') + ': ' + x.diasVacio : ''}`, { size: 9, color: GRIS });
      d.y += 4;
      for (const c of x.contratos) fila(`${c.inquilino}${c.dni ? ' (' + c.dni + ')' : ''} · ${t('desde')} ${f(c.inicio)}${x.vivienda ? ' · ' + t('reducción') + ' ' + c.reduccion + ' %' : ''}`, eur(c.ingresos), { size: 9 });
      fila(t('Ingresos íntegros'), eur(x.ingresos.total), { negrita: true });
      if (x.ingresos.repercutidos) fila(t('de ellos, gastos cobrados al inquilino'), eur(x.ingresos.repercutidos), { sangria: 12, size: 9 });
      for (const [k, v] of Object.entries(x.gastos)) if (v) fila(t(inf.grupos[k]), eur(v), { sangria: 12 });
      if (x.exceso) fila(t('Menos exceso de intereses y reparaciones'), '− ' + eur(x.exceso), { sangria: 12 });
      if (x.arrastreAplicado) fila(t('Más excesos de años anteriores'), eur(x.arrastreAplicado), { sangria: 12 });
      fila(t('Gastos deducibles'), eur(x.gastosAplicados), { negrita: true });
      fila(t('Rendimiento neto'), eur(x.rendimientoNeto), { negrita: true });
      if (x.reduccion) { fila(`${t('Reducción')} (${String(x.reduccionPct).replace('.', ',')} %)`, '− ' + eur(x.reduccion)); fila(t('Rendimiento neto reducido'), eur(x.rendimientoReducido), { negrita: true }); }
      if (x.retenciones) fila(t('Retenciones (19 %)'), eur(x.retenciones));
      if (x.imputacion) fila(`${t('Imputación')} ${String(x.imputacion.porcentaje).replace('.', ',')} % × ${x.imputacion.dias} ${t('días')}`, eur(x.imputacion.importe));
      if (x.avisos.length) { d.y += 4; d.parrafo(x.avisos.map((a) => '• ' + a).join('\n'), { size: 8.5, color: [0.56, 0.36, 0] }); }
    }
    d.y += 14; d.parrafo(t('Este informe es una ayuda para preparar la declaración y no sustituye el asesoramiento fiscal. Las cifras dependen de que los datos apuntados sean completos y correctos.'), { size: 8, color: GRIS });
    return d.bytes();
  }

  return { Documento, ancho, recibo, listado, extracto, renta, eur };
});
