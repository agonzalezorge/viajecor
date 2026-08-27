// La única puerta a los datos guardados. Todo lo que la app persiste pasa por
// acá, bajo una sola clave de localStorage (ARQUITECTURA §6).
//
// Este módulo carga con el riesgo más grave de toda la arquitectura: acá vive la
// única copia de los gastos del usuario. No hay servidor, no hay papelera, no hay
// historial. Un error de este archivo no da un número mal: borra meses de
// registro. Por eso hay una regla que gobierna todo lo de abajo:
//
//   ANTE LA DUDA, NO SE ESCRIBE.
//
// Si lo guardado no se entiende, este módulo devuelve un estado vacío para que la
// app abra igual, pero AVISA que lo hizo y GUARDA APARTE lo que no pudo leer. Lo
// que nunca hace es pisar en silencio un dato que no entendió: un dato ilegible
// todavía se puede rescatar a mano; uno sobrescrito, no.

import { validarMovimiento, validarFecha } from '../core/modelo.js';

export const CLAVE_DATOS = 'viajecor:datos:v1';

// Sube solo si cambia la FORMA de los datos guardados (PRODUCTO §9). No sube
// porque se agregue una pantalla ni porque cambie un cálculo.
export const ESQUEMA_ACTUAL = 1;

/** El prefijo bajo el que se preserva lo que no se pudo interpretar. */
export const PREFIJO_RESCATE = 'viajecor:rescate:';

/**
 * El estado de un primer arranque: la app abierta por primera vez en un
 * dispositivo.
 *
 * `monedas` viene vacío a propósito. Las cuatro precargadas (RN-04b) las define
 * `core/monedas.js` (T-008), y tenerlas también acá serían dos listas que se
 * desincronizan: la trampa de L-005 aplicada al código. Quien arme el estado
 * inicial le pasa la lista.
 */
export function estadoInicial({ monedas = [], versionApp } = {}) {
  return {
    esquema: ESQUEMA_ACTUAL,
    version_app: versionApp ?? globalThis.__VIAJECOR_VERSION__ ?? 'sin construir',
    movimientos: [],
    tipos_cambio: [],
    monedas: [...monedas],
    preferencias: { moneda_predeterminada: 'EUR' },
  };
}

function almacenPorDefecto() {
  if (typeof localStorage === 'undefined') {
    throw new Error(
      'No hay dónde guardar: este navegador no tiene localStorage disponible. ' +
      'Suele pasar en ventanas privadas de algunos navegadores.'
    );
  }
  return localStorage;
}

/**
 * Lee el estado guardado.
 *
 * **Nunca tira.** Que la app no abra porque un dato está raro es el peor
 * resultado posible: el usuario se queda sin ver ni siquiera lo que sí está
 * bien. Devuelve siempre algo usable, más un parte de qué pasó:
 *
 *   { estado, incidencias, primerArranque, rescate }
 *
 * `incidencias` es una lista de textos en castellano llano, pensados para
 * mostrarse. Si está vacía, lo guardado se leyó entero y sin pérdida.
 */
export function leerEstado(almacen = almacenPorDefecto()) {
  const incidencias = [];
  let crudo = null;

  try {
    crudo = almacen.getItem(CLAVE_DATOS);
  } catch (error) {
    // Safari en modo privado puede tirar hasta al LEER. La app tiene que abrir.
    incidencias.push(`No se pudo acceder al almacenamiento del navegador: ${error.message}`);
    return { estado: estadoInicial(), incidencias, primerArranque: false, rescate: null, soloLectura: false };
  }

  if (crudo === null || crudo === '') {
    return { estado: estadoInicial(), incidencias, primerArranque: true, rescate: null, soloLectura: false };
  }

  let leido;
  try {
    leido = JSON.parse(crudo);
  } catch {
    // Lo guardado no es ni JSON. No se entiende nada, así que no se toca: se
    // aparta con su fecha y se sigue. Un dato ilegible todavía se puede rescatar
    // a mano; uno sobrescrito, no.
    const rescate = preservar(almacen, crudo, incidencias);
    incidencias.push(
      'Lo que había guardado no se pudo leer y se apartó sin tocarlo. La app arranca vacía, ' +
      'pero tus datos anteriores no se borraron: seguí desde un respaldo exportado si tenés uno.'
    );
    return { estado: estadoInicial(), incidencias, primerArranque: false, rescate, soloLectura: false };
  }

  if (leido === null || typeof leido !== 'object' || Array.isArray(leido)) {
    const rescate = preservar(almacen, crudo, incidencias);
    incidencias.push('Lo guardado no tiene la forma de un juego de datos de Viajecor y se apartó sin tocarlo.');
    return { estado: estadoInicial(), incidencias, primerArranque: false, rescate, soloLectura: false };
  }

  // Datos escritos por una versión MÁS NUEVA de la app. Este código no sabe qué
  // significan, y guardar encima los destruiría. Se abre en blanco y se avisa;
  // el usuario abrirá la versión nueva, donde sus datos siguen intactos.
  if (Number.isInteger(leido.esquema) && leido.esquema > ESQUEMA_ACTUAL) {
    incidencias.push(
      `Estos datos los escribió una versión más nueva de Viajecor (esquema ${leido.esquema}, ` +
      `esta app entiende hasta el ${ESQUEMA_ACTUAL}). No se tocaron. Abrilos con la versión nueva.`
    );
    return { estado: estadoInicial(), incidencias, primerArranque: false, rescate: null, soloLectura: true };
  }

  const estado = migrarEstado(leido, incidencias);
  return { estado, incidencias, primerArranque: false, rescate: null, soloLectura: false };
}

