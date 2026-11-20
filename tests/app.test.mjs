// Prueba la interfaz completa en un móvil simulado: alta, cobros, límites, gastos, copias y accesibilidad básica.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
const WWW = path.resolve(import.meta.dirname, '../www'), CAP = process.env.CAPTURAS;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { const f = path.join(WWW, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  if (!f.startsWith(WWW) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
await new Promise((ok) => srv.listen(0, ok)); const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const nav = await chromium.launch({ channel: process.env.CHROME_CHANNEL || undefined, executablePath: process.env.CHROME_PATH || undefined });
const errores = []; let pasos = 0;
async function pagina(opts = {}, tienda) {
  const ctx = await nav.newContext({ viewport: { width: +(process.env.ANCHO || 390), height: +(process.env.ALTO || 800) }, deviceScaleFactor: +(process.env.ESCALA || 2), locale: 'es-ES', timezoneId: 'Atlantic/Canary', acceptDownloads: true, ...opts });
  if (tienda) await ctx.addInitScript(() => { window.Tienda = { disponible: true, precio: async () => '9,99 €', comprar: async () => { localStorage.setItem('t.comprado', '1'); return true; }, tiene: async () => localStorage.getItem('t.comprado') === '1' }; });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto(URL0); await p.waitForFunction(() => window.__ma); return p;
}
const paso = async (n, fn) => { await fn(); pasos++; console.log('  ok ' + n); };
const foto = async (p, n) => { if (CAP) { fs.mkdirSync(CAP, { recursive: true }); await p.screenshot({ path: path.join(CAP, n + '.png') }); } };
const campo = (p, n) => p.locator(`#hoja [name=${n}]`);
const guardar = (p) => p.locator('#hoja form button[type=submit]').click();
const S = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__ma.S)));
const hoy = new Date(); const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

