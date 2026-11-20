// Genera los iconos de la app (web, Android y Google Play) a partir de un único dibujo. Uso: node tools/iconos.mjs
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path';
const R = path.resolve(import.meta.dirname, '..'), FONDO = '#24272c', ORO = '#e8b004';
const casa = (s, o) => `<g transform="translate(${o} ${o}) scale(${s})"><path d="M256 104 96 232v176h112V304h96v104h112V232z" fill="${ORO}"/><circle cx="256" cy="232" r="30" fill="${FONDO}"/><rect x="246" y="250" width="20" height="46" fill="${FONDO}"/></g>`;
const svg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${c}</svg>`;
const D = { cuadrado: svg(`<rect width="512" height="512" rx="112" fill="${FONDO}"/>${casa(1, 0)}`), pleno: svg(`<rect width="512" height="512" fill="${FONDO}"/>${casa(0.8, 51)}`),
  redondo: svg(`<circle cx="256" cy="256" r="256" fill="${FONDO}"/>${casa(0.82, 46)}`), frente: svg(casa(0.56, 113)) };
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }), p = await nav.newPage();
async function png(dib, lado, destino, extra) {
  fs.mkdirSync(path.dirname(destino), { recursive: true }); await p.setViewportSize({ width: extra ? extra.w : lado, height: extra ? extra.h : lado });
  await p.setContent(`<body style="margin:0;background:${extra ? FONDO : 'transparent'};display:grid;place-items:center;height:100vh">${extra ? extra.html : `<div style="width:${lado}px;height:${lado}px">${dib}</div>`}</body>`);
  await p.screenshot({ path: destino, omitBackground: !extra });
}
for (const [dpi, n] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  const d = path.join(R, 'android/app/src/main/res/mipmap-' + dpi);
  await png(D.cuadrado, n, path.join(d, 'ic_launcher.png')); await png(D.redondo, n, path.join(d, 'ic_launcher_round.png')); await png(D.frente, Math.round(n * 2.25), path.join(d, 'ic_launcher_foreground.png'));
}
await png(D.pleno, 192, path.join(R, 'www/icons/icon-192.png')); await png(D.pleno, 512, path.join(R, 'www/icons/icon-512.png')); await png(D.pleno, 512, path.join(R, 'play-store/icono-512.png'));
await png(null, 0, path.join(R, 'play-store/grafico-1024x500.png'), { w: 1024, h: 500, html: `<div style="display:flex;align-items:center;gap:44px;font-family:system-ui,sans-serif;color:#fff"><div style="width:230px">${D.frente.replace('viewBox="0 0 512 512"', 'viewBox="100 90 312 330"')}</div><div><div style="font-size:76px;font-weight:800">Mis alquileres</div><div style="font-size:34px;color:${ORO};margin-top:8px">Cobros, contratos y gastos, al día</div></div></div>` });
await nav.close(); console.log('Iconos generados');
