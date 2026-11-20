/* Mis alquileres — funciones de la versión 1.1: Renta, actualización anual, fianzas, banco, importación, recibos,
   documentos y recordatorios. Amplía el objeto MA de nucleo.js. Importes en céntimos. © 2026 IT Canarias. */
(function (root, factory) {
  const MA = typeof module === 'object' && module.exports ? require('./nucleo.js') : root.MA;
  Object.assign(MA, factory(MA));
  if (typeof module === 'object' && module.exports) module.exports = MA;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (MA) {
  'use strict';
  const { err, por, esFecha, masMeses, masDias, mesMas, diasEntre, euros } = MA;
  const exige = (l, i, q) => { const x = por(l, i); if (!x) throw err('NO_EXISTE', `${q} no encontrado`); return x; };
  const texto = (v) => (v == null ? '' : String(v).trim());
  const hoyOk = (h) => { if (!esFecha(h)) throw err('FECHA', 'Fecha de hoy no válida'); return h; };
  const anota = (s, hoy, que, ref, detalle) => s.registro.push({ fecha: hoy, que, ref, detalle: detalle || null });
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const NO_NOMBRE = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'san', 'santa', 'maria', 'jose', 'juan']);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fmes = (m) => `${MESES[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  const fecha = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  const pct = (n) => String(Math.round(n * 100) / 100).replace('.', ',') + ' %';

  // ---------- Importes en letras ----------
  const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const apocope = (s) => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
  function menorMil(n) {
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100), r = n % 100, t = r ? (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '')) : '';
    return [c ? C[c] : '', t].filter(Boolean).join(' ') || 'cero';
  }
  function letras(n) {
    if (n === 0) return 'cero';
    const mill = Math.floor(n / 1e6), miles = Math.floor(n / 1000) % 1000, resto = n % 1000, p = [];
    if (mill) p.push(mill === 1 ? 'un millón' : apocope(menorMil(mill)) + ' millones');
    if (miles) p.push(miles === 1 ? 'mil' : apocope(menorMil(miles)) + ' mil');
    if (resto) p.push(menorMil(resto));
    return p.join(' ');
  }
  function eurosLetras(cent) {
    const e = Math.floor(cent / 100), c = cent % 100;
    let s = apocope(letras(e)) + (e === 1 ? ' euro' : ' euros');
    if (c) s += ' con ' + apocope(letras(c)) + (c === 1 ? ' céntimo' : ' céntimos');
    return s;
  }

  // ---------- 1. Recibos de alquiler ----------
  // Cada recibo mensual recibe un número correlativo por año la primera vez que se emite
  function datosRecibo(s, cargoId, hoy) {
    hoyOk(hoy);
    const c = exige(s.cargos, cargoId, 'Recibo'), ct = por(s.contratos, c.contratoId), q = por(s.inquilinos, ct.inquilinoId) || {}, p = por(s.inmuebles, ct.inmuebleId) || {};
    const pagos = s.pagos.filter((x) => x.cargoId === cargoId && !x.anulado).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
    if (!pagos.length) throw err('SIN_PAGOS', 'Este recibo aún no tiene cobros');
    const pagado = pagos.reduce((t, x) => t + x.importe, 0), ultimo = pagos[pagos.length - 1];
    if (!c.recibo) {
      const anio = ultimo.fecha.slice(0, 4);
      s.numeracion[anio] = (s.numeracion[anio] || 0) + 1;
      c.recibo = `${anio}-${String(s.numeracion[anio]).padStart(4, '0')}`;
      anota(s, hoy, 'recibo_emitido', cargoId, { numero: c.recibo });
    }
    return { numero: c.recibo, fecha: ultimo.fecha, emitido: hoy, propietario: s.ajustes.propietario || '', propietarioDni: s.ajustes.dni || '', propietarioDomicilio: s.ajustes.domicilio || '',
      inquilino: q.nombre || '', inquilinoDni: q.dni || '', telefono: q.telefono || '', inmueble: p.nombre || '', direccion: p.direccion || '', referencia: p.referencia || '',
      periodo: c.periodo, mes: fmes(c.periodo), importe: c.importe, pagado: Math.min(pagado, c.importe), pendiente: Math.max(0, c.importe - pagado), letras: eurosLetras(Math.min(pagado, c.importe)),
      pagos: pagos.map((x) => ({ fecha: x.fecha, importe: x.importe, metodo: x.metodo })), completo: pagado >= c.importe };
  }

  // ---------- 6. Actualización anual de la renta ----------
  const INDICES = { irav: 'IRAV (índice de referencia de arrendamientos de vivienda)', ipc: 'IPC', fijo: 'porcentaje pactado', ninguna: 'sin actualización' };
  // Aniversario del contrato que toca aplicar ahora o en los próximos 45 días (null si no toca o ya está hecho)
  function actualizacionPendiente(s, ct, hoy) {
    if (ct.estado !== 'activo' || !ct.actualizacion || ct.actualizacion === 'ninguna') return null;
    let ult = null;
    for (let k = 1; k < 100; k++) {
      const a = masMeses(ct.inicio, 12 * k);
      if (a > masDias(hoy, 45) || (ct.fin && a > ct.fin)) break;
      ult = a;
    }
    if (!ult || ult < masDias(hoy, -90)) return null;
    if (ct.rentas.some((r) => r.desde === ult.slice(0, 7) && r.desde !== ct.rentas[0].desde)) return null;
    if ((ct.actualizacionOmitida || []).includes(ult)) return null;
    return { fecha: ult, mes: ult.slice(0, 7), indice: ct.actualizacion, nombreIndice: INDICES[ct.actualizacion], pctPactado: ct.actualizacion === 'fijo' ? ct.actualizacionPct : null,
      renta: MA.rentaEn(ct, ult.slice(0, 7)), dias: diasEntre(hoy, ult) };
  }
  function aplicarActualizacion(s, ctId, { pct, fecha: f }, hoy) {
    hoyOk(hoy); const ct = exige(s.contratos, ctId, 'Contrato');
    const p = Number(String(pct).replace(',', '.'));
    if (!Number.isFinite(p) || p < -20 || p > 20) throw err('DATOS', 'Indica el porcentaje de actualización (por ejemplo 2,4)');
    if (!esFecha(f)) throw err('FECHA', 'Fecha no válida');
    const antes = MA.rentaEn(ct, f.slice(0, 7)), ahora = Math.round(antes * (1 + p / 100));
    MA.revisarRenta(s, ctId, { desde: f.slice(0, 7), importe: ahora }, hoy);
    anota(s, hoy, 'renta_actualizada', ctId, { pct: p, antes, ahora, indice: ct.actualizacion });
    return { antes, ahora, pct: p };
  }
  function omitirActualizacion(s, ctId, f, hoy) {
    const ct = exige(s.contratos, ctId, 'Contrato'); ct.actualizacionOmitida = [...(ct.actualizacionOmitida || []), f]; anota(s, hoyOk(hoy), 'actualizacion_omitida', ctId, { fecha: f });
  }

  // ---------- 10. Depósito y devolución de la fianza ----------
  function registrarDeposito(s, ctId, d, hoy) {
    hoyOk(hoy); const ct = exige(s.contratos, ctId, 'Contrato');
    if (d.noAplica) { ct.deposito = { ...ct.deposito, noAplica: true }; return ct; }
    if (!esFecha(d.fecha) || d.fecha > hoy) throw err('FECHA', 'Indica la fecha del depósito');
    ct.deposito = { ...ct.deposito, organismo: texto(d.organismo) || 'Instituto Canario de la Vivienda', fecha: d.fecha, referencia: texto(d.referencia), noAplica: false };
    anota(s, hoy, 'fianza_depositada', ctId); return ct;
  }
  function recuperarDeposito(s, ctId, f, hoy) {
    hoyOk(hoy); const ct = exige(s.contratos, ctId, 'Contrato');
    if (!esFecha(f) || f > hoy) throw err('FECHA', 'Fecha no válida');
    ct.deposito = { ...ct.deposito, recuperado: f }; anota(s, hoy, 'fianza_recuperada', ctId); return ct;
  }
  function avisosFianza(s, hoy) {
    const a = [];
    for (const ct of s.contratos) {
      const saldo = MA.saldoFianza(s, ct.id), dep = ct.deposito || {}, q = por(s.inquilinos, ct.inquilinoId) || {}, p = por(s.inmuebles, ct.inmuebleId) || {}, titulo = `${q.nombre} · ${p.nombre}`;
      if (ct.estado === 'activo' && saldo > 0 && !dep.fecha && !dep.noAplica) {
        const limite = masMeses(ct.firma || ct.inicio, 1);
        a.push({ tipo: 'fianza_deposito', id: ct.id, fecha: limite, importe: saldo, titulo, dias: diasEntre(hoy, limite) });
      }
      if (ct.estado !== 'activo' && saldo > 0) {
        const limite = masMeses(ct.llaves || ct.fechaBaja || hoy, 1);
        a.push({ tipo: 'fianza_devolver', id: ct.id, fecha: limite, importe: saldo, titulo, dias: diasEntre(hoy, limite) });
      }
      if (ct.estado !== 'activo' && dep.fecha && !dep.recuperado && !dep.noAplica)
        a.push({ tipo: 'fianza_recuperar', id: ct.id, fecha: ct.fechaBaja || hoy, titulo, organismo: dep.organismo });
    }
    return a;
  }

  // ---------- 3. Avisos al inquilino en escalera ----------
  // Paso que toca para un recibo atrasado: 1 = recordatorio amable (desde 3 días), 2 = recordatorio firme (desde 10 días)
  function escalon(c, hoy) {
    if (c.estado !== 'atrasado' && !(c.estado === 'parcial' && c.vence < hoy)) return 0;
    const d = diasEntre(c.vence, hoy);
    return d >= 10 ? 2 : d >= 3 ? 1 : 0;
  }
  function avisosApp(s, hoy) {
    hoyOk(hoy);
    const a = MA.avisos(s, hoy).map((x) => {
      if (x.tipo !== 'cobro_atrasado') return x;
      const c = MA.cargos(s, hoy, (y) => y.id === x.id)[0], e = escalon(c, hoy);
      return { ...x, escalon: e, recordado: !!(c.recordatorio && c.recordatorio >= masDias(hoy, -2)) };
    });
    for (const ct of s.contratos) { const u = actualizacionPendiente(s, ct, hoy); if (u) a.push({ tipo: 'actualizacion', id: ct.id, fecha: u.fecha, titulo: `${(por(s.inquilinos, ct.inquilinoId) || {}).nombre} · ${(por(s.inmuebles, ct.inmuebleId) || {}).nombre}`, dias: u.dias, ...u }); }
    a.push(...avisosFianza(s, hoy));
    const ult = s.ajustes.ultimaCopia;
    const desde = s.registro.length ? s.registro[0].fecha : hoy;
    if (s.contratos.length && (ult ? diasEntre(ult, hoy) >= 30 : diasEntre(desde, hoy) >= 7)) a.push({ tipo: 'copia', id: 0, fecha: hoy, titulo: ult ? `La última copia es del ${fecha(ult)}` : 'Aún no has guardado ninguna copia', dias: ult ? diasEntre(ult, hoy) : null });
    return a.sort((x, y) => x.fecha.localeCompare(y.fecha));
  }

  // Notificaciones para los próximos días. Cada una lleva datos para poder actuar desde ella (Cobrado / Avisar)
  function idAviso(txt) { let h = 5381; for (const ch of txt) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return 1 + (h % 2000000000); }
  function proximosAvisos(s, hoy, dias) {
    hoyOk(hoy); const fin = masDias(hoy, dias || 60), a = [];
    const nom = (ct) => (por(s.inquilinos, ct.inquilinoId) || {}).nombre, inm = (ct) => (por(s.inmuebles, ct.inmuebleId) || {}).nombre;
    for (const ct of s.contratos) {
      if (ct.estado !== 'activo') continue;
      for (let p = mesMas(hoy.slice(0, 7), -2); p <= fin.slice(0, 7); p = mesMas(p, 1)) {
        if (p < ct.inicio.slice(0, 7) || (ct.fin && p > ct.fin.slice(0, 7))) continue;
        const v = MA.vence(p, ct.diaCobro), cg = s.cargos.find((c) => c.contratoId === ct.id && c.periodo === p);
        if (cg && (cg.anulado || MA.pagadoDe(s, cg.id) >= cg.importe)) continue;
        const pend = cg ? cg.importe - MA.pagadoDe(s, cg.id) : MA.rentaEn(ct, p), datos = { contratoId: ct.id, periodo: p };
        const pasos = [[v, 'Hoy toca cobrar', `${nom(ct)} · ${inm(ct)}: ${euros(pend)} de ${fmes(p)}.`, 'COBRO', 0],
          [masDias(v, 3), `${nom(ct)} lleva 3 días sin pagar`, `${inm(ct)} · ${fmes(p)}: ${euros(pend)}. ¿Le envías un recordatorio?`, 'ATRASO', 1],
          [masDias(v, 10), `${nom(ct)} lleva 10 días sin pagar`, `${inm(ct)} · ${fmes(p)}: ${euros(pend)}. Toca un recordatorio más firme.`, 'ATRASO', 2]];
        for (const [f, titulo, txt, accion, esc] of pasos) if (f > hoy && f <= fin) a.push({ id: idAviso(`c${ct.id}${p}${esc}`), fecha: f, titulo, texto: txt, accion, datos: { ...datos, escalon: esc } });
      }
      if (ct.fin) {
        const av = masMeses(ct.fin, -(ct.avisoMeses || 1));
        if (av > hoy && av <= fin) a.push({ id: idAviso(`v${ct.id}${av}`), fecha: av, titulo: 'Contrato a punto de vencer', texto: `${nom(ct)} · ${inm(ct)} vence el ${fecha(ct.fin)}.`, datos: { contratoId: ct.id } });
      }
      const u = actualizacionPendiente(s, ct, hoy);
      if (u) { const f = masDias(u.fecha, -30) > hoy ? masDias(u.fecha, -30) : null;
        if (f && f <= fin) a.push({ id: idAviso(`a${ct.id}${u.fecha}`), fecha: f, titulo: 'Toca actualizar la renta', texto: `${nom(ct)} · ${inm(ct)}: el ${fecha(u.fecha)} se cumple un año más de contrato.`, datos: { contratoId: ct.id } }); }
    }
    for (const x of avisosFianza(s, hoy)) {
      const f = x.tipo === 'fianza_recuperar' ? null : masDias(x.fecha, -7);
      if (f && f > hoy && f <= fin) a.push({ id: idAviso(`f${x.tipo}${x.id}`), fecha: f, titulo: x.tipo === 'fianza_deposito' ? 'Deposita la fianza' : 'Devuelve la fianza', texto: `${x.titulo}: el plazo acaba el ${fecha(x.fecha)}.`, datos: { contratoId: x.id } });
    }
    for (const g of s.gastos) if (!g.anulado && !g.pagado && g.fecha > hoy && g.fecha <= fin)
      a.push({ id: idAviso(`g${g.id}`), fecha: g.fecha, titulo: 'Gasto previsto para hoy', texto: `${g.concepto} · ${(por(s.inmuebles, g.inmuebleId) || {}).nombre}: ${euros(g.importe)}.`, datos: { gastoId: g.id } });
    return a.sort((x, y) => x.fecha.localeCompare(y.fecha)).slice(0, 60);
  }
  // Acción pulsada en una notificación de cobro: crea el recibo si aún no existe y lo marca como cobrado una sola vez
  function cobroDesdeAviso(s, { contratoId, periodo }, hoy) {
    hoyOk(hoy); MA.generarCargos(s, hoy);
    const c = s.cargos.find((x) => x.contratoId === contratoId && x.periodo === periodo);
    if (!c) throw err('NO_EXISTE', 'Ese recibo aún no existe');
    const pend = c.importe - MA.pagadoDe(s, c.id);
    if (pend <= 0) return { cargoId: c.id, repetido: true, importe: 0 };
    const ct = por(s.contratos, contratoId), ult = s.pagos.filter((p) => s.cargos.some((x) => x.id === p.cargoId && x.contratoId === contratoId) && !p.anulado).pop();
    const r = MA.registrarPago(s, { cargoId: c.id, importe: pend, metodo: ult ? ult.metodo : '', clave: `aviso:${contratoId}:${periodo}` }, hoy);
    return { cargoId: c.id, repetido: r.repetido, importe: pend, contrato: ct };
  }

  // ---------- 4. Extracto del banco ----------
  function claveMov(m, n) { let h = 5381; for (const ch of `${m.fecha}|${m.importe}|${norm(m.concepto)}|${n}`) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return 'banco:' + h.toString(36); }
  const palabras = (t, min) => norm(t).split(' ').filter((w) => w.length >= (min || 4) && !NO_NOMBRE.has(w));
  // Propone, para cada movimiento, el recibo o gasto con el que cuadra. No apunta nada.
  function conciliar(s, movs, hoy) {
    hoyOk(hoy);
    const vistos = {}, usados = new Set();
    const cargosVivos = MA.cargos(s, hoy, (c) => !c.anulado).filter((c) => c.pendiente > 0);
    const gastosVivos = MA.gastos(s, hoy, (g) => !g.anulado && !g.pagado);
    return movs.map((m) => {
      const k = `${m.fecha}|${m.importe}|${norm(m.concepto)}`; vistos[k] = (vistos[k] || 0) + 1;
      const clave = claveMov(m, vistos[k]), base = { ...m, clave };
      if (s.claves[clave]) return { ...base, tipo: 'ya', motivo: 'Ya apuntado en una importación anterior' };
      if (!esFecha(m.fecha) || !Number.isInteger(m.importe) || !m.importe) return { ...base, tipo: 'nada', motivo: 'Movimiento sin fecha o importe' };
      if (m.fecha > hoy) return { ...base, tipo: 'nada', motivo: 'Fecha futura' };
      const txt = norm(m.concepto);
      if (m.importe > 0) {
        let mejor = null;
        for (const c of cargosVivos) {
          if (usados.has('c' + c.id)) continue;
          const d = diasEntre(c.vence, m.fecha); if (d < -40 || d > 150) continue;
          const nombre = palabras(c.inquilino).some((w) => txt.includes(w)), exacto = m.importe === c.pendiente, renta = m.importe === c.importe;
          let p = (nombre ? 3 : 0) + (exacto ? 3 : renta ? 2 : 0) + (Math.abs(d) <= 10 ? 1 : 0);
          if (!nombre && !exacto && !renta) continue;
          if (nombre && !exacto && !renta && m.importe > c.pendiente) p -= 1;
          if (!mejor || p > mejor.p || (p === mejor.p && c.vence < mejor.c.vence)) mejor = { p, c, nombre, exacto: exacto || renta };
        }
        if (mejor && mejor.p >= 3) {
          usados.add('c' + mejor.c.id);
          return { ...base, tipo: 'cobro', cargoId: mejor.c.id, confianza: mejor.nombre && mejor.exacto ? 'alta' : 'media',
            motivo: `${mejor.c.inquilino} · ${mejor.c.inmueble} · ${fmes(mejor.c.periodo)} (pendiente ${euros(mejor.c.pendiente)})`, repartir: m.importe > mejor.c.pendiente };
        }
        return { ...base, tipo: 'nada', motivo: 'No coincide con ningún recibo pendiente' };
      }
      let mejor = null; const imp = -m.importe;
      for (const g of gastosVivos) {
        if (usados.has('g' + g.id)) continue;
        const d = diasEntre(g.fecha, m.fecha); if (d < -10 || d > 25) continue;
        const nombre = palabras(g.concepto, 3).some((w) => txt.includes(w)) || (g.proveedor && palabras(g.proveedor).some((w) => txt.includes(w)));
        const exacto = imp === g.importe, cerca = g.importe > 0 && Math.abs(imp - g.importe) / g.importe <= 0.15;
        const p = (nombre ? 2 : 0) + (exacto ? 2 : cerca ? 1 : 0) + (Math.abs(d) <= 5 ? 1 : 0);
        if (p >= 3 && (!mejor || p > mejor.p)) mejor = { p, g, nombre, exacto };
      }
      if (mejor) { usados.add('g' + mejor.g.id);
        return { ...base, tipo: 'gasto', gastoId: mejor.g.id, confianza: mejor.nombre && mejor.exacto ? 'alta' : 'media', motivo: `${mejor.g.concepto} · ${mejor.g.inmueble} (${euros(mejor.g.importe)} previsto)` }; }
      return { ...base, tipo: 'nada', motivo: 'No coincide con ningún gasto pendiente' };
    });
  }
  function aplicarConciliacion(s, propuestas, hoy) {
    hoyOk(hoy); let cobros = 0, gastos = 0; const errores = [];
    for (const x of propuestas) {
      try {
        if (x.tipo === 'cobro') { const r = MA.registrarPago(s, { cargoId: x.cargoId, importe: x.importe, fecha: x.fecha, metodo: 'Banco', notas: x.concepto.slice(0, 80), repartir: !!x.repartir, clave: x.clave }, hoy); if (!r.repetido) cobros++; }
        else if (x.tipo === 'gasto' && !s.claves[x.clave]) { MA.confirmarGasto(s, x.gastoId, { importe: -x.importe, fecha: x.fecha }, hoy); s.claves[x.clave] = [x.gastoId]; gastos++; }
      } catch (e) { errores.push(`${fecha(x.fecha)} ${euros(x.importe)}: ${e.message}`); }
    }
    return { cobros, gastos, errores };
  }

  // ---------- 9. Alta rápida e importación de la cartera ----------
  function conRespaldo(s, fn) {
    const copia = JSON.stringify(s);
    try { return fn(); } catch (e) { const o = JSON.parse(copia); for (const k of Object.keys(s)) delete s[k]; Object.assign(s, o); throw e; }
  }
  function altaRapida(s, d, hoy) {
    return conRespaldo(s, () => {
      const p = MA.crearInmueble(s, { nombre: d.inmueble, tipo: d.tipo, direccion: d.direccion }, hoy);
      const q = MA.crearInquilino(s, { nombre: d.inquilino, telefono: d.telefono });
      const ct = MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: d.inicio, fin: d.fin || null, importe: d.importe, diaCobro: d.diaCobro || 1, fianza: d.fianza || 0, historicoCobrado: !!d.historicoCobrado }, hoy);
      if (d.tipicos) MA.cargarTipicos(s, p.id, hoy);
      return { inmueble: p, inquilino: q, contrato: ct };
    });
  }
  const CAMPOS_CARTERA = { inmueble: /inmueble|propiedad|plaza|piso|nombre del inmueble/, tipo: /^tipo/, direccion: /direcc/, inquilino: /inquilino|arrendatario/, telefono: /tel[eé]f|m[oó]vil/,
    dni: /dni|nif|nie/, email: /correo|e-?mail/, inicio: /inicio|desde|alta/, fin: /^fin|hasta|vencim/, importe: /renta|importe|alquiler|cuota/, diaCobro: /d[ií]a/, fianza: /fianza|dep[oó]sito/ };
  const PLANTILLA_CARTERA = 'Inmueble;Tipo;Dirección;Inquilino;Teléfono;DNI;Inicio;Fin;Renta;Día de cobro;Fianza\r\nPlaza 12;Plaza de garaje;C/ Real 4, Arrecife;Ana Pérez;600111222;12345678Z;01/03/2025;;60;1;60\r\n';
  function fechaTexto(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
    const t = texto(v); let m;
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }
  function importarCartera(s, filas, hoy) {
    hoyOk(hoy);
    if (!filas.length) throw err('DATOS', 'El archivo está vacío');
    const cab = filas[0].map((x) => norm(x)), col = {};
    for (const [k, re] of Object.entries(CAMPOS_CARTERA)) { const i = cab.findIndex((c, j) => re.test(c) && !Object.values(col).includes(j)); if (i >= 0) col[k] = i; }
    if (col.inmueble == null) throw err('DATOS', 'No encuentro la columna «Inmueble». Usa la plantilla.');
    const r = { inmuebles: 0, inquilinos: 0, contratos: 0, errores: [] };
    filas.slice(1).forEach((f, n) => {
      const v = (k) => (col[k] == null ? '' : f[col[k]]), fila = n + 2;
      if (!texto(v('inmueble'))) return;
      try {
        conRespaldo(s, () => {
          let p = s.inmuebles.find((x) => norm(x.nombre) === norm(v('inmueble')));
          if (!p) { const tipo = MA.TIPOS.find((t) => norm(t) === norm(v('tipo'))) || 'Otro'; p = MA.crearInmueble(s, { nombre: v('inmueble'), tipo, direccion: v('direccion') }, hoy); r.inmuebles++; }
          if (!texto(v('inquilino'))) return;
          let q = s.inquilinos.find((x) => norm(x.nombre) === norm(v('inquilino')));
          if (!q) { q = MA.crearInquilino(s, { nombre: v('inquilino'), telefono: v('telefono'), dni: v('dni'), email: v('email') }); r.inquilinos++; }
          const ini = fechaTexto(v('inicio')), imp = v('importe');
          if (!ini || imp === '' || imp == null) throw err('DATOS', 'Para el contrato faltan la fecha de inicio o la renta');
          MA.crearContrato(s, { inmuebleId: p.id, inquilinoId: q.id, inicio: ini, fin: fechaTexto(v('fin')), importe: typeof imp === 'number' ? Math.round(imp * 100) : MA.centimos(imp),
            diaCobro: Number(v('diaCobro')) || 1, fianza: v('fianza') === '' || v('fianza') == null ? 0 : typeof v('fianza') === 'number' ? Math.round(v('fianza') * 100) : MA.centimos(v('fianza')) }, hoy);
          r.contratos++;
        });
      } catch (e) { r.errores.push(`Fila ${fila}: ${e.message}`); if (e.code === 'LIMITE') r.limite = true; }
    });
    return r;
  }

  // ---------- 7. Documentos y fotos ----------
  const REFS = { inmueble: 'inmuebles', contrato: 'contratos', gasto: 'gastos', inquilino: 'inquilinos' };
  function agregarAdjunto(s, { tipo, id: refId, nombre, mime, tam, archivo, nota }, hoy) {
    hoyOk(hoy); if (!REFS[tipo]) throw err('DATOS', 'Destino no válido'); exige(s[REFS[tipo]], refId, 'Elemento');
    if (!archivo) throw err('DATOS', 'Falta el archivo');
    const a = { id: ++s.seq, tipo, refId, nombre: texto(nombre) || 'documento', mime: texto(mime), tam: Number(tam) || 0, archivo, nota: texto(nota), fecha: hoy };
    s.adjuntos.push(a); return a;
  }
  function quitarAdjunto(s, i) { const a = exige(s.adjuntos, i, 'Documento'); s.adjuntos = s.adjuntos.filter((x) => x.id !== i); return a.archivo; }
  const adjuntosDe = (s, tipo, refId) => s.adjuntos.filter((a) => a.tipo === tipo && a.refId === refId).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);

  // ---------- 5. Informe para la declaración de la Renta (orientativo) ----------
  const GRUPOS = { intereses: 'Intereses de la financiación', reparacion: 'Reparación y conservación', tributos: 'Tributos y tasas (IBI, basura…)', comunidad: 'Gastos de comunidad',
    seguros: 'Primas de seguros', servicios: 'Servicios de terceros (gestoría, administración…)', suministros: 'Servicios y suministros', otros: 'Otros gastos',
    dudoso: 'Saldos de dudoso cobro', amortizacion: 'Amortización del inmueble (3 %)' };
  const CATEGORIA = { impuesto: ['tributos', true], comunidad: ['comunidad', true], seguro: ['seguros', true], mantenimiento: ['reparacion', false], suministro: ['suministros', false], gestion: ['servicios', false], otro: ['otros', false] };
  const diasInc = (a, b) => diasEntre(a, b) + 1;
  function tramosAlquilado(s, p, ini, fin) {
    const t = s.contratos.filter((c) => c.inmuebleId === p.id).map((c) => { const f = MA.finEfectivo(c) || fin; return [c.inicio > ini ? c.inicio : ini, f < fin ? f : fin]; })
      .filter(([a, b]) => a <= b).sort((x, y) => x[0].localeCompare(y[0]));
    const u = [];
    for (const x of t) { const l = u[u.length - 1]; if (l && x[0] <= masDias(l[1], 1)) { if (x[1] > l[1]) l[1] = x[1]; } else u.push([...x]); }
    return u;
  }
  // Cálculo de un inmueble y un año sin el arrastre de excesos de años anteriores
  function rentaBase(s, p, anio, hoy) {
    const ini = `${anio}-01-01`, fin = `${anio}-12-31`, diasAnio = diasInc(ini, fin), desde = p.compraFecha && p.compraFecha > ini ? p.compraFecha : ini;
    const diasProp = desde <= fin ? diasInc(desde, fin) : 0, tramos = tramosAlquilado(s, p, desde, fin), diasAlq = tramos.reduce((t, [a, b]) => t + diasInc(a, b), 0);
    const factor = diasProp ? diasAlq / diasProp : 0, dentro = (f) => tramos.some(([a, b]) => f >= a && f <= b), vivienda = MA.VIVIENDA.includes(p.tipo), avisos = [];
    const contratos = s.contratos.filter((c) => c.inmuebleId === p.id && c.inicio <= fin && (!MA.finEfectivo(c) || MA.finEfectivo(c) >= ini)).map((c) => {
      const q = por(s.inquilinos, c.inquilinoId) || {}, cs = s.cargos.filter((x) => x.contratoId === c.id && !x.anulado && x.periodo.slice(0, 4) === String(anio));
      const ingresos = cs.reduce((t, x) => t + x.importe, 0), cobrado = cs.reduce((t, x) => t + Math.min(MA.pagadoDe(s, x.id), x.importe), 0);
      const auto = (c.uso || (vivienda ? 'vivienda' : 'otro')) !== 'vivienda' ? 0 : anio <= 2023 || (c.firma || c.inicio) < MA.LEY_VIVIENDA ? 60 : 50;
      const reduccion = c.reduccion != null ? c.reduccion : auto;
      if (!q.dni) avisos.push(`Falta el DNI/NIF de ${q.nombre}: Renta Web lo pide para cada arrendatario.`);
      const dudoso = cs.filter((x) => x.vence <= `${anio}-06-30` && MA.pagadoDe(s, x.id) < x.importe).reduce((t, x) => t + x.importe - MA.pagadoDe(s, x.id), 0);
      return { id: c.id, inquilino: q.nombre, dni: q.dni || '', inicio: c.inicio, fin: MA.finEfectivo(c), ingresos, cobrado, pendiente: ingresos - cobrado, reduccion, retenciones: c.retencion ? Math.round(ingresos * 0.19) : 0, dudoso };
    });
    const rentas = contratos.reduce((t, c) => t + c.ingresos, 0), pendiente = contratos.reduce((t, c) => t + c.pendiente, 0);
    const gs = s.gastos.filter((g) => g.inmuebleId === p.id && !g.anulado && g.fecha.slice(0, 4) === String(anio));
    const repercutidos = gs.reduce((t, g) => t + (g.repercutir || 0), 0), ingresos = rentas + repercutidos;
    if (pendiente > 0) avisos.push(`Hay ${euros(pendiente)} de rentas de ${anio} sin cobrar. Se declaran igualmente como ingreso.`);
    const g = Object.fromEntries(Object.keys(GRUPOS).map((k) => [k, 0])), detalle = [];
    let sinPagar = 0;
    for (const x of gs) {
      if (x.categoria === 'financiacion') continue;
      if (!x.pagado) { sinPagar++; continue; }
      const [grupo, prorrata] = CATEGORIA[x.categoria] || ['otros', false];
      let ded = x.importe, nota = '';
      if (prorrata) { ded = Math.round(x.importe * factor); if (factor < 1) nota = `Proporcional a los días alquilado (${Math.round(factor * 100)} %)`; }
      else if (!dentro(x.fecha)) { ded = 0; nota = 'Fecha sin inquilino: solo es deducible si fue para preparar el alquiler'; }
      if (x.estimado) nota = (nota ? nota + '. ' : '') + 'Estimado: comprueba el importe real';
      if (grupo === 'otros') nota = (nota ? nota + '. ' : '') + 'Revisa si es deducible';
      g[grupo] += ded; detalle.push({ fecha: x.fecha, concepto: x.concepto, grupo: GRUPOS[grupo], importe: x.importe, deducible: ded, nota });
    }
    if (sinPagar) avisos.push(`${sinPagar} ${sinPagar === 1 ? 'gasto de ese año no está marcado como pagado y no se ha' : 'gastos de ese año no están marcados como pagados y no se han'} contado.`);
    const h = MA.situacionHipoteca(p.hipoteca, hoy);
    if (h) { const it = h.enRango(`${anio}-01`, `${anio}-12`); if (it.intereses) { const d = Math.round(it.intereses * factor); g.intereses += d;
      detalle.push({ fecha: fin, concepto: 'Intereses de la hipoteca', grupo: GRUPOS.intereses, importe: it.intereses, deducible: d, nota: factor < 1 ? `Proporcional a los días alquilado (${Math.round(factor * 100)} %)` : 'Según el cuadro de amortización: compáralo con el certificado del banco' }); } }
    const dudoso = contratos.reduce((t, c) => t + c.dudoso, 0);
    if (dudoso) { g.dudoso += dudoso; avisos.push(`${euros(dudoso)} impagados más de 6 meses se han tomado como saldo de dudoso cobro. Solo procede si reclamaste el pago y no lo has renovado.`); }
    let amortizacion = null;
    if (p.valorCatastral && p.valorCatastralConstruccion) {
      const pc = p.valorCatastralConstruccion / p.valorCatastral, coste = p.compraPrecio ? p.compraPrecio + (p.compraGastos || 0) : 0;
      const base = Math.round(Math.max(coste * pc, p.valorCatastralConstruccion));
      amortizacion = { base, porcentajeConstruccion: Math.round(pc * 1000) / 10, sobre: coste * pc > p.valorCatastralConstruccion ? 'coste de adquisición' : 'valor catastral', importe: Math.round(base * 0.03 * diasAlq / diasAnio) };
      g.amortizacion = amortizacion.importe;
      if (!coste) avisos.push('Amortización sobre el valor catastral. Si añades el precio y los gastos de compra y son mayores, la amortización sube.');
    } else if (diasAlq) avisos.push('Falta el valor catastral (total y de la construcción, están en el recibo del IBI): sin él no se calcula la amortización ni la imputación de los días vacíos.');
    if (!p.referencia && (diasAlq || p.valorCatastral)) avisos.push('Falta la referencia catastral: Renta Web la pide para cada inmueble.');
    const diasVacio = Math.max(0, diasProp - diasAlq);
    const imputacion = diasVacio && p.valorCatastral ? { dias: diasVacio, base: p.valorCatastral, porcentaje: p.imputacionPct || 1.1, importe: Math.round(p.valorCatastral * (p.imputacionPct || 1.1) / 100 * diasVacio / diasAnio) } : null;
    return { id: p.id, nombre: p.nombre, tipo: p.tipo, direccion: p.direccion || '', referencia: p.referencia || '', vivienda, diasAnio, diasPropiedad: diasProp, diasAlquilado: diasAlq, diasVacio,
      contratos, ingresos: { rentas, repercutidos, total: ingresos, pendiente }, gastos: g, detalle, rentas, amortizacion, imputacion, avisos };
  }
  // Intereses + reparación no pueden superar los ingresos de cada inmueble; el exceso se arrastra 4 años (primero el más antiguo)
  function informeRenta(s, anio, hoy) {
    hoyOk(hoy); anio = Number(anio);
    const inmuebles = [];
    for (const p of s.inmuebles) {
      let pendientes = [], r = null;
      for (let y = anio - 4; y <= anio; y++) {
        r = rentaBase(s, p, y, hoy);
        if (!r.diasPropiedad) { pendientes = []; continue; }
        const g = r.gastos, limitados = g.intereses + g.reparacion, margen = r.ingresos.total - limitados;
        let aplicado = 0; pendientes = pendientes.filter((x) => x.anio >= y - 4);
        if (margen > 0) for (const x of pendientes) { const u = Math.min(x.importe, margen - aplicado); if (u > 0) { x.importe -= u; aplicado += u; } }
        pendientes = pendientes.filter((x) => x.importe > 0);
        const exceso = Math.max(0, limitados - r.ingresos.total);
        if (exceso) pendientes.push({ anio: y, importe: exceso });
        r.exceso = exceso; r.arrastreAplicado = aplicado; r.arrastrePendiente = pendientes.reduce((t, x) => t + x.importe, 0);
      }
      if (!r.diasPropiedad) continue;
      if (!r.diasAlquilado && !Object.values(r.gastos).some(Boolean)) {
        if (!p.archivado || r.imputacion) inmuebles.push({ ...r, sinActividad: true, avisos: [r.imputacion
          ? `${p.nombre} no estuvo alquilado en ${anio}: se declara la imputación de rentas (${pct(r.imputacion.porcentaje)} del valor catastral).`
          : `${p.nombre} no estuvo alquilado en ${anio}. Si era tuyo, hay que declarar la imputación de rentas: añade su valor catastral.`] });
        continue;
      }
      const total = Object.values(r.gastos).reduce((t, v) => t + v, 0), aplicados = total - r.exceso + r.arrastreAplicado, neto = r.ingresos.total - aplicados;
      const pctRed = r.vivienda && neto > 0 && r.rentas > 0 ? r.contratos.reduce((t, c) => t + c.ingresos * c.reduccion, 0) / r.rentas : 0;
      const reduccion = neto > 0 ? Math.round(neto * pctRed / 100) : 0;
      if (r.exceso) r.avisos.push(`${euros(r.exceso)} de intereses y reparaciones superan los ingresos: se pueden deducir en los 4 años siguientes.`);
      if (r.arrastreAplicado) r.avisos.push(`Se han aplicado ${euros(r.arrastreAplicado)} de excesos de años anteriores (anexo C1 de Renta Web).`);
      inmuebles.push({ ...r, totalGastos: total, gastosAplicados: aplicados, rendimientoNeto: neto, reduccionPct: Math.round(pctRed * 10) / 10, reduccion, rendimientoReducido: neto - reduccion,
        retenciones: r.contratos.reduce((t, c) => t + c.retenciones, 0) });
    }
    const act = inmuebles.filter((x) => !x.sinActividad), sum = (f) => act.reduce((t, x) => t + f(x), 0);
    return { anio, generado: hoy, grupos: GRUPOS, inmuebles: inmuebles.sort((a, b) => a.nombre.localeCompare(b.nombre)),
      totales: { ingresos: sum((x) => x.ingresos.total), gastos: sum((x) => x.gastosAplicados), neto: sum((x) => x.rendimientoNeto), reduccion: sum((x) => x.reduccion),
        reducido: sum((x) => x.rendimientoReducido), retenciones: sum((x) => x.retenciones), imputacion: inmuebles.reduce((t, x) => t + (x.imputacion ? x.imputacion.importe : 0), 0), exceso: sum((x) => x.exceso) } };
  }
  function csvRenta(inf) {
    const e = (c) => c / 100, filas = [];
    for (const x of inf.inmuebles) {
      if (x.sinActividad) { filas.push([x.nombre, 'Sin alquiler', '', x.imputacion ? e(x.imputacion.importe) : '']); continue; }
      filas.push([x.nombre, 'Días alquilado', x.diasAlquilado, '']);
      filas.push([x.nombre, 'Ingresos íntegros', e(x.ingresos.total), '']);
      for (const [k, v] of Object.entries(x.gastos)) if (v) filas.push([x.nombre, GRUPOS[k], e(v), '']);
      filas.push([x.nombre, 'Rendimiento neto', e(x.rendimientoNeto), '']);
      if (x.reduccion) filas.push([x.nombre, `Reducción ${x.reduccionPct} %`, e(x.reduccion), '']);
      if (x.imputacion) filas.push([x.nombre, 'Imputación días sin alquilar', '', e(x.imputacion.importe)]);
    }
    return MA.csv(['Inmueble', 'Concepto', 'Importe', 'Imputación'], filas);
  }

  return { letras, eurosLetras, datosRecibo, INDICES, actualizacionPendiente, aplicarActualizacion, omitirActualizacion, registrarDeposito, recuperarDeposito, avisosFianza,
    escalon, avisosApp, proximosAvisos, cobroDesdeAviso, conciliar, aplicarConciliacion, altaRapida, importarCartera, PLANTILLA_CARTERA, fechaTexto,
    agregarAdjunto, quitarAdjunto, adjuntosDe, GRUPOS_RENTA: GRUPOS, informeRenta, csvRenta, normalizar: norm, pctTexto: pct, fmes };
});
