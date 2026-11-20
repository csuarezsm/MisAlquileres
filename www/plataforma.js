/* Mis alquileres — lo que depende del dispositivo: guardado, archivos, avisos y compra. © 2026 IT Canarias. */
(function () {
  'use strict';
  const C = window.Capacitor, NATIVO = !!(C && C.isNativePlatform && C.isNativePlatform()), P = (C && C.Plugins) || {};

  // ---------- Guardado local (IndexedDB; los datos no salen del dispositivo) ----------
  function bd() {
    return new Promise((ok, mal) => {
      const r = indexedDB.open('misalquileres', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
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
          return { id: 1000 + i, title: a.titulo, body: a.texto, schedule: { at: new Date(y, m - 1, d, hora, 0, 0), allowWhileIdle: false } }; });
        await P.LocalNotifications.schedule({ notifications });
        return notifications.length;
      } catch (e) { return 0; }
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

  window.Plataforma = { NATIVO, Almacen, Archivos, Avisos, Tienda,
    // En la app de Android, navegar al enlace hace que Android lo abra en su app (WhatsApp); en el navegador, pestaña nueva
    abrir(url) { if (NATIVO) window.location.href = url; else window.open(url, '_blank'); },
    alVolver(fn) { document.addEventListener('visibilitychange', () => { if (!document.hidden) fn(); }); } };
})();
