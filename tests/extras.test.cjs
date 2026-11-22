'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const MA = require('../www/extras.js');
const Tablas = require('../www/tablas.js');
const PDF = require('../www/pdf.js');
const HOY = '2026-11-16';
const falla = (fn, code) => assert.throws(fn, (e) => e.code === code, 'se esperaba ' + code);
function base(tipo = 'Vivienda') {
  const s = MA.nuevo(); s.pro = true;
  const p = MA.crearInmueble(s, { nombre: 'Piso Real', tipo }, HOY);
  const q = MA.crearInquilino(s, { nombre: 'Ana Pérez Gil', telefono: '600111222', dni: '12345678Z' });
  return { s, p, q };
}

test('importes en letras', () => {
  assert.equal(MA.eurosLetras(65000), 'seiscientos cincuenta euros');
  assert.equal(MA.eurosLetras(100), 'un euro'); assert.equal(MA.eurosLetras(2105), 'veintiún euros con cinco céntimos');
  assert.equal(MA.eurosLetras(150000000), 'un millón quinientos mil euros');
});
test('recibo: numeración correlativa por año y datos completos', () => {
  const { s, p, q } = base(); MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-09-01', importe: 65000 }, HOY);
  falla(() => MA.datosRecibo(s, s.cargos[0].id, HOY), 'SIN_PAGOS');
  MA.registrarPago(s, { cargoId: s.cargos[0].id, importe: 40000, fecha: '2026-09-03', metodo: 'Bizum' }, HOY);
  const r = MA.datosRecibo(s, s.cargos[0].id, HOY);
  assert.equal(r.numero, '2026-0001'); assert.equal(r.pendiente, 25000); assert.equal(r.completo, false); assert.equal(r.letras, 'cuatrocientos euros');
  assert.equal(MA.datosRecibo(s, s.cargos[0].id, HOY).numero, '2026-0001', 'el número no cambia');
  MA.registrarPago(s, { cargoId: s.cargos[1].id, importe: 65000 }, HOY);
  assert.equal(MA.datosRecibo(s, s.cargos[1].id, HOY).numero, '2026-0002');
  const pdf = Buffer.from(PDF.recibo(r)).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF')); assert.match(pdf, /Recibo de alquiler/); assert.match(pdf, /P\\351rez/);
});
test('PDF: estructura válida (xref apunta a cada objeto)', () => {
  const d = PDF.Documento(); for (let i = 0; i < 80; i++) d.parrafo('Línea de prueba con acentos áéíóú ñ y € número ' + i); const b = Buffer.from(d.bytes()).toString('latin1');
  const xs = +b.match(/startxref\n(\d+)/)[1]; assert.ok(b.slice(xs).startsWith('xref'));
  const offs = [...b.slice(xs).matchAll(/(\d{10}) 00000 n/g)].map((m) => +m[1]);
  offs.forEach((o, i) => assert.ok(b.slice(o).startsWith(`${i + 1} 0 obj`), 'objeto ' + (i + 1)));
  assert.match(b, /\/Count 2/);
});
test('actualización anual: IRAV por defecto en vivienda posterior a la ley, IPC antes', () => {
  const { s, p, q } = base();
  const a = MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2024-12-01', importe: 70000 }, HOY);
  assert.equal(a.actualizacion, 'irav'); assert.equal(a.uso, 'vivienda');
  const u = MA.actualizacionPendiente(s, a, HOY); assert.equal(u.fecha, '2026-12-01'); assert.equal(u.mes, '2026-12'); assert.equal(u.dias, 15);
  const r = MA.aplicarActualizacion(s, a.id, { pct: '2,4', fecha: u.fecha }, HOY);
  assert.equal(r.ahora, 71680); assert.equal(MA.actualizacionPendiente(s, a, HOY), null);
  const g = MA.crearInmueble(s, { nombre: 'Plaza', tipo: 'Plaza de garaje' }, HOY);
  const b = MA.crearContrato(s, { inmuebleId: g.id, inquilinoId: q.id, inicio: '2022-12-10', importe: 6000 }, HOY);
  assert.equal(b.actualizacion, 'ipc'); assert.equal(b.uso, 'otro');
  const ub = MA.actualizacionPendiente(s, b, HOY); assert.equal(ub.fecha, '2026-12-10');
  MA.omitirActualizacion(s, b.id, ub.fecha, HOY); assert.equal(MA.actualizacionPendiente(s, b, HOY), null);
  MA.editarContrato(s, b.id, { actualizacion: 'ninguna' }, HOY); assert.equal(b.actualizacion, 'ninguna');
});
test('fianza: avisos de depósito, devolución y recuperación', () => {
  const { s, p, q } = base(); s.ajustes.ccaa = 'canarias'; const ct = MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-11-01', importe: 65000, fianza: 65000 }, HOY);
  assert.equal(MA.avisosFianza(s, HOY).length, 0, 'sin fianza recibida no hay aviso');
  MA.registrarFianza(s, { contratoId: ct.id, tipo: 'recibida', importe: 65000 }, HOY);
  let a = MA.avisosFianza(s, HOY); assert.equal(a[0].tipo, 'fianza_deposito'); assert.equal(a[0].fecha, '2026-12-01');
  MA.registrarDeposito(s, ct.id, { fecha: '2026-11-10', referencia: 'ICV-1' }, HOY); assert.equal(MA.avisosFianza(s, HOY).length, 0);
  assert.equal(ct.deposito.organismo, 'Instituto Canario de la Vivienda');
  MA.finalizarContrato(s, ct.id, { fecha: '2026-11-15', estado: 'finalizado', llaves: '2026-11-16' }, HOY);
  a = MA.avisosFianza(s, HOY).map((x) => x.tipo + ':' + (x.fecha || '')); assert.deepEqual(a.sort(), ['fianza_devolver:2026-12-16', 'fianza_recuperar:2026-11-15']);
  MA.recuperarDeposito(s, ct.id, HOY, HOY); MA.registrarFianza(s, { contratoId: ct.id, tipo: 'devuelta', importe: 65000 }, HOY);
  assert.equal(MA.avisosFianza(s, HOY).length, 0);
});
test('avisos en escalera y acción desde la notificación', () => {
  const { s, p, q } = base(); const ct = MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-10-05', importe: 65000, diaCobro: 5 }, HOY);
  const av = MA.avisosApp(s, HOY).filter((x) => x.tipo === 'cobro_atrasado');
  assert.deepEqual(av.map((x) => x.escalon), [2, 2]);
  const n = MA.proximosAvisos(s, '2026-11-30', 40);
  const dic = n.filter((x) => x.datos && x.datos.periodo === '2026-12');
  assert.deepEqual(dic.map((x) => x.fecha), ['2026-12-05', '2026-12-08', '2026-12-15']); assert.deepEqual(dic.map((x) => x.accion), ['COBRO', 'ATRASO', 'ATRASO']);
  assert.equal(new Set(n.map((x) => x.id)).size, n.length, 'ids únicos');
  const r1 = MA.cobroDesdeAviso(s, { contratoId: ct.id, periodo: '2026-11' }, HOY), r2 = MA.cobroDesdeAviso(s, { contratoId: ct.id, periodo: '2026-11' }, HOY);
  assert.equal(r1.importe, 65000); assert.equal(r2.repetido, true); assert.equal(s.pagos.length, 1);
  assert.ok(!MA.avisosApp(s, HOY).some((x) => x.tipo === 'copia'), 'el primer día no se pide copia'); s.registro[0].fecha = '2026-11-01';
  assert.ok(MA.avisosApp(s, HOY).some((x) => x.tipo === 'copia'));
  s.ajustes.ultimaCopia = HOY; assert.ok(!MA.avisosApp(s, HOY).some((x) => x.tipo === 'copia'));
});
test('extracto: CSV de banco español, cruce con recibos y gastos, sin duplicar', () => {
  const { s, p, q } = base(); MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-10-01', importe: 65000 }, HOY);
  const q2 = MA.crearInquilino(s, { nombre: 'Luis Gómez' }); const p2 = MA.crearInmueble(s, { nombre: 'Plaza 3', tipo: 'Plaza de garaje' }, HOY);
  MA.crearContrato(s, { inmuebleId: p2.id, inquilinoId: q2.id, inicio: '2026-11-01', importe: 6000, diaCobro: 10 }, HOY);
  MA.crearConcepto(s, { inmuebleId: p.id, concepto: 'Comunidad', categoria: 'comunidad', periodicidad: 'mensual', importe: 4550, dia: 5, domiciliado: true }, HOY);
  const csv = 'Movimientos de la cuenta ES00 0000\r\n\r\nFecha;Fecha valor;Concepto;Importe;Saldo\r\n02/10/2026;02/10/2026;TRANSFERENCIA DE ANA PEREZ GIL ALQUILER;650,00;1.000,00\r\n'
    + '03/11/2026;03/11/2026;BIZUM DE PEREZ GIL ANA;650,00;1.650,00\r\n05/11/2026;05/11/2026;RECIBO COMUNIDAD PROP EDIF REAL;-45,50;1.604,50\r\n11/11/2026;11/11/2026;Transferencia L GOMEZ;60;1.664,50\r\n12/11/2026;12/11/2026;Compra supermercado;-23,10;1.641,40\r\n';
  const movs = Tablas.extracto(Tablas.leerCSV(csv));
  assert.equal(movs.length, 5); assert.deepEqual(movs[2], { fecha: '2026-11-05', importe: -4550, concepto: 'RECIBO COMUNIDAD PROP EDIF REAL' });
  const pr = MA.conciliar(s, movs, HOY);
  assert.deepEqual(pr.map((x) => x.tipo), ['cobro', 'cobro', 'gasto', 'cobro', 'nada']);
  assert.equal(pr[0].confianza, 'alta'); assert.notEqual(pr[0].cargoId, pr[1].cargoId);
  const r = MA.aplicarConciliacion(s, pr, HOY); assert.deepEqual([r.cobros, r.gastos, r.errores.length], [3, 1, 0]);
  assert.equal(s.cargos.filter((c) => MA.estadoCargo(s, c, HOY) === 'pagado').length, 3);
  assert.ok(s.gastos.find((g) => g.concepto === 'Comunidad' && g.clave === '2026-11').pagado);
  const otra = MA.conciliar(s, movs, HOY); assert.deepEqual(otra.map((x) => x.tipo), ['ya', 'ya', 'ya', 'ya', 'nada']);
});
test('extracto: columnas de cargo y abono, formatos de importe y fecha', () => {
  const f = [['F. Operación', 'Descripción', 'Cargo', 'Abono'], ['2026-11-03', 'Alquiler', '', '1.234,56'], ['46330', 'IBI', '120,10', '']];
  const m = Tablas.extracto(f); assert.deepEqual(m.map((x) => x.importe), [123456, -12010]); assert.equal(m[1].fecha, '2026-11-04');
  assert.equal(Tablas.importe('-1,234.50'), -123450); assert.equal(Tablas.importe('650,00 €'), 65000); assert.equal(Tablas.importe('45.50-'), -4550);
  assert.throws(() => Tablas.extracto([['a', 'b'], ['1', '2']]), /columnas/);
});
test('XLSX: lee un Excel creado a mano', async () => {
  const zlib = require('node:zlib');
  const files = { '[Content_Types].xml': '<Types/>', 'xl/sharedStrings.xml': '<sst><si><t>Fecha</t></si><si><t>Concepto</t></si><si><t>Importe</t></si><si><t>BIZUM ANA &amp; CIA</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>46329</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>650</v></c></row></sheetData></worksheet>' };
  const parts = [], central = []; let off = 0;
  for (const [n, txt] of Object.entries(files)) {
    const raw = Buffer.from(txt), comp = zlib.deflateRawSync(raw), name = Buffer.from(n);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(8, 8); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26);
    parts.push(h, name, comp);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, name); off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(3, 8); e.writeUInt16LE(3, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  const buf = Buffer.concat([...parts, cd, e]);
  const filas = await Tablas.leerArchivo('x.xlsx', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  assert.deepEqual(filas[1], [46329, 'BIZUM ANA & CIA', 650]);
  assert.deepEqual(Tablas.extracto(filas)[0], { fecha: '2026-11-03', importe: 65000, concepto: 'BIZUM ANA & CIA' });
  await assert.rejects(Tablas.leerArchivo('x.xls', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer), /antiguo/);
});
test('alta rápida e importación de cartera (con límite gratuito)', () => {
  const s = MA.nuevo();
  const r = MA.altaRapida(s, { inmueble: 'Plaza 7', tipo: 'Plaza de garaje', inquilino: 'Eva', telefono: '611', inicio: '2026-11-01', importe: 6000 }, HOY);
  assert.equal(s.cargos.length, 1); assert.equal(r.contrato.importe, undefined);
  assert.throws(() => MA.altaRapida(s, { inmueble: 'Otra', inquilino: 'X', inicio: '2026-11-01', importe: 100 }, HOY), (e) => e.code === 'LIMITE');
  assert.equal(s.inquilinos.length, 1, 'la alta fallida no deja nada a medias');
  const s2 = MA.nuevo(); s2.pro = true;
  const csv = MA.PLANTILLA_CARTERA + 'Piso B;Vivienda;;Luis Gómez;622;;15/01/2026;14/01/2027;750,50;5;750,50\r\nPiso C;Vivienda;;Sin fecha;;;;;500;;\r\n';
  const res = MA.importarCartera(s2, Tablas.leerCSV(csv), HOY);
  assert.deepEqual([res.inmuebles, res.inquilinos, res.contratos], [3, 3, 2]); assert.equal(res.errores.length, 1); assert.match(res.errores[0], /Fila 4/);
  assert.equal(s2.contratos[1].rentas[0].importe, 75050); assert.equal(s2.contratos[1].fin, '2027-01-14');
  const s3 = MA.nuevo(); const r3 = MA.importarCartera(s3, Tablas.leerCSV(csv), HOY); assert.equal(r3.limite, true); assert.equal(s3.inmuebles.length, 1);
});
test('documentos adjuntos', () => {
  const { s, p } = base();
  const a = MA.agregarAdjunto(s, { tipo: 'inmueble', id: p.id, nombre: 'foto.jpg', mime: 'image/jpeg', tam: 1000, archivo: 'adj/1.jpg' }, HOY);
  assert.equal(MA.adjuntosDe(s, 'inmueble', p.id).length, 1); assert.equal(MA.quitarAdjunto(s, a.id), 'adj/1.jpg'); assert.equal(s.adjuntos.length, 0);
  falla(() => MA.agregarAdjunto(s, { tipo: 'inmueble', id: 999, archivo: 'x' }, HOY), 'NO_EXISTE');
  assert.deepEqual(MA.importar(MA.exportar(s)).adjuntos, []);
});
test('Renta: vivienda con hipoteca, gastos, reducción, amortización e imputación', () => {
  const { s, p, q } = base();
  MA.editarInmueble(s, p.id, { referencia: '1234567AB1234C0001XY', valorCatastral: 8000000, valorCatastralConstruccion: 5000000, compraPrecio: 15000000, compraGastos: 1000000, compraFecha: '2020-05-01' });
  MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2025-04-01', importe: 70000 }, '2025-12-31');
  MA.generarCargos(s, '2025-12-31'); for (const c of s.cargos) MA.registrarPago(s, { cargoId: c.id, importe: c.importe, fecha: c.vence }, HOY);
  MA.crearGasto(s, { inmuebleId: p.id, concepto: 'IBI', categoria: 'impuesto', importe: 36500, fecha: '2025-09-10', pagado: true }, HOY);
  MA.crearGasto(s, { inmuebleId: p.id, concepto: 'Fontanero', categoria: 'mantenimiento', importe: 20000, fecha: '2025-06-10', pagado: true }, HOY);
  MA.crearGasto(s, { inmuebleId: p.id, concepto: 'Pintura', categoria: 'mantenimiento', importe: 30000, fecha: '2025-02-10', pagado: true }, HOY);
  const inf = MA.informeRenta(s, 2025, HOY), x = inf.inmuebles[0];
  assert.equal(x.diasAlquilado, 275); assert.equal(x.diasVacio, 90);
  assert.equal(x.ingresos.total, 9 * 70000);
  assert.equal(x.gastos.tributos, Math.round(36500 * 275 / 365)); assert.equal(x.gastos.reparacion, 20000, 'la pintura sin inquilino no cuenta');
  assert.equal(x.amortizacion.sobre, 'coste de adquisición'); assert.equal(x.amortizacion.base, Math.round(16000000 * 5 / 8));
  assert.equal(x.gastos.amortizacion, Math.round(10000000 * 0.03 * 275 / 365));
  assert.equal(x.contratos[0].reduccion, 50); assert.equal(x.reduccion, Math.round(x.rendimientoNeto * 0.5));
  assert.equal(x.imputacion.importe, Math.round(8000000 * 0.011 * 90 / 365));
  assert.equal(inf.totales.neto, x.rendimientoNeto);
  assert.match(MA.csvRenta(inf), /"Ingresos íntegros";6300;/); assert.equal(x.gastos.dudoso, 0);
  const pdf = Buffer.from(PDF.renta(inf, 'Carlos')).toString('latin1'); assert.match(pdf, /Ejercicio 2025/);
});
test('Renta: límite de intereses y reparaciones con arrastre a los años siguientes', () => {
  const { s, q } = base(); const p = MA.crearInmueble(s, { nombre: 'Local', tipo: 'Local comercial' }, HOY);
  MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2024-01-01', importe: 50000, retencion: true }, '2025-12-31'); MA.generarCargos(s, '2025-12-31');
  for (const c of s.cargos) MA.registrarPago(s, { cargoId: c.id, importe: c.importe, fecha: c.vence }, HOY);
  MA.crearGasto(s, { inmuebleId: p.id, concepto: 'Reforma tejado', categoria: 'mantenimiento', importe: 800000, fecha: '2024-03-01', pagado: true }, HOY);
  const a = MA.informeRenta(s, 2024, HOY).inmuebles[0], b = MA.informeRenta(s, 2025, HOY).inmuebles[0];
  assert.equal(a.exceso, 200000); assert.equal(a.rendimientoNeto, 0); assert.equal(a.reduccion, 0, 'un local no tiene reducción');
  assert.equal(a.retenciones, Math.round(600000 * 0.19));
  assert.equal(b.arrastreAplicado, 200000); assert.equal(b.rendimientoNeto, 600000 - 200000);
});
test('Renta: contrato anterior a la ley, 60 %; garaje sin reducción; inmueble sin alquiler', () => {
  const { s, p, q } = base();
  MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2022-01-01', importe: 60000 }, '2025-12-31'); MA.generarCargos(s, '2025-12-31');
  const g = MA.crearInmueble(s, { nombre: 'Garaje', tipo: 'Plaza de garaje', valorCatastral: 900000 }, HOY);
  const inf = MA.informeRenta(s, 2025, HOY);
  const piso = inf.inmuebles.find((x) => x.nombre === 'Piso Real'), gar = inf.inmuebles.find((x) => x.nombre === 'Garaje');
  assert.equal(piso.reduccionPct, 60); assert.ok(gar.sinActividad); assert.equal(gar.imputacion.importe, Math.round(900000 * 0.011));
});

test('idiomas: diccionarios completos y marcadores', () => {
  require('../www/idioma.js'); for (const l of ['en', 'de', 'fr', 'it']) require(`../www/i18n/${l}.js`);
  const I = globalThis.Idioma, en = I.dic('en');
  for (const l of ['de', 'fr', 'it']) assert.deepEqual(Object.keys(I.dic(l)).sort(), Object.keys(en).sort(), l);
  for (const l of ['en', 'de', 'fr', 'it']) for (const [k, v] of Object.entries(I.dic(l))) {
    const m = (s) => (s.match(/\{[a-z_]+\d?\}/g) || []).sort().join();
    assert.equal(m(v), m(k.startsWith('plantilla.') ? MA.PLANTILLAS[k.slice(10)] || v : k), `${l}: ${k}`);
  }
  assert.equal(I.trad('Vence el 05/12/2026', 'en'), 'Due on 05/12/2026');
  assert.equal(I.trad('Cobrado en noviembre 2026', 'de'), 'Erhalten im November 2026');
  assert.equal(I.trad('Cobrar a Ana Pérez', 'fr'), 'Encaisser de Ana Pérez');
  assert.equal(I.trad('20 de noviembre 2026', 'it'), '20 novembre 2026');
});

test('extracto Norma 43: abonos, cargos, conceptos complementarios y cabeceras de bancos', async () => {
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const l = [
    pad('11' + '2100' + '1234' + '1234567890' + '261101' + '261130' + '2' + '00000000100000' + '978' + '3' + 'CARLOS', 80),
    pad('22' + '    ' + '1234' + '261105' + '261105' + '02' + '099' + '2' + '00000000065000' + '0000000000' + 'BIZUM ANA   ' + '', 80),
    pad('23' + '01' + pad('TRANSFERENCIA DE ANA PEREZ GIL', 38) + pad('ALQUILER NOVIEMBRE', 38), 80),
    pad('22' + '    ' + '1234' + '261110' + '261110' + '03' + '012' + '1' + '00000000004550' + '0000000000' + 'COMUNIDAD   ', 80),
    pad('33' + '2100' + '1234' + '1234567890', 80), pad('88' + '9'.repeat(18), 80)];
  const m = Tablas.norma43(l.join('\r\n'));
  assert.equal(m.length, 2);
  assert.deepEqual([m[0].fecha, m[0].importe], ['2026-11-05', 65000]); assert.match(m[0].concepto, /ANA PEREZ GIL.*ALQUILER NOVIEMBRE.*BIZUM ANA/);
  assert.deepEqual([m[1].fecha, m[1].importe], ['2026-11-10', -4550]);
  const r = await Tablas.leerExtracto('extracto.n43', new TextEncoder().encode(l.join('\n')).buffer); assert.equal(r.length, 2);
  // Sabadell (F. Operativa) y Caja Rural (F. Oper.)
  for (const cab of ['F. Operativa', 'F. Oper.', 'Fecha Operación', 'Fecha']) {
    const e = Tablas.extracto([['Extracto de la cuenta'], [cab, 'Concepto', 'F. Valor', 'Importe', 'Saldo'], ['05/11/2026', 'BIZUM ANA', '05/11/2026', '650,00', '1.000,00']]);
    assert.deepEqual([e[0].fecha, e[0].importe], ['2026-11-05', 65000], cab);
  }
});

test('copropiedad: porcentajes validados e informe de la Renta por titular', () => {
  const { s, p, q } = base(); s.ajustes.propietario = 'María';
  falla(() => MA.editarInmueble(s, p.id, { titulares: [{ yo: true, pct: 50 }, { nombre: 'Juan', pct: 40 }] }), 'DATOS');
  MA.editarInmueble(s, p.id, { valorCatastral: 8000000, valorCatastralConstruccion: 5000000, titulares: [{ yo: true, pct: 50 }, { nombre: 'Juan Pérez', nif: '42000001A', pct: 50 }] });
  MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2025-01-01', importe: 70000 }, '2025-12-31');
  MA.generarCargos(s, '2025-12-31'); for (const c of s.cargos) MA.registrarPago(s, { cargoId: c.id, importe: c.importe, fecha: c.vence }, HOY);
  MA.crearGasto(s, { inmuebleId: p.id, concepto: 'IBI', categoria: 'impuesto', importe: 36500, fecha: '2025-09-10', pagado: true }, HOY);
  const todo = MA.informeRenta(s, 2025, HOY), tits = MA.titulares(s);
  assert.deepEqual(tits.map((x) => x.nombre), ['María', 'Juan Pérez']);
  const yo = MA.informeTitular(todo, s, 'yo'), juan = MA.informeTitular(todo, s, tits[1].clave);
  assert.equal(yo.inmuebles[0].ingresos.total, todo.inmuebles[0].ingresos.total / 2);
  assert.equal(juan.totales.ingresos, todo.totales.ingresos / 2); assert.equal(juan.inmuebles[0].diasAlquilado, todo.inmuebles[0].diasAlquilado);
  assert.equal(juan.inmuebles[0].contratos[0].reduccion, todo.inmuebles[0].contratos[0].reduccion, 'el % de reducción no se reparte');
  assert.ok(Math.abs(juan.totales.neto + yo.totales.neto - todo.totales.neto) <= 1);
  assert.match(juan.inmuebles[0].avisos[0], /50 %/);
  MA.editarInmueble(s, p.id, { titulares: [{ yo: true, pct: 100 }] }); assert.deepEqual(MA.partes(p), [{ nombre: '', nif: '', pct: 100, yo: true }]);
});

test('facturas: IGIC y retención en el recibo, numeración, resumen trimestral y Renta sin impuesto', () => {
  const s = MA.nuevo(); s.pro = true; const H = '2026-11-20'; s.ajustes.dni = '42000000T';
  const p = MA.crearInmueble(s, { nombre: 'Local', tipo: 'Local comercial' }, H), q = MA.crearInquilino(s, { nombre: 'Panadería SL', dni: 'B35000000' });
  const ct = MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-07-01', importe: 100000, impuesto: 'igic', retencion: true }, H);
  const c = s.cargos.find((x) => x.periodo === '2026-10');
  assert.deepEqual([c.base, c.cuota, c.ret, c.importe], [100000, 7000, 19000, 88000]);
  MA.registrarPago(s, { cargoId: c.id, importe: 88000, fecha: '2026-10-02' }, H);
  const f1 = MA.datosFactura(s, c.id, H), f2 = MA.datosFactura(s, s.cargos.find((x) => x.periodo === '2026-11').id, H);
  assert.equal(f1.numero, 'F2026-0001'); assert.equal(f2.numero, 'F2026-0002'); assert.equal(MA.datosFactura(s, c.id, H).numero, 'F2026-0001', 'no se renumera');
  assert.equal(f1.completo, true); assert.equal(f2.completo, false);
  const t4 = MA.resumenTrimestre(s, 2026, 4, H); assert.equal(t4.filas.length, 2); assert.equal(t4.cuota, 14000); assert.equal(t4.ret, 38000); assert.equal(t4.tipos[0].impuesto, 'IGIC');
  assert.equal(MA.resumenTrimestre(s, 2026, 3, H).sinNumero, 3);
  // Cambiar a IVA 21 % recalcula los recibos sin cobros, no los cobrados
  MA.editarContrato(s, ct.id, { impuesto: 'iva' }, H);
  assert.equal(s.cargos.find((x) => x.periodo === '2026-09').importe, 100000 + 21000 - 19000); assert.equal(c.importe, 88000);
  assert.equal(s.cargos.find((x) => x.periodo === '2026-11').importe, 88000, 'una factura emitida no cambia');
  // Cambio de un recibo: se indica la base; con factura emitida no se puede
  assert.throws(() => MA.ajustarCargo(s, s.cargos.find((x) => x.periodo === '2026-11').id, 50000, H), (e) => e.code === 'FACTURA');
  MA.ajustarCargo(s, s.cargos.find((x) => x.periodo === '2026-09').id, 50000, H); assert.equal(s.cargos.find((x) => x.periodo === '2026-09').importe, 50000 + 10500 - 9500);
  // Renta: ingresos = bases, retenciones = las de cada recibo
  const r = MA.informeRenta(s, 2026, H).inmuebles[0];
  assert.equal(r.ingresos.total, 100000 * 4 + 50000);
  assert.equal(r.retenciones, 19000 * 4 + 9500);
  // Panel: lo cobrado cuenta como ingreso sin el impuesto
  const k = MA.panel(s, H).inmuebles.find((x) => x.id === p.id); assert.equal(k.ingresos, 100000);
  // Vivienda sin impuesto ni retención: el recibo no cambia
  const p2 = MA.crearInmueble(s, { nombre: 'Piso', tipo: 'Vivienda' }, H), q2 = MA.crearInquilino(s, { nombre: 'Ana' });
  MA.crearContrato(s, { inmuebleId: p2.id, inquilinoId: q2.id, inicio: '2026-11-01', importe: 70000 }, H);
  const c2 = s.cargos.find((x) => x.contratoId !== ct.id); assert.equal(c2.importe, 70000); assert.equal(c2.base, undefined);
  assert.throws(() => MA.datosFactura(s, c2.id, H), (e) => e.code === 'DATOS');
});

test('documentos: modelos de contrato por tipo, Word válido y acta en PDF', () => {
  globalThis.PDF = require('../www/pdf.js'); const Doc = require('../www/documentos.js'), Ex = require('../www/exportar.js');
  const d = { lugar: 'Arrecife', fecha: '2026-11-21', arrendadores: [{ nombre: 'María', dni: '1A' }], arrendatario: { nombre: 'Ana', dni: '2B' }, inmueble: { direccion: 'C/ Real 4' },
    inicio: '2026-12-01', fin: null, anios: 1, renta: 75000, fianza: 75000, actualizacion: 'irav', gastos: [] };
  const txt = (tipo, extra) => Doc.contrato({ ...d, tipo, ...extra }).bloques.map((b) => b.x || '').join('\n');
  const v = txt('vivienda'); assert.match(v, /artículo 9/); assert.match(v, /Índice de Referencia/); assert.match(v, /una mensualidad/); assert.doesNotMatch(v, /\ba EL\b|\bde EL\b/);
  const l = txt('local', { impuesto: { nombre: 'IGIC', pct: 7 }, retencion: true, actualizacion: 'ipc' }); assert.match(l, /dos mensualidades/); assert.match(l, /IGIC/); assert.match(l, /19 %/); assert.match(l, /artículo 34/);
  assert.match(txt('garaje', { vehiculo: '1234 ABC' }), /1234 ABC/); assert.match(txt('habitacion'), /Código Civil/); assert.match(txt('trastero'), /inflamables/);
  assert.equal(Doc.tipoDe('Plaza de garaje'), 'garaje'); assert.equal(Doc.tipoDe('Vivienda', true), 'habitacion'); assert.equal(Doc.tipoDe('Nave'), 'local');
  const w = Buffer.from(Doc.docx(Doc.contrato({ ...d, tipo: 'vivienda' }), Ex.zip)); assert.equal(w.slice(0, 2).toString(), 'PK'); assert.match(w.toString('utf8'), /\[Content_Types\]\.xml/);
  const pdf = Buffer.from(Doc.pdfActa({ tipo: 'salida', fecha: '2026-12-01', inmueble: 'Piso', estancias: [{ nombre: 'Salón', estado: 'mal', notas: 'Mancha', fotos: [] }], contadores: { luz: '1' } })).toString('latin1');
  assert.ok(pdf.startsWith('%PDF') && /Acta de salida/.test(pdf) && /Con da/.test(pdf));
});

test('tipos de impuestos: cambiar el IGIC desde un mes sin tocar lo anterior ni lo facturado', () => {
  const s = MA.nuevo(); s.pro = true; const H = '2026-11-20';
  const p = MA.crearInmueble(s, { nombre: 'Local', tipo: 'Local comercial' }, H), q = MA.crearInquilino(s, { nombre: 'SL', dni: 'B1' });
  MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-09-01', importe: 100000, impuesto: 'igic' }, H);
  const sep = s.cargos.find((x) => x.periodo === '2026-09'), oct = s.cargos.find((x) => x.periodo === '2026-10'), nov = s.cargos.find((x) => x.periodo === '2026-11');
  MA.registrarPago(s, { cargoId: sep.id, importe: sep.importe, fecha: '2026-09-02' }, H); MA.datosFactura(s, oct.id, H);
  // Sube el IGIC al 7,5 % desde enero: nada de este año cambia; enero ya sale al 7,5 %
  assert.equal(MA.cambiarTipo(s, 'igic', '7,5', '2027-01', H), 0);
  assert.deepEqual([sep.pct, oct.pct, nov.pct], [7, 7, 7]);
  MA.generarCargos(s, '2027-01-15'); const ene = s.cargos.find((x) => x.periodo === '2027-01'); assert.equal(ene.pct, 7.5); assert.equal(ene.importe, 107500);
  // Un cambio desde octubre recalcula noviembre y diciembre (octubre tiene factura y septiembre está cobrado)
  assert.equal(MA.cambiarTipo(s, 'igic', 3, '2026-10', H), 2);
  assert.deepEqual([sep.pct, oct.pct, nov.pct], [7, 7, 3]); assert.equal(ene.pct, 7.5, 'enero sigue con su tipo posterior');
  assert.equal(MA.tipoEn(s, 'igic', '2026-12'), 3); assert.equal(MA.tipoEn(s, 'igic', '2027-02'), 7.5); assert.equal(MA.tipoEn(s, 'iva', '2027-02'), 21);
  // Quitar el cambio de octubre vuelve a dejar noviembre al 7 %
  MA.quitarTipo(s, 'igic', '2026-10', H); assert.equal(nov.pct, 7);
  // Retención con fecha de efecto
  MA.editarContrato(s, s.contratos[0].id, { retencion: true }, H); MA.cambiarTipo(s, 'ret', 20, '2027-01', H);
  assert.equal(nov.ret, 19000); assert.equal(ene.ret, 20000); assert.equal(MA.datosFactura(s, ene.id, '2027-01-15').retPct, 20);
  assert.throws(() => MA.cambiarTipo(s, 'igic', 80, '2027-01', H), (e) => e.code === 'DATOS');
});
