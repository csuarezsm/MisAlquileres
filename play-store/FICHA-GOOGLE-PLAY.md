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
• Aviso de la subida anual (IRAV o IPC) con el cálculo y el mensaje al inquilino
• Depósito de la fianza y plazo para devolverla

💶 COBROS
• Un recibo cada mes, creado automáticamente
• Marca «Cobrado» con un toque, incluso desde la notificación
• Recibo en PDF numerado y compacto (medio folio), en el idioma del inquilino, para enviarlo por WhatsApp
• Recordatorios al inquilino a los 3 y a los 10 días de retraso
• Importa el extracto del banco (Norma 43, Excel o CSV) y la app casa cada transferencia o Bizum con su recibo
• Los cobros no se borran: se anulan y quedan en el historial

🧾 DECLARACIÓN DE LA RENTA
• Informe por inmueble: ingresos, gastos deducibles, intereses, amortización, reducción e imputación de días vacíos
• En PDF o Excel, listo para trasladar a Renta Web o a tu asesor
• Inmuebles con varios titulares (por ejemplo, un matrimonio): informe por titular

📎 DOCUMENTOS
• Contrato firmado, DNI, facturas y fotos del estado del inmueble, guardados en cada ficha

📉 GASTOS
• IBI, comunidad, seguro, suministros… con su periodicidad
• Quién paga cada cosa, y qué parte le cobras al inquilino
• Alquiler por habitaciones: los suministros se reparten entre los inquilinos
• Los recibos domiciliados se confirman cuando compruebas el cargo

📊 PANEL
• Ocupación, deuda, lo cobrado y lo gastado en 12 meses
• Rentabilidad por inmueble y deuda hipotecaria

🔔 AVISOS EN EL MÓVIL
• El día que toca cobrar, cuando hay atrasos y cuando vence un contrato

📑 INFORMES Y LISTADOS
• Todo en Excel o PDF: inmuebles, inquilinos, contratos, recibos, cobros, deudas, gastos, fianzas, hipoteca, rentabilidad e historial
• Filtros por inmueble, inquilino y fechas, o todo en un único Excel
• Extracto de cada inquilino (lo pagado y lo que debe) en PDF
• Todos los documentos y fotos en un ZIP

🎨 A TU GUSTO
• Tema claro u oscuro, seis colores, cuatro tamaños de letra y alto contraste
• En español, inglés, alemán, francés e italiano; cada inquilino recibe sus mensajes y recibos en su idioma

🔒 TUS DATOS, EN TU MÓVIL
• Sin cuentas, sin publicidad y sin enviar nada a nuestros servidores
• Bloqueo con la huella o el PIN del móvil
• Copias de seguridad automáticas (cada día, semana o mes) en el móvil y, si quieres, en tu Google Drive, con los documentos y fotos

Empieza en un minuto con el alta rápida, importa tus inmuebles desde Excel o pruébala antes con datos de ejemplo.

Gratis con un inmueble. Con un pago único puedes añadir todos los que quieras, sin suscripción.

La app prepara los mensajes y abre WhatsApp: el envío lo haces tú. Las cifras y el informe de la Renta son orientativos: no sustituyen a tu contabilidad ni a un asesor fiscal.

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
| Seguridad de los datos · ¿recopila o comparte datos? | **No**. Los datos se guardan en el dispositivo. La única salida es la copia que el propio usuario activa hacia **su** Google Drive: va directa del móvil a su cuenta, IT Canarias nunca la recibe, y es una transferencia iniciada por el usuario (exenta de declararse como «compartir»). Se cifra en tránsito (HTTPS). |
| Eliminación de cuentas | No aplica: la app no permite crear cuentas |
| Funciones financieras | La app no ofrece funciones financieras (ni préstamos ni servicios de pago) |
| App de noticias / salud / gobierno | No |
| ID de publicidad | No lo usa |

Si Play Console formula alguna de estas preguntas de otra manera, el criterio es el mismo: IT Canarias no recibe ningún dato; solo salen del móvil cuando el usuario los comparte o activa su propio Google Drive.

## Permisos que verá Google

- Notificaciones (avisos de cobros y vencimientos; se piden al activarlos)
- Facturación de Google Play (la compra única)
- Google Drive, permiso `drive.file` (solo si el usuario activa las copias en Drive; solo ve los archivos que crea la app)
- Almacenamiento, solo en Android 10 o anterior (para guardar las copias en Documentos)
- Arranque del dispositivo (para que los avisos programados sigan tras reiniciar)
- Internet: lo declara la plantilla; la app no hace conexiones propias