/**
 * Lleva un estado guardado a la forma actual, campo por campo.
 *
 * Cada campo se valida por separado y lo que no se entiende se descarta CON
 * AVISO. La alternativa —tirar todo el estado porque tres movimientos de
 * quinientos están rotos— pierde 497 movimientos buenos; la otra alternativa
 * —descartarlos en silencio— es peor todavía, porque el total del mes cambia y
 * nadie se entera. Es la misma regla que el importador (T-032): informar fila
 * por fila qué no se pudo leer.
 */
export function migrarEstado(guardado, incidencias = []) {
  const estado = estadoInicial();

  if (!Number.isInteger(guardado.esquema)) {
    incidencias.push('Los datos no decían con qué versión del formato se guardaron; se leyeron como la actual.');
  }
  if (typeof guardado.version_app === 'string') {
    estado.version_app = guardado.version_app;
  }

  estado.movimientos = leerLista(guardado.movimientos, 'movimientos', incidencias, (mov) =>
    validarMovimiento(mov)
  );

  estado.tipos_cambio = leerLista(guardado.tipos_cambio, 'tipos de cambio', incidencias, (tc) => {
    if (tc === null || typeof tc !== 'object') throw new Error('no es un tipo de cambio');
    if (typeof tc.moneda !== 'string' || !/^[A-Za-z]{3}$/.test(tc.moneda.trim())) {
      throw new Error('la moneda no es un código de tres letras');
    }
    if (typeof tc.mes !== 'string' || !/^\d{4}-\d{2}$/.test(tc.mes)) {
      throw new Error('el mes no está escrito como AAAA-MM');
    }
    if (!Number.isFinite(tc.euros_por_unidad) || tc.euros_por_unidad <= 0) {
      throw new Error('el tipo de cambio no es un número mayor que cero');
    }
    return {
      moneda: tc.moneda.trim().toUpperCase(),
      mes: tc.mes,
      euros_por_unidad: tc.euros_por_unidad,
      creado: /^\d{4}-\d{2}-\d{2}$/.test(tc.creado) ? tc.creado : '1970-01-01',
    };
  });

  // Las monedas se guardan como vengan: quien manda sobre su forma es
  // core/monedas.js (T-008), y validarlas acá con una copia de sus reglas sería
  // tener dos jueces que tarde o temprano dicen cosas distintas.
  estado.monedas = Array.isArray(guardado.monedas) ? guardado.monedas : [];
  if (guardado.monedas !== undefined && !Array.isArray(guardado.monedas)) {
    incidencias.push('La lista de monedas guardada no era una lista y se ignoró.');
  }

  // ── Preferencias ───────────────────────────────────────────────────────────
  //
  // ⚠️ Cada preferencia se lee EXPLÍCITAMENTE, y la que no esté acá **se pierde
  // al recargar**, sin ningún error. Agregar una preferencia y olvidarse de esta
  // lista da el peor síntoma posible: funciona mientras la app está abierta y
  // desaparece al volver, que es justo cuando nadie está mirando. Pasó con
  // `ultimo_respaldo` en T-016. Ver L-015.
  //
  // Se leen una por una igual, en vez de copiar el objeto entero, porque un
  // respaldo editado a mano puede traer cualquier cosa ahí adentro.
  const preferencias = guardado.preferencias;
  if (preferencias !== null && typeof preferencias === 'object' && !Array.isArray(preferencias)) {
    const moneda = preferencias.moneda_predeterminada;
    if (typeof moneda === 'string' && /^[A-Za-z]{3}$/.test(moneda.trim())) {
      estado.preferencias.moneda_predeterminada = moneda.trim().toUpperCase();
    }

    // El día del último respaldo. Sin esto, la app no puede avisar "hace tres
    // semanas que no respaldás", que es la contramedida al riesgo más grave de
    // toda la arquitectura.
    // Se valida con validarFecha y no con una expresión regular: "2026-13-01"
    // tiene la forma correcta y no existe. Comprobar la forma no es comprobar la
    // fecha — es la misma trampa que RN-01 (L-005), acá aplicada a un ajuste.
    try {
      estado.preferencias.ultimo_respaldo = validarFecha(preferencias.ultimo_respaldo);
    } catch {
      // No había fecha de respaldo, o no era una fecha. Se sigue sin ella: la
      // app va a decir "nunca respaldaste", que es lo correcto si no se sabe.
    }

    // El día en que el usuario dijo "ahora no" al recordatorio de respaldo
    // (T-903). Sin esto, el aviso volvería a aparecer en cada recarga por más
    // que lo hubiera pospuesto, y un aviso que no se puede sacar deja de leerse.
    try {
      estado.preferencias.recordatorio_pospuesto = validarFecha(preferencias.recordatorio_pospuesto);
    } catch {
      // No se pospuso nunca, o el dato estaba roto: el aviso se muestra, que es
      // el lado seguro de equivocarse.
    }
  }

  return estado;
}

