'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const MA = require('../www/extras.js');
const D = require('../www/documentos.js');
const HOY = '2026-11-22';

test('comunidades: impuesto de los locales y fianza según dónde está el inmueble', () => {
  const s = MA.nuevo(); s.pro = true;
  const loc = MA.crearInmueble(s, { nombre: 'Local Gran Vía', tipo: 'Local comercial', ccaa: 'madrid' }, HOY);
  const can = MA.crearInmueble(s, { nombre: 'Local Arrecife', tipo: 'Local comercial', ccaa: 'canarias' }, HOY);
  const viv = MA.crearInmueble(s, { nombre: 'Piso Sevilla', tipo: 'Vivienda', ccaa: 'andalucia' }, HOY);
  const sin = MA.crearInmueble(s, { nombre: 'Piso sin comunidad', tipo: 'Vivienda' }, HOY);
  assert.equal(MA.impuestoPorDefecto(s, loc.id), 'iva');
  assert.equal(MA.impuestoPorDefecto(s, can.id), 'igic');
  assert.equal(MA.impuestoPorDefecto(s, viv.id), 'ninguno', 'las viviendas no llevan impuesto');
  assert.equal(MA.organismoFianza(s, loc.id), 'la Agencia de Vivienda Social de la Comunidad de Madrid');
  assert.equal(MA.organismoFianza(s, viv.id), null, 'Andalucía no exige el depósito desde enero de 2026');
  assert.equal(MA.organismoFianza(s, sin.id), undefined);
  s.ajustes.ccaa = 'cataluna'; assert.equal(MA.sinArticulo(MA.organismoFianza(s, sin.id)), 'Institut Català del Sòl (INCASÒL)', 'sin comunidad propia usa la de Mis datos');
  assert.equal(MA.crearInmueble(s, { nombre: 'X', ccaa: 'inventada' }, HOY).ccaa, '');
  // En Andalucía no se avisa de depositar la fianza; en Madrid, sí
  for (const p of [loc, viv]) { const q = MA.crearInquilino(s, { nombre: 'Q' + p.id }); const ct = MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, importe: 80000, inicio: '2026-11-01', fianza: 80000 }, HOY); MA.registrarFianza(s, { contratoId: ct.id, tipo: 'recibida', importe: 80000, fecha: '2026-11-01' }, HOY); }
  const av = MA.avisosFianza(s, HOY).filter((a) => a.tipo === 'fianza_deposito').map((a) => a.titulo);
  assert.ok(av.some((t) => /Gran Vía/.test(t)) && !av.some((t) => /Sevilla/.test(t)), JSON.stringify(av));
});

test('comunidades: la cláusula de la fianza del contrato', () => {
  const base = { tipo: 'vivienda', arrendadores: [{ nombre: 'A' }], arrendatario: { nombre: 'B' }, inmueble: {}, inicio: '2027-01-01', anios: 1, renta: 80000, fianza: 80000, gastos: [] };
  const txt = (o) => D.contrato({ ...base, ...o }).bloques.map((b) => b.x || '').join(' ');
  assert.match(txt({ ccaa: MA.CCAA.madrid }), /depositará la fianza en la Agencia de Vivienda Social de la Comunidad de Madrid/);
  assert.match(txt({ ccaa: MA.CCAA.andalucia }), /no exige depositar la fianza/);
  assert.match(txt({ ccaa: MA.CCAA.navarra }), /Registro de Contratos de Arrendamiento de Vivienda de Navarra/);
  assert.match(txt({}), /organismo que establezca la normativa de la comunidad autónoma/);
});
