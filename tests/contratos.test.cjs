const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../www/documentos.js');
const datos = (o = {}) => ({ tipo: 'vivienda', lugar: 'Arrecife', fecha: '2026-11-21', arrendadores: [{ nombre: 'Carlos Pérez', dni: '1X' }], arrendatario: { nombre: 'Ana López', dni: '2Y' },
  inmueble: { direccion: 'Calle Real 5, Arrecife' }, inicio: '2026-12-01', anios: 1, renta: 85000, rentaLetras: 'ochocientos cincuenta euros', diaPago: 5, fianza: 85000, gastos: [], actualizacion: 'irav', ...o });

test('el contrato se puede pasar a secciones y volver sin perder nada', () => {
  for (const tipo of Object.keys(D.TIPOS)) { const doc = D.contrato(datos({ tipo, amueblado: true, adicionales: 'Uno\nDos' })); assert.deepStrictEqual(D.desdeSecciones(D.secciones(doc)).bloques, doc.bloques, tipo); }
});

test('modelo propio: cambios, quitadas y nuevas, con los datos de cada contrato', () => {
  const s = D.secciones(D.contrato(datos())), e = JSON.parse(JSON.stringify(s));
  const iR = e.clausulas.findIndex((c) => c.titulo === 'Renta y forma de pago');
  e.clausulas[iR].texto = 'Ana López pagará 850,00 € el día 5 de cada mes en Calle Real 5, Arrecife.';
  e.clausulas = e.clausulas.filter((c) => c.titulo !== 'Notificaciones');
  e.clausulas.push({ titulo: 'Piscina', texto: 'Ana López podrá usar la piscina.' });
  const m = D.crearModelo(s, e, datos());
  assert.equal(m.cambios['Renta y forma de pago'], '{INQUILINO} pagará {RENTA} el {DIA_PAGO} de cada mes en {DIRECCION}.');
  assert.equal(m.cambios.Notificaciones, null);
  const d2 = datos({ arrendatario: { nombre: 'Luis Gil' }, renta: 60000, diaPago: 10, inmueble: { direccion: 'Av. Mancomunidad 3' }, adicionales: 'Pacto' });
  const s2 = D.aplicarModelo(D.secciones(D.contrato(d2)), m, d2), t = s2.clausulas.map((c) => c.titulo);
  assert.equal(s2.clausulas.find((c) => c.titulo === 'Renta y forma de pago').texto, 'Luis Gil pagará 600,00 € el día 10 de cada mes en Av. Mancomunidad 3.');
  assert.ok(!t.includes('Notificaciones'));
  assert.deepStrictEqual(t.slice(-2), ['Piscina', 'Otros pactos'], 'las nuevas van antes de los pactos de cada contrato');
  assert.equal(D.crearModelo(s, s, datos()), null, 'sin cambios no hay modelo');
  const doc = D.desdeSecciones(s2); assert.deepStrictEqual(doc.bloques.filter((b) => b.t === 'c').map((b) => b.n), t.map((_, k) => k + 1), 'se renumeran');
});
