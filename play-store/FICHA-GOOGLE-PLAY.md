# Ficha de Google Play — Mis alquileres

Paquete: `com.itcanarias.misalquileres` · Categoría propuesta: **Empresa** · Gratuita con compra en la app.

## Textos

**Nombre (máx. 30):** Mis alquileres: cobros y gastos

**Descripción breve (máx. 80):** Controla tus alquileres: contratos, cobros mensuales, gastos y avisos.

**Descripción completa:**

Mis alquileres te ayuda a llevar al día lo que alquilas: plazas de garaje, trasteros, viviendas, habitaciones o locales.

🏠 INMUEBLES E INQUILINOS
• Ficha de cada inmueble, con su compra, valor e hipoteca
• Inquilinos con su teléfono para avisarles por WhatsApp

✍️ CONTRATOS
• Fechas, renta, día de cobro y fianza (recibida, devuelta o retenida)
• Subidas de renta desde el mes que elijas
• Aviso antes de que venza el contrato; renovar y finalizar

💶 COBROS
• Un recibo cada mes, creado automáticamente
• Marca «Cobrado» con un toque, o apunta pagos parciales
• Atrasos a la vista, con lo que debe cada inquilino
• Los cobros no se borran: se anulan y quedan en el historial

📉 GASTOS
• IBI, comunidad, seguro, suministros… con su periodicidad
• Quién paga cada cosa, y qué parte le cobras al inquilino
• Los recibos domiciliados se confirman cuando compruebas el cargo

📊 PANEL
• Ocupación, deuda, lo cobrado y lo gastado en 12 meses
• Rentabilidad por inmueble y deuda hipotecaria

🔔 AVISOS EN EL MÓVIL
• El día que toca cobrar, cuando hay atrasos y cuando vence un contrato

🔒 TUS DATOS, EN TU MÓVIL
• Sin cuentas, sin publicidad y sin enviar nada a servidores
• Copia de seguridad en un archivo y exportación a Excel (CSV)

Gratis con un inmueble. Con un pago único puedes añadir todos los que quieras, sin suscripción.

La app prepara los mensajes y abre WhatsApp: el envío lo haces tú. Las cifras son un resumen de lo que apuntas; no sustituyen a tu contabilidad ni a un asesor fiscal.

## Gráficos (en esta carpeta)

- `icono-512.png` — icono de la ficha
- `grafico-1024x500.png` — gráfico de funciones
- `capturas/` — capturas de móvil 1080×1920 (se regeneran con `npm run capturas`)

## Producto de pago

Monetizar › Productos › Productos de compra única › Crear:
- **ID del producto:** `version_completa` (tiene que ser exactamente este)
- **Nombre:** Versión completa · **Descripción:** Inmuebles sin límite, para siempre.
- Precio: el que decidas. Activarlo.

## Contenido de la aplicación (respuestas)

| Apartado | Respuesta |
|---|---|
| Política de privacidad | URL donde publiques `docs/privacidad.html` |
| Anuncios | No contiene anuncios |
| Acceso a la app | Todas las funciones están disponibles sin acceso especial (no hay inicio de sesión) |
| Clasificación de contenido | Cuestionario: utilidad/productividad, sin contenido sensible |
| Público objetivo | 18 años o más |
| Seguridad de los datos · ¿recopila o comparte datos? | **No**. Los datos se guardan solo en el dispositivo y no se transmiten |
| Eliminación de cuentas | No aplica: la app no permite crear cuentas |
| Funciones financieras | La app no ofrece funciones financieras (ni préstamos ni servicios de pago) |
| App de noticias / salud / gobierno | No |
| ID de publicidad | No lo usa |

Si Play Console formula alguna de estas preguntas de otra manera, el criterio es el mismo: la app no envía datos fuera del dispositivo.

## Permisos que verá Google

- Notificaciones (avisos de cobros y vencimientos; se piden al activarlos)
- Facturación de Google Play (la compra única)
- Arranque del dispositivo (para que los avisos programados sigan tras reiniciar)
- Internet: lo declara la plantilla; la app no hace conexiones propias