function leerLista(valor, nombre, incidencias, validar) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    incidencias.push(`La lista de ${nombre} guardada no era una lista y se ignoró.`);
    return [];
  }

  const buenos = [];
  const rotos = [];
  // Sin límite de cuántos elementos se recorren: un tope escrito a mano es
  // exactamente cómo el Excel original empezó a mentir (L-001).
  for (let i = 0; i < valor.length; i += 1) {
    try {
      buenos.push(validar(valor[i]));
    } catch (error) {
      rotos.push(`#${i + 1}: ${error.message}`);
    }
  }

  if (rotos.length > 0) {
    const cuantos = rotos.length === 1 ? 'Un registro' : `${rotos.length} registros`;
    incidencias.push(
      `${cuantos} de ${nombre} no se pudieron leer y quedaron afuera de los totales. ` +
      `Detalle — ${rotos.join(' · ')}`
    );
  }
  return buenos;
}

/**
 * Aparta un contenido ilegible bajo su propia clave, con la fecha, para que se
 * pueda rescatar a mano. Si ni siquiera esto se puede hacer, se avisa: es
 * preferible que el usuario sepa que hay algo en riesgo.
 */
function preservar(almacen, crudo, incidencias) {
  const clave = `${PREFIJO_RESCATE}${new Date().toISOString()}`;
  try {
    almacen.setItem(clave, crudo);
    return clave;
  } catch (error) {
    incidencias.push(
      `No se pudo apartar una copia de lo que no se entendió (${error.message}). ` +
      'No guardes nada nuevo hasta revisarlo, o se va a sobrescribir.'
    );
    return null;
  }
}

/**
 * Guarda el estado completo. Escribe una sola vez, con la cadena ya armada.
 *
 * **Tira si no pudo guardar**, a propósito. La tentación es atrapar el error y
 * seguir para que la app no se corte, pero eso deja al usuario cargando gastos
 * sobre un almacenamiento que no los está guardando: cada movimiento se ve en
 * pantalla y ninguno sobrevive a cerrar la app. Un error visible es mucho menos
 * grave que una tarde entera de datos perdidos.
 */
export function guardarEstado(estado, almacen = almacenPorDefecto()) {
  if (estado === null || typeof estado !== 'object') {
    throw new Error('No hay estado que guardar.');
  }

  const aGuardar = { ...estado, esquema: ESQUEMA_ACTUAL };
  let texto;
  try {
    texto = JSON.stringify(aGuardar);
  } catch (error) {
    throw new Error(`No se pudo preparar los datos para guardarlos: ${error.message}`);
  }

  try {
    almacen.setItem(CLAVE_DATOS, texto);
  } catch (error) {
    if (esCupoLleno(error)) {
      throw new Error(
        'No entra: el almacenamiento del navegador está lleno, así que este cambio NO se guardó. ' +
        'Exportá tus datos y liberá espacio antes de seguir cargando.'
      );
    }
    throw new Error(`No se pudo guardar: ${error.message}`);
  }

  return texto.length;
}

function esCupoLleno(error) {
  // Cada navegador lo llama distinto, y Safari usa un código propio.
  return (
    error?.name === 'QuotaExceededError' ||
    error?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error?.code === 22 ||
    error?.code === 1014
  );
}

/**
 * Borra los datos de Viajecor. Existe para el "importar reemplazando todo"
 * (T-017) y para que el usuario pueda empezar de cero a propósito.
 *
 * No toca las claves de rescate: son justamente lo que hay que conservar cuando
 * algo salió mal. Quien las quiera borrar tiene que hacerlo a mano.
 */
export function borrarEstado(almacen = almacenPorDefecto()) {
  almacen.removeItem(CLAVE_DATOS);
}

/** Las claves de rescate que haya, de la más nueva a la más vieja. */
export function listarRescates(almacen = almacenPorDefecto()) {
  const claves = [];
  for (let i = 0; i < almacen.length; i += 1) {
    const clave = almacen.key(i);
    if (typeof clave === 'string' && clave.startsWith(PREFIJO_RESCATE)) claves.push(clave);
  }
  return claves.sort().reverse();
}
