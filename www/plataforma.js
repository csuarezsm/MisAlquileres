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
    async cargar() {
      try { const d = await bd(); return await new Promise((ok, mal) => { const q = d.transaction('kv').objectStore('kv').get('estado'); q.onsuccess = () => ok(q.result || null); q.onerror = () => mal(q.error); }); }
      catch (e) { return localStorage.getItem('ma.estado'); }
    },
    async guardar(txt) {
      try { const d = await bd(); await new Promise((ok, mal) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(txt, 'estado'); t.oncomplete = ok; t.onerror = () => mal(t.error); }); }
      catch (e) { localStorage.setItem('ma.estado', txt); }
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
    // Una copia al día en Documentos/MisAlquileres, por si se pierde o se cambia el móvil
    async copiaAuto(texto, hoy) {
      if (!NATIVO || !P.Filesystem || localStorage.getItem('ma.copia') === hoy) return;
      try {
        await P.Filesystem.writeFile({ path: 'MisAlquileres/mis-alquileres-copia-auto.json', data: texto, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
        localStorage.setItem('ma.copia', hoy);
      } catch (e) { /* sin permiso o sin espacio: no es grave, queda la copia manual */ }
    },
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

  window.Plataforma = { NATIVO, Almacen, Archivos, Avisos, Tienda, Adjuntos,
    // En la app de Android, navegar al enlace hace que Android lo abra en su app (WhatsApp); en el navegador, pestaña nueva
    abrir(url) { if (NATIVO) window.location.href = url; else window.open(url, '_blank'); },
    alVolver(fn) { document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); }); } };
})();
