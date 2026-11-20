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
  const { s, p, q } = base(); const ct = MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-11-01', importe: 65000, fianza: 65000 }, HOY);
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
