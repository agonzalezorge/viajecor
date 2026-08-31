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

import {
  validarMovimiento, validarFecha, nuevoId, rubrosIniciales, normalizarClave,
} from '../core/modelo.js';
import { personaDeLaPlanilla, tipoDeLaPlanilla } from '../core/ahorros.js';

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
    // Entre qué fechas fue cada viaje, por clave de etiqueta (T-023, T-941).
    // **No es un catálogo de viajes**: la lista de viajes sale de las etiquetas.
    // Es un dato suelto sobre uno de ellos, y el único que hay que guardar
    // porque no se puede deducir de los movimientos: un viaje puede empezar
    // antes del primer gasto anotado.
    fechas_de_viaje: [],
    // Los ahorros conjuntos (CU-14, T-040). Lista aparte de `movimientos` y no
    // un rubro más: un ahorro no entra en el saldo del mes ni se reparte por
    // rubro, y mezclarlo ensuciaría todos los totales que ya funcionan.
    ahorros: [],
    // El catálogo de rubros del usuario (T-048). Arranca con los de fábrica y
    // se edita desde Ajustes: crear, renombrar, unir. Vive en los datos y no en
    // el código por lo mismo que las monedas (T-008) — quien decide qué rubros
    // usa es quien anota los gastos, no quien escribió la app.
    rubros: rubrosIniciales(),
    preferencias: { moneda_predeterminada: 'EUR' },
  };
}

/**
 * El almacenamiento del navegador, o uno de mentira que dice la verdad.
 *
 * **Nunca tira al buscarlo**, y esa es toda la gracia. La primera versión hacía
 * `typeof localStorage === 'undefined'` y tiraba si no estaba. Parece defensivo
 * y no lo es: hay navegadores donde `localStorage` no falta sino que **tira con
 * solo nombrarlo** —una ventana privada con el almacenamiento bloqueado—, y ahí
 * `typeof` tira también. El error subía hasta `iniciar()` y la app quedaba **en
 * blanco**, sin una sola palabra.
 *
 * Lo encontró el recorrido en el navegador, bloqueando `localStorage` a
 * propósito. Era el escenario que el propio código decía manejar.
 *
 * Cuando no hay dónde guardar se devuelve un almacén que **se comporta como un
 * almacén vacío al leer y falla con un motivo entendible al escribir**. Así la
 * app abre, se puede usar, y `riesgoDeGuardado()` avisa que nada se está
 * guardando — en vez de una pantalla en blanco que no explica nada.
 */
function almacenPorDefecto() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    // Nombrarlo tiró: el navegador tiene el almacenamiento bloqueado.
  }
  return ALMACEN_DE_MENTIRA;
}

