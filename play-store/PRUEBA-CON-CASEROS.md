# Prueba con caseros reales antes de publicar

Las cuentas de desarrollador de **organización** (como la de IT Canarias) no tienen la obligación de hacer una prueba cerrada con 12 testers durante 14 días, que Google solo exige a las cuentas personales. Aun así, conviene probar la app con caseros de verdad antes de abrirla a todo el mundo. Esta guía lo organiza en dos semanas.

## 1. A quién invitar (10–20 personas)

- 3–4 con **una plaza de garaje o un trastero** (lo más sencillo).
- 3–4 con **una o dos viviendas** (contratos, fianza, Renta).
- 2–3 que alquilen **por habitaciones** (reparto de gastos).
- 2–3 con **locales** (factura con IGIC y retención).
- 1–2 que lleven los alquileres **en pareja** (copropiedad).
- Mezcla de móviles: algún Samsung, Xiaomi y Pixel, y uno con Android 10 o anterior si es posible.

## 2. Montar la prueba en Play Console

1. Play Console › Mis alquileres › **Probar y publicar › Pruebas › Prueba interna** (hasta 100 testers, sin revisión de Google; sale en minutos).
2. **Testers › Crear lista de correo**: «Caseros prueba», con los correos de Gmail de los testers.
3. **Crear versión** › sube el `.aab` de la última Release de GitHub (o deja que lo suba el flujo automático si tienes el secreto `PLAY_SERVICE_ACCOUNT_JSON`).
4. Copia el **enlace de participación** y mándalo a los testers. Ellos lo abren, pulsan «Aceptar» e instalan desde Google Play como cualquier app.
5. Para que puedan probar la versión completa sin pagar: Play Console › **Configuración › Pruebas de licencias** › añade sus correos. Las compras de esas cuentas son de prueba y no se cobran.

## 3. Qué tiene que probar cada uno (lista para enviarles)

**Primera semana: su día a día**
- [ ] Dar de alta sus inmuebles, inquilinos y contratos (alta rápida o importando el Excel).
- [ ] Activar los avisos y comprobar que llega el aviso del día de cobro, y que el botón «Cobrado» de la notificación funciona.
- [ ] Marcar cobros, cobrar a medias, deshacer y anular.
- [ ] Enviar un recordatorio y un recibo en PDF por WhatsApp.
- [ ] Importar el extracto de **su banco** (Norma 43 si su banco lo da; si no, Excel o CSV). Anotar el banco y si casó bien los movimientos.
- [ ] Activar la **huella o el PIN** y comprobar que pide desbloquear al volver a la app.
- [ ] Poner el **widget** en la pantalla de inicio.

**Segunda semana: lo menos frecuente**
- [ ] Activar las **copias en Google Drive** y comprobar que aparece la carpeta «Mis alquileres» en su Drive.
- [ ] Recuperar una copia (mejor en otro móvil o tras reinstalar).
- [ ] Generar el **contrato para firmar** y un **acta de entrada** con fotos y firma; revisar el PDF y el Word.
- [ ] Quien tenga locales: comprobar la **factura** con IGIC/IVA y retención y el resumen trimestral.
- [ ] Sacar el **informe para la Renta** del año pasado y compararlo con lo que declararon.
- [ ] Cambiar el **tamaño de letra** a «Muy grande» y el **idioma**, y comprobar que nada se corta.

## 4. Cómo recoger lo que encuentren

- Un formulario de Google con cinco preguntas: móvil y versión de Android, qué intentaba hacer, qué pasó, captura de pantalla, y una nota del 1 al 10.
- Un grupo de WhatsApp para las dudas del día a día.
- Lo urgente (datos que no cuadran, algo que se cierra), por correo a info@itcanarias.com con capturas.

## 5. Revisión por un asesor fiscal

Pide a un asesor que revise con datos reales: el informe para la Renta (reducciones del 50/60/70/90 %, amortización, gastos con límite y arrastre de 4 años, imputación de días vacíos), la factura con IGIC/IVA y retención, y el resumen trimestral. Apunta lo que corrija para ajustar los cálculos.

## 6. Cuándo pasar a producción

- Sin fallos graves abiertos y con los avisos, la compra y las copias en Drive comprobados en al menos tres marcas de móvil distintas.
- Nota media de 8 o más en el formulario.
- Después: Play Console › **Producción › Crear versión**, con la ficha en los cinco idiomas (`FICHA-*.md`) y sus capturas (`capturas/<idioma>/`).
