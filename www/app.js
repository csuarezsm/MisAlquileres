/* Mis alquileres — interfaz. © 2026 IT Canarias. Las reglas están en nucleo.js; aquí solo se pinta y se recoge lo que escribe el usuario. */
(function () {
  'use strict';
  const APP_VERSION = '1.1.0';
  const { Almacen, Archivos, Avisos, Tienda, Adjuntos, NATIVO } = window.Plataforma;
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
  const V = { mes: HOY.slice(0, 7), anio: HOY.slice(0, 4), renta: +HOY.slice(0, 4) - 1, archivados: false };

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
  // toast(mensaje) · toast(mensaje, 'Acción', fn) · toast(mensaje, [['Acción', fn], ['Otra', fn2]])
  function toast(msg, accion, fn) {
    const acc = Array.isArray(accion) ? accion : accion ? [[accion, fn]] : [], t = $('#toast');
    t.innerHTML = `<span>${h(msg)}</span><span>${acc.map((a, i) => `<button data-t="${i}">${h(a[0])}</button>`).join('')}</span>`; t.hidden = false;
    t.querySelectorAll('button').forEach((b) => { b.onclick = () => { t.hidden = true; acc[+b.dataset.t][1](); }; });
    clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, acc.length ? 8000 : 3500);
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
    el.querySelectorAll('[data-docs]').forEach(montarDocs);
    ($('input:not([type=hidden]):not([type=file]),select,textarea', el) || $('.cerrar', el)).focus({ preventScroll: true });
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
    if (!tipo) { const e = MA.escalon(c, HOY); tipo = e === 2 ? 'atraso2' : c.estado === 'atrasado' || c.vence < HOY ? 'atraso' : 'cobro'; }
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
      ${(() => { const e = MA.escalon(c, HOY); return e && !(c.recordatorio && c.recordatorio >= MA.masDias(HOY, -2)) ? `<div class="sub"><span class="chip ${e === 2 ? 'mal' : 'avi'}">${e === 2 ? 'Toca un recordatorio firme' : 'Toca recordárselo'}</span></div>` : ''; })()}
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
  function tareaTar(x) {
    const d = x.dias == null ? '' : x.dias < 0 ? ` · hace ${-x.dias} días` : x.dias === 0 ? ' · hoy' : ` · en ${x.dias} días`;
    const T = { actualizacion: ['Actualizar la renta', `${x.titulo} · ${fecha(x.fecha)} (${x.indice === 'fijo' ? 'pactado' : String(x.indice || '').toUpperCase()})`, 'actualizar', 'avi'],
      fianza_deposito: ['Depositar la fianza', `${x.titulo} · ${eur(x.importe)} · plazo hasta el ${fecha(x.fecha)}`, 'deposito', x.dias < 0 ? 'mal' : 'avi'],
      fianza_devolver: ['Devolver la fianza', `${x.titulo} · ${eur(x.importe)} · antes del ${fecha(x.fecha)}`, 'contrato', x.dias < 0 ? 'mal' : 'avi'],
      fianza_recuperar: ['Recuperar la fianza depositada', `${x.titulo} · ${x.organismo || ''}`, 'contrato', ''],
      copia: ['Guarda una copia de tus datos', `${x.titulo}. Guárdala en Google Drive o envíatela por correo.`, 'copia', 'avi'] }[x.tipo];
    return `<div class="tar toca" data-a="${T[2]}" data-id="${x.id}"><div class="fila"><span class="tit">${h(T[0])}</span><span class="chip ${T[3]}">${x.tipo === 'copia' ? 'Copia' : 'Pendiente'}</span></div><div class="sub">${h(T[1])}${h(d)}</div></div>`;
  }
  const vacio = (t, s, boton) => `<div class="vacio"><b>${h(t)}</b>${h(s)}${boton ? `<div class="acc" data-centro><button class="btn pri" data-a="${boton[0]}">${h(boton[1])}</button></div>` : ''}</div>`;
  const sec = (t, lado, cuerpo) => (cuerpo ? `<section class="sec"><h2>${h(t)}${lado ? `<b>${h(lado)}</b>` : ''}</h2>${cuerpo}</section>` : '');

  // ---------- Vistas ----------
  const VISTAS = {
    inicio() {
      if (!S.inmuebles.length) return `<div class="vacio"><b>Empieza en un minuto</b>Apunta el inmueble, quién lo alquila y cuánto paga. La app creará los recibos de cada mes y te avisará.
        <div class="acc" data-centro><button class="btn pri" data-a="altaRapida">Alta rápida</button></div>
        <div class="acc" data-centro><button class="btn" data-a="importarCartera">Importar desde Excel</button><button class="btn" data-a="nuevoInmueble">Paso a paso</button></div></div>`;
      if (!S.contratos.length) return vacio('Ahora, el contrato', 'Indica quién alquila el inmueble, desde cuándo y cuánto paga.', ['nuevoContrato', 'Crear contrato']);
      const k = MA.panel(S, HOY), cs = MA.cargos(S, HOY, (c) => !c.anulado), gs = MA.gastos(S, HOY, (g) => !g.anulado), finMes = MA.masMeses(HOY.slice(0, 7) + '-01', 1);
      const atras = cs.filter((c) => c.estado === 'atrasado'), mes = cs.filter((c) => (c.estado === 'pendiente' || c.estado === 'parcial') && c.vence < finMes);
      const vencen = S.contratos.filter((ct) => ['por_vencer', 'vencido'].includes(MA.situacionContrato(ct, HOY)));
      const gPte = gs.filter((g) => !g.pagado && g.fecha < finMes).reverse(), gCob = gs.filter((g) => g.porCobrar > 0 && g.pagado);
      const m = k.mesActual, tareas = MA.avisosApp(S, HOY).filter((x) => /^(actualizacion|fianza_|copia)/.test(x.tipo));
      return `${sec('Para hacer', '', tareas.map(tareaTar).join(''))}<section class="sec"><div class="tar"><div class="fila"><span class="tit">${fmes(k.mes)}</span><span class="imp">${eur(m.cobrado)} de ${eur(m.esperado)}</span></div>
          <div class="prog"><i data-w="${m.porcentaje || 0}"></i></div><div class="sub">${m.pendiente ? `Faltan ${eur(m.pendiente)} por cobrar este mes` : m.esperado ? 'Todo cobrado este mes' : 'Sin recibos este mes'}</div></div></section>
        ${sec('Atrasados', eur(k.morosidad.deuda), atras.map((c) => cobroTar(c, true)).join(''))}
        ${sec('Por cobrar este mes', '', mes.map((c) => cobroTar(c)).join(''))}
        ${sec('Contratos que vencen', '', vencen.map(contratoTar).join(''))}
        ${sec('Gastos por atender', '', gPte.map(gastoTar).join(''))}
        ${sec('Por cobrar al inquilino', eur(k.gastosPorCobrar), gCob.map(gastoTar).join(''))}
        ${!atras.length && !mes.length && !vencen.length && !gPte.length && !gCob.length && !tareas.length ? vacio('Todo al día', 'No hay cobros, contratos ni gastos pendientes de atender.') : ''}`;
    },
    cobros() {
      const cs = MA.cargos(S, HOY, (c) => c.periodo === V.mes), vivos = cs.filter((c) => c.estado !== 'anulado');
      const esp = vivos.reduce((t, c) => t + c.importe, 0), cob = vivos.reduce((t, c) => t + Math.min(c.pagado, c.importe), 0);
      return `<div class="nav"><button data-a="mes" data-d="-1" aria-label="Mes anterior">‹</button><b>${fmes(V.mes)}</b><button data-a="mes" data-d="1" aria-label="Mes siguiente"${V.mes >= HOY.slice(0, 7) ? ' disabled' : ''}>›</button></div>
        <div class="kpis"><div class="kpi"><span>Cobrado</span><b>${eur(cob)}</b></div><div class="kpi"><span>Pendiente</span><b>${eur(esp - cob)}</b></div></div>
        ${S.contratos.length ? '<button class="btn ancho peq esp" data-a="extracto">Apuntar cobros desde el extracto del banco</button>' : ''}
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
        <a href="#panel">Panel<small>Ocupación, morosidad y rentabilidad</small></a><a href="#renta">Informe para la Renta<small>Ingresos, gastos deducibles y amortización de cada año</small></a>
        <button data-a="extracto">Extracto del banco<small>Apunta los cobros y los recibos domiciliados de una vez</small></button>
        <a href="#ajustes">Ajustes y copias<small>Tus datos, mensajes, avisos, copia de seguridad e importación</small></a>
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
    renta() {
      const inf = MA.informeRenta(S, V.renta, HOY), t = inf.totales, act = inf.inmuebles.filter((x) => !x.sinActividad);
      const fila = (a, b, n) => `<tr><td>${n ? '<b>' + h(a) + '</b>' : h(a)}</td><td>${n ? '<b>' + b + '</b>' : b}</td></tr>`;
      return `<div class="nav"><button data-a="anioRenta" data-d="-1" aria-label="Año anterior">‹</button><b>Ejercicio ${V.renta}</b><button data-a="anioRenta" data-d="1" aria-label="Año siguiente"${V.renta >= +HOY.slice(0, 4) ? ' disabled' : ''}>›</button></div>
        <p class="nota">Resumen orientativo para preparar la declaración. Revísalo con Renta Web o con tu asesor: depende de que los datos estén completos.</p>
        ${act.length ? `<div class="kpis"><div class="kpi"><span>Ingresos</span><b>${eur(t.ingresos)}</b></div><div class="kpi"><span>Gastos deducibles</span><b>${eur(t.gastos)}</b></div>
          <div class="kpi"><span>Rendimiento neto</span><b>${eur(t.neto)}</b></div><div class="kpi"><span>Tras reducción</span><b>${eur(t.reducido)}</b></div></div>` : ''}
        <div class="acc"><button class="btn pri" data-a="rentaPdf">Informe en PDF</button><button class="btn" data-a="rentaCsv">CSV para Excel</button></div><div class="esp"></div>
        ${inf.inmuebles.map((x) => `<section class="sec"><h2>${h(x.nombre)}<b>${x.sinActividad ? 'Sin alquiler' : eur(x.rendimientoReducido)}</b></h2><div class="tar">
          ${x.sinActividad ? '' : `<p class="sub">${x.diasAlquilado} días alquilado${x.diasVacio ? ` · ${x.diasVacio} sin alquilar` : ''}${x.referencia ? ' · ' + h(x.referencia) : ''}</p>
          <table class="t">${fila('Ingresos íntegros', eur(x.ingresos.total), 1)}${Object.entries(x.gastos).filter(([, v]) => v).map(([k, v]) => fila(inf.grupos[k], eur(v))).join('')}
            ${x.exceso ? fila('Exceso para años siguientes', '− ' + eur(x.exceso)) : ''}${x.arrastreAplicado ? fila('Excesos de años anteriores', eur(x.arrastreAplicado)) : ''}
            ${fila('Rendimiento neto', eur(x.rendimientoNeto), 1)}${x.reduccion ? fila(`Reducción ${String(x.reduccionPct).replace('.', ',')} %`, '− ' + eur(x.reduccion)) : ''}
            ${x.retenciones ? fila('Retenciones', eur(x.retenciones)) : ''}</table>`}
          ${x.imputacion ? `<p class="sub">Imputación por ${x.imputacion.dias} días sin alquilar: <b>${eur(x.imputacion.importe)}</b></p>` : ''}
          ${x.avisos.length ? `<div class="nota">${x.avisos.map(h).join('<br>')}</div>` : ''}
          <div class="acc"><button class="btn peq" data-a="datosFiscales" data-id="${x.id}">Datos catastrales y de compra</button></div></div></section>`).join('') || vacio('Sin datos de ese año', 'No hay inmuebles en propiedad ese año.')}`;
    },
    ajustes() {
      return `<div class="lista"><button data-a="misDatos">Mis datos<small>${h(S.ajustes.propietario || 'Tu nombre y la forma de pago que aparecen en los mensajes')}</small></button>
        <button data-a="plantillas">Mensajes<small>Textos de los avisos por WhatsApp</small></button>
        <button data-a="avisosConf">Avisos en el móvil<small>${!Avisos.disponible ? 'Disponibles en la app de Android' : S.ajustes.avisos ? `Activados, a las ${S.ajustes.horaAvisos || 9}:00` : 'Desactivados'}</small></button></div>
        ${sec('Copia de seguridad', '', `<p class="nota">Tus datos están solo en este dispositivo. Guarda una copia de vez en cuando: si pierdes o cambias el móvil, es la única forma de recuperarlos.</p>
          <div class="lista"><button data-a="copia">Guardar una copia en Google Drive o enviarla<small>${S.ajustes.ultimaCopia ? 'Última: ' + fecha(S.ajustes.ultimaCopia) : 'Aún no has guardado ninguna'}</small></button><button data-a="restaurar">Recuperar una copia<small>Sustituye los datos actuales</small></button></div>
          <p class="sub">Al guardar, elige <b>Drive</b> en el menú de compartir. La copia incluye todos los datos, pero no las fotos y documentos adjuntos. Además, si tienes activada la copia de seguridad de Android, el sistema guarda la app en tu cuenta de Google y la recupera al estrenar móvil.</p>`)}
        ${sec('Importar', '', `<div class="lista"><button data-a="importarCartera">Inmuebles, inquilinos y contratos desde Excel<small>Con la plantilla, de una sola vez</small></button><button data-a="plantillaCartera">Descargar la plantilla<small>Archivo CSV que se abre con Excel</small></button>
          <button data-a="extracto">Extracto del banco<small>Para apuntar cobros y gastos domiciliados</small></button></div>`)}
        ${sec('Exportar a Excel (CSV)', '', `<div class="lista"><button data-a="csv" data-t="Cobros">Recibos de alquiler</button><button data-a="csv" data-t="Pagos">Cobros recibidos, uno a uno</button><button data-a="csv" data-t="Gastos">Gastos</button></div>`)}
        ${sec('Otros', '', `<div class="lista"><button data-a="historial">Historial de cambios<small>Quedan anotados los cobros, anulaciones y cambios</small></button><button data-a="privacidad">Privacidad<small>Qué datos guarda la app y dónde</small></button>
          <button data-a="borrarTodo">Borrar todos los datos<small>Deja la app como recién instalada</small></button></div>`)}`;
    },
  };
  const TITULOS = { inicio: 'Mis alquileres', cobros: 'Cobros', gastos: 'Gastos', contratos: 'Contratos', mas: 'Más', inmuebles: 'Inmuebles', inquilinos: 'Inquilinos', panel: 'Panel', ajustes: 'Ajustes y copias', renta: 'Informe para la Renta' };
  const vistaActual = () => { const v = location.hash.slice(1); return VISTAS[v] ? v : 'inicio'; };
  function pinta() {
    const v = vistaActual(), el = $('#vista');
    $('#titulo').textContent = TITULOS[v]; $('#subtitulo').textContent = v === 'inicio' ? `${+HOY.slice(8)} de ${fmes(HOY.slice(0, 7))}` : '';
    const y = el.scrollTop; el.innerHTML = VISTAS[v](); el.scrollTop = y;
    for (const i of el.querySelectorAll('[data-w]')) i.style.width = Math.min(100, +i.dataset.w) + '%';
    for (const i of el.querySelectorAll('[data-centro]')) { i.style.justifyContent = 'center'; i.style.textAlign = 'center'; i.style.marginTop = '14px'; }
    const principal = ['inmuebles', 'inquilinos', 'panel', 'ajustes', 'renta'].includes(v) ? 'mas' : v;
    for (const a of document.querySelectorAll('.barra a')) { const on = a.dataset.v === principal; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  }

  // ---------- Fichas y formularios de cada cosa ----------
  const opInmuebles = () => S.inmuebles.filter((p) => !p.archivado).map((p) => [p.id, p.nombre]);
  const D_INMUEBLE = [{ k: 'nombre', e: 'Nombre', req: 1, ayuda: 'Por ejemplo: Plaza 12, Piso de la calle Real…' }, { k: 'tipo', e: 'Tipo', t: 'select', op: MA.TIPOS.map((t) => [t, t]) },
    { k: 'direccion', e: 'Dirección' }, { k: 'referencia', e: 'Referencia catastral' }, { k: 'porUnidades', t: 'check', e: 'Se alquila por habitaciones o unidades', ayuda: 'Permite varios contratos a la vez en este inmueble.' },
    { h: 'Compra y valor (opcional)' }, { k: 'compraPrecio', e: 'Precio de compra', t: 'dinero' }, { k: 'compraGastos', e: 'Gastos de compra (impuestos, notaría, reforma)', t: 'dinero' }, { k: 'compraFecha', e: 'Fecha de compra', t: 'date' },
    { k: 'valor', e: 'Valor actual estimado', t: 'dinero' },
    { h: 'Para el informe de la Renta (opcional)' }, { k: 'valorCatastral', e: 'Valor catastral total', t: 'dinero', ayuda: 'Viene en el recibo del IBI.' },
    { k: 'valorCatastralConstruccion', e: 'Valor catastral de la construcción', t: 'dinero', ayuda: 'También en el recibo del IBI. Sirve para calcular la amortización.' },
    { k: 'imputacionPct', e: 'Imputación de rentas por días vacíos', t: 'select', op: [[1.1, '1,1 % (valor catastral revisado desde 1994)'], [2, '2 % (no revisado)']] },
    { k: 'notas', e: 'Notas', t: 'area' }];
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
      ${docsHtml('inmueble', i)}
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
  const D_ACTUALIZACION = [['auto', 'Según la ley (IRAV o IPC)'], ['irav', 'IRAV'], ['ipc', 'IPC'], ['fijo', 'Porcentaje fijo pactado'], ['ninguna', 'No se actualiza']];
  function formContrato() {
    if (!opInmuebles().length) return toast('Añade antes un inmueble');
    const qs = S.inquilinos.filter((q) => !q.archivado).map((q) => [q.id, q.nombre]);
    formulario({ titulo: 'Nuevo contrato', boton: 'Crear contrato', valores: { inicio: HOY, diaCobro: 1, avisoMeses: 1, actualizacion: 'auto', inquilinoId: qs.length ? qs[0][0] : 'nuevo' },
      defs: [{ k: 'inmuebleId', e: 'Inmueble', t: 'select', op: opInmuebles() }, { k: 'inquilinoId', e: 'Inquilino', t: 'select', op: [...qs, ['nuevo', '+ Nuevo inquilino…']] },
        { html: '<div id="nuevoInq">' }, { k: 'nNombre', e: 'Nombre del inquilino' }, { k: 'nTelefono', e: 'Teléfono (para WhatsApp)', t: 'tel' }, { html: '</div>' },
        { k: 'inicio', e: 'Fecha de inicio', t: 'date', req: 1 }, { k: 'fin', e: 'Fecha de fin (vacía si no tiene)', t: 'date' }, { k: 'importe', e: 'Renta mensual', t: 'dinero', req: 1 }, { k: 'diaCobro', e: 'Día de cobro', t: 'num' },
        { k: 'fianza', e: 'Fianza acordada', t: 'dinero' }, { k: 'avisoMeses', e: 'Avisar del vencimiento con (meses)', t: 'num' },
        { k: 'actualizacion', e: 'Actualización anual de la renta', t: 'select', op: D_ACTUALIZACION, ayuda: 'Vivienda firmada desde el 26/05/2023: IRAV. Antes, o para otros usos: lo que diga el contrato (normalmente IPC).' },
        { k: 'historicoCobrado', t: 'check', e: 'Dar por cobrados los meses anteriores a este', ayuda: 'Solo si el contrato empezó antes de usar la app. Quedarán marcados como estimados.' }, { k: 'notas', e: 'Notas', t: 'area' }],
      alMontar: (f) => { const ver = () => { $('#nuevoInq', f).hidden = f.elements.inquilinoId.value !== 'nuevo'; }; f.elements.inquilinoId.onchange = ver; ver(); },
      despues: (ct) => { if (ct && ct.fianza) toast('Contrato creado. Cuando cobres la fianza, apúntala en el contrato.'); },
      alGuardar: (d) => {
        if (d.importe == null) throw Object.assign(new Error('Indica la renta mensual'), { code: 'IMPORTE' });
        let inq = Number(d.inquilinoId), creado = null;
        if (d.inquilinoId === 'nuevo') { creado = MA.crearInquilino(S, { nombre: d.nNombre, telefono: d.nTelefono }); inq = creado.id; }
        if (d.actualizacion === 'auto') delete d.actualizacion;
        try { return MA.crearContrato(S, { ...d, inmuebleId: Number(d.inmuebleId), inquilinoId: inq, fin: d.fin || null, fianza: d.fianza || 0, diaCobro: d.diaCobro == null ? 1 : d.diaCobro, avisoMeses: d.avisoMeses == null ? 1 : d.avisoMeses }, HOY); }
        catch (e) { if (creado) MA.eliminarInquilino(S, creado.id); throw e; }
      } });
  }
  function fichaContrato(i) {
    const ct = por(S.contratos, i); if (!ct) return cerrar();
    const q = por(S.inquilinos, ct.inquilinoId) || {}, p = por(S.inmuebles, ct.inmuebleId) || {}, sit = MA.situacionContrato(ct, HOY), saldo = MA.saldoFianza(S, i);
    const cs = MA.cargos(S, HOY, (c) => c.contratoId === i).reverse(), fz = S.fianzas.filter((f) => f.contratoId === i && !f.anulado), act = MA.actualizacionPendiente(S, ct, HOY), dep = ct.deposito || {};
    hoja(`${q.nombre} · ${p.nombre}`, `<p>${chip(E_CONTRATO, sit)} <span class="sub">${fecha(ct.inicio)} a ${ct.fin || ct.fechaBaja ? fecha(MA.finEfectivo(ct)) : 'sin fecha de fin'} · cobro el día ${ct.diaCobro}</span></p>
      <h3>Renta</h3><table class="t">${ct.rentas.map((r) => `<tr><td>Desde ${fmes(r.desde)}</td><td>${eur(r.importe)}</td></tr>`).join('')}</table>
      ${ct.estado === 'activo' ? `<div class="acc"><button class="btn peq" data-a="revisar" data-id="${i}">Cambiar la renta</button><button class="btn peq" data-a="renovar" data-id="${i}">Renovar</button><button class="btn peq" data-a="editarContrato" data-id="${i}">Editar</button></div>` : `<div class="acc"><button class="btn peq" data-a="renovar" data-id="${i}">Reactivar y renovar</button></div>`}
      <p class="sub">Actualización anual: ${h(MA.INDICES[ct.actualizacion] || '—')}${ct.actualizacion === 'fijo' && ct.actualizacionPct != null ? ' (' + MA.pctTexto(ct.actualizacionPct) + ')' : ''}${act ? ` · <b>toca el ${fecha(act.fecha)}</b>` : ''}</p>
      ${act ? `<div class="acc"><button class="btn pri peq" data-a="actualizar" data-id="${i}">Actualizar la renta</button></div>` : ''}
      <h3>Fianza</h3><p class="sub">Acordada: ${eur(ct.fianza)} · En tu poder: <b>${eur(saldo)}</b></p>
      ${dep.fecha ? `<p class="sub">Depositada en ${h(dep.organismo)} el ${fecha(dep.fecha)}${dep.referencia ? ' · ref. ' + h(dep.referencia) : ''}${dep.recuperado ? ` · recuperada el ${fecha(dep.recuperado)}` : ''}</p>${ct.estado !== 'activo' && !dep.recuperado ? `<div class="acc"><button class="btn peq" data-a="recuperarDeposito" data-id="${i}">Ya la he recuperado del organismo</button></div>` : ''}`
        : !dep.noAplica && (ct.fianza > 0 || saldo > 0) ? `<p class="nota">Fianza sin depositar. En Canarias se deposita en el Instituto Canario de la Vivienda en el mes siguiente a la firma.</p><div class="acc"><button class="btn peq" data-a="deposito" data-id="${i}">Registrar el depósito</button><button class="btn peq" data-a="depositoNoAplica" data-id="${i}">No hay que depositarla</button></div>` : ''}
      ${fz.length ? `<table class="t">${fz.map((f) => `<tr><td>${fecha(f.fecha)} · ${f.tipo}</td><td>${eur(f.importe)}</td></tr>`).join('')}</table>` : ''}
      <div class="acc"><button class="btn peq" data-a="fianza" data-id="${i}" data-t="recibida">Recibida</button>${saldo > 0 ? `<button class="btn peq" data-a="fianza" data-id="${i}" data-t="devuelta">Devolver</button><button class="btn peq" data-a="fianza" data-id="${i}" data-t="retenida">Retener</button>` : ''}</div>
      <h3>Recibos</h3>${cs.slice(0, 24).map((c) => `<div class="tar toca" data-a="cobro" data-id="${c.id}"><div class="fila"><span>${fmes(c.periodo)}</span><span class="imp">${eur(c.importe)}</span></div><div class="fila"><span class="sub">${c.pagado ? 'Cobrado ' + eur(c.pagado) : 'Vence ' + fecha(c.vence)}</span>${chip(E_CARGO, c.estado)}</div></div>`).join('')}
      ${cs.length > 24 ? `<p class="sub">Y ${cs.length - 24} recibos anteriores (están en Cobros y en la exportación).</p>` : ''}
      ${docsHtml('contrato', i)}
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
      <h3>Más</h3><div class="acc">${vivo ? `<button class="btn" data-a="avisar" data-id="${i}">Avisar al inquilino</button>` : ''}${c.pagado ? `<button class="btn pri" data-a="reciboPdf" data-id="${i}">Recibo en PDF</button><button class="btn" data-a="recibo" data-id="${i}">Confirmar por WhatsApp</button>` : ''}
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
      ${docsHtml('gasto', i)}
      <h3>Más</h3><div class="acc">${g.pagado && !g.anulado ? `<button class="btn" data-a="desconfirmar" data-id="${i}">No está pagado (recibo devuelto)</button>` : ''}${!g.anulado ? `<button class="btn rojo" data-a="anularGasto" data-id="${i}">Anular el gasto</button>` : ''}</div>`, (el) => {
      const f = $('#fgasto', el); if (!f) return;
      f.onsubmit = (e) => { e.preventDefault();
        try { const d = leer(f, [{ k: 'importe', t: 'dinero' }, { k: 'fecha' }]); MA.confirmarGasto(S, i, { importe: d.importe == null ? undefined : d.importe, fecha: d.fecha || undefined }, HOY); guardar(); pinta(); fichaGasto(i); }
        catch (x) { const b = $('.error', f); b.textContent = x.code ? x.message : 'No se ha podido guardar.'; b.hidden = false; } };
    });
  }

  // ---------- Documentos y fotos ----------
  const docsHtml = (tipo, id) => `<h3>Documentos y fotos</h3><div class="docs" data-docs="${tipo}:${id}"></div>
    <div class="acc"><label class="btn peq">+ Añadir foto o documento<input type="file" accept="image/*,application/pdf" data-adjuntar="${tipo}:${id}" hidden></label></div>`;
  async function montarDocs(el) {
    const [tipo, id] = el.dataset.docs.split(':'), l = MA.adjuntosDe(S, tipo, +id);
    el.innerHTML = l.length ? l.map((a) => `<button class="doc" data-a="verDoc" data-id="${a.id}" aria-label="${h(a.nombre)}">${/^image\//.test(a.mime) ? `<img alt="" data-arch="${h(a.archivo)}">` : `<span>📄</span>`}<small>${h(a.nombre)}</small></button>`).join('')
      : '<p class="sub">Contrato firmado, DNI, facturas, fotos del estado al entrar y al salir…</p>';
    for (const img of el.querySelectorAll('img[data-arch]')) Adjuntos.url(img.dataset.arch).then((u) => { if (u) img.src = u; }).catch(() => {});
  }
  function abrirPadre(tipo, id) { ({ inmueble: fichaInmueble, contrato: fichaContrato, gasto: fichaGasto, inquilino: (x) => formInquilino(por(S.inquilinos, x)) })[tipo](id); }
  document.addEventListener('change', async (e) => {
    const inp = e.target; if (!inp.dataset || !inp.dataset.adjuntar || !inp.files[0]) return;
    const [tipo, id] = inp.dataset.adjuntar.split(':'), f = inp.files[0];
    toast('Guardando…');
    try { const g = await Adjuntos.guardar(f); MA.agregarAdjunto(S, { tipo, id: +id, ...g }, HOY); guardar(); abrirPadre(tipo, +id); toast('Documento guardado'); }
    catch (x) { toast(x.code ? x.message : 'No se ha podido guardar el archivo'); }
  });

  // ---------- Extracto del banco: revisión antes de apuntar ----------
  function revisarExtracto(pr) {
    const utiles = pr.filter((x) => x.tipo === 'cobro' || x.tipo === 'gasto'), ya = pr.filter((x) => x.tipo === 'ya').length, nada = pr.filter((x) => x.tipo === 'nada');
    hoja('Revisa antes de apuntar', `<p class="sub">${pr.length} movimientos leídos · ${utiles.length} coinciden${ya ? ` · ${ya} ya estaban apuntados` : ''}.</p>
      ${utiles.length ? utiles.map((x, n) => `<label class="f chk tar"><input type="checkbox" data-n="${n}"${x.confianza === 'alta' ? ' checked' : ''}><span><b>${fecha(x.fecha)} · ${eur(Math.abs(x.importe))}</b> ${x.tipo === 'cobro' ? '→ cobro' : '→ gasto pagado'}<br>
        <span class="sub">${h(x.motivo)}</span><br><small class="sub">Banco: ${h(x.concepto || '—')}</small>${x.confianza === 'alta' ? '' : '<br><span class="chip avi">Comprueba</span>'}</span></label>`).join('')
        + '<button class="btn pri ancho" data-x="aplicar">Apuntar los marcados</button>' : '<p class="nota">No hay movimientos que coincidan con recibos o gastos pendientes.</p>'}
      ${nada.length ? `<h3>Sin coincidencia (${nada.length})</h3><p class="sub">Si alguno es un cobro, apúntalo a mano desde el recibo.</p>${nada.slice(0, 30).map((x) => `<div class="sub">${fecha(x.fecha)} · ${eur(x.importe)} · ${h((x.concepto || '').slice(0, 60))}</div>`).join('')}` : ''}`, (el) => {
      const b = $('[data-x=aplicar]', el); if (!b) return;
      b.onclick = () => { const marc = [...el.querySelectorAll('input[data-n]:checked')].map((i) => utiles[+i.dataset.n]);
        if (!marc.length) return toast('No has marcado ninguno');
        const r = MA.aplicarConciliacion(S, marc, HOY); guardar(); cerrar(); pinta();
        toast(`Apuntados ${r.cobros} cobros y ${r.gastos} gastos${r.errores.length ? ` · ${r.errores.length} con error` : ''}`); };
    });
  }

  // ---------- Botones de las notificaciones ----------
  function alPulsarAviso(accion, d) {
    try {
      alDia();
      if (accion === 'cobrado' && d.contratoId && d.periodo) {
        const r = MA.cobroDesdeAviso(S, d, HOY); guardar(); pinta();
        if (r.repetido) return toast('Ese recibo ya estaba cobrado');
        return toast(`Cobrado ${eur(r.importe)}`, [['Enviar recibo', () => A.reciboPdf(r.cargoId)], ['Deshacer', () => haz(() => S.pagos.filter((p) => p.cargoId === r.cargoId && !p.anulado).forEach((p) => MA.anularPago(S, p.id, 'Marcado por error', HOY)))]]);
      }
      const c = d.contratoId && d.periodo ? S.cargos.find((x) => x.contratoId === d.contratoId && x.periodo === d.periodo) : null;
      if (accion === 'avisar' && c) return msgCobro(MA.cargos(S, HOY, (x) => x.id === c.id)[0]);
      if (c) return fichaCobro(c.id);
      if (d.gastoId) return fichaGasto(d.gastoId);
      if (d.contratoId) return fichaContrato(d.contratoId);
    } catch (e) { fallo(e); }
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
      { k: 'fianza', e: 'Fianza acordada', t: 'dinero' }, { k: 'avisoMeses', e: 'Avisar del vencimiento con (meses)', t: 'num' },
      { h: 'Actualización anual' }, { k: 'actualizacion', e: 'Índice', t: 'select', op: D_ACTUALIZACION.slice(1) }, { k: 'actualizacionPct', e: 'Porcentaje fijo (solo si es pactado)', t: 'num' },
      { h: 'Para la Renta' }, { k: 'uso', e: 'Uso', t: 'select', op: [['vivienda', 'Vivienda del inquilino (tiene reducción)'], ['otro', 'Otro uso: garaje, local, temporada…']] },
      { k: 'firma', e: 'Fecha de firma (si es distinta del inicio)', t: 'date' },
      { k: 'reduccion', e: 'Reducción en el IRPF', t: 'select', op: [['', 'Automática (60 % antes del 26/05/2023, 50 % después)'], [0, 'Sin reducción'], [50, '50 %'], [60, '60 %'], [70, '70 %'], [90, '90 %']] },
      { k: 'retencion', t: 'check', e: 'El inquilino me practica retención (19 %)', ayuda: 'Habitual cuando alquilas un local a una empresa o autónomo.' }, { k: 'notas', e: 'Notas', t: 'area' }],
      alGuardar: (d) => MA.editarContrato(S, i, { ...d, fin: d.fin || null, fianza: d.fianza || 0, firma: d.firma || null }, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Para cambiar la renta usa «Cambiar la renta»: así queda guardado desde qué mes se aplica.</p>' }); },
    revisar(i) { const ct = por(S.contratos, i); formulario({ titulo: 'Cambiar la renta', valores: { desde: MA.mesMas(HOY.slice(0, 7), 1), importe: MA.rentaActual(ct, HOY) }, defs: [{ k: 'importe', e: 'Nueva renta mensual', t: 'dinero', req: 1 }, { k: 'desde', e: 'Se aplica desde el mes', t: 'month', req: 1 }],
      alGuardar: (d) => MA.revisarRenta(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Los recibos ya cobrados, total o parcialmente, conservan su importe.</p>' }); },
    renovar(i) { const ct = por(S.contratos, i), f = MA.finEfectivo(ct); formulario({ titulo: 'Renovar contrato', boton: 'Renovar', valores: { fin: f ? MA.masDias(MA.masMeses(MA.masDias(f, 1), 12), -1) : '', importe: MA.rentaActual(ct, HOY) },
      defs: [{ k: 'fin', e: 'Nueva fecha de fin (vacía si pasa a no tener)', t: 'date' }, { k: 'importe', e: 'Renta mensual desde la renovación', t: 'dinero' }],
      alGuardar: (d) => MA.renovarContrato(S, i, { fin: d.fin || null, importe: d.importe != null && d.importe !== MA.rentaActual(ct, HOY) ? d.importe : null }, HOY), despues: () => fichaContrato(i) }); },
    finalizar(i) { formulario({ titulo: 'Finalizar contrato', boton: 'Finalizar', valores: { fecha: HOY, estado: 'finalizado' }, defs: [{ k: 'fecha', e: 'Último día del contrato', t: 'date', req: 1 }, { k: 'estado', e: 'Motivo', t: 'select', op: [['finalizado', 'Ha terminado'], ['rescindido', 'Se ha rescindido antes de tiempo']] },
      { k: 'llaves', e: 'Día en que te devuelve las llaves', t: 'date', ayuda: 'Desde ese día tienes un mes para devolver la fianza; después genera intereses.' }],
      alGuardar: (d) => MA.finalizarContrato(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Los recibos posteriores sin cobros se anulan. Los cobros y el historial se conservan.</p>' }); },
    eliminarContrato(i) { confirma('Eliminar contrato', 'Solo se puede eliminar un contrato sin cobros ni fianza (por ejemplo, uno creado por error). Si ya tiene historial, finalízalo.', 'Eliminar', () => haz(() => MA.eliminarContrato(S, i))); },
    avisoFin(i) { const ct = por(S.contratos, i), q = por(S.inquilinos, ct.inquilinoId), p = por(S.inmuebles, ct.inmuebleId);
      enviar('Mensaje a ' + q.nombre, q.telefono, MA.mensaje(S.plantillas.vencimiento, { ...comunes(), nombre: pila(q.nombre), inmueble: p.nombre, fecha_fin: fecha(ct.fin) }), () => { ct.avisoEnviado = HOY; guardar(); }); },
    fianza(i, el) { const t = el.dataset.t, ct = por(S.contratos, i), k = clave(); formulario({ titulo: { recibida: 'Fianza recibida', devuelta: 'Devolver fianza', retenida: 'Retener fianza' }[t], valores: { importe: t === 'recibida' ? ct.fianza || '' : MA.saldoFianza(S, i), fecha: HOY },
      defs: [{ k: 'importe', e: 'Importe', t: 'dinero', req: 1 }, { k: 'fecha', e: 'Fecha', t: 'date' }, { k: 'notas', e: t === 'retenida' ? 'Motivo de la retención' : 'Notas' }],
      alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica el importe'), { code: 'IMPORTE' }); return MA.registrarFianza(S, { contratoId: i, tipo: t, ...d, clave: k }, HOY); }, despues: () => fichaContrato(i) }); },
    cobro: fichaCobro,
    cobrado(i, el) { const c = MA.cargos(S, HOY, (x) => x.id === i)[0]; if (!c || !c.pendiente) return;
      haz(() => MA.registrarPago(S, { cargoId: i, importe: c.pendiente, metodo: c.metodo || '', clave: el.dataset.k }, HOY), (r) => { if (!r.repetido) toast(`Cobrado ${eur(c.pendiente)} de ${c.inquilino}`,
        [['Enviar recibo', () => A.reciboPdf(i)], ['Deshacer', () => haz(() => r.pagos.forEach((p) => MA.anularPago(S, p, 'Marcado por error', HOY)))]]); }); },
    avisar(i) { msgCobro(MA.cargos(S, HOY, (x) => x.id === i)[0]); }, recibo(i) { msgCobro(MA.cargos(S, HOY, (x) => x.id === i)[0], 'recibo'); },
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
    misDatos() { formulario({ titulo: 'Mis datos', valores: S.ajustes, defs: [{ k: 'propietario', e: 'Tu nombre (firma de los mensajes y los recibos)' }, { k: 'dni', e: 'Tu DNI/NIF (aparece en los recibos)' }, { k: 'domicilio', e: 'Tu domicilio (opcional, para los recibos)' }, { k: 'formaPago', e: 'Forma de pago que indicas al inquilino', ayuda: 'Por ejemplo: Bizum al 600 000 000 o transferencia a ES00…' }], alGuardar: (d) => Object.assign(S.ajustes, d) }); },
    plantillas() { const n = { cobro: 'Recordatorio de cobro', atraso: 'Pago atrasado (a los 3 días)', atraso2: 'Pago atrasado (a los 10 días)', recibo: 'Confirmación de pago', recibo_pdf: 'Envío del recibo en PDF', gasto: 'Cobro de un gasto', vencimiento: 'Vencimiento de contrato', actualizacion: 'Actualización anual de la renta' };
      formulario({ titulo: 'Mensajes', valores: S.plantillas, defs: Object.keys(n).map((k) => ({ k, e: n[k], t: 'area' })), alGuardar: (d) => { for (const k of Object.keys(n)) S.plantillas[k] = d[k] || MA.PLANTILLAS[k]; },
        pie: '<p class="sub">Entre llaves van los datos que se rellenan solos: {nombre}, {inmueble}, {mes}, {importe}, {deuda}, {fecha_cobro}, {forma_pago}, {propietario}… Si dejas un mensaje vacío vuelve el texto original.</p>' }); },
    avisosConf() { if (!Avisos.disponible) return toast('Los avisos están disponibles en la app de Android');
      formulario({ titulo: 'Avisos en el móvil', valores: { avisos: !!S.ajustes.avisos, horaAvisos: S.ajustes.horaAvisos || 9 }, defs: [{ k: 'avisos', t: 'check', e: 'Avisarme de cobros, vencimientos y gastos', ayuda: 'El día que vence cada recibo, cuando hay atrasos y cuando un contrato está a punto de terminar.' },
        { k: 'horaAvisos', e: 'Hora del aviso', t: 'select', op: [7, 8, 9, 10, 12, 14, 17, 19, 20].map((x) => [x, x + ':00']) }],
        alGuardar: (d) => { S.ajustes.avisos = d.avisos; S.ajustes.horaAvisos = Number(d.horaAvisos); if (d.avisos) Avisos.permiso(true).then((ok) => { if (!ok) { S.ajustes.avisos = false; guardar(); pinta(); toast('Android no ha dado permiso para mostrar avisos'); } else guardar(); }); } }); },
    copia() { Archivos.compartir(`mis-alquileres-copia-${HOY}.json`, MA.exportar(S), 'application/json').then(() => { S.ajustes.ultimaCopia = HOY; guardar(); pinta(); toast('Copia preparada'); }).catch(() => toast('No se ha guardado la copia')); },
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
    // 1. Recibo en PDF
    reciboPdf(i) { try { const r = MA.datosRecibo(S, i, HOY); guardar(); const c = MA.cargos(S, HOY, (x) => x.id === i)[0];
      Archivos.compartirBytes(`recibo-${r.numero}.pdf`, PDF.recibo(r), 'application/pdf', MA.mensaje(S.plantillas.recibo_pdf, { ...comunes(), nombre: pila(c.inquilino), inmueble: c.inmueble, mes: fmes(c.periodo) }))
        .catch(() => toast('No se ha enviado el recibo')); if (!S.ajustes.dni && !S.ajustes.propietario) toast('Pon tu nombre y DNI en Ajustes › Mis datos para que salgan en el recibo'); } catch (e) { fallo(e); } },
    // 4. Extracto del banco
    extracto() { hoja('Extracto del banco', `<p>Descarga desde la web o la app de tu banco los movimientos de la cuenta donde cobras, en <b>Excel (.xlsx)</b> o <b>CSV</b>, y elígelo aquí. La app buscará qué transferencias y Bizum corresponden a cada recibo y qué cargos son tus gastos domiciliados.</p>
      <label class="f">Archivo del extracto<input type="file" id="fext" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p class="sub">Nada se apunta hasta que lo revises y confirmes. Los movimientos ya importados se reconocen y no se duplican.</p>`, (el) => {
      $('#fext', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
        try { const movs = Tablas.extracto(await Tablas.leerArchivo(f.name, await f.arrayBuffer())); revisarExtracto(MA.conciliar(S, movs, HOY)); } catch (x) { toast(x.message || 'No se ha podido leer el archivo'); } }; }); },
    // 5. Renta
    anioRenta(_, el) { V.renta += +el.dataset.d; pinta(); },
    rentaPdf() { Archivos.compartirBytes(`renta-${V.renta}.pdf`, PDF.renta(MA.informeRenta(S, V.renta, HOY), S.ajustes.propietario), 'application/pdf').catch(() => toast('No se ha podido crear el PDF')); },
    rentaCsv() { Archivos.compartir(`renta-${V.renta}.csv`, MA.csvRenta(MA.informeRenta(S, V.renta, HOY)), 'text/csv').catch(() => toast('No se ha podido exportar')); },
    datosFiscales(i) { const p = por(S.inmuebles, i); formulario({ titulo: 'Datos de ' + p.nombre, valores: p, defs: [{ k: 'referencia', e: 'Referencia catastral' }, ...D_INMUEBLE.filter((d) => ['valorCatastral', 'valorCatastralConstruccion', 'imputacionPct', 'compraPrecio', 'compraGastos', 'compraFecha'].includes(d.k))],
      alGuardar: (d) => MA.editarInmueble(S, i, d) }); },
    // 6. Actualización anual
    actualizar(i) { const ct = por(S.contratos, i), u = MA.actualizacionPendiente(S, ct, HOY); if (!u) return fichaContrato(i);
      const q = por(S.inquilinos, ct.inquilinoId), p = por(S.inmuebles, ct.inmuebleId);
      formulario({ titulo: 'Actualizar la renta', boton: 'Aplicar', valores: { pct: u.pctPactado != null ? String(u.pctPactado).replace('.', ',') : '' }, defs: [{ html: `<p>${h(q.nombre)} · ${h(p.nombre)}: el <b>${fecha(u.fecha)}</b> se cumple un año más de contrato. Renta actual: <b>${eur(u.renta)}</b>.</p>
          <p class="sub">${u.indice === 'irav' ? 'Para vivienda firmada desde el 26/05/2023 se aplica el <b>IRAV</b>, que publica el INE cada mes: usa el último publicado.' : u.indice === 'ipc' ? 'Se aplica la variación del <b>IPC</b> que diga el contrato (normalmente la interanual del último mes publicado por el INE).' : 'Se aplica el porcentaje pactado en el contrato.'} Debes comunicárselo al inquilino por escrito.</p>` },
        { k: 'pct', e: 'Porcentaje de subida (por ejemplo 2,4)', t: 'num', req: 1 }],
        alGuardar: (d) => MA.aplicarActualizacion(S, i, { pct: d.pct, fecha: u.fecha }, HOY),
        despues: (r) => enviar('Mensaje a ' + q.nombre, q.telefono, MA.mensaje(S.plantillas.actualizacion, { ...comunes(), nombre: pila(q.nombre), inmueble: p.nombre, mes: fmes(u.mes), antes: eur(r.antes), ahora: eur(r.ahora), indice: u.indice === 'fijo' ? 'porcentaje pactado' : u.indice.toUpperCase(), porcentaje: MA.pctTexto(r.pct) })),
        pie: `<div class="acc"><button class="btn peq" data-a="ine">Consultar en ine.es</button><button class="btn peq" data-a="omitirActualizacion" data-id="${i}">Este año no la aplico</button></div>` }); },
    ine() { window.Plataforma.abrir('https://www.ine.es/'); },
    omitirActualizacion(i) { const u = MA.actualizacionPendiente(S, por(S.contratos, i), HOY); if (u) haz(() => MA.omitirActualizacion(S, i, u.fecha, HOY), cerrar); },
    // 10. Depósito de la fianza
    deposito(i) { formulario({ titulo: 'Depósito de la fianza', valores: { organismo: 'Instituto Canario de la Vivienda', fecha: HOY }, defs: [{ k: 'organismo', e: 'Organismo' }, { k: 'fecha', e: 'Fecha del depósito', t: 'date', req: 1 }, { k: 'referencia', e: 'Número o referencia del depósito' }],
      alGuardar: (d) => MA.registrarDeposito(S, i, d, HOY), despues: () => fichaContrato(i), pie: '<p class="sub">Guarda el justificante en «Documentos y fotos» del contrato.</p>' }); },
    depositoNoAplica(i) { haz(() => MA.registrarDeposito(S, i, { noAplica: true }, HOY), () => fichaContrato(i)); },
    recuperarDeposito(i) { formulario({ titulo: 'Fianza recuperada', valores: { fecha: HOY }, defs: [{ k: 'fecha', e: 'Fecha en que te la devolvió el organismo', t: 'date', req: 1 }], alGuardar: (d) => MA.recuperarDeposito(S, i, d.fecha, HOY), despues: () => fichaContrato(i) }); },
    // 9. Alta rápida e importación
    altaRapida() { if (!MA.puedeCrearInmueble(S)) return hojaPro('La versión gratuita admite un inmueble.');
      formulario({ titulo: 'Alta rápida', boton: 'Crear todo', valores: { tipo: 'Plaza de garaje', inicio: HOY, diaCobro: 1, tipicos: true }, defs: [{ k: 'inmueble', e: 'Inmueble', req: 1, ayuda: 'Por ejemplo: Plaza 12 o Piso Calle Real' }, { k: 'tipo', e: 'Tipo', t: 'select', op: MA.TIPOS.map((x) => [x, x]) },
        { k: 'inquilino', e: 'Inquilino', req: 1 }, { k: 'telefono', e: 'Su teléfono (para WhatsApp)', t: 'tel' }, { k: 'importe', e: 'Renta mensual', t: 'dinero', req: 1 }, { k: 'diaCobro', e: 'Día de cobro', t: 'num' },
        { k: 'inicio', e: 'Desde', t: 'date', req: 1 }, { k: 'fianza', e: 'Fianza (opcional)', t: 'dinero' }, { k: 'historicoCobrado', t: 'check', e: 'Dar por cobrados los meses anteriores a este', ayuda: 'Solo si empezó antes de usar la app. Quedan marcados como estimados.' },
        { k: 'tipicos', t: 'check', e: 'Añadir los gastos habituales (IBI, comunidad…)' }],
        alGuardar: (d) => { if (d.importe == null) throw Object.assign(new Error('Indica la renta mensual'), { code: 'IMPORTE' }); return MA.altaRapida(S, d, HOY); }, despues: () => toast('Listo: ya tienes los recibos de cada mes') }); },
    plantillaCartera() { Archivos.compartir('plantilla-mis-alquileres.csv', '\ufeff' + MA.PLANTILLA_CARTERA, 'text/csv').catch(() => {}); },
    importarCartera() { hoja('Importar desde Excel', `<p>Prepara una hoja con una fila por contrato y las columnas <b>Inmueble, Tipo, Dirección, Inquilino, Teléfono, DNI, Inicio, Fin, Renta, Día de cobro y Fianza</b>, como en la plantilla. Guárdala como <b>.xlsx</b> o <b>CSV</b> y elígela aquí.</p>
      <div class="acc"><button class="btn peq" data-a="plantillaCartera">Descargar la plantilla</button></div><label class="f">Archivo<input type="file" id="fcar" accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>`, (el) => {
      $('#fcar', el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
        try { const r = MA.importarCartera(S, await Tablas.leerArchivo(f.name, await f.arrayBuffer()), HOY); MA.generarGastos(S, HOY); guardar(); pinta();
          hoja('Importación terminada', `<p>Creados: <b>${r.inmuebles}</b> inmuebles, <b>${r.inquilinos}</b> inquilinos y <b>${r.contratos}</b> contratos.</p>${r.errores.length ? `<div class="nota">${r.errores.map(h).join('<br>')}</div>` : ''}${r.limite ? '<div class="acc"><button class="btn pri" data-a="pro">Desbloquear la versión completa</button></div>' : ''}`); }
        catch (x) { toast(x.message || 'No se ha podido leer el archivo'); } }; }); },
    // 7. Documentos
    verDoc(i) { const a = por(S.adjuntos, i); if (!a) return; const foto = /^image\//.test(a.mime);
      hoja(a.nombre, `${foto ? '<img id="docimg" alt="">' : `<p class="sub">${h(a.mime || 'Documento')} · ${Math.max(1, Math.round(a.tam / 1024))} KB</p>`}<p class="sub">Añadido el ${fecha(a.fecha)}</p>
        <div class="acc"><button class="btn pri" data-a="compartirDoc" data-id="${i}">${foto ? 'Compartir' : 'Abrir o compartir'}</button><button class="btn" data-a="volverDoc" data-id="${i}">Volver</button><button class="btn rojo" data-a="borrarDoc" data-id="${i}">Eliminar</button></div>`,
        async (el) => { if (foto) { const u = await Adjuntos.url(a.archivo); if (u) $('#docimg', el).src = u; } }); },
    compartirDoc(i) { Adjuntos.compartir(por(S.adjuntos, i)).catch(() => toast('No se ha podido abrir')); },
    volverDoc(i) { const a = por(S.adjuntos, i); abrirPadre(a.tipo, a.refId); },
    borrarDoc(i) { const a = por(S.adjuntos, i); confirma('Eliminar documento', `Se eliminará «${a.nombre}» de la app.`, 'Eliminar', () => { const arch = MA.quitarAdjunto(S, i); Adjuntos.borrar(arch); guardar(); abrirPadre(a.tipo, a.refId); }); },
    borrarTodo() { confirma('Borrar todos los datos', 'Se eliminarán inmuebles, inquilinos, contratos, cobros y gastos de este dispositivo. No se puede deshacer: guarda antes una copia si los quieres conservar.', 'Borrar todo', () => { const pro = S.pro; S = MA.nuevo(); S.pro = pro; guardar(); location.hash = '#inicio'; pinta(); toast('Datos borrados'); }); },
  };
  const AYUDA = `<h3>Cómo funciona</h3><p>Añade un <b>inmueble</b>, su <b>inquilino</b> y el <b>contrato</b>. Cada mes la app crea el recibo de alquiler. Cuando te paguen, pulsa <b>Cobrado</b> o abre el recibo para apuntar un pago parcial.</p>
    <h3>Estados de un recibo</h3><p><b>Pendiente</b>: aún no ha vencido. <b>A medias</b>: has cobrado una parte. <b>Atrasado</b>: ha pasado la fecha y falta dinero. <b>Cobrado</b>: completo. <b>Anulado</b>: ese mes no se cobra.</p>
    <h3>Gastos</h3><p>En la ficha de cada inmueble defines los gastos periódicos (IBI, comunidad, seguro…) y quién los paga. <b>Previsto</b>: todavía no toca. <b>Sin pagar</b>: ha pasado la fecha. <b>Por confirmar</b>: está domiciliado; comprueba el cargo en el banco y confírmalo. La app nunca da un gasto por pagado sin que tú lo digas.</p>
    <h3>Nada se pierde</h3><p>Los cobros y gastos no se borran: se anulan y quedan en el historial. Lo marcado como «estimado» es lo anterior a empezar a usar la app.</p>
    <h3>Mensajes y recibos</h3><p>La app prepara el texto y abre WhatsApp; el mensaje lo envías tú. Al marcar «Cobrado» puedes enviar al inquilino el <b>recibo en PDF</b>, numerado. Si se retrasa, a los 3 y a los 10 días te propone un recordatorio, cada vez más firme.</p>
    <h3>Desde la notificación</h3><p>Con los avisos activados, el día de cobro puedes pulsar <b>Cobrado</b> en la propia notificación.</p>
    <h3>Extracto del banco</h3><p>En Cobros o en Más, elige el extracto (Excel o CSV) y la app propone qué ingresos son de cada recibo y qué cargos son tus gastos domiciliados. Revisas y confirmas; nada se apunta solo.</p>
    <h3>Renta</h3><p>Más › Informe para la Renta resume por inmueble los ingresos, los gastos deducibles, la amortización y la reducción. Para la amortización y la imputación de días vacíos necesita el valor catastral (está en el recibo del IBI). Es orientativo: revísalo antes de presentar.</p>
    <h3>Subida anual y fianza</h3><p>La app te avisa cuando toca actualizar la renta (IRAV o IPC, según el contrato), cuando hay que depositar la fianza y cuando hay que devolverla tras la entrega de llaves.</p>
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
    Avisos.preparar(alPulsarAviso);
    if (!NATIVO && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.__ma = { get S() { return S; }, pinta }; // para las pruebas automáticas
  })();
})();
