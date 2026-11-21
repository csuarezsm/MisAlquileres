/* Mis alquileres — documentos para firmar: modelos de contrato (PDF y Word) y actas de entrega con fotos y firmas.
   Los modelos son orientativos y siguen la Ley 29/1994 de Arrendamientos Urbanos (vivienda y uso distinto) y el Código Civil
   (habitaciones, garajes y trasteros). Se redactan siempre en español. © 2026 IT Canarias. */
(function (root, factory) {
  const m = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.Documentos = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const PDF = root.PDF || (typeof require === 'function' ? require('./pdf.js') : null);
  const eur = (c) => (c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fechaLarga = (iso) => (iso ? `${+iso.slice(8, 10)} de ${MESES[+iso.slice(5, 7) - 1]} de ${iso.slice(0, 4)}` : '___________');
  const v = (x, hueco) => (x == null || x === '' ? hueco || '______________' : String(x));

  // Tipo de contrato según el inmueble
  function tipoDe(inmuebleTipo, porUnidades) {
    if (inmuebleTipo === 'Habitación' || (inmuebleTipo === 'Vivienda' && porUnidades)) return 'habitacion';
    if (inmuebleTipo === 'Vivienda') return 'vivienda';
    if (/garaje|moto/i.test(inmuebleTipo || '')) return 'garaje';
    if (inmuebleTipo === 'Trastero') return 'trastero';
    return 'local';
  }
  const TIPOS = { vivienda: 'Vivienda (LAU)', habitacion: 'Habitación', garaje: 'Plaza de garaje', trastero: 'Trastero', local: 'Local, oficina o nave (uso distinto de vivienda)' };

  // d: { tipo, lugar, fecha, arrendadores:[{nombre,dni,domicilio,pct}], arrendatario:{nombre,dni,domicilio}, inmueble:{nombre,direccion,referencia,superficie,descripcion},
  //      inicio, fin, anios, renta, rentaLetras, diaPago, formaPago, fianza, fianzaLetras, garantia, actualizacion, actualizacionPct, gastos:[{concepto,importe,periodicidad}],
  //      impuesto:{nombre,pct}, retencion, amueblado, mascotas, actividad, vehiculo, preaviso, adicionales }
  function contrato(d) {
    const B = []; const h = (t) => B.push({ t: 'h', x: t }); const p = (x) => B.push({ t: 'p', x });
    const T = d.tipo, LAU = T === 'vivienda' || T === 'local';
    const arr = d.arrendadores.length ? d.arrendadores : [{ nombre: '', dni: '', domicilio: '' }];
    const varios = arr.length > 1, ARR = varios ? 'LA PARTE ARRENDADORA' : 'EL ARRENDADOR', INQ = 'EL ARRENDATARIO';
    const titulo = { vivienda: 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA', habitacion: 'CONTRATO DE ARRENDAMIENTO DE HABITACIÓN', garaje: 'CONTRATO DE ARRENDAMIENTO DE PLAZA DE GARAJE',
      trastero: 'CONTRATO DE ARRENDAMIENTO DE TRASTERO', local: 'CONTRATO DE ARRENDAMIENTO PARA USO DISTINTO DEL DE VIVIENDA' }[T];
    B.push({ t: 'titulo', x: titulo });
    p(`En ${v(d.lugar)}, a ${fechaLarga(d.fecha)}.`);
    h('REUNIDOS');
    for (const a of arr) p(`De una parte, D./D.ª ${v(a.nombre)}, mayor de edad, con DNI/NIF ${v(a.dni)}${a.domicilio ? ` y domicilio en ${a.domicilio}` : ''}${varios && a.pct ? `, titular del ${String(a.pct).replace('.', ',')} % del inmueble` : ''}.`);
    p(`${varios ? 'En adelante, conjuntamente, ' : 'En adelante, '}${ARR}.`);
    p(`De otra parte, ${/\b(S\.?L\.?|S\.?A\.?|S\.?L\.?U\.?|S\.?COOP|C\.?B\.?)\b/i.test(d.arrendatario.nombre || '') ? '' : 'D./D.ª '}${v(d.arrendatario.nombre)}, con DNI/NIF ${v(d.arrendatario.dni)}${d.arrendatario.domicilio ? ` y domicilio en ${d.arrendatario.domicilio}` : ''}. En adelante, ${INQ}.`);
    p('Ambas partes se reconocen la capacidad legal necesaria para otorgar el presente contrato y, de común acuerdo,');
    h('EXPONEN');
    const objeto = { vivienda: 'la vivienda', habitacion: 'una habitación de la vivienda', garaje: 'la plaza de garaje', trastero: 'el trastero', local: 'el inmueble' }[T];
    p(`I. Que ${ARR} es ${varios ? 'propietaria' : 'propietario'} de ${objeto} situad${T === 'habitacion' || T === 'vivienda' || T === 'garaje' ? 'a' : 'o'} en ${v(d.inmueble.direccion)}${d.inmueble.referencia ? `, con referencia catastral ${d.inmueble.referencia}` : ''}${d.inmueble.superficie ? `, de ${String(d.inmueble.superficie).replace('.', ',')} metros cuadrados` : ''}${d.inmueble.descripcion ? ` (${d.inmueble.descripcion})` : ''}.`);
    p(`II. Que ${INQ} está interesado en arrendarl${T === 'trastero' || T === 'local' ? 'o' : 'a'}, por lo que ambas partes suscriben este contrato con arreglo a las siguientes`);
    h('CLÁUSULAS');
    let n = 0; const c = (titulo2, texto) => { n++; B.push({ t: 'c', n, x: titulo2 }); for (const x of [].concat(texto)) if (x) p(x); };

    // 1. Objeto y destino
    const destino = {
      vivienda: `La vivienda se destinará exclusivamente a vivienda habitual y permanente de ${INQ} y, en su caso, de su familia, sin que pueda destinarse a otro uso ni a alquiler turístico o por habitaciones.`,
      habitacion: `Se arrienda una habitación de uso privativo, con derecho al uso compartido de las zonas comunes de la vivienda (cocina, baño, salón y demás espacios comunes) junto con el resto de ocupantes. La habitación se destinará a residencia de ${INQ}, que no podrá alojar a terceros.`,
      garaje: `La plaza se destinará exclusivamente al estacionamiento ${d.vehiculo ? `del vehículo ${d.vehiculo}` : 'de un vehículo'} de ${INQ}. No podrán guardarse en ella enseres, combustibles ni materiales peligrosos, ni realizarse reparaciones del vehículo.`,
      trastero: `El trastero se destinará exclusivamente a guardar enseres y objetos de ${INQ}. Queda prohibido almacenar materiales inflamables, explosivos, tóxicos, perecederos o ilícitos, así como usarlo como vivienda o local de actividad.`,
      local: `El inmueble se destinará exclusivamente al ejercicio de la actividad de ${v(d.actividad, '__________________')}. Cualquier cambio de actividad requerirá el consentimiento escrito de ${ARR}. Las licencias, permisos y autorizaciones necesarios para la actividad serán por cuenta y riesgo de ${INQ}, sin que su denegación afecte a la validez del contrato.`,
    }[T];
    c('Objeto y destino', [destino, d.amueblado ? `Se arrienda con el mobiliario, enseres y electrodomésticos que se relacionan en el inventario anexo.` : '', `El estado en que se entrega se recoge en el acta de entrega que se firma junto con este contrato.`]);

    // 2. Duración
    const plazo = d.fin ? `desde el ${fechaLarga(d.inicio)} hasta el ${fechaLarga(d.fin)}` : `de ${v(d.anios, '___')} año${d.anios === 1 ? '' : 's'} a contar desde el ${fechaLarga(d.inicio)}`;
    const dur = {
      vivienda: [`El contrato tendrá una duración ${plazo}.`,
        `Si la duración pactada es inferior a cinco años (siete si ${ARR} es persona jurídica), llegado el vencimiento el contrato se prorrogará obligatoriamente por plazos anuales hasta alcanzar esa duración, salvo que ${INQ} comunique con al menos treinta días de antelación su voluntad de no renovarlo (artículo 9 de la Ley de Arrendamientos Urbanos).`,
        `Cumplido ese plazo, si ninguna de las partes comunica su voluntad de no renovarlo con al menos cuatro meses de antelación en el caso de ${ARR} y dos meses en el de ${INQ}, el contrato se prorrogará por plazos anuales hasta un máximo de tres años más (artículo 10).`],
      local: [`El contrato tendrá una duración ${plazo}. A su término quedará extinguido sin necesidad de requerimiento, salvo que las partes acuerden por escrito su renovación.`],
    }[T] || [`El contrato tendrá una duración ${plazo}. Al vencimiento se prorrogará por periodos ${d.anios && d.anios >= 1 ? 'anuales' : 'mensuales'} sucesivos, salvo que cualquiera de las partes comunique a la otra su voluntad de darlo por terminado con al menos ${v(d.preaviso || 30, '30')} días de antelación.`];
    c('Duración', dur);

    // 3. Desistimiento
    const desist = {
      vivienda: `${INQ} podrá desistir del contrato una vez transcurridos al menos seis meses, siempre que lo comunique a ${ARR} con un mínimo de treinta días de antelación (artículo 11). Las partes pactan que, en ese caso, ${INQ} indemnizará a ${ARR} con una cantidad equivalente a una mensualidad de la renta en vigor por cada año del contrato que reste por cumplir; los periodos inferiores al año darán lugar a la parte proporcional.`,
      local: `${INQ} podrá desistir del contrato comunicándolo a ${ARR} con al menos ${v(d.preaviso || 60, '60')} días de antelación. En tal caso, indemnizará a ${ARR} con una mensualidad de la renta en vigor por cada año que reste por cumplir, con un máximo de ${v(d.indemnizacionMax || 3, '3')} mensualidades.`,
    }[T] || `${INQ} podrá dar por terminado el contrato en cualquier momento comunicándolo a ${ARR} con al menos ${v(d.preaviso || 30, '30')} días de antelación.`;
    c('Desistimiento', desist);

    // 4. Renta
    const imp = d.impuesto && d.impuesto.nombre ? ` más el ${d.impuesto.nombre} correspondiente (actualmente el ${String(d.impuesto.pct).replace('.', ',')} %)` : '';
    c('Renta y forma de pago', [
      `La renta mensual es de ${eur(d.renta)}${d.rentaLetras ? ` (${d.rentaLetras})` : ''}${imp}. Se pagará por meses anticipados ${d.diaPago && d.diaPago <= 7 ? `el día ${d.diaPago} de cada mes y, en todo caso, dentro de los siete primeros días` : `dentro de los ${d.diaPago && d.diaPago > 7 ? d.diaPago : 'siete'} primeros días`} de cada mes, mediante ${v(d.formaPago, 'transferencia bancaria a la cuenta que indique ' + ARR)}.`,
      d.retencion ? `${INQ}, como obligado a retener, practicará sobre la renta la retención a cuenta del IRPF que establezca la normativa (actualmente el ${String(d.retPct || 19).replace('.', ',')} %), la ingresará en la Agencia Tributaria y entregará a ${ARR} el certificado anual de retenciones.` : '',
      d.impuesto && d.impuesto.nombre ? `${ARR} emitirá cada mes la factura correspondiente.` : `${ARR} entregará a ${INQ} recibo o justificante de cada pago.`,
      d.inicioProrrateado ? `La renta del primer mes se calculará en proporción a los días de ocupación.` : '']);

    // 5. Actualización
    const act = {
      irav: `La renta se actualizará cada año, en la fecha en que se cumpla cada año de vigencia del contrato, aplicando la variación del Índice de Referencia para la Actualización de los Contratos de Arrendamiento de Vivienda (IRAV) que publica el INE, sin que el incremento pueda superar el que resulte de dicho índice conforme al artículo 18 de la Ley de Arrendamientos Urbanos.`,
      ipc: `La renta se actualizará cada año, en la fecha en que se cumpla cada año de vigencia del contrato, aplicando la variación porcentual del Índice de Precios de Consumo (IPC) general nacional de los doce meses anteriores publicada por el INE${T === 'vivienda' ? ', con los límites que establezca en cada momento el artículo 18 de la Ley de Arrendamientos Urbanos' : ''}.`,
      fijo: `La renta se incrementará cada año, en la fecha en que se cumpla cada año de vigencia del contrato, en un ${String(d.actualizacionPct == null ? '___' : d.actualizacionPct).replace('.', ',')} %${T === 'vivienda' ? ', sin superar los límites del artículo 18 de la Ley de Arrendamientos Urbanos' : ''}.`,
      ninguna: `La renta no se actualizará durante la vigencia del contrato.`,
    };
    c('Actualización de la renta', [act[d.actualizacion] || act.ipc, d.actualizacion !== 'ninguna' ? `${ARR} comunicará por escrito a ${INQ} la nueva renta, que será exigible a partir del mes siguiente a la comunicación.` : '']);

    // 6. Gastos y suministros
    const g = d.gastos || [];
    c('Gastos y suministros', [
      T === 'habitacion' ? (d.suministrosIncluidos ? `La renta incluye los suministros de la vivienda (agua, luz, gas e internet) dentro de un uso normal.` : `Los suministros de la vivienda (agua, luz, gas e internet) se repartirán a partes iguales entre los ocupantes que haya cada mes, según las facturas, que ${ARR} pondrá a disposición de ${INQ}.`)
        : T === 'garaje' || T === 'trastero' ? '' : `Los suministros con contador individual (agua, electricidad, gas, telecomunicaciones) serán por cuenta de ${INQ}, que podrá contratarlos a su nombre.`,
      g.length ? `Además de la renta, ${INQ} abonará los siguientes gastos${T === 'vivienda' ? ', conforme al artículo 20 de la Ley de Arrendamientos Urbanos' : ''}: ${g.map((x) => `${x.concepto}${x.importe ? ` (importe anual actual de ${eur(x.importe)})` : ''}`).join('; ')}.` : `Los gastos generales del inmueble (comunidad, impuesto sobre bienes inmuebles, tasas) son por cuenta de ${ARR}.`,
      T === 'vivienda' ? `Los gastos de gestión inmobiliaria y de formalización del contrato serán a cargo de ${ARR}.` : '']);

    // 7. Fianza
    const fz = d.fianza || 0;
    c('Fianza y garantías', fz ? [
      `${INQ} entrega en este acto ${eur(fz)}${d.fianzaLetras ? ` (${d.fianzaLetras})` : ''} en concepto de fianza${LAU ? `, equivalente a ${T === 'vivienda' ? 'una mensualidad' : 'dos mensualidades'} de renta (artículo 36 de la Ley de Arrendamientos Urbanos)` : ''}, sirviendo este documento como carta de pago.`,
      LAU || T === 'habitacion' ? `${ARR} depositará la fianza en el organismo que establezca la normativa de la comunidad autónoma (en Canarias, el Instituto Canario de la Vivienda).` : '',
      `La fianza se devolverá a la finalización del contrato, en el plazo de un mes desde la entrega de las llaves, descontando, en su caso, el importe de los desperfectos imputables a ${INQ} y las cantidades que adeude. ${LAU ? 'Transcurrido ese plazo sin devolverla, devengará el interés legal.' : ''} La fianza no podrá aplicarse al pago de la renta.`,
      d.garantia ? `Además, ${INQ} entrega una garantía adicional de ${eur(d.garantia)}${T === 'vivienda' ? ', que no supera dos mensualidades de renta' : ''}, que se devolverá en las mismas condiciones que la fianza.` : '',
    ] : [`No se exige fianza.`]);

    // 8. Conservación y obras
    c('Conservación y obras', T === 'vivienda' ? [
      `${ARR} realizará las reparaciones necesarias para conservar la vivienda en condiciones de habitabilidad, salvo cuando el deterioro sea imputable a ${INQ} (artículo 21). Las pequeñas reparaciones que exija el desgaste por el uso ordinario serán de cargo de ${INQ}.`,
      `${INQ} no podrá realizar, sin el consentimiento expreso y por escrito de ${ARR}, obras que modifiquen la configuración de la vivienda o de sus accesorios, o que afecten a la estabilidad o seguridad del edificio (artículo 23).`]
      : [`${INQ} usará ${objeto} con la diligencia debida y lo devolverá al terminar el contrato en el mismo estado en que lo recibió, salvo el desgaste por el uso normal. Serán de su cargo las reparaciones de los daños que cause.`,
        `No podrá realizar obras ni instalaciones sin el consentimiento previo y por escrito de ${ARR}.${T === 'local' ? ` Las obras de adecuación del local para la actividad serán por cuenta de ${INQ} y quedarán en beneficio del inmueble, salvo pacto en contrario.` : ''}`]);

    // 9. Cesión y subarriendo
    c('Cesión y subarriendo', T === 'local'
      ? `${INQ} no podrá subarrendar ni ceder el contrato sin el consentimiento previo y por escrito de ${ARR}. Las partes excluyen expresamente la facultad de cesión y subarriendo prevista en el artículo 32 de la Ley de Arrendamientos Urbanos.`
      : `${INQ} no podrá ceder el contrato ni subarrendar total o parcialmente sin el consentimiento previo y por escrito de ${ARR}.`);

    // 10. Cláusulas propias de cada tipo
    if (T === 'vivienda' || T === 'habitacion') c('Animales de compañía', d.mascotas ? `Se permite la tenencia de animales de compañía, siempre que no causen molestias a los vecinos ni daños en la vivienda, de los que responderá ${INQ}.` : `No se permite la tenencia de animales de compañía sin el consentimiento escrito de ${ARR}.`);
    if (T === 'habitacion') c('Convivencia', `${INQ} respetará las normas de convivencia de la vivienda, el descanso y la intimidad de los demás ocupantes, y colaborará en la limpieza y el orden de las zonas comunes.`);
    if (T === 'garaje' || T === 'trastero') c('Responsabilidad', `${ARR} no responde de los robos, hurtos o daños que puedan sufrir ${T === 'garaje' ? 'el vehículo o los objetos que haya en su interior' : 'los objetos guardados'}. ${INQ} respetará las normas de la comunidad de propietarios y será responsable de los daños que cause en las zonas comunes. Se le entregan ${v(d.llaves, '___')} llaves o mandos de acceso, que devolverá al terminar el contrato.`);
    if (T === 'local') {
      c('Seguros', `${INQ} contratará y mantendrá durante toda la vigencia del contrato un seguro de responsabilidad civil que cubra los daños que su actividad pueda causar al inmueble y a terceros.`);
      c('Renuncias', `${INQ} renuncia expresamente a la indemnización por clientela del artículo 34 y a los derechos de adquisición preferente del artículo 31 de la Ley de Arrendamientos Urbanos.`);
    }
    c('Acceso al inmueble', `${INQ} permitirá el acceso a ${ARR}, o a quien este designe, para comprobar el estado del inmueble y realizar las reparaciones necesarias, previo aviso con antelación razonable y en horario convenido.`);
    c('Notificaciones', `Las comunicaciones entre las partes se harán por escrito a los domicilios indicados, o por correo electrónico o mensajería que permita acreditar su envío y recepción.`);
    const ley = { vivienda: 'por lo dispuesto en el Título II de la Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos y, supletoriamente, por el Código Civil',
      local: 'por la voluntad de las partes, por lo dispuesto en el Título III de la Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos y, supletoriamente, por el Código Civil' }[T] || 'por la voluntad de las partes y, en lo no previsto, por los artículos 1542 y siguientes del Código Civil';
    c('Régimen jurídico', `El presente contrato se rige ${ley}. Para cualquier controversia, las partes se someten a los juzgados y tribunales del lugar donde se encuentra el inmueble.`);
    if (d.adicionales) c('Otros pactos', String(d.adicionales).split(/\n+/));
    p('Y en prueba de conformidad, las partes firman el presente contrato por duplicado y a un solo efecto en el lugar y la fecha indicados.');
    B.push({ t: 'firmas', izq: arr.map((a) => a.nombre || ''), der: [d.arrendatario.nombre || ''], etIzq: ARR, etDer: INQ });
    if (d.amueblado) B.push({ t: 'salto' }, { t: 'h', x: 'ANEXO: INVENTARIO' }, { t: 'p', x: 'Mobiliario, enseres y electrodomésticos que se entregan con el inmueble:' }, ...Array.from({ length: 8 }, () => ({ t: 'p', x: '______________________________________________________________' })));
    // Contracciones: «a EL ARRENDATARIO» → «al ARRENDATARIO», «de EL» → «del»
    const contrae = (x) => String(x).replace(/\b([Aa]) EL (ARRENDA)/g, '$1l $2').replace(/\b([Dd])e EL (ARRENDA)/g, '$1el $2');
    for (const b of B) if (b.x) b.x = contrae(b.x);
    return { titulo, bloques: B };
  }


  // ---------- Texto editable: el contrato en secciones, y los modelos propios por tipo ----------
  // secciones(doc) → { titulo, cabecera, clausulas:[{titulo, texto}], cierre:[bloques] }. El texto usa una línea en blanco entre párrafos.
  const CABECERAS = ['REUNIDOS', 'EXPONEN', 'CLÁUSULAS'];
  function secciones(doc) {
    const B = doc.bloques, iF = B.findIndex((b) => b.t === 'firmas'), iCierre = iF > 0 && B[iF - 1].t === 'p' ? iF - 1 : iF;
    const cab = [], cls = []; let titulo = doc.titulo;
    for (let i = 0; i < iCierre; i++) {
      const b = B[i];
      if (b.t === 'titulo') titulo = b.x;
      else if (b.t === 'c') cls.push({ titulo: b.x, parr: [] });
      else if (cls.length && b.t === 'p') cls[cls.length - 1].parr.push(b.x);
      else if (b.t === 'h' && b.x === 'CLÁUSULAS') continue;
      else if (b.t === 'h' || b.t === 'p') cab.push(b.x);
    }
    return { titulo, cabecera: cab.join('\n\n'), clausulas: cls.map((c) => ({ titulo: c.titulo, texto: c.parr.join('\n\n') })), cierre: B.slice(iCierre) };
  }
  const parrafos = (t) => String(t || '').split(/\n\s*\n|\n/).map((x) => x.trim()).filter(Boolean);
  function desdeSecciones(sec) {
    const B = [{ t: 'titulo', x: sec.titulo }];
    for (const x of parrafos(sec.cabecera)) B.push(CABECERAS.includes(x.toUpperCase()) ? { t: 'h', x: x.toUpperCase() } : { t: 'p', x });
    B.push({ t: 'h', x: 'CLÁUSULAS' });
    let n = 0;
    for (const c of sec.clausulas) { const ps = parrafos(c.texto); if (!ps.length && !String(c.titulo || '').trim()) continue; n++; B.push({ t: 'c', n, x: String(c.titulo || '').trim() || `Cláusula ${n}` }); for (const x of ps) B.push({ t: 'p', x }); }
    return { titulo: sec.titulo, bloques: B.concat(sec.cierre || []) };
  }
  // Datos del contrato que se pueden escribir como {MARCA} en un modelo propio
  function marcas(d) {
    const a = (d.arrendadores || [])[0] || {};
    return { ARRENDADOR: a.nombre, INQUILINO: d.arrendatario && d.arrendatario.nombre, DIRECCION: d.inmueble && d.inmueble.direccion, RENTA: d.renta ? eur(d.renta) : '', RENTA_LETRA: d.rentaLetras,
      FIANZA: d.fianza ? eur(d.fianza) : '', FIANZA_LETRA: d.fianzaLetras, GARANTIA: d.garantia ? eur(d.garantia) : '', INICIO: d.inicio ? fechaLarga(d.inicio) : '', FIN: d.fin ? fechaLarga(d.fin) : '',
      DIA_PAGO: d.diaPago ? `día ${d.diaPago}` : '', FORMA_PAGO: d.formaPago, ACTIVIDAD: d.actividad, VEHICULO: d.vehiculo, LUGAR: d.lugar };
  }
  const MARCAS = ['ARRENDADOR', 'INQUILINO', 'DIRECCION', 'RENTA', 'RENTA_LETRA', 'FIANZA', 'FIANZA_LETRA', 'GARANTIA', 'INICIO', 'FIN', 'DIA_PAGO', 'FORMA_PAGO', 'ACTIVIDAD', 'VEHICULO', 'LUGAR'];
  const rellenar = (t, m) => String(t).replace(/\{([A-Z_]+)\}/g, (x, k) => (k in m ? (m[k] ? String(m[k]) : '______________') : x));
  function aMarcas(t, m) { // cambia los datos concretos de este contrato por {MARCA}, de los más largos a los más cortos
    let r = String(t);
    for (const [k, val] of Object.entries(m).filter(([, x]) => x && String(x).length >= 4).sort((a, b) => String(b[1]).length - String(a[1]).length)) r = r.split(String(val)).join(`{${k}}`);
    return r;
  }
  // modelo = { cambios: { [título]: texto | null }, nuevas: [{ titulo, texto }] }
  const SIN_MODELO = ['Otros pactos'];
  function aplicarModelo(sec, modelo, d) {
    if (!modelo) return sec;
    const m = marcas(d), cambios = modelo.cambios || {}, cls = [];
    for (const c of sec.clausulas) {
      if (!(c.titulo in cambios)) { cls.push(c); continue; }
      if (cambios[c.titulo] != null) cls.push({ titulo: c.titulo, texto: rellenar(cambios[c.titulo], m) });
    }
    const iOtros = cls.findIndex((c) => SIN_MODELO.includes(c.titulo)), nuevas = (modelo.nuevas || []).map((c) => ({ titulo: c.titulo, texto: rellenar(c.texto, m) }));
    if (iOtros >= 0) cls.splice(iOtros, 0, ...nuevas); else cls.push(...nuevas);
    return { ...sec, clausulas: cls };
  }
  // Compara lo editado con el modelo de la app y devuelve el modelo propio (con {MARCAS} en lugar de los datos de este contrato)
  function crearModelo(base, editado, d) {
    const m = marcas(d), norm = (t) => parrafos(t).join('\n\n'), cambios = {}, nuevas = [];
    const ed = editado.clausulas.filter((c) => !SIN_MODELO.includes(c.titulo) && (String(c.titulo || '').trim() || parrafos(c.texto).length));
    const porTitulo = new Map(ed.map((c) => [String(c.titulo).trim(), c]));
    for (const c of base.clausulas) {
      if (SIN_MODELO.includes(c.titulo)) continue;
      const e = porTitulo.get(c.titulo);
      if (!e || !parrafos(e.texto).length) cambios[c.titulo] = null;
      else if (norm(e.texto) !== norm(c.texto)) cambios[c.titulo] = aMarcas(norm(e.texto), m);
    }
    const titulosBase = new Set(base.clausulas.map((c) => c.titulo));
    for (const c of ed) if (!titulosBase.has(String(c.titulo).trim())) nuevas.push({ titulo: String(c.titulo).trim() || 'Cláusula', texto: aMarcas(norm(c.texto), m) });
    return Object.keys(cambios).length || nuevas.length ? { cambios, nuevas } : null;
  }

  // ---------- PDF del contrato (A4) ----------
  function pdfContrato(doc, o = {}) {
    const d = PDF.Documento({ margen: 56 }), M = d.margen, A = d.ancho - 2 * M, acento = PDF.hex(o.acento);
    let pag = 1;
    const pie = () => d.texto(d.ancho / 2, d.alto - 34, `${pag}`, { size: 8, color: PDF.GRIS, alinear: 'centro' });
    d.alPaginar = () => { pag++; pie(); };
    pie();
    for (const b of doc.bloques) {
      if (b.t === 'salto') { d.pagina(); continue; }
      if (b.t === 'titulo') { d.rect(M, d.y, 40, 3, acento); d.y += 14; d.parrafo(b.x, { size: 13.5, negrita: true, interlinea: 1.3 }); d.y += 8; }
      else if (b.t === 'h') { d.salto(40); d.y += 8; d.texto(M, d.y, b.x, { size: 10.5, negrita: true }); d.y += 18; }
      else if (b.t === 'c') { d.salto(46); d.y += 6; d.texto(M, d.y, `${b.n}. ${b.x}`, { size: 10, negrita: true }); d.y += 15; }
      else if (b.t === 'p') { d.parrafo(b.x, { size: 10, interlinea: 1.45, ancho: A }); d.y += 5; }
      else if (b.t === 'firmas') {
        const filas = Math.max(b.izq.length, b.der.length); d.salto(60 + 70 * filas); d.y += 24;
        const col = (x, et, nombres) => { d.texto(x, d.y, et, { size: 8.5, negrita: true, color: PDF.GRIS }); nombres.forEach((nm, i) => { const yy = d.y + 60 + i * 70; d.linea(x, yy, x + A / 2 - 30, yy, { color: [0.5, 0.5, 0.5] }); d.texto(x, yy + 6, nm, { size: 9 }); }); };
        col(M, b.etIzq, b.izq); col(M + A / 2 + 20, b.etDer, b.der); d.y += 70 * filas + 10;
      }
    }
    return d.bytes();
  }

  // ---------- Word (.docx) mínimo, sin librerías ----------
  const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const run = (t, o = {}) => `<w:r>${o.b || o.sz ? `<w:rPr>${o.b ? '<w:b/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;
  const par = (cont, o = {}) => `<w:p><w:pPr>${o.estilo ? `<w:pStyle w:val="${o.estilo}"/>` : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}${o.antes != null ? `<w:spacing w:before="${o.antes}" w:after="${o.despues != null ? o.despues : 120}"/>` : ''}${o.keep ? '<w:keepNext/>' : ''}</w:pPr>${cont}</w:p>`;
  function docx(doc, zip) {
    let body = '';
    for (const b of doc.bloques) {
      if (b.t === 'salto') body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      else if (b.t === 'titulo') body += par(run(b.x, { b: 1, sz: 28 }), { jc: 'center', antes: 0, despues: 240 });
      else if (b.t === 'h') body += par(run(b.x, { b: 1 }), { antes: 240, despues: 120, keep: 1, jc: 'center' });
      else if (b.t === 'c') body += par(run(`${b.n}. ${b.x}`, { b: 1 }), { antes: 200, despues: 80, keep: 1 });
      else if (b.t === 'p') body += par(run(b.x), { jc: 'both', antes: 0, despues: 120 });
      else if (b.t === 'firmas') {
        const filas = Math.max(b.izq.length, b.der.length), celda = (t, b2) => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${par(b2 ? run(t, { b: 1 }) : run(t))}</w:tc>`;
        let tr = `<w:tr>${celda(b.etIzq, 1)}${celda(b.etDer, 1)}</w:tr>`;
        for (let i = 0; i < filas; i++) tr += `<w:tr><w:trPr><w:trHeight w:val="1100"/></w:trPr>${celda('')}${celda('')}</w:tr><w:tr>${celda(b.izq[i] ? 'Fdo.: ' + b.izq[i] : '')}${celda(b.der[i] ? 'Fdo.: ' + b.der[i] : '')}</w:tr>`;
        body += par('', { antes: 360 }) + `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid>${tr}</w:tbl>`;
      }
    }
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
    return zip([
      { nombre: '[Content_Types].xml', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
      { nombre: '_rels/.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { nombre: 'word/_rels/document.xml.rels', datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nombre: 'word/document.xml', datos: documento },
      { nombre: 'word/styles.xml', datos: estilos },
    ]);
  }

  // ---------- Acta de entrega (entrada o salida) ----------
  // a: { tipo, fecha, inmueble, direccion, arrendador, arrendatario, estancias:[{nombre, estado, notas, fotos:[bytes]}], contadores:{luz,agua,gas}, llaves, observaciones, firmas:{arrendador:bytes, arrendatario:bytes} }
  const ESTADOS = { bien: 'Buen estado', regular: 'Con desgaste', mal: 'Con daños' };
  function pdfActa(a, o = {}) {
    const t = o.t || ((s) => s), d = PDF.Documento({ margen: 44 }), M = d.margen, A = d.ancho - 2 * M, acento = PDF.hex(o.acento), GRIS = PDF.GRIS;
    d.rect(0, 0, d.ancho, 5, acento); d.y = 34;
    d.texto(M, d.y, t(a.tipo === 'salida' ? 'Acta de salida y devolución de llaves' : 'Acta de entrada y entrega de llaves'), { size: 15, negrita: true }); d.y += 22;
    d.texto(M, d.y, `${a.inmueble}${a.direccion ? ' · ' + a.direccion : ''}`, { size: 10, color: GRIS, max: A }); d.y += 14;
    d.texto(M, d.y, `${t('Fecha')}: ${PDF.fecha(a.fecha)}`, { size: 10, color: GRIS }); d.y += 22;
    const col = (x, et, nm) => { d.texto(x, d.y, t(et), { size: 7.5, color: GRIS }); d.texto(x, d.y + 11, nm || '—', { size: 10, negrita: true, max: A / 2 - 10 }); };
    col(M, 'Arrendador', a.arrendador); col(M + A / 2 + 6, 'Inquilino', a.arrendatario); d.y += 34;
    const cont = Object.entries(a.contadores || {}).filter(([, x]) => x);
    if (cont.length || a.llaves) {
      d.linea(M, d.y, M + A, d.y); d.y += 10;
      if (cont.length) { d.texto(M, d.y, t('Lecturas de contadores'), { size: 9, negrita: true }); d.y += 14; for (const [k, x] of cont) { d.texto(M, d.y, t({ luz: 'Luz', agua: 'Agua', gas: 'Gas' }[k] || k), { size: 9, color: GRIS }); d.texto(M + 90, d.y, String(x), { size: 9 }); d.y += 13; } d.y += 4; }
      if (a.llaves) { d.texto(M, d.y, t('Llaves y mandos'), { size: 9, negrita: true }); d.y += 13; d.parrafo(a.llaves, { size: 9, ancho: A }); d.y += 4; }
    }
    for (const e of a.estancias || []) {
      d.salto(60); d.y += 6; d.linea(M, d.y, M + A, d.y); d.y += 10;
      d.texto(M, d.y, e.nombre || t('Estancia'), { size: 10.5, negrita: true });
      if (e.estado) d.texto(M + A, d.y, t(ESTADOS[e.estado] || e.estado), { size: 9, negrita: true, alinear: 'derecha', color: e.estado === 'mal' ? [0.72, 0.2, 0.16] : e.estado === 'regular' ? [0.6, 0.42, 0.02] : [0.09, 0.47, 0.3] });
      d.y += 16;
      if (e.notas) { d.parrafo(e.notas, { size: 9.5, ancho: A, interlinea: 1.4 }); d.y += 4; }
      const fotos = (e.fotos || []).filter((b) => PDF.infoJpeg(b)), lado = (A - 16) / 3;
      for (let i = 0; i < fotos.length; i += 3) {
        d.salto(lado + 10); let alto = 0;
        fotos.slice(i, i + 3).forEach((b, j) => { alto = Math.max(alto, d.imagen(M + j * (lado + 8), d.y, lado, lado, b)); });
        d.y += alto + 8;
      }
    }
    if (a.observaciones) { d.salto(50); d.y += 8; d.texto(M, d.y, t('Observaciones'), { size: 10, negrita: true }); d.y += 15; d.parrafo(a.observaciones, { size: 9.5, ancho: A }); }
    d.salto(130); d.y += 18;
    d.parrafo(t(a.tipo === 'salida' ? 'Ambas partes están de acuerdo con el estado descrito y con la devolución de las llaves en esta fecha.' : 'Ambas partes están de acuerdo con el estado descrito y con la entrega de las llaves en esta fecha.'), { size: 9, color: GRIS, ancho: A });
    d.y += 10;
    const firma = (x, et, nm, b) => { d.texto(x, d.y, t(et), { size: 8, color: GRIS }); if (b && PDF.infoJpeg(b)) d.imagen(x, d.y + 12, A / 2 - 30, 60, b); d.linea(x, d.y + 76, x + A / 2 - 30, d.y + 76, { color: [0.5, 0.5, 0.5] }); d.texto(x, d.y + 82, nm || '', { size: 9 }); };
    firma(M, 'Arrendador', a.arrendador, a.firmas && a.firmas.arrendador); firma(M + A / 2 + 20, 'Inquilino', a.arrendatario, a.firmas && a.firmas.arrendatario);
    d.y += 100;
    return d.bytes();
  }

  // Estancias habituales según el tipo de inmueble
  function estanciasDe(tipoInmueble) {
    if (/garaje|moto/i.test(tipoInmueble || '')) return ['Plaza'];
    if (tipoInmueble === 'Trastero') return ['Trastero'];
    if (tipoInmueble === 'Habitación') return ['Habitación', 'Zonas comunes'];
    if (['Local comercial', 'Oficina', 'Nave'].includes(tipoInmueble)) return ['Zona principal', 'Aseo', 'Fachada y escaparate', 'Instalaciones'];
    if (tipoInmueble === 'Vivienda') return ['Entrada y pasillo', 'Salón', 'Cocina', 'Baño', 'Dormitorio 1', 'Dormitorio 2'];
    return ['General'];
  }

  return { TIPOS, ESTADOS, MARCAS, tipoDe, contrato, secciones, desdeSecciones, aplicarModelo, crearModelo, pdfContrato, docx, pdfActa, estanciasDe, fechaLarga };
});