const ALMACEN_DE_MENTIRA = {
  length: 0,
  key: () => null,
  getItem: () => null,
  removeItem: () => {},
  setItem: () => {
    throw new Error(
      'No hay dónde guardar: este navegador no tiene almacenamiento disponible. ' +
      'Suele pasar en ventanas privadas o con el almacenamiento de sitios bloqueado.'
    );
  },
};

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

  // ⚠️ El catálogo de rubros se lee **antes** que los movimientos, y no es un
  // detalle de orden: `validarMovimiento` comprueba que el rubro exista, así
  // que con el catálogo de fábrica **todo movimiento de un rubro creado por el
  // usuario se descartaría al recargar**. Plata anotada que desaparece en
  // silencio, que es exactamente lo que esta app no hace. Ver T-048.
  estado.rubros = leerCatalogoDeRubros(guardado.rubros, incidencias);

  estado.movimientos = leerLista(guardado.movimientos, 'movimientos', incidencias, (mov) =>
    validarMovimiento(mov, estado.rubros)
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
  // Las fechas de cada viaje. Un registro roto se descarta solo, sin llevarse a
  // los demás: perder cuándo fue un viaje es molesto; perder los otros veinte
  // por culpa de ese, no.
  estado.fechas_de_viaje = leerLista(guardado.fechas_de_viaje, 'fechas de viaje', incidencias, (v) => {
    if (v === null || typeof v !== 'object') throw new Error('no es un viaje');
    if (typeof v.clave !== 'string' || v.clave.trim() === '') {
      throw new Error('no dice de qué viaje son las fechas');
    }
    // Con `validarFecha` y no con una expresión regular: un 31 de abril tiene la
    // forma correcta y no existe (L-005).
    const desde = validarFecha(v.desde);
    const hasta = validarFecha(v.hasta);
    if (hasta < desde) throw new Error('el viaje termina antes de empezar');
    return { clave: v.clave.trim().toLowerCase(), desde, hasta };
  });

  // Los ahorros conjuntos. Un registro roto se descarta solo, como las fechas
  // de viaje: perder un movimiento de ahorro es molesto; perder los otros
  // sesenta por culpa de ese, no.
  estado.ahorros = leerLista(guardado.ahorros, 'ahorros', incidencias, (a) => {
    if (a === null || typeof a !== 'object') throw new Error('no es un movimiento de ahorro');
    if (personaDeLaPlanilla(a.persona) === null) throw new Error('no dice de quién es');
    if (tipoDeLaPlanilla(a.tipo) === null) throw new Error('no dice si la plata entró o salió');
    if (!Number.isInteger(a.monto) || a.monto === 0) throw new Error('el monto no es un entero distinto de cero');
    if (typeof a.moneda !== 'string' || !/^[A-Za-z]{3}$/.test(a.moneda.trim())) {
      throw new Error('la moneda no es un código de tres letras');
    }
    const fecha = validarFecha(a.fecha);
    return {
      id: typeof a.id === 'string' && a.id !== '' ? a.id : nuevoId('aho'),
      fecha,
      persona: personaDeLaPlanilla(a.persona),
      tipo: tipoDeLaPlanilla(a.tipo),
      monto: a.monto,
      moneda: a.moneda.trim().toUpperCase(),
      comentario: typeof a.comentario === 'string' ? a.comentario : '',
      detalle: typeof a.detalle === 'string' ? a.detalle : '',
      creado: /^\d{4}-\d{2}-\d{2}$/.test(a.creado) ? a.creado : fecha,
    };
  });

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
    // Que compartir no funciona en este teléfono (T-914). Sin esto, el botón
    // que ya falló una vez volvería a ofrecerse en cada recarga y volvería a
    // fallar igual.
    // En qué mitad de la app estaba (T-046). Sin esto, quien está poniendo al
    // día los ahorros vuelve a caer en los gastos cada vez que abre.
    if (preferencias.perfil === 'ahorros' || preferencias.perfil === 'cotidiana') {
      estado.preferencias.perfil = preferencias.perfil;
    }

    if (preferencias.compartir_no_funciona === true) {
      estado.preferencias.compartir_no_funciona = true;
    }

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

// ── ¿Este navegador puede guardar? — T-950 ───────────────────────────────────
//
// El 2026-08-27, el usuario abrió la app en su Android desde la app Archivos,
// cargó cuatro movimientos, cerró Chrome y **perdió todo**.
//
// Android no le pasa al navegador la ubicación del archivo: le pasa un permiso
// temporal de lectura, y la dirección queda como `content://…`. Para el
// navegador eso no es un sitio, es contenido anónimo sin identidad estable. Como
// el almacenamiento se guarda **por sitio**, no hay dónde guardar: deja escribir
// mientras la pestaña vive y lo tira al cerrar.
//
// Lo grave no fue que no se pudiera guardar. Fue que **la app no lo dijo**:
// aceptó los movimientos, los mostró, dijo "guardado", y los perdió. Toda la app
// se apoya en que los datos son del usuario y están en su dispositivo; aceptar
// datos que no se van a guardar rompe esa promesa justo cuando ya confió.
//
// **Por qué no alcanza con probar a escribir.** `localStorage.setItem()`
// funciona igual en `content://`: devuelve bien, se puede leer de vuelta, y todo
// parece correcto. El problema aparece al cerrar, cuando ya es tarde. Lo que
// determina si hay dónde guardar no es si la escritura anda: es si la dirección
// tiene identidad. Por eso se mira el esquema.

/** Direcciones desde las que el navegador SÍ le da un lugar propio a la app. */
const ESQUEMAS_CON_IDENTIDAD = ['file:', 'http:', 'https:'];

export const SIN_ALMACENAMIENTO = 'sin-almacenamiento';
export const SIN_IDENTIDAD = 'sin-identidad';

/**
 * ¿Corre peligro lo que el usuario cargue? Devuelve `null` si está todo bien.
 *
 * Es una función pura: recibe el esquema de la dirección y el almacén, no los
 * busca en el navegador (`core/` y `datos/` no lo tocan). Así se puede probar
 * el caso `content://` sin un teléfono Android.
 */
export function riesgoDeGuardado(protocolo, almacen) {
  // El almacén se resuelve igual que en `leerEstado`. La primera versión lo
  // recibía tal cual, y como `iniciar(document)` no lo pasa, llegaba
  // `undefined` y la app le avisaba a TODO el mundo que no estaba guardando
  // nada. Lo encontró el recorrido en el navegador, no los tests, porque los
  // tests siempre le pasaban un almacén.
  //
  // Es la peor forma de fallar para este aviso en particular: gritar en falso
  // enseña a ignorarlo, y el día que sea cierto nadie lo va a leer.
  //
  // No se usa `almacenPorDefecto()`, que **tira** cuando no hay `localStorage`:
  // tirar en la función cuya única tarea es detectar que no hay dónde guardar
  // sería dejar la app en blanco justo cuando tiene algo importante que decir.
  const elAlmacen = almacen === undefined ? almacenPorDefecto() : almacen;
  // Primero lo más terminante: que no haya almacén en absoluto (navegación
  // privada en algunos navegadores, o almacenamiento bloqueado por el usuario).
  if (!puedeEscribir(elAlmacen)) {
    return {
      motivo: SIN_ALMACENAMIENTO,
      titulo: 'Este navegador no está guardando nada',
      explicacion:
        'Todo lo que cargues va a desaparecer al cerrar la pestaña. Puede ser una ventana ' +
        'de incógnito, o que el navegador tenga bloqueado el almacenamiento de sitios.',
      queHacer:
        'Abrí la app en una ventana normal, o permitile a este sitio guardar datos. ' +
        'Mientras tanto, no cargues nada que no quieras volver a escribir.',
    };
  }

  if (!ESQUEMAS_CON_IDENTIDAD.includes(protocolo)) {
    return {
      motivo: SIN_IDENTIDAD,
      titulo: 'Así abierta, la app va a perder tus datos al cerrar',
      explicacion:
        'Abriste el archivo desde el explorador de archivos, y tu teléfono se lo pasó al ' +
        'navegador sin decirle de dónde salió. El navegador guarda los datos por sitio, y ' +
        'así no hay ningún sitio al que asociarlos: podés cargar gastos y los vas a ver, ' +
        'pero desaparecen al cerrar el navegador.',
      queHacer:
        'Abrí la app escribiendo su dirección a mano en el navegador, empezando con ' +
        '"file:///" y la ruta del archivo — por ejemplo file:///sdcard/Download/viajecor.html — ' +
        'y guardala como marcador para entrar siempre por ahí.',
    };
  }

  return null;
}

/** Prueba de verdad si se puede escribir, sin dejar rastro. */
function puedeEscribir(almacen) {
  if (!almacen || typeof almacen.setItem !== 'function') return false;
  const clave = `${PREFIJO_RESCATE}prueba`;
  try {
    almacen.setItem(clave, '1');
    const volvio = almacen.getItem(clave) === '1';
    almacen.removeItem(clave);
    return volvio;
  } catch {
    return false;
  }
}


/**
 * Lee el catálogo de rubros guardado — T-048.
 *
 * **Nunca deja al usuario sin rubros.** Un catálogo vacío o roto haría que no se
 * pueda cargar ni leer un solo movimiento: ahí se vuelve al de fábrica y se
 * dice, que es mucho mejor que una app que no deja hacer nada.
 *
 * Los rubros se guardan normalizados y sin repetidos, por lo mismo que todo lo
 * que agrupa (RN-03): dos entradas que solo se diferencian en una mayúscula
 * partirían los totales de ese rubro en dos.
 */
export function leerCatalogoDeRubros(guardado, incidencias = []) {
  const inicial = rubrosIniciales();
  if (guardado === undefined || guardado === null) return inicial;

  if (typeof guardado !== 'object' || Array.isArray(guardado)) {
    incidencias.push('La lista de rubros guardada no se entendió; se usaron los de siempre.');
    return inicial;
  }

  const limpiar = (lista, deFabrica, cual) => {
    if (!Array.isArray(lista)) return [...deFabrica];

    const vistos = [];
    for (const rubro of lista) {
      if (typeof rubro !== 'string') continue;
      const clave = normalizarClave(rubro);
      if (clave !== '' && !vistos.includes(clave)) vistos.push(clave);
    }

    if (vistos.length === 0) {
      incidencias.push(`No quedaba ningún rubro de ${cual}; se usaron los de siempre.`);
      return [...deFabrica];
    }
    return vistos;
  };

  return {
    gasto: limpiar(guardado.gasto, inicial.gasto, 'gasto'),
    ingreso: limpiar(guardado.ingreso, inicial.ingreso, 'ingreso'),
  };
}
