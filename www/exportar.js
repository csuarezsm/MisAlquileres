/* Mis alquileres — listados e informes exportables a Excel (.xlsx), PDF y ZIP, sin librerías. © 2026 IT Canarias. */
(function (root, factory) {
  const MA = typeof module === 'object' && module.exports ? require('./extras.js') : root.MA;
  const m = factory(MA);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.Exportar = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (MA) {
  'use strict';
  const T = (s) => (typeof globalThis !== 'undefined' && globalThis.Idioma ? globalThis.Idioma.t(s) : s);

  // ---------- ZIP (sin compresión) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const utf8 = (s) => new TextEncoder().encode(s);
  function zip(archivos) {
    const partes = [], central = []; let off = 0;
    const d = new Date(), hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const { nombre, datos } of archivos) {
      const b = typeof datos === 'string' ? utf8(datos) : datos, n = utf8(nombre), crc = crc32(b);
      const h = new Uint8Array(30 + n.length), v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(10, hora, true); v.setUint16(12, dia, true);
      v.setUint32(14, crc, true); v.setUint32(18, b.length, true); v.setUint32(22, b.length, true); v.setUint16(26, n.length, true); h.set(n, 30);
      const c = new Uint8Array(46 + n.length), w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(12, hora, true); w.setUint16(14, dia, true);
      w.setUint32(16, crc, true); w.setUint32(20, b.length, true); w.setUint32(24, b.length, true); w.setUint16(28, n.length, true); w.setUint32(42, off, true); c.set(n, 46);
      partes.push(h, b); central.push(c); off += h.length + b.length;
    }
    const tamC = central.reduce((t, c) => t + c.length, 0), fin = new Uint8Array(22), f = new DataView(fin.buffer);
    f.setUint32(0, 0x06054b50, true); f.setUint16(8, archivos.length, true); f.setUint16(10, archivos.length, true); f.setUint32(12, tamC, true); f.setUint32(16, off, true);
    const out = new Uint8Array(off + tamC + 22); let p = 0;
    for (const x of [...partes, ...central, fin]) { out.set(x, p); p += x.length; }
    return out;
  }

  // ---------- Excel (.xlsx) ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const col = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const serial = (iso) => (Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 864e5;
  // estilos: 0 normal, 1 cabecera, 2 euros, 3 fecha, 4 título, 5 euros en negrita
  function hoja(t) {
    const filas = [`<row r="1"><c r="A1" t="inlineStr" s="4"><is><t>${esc(t.titulo)}</t></is></c></row>`];
    let r = 2;
    if (t.subtitulo) { filas.push(`<row r="${r}"><c r="A${r}" t="inlineStr"><is><t>${esc(t.subtitulo)}</t></is></c></row>`); r++; }
    r++;
    filas.push(`<row r="${r}">${t.columnas.map((c, i) => `<c r="${col(i)}${r}" t="inlineStr" s="1"><is><t>${esc(c.t)}</t></is></c>`).join('')}</row>`);
    const cab = r; r++;
    const celda = (v, c, i, neg) => {
      const ref = `${col(i)}${r}`;
      if (v == null || v === '') return '';
      if (c.tipo === 'euros') return `<c r="${ref}" s="${neg ? 5 : 2}"><v>${v / 100}</v></c>`;
      if (c.tipo === 'num') return `<c r="${ref}"><v>${v}</v></c>`;
      if (c.tipo === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `<c r="${ref}" s="3"><v>${serial(v)}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    };
    for (const f of t.filas) { filas.push(`<row r="${r}">${t.columnas.map((c, i) => celda(f[i], c, i)).join('')}</row>`); r++; }
    if (t.totales) { filas.push(`<row r="${r}">${t.columnas.map((c, i) => (i === 0 ? `<c r="A${r}" t="inlineStr" s="1"><is><t>${esc(T('Total'))}</t></is></c>` : celda(t.totales[i], c, i, true))).join('')}</row>`); r++; }
    const anchos = t.columnas.map((c, i) => Math.min(60, Math.max(c.t.length + 2, c.tipo === 'euros' ? 13 : c.tipo === 'fecha' ? 11 : 8, ...t.filas.slice(0, 300).map((f) => (f[i] == null ? 0 : String(c.tipo === 'euros' ? (f[i] / 100).toFixed(2) : f[i]).length + 2)))));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${cab}" topLeftCell="A${cab + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      + `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${filas.join('')}</sheetData>`
      + (t.filas.length ? `<autoFilter ref="A${cab}:${col(t.columnas.length - 1)}${cab + t.filas.length}"/>` : '') + `</worksheet>`;
  }
  function xlsx(tablas) {
    const nombres = tablas.map((t, i) => (t.hoja || t.titulo).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Hoja${i + 1}`);
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tablas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
    const wbr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tablas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${tablas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const st = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>`
      + `<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>`
      + `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E3B0"/><bgColor indexed="64"/></patternFill></fill></fills>`
      + `<borders count="2"><border/><border><bottom style="thin"><color rgb="FF999999"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>`
      + `<cellXfs count="6"><xf/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf fontId="2" applyFont="1"/><xf numFmtId="164" fontId="1" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    return zip([{ nombre: '[Content_Types].xml', datos: ct }, { nombre: '_rels/.rels', datos: rels }, { nombre: 'xl/workbook.xml', datos: wb }, { nombre: 'xl/_rels/workbook.xml.rels', datos: wbr },
      { nombre: 'xl/styles.xml', datos: st }, ...tablas.map((t, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: hoja(t) }))]);
  }

  // ---------- Listados ----------
  const por = (l, i) => l.find((x) => x.id === i) || {};
  const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  const enRango = (f, F) => (!F.desde || (f && f >= F.desde)) && (!F.hasta || (f && f <= F.hasta));
  const ctDe = (s, id) => por(s.contratos, id);
  const filtraCt = (s, ct, F) => (!F.inmuebleId || ct.inmuebleId === F.inmuebleId) && (!F.inquilinoId || ct.inquilinoId === F.inquilinoId);
  const sum = (filas, i) => filas.reduce((t, f) => t + (f[i] || 0), 0);
  const C = (t, tipo) => ({ t: T(t), tipo: tipo || 'texto' });
  const mes = (p) => T(MA.fmes(p));
  const est = (e) => T({ pendiente: 'Pendiente', parcial: 'A medias', atrasado: 'Atrasado', pagado: 'Cobrado', anulado: 'Anulado', previsto: 'Previsto', vencido: 'Sin pagar', por_confirmar: 'Por confirmar', vigente: 'Vigente', futuro: 'Empieza pronto', por_vencer: 'Vence pronto', finalizado: 'Finalizado', rescindido: 'Rescindido' }[e] || e);

  const LISTADOS = {
    inmuebles: { titulo: 'Inmuebles', icono: 'casa', crear(s, F, hoy) {
      const k = MA.panel(s, hoy).inmuebles, filas = s.inmuebles.filter((p) => !F.inmuebleId || p.id === F.inmuebleId).map((p) => {
        const ct = s.contratos.find((c) => c.inmuebleId === p.id && c.estado === 'activo' && c.inicio <= hoy && (!c.fin || c.fin >= hoy)), x = k.find((y) => y.id === p.id) || {};
        return [p.nombre, T(p.tipo), p.direccion, p.referencia, ct ? por(s.inquilinos, ct.inquilinoId).nombre : T(p.archivado ? 'Archivado' : 'Libre'), ct ? MA.rentaActual(ct, hoy) : null, p.compraPrecio, p.valor, p.valorCatastral, x.ingresos, x.neto]; });
      return { columnas: [C('Inmueble'), C('Tipo'), C('Dirección'), C('Referencia catastral'), C('Inquilino'), C('Renta', 'euros'), C('Precio de compra', 'euros'), C('Valor', 'euros'), C('Valor catastral', 'euros'), C('Cobrado 12 meses', 'euros'), C('Neto 12 meses', 'euros')], filas, totales: [null, null, null, null, null, sum(filas, 5), sum(filas, 6), sum(filas, 7), sum(filas, 8), sum(filas, 9), sum(filas, 10)] }; } },
    inquilinos: { titulo: 'Inquilinos', icono: 'persona', crear(s, F) {
      const filas = s.inquilinos.filter((q) => !F.inquilinoId || q.id === F.inquilinoId).map((q) => [q.nombre, q.dni, q.telefono, q.email, q.domicilio,
        s.contratos.filter((c) => c.inquilinoId === q.id && c.estado === 'activo').map((c) => por(s.inmuebles, c.inmuebleId).nombre).join(', '), q.notas]);
      return { columnas: [C('Nombre'), C('DNI/NIE'), C('Teléfono'), C('Correo'), C('Domicilio'), C('Contratos activos'), C('Notas')], filas }; } },
    contratos: { titulo: 'Contratos', icono: 'doc', crear(s, F, hoy) {
      const filas = s.contratos.filter((c) => filtraCt(s, c, F)).map((c) => [por(s.inmuebles, c.inmuebleId).nombre, por(s.inquilinos, c.inquilinoId).nombre, c.inicio, MA.finEfectivo(c), est(MA.situacionContrato(c, hoy)),
        MA.rentaActual(c, hoy), c.diaCobro, c.fianza, MA.saldoFianza(s, c.id), c.deposito && c.deposito.fecha ? fmt(c.deposito.fecha) + (c.deposito.referencia ? ' · ' + c.deposito.referencia : '') : '', T(MA.INDICES[c.actualizacion] || '')]);
      return { columnas: [C('Inmueble'), C('Inquilino'), C('Inicio', 'fecha'), C('Fin', 'fecha'), C('Estado'), C('Renta actual', 'euros'), C('Día de cobro', 'num'), C('Fianza acordada', 'euros'), C('Fianza en tu poder', 'euros'), C('Depósito'), C('Actualización')], filas }; } },
    recibos: { titulo: 'Recibos de alquiler', icono: 'euro', fechas: true, crear(s, F, hoy) {
      const filas = MA.cargos(s, hoy, (c) => filtraCt(s, ctDe(s, c.contratoId), F) && enRango(c.vence, F) && (!F.estado || F.estado === 'todos' || (F.estado === 'pendientes' ? !['pagado', 'anulado'].includes(MA.estadoCargo(s, c, hoy)) : MA.estadoCargo(s, c, hoy) === F.estado)))
        .map((c) => [mes(c.periodo), c.inmueble, c.inquilino, c.vence, c.importe, c.pagado, c.estado === 'anulado' ? 0 : c.pendiente, c.fechaPago, est(c.estado), c.recibo || '']);
      return { columnas: [C('Mes'), C('Inmueble'), C('Inquilino'), C('Vencimiento', 'fecha'), C('Importe', 'euros'), C('Cobrado', 'euros'), C('Pendiente', 'euros'), C('Último cobro', 'fecha'), C('Estado'), C('Nº de recibo')], filas, totales: [null, null, null, null, sum(filas, 4), sum(filas, 5), sum(filas, 6)] }; } },
    cobros: { titulo: 'Cobros recibidos', icono: 'euro', fechas: true, crear(s, F, hoy) {
      const cg = new Map(MA.cargos(s, hoy).map((c) => [c.id, c]));
      const filas = s.pagos.filter((p) => { const c = cg.get(p.cargoId); return c && filtraCt(s, ctDe(s, c.contratoId), F) && enRango(p.fecha, F); }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
        .map((p) => { const c = cg.get(p.cargoId); return [p.fecha, c.inmueble, c.inquilino, mes(c.periodo), p.anulado ? 0 : p.importe, p.metodo, T(p.origen === 'estimado' ? 'Estimado' : 'Real'), p.anulado ? `${T('Anulado')} ${fmt(p.anulado.fecha)}: ${p.anulado.motivo}` : '', p.notas]; });
      return { columnas: [C('Fecha', 'fecha'), C('Inmueble'), C('Inquilino'), C('Mes del alquiler'), C('Importe', 'euros'), C('Método'), C('Origen'), C('Anulación'), C('Notas')], filas, totales: [null, null, null, null, sum(filas, 4)] }; } },
    deudas: { titulo: 'Deudas por inquilino', icono: 'alerta', crear(s, F, hoy) {
      const m = new Map();
      for (const c of MA.cargos(s, hoy, (x) => filtraCt(s, ctDe(s, x.contratoId), F)).filter((x) => x.estado === 'atrasado' || (x.estado === 'parcial' && x.vence < hoy))) {
        const k = c.contratoId, e = m.get(k) || { c, n: 0, deuda: 0, desde: c.vence, meses: [] }; e.n++; e.deuda += c.pendiente; if (c.vence < e.desde) e.desde = c.vence; e.meses.push(c.periodo); m.set(k, e); }
      const g = new Map(); for (const x of MA.gastos(s, hoy, (y) => y.porCobrar > 0 || y.repercutir > 0)) if (x.porCobrar > 0 && x.contratoId && filtraCt(s, ctDe(s, x.contratoId), F)) g.set(x.contratoId, (g.get(x.contratoId) || 0) + x.porCobrar);
      const ids = new Set([...m.keys(), ...g.keys()]);
      const filas = [...ids].map((k) => { const e = m.get(k), ct = ctDe(s, k), q = por(s.inquilinos, ct.inquilinoId);
        return [q.nombre, q.telefono, por(s.inmuebles, ct.inmuebleId).nombre, e ? e.n : 0, e ? e.meses.join(', ') : '', e ? e.deuda : 0, g.get(k) || 0, (e ? e.deuda : 0) + (g.get(k) || 0), e ? e.desde : null, e ? MA.diasEntre(e.desde, hoy) : null]; })
        .sort((a, b) => b[7] - a[7]);
      return { columnas: [C('Inquilino'), C('Teléfono'), C('Inmueble'), C('Recibos atrasados', 'num'), C('Meses'), C('Rentas', 'euros'), C('Gastos por cobrar', 'euros'), C('Total', 'euros'), C('Desde', 'fecha'), C('Días', 'num')], filas, totales: [null, null, null, sum(filas, 3), null, sum(filas, 5), sum(filas, 6), sum(filas, 7)] }; } },
    gastos: { titulo: 'Gastos', icono: 'gasto', fechas: true, crear(s, F, hoy) {
      const filas = MA.gastos(s, hoy, (g) => (!F.inmuebleId || g.inmuebleId === F.inmuebleId) && enRango(g.fecha, F) && (!F.inquilinoId || (g.contratoId && ctDe(s, g.contratoId).inquilinoId === F.inquilinoId))).reverse()
        .map((g) => [g.fecha, g.inmueble, g.concepto, T(MA.CATEGORIAS[g.categoria]), g.periodo, g.anulado ? 0 : g.importe, est(g.estado) + (g.estimado ? ' (' + T('estimado') + ')' : ''), g.pagado ? g.pagado.fecha : null, g.repercutir, g.cobrado, g.inquilino, g.notas]);
      return { columnas: [C('Fecha', 'fecha'), C('Inmueble'), C('Concepto'), C('Categoría'), C('Periodo'), C('Importe', 'euros'), C('Estado'), C('Pagado el', 'fecha'), C('A cobrar al inquilino', 'euros'), C('Cobrado al inquilino', 'euros'), C('Inquilino'), C('Notas')], filas, totales: [null, null, null, null, null, sum(filas, 5), null, null, sum(filas, 8), sum(filas, 9)] }; } },
    fianzas: { titulo: 'Fianzas', icono: 'llave', crear(s, F) {
      const filas = s.fianzas.filter((f) => filtraCt(s, ctDe(s, f.contratoId), F)).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((f) => { const ct = ctDe(s, f.contratoId);
        return [f.fecha, por(s.inmuebles, ct.inmuebleId).nombre, por(s.inquilinos, ct.inquilinoId).nombre, T({ recibida: 'Recibida', devuelta: 'Devuelta', retenida: 'Retenida' }[f.tipo]), f.anulado ? 0 : (f.tipo === 'recibida' ? f.importe : -f.importe), f.notas, f.anulado ? T('Anulado') : '']; });
      const dep = s.contratos.filter((c) => filtraCt(s, c, F) && c.deposito && c.deposito.fecha).map((c) => [c.deposito.fecha, por(s.inmuebles, c.inmuebleId).nombre, por(s.inquilinos, c.inquilinoId).nombre, T('Depositada en') + ' ' + c.deposito.organismo, null, c.deposito.referencia, c.deposito.recuperado ? T('Recuperada') + ' ' + fmt(c.deposito.recuperado) : '']);
      const todas = [...filas, ...dep].sort((a, b) => a[0].localeCompare(b[0]));
      return { columnas: [C('Fecha', 'fecha'), C('Inmueble'), C('Inquilino'), C('Movimiento'), C('Importe', 'euros'), C('Notas o referencia'), C('Situación')], filas: todas, totales: [null, null, null, null, sum(filas, 4)] }; } },
    hipotecas: { titulo: 'Cuadro de hipoteca', icono: 'banco', crear(s, F, hoy) {
      const filas = [];
      for (const p of s.inmuebles.filter((x) => x.hipoteca && (!F.inmuebleId || x.id === F.inmuebleId)))
        for (const c of MA.cuadroHipoteca(p.hipoteca)) if (enRango(c.fecha, F)) filas.push([p.nombre, c.fecha, c.cuota, c.interes, c.capital, c.saldo, T(c.fecha <= hoy ? 'Pagada' : 'Pendiente')]);
      return { columnas: [C('Inmueble'), C('Fecha', 'fecha'), C('Cuota', 'euros'), C('Intereses', 'euros'), C('Capital', 'euros'), C('Pendiente', 'euros'), C('Estado')], filas, totales: [null, null, sum(filas, 2), sum(filas, 3), sum(filas, 4)] }; } },
    rentabilidad: { titulo: 'Rentabilidad por inmueble', icono: 'grafico', crear(s, F, hoy) {
      const filas = MA.panel(s, hoy).inmuebles.filter((x) => !F.inmuebleId || x.id === F.inmuebleId).map((x) => [x.nombre, T(x.tipo), x.ocupado ? T('Sí') : T('No'), x.renta, x.ingresos, x.gastos, x.cuotas, x.neto, x.base, x.bruta, x.neta, x.hipotecaPendiente]);
      return { subtitulo: T('Últimos 12 meses'), columnas: [C('Inmueble'), C('Tipo'), C('Alquilado'), C('Renta mensual', 'euros'), C('Cobrado', 'euros'), C('Gastos', 'euros'), C('Cuotas de hipoteca', 'euros'), C('Neto', 'euros'), C('Inversión', 'euros'), C('Rentabilidad bruta %', 'num'), C('Rentabilidad neta %', 'num'), C('Hipoteca pendiente', 'euros')], filas,
        totales: [null, null, null, sum(filas, 3), sum(filas, 4), sum(filas, 5), sum(filas, 6), sum(filas, 7), sum(filas, 8), null, null, sum(filas, 11)] }; } },
    historial: { titulo: 'Historial de cambios', icono: 'reloj', fechas: true, crear(s, F) {
      const filas = s.registro.filter((r) => enRango(r.fecha, F)).slice().reverse().map((r) => [r.fecha, T(r.que.replace(/_/g, ' ')), r.ref, r.detalle && r.detalle.importe != null ? r.detalle.importe : null, r.detalle && r.detalle.motivo ? r.detalle.motivo : '']);
      return { columnas: [C('Fecha', 'fecha'), C('Cambio'), C('Referencia', 'num'), C('Importe', 'euros'), C('Detalle')], filas }; } },
  };
  function crear(s, clave, F, hoy) {
    const L = LISTADOS[clave], t = L.crear(s, F || {}, hoy);
    const partes = [];
    if (F && F.inmuebleId) partes.push(por(s.inmuebles, F.inmuebleId).nombre);
    if (F && F.inquilinoId) partes.push(por(s.inquilinos, F.inquilinoId).nombre);
    if (F && (F.desde || F.hasta)) partes.push(`${F.desde ? fmt(F.desde) : '…'} – ${F.hasta ? fmt(F.hasta) : '…'}`);
    return { clave, titulo: T(L.titulo), hoja: T(L.titulo), subtitulo: [t.subtitulo, ...partes].filter(Boolean).join(' · ') || null, ...t };
  }
  // Todo en un solo Excel, una hoja por listado
  const libroCompleto = (s, hoy) => xlsx(Object.keys(LISTADOS).map((k) => crear(s, k, {}, hoy)));

  // Extracto de un inquilino: lo cobrado y lo pendiente, mes a mes
  function extractoInquilino(s, inquilinoId, F, hoy) {
    const q = por(s.inquilinos, inquilinoId), cts = s.contratos.filter((c) => c.inquilinoId === inquilinoId && (!F.inmuebleId || c.inmuebleId === F.inmuebleId));
    const lineas = [];
    for (const ct of cts) for (const c of MA.cargos(s, hoy, (x) => x.contratoId === ct.id && enRango(x.vence, F)).filter((x) => x.estado !== 'anulado'))
      lineas.push({ fecha: c.vence, concepto: `${T('Alquiler')} ${MA.fmes(c.periodo)} · ${c.inmueble}`, cargo: c.importe, abono: c.pagado, pendiente: c.pendiente });
    for (const g of MA.gastos(s, hoy, (x) => x.repercutir > 0 && !x.anulado && cts.some((c) => c.id === x.contratoId) && enRango(x.fecha, F)))
      lineas.push({ fecha: g.fecha, concepto: `${g.concepto} (${g.periodo}) · ${g.inmueble}`, cargo: g.repercutir, abono: g.cobrado, pendiente: g.porCobrar });
    lineas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return { inquilino: q, contratos: cts, lineas, total: lineas.reduce((t, l) => t + l.cargo, 0), pagado: lineas.reduce((t, l) => t + l.abono, 0), pendiente: lineas.reduce((t, l) => t + l.pendiente, 0), F, hoy };
  }

  return { zip, crc32, xlsx, LISTADOS, crear, libroCompleto, extractoInquilino };
});
