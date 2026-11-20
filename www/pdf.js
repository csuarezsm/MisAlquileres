/* Mis alquileres — generador de PDF sencillo (texto, líneas y rectángulos, Helvetica), sin librerías. © 2026 IT Canarias. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.PDF = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Anchos de Helvetica (milésimas de em) para ASCII 32–126
  const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const base = (ch) => ch.normalize('NFD')[0];
  function ancho(txt, size, negrita) {
    let w = 0;
    for (const ch of String(txt)) { const c = (ch === '€' ? '0' : base(ch)).charCodeAt(0); w += c >= 32 && c <= 126 ? W[c - 32] : 556; }
    return (w * size * (negrita ? 1.05 : 1)) / 1000;
  }
  // Texto a bytes WinAnsi (Latin-1 + €) escapado para un literal de PDF
  function literal(txt) {
    let o = '(';
    for (const ch of String(txt)) {
      let c = ch === '€' ? 0x80 : ch === '–' || ch === '—' ? 0x96 : ch === '«' ? 0xab : ch === '»' ? 0xbb : ch === '·' ? 0xb7 : ch.charCodeAt(0);
      if (c > 255) c = 63;
      if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
      else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0');
      else o += String.fromCharCode(c);
    }
    return o + ')';
  }
  const n = (x) => (Math.round(x * 100) / 100).toString();

  // Documento A4 (595 × 842 pt). Coordenadas desde arriba a la izquierda, en puntos.
  function Documento() {
    const paginas = [];
    let ops = null;
    const doc = {
      ancho: 595, alto: 842, margen: 50, y: 0,
      pagina() { ops = []; paginas.push(ops); doc.y = doc.margen; return doc; },
      texto(x, y, txt, o = {}) {
        const size = o.size || 10, f = o.negrita ? 'F2' : 'F1';
        let xx = x;
        if (o.alinear === 'derecha') xx = x - ancho(txt, size, o.negrita);
        else if (o.alinear === 'centro') xx = x - ancho(txt, size, o.negrita) / 2;
        const color = o.color || [0.11, 0.12, 0.14];
        ops.push(`${color.map(n).join(' ')} rg BT /${f} ${size} Tf ${n(xx)} ${n(doc.alto - y - size)} Td ${literal(txt)} Tj ET`);
        return doc;
      },
      linea(x1, y1, x2, y2, o = {}) { ops.push(`${(o.color || [0.8, 0.8, 0.8]).map(n).join(' ')} RG ${n(o.grosor || 0.7)} w ${n(x1)} ${n(doc.alto - y1)} m ${n(x2)} ${n(doc.alto - y2)} l S`); return doc; },
      rect(x, y, w, h, color) { ops.push(`${color.map(n).join(' ')} rg ${n(x)} ${n(doc.alto - y - h)} ${n(w)} ${n(h)} re f`); return doc; },
      // Escribe un párrafo con saltos de línea automáticos; pasa de página si no cabe
      parrafo(txt, o = {}) {
        const size = o.size || 10, x = o.x || doc.margen, max = o.ancho || doc.ancho - x - doc.margen, alto = size * 1.4;
        for (const bloque of String(txt).split('\n')) {
          let linea = '';
          for (const pal of bloque.split(' ')) {
            const prueba = linea ? linea + ' ' + pal : pal;
            if (ancho(prueba, size, o.negrita) > max && linea) { doc.salto(alto); doc.texto(x, doc.y, linea, o); doc.y += alto; linea = pal; } else linea = prueba;
          }
          doc.salto(alto); doc.texto(x, doc.y, linea, o); doc.y += alto;
        }
        return doc;
      },
      salto(h) { if (doc.y + h > doc.alto - doc.margen) doc.pagina(); return doc; },
      bytes() {
        const objs = [], add = (s) => { objs.push(s); return objs.length; };
        const cat = add(null), pags = add(null), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        const kids = paginas.map((p) => { const s = p.join('\n'), c = add(`<< /Length ${s.length} >>\nstream\n${s}\nendstream`);
          return add(`<< /Type /Page /Parent ${pags} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`); });
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
    return doc.pagina();
  }

  const eur = (c) => (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
  const f = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  const AMARILLO = [0.91, 0.69, 0.02], OSCURO = [0.14, 0.15, 0.17], GRIS = [0.4, 0.42, 0.45];

  // Recibo de alquiler para el inquilino
  function recibo(r) {
    const d = Documento(), M = d.margen, D = d.ancho - M;
    d.rect(0, 0, d.ancho, 6, AMARILLO);
    d.texto(M, 40, 'RECIBO DE ALQUILER', { size: 20, negrita: true });
    d.texto(D, 42, `Nº ${r.numero}`, { size: 12, negrita: true, alinear: 'derecha' });
    d.texto(D, 60, `Fecha: ${f(r.fecha)}`, { size: 10, alinear: 'derecha', color: GRIS });
    d.linea(M, 84, D, 84);
    let y = 104;
    const fila = (et, val, o = {}) => { d.texto(M, y, et, { size: 9, color: GRIS }); d.parrafo(val, { x: M + 120, size: o.size || 11, negrita: o.negrita, ancho: D - M - 120 }); };
    d.y = y;
    const campo = (et, val, o) => { y = d.y; fila(et, val, o); d.y += 6; };
    campo('Recibí de', r.inquilino + (r.inquilinoDni ? ` (DNI/NIE ${r.inquilinoDni})` : ''), { negrita: true });
    campo('La cantidad de', `${eur(r.pagado)} (${r.letras})`, { negrita: true });
    campo('En concepto de', `Alquiler de ${r.inmueble}${r.direccion ? ', ' + r.direccion : ''}, correspondiente a ${r.mes}.`);
    campo('Forma de pago', r.pagos.map((p) => `${f(p.fecha)}${p.metodo ? ' · ' + p.metodo : ''} · ${eur(p.importe)}`).join('\n'));
    y = d.y + 8;
    d.rect(M, y, D - M, 46, r.completo ? [0.89, 0.95, 0.92] : [0.99, 0.95, 0.81]);
    d.texto(M + 14, y + 10, r.completo ? 'Mes pagado por completo' : `Pago a cuenta. Queda pendiente: ${eur(r.pendiente)}`, { size: 12, negrita: true, color: r.completo ? [0.12, 0.48, 0.3] : [0.54, 0.35, 0] });
    d.texto(M + 14, y + 28, `Renta del mes: ${eur(r.importe)}`, { size: 9, color: GRIS });
    y += 90;
    d.texto(M, y, 'El arrendador', { size: 9, color: GRIS });
    d.linea(M, y + 52, M + 220, y + 52, { color: [0.6, 0.6, 0.6] });
    d.texto(M, y + 58, r.propietario || ' ', { size: 11, negrita: true });
    if (r.propietarioDni) d.texto(M, y + 74, `DNI/NIF ${r.propietarioDni}`, { size: 9, color: GRIS });
    if (r.propietarioDomicilio) d.texto(M, y + 88, r.propietarioDomicilio, { size: 9, color: GRIS });
    d.texto(M, d.alto - 60, `Emitido el ${f(r.emitido)} con Mis alquileres.`, { size: 8, color: GRIS });
    return d.bytes();
  }

  // Informe para la Renta (orientativo)
  function renta(inf, propietario) {
    const d = Documento(), M = d.margen, D = d.ancho - M;
    const fila = (a, b, o = {}) => { d.salto(18); d.texto(M + (o.sangria || 0), d.y, a, { size: o.size || 10, negrita: o.negrita }); d.texto(D, d.y, b, { size: o.size || 10, negrita: o.negrita, alinear: 'derecha' }); d.y += o.size ? o.size + 7 : 16; };
    const titulo = (t) => { d.salto(40); d.y += 10; d.texto(M, d.y, t, { size: 13, negrita: true }); d.y += 20; d.linea(M, d.y - 4, D, d.y - 4); d.y += 4; };
    d.rect(0, 0, d.ancho, 6, AMARILLO);
    d.texto(M, 34, `Alquileres · Ejercicio ${inf.anio}`, { size: 18, negrita: true }); d.y = 62;
    d.parrafo(`Resumen orientativo de los rendimientos del capital inmobiliario${propietario ? ' de ' + propietario : ''}, generado el ${f(inf.generado)} con los datos apuntados en Mis alquileres. Revísalo con tu asesor o con Renta Web antes de presentar la declaración.`, { size: 9, color: GRIS });
    const t = inf.totales;
    titulo('Resumen');
    fila('Ingresos íntegros', eur(t.ingresos)); fila('Gastos deducibles', eur(t.gastos)); fila('Rendimiento neto', eur(t.neto), { negrita: true });
    if (t.reduccion) { fila('Reducción por alquiler de vivienda', '− ' + eur(t.reduccion)); fila('Rendimiento neto reducido', eur(t.reducido), { negrita: true }); }
    if (t.retenciones) fila('Retenciones soportadas', eur(t.retenciones));
    if (t.imputacion) fila('Imputación de rentas (días sin alquilar)', eur(t.imputacion));
    for (const x of inf.inmuebles) {
      titulo(`${x.nombre} · ${x.tipo}`);
      d.parrafo([x.direccion, x.referencia ? 'Referencia catastral: ' + x.referencia : 'Sin referencia catastral'].filter(Boolean).join(' · '), { size: 9, color: GRIS });
      if (x.sinActividad) { d.parrafo(x.avisos.join('\n'), { size: 10 }); if (x.imputacion) fila('Imputación de rentas', eur(x.imputacion.importe)); continue; }
      d.parrafo(`Días en propiedad: ${x.diasPropiedad} · Días alquilado: ${x.diasAlquilado}${x.diasVacio ? ' · Días sin alquilar: ' + x.diasVacio : ''}`, { size: 9, color: GRIS });
      d.y += 4;
      for (const c of x.contratos) fila(`${c.inquilino}${c.dni ? ' (' + c.dni + ')' : ''} · desde ${f(c.inicio)}${x.vivienda ? ' · reducción ' + c.reduccion + ' %' : ''}`, eur(c.ingresos), { size: 9 });
      fila('Ingresos íntegros', eur(x.ingresos.total), { negrita: true });
      if (x.ingresos.repercutidos) fila('de ellos, gastos cobrados al inquilino', eur(x.ingresos.repercutidos), { sangria: 12, size: 9 });
      for (const [k, v] of Object.entries(x.gastos)) if (v) fila(inf.grupos[k], eur(v), { sangria: 12 });
      if (x.exceso) fila('Menos exceso de intereses y reparaciones', '− ' + eur(x.exceso), { sangria: 12 });
      if (x.arrastreAplicado) fila('Más excesos de años anteriores', eur(x.arrastreAplicado), { sangria: 12 });
      fila('Gastos deducibles', eur(x.gastosAplicados), { negrita: true });
      fila('Rendimiento neto', eur(x.rendimientoNeto), { negrita: true });
      if (x.reduccion) { fila(`Reducción (${String(x.reduccionPct).replace('.', ',')} %)`, '− ' + eur(x.reduccion)); fila('Rendimiento neto reducido', eur(x.rendimientoReducido), { negrita: true }); }
      if (x.retenciones) fila('Retenciones (19 %)', eur(x.retenciones));
      if (x.imputacion) fila(`Imputación ${String(x.imputacion.porcentaje).replace('.', ',')} % × ${x.imputacion.dias} días`, eur(x.imputacion.importe));
      if (x.amortizacion) d.parrafo(`Amortización: 3 % de ${eur(x.amortizacion.base)} (${x.amortizacion.sobre}; construcción ${String(x.amortizacion.porcentajeConstruccion).replace('.', ',')} %) por ${x.diasAlquilado} días.`, { size: 8, color: GRIS });
      if (x.avisos.length) { d.y += 4; d.parrafo(x.avisos.map((a) => '• ' + a).join('\n'), { size: 8.5, color: [0.54, 0.35, 0] }); }
    }
    d.y += 14; d.parrafo('Este informe es una ayuda para preparar la declaración y no sustituye el asesoramiento fiscal. Las cifras dependen de que los datos apuntados sean completos y correctos.', { size: 8, color: GRIS });
    return d.bytes();
  }

  return { Documento, ancho, recibo, renta };
});
