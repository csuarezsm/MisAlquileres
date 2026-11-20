# Mis alquileres

App Android (y web instalable) para llevar el control de alquileres: inmuebles, inquilinos, contratos, cobros, gastos, hipoteca, fianzas y avisos. © 2026 IT Canarias. Todos los derechos reservados.

- Los datos se guardan **solo en el dispositivo**. Sin cuentas ni servidor.
- Gratis con un inmueble; compra única `version_completa` en Google Play para quitar el límite.

## Estructura

```
www/            la app entera, sin librerías de terceros
  nucleo.js     reglas de negocio (importes en céntimos, nada se borra: se anula)
  plataforma.js guardado, archivos, notificaciones y compra
  app.js        interfaz · estilos.css · index.html · sw.js
android/        proyecto Capacitor 8 (API 36)
tests/          nucleo.test.cjs (reglas) y app.test.mjs (interfaz con Playwright)
tools/          iconos.mjs
play-store/     ficha, iconos y capturas para Google Play
docs/           política de privacidad
```

## Órdenes

```
npm ci
npm test            reglas + interfaz
npm run capturas    capturas 1080×1920 en play-store/capturas
npx cap sync android
```

## Publicar una versión

Subir la versión en cuatro sitios (el workflow lo comprueba): `package.json`, `versionName` y `versionCode` en `android/app/build.gradle`, `APP_VERSION` en `www/app.js` y `CACHE` en `www/sw.js`. Push a `main`: GitHub Actions prueba, firma y deja el `.aab` en la Release.

Guía completa: `GITHUB-PASOS.md`. Ficha de Play: `play-store/FICHA-GOOGLE-PLAY.md`.
