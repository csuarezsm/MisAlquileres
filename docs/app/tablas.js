/* Mis alquileres — lectura de hojas de cálculo (CSV y Excel .xlsx) y de extractos bancarios, sin librerías. © 2026 IT Canarias. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.Tablas = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------- CSV ----------
  function leerCSV(txt) {
    txt = String(txt).replace(/^﻿/, '');
    const muestra = txt.split(/\r?\n/).slice(0, 20).join('\n'), cuenta = (c) => (muestra.match(new RegExp(c === '\t' ? '\\t' : '\\' + c, 'g')) || []).length;
    const sep = [';', '\t', ','].sort((a, b) => cuenta(b) - cuenta(a))[0];
    const filas = []; let fila = [], campo = '', comillas = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (comillas) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c; }
      else if (c === '"') comillas = true;
      else if (c === sep) { fila.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
      else campo += c;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    return filas.filter((f) => f.some((x) => String(x).trim() !== ''));
  }

  // ---------- XLSX (zip + XML) ----------
  async function inflar(bytes) {
    const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
    w.write(bytes); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function unzip(buf) {
    const b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength), out = {};
    let fin = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    if (fin < 0) throw Object.assign(new Error('El archivo no es un Excel válido'), { code: 'FORMATO' });
    const n = v.getUint16(fin + 10, true); let p = v.getUint32(fin + 16, true);
    const dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      const metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), le = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), loc = v.getUint32(p + 42, true);
      const nombre = dec.decode(b.subarray(p + 46, p + 46 + ln));
      const ini = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true), datos = b.subarray(ini, ini + comp);
      out[nombre] = metodo === 0 ? datos : metodo === 8 ? datos : null; out[nombre + ':m'] = metodo;
      p += 46 + ln + le + lc;
    }
    return { async bytes(nombre) { const d = out[nombre]; if (!d) return null; return out[nombre + ':m'] === 8 ? inflar(d) : d.slice(); }, async texto(nombre) { const d = out[nombre]; if (!d) return null; return dec.decode(out[nombre + ':m'] === 8 ? await inflar(d) : d); }, nombres: Object.keys(out).filter((x) => !x.endsWith(':m')) };
  }
  const ent = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
  const colN = (r) => { let n = 0; for (const ch of r.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  async function leerXLSX(buf) {
    const z = await unzip(buf);
    const ss = [], tss = await z.texto('xl/sharedStrings.xml');
    if (tss) for (const si of tss.match(/<si>[\s\S]*?<\/si>/g) || []) ss.push(ent((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
    const hoja = z.nombres.filter((x) => /^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
    if (!hoja) throw new Error('El Excel no tiene hojas');
    const xml = await z.texto(hoja), filas = [];
    for (const f of xml.match(/<row[^>]*>[\s\S]*?<\/row>|<row[^>]*\/>/g) || []) {
      const fila = [];
      for (const c of f.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
        const r = (c.match(/ r="([A-Z]+\d+)"/) || [])[1], t = (c.match(/ t="(\w+)"/) || [])[1], vv = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let val = '';
        if (t === 's') val = ss[+vv] || '';
        else if (t === 'inlineStr') val = ent(((c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1]) || '');
        else if (t === 'str' || t === 'e') val = ent(vv || '');
        else if (t === 'b') val = vv === '1';
        else if (vv != null) val = Number(vv);
        fila[r ? colN(r) : fila.length] = val;
      }
      for (let i = 0; i < fila.length; i++) if (fila[i] === undefined) fila[i] = '';
      filas.push(fila);
    }
    return filas.filter((f) => f.some((x) => String(x).trim() !== ''));
  }
  // Lee un archivo elegido por el usuario (CSV o XLSX) y devuelve filas
  async function leerArchivo(nombre, buf) {
    const b = new Uint8Array(buf);
    if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11) throw Object.assign(new Error('Es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx o CSV, o descárgalo del banco en ese formato.'), { code: 'FORMATO' });
    if (b[0] === 0x50 && b[1] === 0x4b) return leerXLSX(buf);
    let txt = new TextDecoder('utf-8').decode(b);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(b);
    return leerCSV(txt);
  }

  // ---------- Extracto bancario ----------
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  function importe(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
    let t = String(v || '').replace(/[\s€]|eur/gi, '');
    if (!t) return null;
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (/-$/.test(t)) { neg = true; t = t.slice(0, -1); }
    if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (t.includes(',')) t = t.replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = Number(t);
    return Number.isFinite(n) ? Math.round((neg ? -n : n) * 100) : null;
  }
  function fecha(v) {
    if (typeof v === 'string' && /^\d{5}(\.\d+)?$/.test(v.trim())) v = Number(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
    const t = String(v || '').trim(); let m;
    if ((m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }
  // Busca la fila de cabecera y las columnas de fecha, concepto e importe (o cargo/abono)
  function extracto(filas) {
    let cab = -1, col = {};
    for (let i = 0; i < Math.min(filas.length, 40) && cab < 0; i++) {
      const h = filas[i].map(norm), c = {};
      h.forEach((x, j) => {
        if (c.fecha == null && /^f(echa)?\.?\s*(de\s*)?(operacion|oper\.?|operativa|contable|movimiento|mov\.?)?$|^fecha/.test(x) && !/valor/.test(x)) c.fecha = j;
        if (c.fechaValor == null && /valor/.test(x) && /fecha/.test(x)) c.fechaValor = j;
        if (/concepto|descripcion|movimiento|detalle|observaciones|beneficiario|ordenante|remitente|mas datos|referencia/.test(x) && !/fecha/.test(x)) (c.concepto = c.concepto || []).push(j);
        if (c.importe == null && /^importe|^cantidad|^importe \(?eur|^monto/.test(x)) c.importe = j;
        if (c.cargo == null && /^(cargo|cargos|debe|gastos|salida)/.test(x)) c.cargo = j;
        if (c.abono == null && /^(abono|abonos|haber|ingresos|entrada)/.test(x)) c.abono = j;
      });
      if (c.fecha == null) c.fecha = c.fechaValor;
      if (c.fecha != null && (c.importe != null || c.cargo != null || c.abono != null)) { cab = i; col = c; }
    }
    if (cab < 0) throw Object.assign(new Error('No encuentro las columnas de fecha e importe del extracto. Descárgalo del banco en Excel o CSV con su cabecera.'), { code: 'FORMATO' });
    const movs = [];
    for (const f of filas.slice(cab + 1)) {
      const fe = fecha(f[col.fecha]); if (!fe) continue;
      let imp = col.importe != null ? importe(f[col.importe]) : null;
      if (imp == null) { const ca = col.cargo != null ? importe(f[col.cargo]) : null, ab = col.abono != null ? importe(f[col.abono]) : null; imp = ab ? Math.abs(ab) : ca ? -Math.abs(ca) : null; }
      if (!imp) continue;
      const concepto = (col.concepto || []).map((j) => String(f[j] == null ? '' : f[j]).trim()).filter(Boolean).join(' · ');
      movs.push({ fecha: fe, importe: imp, concepto });
    }
    if (!movs.length) throw Object.assign(new Error('El extracto no tiene movimientos que se puedan leer.'), { code: 'FORMATO' });
    return movs;
  }

  // ---------- Norma 43 (Cuaderno 43 de la AEB): el formato que exportan todos los bancos españoles ----------
  // Registro 22 = movimiento (fecha operación AAMMDD en 11-16, clave 1 cargo / 2 abono en 28, importe en céntimos en 29-42);
  // registros 23 = conceptos complementarios del movimiento anterior.
  function esNorma43(txt) { const l = txt.split(/\r?\n/).filter((x) => x.trim()); return l.length > 1 && /^11\d{18}/.test(l[0]) && l.some((x) => /^22/.test(x)); }
  function norma43(txt) {
    const movs = []; let ult = null;
    for (const linea of txt.split(/\r?\n/)) {
      if (/^22/.test(linea) && linea.length >= 42) {
        const f = linea.slice(10, 16), imp = Number(linea.slice(28, 42)), signo = linea[27] === '1' ? -1 : 1;
        if (!/^\d{6}$/.test(f) || !Number.isFinite(imp) || !imp) { ult = null; continue; }
        const ref = [linea.slice(42, 52), linea.slice(52, 64), linea.slice(64, 80)].map((x) => x.trim()).filter((x) => x && !/^0+$/.test(x));
        ult = { fecha: `20${f.slice(0, 2)}-${f.slice(2, 4)}-${f.slice(4, 6)}`, importe: signo * imp, concepto: ref.join(' · ') }; movs.push(ult);
      } else if (/^23/.test(linea) && ult) {
        const c = [linea.slice(4, 42), linea.slice(42, 80)].map((x) => x.trim()).filter(Boolean).join(' ');
        if (c) ult.concepto = ult.concepto ? `${c} · ${ult.concepto}` : c;
      } else if (!/^23/.test(linea)) ult = null;
    }
    if (!movs.length) throw Object.assign(new Error('El extracto no tiene movimientos que se puedan leer.'), { code: 'FORMATO' });
    return movs;
  }
  async function leerExtracto(nombre, buf) {
    const b = new Uint8Array(buf);
    if (!(b[0] === 0x50 && b[1] === 0x4b) && !(b[0] === 0xd0 && b[1] === 0xcf)) {
      let txt = new TextDecoder('utf-8').decode(b); if (txt.includes('\ufffd')) txt = new TextDecoder('windows-1252').decode(b);
      if (esNorma43(txt)) return norma43(txt);
    }
    return extracto(await leerArchivo(nombre, buf));
  }

  return { leerCSV, leerXLSX, leerArchivo, extracto, leerExtracto, norma43, importe, fecha, unzip };
});
