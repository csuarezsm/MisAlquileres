'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const MA = require('../www/nucleo.js');
const HOY = '2026-11-16';
const falla = (fn, code) => assert.throws(fn, (e) => e.code === code, 'se esperaba ' + code);
function base({ pro = true } = {}) {
  const s = MA.nuevo(); s.pro = pro;
  const p = MA.crearInmueble(s, { nombre: 'Plaza 12', tipo: 'Plaza de garaje' }, HOY);
  const q = MA.crearInquilino(s, { nombre: 'Ana Pérez', telefono: '600111222' });
  return { s, p, q };
}
const contrato = (s, p, q, extra = {}) => MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-09-01', importe: 50000, ...extra }, HOY);

test('importes: de texto a céntimos', () => {
  assert.equal(MA.centimos('1.234,56'), 123456); assert.equal(MA.centimos('500'), 50000); assert.equal(MA.centimos(12.5), 1250);
  assert.equal(MA.centimos('0,1') + MA.centimos('0,2'), 30); assert.equal(MA.centimos('120.000'), 12000000); assert.equal(MA.centimos('12.5'), 1250);
  falla(() => MA.centimos('12,345'), 'IMPORTE'); falla(() => MA.centimos('abc'), 'IMPORTE');
});
test('versión gratuita: un inmueble; completa: sin límite', () => {
  const { s } = base({ pro: false });
  falla(() => MA.crearInmueble(s, { nombre: 'Otro' }, HOY), 'LIMITE');
  s.pro = true; MA.crearInmueble(s, { nombre: 'Otro' }, HOY); assert.equal(s.inmuebles.length, 2);
});
test('contrato: genera un recibo por mes hasta el actual, sin duplicar', () => {
  const { s, p, q } = base(); contrato(s, p, q);
  assert.deepEqual(s.cargos.map((c) => c.periodo), ['2026-09', '2026-10', '2026-11']);
  assert.equal(MA.generarCargos(s, HOY), 0);
  assert.equal(MA.generarCargos(s, '2026-12-01'), 1);
  assert.equal(s.pagos.length, 0, 'no se dan por cobrados los meses anteriores');
});
test('contrato: día de cobro 31 se ajusta al mes', () => {
  const { s, p, q } = base(); MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: '2026-01-15', importe: 10000, diaCobro: 31 }, HOY);
  assert.equal(s.cargos.find((c) => c.periodo === '2026-02').vence, '2026-02-28');
});
test('contrato: se rechaza el solapamiento en el mismo inmueble', () => {
  const { s, p, q } = base(); contrato(s, p, q);
  falla(() => contrato(s, p, q), 'SOLAPE');
  falla(() => contrato(s, p, q, { inicio: '2027-01-01' }), 'SOLAPE');
  const hab = MA.crearInmueble(s, { nombre: 'Piso por habitaciones', tipo: 'Vivienda', porUnidades: true }, HOY);
  contrato(s, hab, q); contrato(s, hab, q); assert.equal(s.contratos.length, 3);
});
test('contrato: tras finalizar uno se puede crear el siguiente', () => {
  const { s, p, q } = base(); const ct = contrato(s, p, q);
  MA.finalizarContrato(s, ct.id, { fecha: '2026-10-31', estado: 'finalizado' }, HOY);
  assert.equal(s.cargos.find((c) => c.periodo === '2026-11').anulado.motivo, 'Fuera de las fechas del contrato');
  contrato(s, p, q, { inicio: '2026-11-01' });
  falla(() => contrato(s, p, q, { inicio: '2026-10-15' }), 'SOLAPE');
});
test('pago: no admite exceso salvo reparto expreso', () => {
  const { s, p, q } = base(); contrato(s, p, q); const [sep, oct, nov] = s.cargos;
  falla(() => MA.registrarPago(s, { cargoId: sep.id, importe: 60000 }, HOY), 'EXCESO');
  assert.equal(s.pagos.length, 0);
  MA.registrarPago(s, { cargoId: sep.id, importe: 60000, repartir: true }, HOY);
  assert.equal(MA.pagadoDe(s, sep.id), 50000); assert.equal(MA.pagadoDe(s, oct.id), 10000);
  assert.equal(MA.estadoCargo(s, sep, HOY), 'pagado'); assert.equal(MA.estadoCargo(s, oct, HOY), 'atrasado'); assert.equal(MA.estadoCargo(s, nov, HOY), 'atrasado');
  falla(() => MA.registrarPago(s, { cargoId: nov.id, importe: 999999, repartir: true }, HOY), 'EXCESO');
  assert.equal(s.pagos.length, 2, 'un reparto fallido no deja nada apuntado');
});
test('pago: la misma petición dos veces solo cuenta una', () => {
  const { s, p, q } = base(); contrato(s, p, q); const c = s.cargos[0];
  const a = MA.registrarPago(s, { cargoId: c.id, importe: 20000, clave: 'k1' }, HOY);
  const b = MA.registrarPago(s, { cargoId: c.id, importe: 20000, clave: 'k1' }, HOY);
  assert.equal(a.repetido, false); assert.equal(b.repetido, true); assert.deepEqual(a.pagos, b.pagos);
  assert.equal(MA.pagadoDe(s, c.id), 20000);
});
test('pago: fechas futuras o inválidas, y recibos anulados', () => {
  const { s, p, q } = base(); contrato(s, p, q); const c = s.cargos[2];
  falla(() => MA.registrarPago(s, { cargoId: c.id, importe: 100, fecha: '2026-12-01' }, HOY), 'FECHA');
  falla(() => MA.registrarPago(s, { cargoId: c.id, importe: 100, fecha: '2026-02-30' }, HOY), 'FECHA');
  falla(() => MA.registrarPago(s, { cargoId: c.id, importe: 10.5 }, HOY), 'IMPORTE');
  MA.anularCargo(s, c.id, 'Mes regalado', HOY);
  falla(() => MA.registrarPago(s, { cargoId: c.id, importe: 100 }, HOY), 'ANULADO');
});
test('pago: se anula con motivo y queda en el historial', () => {
  const { s, p, q } = base(); contrato(s, p, q); const c = s.cargos[0];
  const { pagos } = MA.registrarPago(s, { cargoId: c.id, importe: 50000 }, HOY);
  falla(() => MA.anularCargo(s, c.id, 'x', HOY), 'HISTORIAL');
  MA.anularPago(s, pagos[0], 'Transferencia devuelta', HOY);
  assert.equal(MA.pagadoDe(s, c.id), 0); assert.equal(s.pagos.length, 1); assert.equal(s.pagos[0].anulado.motivo, 'Transferencia devuelta');
  assert.match(MA.csvPagos(s, HOY), /Transferencia devuelta/);
});
test('contrato con cobros no se puede eliminar; sin cobros sí', () => {
  const { s, p, q } = base(); const ct = contrato(s, p, q);
  MA.registrarPago(s, { cargoId: s.cargos[0].id, importe: 50000 }, HOY);
  falla(() => MA.eliminarContrato(s, ct.id), 'HISTORIAL');
  falla(() => MA.eliminarInmueble(s, p.id), 'HISTORIAL'); falla(() => MA.eliminarInquilino(s, q.id), 'HISTORIAL');
  assert.equal(s.pagos.length, 1);
  const p2 = MA.crearInmueble(s, { nombre: 'Trastero' }, HOY); const c2 = contrato(s, p2, q);
  MA.eliminarContrato(s, c2.id); assert.equal(s.cargos.filter((c) => c.contratoId === c2.id).length, 0);
});
test('histórico cobrado: solo si se pide y marcado como estimado', () => {
  const { s, p, q } = base(); contrato(s, p, q, { historicoCobrado: true });
  assert.equal(s.pagos.length, 2); assert.ok(s.pagos.every((x) => x.origen === 'estimado'));
  assert.equal(MA.cargos(s, HOY)[0].estimado, true); assert.equal(MA.cargos(s, HOY)[2].estado, 'atrasado');
});
test('revisión de renta: aplica desde un mes y respeta lo ya cobrado', () => {
  const { s, p, q } = base(); const ct = contrato(s, p, q);
  MA.registrarPago(s, { cargoId: s.cargos[1].id, importe: 10000 }, HOY);
  MA.revisarRenta(s, ct.id, { desde: '2026-10', importe: 55000 }, HOY);
  assert.deepEqual(s.cargos.map((c) => c.importe), [50000, 50000, 55000]);
  MA.generarCargos(s, '2027-01-05'); assert.equal(s.cargos.find((c) => c.periodo === '2027-01').importe, 55000);
  assert.equal(MA.rentaEn(ct, '2026-09'), 50000);
  falla(() => MA.revisarRenta(s, ct.id, { desde: '2026-08', importe: 1 }, HOY), 'FECHA');
});
test('renovación: amplía el fin y sube la renta desde el mes siguiente', () => {
  const { s, p, q } = base(); const ct = contrato(s, p, q, { fin: '2026-10-31' });
  assert.equal(s.cargos.length, 2); assert.equal(MA.situacionContrato(ct, HOY), 'vencido');
  MA.renovarContrato(s, ct.id, { fin: '2027-10-31', importe: 52000 }, HOY);
  assert.deepEqual(s.cargos.map((c) => [c.periodo, c.importe]), [['2026-09', 50000], ['2026-10', 50000], ['2026-11', 52000]]);
  assert.equal(MA.situacionContrato(ct, HOY), 'vigente');
});
test('fianza: entrega, devolución y retención sin pasar del depósito', () => {
  const { s, p, q } = base(); const ct = contrato(s, p, q, { fianza: 100000 });
  falla(() => MA.registrarFianza(s, { contratoId: ct.id, tipo: 'devuelta', importe: 1 }, HOY), 'EXCESO');
  MA.registrarFianza(s, { contratoId: ct.id, tipo: 'recibida', importe: 100000, clave: 'f1' }, HOY);
  MA.registrarFianza(s, { contratoId: ct.id, tipo: 'recibida', importe: 100000, clave: 'f1' }, HOY);
  MA.registrarFianza(s, { contratoId: ct.id, tipo: 'retenida', importe: 30000 }, HOY);
  MA.registrarFianza(s, { contratoId: ct.id, tipo: 'devuelta', importe: 70000 }, HOY);
  assert.equal(MA.saldoFianza(s, ct.id), 0);
  falla(() => MA.registrarFianza(s, { contratoId: ct.id, tipo: 'devuelta', importe: 1 }, HOY), 'EXCESO');
});
test('gastos periódicos: previsiones sin duplicar y nunca pagadas por su cuenta', () => {
  const { s, p } = base();
  const c = MA.crearConcepto(s, { inmuebleId: p.id, concepto: 'Comunidad', categoria: 'comunidad', periodicidad: 'mensual', importe: 3000, dia: 5, domiciliado: true }, HOY);
  assert.deepEqual(s.gastos.map((g) => g.clave), ['2026-11', '2026-12']);
  assert.equal(MA.generarGastos(s, HOY), 0);
  assert.equal(MA.estadoGasto(s, s.gastos[0], HOY), 'por_confirmar'); assert.equal(MA.estadoGasto(s, s.gastos[1], HOY), 'previsto');
  MA.confirmarGasto(s, s.gastos[0].id, { importe: 3150 }, HOY);
  assert.equal(MA.estadoGasto(s, s.gastos[0], HOY), 'pagado'); assert.equal(s.gastos[0].importe, 3150); assert.equal(s.gastos[0].pagado.fecha, '2026-11-05');
  MA.desconfirmarGasto(s, s.gastos[0].id, 'Recibo devuelto', HOY); assert.equal(MA.estadoGasto(s, s.gastos[0], HOY), 'por_confirmar');
  MA.editarConcepto(s, c.id, { importe: 3500 }, HOY);
  assert.deepEqual(s.gastos.map((g) => g.importe).sort(), [3500, 3500]);
});
test('gasto anual: solo en su mes; no domiciliado vencido', () => {
  const { s, p } = base();
  MA.crearConcepto(s, { inmuebleId: p.id, concepto: 'IBI', categoria: 'impuesto', periodicidad: 'anual', mesInicio: 9, importe: 12000, desde: '2025-01' }, HOY);
  assert.deepEqual(s.gastos.map((g) => g.clave), ['2025-09', '2026-09']);
  assert.ok(s.gastos.every((g) => g.estimado && g.pagado), 'el histórico anterior al alta queda como estimado');
});
test('gasto repercutido: porcentaje, varios cobros e idempotencia', () => {
  const { s, p, q } = base(); contrato(s, p, q);
  MA.crearConcepto(s, { inmuebleId: p.id, concepto: 'Agua', categoria: 'suministro', responsable: 'repercute', porcentaje: 50, periodicidad: 'mensual', importe: 4000 }, HOY);
  const g = s.gastos[0]; assert.equal(g.repercutir, 2000); assert.equal(g.contratoId, s.contratos[0].id);
  MA.confirmarGasto(s, g.id, { importe: 5000 }, HOY); assert.equal(g.repercutir, 2500);
  MA.registrarReembolso(s, { gastoId: g.id, importe: 1000, clave: 'r1' }, HOY); MA.registrarReembolso(s, { gastoId: g.id, importe: 1000, clave: 'r1' }, HOY);
  MA.registrarReembolso(s, { gastoId: g.id, importe: 1500 }, HOY);
  assert.equal(MA.reembolsado(s, g.id), 2500);
  falla(() => MA.registrarReembolso(s, { gastoId: g.id, importe: 1 }, HOY), 'EXCESO');
  falla(() => MA.anularGasto(s, g.id, 'x', HOY), 'HISTORIAL');
  falla(() => MA.crearGasto(s, { inmuebleId: p.id, concepto: 'Cerrajero', importe: 8000, repercutir: 8000, fecha: '2026-01-10' }, HOY), 'DATOS');
});
test('hipoteca: el cuadro cuadra al céntimo y se apunta como gasto', () => {
  const { s, p } = base();
  MA.ponerHipoteca(s, p.id, { importe: 10000000, tin: 3, anios: 20, inicio: '2026-06-05' }, HOY);
  const t = MA.cuadroHipoteca(p.hipoteca);
  assert.equal(t.length, 240); assert.equal(t[t.length - 1].saldo, 0);
  assert.equal(t.reduce((a, x) => a + x.capital, 0), 10000000);
  assert.equal(t[0].cuota, 55460);
  const gs = s.gastos.filter((g) => g.categoria === 'financiacion');
  assert.deepEqual(gs.map((g) => g.clave), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
  assert.equal(gs.filter((g) => g.estimado).length, 5); assert.equal(MA.estadoGasto(s, gs[5], HOY), 'por_confirmar'); assert.equal(MA.estadoGasto(s, gs[6], HOY), 'previsto');
  assert.equal(MA.situacionHipoteca(p.hipoteca, HOY).pagadas, 6);
  MA.ponerHipoteca(s, p.id, null, HOY); assert.equal(s.gastos.filter((g) => g.categoria === 'financiacion' && !g.pagado).length, 0);
});
test('panel y avisos', () => {
  const { s, p, q } = base(); const ct = contrato(s, p, q, { fin: '2026-12-10' });
  MA.registrarPago(s, { cargoId: s.cargos[0].id, importe: 50000, fecha: '2026-09-03' }, HOY);
  MA.registrarPago(s, { cargoId: s.cargos[2].id, importe: 20000 }, HOY);
  const g = MA.crearGasto(s, { inmuebleId: p.id, concepto: 'Pintura', categoria: 'mantenimiento', importe: 15000, fecha: '2026-10-02', pagado: true }, HOY);
  const k = MA.panel(s, HOY);
  assert.deepEqual(k.mesActual, { esperado: 50000, cobrado: 20000, pendiente: 30000, porcentaje: 40 });
  assert.equal(k.morosidad.deuda, 80000); assert.equal(k.morosidad.recibos, 2); assert.equal(k.morosidad.morosos, 1);
  assert.equal(k.cartera.ocupacion, 100); assert.equal(k.cartera.rentaMensual, 50000);
  assert.equal(k.ultimos12.ingresos, 70000); assert.equal(k.ultimos12.gastos, 15000); assert.equal(k.ultimos12.neto, 55000);
  assert.equal(k.serie.find((x) => x.mes === '2026-09').ingresos, 50000);
  const a = MA.avisos(s, HOY).map((x) => x.tipo);
  assert.ok(a.includes('cobro_atrasado') && a.includes('contrato_por_vencer'));
  MA.anularGasto(s, g.id, 'Duplicado', HOY); assert.equal(MA.panel(s, HOY).ultimos12.gastos, 0);
  assert.equal(ct.estado, 'activo');
});
test('CSV: neutraliza fórmulas y usa coma decimal', () => {
  const { s, q } = base(); const p = MA.crearInmueble(s, { nombre: '=1+1' }, HOY); contrato(s, p, q, { importe: 50050 });
  const t = MA.csvCobros(s, HOY);
  assert.ok(t.includes('"\'=1+1"')); assert.ok(!/;"=1\+1"/.test(t)); assert.ok(t.includes(';500,5;'));
});
test('copia: exportar e importar conserva todo; no desbloquea la versión completa', () => {
  const { s, p, q } = base(); contrato(s, p, q); MA.registrarPago(s, { cargoId: s.cargos[0].id, importe: 50000, clave: 'a' }, HOY);
  const r = MA.importar(MA.exportar(s));
  assert.equal(r.pro, false); assert.equal(r.pagos.length, 1); assert.equal(MA.pagadoDe(r, r.cargos[0].id), 50000);
  assert.equal(MA.registrarPago(r, { cargoId: r.cargos[0].id, importe: 50000, clave: 'a' }, HOY).repetido, true);
  const q2 = MA.crearInquilino(r, { nombre: 'Luis' }); assert.ok(q2.id > Math.max(...s.pagos.map((x) => x.id)));
  falla(() => MA.importar('{"x":1}'), 'COPIA'); falla(() => MA.importar('no es json'), 'COPIA');
});
test('mensajes: rellena las variables conocidas', () => {
  assert.equal(MA.mensaje('Hola {nombre}, {importe} {otra}', { nombre: 'Ana', importe: '500,00 €' }), 'Hola Ana, 500,00 € {otra}');
});
test('gastos típicos y recordatorios futuros', () => {
  const { s, q } = base(); const v = MA.crearInmueble(s, { nombre: 'Piso', tipo: 'Vivienda' }, HOY);
  assert.equal(MA.cargarTipicos(s, v.id, HOY), 7); assert.equal(MA.cargarTipicos(s, v.id, HOY), 0);
  assert.equal(s.gastos.length, 0, 'sin importe no se apunta nada');
  contrato(s, v, q, { fin: '2026-12-31', diaCobro: 20 });
  const a = MA.proximosAvisos(s, HOY, 60);
  assert.ok(a.some((x) => x.fecha === '2026-11-20' && x.titulo === 'Hoy toca cobrar'));
  assert.ok(a.some((x) => x.fecha === '2026-12-20')); assert.ok(a.some((x) => x.fecha === '2026-12-31' && /vence/.test(x.titulo)));
  assert.ok(a.some((x) => x.titulo === 'Cobros atrasados')); assert.ok(a.every((x) => x.fecha > HOY));
});
