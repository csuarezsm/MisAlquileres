// Capturas para Google Play en los cinco idiomas: node tools/capturas.mjs [es en de fr it]
// Salen en play-store/capturas/<idioma>/ a 1080×1920, con los datos de ejemplo de la app.
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const WWW = path.resolve('www'), T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(WWW, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
await new Promise((ok) => srv.listen(0, ok)); const U = `http://127.0.0.1:${srv.address().port}/`;
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const idiomas = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'fr', 'it'];
for (const l of idiomas) {
  const out = path.resolve('play-store/capturas', l); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const ctx = await nav.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: l });
  await ctx.addInitScript((lg) => { localStorage.setItem('ma.idioma', lg); }, l);
  const p = await ctx.newPage(); await p.goto(U + '#inicio'); await p.waitForFunction(() => window.__ma);
  await p.locator('[data-a=ejemplo]').click(); await p.locator('[data-a=finEjemplo]').waitFor();
  // Sin el aviso de «datos de ejemplo» en las capturas
  await p.evaluate(() => { const s = window.__ma.S; delete s.ejemplo; s.pro = true; s.ajustes.dni = '42000000T'; window.__ma.pinta(); });
  let n = 0; const foto = async (nombre) => { await p.waitForTimeout(250); await p.evaluate(() => { const x = document.getElementById('toast'); if (x) x.hidden = true; }); await p.screenshot({ path: path.join(out, `${String(++n).padStart(2, '0')}-${nombre}.png`) }); };
  await p.goto(U + '#inicio'); await foto('inicio');
  await p.locator('[data-a=cobrarDeuda]').first().click(); await foto('cobrar'); await p.keyboard.press('Escape');
  await p.goto(U + '#cobros'); await foto('cobros');
  await p.goto(U + '#contratos'); await p.locator('[data-a=contrato]').first().click(); await foto('contrato'); await p.keyboard.press('Escape');
  await p.goto(U + '#panel'); await foto('panel');
  await p.goto(U + '#informes'); await foto('informes');
  await p.goto(U + '#apariencia'); await foto('apariencia');
  await ctx.close(); console.log(l, n, 'capturas');
}
await nav.close(); srv.close();
