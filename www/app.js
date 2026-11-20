/* Mis alquileres — interfaz. © 2026 IT Canarias. Las reglas están en nucleo.js; aquí solo se pinta y se recoge lo que escribe el usuario. */
(function () {
  'use strict';
  const APP_VERSION = '1.0.1';
  const { Almacen, Archivos, Avisos, Tienda, NATIVO } = window.Plataforma;
  const $ = (q, el) => (el || document).querySelector(q);
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = MA.euros;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fecha = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
  const fmes = (m) => `${MESES[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const aTexto = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, ''));
  const clave = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  const por = (l, i) => l.find((x) => x.id === i);

  let S = MA.nuevo(), HOY = hoyLocal();
  const V = { mes: HOY.slice(0, 7), anio: HOY.slice(0, 4), archivados: false };

  // ---------- Guardado ----------
  let tGuardar = null;
  function guardar() {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(async () => {
      const txt = MA.exportar(S);
      await Almacen.guardar(txt);
      Archivos.copiaAuto(txt, HOY);
      if (Avisos.disponible) Avisos.programar(S.ajustes.avisos ? MA.proximosAvisos(S, HOY, 60) : [], S.ajustes.horaAvisos || 9);
    }, 300);
  }
  function alDia() { HOY = hoyLocal(); if (MA.generarCargos(S, HOY) + MA.generarGastos(S, HOY)) guardar(); }

  // ---------- Avisos en pantalla ----------
  let tToast = null;
  function toast(msg, accion, fn) {
    const t = $('#toast'); t.innerHTML = `<span>${h(msg)}</span>${accion ? `<button>${h(accion)}</button>` : ''}`; t.hidden = false;
    if (accion) $('button', t).onclick = () => { t.hidden = true; fn(); };
    clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, accion ? 7000 : 3500);
  }
  function fallo(e) { if (e && e.code === 'LIMITE') return hojaPro(e.message); toast(e && e.code ? e.message : 'Algo ha fallado. Inténtalo de nuevo.'); if (!e || !e.code) console.error(e); }
  // Ejecuta un cambio, guarda y repinta
  function haz(fn, despues) { try { const r = fn(); guardar(); pinta(); if (despues) despues(r); return true; } catch (e) { fallo(e); return false; } }

  // ---------- Hoja inferior (diálogo) ----------
  let focoPrevio = null;
  function hoja(titulo, cuerpo, alMontar) {
    const el = $('#hoja');
    if (el.hidden) focoPrevio = document.activeElement;
    el.innerHTML = `<button class="cerrar" data-a="cerrar" aria-label="Cerrar">✕</button><h2 id="hoja-t">${h(titulo)}</h2>${cuerpo}`;
    el.hidden = false; $('#fondo').hidden = false; el.scrollTop = 0;
    if (alMontar) alMontar(el);
    ($('input:not([type=hidden]),select,textarea', el) || $('.cerrar', el)).focus({ preventScroll: true });
  }
  function cerrar() { $('#hoja').hidden = true; $('#fondo').hidden = true; if (focoPrevio && focoPrevio.focus) focoPrevio.focus(); }
  document.addEventListener('keydown', (e) => {
    const el = $('#hoja'); if (el.hidden) return;
    if (e.key === 'Escape') return cerrar();
    if (e.key !== 'Tab') return;
    const f = [...el.querySelectorAll('button,input,select,textarea,a[href]')].filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---------- Formularios ----------
  function campos(defs, v) {
    return defs.map((d) => {
      if (d.h) return `<h3>${h(d.h)}</h3>`;
      if (d.html) return d.html;
      const val = v[d.k] != null ? v[d.k] : d.def != null ? d.def : '', ay = d.ayuda ? `<small>${h(d.ayuda)}</small>` : '', req = d.req ? ' required' : '';
      if (d.t === 'check') return `<label class="f chk"><input type="checkbox" name="${d.k}"${val ? ' checked' : ''}><span>${h(d.e)}${ay}</span></label>`;
      if (d.t === 'select') return `<label class="f">${h(d.e)}<select name="${d.k}"${req}>${d.op.map(([a, b]) => `<option value="${h(a)}"${String(a) === String(val) ? ' selected' : ''}>${h(b)}</option>`).join('')}</select>${ay}</label>`;
      if (d.t === 'area') return `<label class="f">${h(d.e)}<textarea name="${d.k}" rows="5">${h(val)}</textarea>${ay}</label>`;
      const tipo = d.t === 'dinero' ? 'text" inputmode="decimal' : d.t === 'num' ? 'text" inputmode="decimal' : d.t || 'text';
      return `<label class="f">${h(d.e)}<input type="${tipo}" name="${d.k}" value="${h(d.t === 'dinero' ? aTexto(val === '' ? null : val) : val)}"${req} autocomplete="off">${ay}</label>`;
    }).join('');
  }
  function leer(form, defs) {
    const o = {};
    for (const d of defs) {
      if (!d.k) continue; const el = form.elements[d.k]; if (!el) continue;
      const t = el.value != null ? String(el.value).trim() : '';
      if (d.t === 'check') o[d.k] = el.checked;
      else if (d.t === 'dinero') o[d.k] = t === '' ? null : MA.centimos(t);
      else if (d.t === 'num') { o[d.k] = t === '' ? null : Number(t.replace(',', '.')); if (o[d.k] != null && !Number.isFinite(o[d.k])) throw Object.assign(new Error(`Valor no válido: ${d.e}`), { code: 'DATOS' }); }
      else o[d.k] = t;
    }
    return o;
  }
  function formulario({ titulo, defs, valores, boton, alGuardar, pie, despues, alMontar }) {
    hoja(titulo, `<form novalidate><div class="error" hidden role="alert"></div>${campos(defs, valores || {})}<button class="btn pri ancho" type="submit">${h(boton || 'Guardar')}</button></form>${pie || ''}`, (el) => {
      const f = $('form', el); let enviando = false;
      f.onsubmit = (e) => {
        e.preventDefault(); if (enviando) return; enviando = true;
        try { const r = alGuardar(leer(f, defs), f); guardar(); cerrar(); pinta(); if (despues) despues(r); }
        catch (x) { enviando = false; if (x.code === 'LIMITE') return fallo(x); const b = $('.error', f); b.textContent = x.code ? x.message : 'No se ha podido guardar.'; b.hidden = false; b.scrollIntoView({ block: 'nearest' }); if (!x.code) console.error(x); }
      };
      if (alMontar) alMontar(f);
    });
  }
  function confirma(titulo, texto, boton, fn, pedirMotivo) {
    hoja(titulo, `<p class="sub">${h(texto)}</p>${pedirMotivo ? '<label class="f">Motivo<input name="motivo" autocomplete="off"></label>' : ''}<div class="acc"><button class="btn rojo" data-x="si">${h(boton)}</button><button class="btn" data-a="cerrar">Cancelar</button></div>`,
      (el) => { $('[data-x=si]', el).onclick = () => { const m = pedirMotivo ? $('input', el).value : ''; cerrar(); fn(m); }; });
  }

  // ---------- Mensajes por WhatsApp ----------
  function telWa(t) { const n = String(t || '').replace(/\D/g, ''); return n.length === 9 ? '34' + n : n.replace(/^00/, ''); }
  const pila = (n) => String(n || '').trim().split(/\s+/)[0];
  function enviar(titulo, tel, texto, alEnviar) {
    hoja(titulo, `<label class="f">Mensaje<textarea id="msj" rows="8">${h(texto)}</textarea></label>
      <div class="acc"><button class="btn pri" data-x="wa">${tel ? 'Abrir WhatsApp' : 'Compartir'}</button><button class="btn" data-x="copiar">Copiar</button></div>
      <p class="sub">${tel ? 'Se abre WhatsApp con el texto preparado; lo envías tú.' : 'Este inquilino no tiene teléfono guardado: elige WhatsApp y el contacto al compartir, o añade su teléfono en su ficha.'}</p>`, (el) => {
      $('[data-x=wa]', el).onclick = () => { const t = $('#msj', el).value; if (alEnviar) alEnviar(); cerrar();
        if (tel) window.Plataforma.abrir(`https://wa.me/${telWa(tel)}?text=${encodeURIComponent(t)}`);
        else Archivos.compartirTexto(t).then((r) => { if (r === 'copiado') toast('Mensaje copiado: pégalo en WhatsApp'); }).catch(() => {}); };
      $('[data-x=copiar]', el).onclick = async () => { try { await navigator.clipboard.writeText($('#msj', el).value); toast('Mensaje copiado'); } catch (e) { toast('No se ha podido copiar'); } };
    });
  }
  const comunes = () => ({ propietario: S.ajustes.propietario || '', forma_pago: S.ajustes.formaPago || '' });
  function msgCobro(c, tipo) {
    const v = { ...comunes(), nombre: pila(c.inquilino), inmueble: c.inmueble, mes: fmes(c.periodo), importe: eur(c.importe), deuda: eur(c.pendiente), fecha_cobro: fecha(c.vence), importe_pagado: eur(c.pagado), fecha_pago: fecha(c.fechaPago) };
    enviar('Mensaje a ' + c.inquilino, c.telefono, MA.mensaje(S.plantillas[tipo], v), () => { if (tipo !== 'recibo') { por(S.cargos, c.id).recordatorio = HOY; guardar(); } });
  }

  // ---------- Etiquetas de estado ----------
  const E_CARGO = { pendiente: ['Pendiente', ''], parcial: ['A medias', 'avi'], atrasado: ['Atrasado', 'mal'], pagado: ['Cobrado', 'ok'], anulado: ['Anulado', 'gris'] };
  const E_GASTO = { previsto: ['Previsto', ''], vencido: ['Sin pagar', 'mal'], por_confirmar: ['Por confirmar', 'avi'], pagado: ['Pagado', 'ok'], anulado: ['Anulado', 'gris'] };
  const E_CONTRATO = { vigente: ['Vigente', 'ok'], futuro: ['Empieza pronto', ''], por_vencer: ['Vence pronto', 'avi'], vencido: ['Vencido', 'mal'], finalizado: ['Finalizado', 'gris'], rescindido: ['Rescindido', 'gris'] };
  const chip = (m, e) => `<span class="chip ${m[e][1]}">${m[e][0]}</span>`;

  // ---------- Tarjetas ----------
  function cobroTar(c, conMes) {
    const vivo = c.estado !== 'pagado' && c.estado !== 'anulado';
    return `<div class="tar toca${c.estado === 'anulado' ? ' apagada' : ''}" data-a="cobro" data-id="${c.id}">
      <div class="fila"><span class="tit">${h(c.inquilino)}</span><span class="imp">${eur(vivo ? c.pendiente : c.importe)}</span></div>
      <div class="fila"><span class="sub">${h(c.inmueble)}${conMes ? ' · ' + fmes(c.periodo) : ''} · vence ${fecha(c.vence)}</span>${chip(E_CARGO, c.estado)}</div>
      ${c.estimado ? '<div class="sub">Cobro estimado (anterior a la app)</div>' : ''}
      ${vivo ? `<div class="acc"><button class="btn pri peq" data-a="cobrado" data-id="${c.id}" data-k="${clave()}">Cobrado</button><button class="btn peq" data-a="avisar" data-id="${c.id}">Avisar</button>${c.recordatorio ? `<span class="sub">Avisado el ${fecha(c.recordatorio)}</span>` : ''}</div>` : ''}</div>`;
  }
  function gastoTar(g) {
    const pte = !g.pagado && !g.anulado;
    return `<div class="tar toca${g.anulado ? ' apagada' : ''}" data-a="gasto" data-id="${g.id}">
      <div class="fila"><span class="tit">${h(g.concepto)}</span><span class="imp">${eur(g.importe)}</span></div>
      <div class="fila"><span class="sub">${h(g.inmueble)} · ${fecha(g.fecha)}${g.estimado ? ' · estimado' : ''}</span>${chip(E_GASTO, g.estado)}</div>
      ${g.porCobrar > 0 ? `<div class="sub">Por cobrar a ${h(g.inquilino)}: <b>${eur(g.porCobrar)}</b></div>` : ''}
      ${pte && g.fecha <= HOY ? `<div class="acc"><button class="btn pri peq" data-a="gastoPagado" data-id="${g.id}">${g.estado === 'por_confirmar' ? 'Confirmar pago' : 'Pagado'}</button></div>` : ''}</div>`;
  }
  function contratoTar(ct) {
    const q = por(S.inquilinos, ct.inquilinoId) || {}, p = por(S.inmuebles, ct.inmuebleId) || {}, sit = MA.situacionContrato(ct, HOY);
    const deuda = MA.cargos(S, HOY, (c) => c.contratoId === ct.id).filter((c) => c.estado === 'atrasado').reduce((t, c) => t + c.pendiente, 0);
    return `<div class="tar toca${ct.estado !== 'activo' ? ' apagada' : ''}" data-a="contrato" data-id="${ct.id}">
      <div class="fila"><span class="tit">${h(q.nombre)}</span><span class="imp">${eur(MA.rentaActual(ct, HOY))}/mes</span></div>
      <div class="fila"><span class="sub">${h(p.nombre)} · ${fecha(ct.inicio)} a ${ct.fin ? fecha(MA.finEfectivo(ct)) : 'sin fecha de fin'}</span>${chip(E_CONTRATO, sit)}</div>
      ${deuda ? `<div class="sub">Debe <b>${eur(deuda)}</b></div>` : ''}</div>`;
  }
  const vacio = (t, s, boton) => `<div class="vacio"><b>${h(t)}</b>${h(s)}${boton ? `<div class="acc" data-centro><button class="btn pri" data-a="${boton[0]}">${h(boton[1])}</button></div>` : ''}</div>`;
  const sec = (t, lado, cuerpo) => (cuerpo ? `<section class="sec"><h2>${h(t)}${lado ? `<b>${h(lado)}</b>` : ''}</h2>${cuerpo}</section>` : '');

  // ---------- Vistas ----------
  const VISTAS = {
    inicio() {
      if (!S.inmuebles.length) return vacio('Empieza por tu primer inmueble', 'Añade el inmueble, después el inquilino y su contrato. La app creará los recibos de cada mes.', ['nuevoInmueble', 'Añadir inmueble']);
      if (!S.contratos.length) return vacio('Ahora, el contrato', 'Indica quién alquila el inmueble, desde cuándo y cuánto paga.', ['nuevoContrato', 'Crear contrato']);
      const k = MA.panel(S, HOY), cs = MA.cargos(S, HOY, (c) => !c.anulado), gs = MA.gastos(S, HOY, (g) => !g.anulado), finMes = MA.masMeses(HOY.slice(0, 7) + '-01', 1);
      const atras = cs.filter((c) => c.estado === 'atrasado'), mes = cs.filter((c) => (c.estado === 'pendiente' || c.estado === 'parcial') && c.vence < finMes);
      const vencen = S.contratos.filter((ct) => ['por_vencer', 'vencido'].includes(MA.situacionContrato(ct, HOY)));
      const gPte = gs.filter((g) => !g.pagado && g.fecha < finMes).reverse(), gCob = gs.filter((g) => g.porCobrar > 0 && g.pagado);
      const m = k.mesActual;
      return `<section class="sec"><div class="tar"><div class="fila"><span class="tit">${fmes(k.mes)}</span><span class="imp">${eur(m.cobrado)} de ${eur(m.esperado)}</span></div>
          <div class="prog"><i data-w="${m.porcentaje || 0}"></i></div><div class="sub">${m.pendiente ? `Faltan ${eur(m.pendiente)} por cobrar este mes` : m.esperado ? 'Todo cobrado este mes' : 'Sin recibos este mes'}</div></div></section>
        ${sec('Atrasados', eur(k.morosidad.deuda), atras.map((c) => cobroTar(c, true)).join(''))}
        ${sec('Por cobrar este mes', '', mes.map((c) => cobroTar(c)).join(''))}
        ${sec('Contratos que vencen', '', vencen.map(contratoTar).join(''))}
        ${sec('Gastos por atender', '', gPte.map(gastoTar).join(''))}
        ${sec('Por cobrar al inquilino', eur(k.gastosPorCobrar), gCob.map(gastoTar).join(''))}
        ${!atras.length && !mes.length && !vencen.length && !gPte.length && !gCob.length ? vacio('Todo al día', 'No hay cobros, contratos ni gastos pendientes de atender.') : ''}`;
    },
    cobros() {
      const cs = MA.cargos(S, HOY, (c) => c.periodo === V.mes), vivos = cs.filter((c) => c.estado !== 'anulado');
      const esp = vivos.reduce((t, c) => t + c.importe, 0), cob = vivos.reduce((t, c) => t + Math.min(c.pagado, c.importe), 0);
      return `<div class="nav"><button data-a="mes" data-d="-1" aria-label="Mes anterior">‹</button><b>${fmes(V.mes)}</b><button data-a="mes" data-d="1" aria-label="Mes siguiente"${V.mes >= HOY.slice(0, 7) ? ' disabled' : ''}>›</button></div>
        <div class="kpis"><div class="kpi"><span>Cobrado</span><b>${eur(cob)}</b></div><div class="kpi"><span>Pendiente</span><b>${eur(esp - cob)}</b></div></div>
        ${cs.map((c) => cobroTar(c)).join('') || vacio('Sin recibos este mes', 'Los recibos se crean solos a partir de los contratos.')}`;
    },
    gastos() {
      const gs = MA.gastos(S, HOY, (g) => g.fecha.slice(0, 4) === V.anio), vivos = gs.filter((g) => !g.anulado);
      const pag = vivos.filter((g) => g.pagado).reduce((t, g) => t + g.importe, 0), pte = vivos.filter((g) => !g.pagado).reduce((t, g) => t + g.importe, 0);
      return `<div class="nav"><button data-a="anio" data-d="-1" aria-label="Año anterior">‹</button><b>${V.anio}</b><button data-a="anio" data-d="1" aria-label="Año siguiente">›</button></div>
        <div class="kpis"><div class="kpi"><span>Pagado</span><b>${eur(pag)}</b></div><div class="kpi"><span>Previsto o sin pagar</span><b>${eur(pte)}</b></div></div>
        ${gs.map(gastoTar).join('') || vacio('Sin gastos este año', 'Añade un gasto suelto aquí, o los gastos periódicos (IBI, comunidad…) en la ficha de cada inmueble.')}
        ${S.inmuebles.length ? '<button class="fab" data-a="nuevoGasto">+ Gasto</button>' : ''}`;
    },
    contratos() {
      const l = S.contratos.slice().sort((a, b) => (a.estado === 'activo' ? 0 : 1) - (b.estado === 'activo' ? 0 : 1) || (a.fin || '9999').localeCompare(b.fin || '9999'));
      return `${l.map(contratoTar).join('') || vacio('Sin contratos', 'Crea el primero para que la app genere los recibos mensuales.')}
        ${S.inmuebles.length ? '<button class="fab" data-a="nuevoContrato">+ Contrato</button>' : ''}`;
    },
    mas() {
      const n = (x) => x.filter((y) => !y.archivado).length;
      return `<div class="lista"><a href="#inmuebles">Inmuebles<small>${n(S.inmuebles)} en cartera</small></a><a href="#inquilinos">Inquilinos<small>${n(S.inquilinos)}</small></a>
        <a href="#panel">Panel<small>Ocupación, morosidad y rentabilidad</small></a><a href="#ajustes">Ajustes y copias<small>Tus datos, mensajes, avisos y copia de seguridad</small></a>
        <button data-a="pro">${S.pro ? 'Versión completa activada' : 'Versión completa'}<small>${S.pro ? 'Inmuebles sin límite' : 'Gratis con un inmueble; pago único para añadir más'}</small></button>
        <button data-a="ayuda">Ayuda<small>Cómo funciona y qué significan los estados</small></button></div>
        <p class="sub" data-centro>Mis alquileres ${APP_VERSION} · © 2026 IT Canarias</p>`;
    },
    inmuebles() {
      const l = S.inmuebles.filter((p) => V.archivados || !p.archivado).sort((a, b) => a.nombre.localeCompare(b.nombre));
      const hayArch = S.inmuebles.some((p) => p.archivado);
      return `${l.map((p) => { const ct = S.contratos.find((c) => c.inmuebleId === p.id && c.estado === 'activo' && c.inicio <= HOY && (!c.fin || c.fin >= HOY)), q = ct ? por(S.inquilinos, ct.inquilinoId) : null;
        return `<div class="tar toca${p.archivado ? ' apagada' : ''}" data-a="inmueble" data-id="${p.id}"><div class="fila"><span class="tit">${h(p.nombre)}</span><span class="imp">${ct ? eur(MA.rentaActual(ct, HOY)) + '/mes' : ''}</span></div>
          <div class="fila"><span class="sub">${h(p.tipo)}${q ? ' · ' + h(q.nombre) : ''}</span>${p.archivado ? '<span class="chip gris">Archivado</span>' : q ? '<span class="chip ok">Alquilado</span>' : '<span class="chip avi">Libre</span>'}</div></div>`; }).join('') || vacio('Sin inmuebles', 'Añade tu primer inmueble: plaza de garaje, trastero, vivienda, local…')}
        ${hayArch ? `<button class="btn ancho" data-a="verArchivados">${V.archivados ? 'Ocultar archivados' : 'Ver archivados'}</button>` : ''}<button class="fab" data-a="nuevoInmueble">+ Inmueble</button>`;
    },
    inquilinos() {
      const l = S.inquilinos.slice().sort((a, b) => (a.archivado ? 1 : 0) - (b.archivado ? 1 : 0) || a.nombre.localeCompare(b.nombre));
      return `${l.map((q) => { const ps = S.contratos.filter((c) => c.inquilinoId === q.id && c.estado === 'activo').map((c) => (por(S.inmuebles, c.inmuebleId) || {}).nombre);
        return `<div class="tar toca${q.archivado ? ' apagada' : ''}" data-a="inquilino" data-id="${q.id}"><div class="tit">${h(q.nombre)}</div><div class="sub">${h(ps.join(', ') || 'Sin contrato activo')}${q.telefono ? ' · ' + h(q.telefono) : ''}</div></div>`; }).join('') || vacio('Sin inquilinos', 'Puedes añadirlos aquí o al crear un contrato.')}
        <button class="fab" data-a="nuevoInquilino">+ Inquilino</button>`;
    },
    panel() {
      const k = MA.panel(S, HOY), c = k.cartera, pc = (n) => (n == null ? '—' : String(n).replace('.', ',') + ' %');
      if (!S.inmuebles.length) return vacio('Aún no hay datos', 'El panel se rellena cuando tengas inmuebles, contratos y cobros.');
      const max = Math.max(1, ...k.serie.map((x) => Math.max(x.ingresos, x.gastos + x.cuotas)));
      const barras = k.serie.map((x, i) => { const a = Math.round((x.ingresos / max) * 80), b = Math.round(((x.gastos + x.cuotas) / max) * 80), X = 6 + i * 26;
        return `<rect class="in" x="${X}" y="${90 - a}" width="10" height="${a}" rx="2"/><rect class="ga" x="${X + 11}" y="${90 - b}" width="10" height="${b}" rx="2"/><text x="${X + 10}" y="102" text-anchor="middle">${MESES[+x.mes.slice(5) - 1].slice(0, 3)}</text>`; }).join('');
      return `<div class="kpis"><div class="kpi"><span>Ocupación</span><b>${pc(c.ocupacion)}</b></div><div class="kpi"><span>Renta mensual</span><b>${eur(c.rentaMensual)}</b></div>
          <div class="kpi"><span>Deuda de inquilinos</span><b>${eur(k.morosidad.deuda)}</b></div><div class="kpi"><span>Fianzas en depósito</span><b>${eur(c.fianzas)}</b></div></div>
        ${sec('Últimos 12 meses', '', `<div class="tar"><svg class="graf" viewBox="0 0 320 106" role="img" aria-label="Ingresos y gastos por mes">${barras}</svg><div class="ley"><span><i></i>Cobrado</span><span><i class="ga"></i>Gastos e hipoteca</span></div>
          <table class="t"><tr><td>Cobrado</td><td>${eur(k.ultimos12.ingresos)}</td></tr><tr><td>Gastos (menos lo recuperado)</td><td>${eur(k.ultimos12.gastos)}</td></tr><tr><td>Cuotas de hipoteca</td><td>${eur(k.ultimos12.cuotas)}</td></tr><tr><td><b>Lo que te queda</b></td><td><b>${eur(k.ultimos12.flujo)}</b></td></tr></table></div>`)}
        ${sec('Por inmueble (12 meses)', '', `<div class="tar"><table class="t"><tr><th>Inmueble</th><th>Cobrado</th><th>Neto</th><th>Rentab.</th></tr>${k.inmuebles.map((x) => `<tr><td>${h(x.nombre)}</td><td>${eur(x.ingresos)}</td><td>${eur(x.neto)}</td><td>${pc(x.neta)}</td></tr>`).join('')}</table>
          <p class="sub">La rentabilidad se calcula sobre el precio de compra más gastos, o sobre el valor que hayas indicado. Las fechas son las de cobro y pago reales.</p></div>`)}
        ${c.deudaHipotecaria ? sec('Patrimonio', '', `<div class="kpis"><div class="kpi"><span>Deuda hipotecaria</span><b>${eur(c.deudaHipotecaria)}</b></div><div class="kpi"><span>Valor menos deuda</span><b>${eur(c.patrimonio)}</b></div></div>`) : ''}`;
    },
    ajustes() {
      return `<div class="lista"><button data-a="misDatos">Mis datos<small>${h(S.ajustes.propietario || 'Tu nombre y la forma de pago que aparecen en los mensajes')}</small></button>
        <button data-a="plantillas">Mensajes<small>Textos de los avisos por WhatsApp</small></button>
        <button data-a="avisosConf">Avisos en el móvil<small>${!Avisos.disponible ? 'Disponibles en la app de Android' : S.ajustes.avisos ? `Activados, a las ${S.ajustes.horaAvisos || 9}:00` : 'Desactivados'}</small></button></div>
        ${sec('Copia de seguridad', '', `<p class="nota">Tus datos están solo en este dispositivo. Guarda una copia de vez en cuando: si pierdes o cambias el móvil, es la única forma de recuperarlos.</p>
          <div class="lista"><button data-a="copia">Guardar o compartir una copia<small>Archivo con todos tus datos</small></button><button data-a="restaurar">Recuperar una copia<small>Sustituye los datos actuales</small></button></div>`)}
        ${sec('Exportar a Excel (CSV)', '', `<div class="lista"><button data-a="csv" data-t="Cobros">Recibos de alquiler</button><button data-a="csv" data-t="Pagos">Cobros recibidos, uno a uno</button><button data-a="csv" data-t="Gastos">Gastos</button></div>`)}
        ${sec('Otros', '', `<div class="lista"><button data-a="historial">Historial de cambios<small>Quedan anotados los cobros, anulaciones y cambios</small></button><button data-a="privacidad">Privacidad<small>Qué datos guarda la app y dónde</small></button>
          <button data-a="borrarTodo">Borrar todos los datos<small>Deja la app como recién instalada</small></button></div>`)}`;
    },
  };
  const TITULOS = { inicio: 'Mis alquileres', cobros: 'Cobros', gastos: 'Gastos', contratos: 'Contratos', mas: 'Más', inmuebles: 'Inmuebles', inquilinos: 'Inquilinos', panel: 'Panel', ajustes: 'Ajustes y copias' };
  const vistaActual = () => { const v = location.hash.slice(1); return VISTAS[v] ? v : 'inicio'; };
  function pinta() {
    const v = vistaActual(), el = $('#vista');
    $('#titulo').textContent = TITULOS[v]; $('#subtitulo').textContent = v === 'inicio' ? `${+HOY.slice(8)} de ${fmes(HOY.slice(0, 7))}` : '';
    const y = el.scrollTop; el.innerHTML = VISTAS[v](); el.scrollTop = y;
    for (const i of el.querySelectorAll('[data-w]')) i.style.width = Math.min(100, +i.dataset.w) + '%';
    for (const i of el.querySelectorAll('[data-centro]')) { i.style.justifyContent = 'center'; i.style.textAlign = 'center'; i.style.marginTop = '14px'; }
    const principal = ['inmuebles', 'inquilinos', 'panel', 'ajustes'].includes(v) ? 'mas' : v;
    for (const a of document.querySelectorAll('.barra a')) { const on = a.dataset.v === principal; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  }

  // ---------- Fichas y formularios de cada cosa ----------
  const opInmuebles = () => S.inmuebles.filter((p) => !p.archivado).map((p) => [p.id, p.nombre]);
  const D_INMUEBLE = [{ k: 'nombre', e: 'Nombre', req: 1, ayuda: 'Por ejemplo: Plaza 12, Piso de la calle Real…' }, { k: 'tipo', e: 'Tipo', t: 'select', op: MA.TIPOS.map((t) => [t, t]) },
    { k: 'direccion', e: 'Dirección' }, { k: 'referencia', e: 'Referencia catastral' }, { k: 'porUnidades', t: 'check', e: 'Se alquila por habitaciones o unidades', ayuda: 'Permite varios contratos a la vez en este inmueble.' },
    { h: 'Compra y valor (opcional)' }, { k: 'compraPrecio', e: 'Precio de compra', t: 'dinero' }, { k: 'compraGastos', e: 'Gastos de compra (impuestos, notaría, reforma)', t: 'dinero' }, { k: 'compraFecha', e: 'Fecha de compra', t: 'date' },
    { k: 'valor', e: 'Valor actual estimado', t: 'dinero' }, { k: 'notas', e: 'Notas', t: 'area' }];
  function formInmueble(p) {
    formulario({ titulo: p ? 'Editar inmueble' : 'Nuevo inmueble', defs: p ? D_INMUEBLE : [...D_INMUEBLE.slice(0, 5), { k: 'tipicos', t: 'check', e: 'Añadir los gastos habituales de este tipo (IBI, comunidad…)', def: true }, ...D_INMUEBLE.slice(5)], valores: p || { tipo: 'Plaza de garaje' },
      alGuardar: (d) => { if (p) return MA.editarInmueble(S, p.id, d); const n = MA.crearInmueble(S, d, HOY); if (d.tipicos) MA.cargarTipicos(S, n.id, HOY); return n; },
      despues: (n) => { if (!p) fichaInmueble(n.id); } });
  }
  function fichaInmueble(i) {
    const p = por(S.inmuebles, i); if (!p) return cerrar();
    const k = MA.panel(S, HOY).inmuebles.find((x) => x.id === i), hip = MA.situacionHipoteca(p.hipoteca, HOY), cs = S.conceptos.filter((c) => c.inmuebleId === i && !c.hipoteca);
    hoja(p.nombre, `<p class="sub">${h(p.tipo)}${p.direccion ? ' · ' + h(p.direccion) : ''}</p>
      ${k ? `<div class="kpis"><div class="kpi"><span>Cobrado (12 meses)</span><b>${eur(k.ingresos)}</b></div><div class="kpi"><span>Neto (12 meses)</span><b>${eur(k.neto)}</b></div></div>` : ''}
      <h3>Gastos periódicos</h3>${cs.map((c) => `<div class="tar toca" data-a="concepto" data-id="${c.id}"><div class="fila"><span class="tit">${h(c.concepto)}</span><span class="imp">${c.importe ? eur(c.importe) : 'Sin importe'}</span></div>
        <div class="sub">${c.periodicidad} · ${h(MA.RESPONSABLES[c.responsable])}${c.domiciliado ? ' · domiciliado' : ''}${c.activo ? '' : ' · dado de baja'}</div></div>`).join('') || '<p class="sub">Ninguno todavía.</p>'}
      ${cs.some((c) => c.activo && c.responsable !== 'inquilino' && !c.importe) ? '<p class="nota">Los conceptos sin importe no generan gastos: toca cada uno y ponle el importe.</p>' : ''}
      <div class="acc"><button class="btn peq" data-a="nuevoConcepto" data-id="${i}">+ Añadir gasto periódico</button><button class="btn peq" data-a="tipicos" data-id="${i}">Añadir los habituales</button></div>
      <h3>Hipoteca</h3>${hip ? `<div class="tar"><div class="fila"><span class="tit">Cuota ${eur(hip.cuota)}</span><span class="imp">${eur(hip.pendiente)}</span></div><div class="sub">Pendiente · ${hip.restantes} cuotas, hasta ${fecha(hip.fin)} · amortizado ${String(hip.amortizado).replace('.', ',')} %</div></div>` : '<p class="sub">Sin hipoteca.</p>'}
      <div class="acc"><button class="btn peq" data-a="hipoteca" data-id="${i}">${hip ? 'Cambiar hipoteca' : 'Añadir hipoteca'}</button></div>
      <h3>Inmueble</h3><div class="acc"><button class="btn" data-a="editarInmueble" data-id="${i}">Editar datos</button><button class="btn" data-a="archivarInmueble" data-id="${i}">${p.archivado ? 'Recuperar' : 'Archivar'}</button><button class="btn rojo" data-a="eliminarInmueble" data-id="${i}">Eliminar</button></div>`);
  }
  const D_CONCEPTO = [{ k: 'concepto', e: 'Concepto', req: 1 }, { k: 'categoria', e: 'Categoría', t: 'select', op: Object.entries(MA.CATEGORIAS).filter(([a]) => a !== 'financiacion') },
    { k: 'responsable', e: '¿Quién lo paga?', t: 'select', op: Object.entries(MA.RESPONSABLES) }, { k: 'porcentaje', e: 'Si se lo cobras al inquilino, ¿qué porcentaje?', t: 'num', def: 100 },
    { k: 'importe', e: 'Importe de cada recibo', t: 'dinero' }, { k: 'periodicidad', e: 'Cada cuánto', t: 'select', op: Object.keys(MA.PERIODICIDADES).map((x) => [x, x]) },
    { k: 'mesInicio', e: 'Mes del primer recibo del año', t: 'select', op: MESES.map((m, i) => [i + 1, m]) }, { k: 'dia', e: 'Día del mes', t: 'num', def: 1 }, { k: 'desde', e: 'Desde qué mes', t: 'month' },
    { k: 'domiciliado', t: 'check', e: 'Domiciliado en el banco', ayuda: 'Al llegar la fecha quedará «por confirmar» hasta que compruebes el cargo.' }];
  function formConcepto(c, inmuebleId) {
    formulario({ titulo: c ? c.concepto : 'Nuevo gasto periódico', defs: D_CONCEPTO, valores: c || { categoria: 'otro', responsable: 'propietario', periodicidad: 'anual', mesInicio: 1, desde: HOY.slice(0, 7) },
      alGuardar: (d) => (c ? MA.editarConcepto(S, c.id, d, HOY) : MA.crearConcepto(S, { inmuebleId, ...d }, HOY)), despues: () => fichaInmueble(c ? c.inmuebleId : inmuebleId),
      pie: c ? `<div class="acc"><button class="btn rojo" data-a="eliminarConcepto" data-id="${c.id}">Dar de baja este gasto</button></div>` : '' });
  }
  function formHipoteca(i) {
    const p = por(S.inmuebles, i), v = p.hipoteca || {};
    formulario({ titulo: 'Hipoteca de ' + p.nombre, valores: v, defs: [{ k: 'importe', e: 'Importe prestado', t: 'dinero', req: 1 }, { k: 'tin', e: 'Interés anual (%)', t: 'num' }, { k: 'anios', e: 'Plazo en años', t: 'num', req: 1 },
      { k: 'inicio', e: 'Fecha de la primera cuota', t: 'date', req: 1 }, { k: 'cuota', e: 'Cuota mensual real (opcional)', t: 'dinero', ayuda: 'Si la dejas vacía se calcula con el sistema francés.' }],
      alGuardar: (d) => MA.ponerHipoteca(S, i, d, HOY), despues: () => fichaInmueble(i),
      pie: p.hipoteca ? `<div class="acc"><button class="btn rojo" data-a="quitarHipoteca" data-id="${i}">Quitar la hipoteca</button></div>` : '<p class="sub">Las cuotas anteriores a hoy se apuntan como pagadas y marcadas «estimado».</p>' });
  }
  const D_INQUILINO = [{ k: 'nombre', e: 'Nombre y apellidos', req: 1 }, { k: 'telefono', e: 'Teléfono (para WhatsApp)', t: 'tel' }, { k: 'dni', e: 'DNI / NIE' }, { k: 'email', e: 'Correo', t: 'email' }, { k: 'domicilio', e: 'Domicilio' }, { k: 'notas', e: 'Notas', t: 'area' }];
  function formInquilino(q) {
    formulario({ titulo: q ? 'Editar inquilino' : 'Nuevo inquilino', defs: D_INQUILINO, valores: q, alGuardar: (d) => (q ? MA.editarInquilino(S, q.id, d) : MA.crearInquilino(S, d)),
      pie: q ? `<div class="acc">${q.telefono ? `<button class="btn" data-a="chat" data-id="${q.id}">Abrir WhatsApp</button>` : ''}<button class="btn" data-a="archivarInquilino" data-id="${q.id}">${q.archivado ? 'Recuperar' : 'Archivar'}</button><button class="btn rojo" data-a="eliminarInquilino" data-id="${q.id}">Eliminar</button></div>` : '' });
  }
  function formContrato() {
    if (!opInmuebles().length) return toast('Añade antes un inmueble');
    const qs = S.inquilinos.filter((q) => !q.archivado).map((q) => [q.id, q.nombre]);
    formulario({ titulo: 'Nuevo contrato', boton: 'Crear contrato', valores: { inicio: HOY, diaCobro: 1, avisoMeses: 1, inquilinoId: qs.length ? qs[0][0] : 'nuevo' },
      defs: [{ k: 'inmuebleId', e: 'Inmueble', t: 'select', op: opInmuebles() }, { k: 'inquilinoId', e: 'Inquilino', t: 'select', op: [...qs, ['nuevo', '+ Nuevo inquilino…']] },
        { html: '<div id="nuevoInq">' }, { k: 'nNombre', e: 'Nombre del inquilino' }, { k: 'nTelefono', e: 'Teléfono (para WhatsApp)', t: 'tel' }, { html: '</div>' },
        { k: 'inicio', e: 'Fecha de inicio', t: 'date', req: 1 }, { k: 'fin', e: 'Fecha de fin (vacía si no tiene)', t: 'date' }, { k: 'importe', e: 'Renta mensual', t: 'dinero', req: 1 }, { k: 'diaCobro', e: 'Día de cobro', t: 'num' },
        { k: 'fianza', e: 'Fianza acordada', t: 'dinero' }, { k: 'avisoMeses', e: 'Avisar del vencimiento con (meses)', t: 'num' },
        { k: 'historicoCobrado', t: 'check', e: 'Dar por cobrados los meses anteriores a este', ayuda: 'Solo si el contrato empezó antes de usar la app. Quedarán marcados como estimados.' }, { k: 'notas', e: 'Notas', t: 'area' }],
      alMontar: (f) => { const ver = () => { $('#nuevoInq', f).hidden = f.elements.inquilinoId.value !== 'nuevo'; }; f.elements.inquilinoId.onchange = ver; ver(); },
      alGuardar: (d) => {
        if (d.importe == null) throw Object.assign(new Error('Indica la renta mensual'), { code: 'IMPORTE' });
        let inq = Number(d.inquilinoId), creado = null;
        if (d.inquilinoId === 'nuevo') { creado = MA.crearInquilino(S, { nombre: d.nNombre, telefono: d.nTelefono }); inq = creado.id; }
        try { return MA.crearContrato(S, { ...d, inmuebleId: Number(d.inmuebleId), inquilinoId: inq, fin: d.fin || null, fianza: d.fianza || 0, diaCobro: d.diaCobro == null ? 1 : d.diaCobro, avisoMeses: d.avisoMeses == null ? 1 : d.avisoMeses }, HOY); }
        catch (e) { if (creado) MA.eliminarInquilino(S, creado.id); throw e; }
      } });
  }
  function fichaContrato(i) {
    const ct = por(S.contratos, i); if (!ct) return cerrar();
    const q = por(S.inquilinos, ct.inquilinoId) || {}, p = por(S.inmuebles, ct.inmuebleId) || {}, sit = MA.situacionContrato(ct, HOY), saldo = MA.saldoFianza(S, i);
    const cs = MA.cargos(S, HOY, (c) => c.contratoId === i).reverse(), fz = S.fianzas.filter((f) => f.contratoId === i && !f.anulado);
    hoja(`${q.nombre} · ${p.nombre}`, `<p>${chip(E_CONTRATO, sit)} <span class="sub">${fecha(ct.inicio)} a ${ct.fin || ct.fechaBaja ? fecha(MA.finEfectivo(ct)) : 'sin fecha de fin'} · cobro el día ${ct.diaCobro}</span></p>
      <h3>Renta</h3><table class="t">${ct.rentas.map((r) => `<tr><td>Desde ${fmes(r.desde)}</td><td>${eur(r.importe)}</td></tr>`).join('')}</table>
      ${ct.estado === 'activo' ? `<div class="acc"><button class="btn peq" data-a="revisar" data-id="${i}">Cambiar la renta</button><button class="btn peq" data-a="renovar" data-id="${i}">Renovar</button><button class="btn peq" data-a="editarContrato" data-id="${i}">Editar</button></div>` : `<div class="acc"><button class="btn peq" data-a="renovar" data-id="${i}">Reactivar y renovar</button></div>`}
      <h3>Fianza</h3><p class="sub">Acordada: ${eur(ct.fianza)} · En depósito: <b>${eur(saldo)}</b></p>
      ${fz.length ? `<table class="t">${fz.map((f) => `<tr><td>${fecha(f.fecha)} · ${f.tipo}</td><td>${eur(f.importe)}</td></tr>`).join('')}</table>` : ''}
      <div class="acc"><button class="btn peq" data-a="fianza" data-id="${i}" data-t="recibida">Recibida</button>${saldo > 0 ? `<button class="btn peq" data-a="fianza" data-id="${i}" data-t="devuelta">Devolver</button><button class="btn peq" data-a="fianza" data-id="${i}" data-t="retenida">Retener</button>` : ''}</div>
      <h3>Recibos</h3>${cs.slice(0, 24).map((c) => `<div class="tar toca" data-a="cobro" data-id="${c.id}"><div class="fila"><span>${fmes(c.periodo)}</span><span class="imp">${eur(c.importe)}</span></div><div class="fila"><span class="sub">${c.pagado ? 'Cobrado ' + eur(c.pagado) : 'Vence ' + fecha(c.vence)}</span>${chip(E_CARGO, c.estado)}</div></div>`).join('')}
      ${cs.length > 24 ? `<p class="sub">Y ${cs.length - 24} recibos anteriores (están en Cobros y en la exportación).</p>` : ''}
      <h3>Contrato</h3><div class="acc">${ct.fin && ct.estado === 'activo' ? `<button class="btn" data-a="avisoFin" data-id="${i}">Avisar del vencimiento</button>` : ''}
        ${ct.estado === 'activo' ? `<button class="btn" data-a="finalizar" data-id="${i}">Finalizar</button>` : ''}<button class="btn rojo" data-a="eliminarContrato" data-id="${i}">Eliminar</button></div>`);
  }
  function fichaCobro(i) {
    const c = MA.cargos(S, HOY, (x) => x.id === i)[0]; if (!c) return cerrar();
    const ps = S.pagos.filter((p) => p.cargoId === i).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id), vivo = c.estado !== 'pagado' && c.estado !== 'anulado';
    hoja(`${c.inquilino} · ${fmes(c.periodo)}`, `<p>${chip(E_CARGO, c.estado)} <span class="sub">${h(c.inmueble)} · vence ${fecha(c.vence)}</span></p>
      <div class="kpis"><div class="kpi"><span>Renta</span><b>${eur(c.importe)}</b></div><div class="kpi"><span>Pendiente</span><b>${eur(c.pendiente)}</b></div></div>
      ${c.anulado ? `<p class="nota">Anulado el ${fecha(c.anulado.fecha)}: ${h(c.anulado.motivo)}</p>` : ''}
      ${vivo ? `<h3>Registrar un cobro</h3><form id="fpago" novalidate><div class="error" hidden role="alert"></div><div class="dos">${campos([{ k: 'importe', e: 'Importe', t: 'dinero' }, { k: 'fecha', e: 'Fecha', t: 'date' }], { importe: c.pendiente, fecha: HOY })}</div>
        ${campos([{ k: 'metodo', e: 'Método', t: 'select', op: ['Transferencia', 'Bizum', 'Efectivo', 'Domiciliación', 'Otro'].map((x) => [x, x]) }, { k: 'repartir', t: 'check', e: 'Si sobra, aplicarlo a otros recibos pendientes de este contrato' }], { metodo: c.metodo || 'Transferencia' })}
        <button class="btn pri ancho" type="submit">Registrar cobro</button></form>` : ''}
      ${ps.length ? `<h3>Cobros de este recibo</h3>${ps.map((p) => `<div class="tar${p.anulado ? ' apagada' : ''}"><div class="fila"><span>${fecha(p.fecha)} · ${h(p.metodo || '—')}${p.origen === 'estimado' ? ' · estimado' : ''}</span><span class="imp">${eur(p.importe)}</span></div>
        ${p.anulado ? `<div class="sub">Anulado el ${fecha(p.anulado.fecha)}: ${h(p.anulado.motivo)}</div>` : `<div class="acc"><button class="btn peq rojo" data-a="anularPago" data-id="${p.id}" data-c="${i}">Anular este cobro</button></div>`}</div>`).join('')}` : ''}
      <h3>Más</h3><div class="acc">${vivo ? `<button class="btn" data-a="avisar" data-id="${i}">Avisar al inquilino</button>` : ''}${c.pagado ? `<button class="btn" data-a="recibo" data-id="${i}">Confirmar por WhatsApp</button>` : ''}
        ${!c.anulado ? `<button class="btn" data-a="ajustarCargo" data-id="${i}">Cambiar el importe</button>` : ''}${c.anulado ? `<button class="btn" data-a="restaurarCargo" data-id="${i}">Recuperar el recibo</button>` : !c.pagado ? `<button class="btn rojo" data-a="anularCargo" data-id="${i}">Anular el recibo</button>` : ''}</div>`, (el) => {
      const f = $('#fpago', el); if (!f) return; const k = clave(); let enviando = false;
      f.onsubmit = (e) => { e.preventDefault(); if (enviando) return; enviando = true;
        try { const d = leer(f, [{ k: 'importe', t: 'dinero' }, { k: 'fecha' }, { k: 'metodo' }, { k: 'repartir', t: 'check' }]);
          if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' });
          MA.registrarPago(S, { cargoId: i, ...d, clave: k }, HOY); guardar(); pinta(); fichaCobro(i); toast('Cobro registrado'); }
        catch (x) { enviando = false; const b = $('.error', f); b.textContent = x.code ? x.message : 'No se ha podido registrar.'; b.hidden = false; } };
    });
  }
  function formGasto() {
    formulario({ titulo: 'Nuevo gasto', valores: { fecha: HOY, categoria: 'mantenimiento', pagado: true }, defs: [{ k: 'inmuebleId', e: 'Inmueble', t: 'select', op: opInmuebles() }, { k: 'concepto', e: 'Concepto', req: 1 },
      { k: 'categoria', e: 'Categoría', t: 'select', op: Object.entries(MA.CATEGORIAS).filter(([a]) => a !== 'financiacion') }, { k: 'importe', e: 'Importe', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' },
      { k: 'pagado', t: 'check', e: 'Ya está pagado' }, { k: 'repercutir', e: 'Parte que le cobras al inquilino (opcional)', t: 'dinero' }, { k: 'notas', e: 'Notas', t: 'area' }],
      alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.crearGasto(S, { ...d, inmuebleId: Number(d.inmuebleId), repercutir: d.repercutir || 0 }, HOY); } });
  }
  function fichaGasto(i) {
    const g = MA.gastos(S, HOY, (x) => x.id === i)[0]; if (!g) return cerrar();
    const rs = S.reembolsos.filter((r) => r.gastoId === i), pte = !g.pagado && !g.anulado;
    hoja(`${g.concepto} · ${g.inmueble}`, `<p>${chip(E_GASTO, g.estado)} <span class="sub">${h(MA.CATEGORIAS[g.categoria])} · ${h(g.periodo)} · ${fecha(g.fecha)}</span></p>
      <div class="kpis"><div class="kpi"><span>Importe${g.estimado ? ' (estimado)' : ''}</span><b>${eur(g.importe)}</b></div><div class="kpi"><span>${g.pagado ? 'Pagado el' : 'Estado'}</span><b>${g.pagado ? fecha(g.pagado.fecha) : E_GASTO[g.estado][0]}</b></div></div>
      ${g.anulado ? `<p class="nota">Anulado el ${fecha(g.anulado.fecha)}: ${h(g.anulado.motivo)}</p>` : ''}
      ${pte ? `<h3>Marcar como pagado</h3><form id="fgasto" novalidate><div class="error" hidden role="alert"></div><div class="dos">${campos([{ k: 'importe', e: 'Importe real', t: 'dinero' }, { k: 'fecha', e: 'Fecha de pago', t: 'date' }], { importe: g.importe, fecha: g.fecha <= HOY ? g.fecha : HOY })}</div><button class="btn pri ancho" type="submit">Pagado</button></form>` : ''}
      ${g.repercutir > 0 && !g.anulado ? `<h3>Cobro al inquilino</h3><p class="sub">${h(g.inquilino)} debe pagarte ${eur(g.repercutir)}. Cobrado: ${eur(g.cobrado)}.</p>
        ${rs.map((r) => `<div class="tar${r.anulado ? ' apagada' : ''}"><div class="fila"><span>${fecha(r.fecha)}${r.anulado ? ' · anulado' : ''}</span><span class="imp">${eur(r.importe)}</span></div>${r.anulado ? '' : `<div class="acc"><button class="btn peq rojo" data-a="anularReembolso" data-id="${r.id}" data-g="${i}">Anular</button></div>`}</div>`).join('')}
        ${g.porCobrar > 0 ? `<div class="acc"><button class="btn pri" data-a="cobrarGasto" data-id="${i}">Registrar cobro</button><button class="btn" data-a="avisarGasto" data-id="${i}">Avisar al inquilino</button></div>` : ''}` : ''}
      <h3>Más</h3><div class="acc">${g.pagado && !g.anulado ? `<button class="btn" data-a="desconfirmar" data-id="${i}">No está pagado (recibo devuelto)</button>` : ''}${!g.anulado ? `<button class="btn rojo" data-a="anularGasto" data-id="${i}">Anular el gasto</button>` : ''}</div>`, (el) => {
      const f = $('#fgasto', el); if (!f) return;
      f.onsubmit = (e) => { e.preventDefault();
        try { const d = leer(f, [{ k: 'importe', t: 'dinero' }, { k: 'fecha' }]); MA.confirmarGasto(S, i, { importe: d.importe == null ? undefined : d.importe, fecha: d.fecha || undefined }, HOY); guardar(); pinta(); fichaGasto(i); }
        catch (x) { const b = $('.error', f); b.textContent = x.code ? x.message : 'No se ha podido guardar.'; b.hidden = false; } };
    });
  }

  // ---------- Versión completa ----------
  async function hojaPro(motivo) {
    if (S.pro) return hoja('Versión completa', '<p>Ya tienes la versión completa: puedes añadir todos los inmuebles que quieras. Gracias.</p>');
    hoja('Versión completa', `${motivo ? `<p class="nota">${h(motivo)}</p>` : ''}<p>La app es gratuita con un inmueble. Con un <b>pago único</b> añades todos los que quieras, para siempre y sin suscripción.</p>
      ${Tienda.disponible ? `<div class="acc"><button class="btn pri ancho" data-x="comprar" disabled>Consultando precio…</button><button class="btn ancho" data-x="recuperar">Ya la compré: recuperar la compra</button></div>`
        : '<p class="sub">La compra se hace desde la app de Android, a través de Google Play.</p>'}`, (el) => {
      if (!Tienda.disponible) return;
      const b = $('[data-x=comprar]', el);
      Tienda.precio().then((p) => { b.textContent = p ? `Desbloquear por ${p}` : 'Desbloquear'; b.disabled = false; }).catch(() => { b.textContent = 'Google Play no está disponible ahora'; });
      const activa = () => { S.pro = true; localStorage.setItem('ma.pro', '1'); cerrar(); pinta(); toast('Versión completa activada'); };
      b.onclick = async () => { b.disabled = true; try { if (await Tienda.comprar()) activa(); else { toast('La compra está pendiente de confirmación'); b.disabled = false; } } catch (e) { toast('No se ha completado la compra'); b.disabled = false; } };
      $('[data-x=recuperar]', el).onclick = async () => { try { if (await Tienda.tiene()) activa(); else toast('No hay ninguna compra en esta cuenta de Google'); } catch (e) { toast('No se ha podido consultar Google Play'); } };
    });
  }
  async function comprobarCompra() {
    S.pro = localStorage.getItem('ma.pro') === '1';
    if (!Tienda.disponible) return;
    try { const t = await Tienda.tiene(); if (t !== S.pro) { S.pro = t; localStorage.setItem('ma.pro', t ? '1' : '0'); pinta(); } } catch (e) { /* sin conexión: vale lo último conocido */ }
  }

  // ---------- Acciones (un solo manejador de clics) ----------
  const A = {
    cerrar, ayuda() { hoja('Ayuda', AYUDA); }, pro() { hojaPro(); },
    mes(_, el) { V.mes = MA.mesMas(V.mes, +el.dataset.d); pinta(); }, anio(_, el) { V.anio = String(+V.anio + +el.dataset.d); pinta(); }, verArchivados() { V.archivados = !V.archivados; pinta(); },
    nuevoInmueble() { if (!MA.puedeCrearInmueble(S)) return hojaPro('La versión gratuita admite un inmueble.'); formInmueble(); }, inmueble: fichaInmueble, editarInmueble(i) { formInmueble(por(S.inmuebles, i)); },
    archivarInmueble(i) { const p = por(S.inmuebles, i); if (haz(() => MA.archivarInmueble(S, i, !p.archivado, HOY))) fichaInmueble(i); },
    eliminarInmueble(i) { confirma('Eliminar inmueble', 'Solo se puede eliminar si no tiene contratos ni gastos pagados. Si tiene historial, archívalo.', 'Eliminar', () => haz(() => MA.eliminarInmueble(S, i))); },
    tipicos(i) { haz(() => MA.cargarTipicos(S, i, HOY), (n) => { fichaInmueble(i); toast(n ? `Añadidos ${n} conceptos: ponles importe` : 'Ya estaban todos'); }); },
    nuevoConcepto(i) { formConcepto(null, i); }, concepto(i) { formConcepto(por(S.conceptos, i)); },
    eliminarConcepto(i) { const c = por(S.conceptos, i); haz(() => MA.eliminarConcepto(S, i, HOY), () => fichaInmueble(c.inmuebleId)); },
    hipoteca: formHipoteca, quitarHipoteca(i) { haz(() => MA.ponerHipoteca(S, i, null, HOY), () => fichaInmueble(i)); },
    nuevoInquilino() { formInquilino(); }, inquilino(i) { formInquilino(por(S.inquilinos, i)); }, chat(i) { window.Plataforma.abrir('https://wa.me/' + telWa(por(S.inquilinos, i).telefono)); },
    archivarInquilino(i) { const q = por(S.inquilinos, i); haz(() => MA.archivarInquilino(S, i, !q.archivado), cerrar); }, eliminarInquilino(i) { haz(() => MA.eliminarInquilino(S, i), cerrar); },
    nuevoContrato: formContrato, contrato: fichaContrato,
    editarContrato(i) { const ct = por(S.contratos, i); formulario({ titulo: 'Editar contrato', valores: ct, defs: [{ k: 'inicio', e: 'Fecha de inicio', t: 'date' }, { k: 'fin', e: 'Fecha de fin (vacía si no tiene)', t: 'date' }, { k: 'diaCobro', e: 'Día de cobro', t: 'num' },
      { k: 'fianza', e: 'Fianza acordada', t: 'dinero' }, { k: 'avisoMeses', e: 'Avisar del vencimiento con (meses)', t: 'num' }, { k: 'notas', e: 'Notas', t: 'area' }],
      alGuardar: (d) => MA.editarContrato(S, i, { ...d, fin: d.fin || null, fianza: d.fianza || 0 }, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Para cambiar la renta usa «Cambiar la renta»: así queda guardado desde qué mes se aplica.</p>' }); },
    revisar(i) { const ct = por(S.contratos, i); formulario({ titulo: 'Cambiar la renta', valores: { desde: MA.mesMas(HOY.slice(0, 7), 1), importe: MA.rentaActual(ct, HOY) }, defs: [{ k: 'importe', e: 'Nueva renta mensual', t: 'dinero', req: 1 }, { k: 'desde', e: 'Se aplica desde el mes', t: 'month', req: 1 }],
      alGuardar: (d) => MA.revisarRenta(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Los recibos ya cobrados, total o parcialmente, conservan su importe.</p>' }); },
    renovar(i) { const ct = por(S.contratos, i), f = MA.finEfectivo(ct); formulario({ titulo: 'Renovar contrato', boton: 'Renovar', valores: { fin: f ? MA.masDias(MA.masMeses(MA.masDias(f, 1), 12), -1) : '', importe: MA.rentaActual(ct, HOY) },
      defs: [{ k: 'fin', e: 'Nueva fecha de fin (vacía si pasa a no tener)', t: 'date' }, { k: 'importe', e: 'Renta mensual desde la renovación', t: 'dinero' }],
      alGuardar: (d) => MA.renovarContrato(S, i, { fin: d.fin || null, importe: d.importe != null && d.importe !== MA.rentaActual(ct, HOY) ? d.importe : null }, HOY), despues: () => fichaContrato(i) }); },
    finalizar(i) { formulario({ titulo: 'Finalizar contrato', boton: 'Finalizar', valores: { fecha: HOY, estado: 'finalizado' }, defs: [{ k: 'fecha', e: 'Último día del contrato', t: 'date', req: 1 }, { k: 'estado', e: 'Motivo', t: 'select', op: [['finalizado', 'Ha terminado'], ['rescindido', 'Se ha rescindido antes de tiempo']] }],
      alGuardar: (d) => MA.finalizarContrato(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Los recibos posteriores sin cobros se anulan. Los cobros y el historial se conservan.</p>' }); },
    eliminarContrato(i) { confirma('Eliminar contrato', 'Solo se puede eliminar un contrato sin cobros ni fianza (por ejemplo, uno creado por error). Si ya tiene historial, finalízalo.', 'Eliminar', () => haz(() => MA.eliminarContrato(S, i))); },
    avisoFin(i) { const ct = por(S.contratos, i), q = por(S.inquilinos, ct.inquilinoId), p = por(S.inmuebles, ct.inmuebleId);
      enviar('Mensaje a ' + q.nombre, q.telefono, MA.mensaje(S.plantillas.vencimiento, { ...comunes(), nombre: pila(q.nombre), inmueble: p.nombre, fecha_fin: fecha(ct.fin) }), () => { ct.avisoEnviado = HOY; guardar(); }); },
    fianza(i, el) { const t = el.dataset.t, ct = por(S.contratos, i), k = clave(); formulario({ titulo: { recibida: 'Fianza recibida', devuelta: 'Devolver fianza', retenida: 'Retener fianza' }[t], valores: { importe: t === 'recibida' ? ct.fianza || '' : MA.saldoFianza(S, i), fecha: HOY },
      defs: [{ k: 'importe', e: 'Importe', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' }, { k: 'notas', e: t === 'retenida' ? 'Motivo de la retención' : 'Notas' }],
      alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.registrarFianza(S, { contratoId: i, tipo: t, ...d, clave: k }, HOY); }, despues: () => fichaContrato(i) }); },
    cobro: fichaCobro,
    cobrado(i, el) { const c = MA.cargos(S, HOY, (x) => x.id === i)[0]; if (!c || !c.pendiente) return;
      haz(() => MA.registrarPago(S, { cargoId: i, importe: c.pendiente, metodo: c.metodo || '', clave: el.dataset.k }, HOY), (r) => { if (!r.repetido) toast(`Cobrado ${eur(c.pendiente)} de ${c.inquilino}`, 'Deshacer', () => haz(() => r.pagos.forEach((p) => MA.anularPago(S, p, 'Marcado por error', HOY)))); }); },
    avisar(i) { const c = MA.cargos(S, HOY, (x) => x.id === i)[0]; msgCobro(c, c.estado === 'atrasado' ? 'atraso' : 'cobro'); }, recibo(i) { msgCobro(MA.cargos(S, HOY, (x) => x.id === i)[0], 'recibo'); },
    anularPago(i, el) { confirma('Anular este cobro', 'El cobro dejará de contar, pero seguirá en el historial como anulado.', 'Anular', (m) => haz(() => MA.anularPago(S, i, m, HOY), () => fichaCobro(+el.dataset.c)), true); },
    anularCargo(i) { confirma('Anular el recibo', 'Úsalo si ese mes no corresponde cobrar. Podrás recuperarlo después.', 'Anular', (m) => haz(() => MA.anularCargo(S, i, m, HOY), () => fichaCobro(i)), true); },
    restaurarCargo(i) { haz(() => MA.restaurarCargo(S, i, HOY), () => fichaCobro(i)); },
    ajustarCargo(i) { const c = por(S.cargos, i); formulario({ titulo: 'Cambiar el importe del recibo', valores: { importe: c.importe }, defs: [{ k: 'importe', e: 'Importe de este mes', t: 'dinero', req: 1 }], alGuardar: (d) => MA.ajustarCargo(S, i, d.importe == null ? -1 : d.importe, HOY), despues: () => fichaCobro(i),
      pie: '<p class="sub">Solo cambia este recibo. Para cambiar la renta de aquí en adelante, usa «Cambiar la renta» en el contrato.</p>' }); },
    nuevoGasto() { if (!opInmuebles().length) return toast('Añade antes un inmueble'); formGasto(); }, gasto: fichaGasto,
    gastoPagado(i) { haz(() => MA.confirmarGasto(S, i, {}, HOY), () => toast('Gasto marcado como pagado', 'Deshacer', () => haz(() => MA.desconfirmarGasto(S, i, 'Marcado por error', HOY)))); },
    desconfirmar(i) { haz(() => MA.desconfirmarGasto(S, i, 'Recibo devuelto o marcado por error', HOY), () => fichaGasto(i)); },
    anularGasto(i) { confirma('Anular el gasto', 'Dejará de contar en las cuentas, pero seguirá visible como anulado.', 'Anular', (m) => haz(() => MA.anularGasto(S, i, m, HOY), () => fichaGasto(i)), true); },
    cobrarGasto(i) { const g = MA.gastos(S, HOY, (x) => x.id === i)[0], k = clave(); formulario({ titulo: 'Cobro de ' + g.concepto, valores: { importe: g.porCobrar, fecha: HOY }, defs: [{ k: 'importe', e: 'Importe recibido', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' }],
      alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.registrarReembolso(S, { gastoId: i, ...d, clave: k }, HOY); }, despues: () => fichaGasto(i) }); },
    anularReembolso(i, el) { haz(() => MA.anularReembolso(S, i, 'Anulado', HOY), () => fichaGasto(+el.dataset.g)); },
    avisarGasto(i) { const g = MA.gastos(S, HOY, (x) => x.id === i)[0];
      enviar('Mensaje a ' + g.inquilino, g.telefono, MA.mensaje(S.plantillas.gasto, { ...comunes(), nombre: pila(g.inquilino), inmueble: g.inmueble, concepto: g.concepto, periodo: g.periodo, importe: eur(g.porCobrar) }), () => { por(S.gastos, i).recordatorio = HOY; guardar(); }); },
    misDatos() { formulario({ titulo: 'Mis datos', valores: S.ajustes, defs: [{ k: 'propietario', e: 'Tu nombre (firma de los mensajes)' }, { k: 'formaPago', e: 'Forma de pago que indicas al inquilino', ayuda: 'Por ejemplo: Bizum al 600 000 000 o transferencia a ES00…' }], alGuardar: (d) => Object.assign(S.ajustes, d) }); },
    plantillas() { const n = { cobro: 'Recordatorio de cobro', atraso: 'Pago atrasado', recibo: 'Confirmación de pago', gasto: 'Cobro de un gasto', vencimiento: 'Vencimiento de contrato' };
      formulario({ titulo: 'Mensajes', valores: S.plantillas, defs: Object.keys(n).map((k) => ({ k, e: n[k], t: 'area' })), alGuardar: (d) => { for (const k of Object.keys(n)) S.plantillas[k] = d[k] || MA.PLANTILLAS[k]; },
        pie: '<p class="sub">Entre llaves van los datos que se rellenan solos: {nombre}, {inmueble}, {mes}, {importe}, {deuda}, {fecha_cobro}, {forma_pago}, {propietario}… Si dejas un mensaje vacío vuelve el texto original.</p>' }); },
    avisosConf() { if (!Avisos.disponible) return toast('Los avisos están disponibles en la app de Android');
      formulario({ titulo: 'Avisos en el móvil', valores: { avisos: !!S.ajustes.avisos, horaAvisos: S.ajustes.horaAvisos || 9 }, defs: [{ k: 'avisos', t: 'check', e: 'Avisarme de cobros, vencimientos y gastos', ayuda: 'El día que vence cada recibo, cuando hay atrasos y cuando un contrato está a punto de terminar.' },
        { k: 'horaAvisos', e: 'Hora del aviso', t: 'select', op: [7, 8, 9, 10, 12, 14, 17, 19, 20].map((x) => [x, x + ':00']) }],
        alGuardar: (d) => { S.ajustes.avisos = d.avisos; S.ajustes.horaAvisos = Number(d.horaAvisos); if (d.avisos) Avisos.permiso(true).then((ok) => { if (!ok) { S.ajustes.avisos = false; guardar(); pinta(); toast('Android no ha dado permiso para mostrar avisos'); } else guardar(); }); } }); },
    copia() { Archivos.compartir(`mis-alquileres-copia-${HOY}.json`, MA.exportar(S), 'application/json').then(() => toast('Copia preparada')).catch(() => toast('No se ha podido crear la copia')); },
    restaurar() { hoja('Recuperar una copia', '<p class="nota">Los datos actuales se sustituirán por los de la copia. Si quieres conservarlos, guarda antes una copia.</p><label class="f">Archivo de copia (.json)<input type="file" id="fcopia" accept=".json,application/json"></label>', (el) => {
      $('#fcopia', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
        try { const n = MA.importar(await f.text()); n.pro = S.pro; S = n; alDia(); guardar(); cerrar(); location.hash = '#inicio'; pinta(); toast('Copia recuperada'); } catch (x) { fallo(x); } }; }); },
    csv(_, el) { const t = el.dataset.t; Archivos.compartir(`${t.toLowerCase()}-${HOY}.csv`, MA['csv' + t](S, HOY), 'text/csv').catch(() => toast('No se ha podido exportar')); },
    historial() { const n = { pago: 'Cobro', pago_anulado: 'Cobro anulado', recibo_anulado: 'Recibo anulado', recibo_restaurado: 'Recibo recuperado', recibo_ajustado: 'Importe de recibo cambiado', contrato_creado: 'Contrato creado', contrato_editado: 'Contrato editado',
      contrato_finalizado: 'Contrato finalizado', contrato_rescindido: 'Contrato rescindido', contrato_renovado: 'Contrato renovado', renta_revisada: 'Renta cambiada', gasto_creado: 'Gasto añadido', gasto_confirmado: 'Gasto pagado', gasto_desconfirmado: 'Gasto vuelto a pendiente',
      gasto_anulado: 'Gasto anulado', reembolso: 'Cobro de gasto al inquilino', inmueble_creado: 'Inmueble añadido', inmueble_archivado: 'Inmueble archivado', inmueble_recuperado: 'Inmueble recuperado', fianza_recibida: 'Fianza recibida', fianza_devuelta: 'Fianza devuelta', fianza_retenida: 'Fianza retenida' };
      const l = S.registro.slice(-150).reverse();
      hoja('Historial de cambios', l.length ? `<table class="t">${l.map((r) => `<tr><td>${fecha(r.fecha)} · ${h(n[r.que] || r.que)}</td><td>${r.detalle && r.detalle.importe != null ? eur(r.detalle.importe) : ''}</td></tr>`).join('')}</table>` : '<p class="sub">Aún no hay cambios anotados.</p>'); },
    privacidad() { hoja('Privacidad', PRIVACIDAD); },
    borrarTodo() { confirma('Borrar todos los datos', 'Se eliminarán inmuebles, inquilinos, contratos, cobros y gastos de este dispositivo. No se puede deshacer: guarda antes una copia si los quieres conservar.', 'Borrar todo', () => { const pro = S.pro; S = MA.nuevo(); S.pro = pro; guardar(); location.hash = '#inicio'; pinta(); toast('Datos borrados'); }); },
  };
  const AYUDA = `<h3>Cómo funciona</h3><p>Añade un <b>inmueble</b>, su <b>inquilino</b> y el <b>contrato</b>. Cada mes la app crea el recibo de alquiler. Cuando te paguen, pulsa <b>Cobrado</b> o abre el recibo para apuntar un pago parcial.</p>
    <h3>Estados de un recibo</h3><p><b>Pendiente</b>: aún no ha vencido. <b>A medias</b>: has cobrado una parte. <b>Atrasado</b>: ha pasado la fecha y falta dinero. <b>Cobrado</b>: completo. <b>Anulado</b>: ese mes no se cobra.</p>
    <h3>Gastos</h3><p>En la ficha de cada inmueble defines los gastos periódicos (IBI, comunidad, seguro…) y quién los paga. <b>Previsto</b>: todavía no toca. <b>Sin pagar</b>: ha pasado la fecha. <b>Por confirmar</b>: está domiciliado; comprueba el cargo en el banco y confírmalo. La app nunca da un gasto por pagado sin que tú lo digas.</p>
    <h3>Nada se pierde</h3><p>Los cobros y gastos no se borran: se anulan y quedan en el historial. Lo marcado como «estimado» es lo anterior a empezar a usar la app.</p>
    <h3>Mensajes</h3><p>La app prepara el texto y abre WhatsApp; el mensaje lo envías tú. No envía nada por su cuenta.</p>
    <h3>Tus datos</h3><p>Están solo en este dispositivo. Guarda una copia de seguridad de vez en cuando desde Más › Ajustes y copias.</p>
    <h3>Cuentas orientativas</h3><p>Las cifras del panel son un resumen de lo que has apuntado. No sustituyen a tu contabilidad ni a un asesor fiscal.</p>`;
  const PRIVACIDAD = `<p>Mis alquileres guarda todos los datos <b>solo en este dispositivo</b>. No hay cuentas, no se envía nada a servidores de IT Canarias ni de terceros, y no hay publicidad ni seguimiento.</p>
    <p>Los datos de tus inquilinos (nombre, teléfono, DNI) los introduces tú y eres responsable de ellos. Salen del dispositivo únicamente cuando tú compartes una copia, una exportación o un mensaje.</p>
    <p>La compra de la versión completa la gestiona Google Play; la app solo recibe si está comprada. Para borrar todos los datos usa «Borrar todos los datos» o desinstala la app.</p>
    <p class="sub">IT Canarias · itcanarias.com</p>`;

  const RAPIDAS = new Set(['cobrado', 'gastoPagado']); let tRapida = 0, uRapida = '';
  document.addEventListener('click', (e) => {
    if (e.target.id === 'fondo') return cerrar();
    const el = e.target.closest('[data-a]'); if (!el) return;
    const fn = A[el.dataset.a]; if (!fn) return;
    e.preventDefault(); e.stopPropagation();
    // Tras un cobro rápido la lista se recoloca: una segunda pulsación seguida no debe caer en el recibo siguiente
    if (RAPIDAS.has(el.dataset.a)) { if (uRapida === el.dataset.a && Date.now() - tRapida < 600) return; tRapida = Date.now(); uRapida = el.dataset.a; }
    try { fn(el.dataset.id ? Number(el.dataset.id) : undefined, el); } catch (x) { fallo(x); }
  });
  window.addEventListener('hashchange', () => { cerrar(); $('#vista').scrollTop = 0; pinta(); });
  window.Plataforma.alVolver(() => { const antes = HOY; alDia(); if (HOY !== antes) pinta(); });

  // ---------- Arranque ----------
  (async function arrancar() {
    try { const txt = await Almacen.cargar(); if (txt) S = MA.importar(txt); } catch (e) { console.error(e); toast('No se han podido leer los datos guardados'); }
    await comprobarCompra(); alDia(); pinta(); guardar();
    if (!NATIVO && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.__ma = { get S() { return S; }, pinta }; // para las pruebas automáticas
  })();
})();
