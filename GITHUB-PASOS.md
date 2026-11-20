# Mis alquileres: de este ZIP a Google Play, paso a paso

Para Windows con PowerShell. Cada paso dice **quién lo hace**, **qué escribir o pulsar** y **qué debes ver si ha salido bien**. Los nombres de los menús de Play Console pueden variar un poco; si no encuentras uno, busca la palabra clave en la barra de búsqueda de Play Console.

Tiempo aproximado: 1 hora el primer día, y después esperar la revisión de Google.

---

## Fase 0 · Preparar el PC (una sola vez)

### 0.1 Instalar Git y Java
Abre **PowerShell** (botón Inicio › escribe «PowerShell» › Intro) y ejecuta:

```powershell
winget install --id Git.Git -e
winget install --id EclipseAdoptium.Temurin.21.JDK -e
```

Cierra PowerShell y ábrelo de nuevo (para que reconozca los programas nuevos). Comprueba:

```powershell
git --version
keytool -help
```

✅ Bien si: el primero muestra `git version 2.…` y el segundo una lista de órdenes de keytool.
❌ Si `keytool` no se reconoce: reinicia el PC y vuelve a probar.

### 0.2 Descomprimir el proyecto
Descomprime `mis-alquileres-1.0.0.zip` en `C:\Proyectos\` (o donde guardes tus repos). Debe quedar `C:\Proyectos\MisAlquileres\` con las carpetas `www`, `android`, `tests`, `play-store`, `docs` y `.github` dentro.

> `.github` es una carpeta oculta: si no la ves en el Explorador, activa *Vista › Mostrar › Elementos ocultos*. Es importante que esté: contiene la compilación automática.

---

## Fase 1 · Subir el proyecto a GitHub

### 1.1 Crear el repositorio vacío
1. Entra en https://github.com/new con tu cuenta `csuarezsm`.
2. **Repository name:** `MisAlquileres`
3. Marca **Private**.
4. **No** marques «Add a README», ni .gitignore, ni licencia.
5. Pulsa **Create repository**.

✅ Bien si: ves una página casi vacía con instrucciones «…or push an existing repository from the command line».

### 1.2 Subir los archivos
En PowerShell:

```powershell
cd C:\Proyectos\MisAlquileres
git init
git add .
git commit -m "Mis alquileres 1.0.0"
git branch -M main
git remote add origin https://github.com/csuarezsm/MisAlquileres.git
git push -u origin main
```

Si es la primera vez que usas Git en este PC, antes del `commit` te pedirá tu nombre y correo:

```powershell
git config --global user.name "Carlos"
git config --global user.email "tu-correo@ejemplo.com"
```

Al hacer `push` se abrirá una ventana para iniciar sesión en GitHub: acepta.

✅ Bien si: al recargar la página del repositorio ves las carpetas. Ve a la pestaña **Actions**: habrá una compilación en marcha que **fallará en el paso «Clave de firma»**. Es normal: aún no le has dado la clave (paso 2).

---

## Fase 2 · Clave de firma y secretos

### 2.1 Crear la clave de subida
En PowerShell, en una carpeta **fuera** del proyecto (por ejemplo `C:\Claves`):

```powershell
mkdir C:\Claves -Force
cd C:\Claves
keytool -genkeypair -v -keystore misalquileres.jks -alias misalquileres -keyalg RSA -keysize 2048 -validity 10000
```

Te pregunta:
- **Contraseña del almacén:** invéntala (mínimo 6 caracteres) y apúntala. Si después pide una contraseña para la clave, pon **la misma**.
- **Nombre y apellidos:** IT Canarias · **Unidad:** Apps · **Organización:** IT Canarias · **Ciudad:** Arrecife · **Provincia:** Las Palmas · **País:** ES
- Confirma con `sí` (o `yes`).

✅ Bien si: existe `C:\Claves\misalquileres.jks`.

> ⚠️ **Guarda el archivo `.jks` y su contraseña en dos sitios seguros** (por ejemplo, tu gestor de contraseñas y una copia cifrada). Con la firma de Google Play, si la pierdes se puede pedir a Google una clave nueva, pero es un trámite lento. Nunca la subas al repositorio.

### 2.2 Copiar la clave en formato texto
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Claves\misalquileres.jks")) | Set-Clipboard
```
Ya está en el portapapeles (es un texto muy largo).

