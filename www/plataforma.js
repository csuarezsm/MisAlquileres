/* Mis alquileres — lo que depende del dispositivo: guardado, archivos, avisos y compra. © 2026 IT Canarias. */
(function () {
  'use strict';
  const C = window.Capacitor, NATIVO = !!(C && C.isNativePlatform && C.isNativePlatform()), P = (C && C.Plugins) || {};

  // ---------- Guardado local (IndexedDB; los datos no salen del dispositivo) ----------
  function bd() {
    return new Promise((ok, mal) => {
      const r = indexedDB.open('misalquileres', 2);
      r.onupgradeneeded = () => { for (const n of ['kv', 'adj']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
      r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
    });
  }
  const Almacen = {
    async cargar(clave = 'estado') {
      try { const d = await bd(); return await new Promise((ok, mal) => { const q = d.transaction('kv').objectStore('kv').get(clave); q.onsuccess = () => ok(q.result || null); q.onerror = () => mal(q.error); }); }
      catch (e) { return localStorage.getItem('ma.' + clave); }
    },
    async guardar(txt, clave = 'estado') {
      try { const d = await bd(); await new Promise((ok, mal) => { const t = d.transaction('kv', 'readwrite'); if (txt == null) t.objectStore('kv').delete(clave); else t.objectStore('kv').put(txt, clave); t.oncomplete = ok; t.onerror = () => mal(t.error); }); }
      catch (e) { if (txt == null) localStorage.removeItem('ma.' + clave); else localStorage.setItem('ma.' + clave, txt); }
    },
  };

  async function idb(store, modo, fn) {
    const d = await bd();
    return new Promise((ok, mal) => { const tx = d.transaction(store, modo), q = fn(tx.objectStore(store)); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => mal(tx.error); });
  }
  const aBase64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

  // ---------- Archivos: compartir, descargar y copia automática ----------
  const Archivos = {
    async compartir(nombre, texto, mime) {
      if (NATIVO && P.Filesystem && P.Share) {
        const r = await P.Filesystem.writeFile({ path: nombre, data: texto, directory: 'CACHE', encoding: 'utf8' });
        await P.Share.share({ title: nombre, files: [r.uri] });
        return;
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: mime || 'text/plain' })); a.download = nombre;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    // Comparte un archivo binario (PDF): en Android abre el menú de compartir (WhatsApp, correo, Drive…)
    async compartirBytes(nombre, bytes, mime, texto) {
      if (NATIVO && P.Filesystem && P.Share) {
        const r = await P.Filesystem.writeFile({ path: nombre, data: aBase64(bytes), directory: 'CACHE' });
        await P.Share.share({ title: nombre, text: texto || undefined, files: [r.uri], dialogTitle: 'Enviar ' + nombre });
        return;
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = nombre;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    // Comparte un texto como texto (no como archivo): WhatsApp lo pone en el cuadro de mensaje
    async compartirTexto(texto) {
      if (NATIVO && P.Share) return P.Share.share({ text: texto, dialogTitle: 'Enviar mensaje' });
      if (navigator.share) return navigator.share({ text: texto });
      await navigator.clipboard.writeText(texto);
      return 'copiado';
    },
    // Copias programadas: se guardan en Documentos/MisAlquileres del propio móvil y se conservan las últimas «guardar»
    enMovil: NATIVO && !!P.Filesystem,
    async copiaEnMovil(nombre, bytes, guardar) {
      if (!this.enMovil) throw new Error('Solo en la app de Android');
      await P.Filesystem.writeFile({ path: 'MisAlquileres/' + nombre, data: aBase64(bytes), directory: 'DOCUMENTS', recursive: true });
      const l = await this.copiasEnMovil();
      for (const x of l.slice(Math.max(1, guardar || 5))) { try { await P.Filesystem.deleteFile({ path: 'MisAlquileres/' + x.nombre, directory: 'DOCUMENTS' }); } catch (e) { /* ya no estaba */ } }
    },
    async copiasEnMovil() {
      if (!this.enMovil) return [];
      try {
        const r = await P.Filesystem.readdir({ path: 'MisAlquileres', directory: 'DOCUMENTS' });
        return (r.files || []).map((f) => (typeof f === 'string' ? { name: f } : f)).filter((f) => /^mis-alquileres-\d{4}-\d{2}-\d{2}.*\.(zip|json)$/.test(f.name))
          .map((f) => ({ nombre: f.name, tam: f.size || 0 })).sort((a, b) => b.nombre.localeCompare(a.nombre));
      } catch (e) { return []; }
    },
    async leerDeMovil(nombre) { const r = await P.Filesystem.readFile({ path: 'MisAlquileres/' + nombre, directory: 'DOCUMENTS' }); const s = atob(r.data), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; },
    async compartirDeMovil(nombre) { const r = await P.Filesystem.getUri({ path: 'MisAlquileres/' + nombre, directory: 'DOCUMENTS' }); return P.Share.share({ title: nombre, files: [r.uri], dialogTitle: 'Enviar ' + nombre }); },
  };

  // ---------- Documentos y fotos (se guardan dentro de la app, no en la galería) ----------
  async function reducirFoto(file) {
    try {
      const img = await createImageBitmap(file), max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
      return b && b.size < file.size ? b : file;
    } catch (e) { return file; }
  }
  const Adjuntos = {
    async guardar(file) {
      const foto = /^image\//.test(file.type) && !/gif|svg/.test(file.type), blob = foto ? await reducirFoto(file) : file;
      if (blob.size > 15 * 1024 * 1024) throw Object.assign(new Error('El archivo pesa más de 15 MB'), { code: 'DATOS' });
      const ext = foto ? 'jpg' : ((file.name.match(/\.(\w{1,5})$/) || [])[1] || 'bin').toLowerCase();
      const archivo = `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, bytes = new Uint8Array(await blob.arrayBuffer());
      if (NATIVO && P.Filesystem) await P.Filesystem.writeFile({ path: 'adjuntos/' + archivo, data: aBase64(bytes), directory: 'DATA', recursive: true });
      else await idb('adj', 'readwrite', (o) => o.put(new Blob([bytes], { type: foto ? 'image/jpeg' : file.type }), archivo));
      return { archivo, mime: foto ? 'image/jpeg' : file.type || 'application/octet-stream', tam: bytes.length, nombre: file.name || archivo };
    },
    async escribir(archivo, bytes, mime) {
      if (NATIVO && P.Filesystem) await P.Filesystem.writeFile({ path: 'adjuntos/' + archivo, data: aBase64(bytes), directory: 'DATA', recursive: true });
      else await idb('adj', 'readwrite', (o) => o.put(new Blob([bytes], { type: mime || 'application/octet-stream' }), archivo));
    },
    async url(archivo) {
      if (NATIVO && P.Filesystem) { const r = await P.Filesystem.getUri({ path: 'adjuntos/' + archivo, directory: 'DATA' }); return C.convertFileSrc(r.uri); }
      const b = await idb('adj', 'readonly', (o) => o.get(archivo)); return b ? URL.createObjectURL(b) : null;
    },
    async leer(archivo) {
      if (NATIVO && P.Filesystem) { const r = await P.Filesystem.readFile({ path: 'adjuntos/' + archivo, directory: 'DATA' }); const s = atob(r.data), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
      const bl = await idb('adj', 'readonly', (o) => o.get(archivo)); return bl ? new Uint8Array(await bl.arrayBuffer()) : null;
    },
    async compartir(a) {
      if (NATIVO && P.Filesystem && P.Share) { const r = await P.Filesystem.getUri({ path: 'adjuntos/' + a.archivo, directory: 'DATA' }); return P.Share.share({ title: a.nombre, files: [r.uri] }); }
      const u = await this.url(a.archivo); if (u) window.open(u, '_blank');
    },
    async borrar(archivo) {
      try { if (NATIVO && P.Filesystem) await P.Filesystem.deleteFile({ path: 'adjuntos/' + archivo, directory: 'DATA' }); else await idb('adj', 'readwrite', (o) => o.delete(archivo)); } catch (e) { /* ya no estaba */ }
    },
  };

  // ---------- Google Drive (opcional): las copias van a una carpeta «Mis alquileres» del Drive del usuario ----------
  // Permiso drive.file: la app solo ve los archivos que ella misma crea. Sin servidores intermedios.
  const NDrive = NATIVO ? (P.Drive || (C.registerPlugin ? C.registerPlugin('Drive') : null)) : null;
  const GAPI = 'https://www.googleapis.com/drive/v3', GUP = 'https://www.googleapis.com/upload/drive/v3';
  const Drive = {
    disponible: !!NDrive,
    token: null, caduca: 0, idCarpeta: null,
    async conectar(interactivo) { const r = await NDrive.autorizar({ interactivo: !!interactivo }); this.token = r.token; this.caduca = Date.now() + 45 * 60000; return r.token; },
    async api(url, op, reintento) {
      if (!this.token || Date.now() > this.caduca) await this.conectar(false);
      const o = op || {}, r = await fetch(url, { ...o, headers: { ...(o.headers || {}), Authorization: 'Bearer ' + this.token } });
      if (r.status === 401 && !reintento) { this.token = null; return this.api(url, op, true); }
      if (!r.ok) throw Object.assign(new Error('Google Drive ha respondido ' + r.status), { status: r.status });
      return r;
    },
    async cuenta() { return ((await (await this.api(GAPI + '/about?fields=user(emailAddress)')).json()).user || {}).emailAddress || ''; },
    async carpeta() {
      if (this.idCarpeta) return this.idCarpeta;
      const q = encodeURIComponent("name='Mis alquileres' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      const l = await (await this.api(`${GAPI}/files?q=${q}&fields=files(id)&spaces=drive`)).json();
      if (l.files && l.files.length) return (this.idCarpeta = l.files[0].id);
      const c = await (await this.api(GAPI + '/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Mis alquileres', mimeType: 'application/vnd.google-apps.folder' }) })).json();
      return (this.idCarpeta = c.id);
    },
    async lista() {
      const id = await this.carpeta(), q = encodeURIComponent(`'${id}' in parents and trashed=false`);
      const l = await (await this.api(`${GAPI}/files?q=${q}&orderBy=name desc&pageSize=100&fields=files(id,name,size)`)).json();
      return (l.files || []).filter((f) => /^mis-alquileres-\d{4}-\d{2}-\d{2}.*\.(zip|json)$/.test(f.name)).map((f) => ({ id: f.id, nombre: f.name, tam: Number(f.size) || 0 }));
    },
    async subir(nombre, bytes, mime, guardar) {
      const id = await this.carpeta(), meta = JSON.stringify({ name: nombre, parents: [id] });
      for (const f of (await this.lista()).filter((x) => x.nombre === nombre)) await this.api(`${GAPI}/files/${f.id}`, { method: 'DELETE' });
      let hecho = false;
      if (bytes.length > 4 * 1024 * 1024) {
        const ini = await this.api(GUP + '/files?uploadType=resumable', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime }, body: meta });
        const loc = ini.headers.get('Location');
        if (loc) { const r = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': mime }, body: bytes }); if (!r.ok) throw new Error('Google Drive ha respondido ' + r.status); hecho = true; }
      }
      if (!hecho) {
        const b = 'ma' + Date.now();
        const cuerpo = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, bytes, `\r\n--${b}--`]);
        await this.api(GUP + '/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: cuerpo });
      }
      for (const f of (await this.lista()).slice(Math.max(1, guardar || 7))) { try { await this.api(`${GAPI}/files/${f.id}`, { method: 'DELETE' }); } catch (e) { /* se borrará la próxima vez */ } }
    },
    async bajar(idArchivo) { return new Uint8Array(await (await this.api(`${GAPI}/files/${idArchivo}?alt=media`)).arrayBuffer()); },
    async desconectar() {
      const t = this.token; this.token = null; this.idCarpeta = null;
      if (t) { try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t), { method: 'POST' }); } catch (e) { /* sin conexión: el acceso caduca solo */ } }
    },
  };

  // ---------- Bloqueo con la huella o el PIN del propio móvil ----------
  const NBloq = NATIVO ? (P.Bloqueo || (C.registerPlugin ? C.registerPlugin('Bloqueo') : null)) : null;
  const Bloqueo = {
    disponible: !!NBloq,
    async estado() { try { return NBloq ? await NBloq.disponible() : { disponible: false, motivo: 'NO_DISPONIBLE' }; } catch (e) { return { disponible: false, motivo: 'NO_DISPONIBLE' }; } },
    autenticar(titulo) { return NBloq.autenticar({ titulo }); },
    proteger(activo) { if (NBloq) NBloq.proteger({ activo: !!activo }).catch(() => {}); },
  };

  // ---------- Widget de la pantalla de inicio (solo Android) ----------
  const NWidget = NATIVO ? (P.Widget || (C.registerPlugin ? C.registerPlugin('Widget') : null)) : null;
  let ultimoWidget = '';
  const Widget = {
    disponible: !!NWidget,
    actualizar(d) { if (!NWidget) return; const k = JSON.stringify(d); if (k === ultimoWidget) return; ultimoWidget = k; NWidget.actualizar(d).catch(() => { ultimoWidget = ''; }); },
  };

  // ---------- Avisos del móvil (notificaciones locales, sin servidor) ----------
  const Avisos = {
    disponible: NATIVO && !!P.LocalNotifications,
    async permiso(pedir) {
      if (!this.disponible) return false;
      let r = await P.LocalNotifications.checkPermissions();
      if (r.display !== 'granted' && pedir) r = await P.LocalNotifications.requestPermissions();
      return r.display === 'granted';
    },
    async programar(lista, hora) {
      if (!this.disponible) return 0;
      try {
        const pend = await P.LocalNotifications.getPending();
        if (pend.notifications && pend.notifications.length) await P.LocalNotifications.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
        if (!lista.length || !(await this.permiso(false))) return 0;
        const notifications = lista.map((a, i) => { const [y, m, d] = a.fecha.split('-').map(Number);
          return { id: a.id || 1000 + i, title: a.titulo, body: a.texto, actionTypeId: a.accion || undefined, extra: a.datos || null, schedule: { at: new Date(y, m - 1, d, hora, 0, 0), allowWhileIdle: false } }; });
        await P.LocalNotifications.schedule({ notifications });
        return notifications.length;
      } catch (e) { return 0; }
    },
    // Botones de las notificaciones: «Cobrado» y «Avisar». Al pulsarlos se abre la app y se ejecuta la acción.
    async preparar(alPulsar) {
      if (!this.disponible) return;
      try {
        await P.LocalNotifications.registerActionTypes({ types: [
          { id: 'COBRO', actions: [{ id: 'cobrado', title: 'Cobrado' }, { id: 'avisar', title: 'Avisar' }] },
          { id: 'ATRASO', actions: [{ id: 'avisar', title: 'Enviar recordatorio' }, { id: 'cobrado', title: 'Ya ha pagado' }] }] });
        P.LocalNotifications.addListener('localNotificationActionPerformed', (r) => alPulsar(r.actionId, (r.notification && r.notification.extra) || {}));
      } catch (e) { /* sin notificaciones */ }
    },
  };

  // ---------- Versión completa: compra única en Google Play ----------
  const PRODUCTO = 'version_completa';
  const Tienda = window.Tienda || {
    disponible: NATIVO && !!P.NativePurchases,
    async precio() {
      const r = await P.NativePurchases.getProducts({ productIdentifiers: [PRODUCTO], productType: 'inapp' });
      return r.products && r.products[0] ? r.products[0].priceString : null;
    },
    async comprar() {
      const t = await P.NativePurchases.purchaseProduct({ productIdentifier: PRODUCTO, productType: 'inapp', quantity: 1 });
      return !!t && (t.purchaseState == null || String(t.purchaseState) === '1');
    },
    // Lo que Google Play dice que este usuario tiene comprado (sirve también para recuperar la compra)
    async tiene() {
      const r = await P.NativePurchases.getPurchases({ productType: 'inapp' });
      return (r.purchases || []).some((p) => p.productIdentifier === PRODUCTO && String(p.purchaseState) === '1');
    },
  };

  window.Plataforma = { NATIVO, Almacen, Archivos, Avisos, Tienda, Adjuntos, Drive, Bloqueo, Widget,
    // En la app de Android, navegar al enlace hace que Android lo abra en su app (WhatsApp); en el navegador, pestaña nueva
    abrir(url) { if (NATIVO) window.location.href = url; else window.open(url, '_blank'); },
    alVolver(fn) { document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); }); } };
})();