try {
  const p = await pagina({}, true);
  await paso('arranque vacío: alta rápida, importar o paso a paso', async () => { await p.getByText('Empieza en un minuto').waitFor(); await foto(p, '00-vacio'); });
  await paso('alta de inmueble con gastos habituales', async () => {
    await p.getByRole('button', { name: 'Paso a paso' }).click(); await campo(p, 'nombre').fill('Piso Calle Real 4'); await campo(p, 'tipo').selectOption('Vivienda');
    await campo(p, 'compraPrecio').fill('120.000'); await guardar(p);
    await p.locator('#hoja').getByText('Gastos periódicos').waitFor(); const s = await S(p);
    assert.equal(s.inmuebles.length, 1); assert.equal(s.inmuebles[0].compraPrecio, 12000000); assert.equal(s.conceptos.length, 7);
  });
  await paso('gasto periódico: poner importe a la comunidad', async () => {
    await p.locator('#hoja .tar', { hasText: 'Comunidad' }).click(); await campo(p, 'importe').fill('45,50'); await campo(p, 'domiciliado').check(); await guardar(p);
    const s = await S(p); assert.ok(s.gastos.length >= 1); assert.equal(s.gastos[0].importe, 4550); assert.equal(s.gastos[0].pagado, null, 'no se paga solo');
    await p.locator('#hoja .cerrar').click();
  });
  await paso('contrato con inquilino nuevo; genera los recibos', async () => {
    await p.getByRole('button', { name: 'Crear contrato' }).click(); await campo(p, 'nNombre').fill('Ana Pérez Gil'); await campo(p, 'nTelefono').fill('600 111 222');
    await campo(p, 'inicio').fill(iso(mesAnt)); await campo(p, 'importe').fill('650'); await campo(p, 'fianza').fill('650'); await guardar(p);
    const s = await S(p); assert.equal(s.contratos.length, 1); assert.equal(s.cargos.length, 3); assert.equal(s.pagos.length, 0);
    await p.getByText('Atrasados').waitFor(); await foto(p, '01-inicio');
  });
  await paso('validación: contrato sin renta muestra el error en el formulario', async () => {
    await p.goto(URL0 + '#contratos'); await p.locator('.fab').click(); await guardar(p);
    await p.locator('#hoja .error').waitFor(); assert.match(await p.locator('#hoja .error').innerText(), /renta/i);
    await campo(p, 'importe').fill('500'); await campo(p, 'inquilinoId').selectOption({ index: 0 }); await guardar(p);
    assert.match(await p.locator('#hoja .error').innerText(), /ya tiene un contrato/); await p.keyboard.press('Escape'); assert.equal((await S(p)).contratos.length, 1);
  });
  await paso('cobro rápido, sin duplicar con doble pulsación, y deshacer', async () => {
    await p.goto(URL0 + '#inicio'); const b = p.locator('[data-a=cobrado]').first(); await b.dblclick();
    let s = await S(p); assert.equal(s.pagos.length, 1); assert.equal(s.pagos[0].importe, 65000);
    await p.locator('#toast button', { hasText: 'Deshacer' }).click(); s = await S(p); assert.ok(s.pagos[0].anulado); assert.equal(s.pagos.length, 1);
  });
  await paso('cobro parcial, exceso rechazado y reparto', async () => {
    await p.goto(URL0 + '#cobros'); await p.locator('[data-a=cobro]').first().click(); await foto(p, '02-recibo');
    await campo(p, 'importe').fill('700'); await p.locator('#fpago button[type=submit]').click();
    assert.match(await p.locator('#fpago .error').innerText(), /supera/);
    await campo(p, 'repartir').check(); await p.locator('#fpago button[type=submit]').click(); await p.getByText('Cobros de este recibo').waitFor();
    const s = await S(p), vivos = s.pagos.filter((x) => !x.anulado); assert.equal(vivos.reduce((t, x) => t + x.importe, 0), 70000); assert.equal(vivos.length, 2);
    await p.locator('#hoja .cerrar').click(); await foto(p, '03-cobros');
  });
  await paso('anular un cobro pide motivo y queda en el historial', async () => {
    await p.locator('[data-a=cobro]').first().click(); await p.locator('[data-a=anularPago]').first().click(); await p.locator('#hoja input').fill('Transferencia devuelta'); await p.locator('#hoja [data-x=si]').click();
    await p.locator('#hoja').getByText('Transferencia devuelta').waitFor(); const s = await S(p); assert.ok(s.pagos.some((x) => x.anulado && x.anulado.motivo === 'Transferencia devuelta'));
    await p.locator('#hoja .cerrar').click();
  });
  await paso('contrato: cambio de renta, fianza y finalizar; eliminar se rechaza', async () => {
    await p.goto(URL0 + '#contratos'); await p.locator('[data-a=contrato]').first().click(); await foto(p, '04-contrato');
    await p.locator('[data-a=revisar]').click(); await campo(p, 'importe').fill('680'); await guardar(p);
    assert.equal((await S(p)).contratos[0].rentas.length, 2);
    await p.locator('[data-a=fianza][data-t=recibida]').click(); await guardar(p); assert.equal((await S(p)).fianzas[0].importe, 65000);
    await p.locator('[data-a=eliminarContrato]').click(); await p.locator('#hoja [data-x=si]').click();
    await p.locator('#toast').getByText(/Finalízalo/).waitFor(); assert.equal((await S(p)).contratos.length, 1);
  });
  await paso('gastos: confirmar domiciliado, gasto suelto repercutido y cobro al inquilino', async () => {
    await p.goto(URL0 + '#gastos'); await foto(p, '05-gastos');
    const conf = p.locator('[data-a=gastoPagado]'); if (await conf.count()) { await conf.first().click(); assert.ok((await S(p)).gastos.some((g) => g.pagado)); }
    await p.locator('.fab').click(); await campo(p, 'concepto').fill('Cerrajero'); await campo(p, 'importe').fill('80'); await campo(p, 'repercutir').fill('80'); await guardar(p);
    await p.locator('.tar', { hasText: 'Cerrajero' }).click(); await p.locator('[data-a=cobrarGasto]').click(); await campo(p, 'importe').fill('30'); await guardar(p);
    const s = await S(p); assert.equal(s.reembolsos[0].importe, 3000); await p.locator('#hoja').getByText('Cobrado: 30,00').waitFor(); await p.locator('#hoja .cerrar').click();
  });
  await paso('límite gratuito y compra de la versión completa', async () => {
    await p.goto(URL0 + '#inmuebles'); await p.locator('.fab').click(); await p.locator('#hoja').getByText('pago único').waitFor(); await foto(p, '06-version-completa');
    await p.getByRole('button', { name: 'Desbloquear por 9,99 €' }).click(); await p.locator('#toast').getByText('Versión completa activada').waitFor();
    await p.locator('.fab').click(); await campo(p, 'nombre').fill('Plaza 12'); await guardar(p); assert.equal((await S(p)).inmuebles.length, 2); await p.locator('#hoja .cerrar').click();
  });
  await paso('hipoteca: cuadro y cuotas como gasto', async () => {
    await p.locator('[data-a=inmueble]', { hasText: 'Plaza 12' }).click(); await p.locator('[data-a=hipoteca]').click();
    await campo(p, 'importe').fill('20000'); await campo(p, 'tin').fill('3'); await campo(p, 'anios').fill('10'); await campo(p, 'inicio').fill(iso(mesAnt)); await guardar(p);
    await p.locator('#hoja').getByText(/Cuota 193,12/).waitFor(); const s = await S(p); assert.ok(s.gastos.filter((g) => g.categoria === 'financiacion').length >= 3);
    await p.locator('#hoja .cerrar').click();
  });
  await paso('panel, ajustes, ayuda e historial se pintan', async () => {
    await p.goto(URL0 + '#panel'); await p.getByText('Últimos 12 meses').waitFor(); await foto(p, '07-panel');
    await p.goto(URL0 + '#ajustes'); await p.locator('[data-a=misDatos]').click(); await campo(p, 'propietario').fill('Carlos'); await campo(p, 'dni').fill('42000000T'); await guardar(p);
    await p.locator('[data-a=historial]').click(); await p.locator('#hoja').getByText('Cobro anulado').first().waitFor(); await p.keyboard.press('Escape');
    await p.locator('.cab [data-a=ayuda]').click(); await p.locator('#hoja').getByText('Cómo funciona').waitFor(); await p.keyboard.press('Escape'); await foto(p, '08-ajustes');
  });
  await paso('mensaje de WhatsApp preparado con los datos', async () => {
    await p.goto(URL0 + '#cobros'); const av = p.locator('[data-a=avisar]'); if (await av.count()) { await av.first().click();
      const t = await p.locator('#msj').inputValue(); assert.match(t, /Hola Ana/); assert.match(t, /Necesito que me digas hoy|venció/); assert.match(t, /Carlos/); assert.doesNotMatch(t, /\{\w+\}/); await p.keyboard.press('Escape'); }
  });
  await paso('recibo en PDF tras cobrar', async () => {
    const id = await p.evaluate(() => { const s = window.__ma.S; return s.pagos.find((x) => !x.anulado).cargoId; });
    await p.evaluate((i) => { const b = document.createElement('button'); b.dataset.a = 'cobro'; b.dataset.id = i; document.body.appendChild(b); b.click(); b.remove(); }, id);
    const [d] = await Promise.all([p.waitForEvent('download'), p.locator('#hoja [data-a=reciboPdf]').click()]);
    assert.match(d.suggestedFilename(), /^recibo-2026-\d{4}\.pdf$|^recibo-\d{4}-\d{4}\.pdf$/); const b = fs.readFileSync(await d.path(), 'latin1');
    assert.ok(b.startsWith('%PDF') && /RECIBO DE ALQUILER/.test(b) && /Carlos/.test(b)); await p.keyboard.press('Escape');
  });
  await paso('documentos: adjuntar una foto al contrato y verla', async () => {
    await p.goto(URL0 + '#contratos'); await p.locator('[data-a=contrato]').first().click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwnwEJMDGgAhgDAJ0MAgEVIG8OAAAAAElFTkSuQmCC', 'base64');
    await p.locator('#hoja input[data-adjuntar]').setInputFiles({ name: 'contrato-firmado.png', mimeType: 'image/png', buffer: png });
    await p.locator('#hoja .doc').first().waitFor(); assert.equal((await S(p)).adjuntos.length, 1);
    await p.locator('#hoja .doc').first().click(); await p.locator('#docimg').waitFor(); await p.waitForFunction(() => document.querySelector('#docimg').src.startsWith('blob:'));
    await p.locator('#hoja [data-a=volverDoc]').click(); await p.locator('#hoja .doc').first().waitFor(); await foto(p, '09-documentos'); await p.keyboard.press('Escape');
  });
  await paso('depósito de la fianza en el Instituto Canario de la Vivienda', async () => {
    await p.goto(URL0 + '#inicio'); await p.locator('.tar', { hasText: 'Depositar la fianza' }).click();
    await campo(p, 'referencia').fill('ICV-123'); await guardar(p);
    await p.locator('#hoja').getByText(/Depositada en Instituto Canario/).waitFor(); assert.equal((await S(p)).contratos[0].deposito.referencia, 'ICV-123'); await p.keyboard.press('Escape');
  });
  await paso('extracto del banco: propone, revisas y apunta sin duplicar', async () => {
    const s0 = await S(p), c = s0.cargos.find((x) => x.importe - s0.pagos.filter((y) => y.cargoId === x.id && !y.anulado).reduce((a, y) => a + y.importe, 0) > 0);
    const pend = c.importe - s0.pagos.filter((y) => y.cargoId === c.id && !y.anulado).reduce((a, y) => a + y.importe, 0);
    const hoyIso = iso(new Date()), csv = `Fecha;Concepto;Importe\r\n${hoyIso.split('-').reverse().join('/')};TRANSFERENCIA ANA PEREZ GIL;${(pend / 100).toFixed(2).replace('.', ',')}\r\n${hoyIso.split('-').reverse().join('/')};COMPRA;-12,00\r\n`;
    await p.goto(URL0 + '#cobros'); await p.locator('[data-a=extracto]').first().click();
    await p.locator('#fext').setInputFiles({ name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await p.locator('#hoja').getByText('Revisa antes de apuntar').waitFor(); await foto(p, '10-extracto');
    await p.locator('#hoja [data-x=aplicar]').click(); await p.locator('#toast').getByText(/Apuntados 1 cobros/).waitFor();
    assert.ok((await S(p)).pagos.some((x) => x.metodo === 'Banco'));
    await p.locator('[data-a=extracto]').first().click(); await p.locator('#fext').setInputFiles({ name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await p.locator('#hoja').getByText(/1 ya estaban apuntados/).waitFor(); await p.keyboard.press('Escape');
  });
  await paso('informe para la Renta del año en curso, con PDF', async () => {
    await p.goto(URL0 + '#renta'); await p.getByText(/Ejercicio/).waitFor(); await p.locator('[data-a=anioRenta][data-d="1"]').click();
    await p.locator('.sec h2', { hasText: 'Piso Calle Real 4' }).waitFor(); await foto(p, '11-renta');
    await p.locator('[data-a=datosFiscales]').first().click(); await campo(p, 'valorCatastral').fill('80.000'); await campo(p, 'valorCatastralConstruccion').fill('50.000'); await guardar(p);
    await p.getByText(/Amortización del inmueble/).first().waitFor();
    const [d] = await Promise.all([p.waitForEvent('download'), p.locator('[data-a=rentaPdf]').click()]); assert.match(fs.readFileSync(await d.path(), 'latin1'), /Ejercicio/);
  });
  let copia;
  await paso('exportar CSV y copia de seguridad', async () => {
    await p.goto(URL0 + '#ajustes'); let [d] = await Promise.all([p.waitForEvent('download'), p.locator('[data-a=csv][data-t=Pagos]').click()]);
    const csv = fs.readFileSync(await d.path(), 'utf8'); assert.match(csv, /Transferencia devuelta/); assert.match(csv, /Ana Pérez Gil/);
    [d] = await Promise.all([p.waitForEvent('download'), p.locator('[data-a=copia]').click()]); copia = await d.path(); assert.equal(JSON.parse(fs.readFileSync(copia, 'utf8')).formato, 'mis-alquileres');
  });
  await paso('los datos siguen ahí al recargar', async () => { const antes = await S(p); await p.waitForTimeout(600); await p.reload(); await p.waitForFunction(() => window.__ma);
    const s = await S(p); assert.equal(s.pagos.length, antes.pagos.length); assert.equal(s.inmuebles.length, 2); assert.equal(s.pro, true); });
  await paso('teclado: el foco queda dentro del diálogo y Escape lo cierra', async () => {
    await p.goto(URL0 + '#inquilinos'); await p.locator('.fab').click(); for (let i = 0; i < 12; i++) await p.keyboard.press('Tab');
    assert.ok(await p.evaluate(() => document.getElementById('hoja').contains(document.activeElement))); await p.keyboard.press('Escape'); assert.ok(await p.locator('#hoja').isHidden());
  });
  await paso('recuperar la copia en una instalación nueva (sin versión completa)', async () => {
    const q = await pagina(); await q.goto(URL0 + '#ajustes'); await q.locator('[data-a=restaurar]').click(); await q.locator('#fcopia').setInputFiles(copia);
    await q.locator('#toast').getByText('Copia recuperada').waitFor(); const s = await S(q); assert.equal(s.inmuebles.length, 2); assert.equal(s.pro, false);
    await q.goto(URL0 + '#inmuebles'); await q.locator('.fab').click(); await q.locator('#hoja').getByText('Google Play').waitFor(); await q.context().close();
  });
  await paso('alta rápida en una instalación nueva, y la importación respeta el límite gratuito', async () => {
    const q = await pagina(); await q.getByRole('button', { name: 'Alta rápida' }).click();
    await campo(q, 'inmueble').fill('Plaza 7'); await campo(q, 'inquilino').fill('Eva Ruiz'); await campo(q, 'importe').fill('60'); await guardar(q);
    await q.locator('#toast').getByText(/recibos de cada mes/).waitFor(); let s = await S(q); assert.equal(s.contratos.length, 1); assert.equal(s.cargos.length, 1);
    await q.goto(URL0 + '#ajustes'); await q.locator('[data-a=importarCartera]').first().click();
    await q.locator('#fcar').setInputFiles({ name: 'cartera.csv', mimeType: 'text/csv', buffer: Buffer.from('Inmueble;Inquilino;Inicio;Renta\r\nTrastero 2;Luis;01/10/2026;40\r\n') });
    await q.locator('#hoja').getByText('Importación terminada').waitFor(); await q.locator('#hoja').getByText(/Fila 2/).waitFor();
    s = await S(q); assert.equal(s.inmuebles.length, 1); await q.context().close();
  });
  await paso('horizontal y tablet: sin desbordes', async () => {
    for (const [w, hh] of [[800, 390], [820, 1180], [360, 640]]) { await p.setViewportSize({ width: w, height: hh });
      for (const v of ['inicio', 'cobros', 'gastos', 'contratos', 'panel', 'ajustes', 'renta', 'mas']) { await p.goto(URL0 + '#' + v); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${v} desborda a ${w}px`); } }
  });
  assert.deepEqual(errores, [], 'errores en consola');
  console.log(`OK interfaz: ${pasos} pasos`);
} catch (e) { console.error('FALLO:', e.message, '\n', errores.join('\n')); process.exitCode = 1; }
finally { await nav.close(); srv.close(); }