### 2.3 Crear los secretos en GitHub
En el repositorio: **Settings › Secrets and variables › Actions › New repository secret**.

| Name | Secret |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Pega (Ctrl+V) el texto del paso 2.2 |
| `ANDROID_KEYSTORE_PASSWORD` | La contraseña del paso 2.1 |

✅ Bien si: los dos aparecen en la lista «Repository secrets».

### 2.4 Permisos de la compilación
**Settings › Actions › General › Workflow permissions** › marca **Read and write permissions** › **Save**.

---

## Fase 3 · Compilar

### 3.1 Lanzar la compilación
**Actions › Android (AAB para Google Play)** (a la izquierda) › botón **Run workflow** › **Run workflow**.

Tarda entre 8 y 15 minutos. Hace, en orden: comprobar versiones, pasar las pruebas (reglas e interfaz), compilar, firmar y publicar.

✅ Bien si: aparece el círculo verde y en la portada del repositorio, a la derecha, **Releases › v1.0.0** con dos archivos:
- `mis-alquileres-play.aab` → para Google Play
- `mis-alquileres.apk` → para instalar directamente en tu móvil

❌ Si falla, abre el paso en rojo y mira:
- **«Pruebas»** → copia las últimas líneas y pásamelas.
- **«Clave de firma»** → el secreto `ANDROID_KEYSTORE_BASE64` está vacío o mal pegado: repite 2.2 y 2.3.
- **«Compilar AAB»** → busca la primera línea que diga `error:` o `What went wrong` y pásamela. Es el paso que no se pudo probar antes de dártelo.

---

## Fase 4 · Probar en tu móvil (antes de subir nada a Google)

### 4.1 Instalar
Descarga `mis-alquileres.apk` desde la Release **en el móvil**, ábrelo y permite «instalar apps de origen desconocido» si lo pide. Si Play Protect avisa, pulsa *Más detalles › Instalar de todas formas*.

### 4.2 Lista de comprobación

- [ ] Abre y muestra «Empieza por tu primer inmueble»
- [ ] Crear un inmueble tipo Vivienda: aparecen sus gastos habituales; pon importe a «Comunidad»
- [ ] Crear un contrato con un inquilino nuevo (pon tu propio teléfono) que empiece hace 2 meses: aparecen 3 recibos
- [ ] «Cobrado» en uno; abrir otro y apuntar un pago parcial; anular un cobro con motivo
- [ ] «Avisar»: abre WhatsApp con el texto relleno
- [ ] Más › Ajustes y copias › Avisos en el móvil: activar → Android pide permiso → aceptar
- [ ] Guardar una copia: se abre el menú de compartir (envíatela a ti mismo por correo o WhatsApp)
- [ ] Cerrar la app del todo (quitarla de recientes) y volver a abrir: los datos siguen
- [ ] Recuperar la copia que te enviaste: vuelve todo
- [ ] Añadir un segundo inmueble: sale la pantalla de versión completa
- [ ] Girar el móvil: se ve bien en horizontal
- [ ] Al día siguiente, a la hora elegida: llega el aviso si había algo que cobrar

> En este APK **la compra no funciona**: Google solo permite comprar en apps instaladas desde Play. Se prueba en la fase 7.

Si algo falla, haz una captura y dime qué pulsaste.

Cuando acabes, **Más › Ajustes y copias › Borrar todos los datos** para dejarla limpia.

---

## Fase 5 · Política de privacidad pública

Google pide una URL pública. El repositorio es privado, así que publícala en otro sitio. Elige una opción:

**A · En la web de IT Canarias (recomendada).** Sube `docs/privacidad.html` a tu web, por ejemplo como
`https://itcanarias.com/misalquileres/privacidad.html`.

**B · En GitHub Pages con un repositorio público aparte.**
1. Crea el repositorio **público** `csuarezsm/MisAlquileres-web`, marcando «Add a README».
2. *Add file › Upload files* › sube `docs/privacidad.html` › *Commit changes*.
3. *Settings › Pages › Deploy from a branch › main / (root) › Save*.
4. La URL será `https://csuarezsm.github.io/MisAlquileres-web/privacidad.html` (tarda unos minutos).

