/* Mis alquileres — núcleo de reglas. © 2026 IT Canarias.
   Sin interfaz ni almacenamiento: recibe el estado (un objeto) y lo modifica.
   Importes SIEMPRE en céntimos enteros. Fechas 'AAAA-MM-DD', meses 'AAAA-MM'.
   Nada con historial se borra: se anula con fecha y motivo. */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.MA = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------- Utilidades ----------
  const err = (code, msg, extra) => Object.assign(new Error(msg), { code }, extra || {});
  const pad = (n) => String(n).padStart(2, '0');
  function esFecha(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  const esMes = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
  const diasMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function masMeses(iso, n) {
    let [y, m, d] = iso.split('-').map(Number);
    m += n; y += Math.floor((m - 1) / 12); m = (((m - 1) % 12) + 12) % 12 + 1;
    return `${y}-${pad(m)}-${pad(Math.min(d, diasMes(y, m)))}`;
  }
  const mesMas = (p, n) => masMeses(p + '-01', n).slice(0, 7);
  const masDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
  function vence(mes, dia) { const [y, m] = mes.split('-').map(Number); return `${mes}-${pad(Math.min(dia, diasMes(y, m)))}`; }
  const esCent = (n) => Number.isInteger(n);
  const texto = (v) => (v == null ? '' : String(v).trim());

  // Convierte lo que escribe el usuario ("1.234,56", "500", 12.5) a céntimos
  function centimos(v) {
    if (typeof v === 'number') { if (!Number.isFinite(v)) throw err('IMPORTE', 'Importe no válido'); return Math.round(v * 100); }
    let t = texto(v).replace(/[\s€]/g, '');
    if (t.includes(',') || /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); // 120.000 son ciento veinte mil
    if (!/^-?\d+(\.\d{1,2})?$/.test(t)) throw err('IMPORTE', 'Indica un importe con hasta dos decimales');
    return Math.round(Number(t) * 100);
  }
  const euros = (c) => (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });

  // ---------- Estado ----------
  const TIPOS = ['Plaza de garaje', 'Plaza de moto', 'Trastero', 'Vivienda', 'Habitación', 'Local comercial', 'Oficina', 'Nave', 'Terreno', 'Otro'];
  const CATEGORIAS = { impuesto: 'Impuestos y tasas', comunidad: 'Comunidad', suministro: 'Suministros', seguro: 'Seguros',
    mantenimiento: 'Reparaciones y mantenimiento', gestion: 'Gestión y servicios', financiacion: 'Hipoteca y financiación', otro: 'Otros' };
  const RESPONSABLES = { propietario: 'Lo pago yo', repercute: 'Lo pago yo y se lo cobro al inquilino', inquilino: 'Lo paga el inquilino directamente' };
  const PERIODICIDADES = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
  const PLANTILLAS = {
    cobro: 'Hola {nombre}, te recuerdo que el {fecha_cobro} toca el pago del alquiler de {inmueble} correspondiente a {mes}: {importe}.\n\nForma de pago: {forma_pago}\n\n¡Gracias! {propietario}',
    atraso: 'Hola {nombre}, el pago de {inmueble} de {mes} ({deuda}) venció el {fecha_cobro} y aún me figura como pendiente. ¿Me confirmas cuándo podrás hacerlo?\n\nForma de pago: {forma_pago}\n\nGracias, {propietario}',
    recibo: 'Hola {nombre}, te confirmo que he recibido {importe_pagado} el {fecha_pago} por el alquiler de {inmueble} de {mes}. ¡Gracias! {propietario}',
    gasto: 'Hola {nombre}, te paso el importe de {concepto} de {inmueble} correspondiente a {periodo}: {importe}, según lo acordado en el contrato.\n\nForma de pago: {forma_pago}\n\nGracias, {propietario}',
    vencimiento: 'Hola {nombre}, te aviso de que el contrato de alquiler de {inmueble} vence el {fecha_fin}. ¿Quieres renovarlo? Coméntame y lo preparamos.\n\nUn saludo, {propietario}',
    atraso2: 'Hola {nombre}, sigue pendiente el alquiler de {inmueble} de {mes}: {deuda}, que vencía el {fecha_cobro}. Necesito que me digas hoy cuándo lo vas a abonar.\n\nForma de pago: {forma_pago}\n\n{propietario}',
    actualizacion: 'Hola {nombre}, como recoge el contrato de {inmueble}, la renta se actualiza cada año. A partir de {mes} pasa de {antes} a {ahora} ({indice}: {porcentaje}).\n\nCualquier duda me dices. {propietario}',
    recibo_pdf: 'Hola {nombre}, te envío el recibo del alquiler de {inmueble} de {mes}. ¡Gracias! {propietario}',
  };

  function nuevo() {
    return { formato: 'mis-alquileres', v: 1, seq: 0, pro: false,
      ajustes: { propietario: '', formaPago: 'Bizum o transferencia', limiteGratis: 1 },
      plantillas: { ...PLANTILLAS },
      inmuebles: [], inquilinos: [], contratos: [], cargos: [], pagos: [], conceptos: [], gastos: [], reembolsos: [], fianzas: [],
      claves: {}, registro: [], adjuntos: [], numeracion: {}, actas: [] };
  }
  const id = (s) => ++s.seq;
  const por = (lista, i) => lista.find((x) => x.id === i);
  const exige = (lista, i, que) => { const x = por(lista, i); if (!x) throw err('NO_EXISTE', `${que} no encontrado`); return x; };
  function anota(s, hoy, que, ref, detalle) { s.registro.push({ fecha: hoy, que, ref, detalle: detalle || null }); }
  const hoyOk = (hoy) => { if (!esFecha(hoy)) throw err('FECHA', 'Fecha de hoy no válida'); return hoy; };
  function repetida(s, clave) { return clave && s.claves[clave] ? s.claves[clave] : null; }

  // ---------- Inmuebles e inquilinos ----------
  function puedeCrearInmueble(s) { return s.pro || s.inmuebles.filter((p) => !p.archivado).length < s.ajustes.limiteGratis; }
  function datosInmueble(d, base = {}) {
    const p = { ...base };
    for (const k of ['nombre', 'tipo', 'direccion', 'referencia', 'descripcion', 'notas']) if (d[k] !== undefined) p[k] = texto(d[k]);
    for (const k of ['superficie']) if (d[k] !== undefined) p[k] = d[k] == null || d[k] === '' ? null : Number(d[k]);
    for (const k of ['valor', 'compraPrecio', 'compraGastos', 'valorCatastral', 'valorCatastralConstruccion']) if (d[k] !== undefined) {
      if (d[k] != null && !(esCent(d[k]) && d[k] >= 0)) throw err('IMPORTE', 'Importe no válido');
      p[k] = d[k];
    }
    if (d.titulares !== undefined) {
      // Copropiedad: [{ nombre, nif, pct, yo }]; vacío = 100 % del usuario
      const l = (Array.isArray(d.titulares) ? d.titulares : []).map((x) => ({ nombre: texto(x.nombre), nif: texto(x.nif || ''), pct: Number(x.pct), yo: !!x.yo })).filter((x) => x.yo || x.nombre);
      if (l.some((x) => !(x.pct > 0 && x.pct <= 100))) throw err('DATOS', 'Cada titular debe tener un porcentaje entre 0 y 100');
      const suma = Math.round(l.reduce((t, x) => t + x.pct, 0) * 100) / 100;
      if (l.length > 1 && suma !== 100) throw err('DATOS', `Los porcentajes de los titulares deben sumar 100 (ahora suman ${String(suma).replace('.', ',')})`);
      p.titulares = l.length > 1 || (l.length === 1 && !l[0].yo) ? l : [];
    }
    if (d.compraFecha !== undefined) { if (d.compraFecha && !esFecha(d.compraFecha)) throw err('FECHA', 'Fecha de compra no válida'); p.compraFecha = d.compraFecha || null; }
    if (d.porUnidades !== undefined) p.porUnidades = !!d.porUnidades;
    if (d.imputacionPct !== undefined) p.imputacionPct = Number(d.imputacionPct) === 2 ? 2 : 1.1;
    if (p.valorCatastral != null && p.valorCatastralConstruccion != null && p.valorCatastralConstruccion > p.valorCatastral) throw err('IMPORTE', 'El valor catastral de la construcción no puede superar el valor catastral total');
    if (!p.nombre) throw err('DATOS', 'El nombre es obligatorio');
    if (!TIPOS.includes(p.tipo)) p.tipo = 'Otro';
    return p;
  }
  function crearInmueble(s, d, hoy) {
    hoyOk(hoy);
    if (!puedeCrearInmueble(s)) throw err('LIMITE', 'La versión gratuita admite un inmueble. Desbloquea la versión completa para añadir más.');
    const p = { id: id(s), archivado: false, porUnidades: false, hipoteca: null, ...datosInmueble(d) };
    s.inmuebles.push(p); anota(s, hoy, 'inmueble_creado', p.id);
    return p;
  }
  function editarInmueble(s, i, d) { const p = exige(s.inmuebles, i, 'Inmueble'); Object.assign(p, datosInmueble(d, p)); return p; }
  function archivarInmueble(s, i, archivar, hoy) {
    const p = exige(s.inmuebles, i, 'Inmueble');
    if (archivar && s.contratos.some((c) => c.inmuebleId === i && c.estado === 'activo')) throw err('EN_USO', 'Finaliza antes el contrato activo de este inmueble');
    if (!archivar && p.archivado && !puedeCrearInmueble(s)) throw err('LIMITE', 'La versión gratuita admite un inmueble activo.');
    p.archivado = !!archivar; anota(s, hoyOk(hoy), archivar ? 'inmueble_archivado' : 'inmueble_recuperado', i);
    return p;
  }
  function eliminarInmueble(s, i) {
    exige(s.inmuebles, i, 'Inmueble');
    if (s.contratos.some((c) => c.inmuebleId === i) || s.gastos.some((g) => g.inmuebleId === i && (g.pagado || g.anulado)))
      throw err('HISTORIAL', 'Este inmueble tiene historial. Archívalo en lugar de eliminarlo.');
    s.gastos = s.gastos.filter((g) => g.inmuebleId !== i); s.conceptos = s.conceptos.filter((c) => c.inmuebleId !== i);
    s.inmuebles = s.inmuebles.filter((p) => p.id !== i);
  }
  function datosInquilino(d, base = {}) {
    const q = { ...base };
    for (const k of ['nombre', 'dni', 'telefono', 'email', 'domicilio', 'notas', 'idioma']) if (d[k] !== undefined) q[k] = texto(d[k]);
    if (!q.nombre) throw err('DATOS', 'El nombre es obligatorio');
    return q;
  }
  function crearInquilino(s, d) { const q = { id: id(s), archivado: false, ...datosInquilino(d) }; s.inquilinos.push(q); return q; }
  function editarInquilino(s, i, d) { const q = exige(s.inquilinos, i, 'Inquilino'); Object.assign(q, datosInquilino(d, q)); return q; }
  function eliminarInquilino(s, i) {
    exige(s.inquilinos, i, 'Inquilino');
    if (s.contratos.some((c) => c.inquilinoId === i)) throw err('HISTORIAL', 'Este inquilino tiene contratos. Archívalo en lugar de eliminarlo.');
    s.inquilinos = s.inquilinos.filter((q) => q.id !== i);
  }
  function archivarInquilino(s, i, archivar) { const q = exige(s.inquilinos, i, 'Inquilino'); q.archivado = !!archivar; return q; }

  // ---------- Contratos ----------
  const finEfectivo = (ct) => (ct.estado === 'activo' ? ct.fin : ct.fechaBaja || ct.fin);
  function rentaEn(ct, mes) { let r = ct.rentas[0].importe; for (const x of ct.rentas) if (x.desde <= mes) r = x.importe; return r; }
  const rentaActual = (ct, hoy) => rentaEn(ct, hoy.slice(0, 7));
  function contratoEn(s, inmuebleId, fecha) {
    return s.contratos.filter((c) => c.inmuebleId === inmuebleId && c.inicio <= fecha && (!finEfectivo(c) || finEfectivo(c) >= fecha))
      .sort((a, b) => b.inicio.localeCompare(a.inicio))[0] || null;
  }
  const contratosEn = (s, inmuebleId, fecha) => s.contratos.filter((c) => c.inmuebleId === inmuebleId && c.inicio <= fecha && (!finEfectivo(c) || finEfectivo(c) >= fecha)).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id - b.id);
  // Reparto a partes iguales (los céntimos sobrantes, a los primeros)
  function repartir(total, cts) { const n = cts.length, base = Math.floor(total / n); let resto = total - base * n; return cts.map((c) => ({ contratoId: c.id, importe: base + (resto-- > 0 ? 1 : 0) })); }
  // Destino del cobro al inquilino: si el inmueble se alquila por habitaciones y hay varios inquilinos, se reparte entre todos
  function destinoRepercusion(s, inmuebleId, fecha, total) {
    const p = por(s.inmuebles, inmuebleId), cts = p && p.porUnidades ? contratosEn(s, inmuebleId, fecha) : [];
    if (cts.length > 1) return { contratoId: cts[0].id, repercutir: total, reparto: repartir(total, cts) };
    const ct = contratoEn(s, inmuebleId, fecha);
    return ct ? { contratoId: ct.id, repercutir: total, reparto: null } : null;
  }
  function conflicto(s, inmuebleId, inicio, fin, exceptoId) {
    const p = por(s.inmuebles, inmuebleId);
    if (p && p.porUnidades) return null;
    return s.contratos.find((c) => c.id !== exceptoId && c.inmuebleId === inmuebleId &&
      c.inicio <= (fin || '9999-12-31') && (finEfectivo(c) || '9999-12-31') >= inicio) || null;
  }
  function avisaConflicto(s, c) {
    const q = por(s.inquilinos, c.inquilinoId);
    return err('SOLAPE', `Ese inmueble ya tiene un contrato en esas fechas (${q ? q.nombre : 'otro inquilino'}, desde ${c.inicio}${finEfectivo(c) ? ' hasta ' + finEfectivo(c) : ''}).`);
  }
  const VIVIENDA = ['Vivienda', 'Habitación'];
  const LEY_VIVIENDA = '2023-05-26';
  // Impuesto indirecto de la renta (locales, oficinas, naves…). En Canarias, IGIC; en la península y Baleares, IVA.
  const IMPUESTOS = { ninguno: { nombre: '', pct: 0 }, igic: { nombre: 'IGIC', pct: 7 }, iva: { nombre: 'IVA', pct: 21 } };
  const RETENCION = 19;
  // Tipos generales con fecha de efecto (mes «AAAA-MM»). Cada recibo usa el vigente en su mes y lo guarda,
  // así los recibos y facturas anteriores nunca cambian aunque cambie el tipo.
  const TIPOS_DEF = { igic: [{ desde: '2000-01', pct: 7 }], iva: [{ desde: '2000-01', pct: 21 }], ret: [{ desde: '2000-01', pct: RETENCION }] };
  function tipos(s) { const t = (s.ajustes && s.ajustes.tipos) || {}; return { igic: t.igic && t.igic.length ? t.igic : TIPOS_DEF.igic, iva: t.iva && t.iva.length ? t.iva : TIPOS_DEF.iva, ret: t.ret && t.ret.length ? t.ret : TIPOS_DEF.ret }; }
  function tipoEn(s, clave, periodo) { const l = tipos(s)[clave]; let v = l[0].pct; for (const x of l) if (x.desde <= periodo) v = x.pct; return v; }
  function desglose(s, ct, base, periodo) {
    const tipo = IMPUESTOS[ct.impuesto] && ct.impuesto !== 'ninguno' ? ct.impuesto : null, p = periodo || '9999-12';
    const pct = tipo ? (ct.impuestoPct != null ? ct.impuestoPct : tipoEn(s, tipo, p)) : 0, retPct = ct.retencion ? tipoEn(s, 'ret', p) : 0;
    const cuota = Math.round(base * pct / 100), ret = Math.round(base * retPct / 100);
    return { base, impuesto: tipo, pct, cuota, retPct, ret, importe: base + cuota - ret };
  }
  // Importe del recibo: lo que el inquilino paga de verdad (base + impuesto − retención). Si no hay ni impuesto ni retención, la base.
  function fijarImporte(s, ct, cg, base) {
    const d = desglose(s, ct, base, cg.periodo);
    if (d.impuesto || d.ret) Object.assign(cg, { base, impuesto: d.impuesto, pct: d.pct, cuota: d.cuota, retPct: d.retPct, ret: d.ret, importe: d.importe });
    else { delete cg.base; delete cg.impuesto; delete cg.pct; delete cg.cuota; delete cg.retPct; delete cg.ret; cg.importe = base; }
    return cg;
  }
  // Se puede recalcular un recibo si no tiene cobros ni factura emitida
  const recalculable = (s, cg) => !cg.anulado && !cg.factura && pagadoDe(s, cg.id) === 0;
  // Nuevo tipo general desde un mes: recalcula solo los recibos de ese mes en adelante que aún se pueden tocar
  function cambiarTipo(s, clave, pct, desde, hoy) {
    hoyOk(hoy);
    if (!TIPOS_DEF[clave]) throw err('DATOS', 'Impuesto no válido');
    const v = Number(String(pct).replace(',', '.'));
    if (!(v >= 0 && v <= 50)) throw err('DATOS', 'Tipo de impuesto no válido');
    if (!/^\d{4}-\d{2}$/.test(desde || '')) throw err('FECHA', 'Indica desde qué mes se aplica');
    s.ajustes.tipos = s.ajustes.tipos || {};
    const l = tipos(s)[clave].filter((x) => x.desde !== desde).concat([{ desde, pct: v }]).sort((a, b) => a.desde.localeCompare(b.desde));
    s.ajustes.tipos[clave] = l;
    let n = 0;
    for (const cg of s.cargos) {
      if (cg.base == null || cg.periodo < desde || !recalculable(s, cg)) continue;
      const ct = por(s.contratos, cg.contratoId); if (!ct) continue;
      const antes = cg.importe; fijarImporte(s, ct, cg, cg.base); if (cg.importe !== antes) n++;
    }
    anota(s, hoy, 'tipo_cambiado', 0, { clave, pct: v, desde, recibos: n });
    return n;
  }
  function quitarTipo(s, clave, desde, hoy) {
    const l = tipos(s)[clave]; if (l.length < 2) throw err('DATOS', 'Tiene que quedar al menos un tipo');
    s.ajustes.tipos = s.ajustes.tipos || {}; s.ajustes.tipos[clave] = l.filter((x) => x.desde !== desde);
    let n = 0;
    for (const cg of s.cargos) { if (cg.base == null || cg.periodo < desde || !recalculable(s, cg)) continue; const ct = por(s.contratos, cg.contratoId); if (ct) { const a = cg.importe; fijarImporte(s, ct, cg, cg.base); if (cg.importe !== a) n++; } }
    anota(s, hoyOk(hoy), 'tipo_cambiado', 0, { clave, quitado: desde, recibos: n });
    return n;
  }
  const baseDe = (cg) => (cg.base != null ? cg.base : cg.importe);
  // Datos del contrato que no afectan a los recibos: uso, firma, actualización anual, IRPF y depósito de la fianza
  function extrasContrato(d, ct, p) {
    if (d.firma !== undefined) { if (d.firma && !esFecha(d.firma)) throw err('FECHA', 'Fecha de firma no válida'); ct.firma = d.firma || null; }
    if (d.uso !== undefined) ct.uso = d.uso === 'otro' ? 'otro' : 'vivienda';
    if (!ct.uso) ct.uso = p && VIVIENDA.includes(p.tipo) ? 'vivienda' : 'otro';
    if (d.actualizacion !== undefined) ct.actualizacion = ['irav', 'ipc', 'fijo', 'ninguna'].includes(d.actualizacion) ? d.actualizacion : 'ninguna';
    if (!ct.actualizacion) ct.actualizacion = ct.uso === 'vivienda' && (ct.firma || ct.inicio) >= LEY_VIVIENDA ? 'irav' : 'ipc';
    if (d.actualizacionPct !== undefined) ct.actualizacionPct = d.actualizacionPct == null || d.actualizacionPct === '' ? null : Number(d.actualizacionPct);
    if (d.reduccion !== undefined) ct.reduccion = d.reduccion == null || d.reduccion === '' ? null : [0, 50, 60, 70, 90].includes(Number(d.reduccion)) ? Number(d.reduccion) : null;
    if (d.retencion !== undefined) ct.retencion = !!d.retencion;
    if (d.impuesto !== undefined) ct.impuesto = IMPUESTOS[d.impuesto] ? d.impuesto : 'ninguno';
    if (d.impuestoPct !== undefined) { const v = d.impuestoPct == null || d.impuestoPct === '' ? null : Number(String(d.impuestoPct).replace(',', '.')); if (v != null && !(v >= 0 && v <= 30)) throw err('DATOS', 'Tipo de impuesto no válido'); ct.impuestoPct = v; }
    if (!ct.deposito) ct.deposito = { organismo: '', fecha: null, referencia: '', noAplica: false, recuperado: null };
    return ct;
  }
  function crearContrato(s, d, hoy) {
    hoyOk(hoy);
    const p = exige(s.inmuebles, d.inmuebleId, 'Inmueble'); exige(s.inquilinos, d.inquilinoId, 'Inquilino');
    if (p.archivado) throw err('DATOS', 'El inmueble está archivado');
    if (!esFecha(d.inicio)) throw err('FECHA', 'La fecha de inicio es obligatoria');
    if (d.fin && (!esFecha(d.fin) || d.fin < d.inicio)) throw err('FECHA', 'La fecha de fin no es válida o es anterior al inicio');
    if (!(esCent(d.importe) && d.importe > 0)) throw err('IMPORTE', 'La renta debe ser mayor que 0');
    const dia = d.diaCobro == null ? 1 : Number(d.diaCobro);
    if (!(Number.isInteger(dia) && dia >= 1 && dia <= 31)) throw err('DATOS', 'El día de cobro debe estar entre 1 y 31');
    if (d.fianza != null && !(esCent(d.fianza) && d.fianza >= 0)) throw err('IMPORTE', 'Fianza no válida');
    const c = conflicto(s, d.inmuebleId, d.inicio, d.fin || null);
    if (c) throw avisaConflicto(s, c);
    const ct = { id: id(s), inmuebleId: d.inmuebleId, inquilinoId: d.inquilinoId, inicio: d.inicio, fin: d.fin || null, diaCobro: dia,
      rentas: [{ desde: d.inicio.slice(0, 7), importe: d.importe }], fianza: d.fianza || 0, avisoMeses: d.avisoMeses == null ? 1 : Number(d.avisoMeses),
      estado: 'activo', fechaBaja: null, llaves: null, avisoEnviado: null, vehiculo: texto(d.vehiculo), actividad: texto(d.actividad), notas: texto(d.notas) };
    extrasContrato(d, ct, p);
    s.contratos.push(ct); anota(s, hoy, 'contrato_creado', ct.id);
    generarCargos(s, hoy);
    // Solo si el usuario lo marca expresamente: meses anteriores cobrados, señalados como estimados
    if (d.historicoCobrado === true) {
      const mes = hoy.slice(0, 7);
      for (const cg of s.cargos.filter((x) => x.contratoId === ct.id && x.periodo < mes))
        s.pagos.push({ id: id(s), cargoId: cg.id, importe: cg.importe, fecha: cg.vence, metodo: 'Anterior a la app', notas: '', origen: 'estimado', anulado: null });
    }
    return ct;
  }
  function editarContrato(s, i, d, hoy) {
    const ct = exige(s.contratos, i, 'Contrato'); hoyOk(hoy);
    const conHistoria = s.cargos.some((c) => c.contratoId === i && pagadoDe(s, c.id) > 0);
    const inicio = d.inicio !== undefined ? d.inicio : ct.inicio, fin = d.fin !== undefined ? d.fin || null : ct.fin;
    if (!esFecha(inicio) || (fin && (!esFecha(fin) || fin < inicio))) throw err('FECHA', 'Fechas del contrato no válidas');
    if (conHistoria && inicio !== ct.inicio) throw err('HISTORIAL', 'Este contrato ya tiene cobros: no se puede cambiar su fecha de inicio');
    const c = ct.estado === 'activo' ? conflicto(s, ct.inmuebleId, inicio, fin, i) : null;
    if (c) throw avisaConflicto(s, c);
    if (d.diaCobro !== undefined) { const dia = Number(d.diaCobro); if (!(Number.isInteger(dia) && dia >= 1 && dia <= 31)) throw err('DATOS', 'El día de cobro debe estar entre 1 y 31'); ct.diaCobro = dia; }
    if (d.fianza !== undefined) { if (!(esCent(d.fianza) && d.fianza >= 0)) throw err('IMPORTE', 'Fianza no válida'); ct.fianza = d.fianza; }
    if (d.avisoMeses !== undefined) ct.avisoMeses = Number(d.avisoMeses) || 0;
    for (const k of ['vehiculo', 'actividad', 'notas']) if (d[k] !== undefined) ct[k] = texto(d[k]);
    extrasContrato(d, ct, por(s.inmuebles, ct.inmuebleId));
    if (fin !== ct.fin) ct.avisoEnviado = null;
    if (inicio !== ct.inicio) { ct.rentas[0].desde = inicio.slice(0, 7); }
    ct.inicio = inicio; ct.fin = fin;
    recortarCargos(s, ct, hoy); generarCargos(s, hoy);
    for (const cg of s.cargos.filter((x) => x.contratoId === i && !x.anulado && pagadoDe(s, x.id) === 0)) { cg.vence = vence(cg.periodo, ct.diaCobro); if (!cg.factura) fijarImporte(s, ct, cg, baseDe(cg)); }
    anota(s, hoy, 'contrato_editado', i);
    return ct;
  }
  // Los recibos sin cobros que quedan fuera del contrato se anulan (no se borran)
  function recortarCargos(s, ct, hoy) {
    const ini = ct.inicio.slice(0, 7), f = finEfectivo(ct), fin = f ? f.slice(0, 7) : null;
    for (const cg of s.cargos.filter((x) => x.contratoId === ct.id && !x.anulado))
      if ((cg.periodo < ini || (fin && cg.periodo > fin)) && pagadoDe(s, cg.id) === 0) cg.anulado = { fecha: hoy, motivo: 'Fuera de las fechas del contrato' };
  }
  function revisarRenta(s, i, { desde, importe }, hoy) {
    const ct = exige(s.contratos, i, 'Contrato'); hoyOk(hoy);
    if (!esMes(desde) || desde < ct.inicio.slice(0, 7)) throw err('FECHA', 'Indica desde qué mes se aplica la nueva renta');
    if (!(esCent(importe) && importe > 0)) throw err('IMPORTE', 'La renta debe ser mayor que 0');
    ct.rentas = ct.rentas.filter((r) => r.desde !== desde).concat({ desde, importe }).sort((a, b) => a.desde.localeCompare(b.desde));
    // Solo cambian los recibos sin ningún cobro; los ya cobrados o a medias conservan su importe
    for (const cg of s.cargos.filter((x) => x.contratoId === i && !x.anulado && x.periodo >= desde && pagadoDe(s, x.id) === 0 && !x.factura)) fijarImporte(s, ct, cg, rentaEn(ct, cg.periodo));
    anota(s, hoy, 'renta_revisada', i, { desde, importe });
    return ct;
  }
  function finalizarContrato(s, i, { fecha, estado, llaves }, hoy) {
    const ct = exige(s.contratos, i, 'Contrato'); hoyOk(hoy);
    if (!esFecha(fecha) || fecha < ct.inicio) throw err('FECHA', 'Fecha de finalización no válida');
    if (!['finalizado', 'rescindido'].includes(estado)) throw err('DATOS', 'Estado no válido');
    ct.estado = estado; ct.fechaBaja = fecha; ct.llaves = llaves && esFecha(llaves) && llaves >= fecha ? llaves : fecha;
    recortarCargos(s, ct, hoy); anota(s, hoy, 'contrato_' + estado, i, { fecha });
    return ct;
  }
  function renovarContrato(s, i, { fin, importe, desde }, hoy) {
    const ct = exige(s.contratos, i, 'Contrato'); hoyOk(hoy);
    if (fin && (!esFecha(fin) || fin <= (finEfectivo(ct) || ct.inicio))) throw err('FECHA', 'La nueva fecha de fin debe ser posterior a la actual');
    const c = conflicto(s, ct.inmuebleId, ct.inicio, fin || null, i);
    if (c) throw avisaConflicto(s, c);
    const anterior = finEfectivo(ct);
    ct.estado = 'activo'; ct.fechaBaja = null; ct.llaves = null; ct.fin = fin || null; ct.avisoEnviado = null;
    if (importe != null) revisarRenta(s, i, { desde: desde || (anterior ? mesMas(anterior.slice(0, 7), 1) : hoy.slice(0, 7)), importe }, hoy);
    generarCargos(s, hoy); anota(s, hoy, 'contrato_renovado', i, { fin: fin || null });
    return ct;
  }
  function eliminarContrato(s, i) {
    exige(s.contratos, i, 'Contrato');
    const cargos = new Set(s.cargos.filter((c) => c.contratoId === i).map((c) => c.id));
    if (s.pagos.some((p) => cargos.has(p.cargoId)) || s.fianzas.some((f) => f.contratoId === i) || s.gastos.some((g) => g.contratoId === i && s.reembolsos.some((r) => r.gastoId === g.id)))
      throw err('HISTORIAL', 'Este contrato tiene cobros o fianza registrados. Finalízalo en lugar de eliminarlo.');
    s.cargos = s.cargos.filter((c) => c.contratoId !== i);
    for (const g of s.gastos) if (g.contratoId === i) { g.contratoId = null; g.repercutir = 0; }
    s.contratos = s.contratos.filter((c) => c.id !== i);
  }
  function situacionContrato(ct, hoy) {
    if (ct.estado !== 'activo') return ct.estado;
    if (ct.inicio > hoy) return 'futuro';
    if (ct.fin && ct.fin < hoy) return 'vencido';
    if (ct.fin && masMeses(ct.fin, -(ct.avisoMeses || 1)) <= hoy) return 'por_vencer';
    return 'vigente';
  }

  // ---------- Recibos de renta y cobros ----------
  // Crea los recibos que faltan hasta el mes en curso. Se llama al abrir la app y tras cambios; nunca borra.
  function generarCargos(s, hoy) {
    const mes = hoyOk(hoy).slice(0, 7), hay = new Set(s.cargos.map((c) => c.contratoId + '|' + c.periodo));
    let n = 0;
    for (const ct of s.contratos) {
      const f = finEfectivo(ct), tope = f && f.slice(0, 7) < mes ? f.slice(0, 7) : mes;
      for (let p = ct.inicio.slice(0, 7), i = 0; p <= tope && i < 1200; i++, p = mesMas(p, 1)) {
        if (hay.has(ct.id + '|' + p)) continue;
        s.cargos.push(fijarImporte(s, ct, { id: id(s), contratoId: ct.id, periodo: p, vence: vence(p, ct.diaCobro), importe: 0, anulado: null, recordatorio: null }, rentaEn(ct, p)));
        n++;
      }
    }
    return n;
  }
  const pagadoDe = (s, cargoId) => s.pagos.reduce((t, p) => (p.cargoId === cargoId && !p.anulado ? t + p.importe : t), 0);
  function estadoCargo(s, c, hoy) {
    if (c.anulado) return 'anulado';
    const pg = pagadoDe(s, c.id);
    if (pg >= c.importe) return 'pagado';
    if (c.vence < hoy) return 'atrasado';
    return pg > 0 ? 'parcial' : 'pendiente';
  }
  function registrarPago(s, d, hoy) {
    hoyOk(hoy);
    const ya = repetida(s, d.clave);
    if (ya) return { repetido: true, pagos: ya };
    const cg = exige(s.cargos, d.cargoId, 'Recibo');
    if (cg.anulado) throw err('ANULADO', 'Ese recibo está anulado');
    if (!(esCent(d.importe) && d.importe > 0)) throw err('IMPORTE', 'Indica un importe mayor que 0');
    const fecha = d.fecha || hoy;
    if (!esFecha(fecha) || fecha > hoy) throw err('FECHA', 'La fecha del pago no es válida o es futura');
    // Reparto: primero este recibo; el exceso solo si el usuario lo pide, a los recibos pendientes más antiguos
    const plan = [], pend = cg.importe - pagadoDe(s, cg.id);
    if (pend <= 0) throw err('EXCESO', 'Este recibo ya está cobrado por completo', { pendiente: 0 });
    let resto = d.importe;
    plan.push([cg.id, Math.min(resto, pend)]); resto -= plan[0][1];
    if (resto > 0) {
      if (!d.repartir) throw err('EXCESO', `El importe supera lo pendiente de este recibo (${euros(pend)}).`, { pendiente: pend });
      const otros = s.cargos.filter((x) => x.contratoId === cg.contratoId && x.id !== cg.id && !x.anulado).sort((a, b) => a.periodo.localeCompare(b.periodo));
      for (const o of otros) { const q = o.importe - pagadoDe(s, o.id); if (q > 0 && resto > 0) { const a = Math.min(q, resto); plan.push([o.id, a]); resto -= a; } }
      if (resto > 0) throw err('EXCESO', `Sobran ${euros(resto)}: no hay más recibos pendientes de este contrato.`, { sobrante: resto });
    }
    const ids = plan.map(([cargoId, importe]) => { const p = { id: id(s), cargoId, importe, fecha, metodo: texto(d.metodo), notas: texto(d.notas), origen: 'pago', anulado: null }; s.pagos.push(p); return p.id; });
    if (d.clave) s.claves[d.clave] = ids;
    anota(s, hoy, 'pago', cg.id, { importe: d.importe, fecha });
    return { repetido: false, pagos: ids };
  }
  function anularPago(s, i, motivo, hoy) {
    const p = exige(s.pagos, i, 'Pago');
    if (p.anulado) return p;
    p.anulado = { fecha: hoyOk(hoy), motivo: texto(motivo) || 'Anulado' }; anota(s, hoy, 'pago_anulado', i, { importe: p.importe });
    return p;
  }
  function anularCargo(s, i, motivo, hoy) {
    const c = exige(s.cargos, i, 'Recibo');
    if (pagadoDe(s, i) > 0) throw err('HISTORIAL', 'Este recibo tiene cobros. Anula antes esos cobros.');
    c.anulado = { fecha: hoyOk(hoy), motivo: texto(motivo) || 'Anulado' }; anota(s, hoy, 'recibo_anulado', i);
    return c;
  }
  function restaurarCargo(s, i, hoy) { const c = exige(s.cargos, i, 'Recibo'); c.anulado = null; anota(s, hoyOk(hoy), 'recibo_restaurado', i); return c; }
  function ajustarCargo(s, i, importe, hoy) {
    const c = exige(s.cargos, i, 'Recibo'), ct = por(s.contratos, c.contratoId);
    if (!(esCent(importe) && importe >= 0)) throw err('IMPORTE', 'Importe no válido');
    if (c.factura) throw err('FACTURA', `Este recibo ya tiene la factura ${c.factura.numero}: no se puede cambiar. Si hay un error, anúlalo y haz una rectificativa con tu asesor.`);
    const nuevo = c.base != null ? desglose(s, ct, importe, c.periodo).importe : importe;
    if (nuevo < pagadoDe(s, i)) throw err('IMPORTE', 'El importe no puede ser menor que lo ya cobrado');
    anota(s, hoyOk(hoy), 'recibo_ajustado', i, { antes: c.importe, ahora: nuevo }); if (c.base != null) fijarImporte(s, ct, c, importe); else c.importe = importe;
    return c;
  }
  function vistaCargo(s, c, hoy) {
    const ct = por(s.contratos, c.contratoId), pg = pagadoDe(s, c.id);
    const ult = s.pagos.filter((p) => p.cargoId === c.id && !p.anulado).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id).pop();
    return { ...c, estado: estadoCargo(s, c, hoy), pagado: pg, pendiente: Math.max(0, c.importe - pg), fechaPago: ult ? ult.fecha : null, metodo: ult ? ult.metodo : '',
      estimado: s.pagos.some((p) => p.cargoId === c.id && !p.anulado && p.origen === 'estimado'),
      inmueble: (por(s.inmuebles, ct.inmuebleId) || {}).nombre || '', inquilino: (por(s.inquilinos, ct.inquilinoId) || {}).nombre || '',
      telefono: (por(s.inquilinos, ct.inquilinoId) || {}).telefono || '', inmuebleId: ct.inmuebleId, inquilinoId: ct.inquilinoId };
  }
  const cargos = (s, hoy, filtro) => s.cargos.filter(filtro || (() => true)).map((c) => vistaCargo(s, c, hoy)).sort((a, b) => a.vence.localeCompare(b.vence) || a.inmueble.localeCompare(b.inmueble));

  // ---------- Fianzas ----------
  function saldoFianza(s, contratoId) {
    return s.fianzas.reduce((t, f) => (f.contratoId !== contratoId || f.anulado ? t : t + (f.tipo === 'recibida' ? f.importe : -f.importe)), 0);
  }
  function registrarFianza(s, d, hoy) {
    hoyOk(hoy); exige(s.contratos, d.contratoId, 'Contrato');
    const ya = repetida(s, d.clave); if (ya) return { repetido: true, id: ya[0] };
    if (!['recibida', 'devuelta', 'retenida'].includes(d.tipo)) throw err('DATOS', 'Tipo de movimiento no válido');
    if (!(esCent(d.importe) && d.importe > 0)) throw err('IMPORTE', 'Indica un importe mayor que 0');
    const fecha = d.fecha || hoy; if (!esFecha(fecha) || fecha > hoy) throw err('FECHA', 'Fecha no válida o futura');
    if (d.tipo !== 'recibida' && d.importe > saldoFianza(s, d.contratoId)) throw err('EXCESO', 'El importe supera la fianza que tienes en depósito');
    const f = { id: id(s), contratoId: d.contratoId, tipo: d.tipo, importe: d.importe, fecha, notas: texto(d.notas), anulado: null };
    s.fianzas.push(f); if (d.clave) s.claves[d.clave] = [f.id]; anota(s, hoy, 'fianza_' + d.tipo, d.contratoId, { importe: d.importe });
    return { repetido: false, id: f.id };
  }
  function anularFianza(s, i, motivo, hoy) {
    const f = exige(s.fianzas, i, 'Movimiento');
    if (f.tipo === 'recibida' && saldoFianza(s, f.contratoId) - f.importe < 0) throw err('HISTORIAL', 'Anula antes las devoluciones de esta fianza');
    f.anulado = { fecha: hoyOk(hoy), motivo: texto(motivo) || 'Anulado' }; return f;
  }

  // ---------- Gastos ----------
  function datosConcepto(d, base = {}, hoy) {
    const c = { ...base };
    if (d.concepto !== undefined) c.concepto = texto(d.concepto);
    if (d.categoria !== undefined) c.categoria = CATEGORIAS[d.categoria] ? d.categoria : 'otro';
    if (d.responsable !== undefined) c.responsable = RESPONSABLES[d.responsable] ? d.responsable : 'propietario';
    if (d.porcentaje !== undefined) c.porcentaje = Math.min(100, Math.max(0, Number(d.porcentaje) || 0));
    if (d.periodicidad !== undefined) c.periodicidad = PERIODICIDADES[d.periodicidad] ? d.periodicidad : 'anual';
    if (d.mesInicio !== undefined) c.mesInicio = Math.min(12, Math.max(1, Number(d.mesInicio) || 1));
    if (d.dia !== undefined) c.dia = Math.min(31, Math.max(1, Number(d.dia) || 1));
    if (d.importe !== undefined) { if (d.importe != null && !(esCent(d.importe) && d.importe >= 0)) throw err('IMPORTE', 'Importe no válido'); c.importe = d.importe || 0; }
    if (d.desde !== undefined) c.desde = esMes(d.desde) ? d.desde : hoy.slice(0, 7);
    if (d.hasta !== undefined) c.hasta = esMes(d.hasta) ? d.hasta : null;
    if (d.domiciliado !== undefined) c.domiciliado = !!d.domiciliado;
    for (const k of ['proveedor', 'notas']) if (d[k] !== undefined) c[k] = texto(d[k]);
    if (!c.concepto) throw err('DATOS', 'Indica el concepto');
    return c;
  }
  function crearConcepto(s, d, hoy) {
    hoyOk(hoy); exige(s.inmuebles, d.inmuebleId, 'Inmueble');
    const c = { id: id(s), inmuebleId: d.inmuebleId, creado: hoy, activo: true,
      ...datosConcepto(d, { categoria: 'otro', responsable: 'propietario', porcentaje: 100, periodicidad: 'anual', mesInicio: 1, dia: 1, importe: 0, desde: hoy.slice(0, 7), hasta: null, domiciliado: false, proveedor: '', notas: '' }, hoy) };
    s.conceptos.push(c); generarGastos(s, hoy);
    return c;
  }
  // Tras cambiar un concepto se rehacen solo las previsiones futuras sin ningún movimiento
  function editarConcepto(s, i, d, hoy) {
    const c = exige(s.conceptos, i, 'Concepto'); hoyOk(hoy);
    Object.assign(c, datosConcepto(d, c, hoy));
    if (d.activo !== undefined) c.activo = !!d.activo;
    const mes = hoy.slice(0, 7);
    s.gastos = s.gastos.filter((g) => !(g.conceptoId === i && g.clave >= mes && !g.pagado && !g.anulado && !s.reembolsos.some((r) => r.gastoId === g.id)));
    generarGastos(s, hoy);
    return c;
  }
  function eliminarConcepto(s, i, hoy) {
    exige(s.conceptos, i, 'Concepto');
    const conMov = (g) => g.pagado || g.anulado || s.reembolsos.some((r) => r.gastoId === g.id);
    s.gastos = s.gastos.filter((g) => g.conceptoId !== i || conMov(g));
    if (s.gastos.some((g) => g.conceptoId === i)) { por(s.conceptos, i).activo = false; por(s.conceptos, i).hasta = hoyOk(hoy).slice(0, 7); }
    else s.conceptos = s.conceptos.filter((c) => c.id !== i);
  }
  const etiqueta = (mes, per) => (per === 'anual' ? mes.slice(0, 4) : `${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+mes.slice(5) - 1]} ${mes.slice(0, 4)}`);
  function repercute(s, c, inmuebleId, fecha, importe) {
    if (c.responsable !== 'repercute') return { contratoId: null, repercutir: 0, reparto: null };
    return destinoRepercusion(s, inmuebleId, fecha, Math.round(importe * (c.porcentaje == null ? 100 : c.porcentaje) / 100)) || { contratoId: null, repercutir: 0, reparto: null };
  }
  // Crea las previsiones que faltan hasta el mes siguiente. Nunca marca nada como pagado por su cuenta,
  // salvo el histórico anterior al alta del concepto en la app, que queda como «estimado».
  function generarGastos(s, hoy) {
    const limite = mesMas(hoyOk(hoy).slice(0, 7), 1), hay = new Set(s.gastos.filter((g) => g.conceptoId).map((g) => g.conceptoId + '|' + g.clave));
    let n = 0;
    for (const c of s.conceptos) {
      if (!c.activo || c.responsable === 'inquilino' || !(c.importe > 0)) continue;
      const paso = PERIODICIDADES[c.periodicidad] || 12, tope = c.hasta && c.hasta < limite ? c.hasta : limite;
      const cuotas = c.categoria === 'financiacion' && c.hipoteca ? new Map(cuadroHipoteca(por(s.inmuebles, c.inmuebleId).hipoteca).map((t) => [t.fecha.slice(0, 7), t])) : null;
      for (let p = c.desde, i = 0; p <= tope && i < 1200; i++, p = mesMas(p, 1)) {
        if ((((+p.slice(5) - c.mesInicio) % paso) + paso) % paso !== 0 || hay.has(c.id + '|' + p)) continue;
        const cuota = cuotas ? cuotas.get(p) : null;
        if (cuotas && !cuota) continue;
        const fecha = vence(p, c.dia), importe = cuota ? cuota.cuota : c.importe, historico = p < c.creado.slice(0, 7);
        s.gastos.push({ id: id(s), inmuebleId: c.inmuebleId, conceptoId: c.id, clave: p, concepto: c.concepto, categoria: c.categoria, periodo: etiqueta(p, c.periodicidad),
          fecha, importe, estimado: historico, pagado: historico ? { fecha } : null, anulado: null, notas: '', recordatorio: null, ...repercute(s, c, c.inmuebleId, fecha, importe) });
        n++;
      }
    }
    return n;
  }
  function estadoGasto(s, g, hoy) {
    if (g.anulado) return 'anulado';
    if (g.pagado) return 'pagado';
    if (g.fecha >= hoy) return 'previsto';
    const c = g.conceptoId ? por(s.conceptos, g.conceptoId) : null;
    return c && c.domiciliado ? 'por_confirmar' : 'vencido';
  }
  function crearGasto(s, d, hoy) {
    hoyOk(hoy); exige(s.inmuebles, d.inmuebleId, 'Inmueble');
    if (!texto(d.concepto)) throw err('DATOS', 'Indica el concepto');
    if (!(esCent(d.importe) && d.importe >= 0)) throw err('IMPORTE', 'Importe no válido');
    const fecha = d.fecha || hoy; if (!esFecha(fecha)) throw err('FECHA', 'Fecha no válida');
    const rep = d.repercutir || 0;
    if (!(esCent(rep) && rep >= 0 && rep <= d.importe)) throw err('IMPORTE', 'Lo que se cobra al inquilino no puede superar el gasto');
    const dst = rep > 0 ? destinoRepercusion(s, d.inmuebleId, fecha, rep) : null;
    if (rep > 0 && !dst) throw err('DATOS', 'Ese inmueble no tenía inquilino en esa fecha al que cobrar el gasto');
    const g = { id: id(s), inmuebleId: d.inmuebleId, conceptoId: null, clave: null, concepto: texto(d.concepto), categoria: CATEGORIAS[d.categoria] ? d.categoria : 'otro',
      periodo: etiqueta(fecha.slice(0, 7), 'mensual'), fecha, importe: d.importe, estimado: false, pagado: d.pagado ? { fecha: d.fechaPago || fecha } : null, anulado: null,
      notas: texto(d.notas), recordatorio: null, contratoId: dst ? dst.contratoId : null, repercutir: rep, reparto: dst ? dst.reparto : null };
    s.gastos.push(g); anota(s, hoy, 'gasto_creado', g.id);
    return g;
  }
  const reembolsado = (s, gastoId) => s.reembolsos.reduce((t, r) => (r.gastoId === gastoId && !r.anulado ? t + r.importe : t), 0);
  function confirmarGasto(s, i, d, hoy) {
    const g = exige(s.gastos, i, 'Gasto'); hoyOk(hoy); d = d || {};
    if (g.anulado) throw err('ANULADO', 'Ese gasto está anulado');
    const fecha = d.fecha || (g.fecha <= hoy ? g.fecha : hoy);
    if (!esFecha(fecha) || fecha > hoy) throw err('FECHA', 'La fecha de pago no es válida o es futura');
    if (d.importe != null) {
      if (!(esCent(d.importe) && d.importe >= 0)) throw err('IMPORTE', 'Importe no válido');
      const c = g.conceptoId ? por(s.conceptos, g.conceptoId) : null;
      if (g.repercutir > 0 && c && reembolsado(s, i) === 0) {
        g.repercutir = Math.round(d.importe * (c.porcentaje == null ? 100 : c.porcentaje) / 100);
        if (g.reparto) g.reparto = repartir(g.repercutir, g.reparto.map((x) => ({ id: x.contratoId })));
      }
      g.importe = d.importe;
    }
    g.pagado = { fecha }; g.estimado = false; anota(s, hoy, 'gasto_confirmado', i, { importe: g.importe, fecha });
    return g;
  }
  // Recibo devuelto por el banco o marcado por error
  function desconfirmarGasto(s, i, motivo, hoy) { const g = exige(s.gastos, i, 'Gasto'); g.pagado = null; anota(s, hoyOk(hoy), 'gasto_desconfirmado', i, { motivo: texto(motivo) }); return g; }
  function anularGasto(s, i, motivo, hoy) {
    const g = exige(s.gastos, i, 'Gasto');
    if (reembolsado(s, i) > 0) throw err('HISTORIAL', 'Este gasto tiene cobros del inquilino. Anúlalos antes.');
    g.anulado = { fecha: hoyOk(hoy), motivo: texto(motivo) || 'Anulado' }; anota(s, hoy, 'gasto_anulado', i);
    return g;
  }
  function registrarReembolso(s, d, hoy) {
    hoyOk(hoy);
    const ya = repetida(s, d.clave); if (ya) return { repetido: true, id: ya[0] };
    const g = exige(s.gastos, d.gastoId, 'Gasto');
    if (g.anulado) throw err('ANULADO', 'Ese gasto está anulado');
    if (!(esCent(d.importe) && d.importe > 0)) throw err('IMPORTE', 'Indica un importe mayor que 0');
    let contratoId = g.contratoId, pend = g.repercutir - reembolsado(s, g.id);
    if (g.reparto) {
      const pp = g.reparto.map((x) => ({ ...x, pend: x.importe - s.reembolsos.reduce((t, r) => (r.gastoId === g.id && !r.anulado && r.contratoId === x.contratoId ? t + r.importe : t), 0) }));
      const x = d.contratoId != null ? pp.find((y) => y.contratoId === d.contratoId) : pp.find((y) => y.pend > 0);
      if (!x) throw err('DATOS', 'Ese inquilino no participa en este gasto');
      contratoId = x.contratoId; pend = x.pend;
    }
    if (d.importe > pend) throw err('EXCESO', `El importe supera lo pendiente de cobrar (${euros(Math.max(0, pend))}).`, { pendiente: Math.max(0, pend) });
    const fecha = d.fecha || hoy; if (!esFecha(fecha) || fecha > hoy) throw err('FECHA', 'Fecha no válida o futura');
    const r = { id: id(s), gastoId: g.id, contratoId, importe: d.importe, fecha, metodo: texto(d.metodo), notas: texto(d.notas), anulado: null };
    s.reembolsos.push(r); if (d.clave) s.claves[d.clave] = [r.id]; anota(s, hoy, 'reembolso', g.id, { importe: d.importe });
    return { repetido: false, id: r.id };
  }
  function anularReembolso(s, i, motivo, hoy) { const r = exige(s.reembolsos, i, 'Cobro'); r.anulado = { fecha: hoyOk(hoy), motivo: texto(motivo) || 'Anulado' }; return r; }
  function vistaGasto(s, g, hoy) {
    const cob = reembolsado(s, g.id), ct = g.contratoId ? por(s.contratos, g.contratoId) : null, q = ct ? por(s.inquilinos, ct.inquilinoId) : null;
    const partes = g.reparto ? g.reparto.map((x) => { const c = por(s.contratos, x.contratoId) || {}, qq = por(s.inquilinos, c.inquilinoId) || {};
      const cobrado = s.reembolsos.reduce((t, r) => (r.gastoId === g.id && !r.anulado && r.contratoId === x.contratoId ? t + r.importe : t), 0);
      return { contratoId: x.contratoId, inquilinoId: qq.id, inquilino: qq.nombre || '', telefono: qq.telefono || '', importe: x.importe, cobrado, pendiente: g.anulado ? 0 : Math.max(0, x.importe - cobrado) }; }) : null;
    return { ...g, estado: estadoGasto(s, g, hoy), cobrado: cob, porCobrar: g.anulado ? 0 : Math.max(0, g.repercutir - cob), partes,
      inmueble: (por(s.inmuebles, g.inmuebleId) || {}).nombre || '', inquilino: partes ? partes.map((x) => x.inquilino).join(', ') : q ? q.nombre : '', telefono: partes ? '' : q ? q.telefono : '' };
  }
  const gastos = (s, hoy, filtro) => s.gastos.filter(filtro || (() => true)).map((g) => vistaGasto(s, g, hoy)).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.inmueble.localeCompare(b.inmueble));

  // Conceptos típicos por tipo de inmueble; el usuario los ajusta después
  const AMBITO = { 'Plaza de garaje': 'garaje', 'Plaza de moto': 'garaje', Trastero: 'garaje', Vivienda: 'vivienda', 'Local comercial': 'local', Oficina: 'local', Nave: 'local' };
  const IBI = { concepto: 'IBI', categoria: 'impuesto', periodicidad: 'anual', mesInicio: 9 }, COM = { concepto: 'Comunidad', categoria: 'comunidad', periodicidad: 'mensual' };
  const sum = (concepto, periodicidad) => ({ concepto, categoria: 'suministro', responsable: 'inquilino', periodicidad });
  const TIPICOS = {
    garaje: [IBI, COM], todos: [IBI, COM],
    vivienda: [IBI, COM, { concepto: 'Tasa de basura', categoria: 'impuesto', periodicidad: 'anual', mesInicio: 6 }, { concepto: 'Seguro de hogar', categoria: 'seguro', periodicidad: 'anual' },
      sum('Luz', 'mensual'), sum('Agua', 'bimestral'), sum('Internet y teléfono', 'mensual')],
    local: [{ ...IBI, responsable: 'repercute' }, COM, { concepto: 'Seguro del inmueble', categoria: 'seguro', periodicidad: 'anual' }, sum('Luz', 'mensual'), sum('Agua', 'bimestral')],
  };
  function cargarTipicos(s, inmuebleId, hoy) {
    const p = exige(s.inmuebles, inmuebleId, 'Inmueble'), hay = new Set(s.conceptos.filter((c) => c.inmuebleId === inmuebleId).map((c) => c.concepto.toLowerCase()));
    let n = 0;
    for (const t of TIPICOS[AMBITO[p.tipo] || 'todos']) if (!hay.has(t.concepto.toLowerCase())) { crearConcepto(s, { inmuebleId, ...t }, hoy); n++; }
    return n;
  }

  // ---------- Hipoteca (sistema francés, en céntimos) ----------
  function cuotaFrancesa(importe, tin, meses) {
    if (!(importe > 0) || !(meses > 0)) return null;
    const i = (Number(tin) || 0) / 1200;
    return Math.round(i ? (importe * i) / (1 - Math.pow(1 + i, -meses)) : importe / meses);
  }
  function cuadroHipoteca(h) {
    if (!h || !(h.importe > 0) || !(h.anios > 0) || !esFecha(h.inicio)) return [];
    const n = Math.round(h.anios * 12), i = (Number(h.tin) || 0) / 1200, cuota = h.cuota || cuotaFrancesa(h.importe, h.tin, n), t = [];
    let saldo = h.importe;
    for (let k = 0; k < n && saldo > 0; k++) {
      const interes = Math.round(saldo * i);
      let capital = Math.max(0, Math.min(saldo, cuota - interes));
      if (k === n - 1) capital = saldo; // la última cuota liquida el resto
      saldo -= capital;
      t.push({ fecha: masMeses(h.inicio, k), cuota: interes + capital, interes, capital, saldo });
    }
    return t;
  }
  function situacionHipoteca(h, hoy) {
    const t = cuadroHipoteca(h); if (!t.length) return null;
    const pagadas = t.filter((x) => x.fecha <= hoy), pendiente = pagadas.length ? pagadas[pagadas.length - 1].saldo : h.importe;
    return { cuota: t[0].cuota, pendiente, pagadas: pagadas.length, restantes: t.length - pagadas.length, fin: t[t.length - 1].fecha,
      amortizado: Math.round(((h.importe - pendiente) / h.importe) * 1000) / 10, activa: t.length > pagadas.length,
      enRango: (a, b) => t.filter((x) => x.fecha.slice(0, 7) >= a && x.fecha.slice(0, 7) <= b).reduce((r, x) => ({ cuotas: r.cuotas + x.cuota, intereses: r.intereses + x.interes, capital: r.capital + x.capital }), { cuotas: 0, intereses: 0, capital: 0 }) };
  }
  // La cuota se apunta como gasto mensual domiciliado mientras dure el préstamo
  function ponerHipoteca(s, inmuebleId, h, hoy) {
    const p = exige(s.inmuebles, inmuebleId, 'Inmueble'); hoyOk(hoy);
    const actual = s.conceptos.find((c) => c.inmuebleId === inmuebleId && c.hipoteca);
    if (!h) { p.hipoteca = null; if (actual) eliminarConcepto(s, actual.id, hoy); return p; }
    if (!(esCent(h.importe) && h.importe > 0) || !(h.anios > 0 && h.anios <= 50) || !esFecha(h.inicio)) throw err('DATOS', 'Para la hipoteca indica el importe prestado, el plazo (1 a 50 años) y la fecha de la primera cuota');
    if (h.tin != null && !(h.tin >= 0 && h.tin < 30)) throw err('DATOS', 'Interés no válido');
    if (h.cuota != null && !(esCent(h.cuota) && h.cuota > 0)) throw err('IMPORTE', 'Cuota no válida');
    p.hipoteca = { importe: h.importe, tin: Number(h.tin) || 0, anios: Number(h.anios), inicio: h.inicio, cuota: h.cuota || null };
    const sit = situacionHipoteca(p.hipoteca, hoy);
    const d = { concepto: 'Hipoteca', categoria: 'financiacion', responsable: 'propietario', porcentaje: 100, periodicidad: 'mensual', mesInicio: 1,
      dia: Number(h.inicio.slice(8)), importe: sit.cuota, domiciliado: true, desde: h.inicio.slice(0, 7), hasta: sit.fin.slice(0, 7) };
    if (actual) { s.gastos = s.gastos.filter((g) => !(g.conceptoId === actual.id && g.estimado && !s.reembolsos.some((r) => r.gastoId === g.id))); editarConcepto(s, actual.id, d, hoy); }
    else { const c = crearConcepto(s, { inmuebleId, ...d }, hoy); c.hipoteca = true; s.gastos = s.gastos.filter((g) => g.conceptoId !== c.id); generarGastos(s, hoy); }
    return p;
  }

  // ---------- Panel y avisos ----------
  function panel(s, hoy) {
    hoyOk(hoy);
    const mes = hoy.slice(0, 7), desde12 = mesMas(mes, -11), pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const vivos = s.cargos.filter((c) => !c.anulado), delMes = vivos.filter((c) => c.periodo === mes);
    const esperado = delMes.reduce((t, c) => t + c.importe, 0), cobrado = delMes.reduce((t, c) => t + Math.min(pagadoDe(s, c.id), c.importe), 0);
    const atrasados = vivos.filter((c) => c.vence < hoy && pagadoDe(s, c.id) < c.importe);
    const deuda = atrasados.reduce((t, c) => t + c.importe - pagadoDe(s, c.id), 0);
    const activos = s.inmuebles.filter((p) => !p.archivado);
    const vigentes = s.contratos.filter((c) => c.estado === 'activo' && c.inicio <= hoy && (!c.fin || c.fin >= hoy));
    const ocupados = new Set(vigentes.map((c) => c.inmuebleId));
    const cargoDe = new Map(s.cargos.map((c) => [c.id, c])), ctDe = new Map(s.contratos.map((c) => [c.id, c]));
    const ingresos = (a, b, pid) => s.pagos.reduce((t, p) => { if (p.anulado) return t; const m = p.fecha.slice(0, 7); if (m < a || m > b) return t;
      const cg = cargoDe.get(p.cargoId); return !cg || cg.anulado || (pid && ctDe.get(cg.contratoId).inmuebleId !== pid) ? t : t + (cg.base != null && cg.importe ? Math.round(p.importe * cg.base / cg.importe) : p.importe); }, 0);
    const gastado = (a, b, pid, fin) => s.gastos.reduce((t, g) => { if (g.anulado || !g.pagado || (pid && g.inmuebleId !== pid) || (g.categoria === 'financiacion') !== !!fin) return t;
      const m = g.pagado.fecha.slice(0, 7); return m < a || m > b ? t : t + g.importe; }, 0);
    const recuperado = (a, b, pid) => s.reembolsos.reduce((t, r) => { if (r.anulado) return t; const m = r.fecha.slice(0, 7); if (m < a || m > b) return t;
      const g = por(s.gastos, r.gastoId); return !g || (pid && g.inmuebleId !== pid) ? t : t + r.importe; }, 0);
    const cuentas = (a, b, pid) => { const i = ingresos(a, b, pid), g = gastado(a, b, pid) - recuperado(a, b, pid), cu = gastado(a, b, pid, true); return { ingresos: i, gastos: g, cuotas: cu, neto: i - g, flujo: i - g - cu }; };
    const serie = []; for (let k = 0; k < 12; k++) { const m = mesMas(desde12, k); serie.push({ mes: m, ...cuentas(m, m) }); }
    const rentaMensual = vigentes.reduce((t, c) => t + rentaActual(c, hoy), 0);
    const inmuebles = activos.map((p) => {
      const c = cuentas(desde12, mes, p.id), base = p.compraPrecio ? p.compraPrecio + (p.compraGastos || 0) : p.valor || null, h = situacionHipoteca(p.hipoteca, hoy);
      const renta = vigentes.filter((v) => v.inmuebleId === p.id).reduce((t, v) => t + rentaActual(v, hoy), 0);
      return { id: p.id, nombre: p.nombre, tipo: p.tipo, ocupado: ocupados.has(p.id), renta, ...c, base, bruta: base ? pct(renta * 12, base) : null, neta: base ? pct(c.neto - (h ? h.enRango(desde12, mes).intereses : 0), base) : null,
        hipotecaPendiente: h ? h.pendiente : 0, patrimonio: (p.valor || base) ? (p.valor || base) - (h ? h.pendiente : 0) : null };
    }).sort((a, b) => b.neto - a.neto);
    const anio = hoy.slice(0, 4);
    return { hoy, mes,
      mesActual: { esperado, cobrado, pendiente: esperado - cobrado, porcentaje: pct(cobrado, esperado) },
      morosidad: { deuda, recibos: atrasados.length, morosos: new Set(atrasados.map((c) => ctDe.get(c.contratoId).inquilinoId)).size,
        diasMasAntigua: atrasados.length ? Math.max(...atrasados.map((c) => diasEntre(c.vence, hoy))) : 0 },
      cartera: { inmuebles: activos.length, ocupados: activos.filter((p) => ocupados.has(p.id)).length, ocupacion: pct(activos.filter((p) => ocupados.has(p.id)).length, activos.length),
        contratos: vigentes.length, rentaMensual, rentaAnual: rentaMensual * 12, fianzas: s.contratos.reduce((t, c) => t + saldoFianza(s, c.id), 0),
        deudaHipotecaria: inmuebles.reduce((t, x) => t + x.hipotecaPendiente, 0), patrimonio: inmuebles.reduce((t, x) => t + (x.patrimonio || 0), 0) },
      anioActual: cuentas(anio + '-01', mes), ultimos12: cuentas(desde12, mes), serie, inmuebles,
      gastosPorCobrar: s.gastos.reduce((t, g) => (g.anulado ? t : t + Math.max(0, g.repercutir - reembolsado(s, g.id))), 0) };
  }
  // Lo que hay que atender hoy: sirve para la pantalla de inicio y para las notificaciones del móvil
  function avisos(s, hoy) {
    hoyOk(hoy); const a = [], finMes = masMeses(hoy.slice(0, 7) + '-01', 1);
    for (const c of cargos(s, hoy, (x) => !x.anulado)) {
      if (c.estado === 'atrasado') a.push({ tipo: 'cobro_atrasado', id: c.id, fecha: c.vence, importe: c.pendiente, titulo: `${c.inquilino} · ${c.inmueble}`, dias: diasEntre(c.vence, hoy) });
      else if ((c.estado === 'pendiente' || c.estado === 'parcial') && c.vence < finMes) a.push({ tipo: 'cobro_pendiente', id: c.id, fecha: c.vence, importe: c.pendiente, titulo: `${c.inquilino} · ${c.inmueble}`, dias: diasEntre(hoy, c.vence) });
    }
    for (const ct of s.contratos) { const sit = situacionContrato(ct, hoy);
      if (sit === 'por_vencer' || sit === 'vencido') a.push({ tipo: 'contrato_' + sit, id: ct.id, fecha: ct.fin, titulo: `${(por(s.inquilinos, ct.inquilinoId) || {}).nombre} · ${(por(s.inmuebles, ct.inmuebleId) || {}).nombre}`, dias: diasEntre(hoy, ct.fin) }); }
    for (const g of gastos(s, hoy, (x) => !x.anulado)) {
      if (g.estado === 'vencido' || g.estado === 'por_confirmar') a.push({ tipo: 'gasto_' + g.estado, id: g.id, fecha: g.fecha, importe: g.importe, titulo: `${g.concepto} · ${g.inmueble}`, dias: diasEntre(g.fecha, hoy) });
      else if (g.estado === 'previsto' && g.fecha < finMes) a.push({ tipo: 'gasto_previsto', id: g.id, fecha: g.fecha, importe: g.importe, titulo: `${g.concepto} · ${g.inmueble}`, dias: diasEntre(hoy, g.fecha) });
      if (g.porCobrar > 0 && g.pagado) a.push({ tipo: 'gasto_por_cobrar', id: g.id, fecha: g.fecha, importe: g.porCobrar, titulo: `${g.concepto} · ${g.inquilino}`, dias: diasEntre(g.fecha, hoy) });
    }
    return a.sort((x, y) => x.fecha.localeCompare(y.fecha));
  }

  // Recordatorios que el móvil debe programar para los próximos días (aunque la app no se abra)
  function proximosAvisos(s, hoy, dias) {
    hoyOk(hoy); const fin = masDias(hoy, dias || 60), a = [], nom = (ct) => `${(por(s.inquilinos, ct.inquilinoId) || {}).nombre} · ${(por(s.inmuebles, ct.inmuebleId) || {}).nombre}`;
    const atrasados = s.cargos.filter((c) => !c.anulado && c.vence < hoy && pagadoDe(s, c.id) < c.importe);
    if (atrasados.length) {
      const deuda = atrasados.reduce((t, c) => t + c.importe - pagadoDe(s, c.id), 0);
      for (const d of [1, 8, 15]) a.push({ fecha: masDias(hoy, d), titulo: 'Cobros atrasados', texto: `${atrasados.length === 1 ? 'Hay 1 recibo atrasado' : `Hay ${atrasados.length} recibos atrasados`}: ${euros(deuda)}.` });
    }
    for (const ct of s.contratos) {
      if (ct.estado !== 'activo') continue;
      for (let p = hoy.slice(0, 7); p <= fin.slice(0, 7); p = mesMas(p, 1)) {
        const v = vence(p, ct.diaCobro);
        if (v < hoy || v > fin || p < ct.inicio.slice(0, 7) || (ct.fin && p > ct.fin.slice(0, 7))) continue;
        const cg = s.cargos.find((c) => c.contratoId === ct.id && c.periodo === p);
        if (cg && (cg.anulado || pagadoDe(s, cg.id) >= cg.importe)) continue;
        a.push({ fecha: v, titulo: 'Hoy toca cobrar', texto: `${nom(ct)}: ${euros(cg ? cg.importe - pagadoDe(s, cg.id) : rentaEn(ct, p))}.` });
      }
      if (ct.fin) {
        const aviso = masMeses(ct.fin, -(ct.avisoMeses || 1));
        if (aviso >= hoy && aviso <= fin) a.push({ fecha: aviso, titulo: 'Contrato a punto de vencer', texto: `${nom(ct)} vence el ${ct.fin.split('-').reverse().join('/')}.` });
        if (ct.fin >= hoy && ct.fin <= fin) a.push({ fecha: ct.fin, titulo: 'Hoy vence un contrato', texto: nom(ct) });
      }
    }
    for (const g of s.gastos) if (!g.anulado && !g.pagado && g.fecha >= hoy && g.fecha <= fin)
      a.push({ fecha: g.fecha, titulo: 'Gasto previsto para hoy', texto: `${g.concepto} · ${(por(s.inmuebles, g.inmuebleId) || {}).nombre}: ${euros(g.importe)}.` });
    return a.filter((x) => x.fecha > hoy).sort((x, y) => x.fecha.localeCompare(y.fecha)).slice(0, 50);
  }

  // ---------- Mensajes, exportación y copias ----------
  const mensaje = (plantilla, vars) => String(plantilla || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  // Las celdas de texto que empiezan por = + - @ se neutralizan para que Excel no las ejecute
  function celda(v) {
    if (typeof v === 'number') return String(v).replace('.', ',');
    let t = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }
  const csv = (cabecera, filas) => '﻿' + [cabecera, ...filas].map((f) => f.map(celda).join(';')).join('\r\n');
  const e = (c) => c / 100;
  function csvCobros(s, hoy) {
    return csv(['Mes', 'Inmueble', 'Inquilino', 'Vencimiento', 'Importe', 'Cobrado', 'Pendiente', 'Fecha de cobro', 'Método', 'Estado'],
      cargos(s, hoy).map((c) => [c.periodo, c.inmueble, c.inquilino, c.vence, e(c.importe), e(c.pagado), e(c.pendiente), c.fechaPago || '', c.metodo, c.estado + (c.estimado ? ' (estimado)' : '')]));
  }
  function csvPagos(s, hoy) {
    const cg = new Map(cargos(s, hoy).map((c) => [c.id, c]));
    return csv(['Fecha', 'Inmueble', 'Inquilino', 'Mes del alquiler', 'Importe', 'Método', 'Notas', 'Origen', 'Anulado'],
      s.pagos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id).map((p) => { const c = cg.get(p.cargoId) || {};
        return [p.fecha, c.inmueble, c.inquilino, c.periodo, e(p.importe), p.metodo, p.notas, p.origen, p.anulado ? `Sí (${p.anulado.fecha}: ${p.anulado.motivo})` : 'No']; }));
  }
  function csvGastos(s, hoy) {
    return csv(['Fecha', 'Inmueble', 'Concepto', 'Categoría', 'Periodo', 'Importe', 'Estado', 'Fecha de pago', 'A cobrar al inquilino', 'Cobrado', 'Inquilino', 'Notas'],
      gastos(s, hoy).reverse().map((g) => [g.fecha, g.inmueble, g.concepto, CATEGORIAS[g.categoria], g.periodo, e(g.importe), g.estado + (g.estimado ? ' (estimado)' : ''), g.pagado ? g.pagado.fecha : '', e(g.repercutir), e(g.cobrado), g.inquilino, g.notas]));
  }
  const exportar = (s) => JSON.stringify(s);
  function importar(txt) {
    let s; try { s = typeof txt === 'string' ? JSON.parse(txt) : txt; } catch (x) { throw err('COPIA', 'El archivo no es una copia válida'); }
    if (!s || s.formato !== 'mis-alquileres' || s.v !== 1) throw err('COPIA', 'El archivo no es una copia de Mis alquileres o es de una versión más nueva');
    const base = nuevo();
    for (const k of ['inmuebles', 'inquilinos', 'contratos', 'cargos', 'pagos', 'conceptos', 'gastos', 'reembolsos', 'fianzas', 'registro']) if (!Array.isArray(s[k])) throw err('COPIA', 'La copia está incompleta');
    const max = Math.max(0, ...['inmuebles', 'inquilinos', 'contratos', 'cargos', 'pagos', 'conceptos', 'gastos', 'reembolsos', 'fianzas'].flatMap((k) => s[k].map((x) => x.id || 0)));
    return { ...base, ...s, pro: false, seq: Math.max(Number(s.seq) || 0, max), ajustes: { ...base.ajustes, ...s.ajustes, limiteGratis: base.ajustes.limiteGratis }, plantillas: { ...base.plantillas, ...s.plantillas },
      claves: s.claves || {}, adjuntos: Array.isArray(s.adjuntos) ? s.adjuntos : [], numeracion: s.numeracion || {}, actas: Array.isArray(s.actas) ? s.actas : [] };
  }

  return { VIVIENDA, LEY_VIVIENDA, IMPUESTOS, RETENCION, desglose, fijarImporte, baseDe, tipos, tipoEn, cambiarTipo, quitarTipo, err, por, TIPOS, CATEGORIAS, RESPONSABLES, PERIODICIDADES, PLANTILLAS, nuevo, centimos, euros, esFecha, esMes, masMeses, mesMas, masDias, diasEntre, vence,
    puedeCrearInmueble, crearInmueble, editarInmueble, archivarInmueble, eliminarInmueble, crearInquilino, editarInquilino, archivarInquilino, eliminarInquilino,
    crearContrato, editarContrato, revisarRenta, finalizarContrato, renovarContrato, eliminarContrato, situacionContrato, rentaEn, rentaActual, contratoEn, finEfectivo,
    generarCargos, pagadoDe, estadoCargo, registrarPago, anularPago, anularCargo, restaurarCargo, ajustarCargo, cargos,
    saldoFianza, registrarFianza, anularFianza,
    crearConcepto, editarConcepto, eliminarConcepto, generarGastos, estadoGasto, crearGasto, confirmarGasto, desconfirmarGasto, anularGasto, registrarReembolso, anularReembolso, reembolsado, gastos,
    cargarTipicos, cuotaFrancesa, cuadroHipoteca, situacionHipoteca, ponerHipoteca, panel, avisos, proximosAvisos, mensaje, csv, csvCobros, csvPagos, csvGastos, exportar, importar };
});