✅ Bien si: abres la URL desde el móvil, sin iniciar sesión, y se ve la política.

---

## Fase 6 · Crear la app en Play Console

Entra en https://play.google.com/console con la cuenta de la organización **IT Canarias**.

### 6.1 Crear la aplicación
**Inicio › Crear aplicación**:
- Nombre: `Mis alquileres`
- Idioma predeterminado: Español (España)
- Aplicación o juego: **Aplicación**
- Gratis o de pago: **Gratis** (la compra va dentro de la app)
- Acepta las declaraciones › **Crear aplicación**

### 6.2 Contenido de la aplicación
Menú **Política › Contenido de la aplicación** (o la lista «Configura tu aplicación» del Panel). Responde con la tabla de `play-store/FICHA-GOOGLE-PLAY.md`. Lo principal:

| Apartado | Qué poner |
|---|---|
| Política de privacidad | La URL de la fase 5 |
| Anuncios | No, mi aplicación no contiene anuncios |
| Acceso a la aplicación | Todas las funciones están disponibles sin restricciones |
| Clasificación de contenido | Categoría «Todas las demás tipos de aplicaciones»; responde **No** a todo (violencia, apuestas, contenido generado por usuarios compartido, etc.) |
| Público objetivo | Solo **18 años o más** |
| Seguridad de los datos | ¿Recoge o comparte datos de usuario? **No** |
| Funciones financieras | Mi aplicación no ofrece funciones financieras |
| Aplicación gubernamental / de salud / de noticias | No |
| ID de publicidad | No usa el ID de publicidad |

### 6.3 Ficha de Play Store
**Crecimiento › Presencia en Play Store › Ficha principal**:
- **Nombre:** `Mis alquileres: cobros y gastos`
- **Descripción breve y completa:** copia las de `play-store/FICHA-GOOGLE-PLAY.md`
- **Icono:** `play-store/icono-512.png`
- **Gráfico de funciones:** `play-store/grafico-1024x500.png`
- **Capturas del teléfono:** las 7 de `play-store/capturas/`
- **Configuración de la ficha:** categoría **Empresa**, correo de contacto `info@itcanarias.com`, sitio web `https://itcanarias.com`

### 6.4 Primera versión en prueba interna (subida a mano)
La **primera vez** el `.aab` se sube a mano: Google no deja crear la primera versión desde GitHub.

1. **Probar y publicar › Pruebas › Prueba interna › Crear nueva versión**.
2. Si pregunta por la **firma de aplicaciones de Google Play**: acepta la opción recomendada («Usar clave generada por Google»). Tu `.jks` queda como clave de subida.
3. Sube `mis-alquileres-play.aab` (descárgalo antes de la Release en el PC).
4. Nombre de la versión: `1.0.0` · Notas: `Primera versión`.
5. **Siguiente › Guardar y publicar**.
6. Pestaña **Testers**: crea una lista con tu correo de Google (el del móvil) y guarda. Copia el **enlace para unirse**.

✅ Bien si: la versión aparece como «Disponible para testers internos».

### 6.5 Crear el producto de pago
Ahora que ya hay un `.aab` con facturación, **Monetizar con Play › Productos › Productos de compra única › Crear producto**:
- **ID del producto:** `version_completa` ← exactamente así; la app busca este nombre
- **Nombre:** Versión completa
- **Descripción:** Inmuebles sin límite, para siempre.
- **Precio:** el que decidas (Google lo convierte a cada país)
- Guarda y **Activa** el producto.

✅ Bien si: el producto aparece como **Activo**.

> Si al crear el producto Play Console dice que necesitas un perfil de pagos o aceptar condiciones, complétalo: es el mismo de la cuenta de organización.

---

## Fase 7 · Probar la compra de verdad

### 7.1 Darte de alta como probador de licencias
**Configuración (rueda, menú de la cuenta, no de la app) › Prueba de licencias** › añade tu correo de Google › **Guardar**. Así las compras de prueba no se cobran.

### 7.2 Instalar desde Play
1. En el móvil, **desinstala** el APK de la fase 4 (si no, Play no podrá instalar encima: la firma es distinta).
2. Abre el **enlace para unirse** de la fase 6.4 › *Aceptar invitación* › *Descargar en Google Play* › **Instalar**. Puede tardar hasta una hora en aparecer.

### 7.3 Comprar
1. Crea un inmueble, después intenta crear el segundo.
2. Debe verse **«Desbloquear por X €»** con tu precio real (si dice «Google Play no está disponible», espera un rato: el producto tarda en propagarse).
3. Pulsa: sale la hoja de pago de Google con el aviso «Pedido de prueba» › compra con el método de prueba que siempre se aprueba.

✅ Bien si: aparece «Versión completa activada» y puedes crear el segundo inmueble.

### 7.4 Recuperar la compra
Desinstala, vuelve a instalar desde Play, intenta añadir el segundo inmueble › **«Ya la compré: recuperar la compra»**.

✅ Bien si: se activa sin volver a pagar. (Al arrancar, la app también lo comprueba sola.)

---

## Fase 8 · Subidas automáticas a Play (como con Martín)

Opcional, pero te ahorra subir cada versión a mano. Usa la misma cuenta de servicio que ya configuraste para Martín.

1. **Play Console › Usuarios y permisos**: busca el correo de la cuenta de servicio. Si sus permisos son solo para Martín, pulsa **Añadir aplicación**, elige *Mis alquileres* y dale permiso para **publicar en pruebas** (o los mismos que tiene en Martín).
2. **GitHub › MisAlquileres › Settings › Secrets and variables › Actions › New repository secret**:
   - Name: `PLAY_SERVICE_ACCOUNT_JSON`
   - Secret: **el contenido completo** del archivo `.json` de la cuenta de servicio (el mismo que pusiste en el repo de Martín; ábrelo con el Bloc de notas y copia todo).

Desde entonces, cada versión nueva que compile GitHub se sube sola a **prueba interna**.

❌ Si la subida falla con *«Only releases with status draft may be created on draft app»*: en *Settings › Secrets and variables › Actions › pestaña **Variables*** crea `PLAY_STATUS` con valor `draft`. Cuando la app ya esté publicada en producción, borra esa variable.

---

## Fase 9 · Publicar en producción

1. **Panel** de la app: comprueba que no queda ninguna tarea de «Configura tu aplicación» sin marcar.
2. **Probar y publicar › Producción › Países o regiones**: añade **España** (y los que quieras).
3. **Prueba interna › la versión 1.0.0 › Promocionar versión › Producción**.
4. Notas de la versión: `Primera versión de Mis alquileres.` › **Siguiente › Enviar a revisión**.

Si Play Console te pide antes una **prueba cerrada con probadores durante 14 días**, hazla igual que con Martín. Las cuentas de organización normalmente no la necesitan.

✅ Bien si: el estado pasa a «En revisión». Google suele tardar de unas horas a unos días; te avisará por correo.

---

## Para cada versión nueva

1. Cambia el número en estos cinco sitios (por ejemplo, de `1.0.0` a `1.0.1`):

| Archivo | Qué cambiar |
|---|---|
| `package.json` | `"version": "1.0.1"` |
| `android/app/build.gradle` | `versionCode 2` (suma 1 siempre) y `versionName "1.0.1"` |
| `www/app.js` | `const APP_VERSION = '1.0.1';` |
| `www/sw.js` | `const CACHE = 'misalquileres-v1.0.1';` |

2. ```powershell
   git add .
   git commit -m "Versión 1.0.1"
   git push
   ```
3. GitHub prueba, compila, crea la Release y, si hiciste la fase 8, la sube a prueba interna. Después la promocionas a producción en Play Console.

Si te olvidas de alguno de los números, la compilación se para en «Comprobar que la versión coincide» y te dice cuál falta.

---

## Resumen de lo que debes guardar

| Qué | Dónde |
|---|---|
| `misalquileres.jks` + contraseña | Gestor de contraseñas y copia segura |
| Secretos de GitHub | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON` |
| URL de la privacidad | La de la fase 5 |
| ID del producto | `version_completa` |
| Paquete | `com.itcanarias.misalquileres` |
