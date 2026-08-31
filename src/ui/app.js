// El armazón de la interfaz: encabezado, navegación entre pantallas y el hueco
// donde cada pantalla dibuja lo suyo.
//
// Está partido en dos capas a propósito:
//
//   1. Funciones que reciben datos y devuelven TEXTO HTML. Son puras: no tocan
//      el navegador, así que se pueden testear con node --test sin inventar un
//      DOM falso. Es donde vive casi toda la lógica de qué se muestra.
//   2. `iniciar()`, que es la única que toca el documento y engancha los clics.
//
// La frontera importa: un error de "qué se muestra" se puede cazar con un test;
// uno de "cómo se engancha un clic" solo se ve abriendo la app. Cuanto más de lo
// primero y menos de lo segundo, más barato es equivocarse.

import { hoy, mesDe, mesAnterior, mesSiguiente, TIPO_GASTO } from '../core/modelo.js';
import { formatearMes } from '../core/formato.js';
import { leerEstado, guardarEstado, riesgoDeGuardado } from '../datos/almacenamiento.js';
import { monedasIniciales } from '../core/monedas.js';
import { dibujarNuevo, borradorNuevo, borradorDesde, intentarGuardar, fechaEnPalabras,
  dibujarSugerencias, usadosDe } from './pantallas/movimiento.js';
import { claseDeRubro, COLORES } from './colores.js';
import { decimalesDe } from '../core/monedas.js';
import { dibujarCambios, intentarGuardarCambio, dibujarAvisoCorreccion, efectoDeCorregir } from './pantallas/cambio.js';
import { dibujarResumen } from './pantallas/resumen.js';
import { dibujarEvolucion } from './pantallas/evolucion.js';
import { dibujarEtiquetas, dibujarAvisoRenombrar, intentarRenombrar,
  intentarBorrarEtiqueta } from './pantallas/etiquetas.js';
import { efectoDeRenombrar } from '../core/etiquetas.js';
import { conectarSeries } from './series-interaccion.js';
import { dibujarAjustes } from './pantallas/ajustes.js';
import { dibujarRubros } from './pantallas/rubros.js';
import { crearRubro, renombrarRubro, unirRubros, borrarRubro } from '../core/rubros.js';
import { dibujarAhorros } from './pantallas/ahorros.js';
import {
  dibujarNuevoAhorro, borradorDeAhorro, borradorDesdeAhorro, intentarGuardarAhorro,
  borrarAhorro, restaurarAhorro, buscarAhorro,
} from './pantallas/ahorro.js';
import { dibujarViajes, intentarFijarFechas, intentarBorrarFechas,
  dibujarDuracion } from './pantallas/viajes.js';
import { dibujarGrupos } from './pantallas/grupos.js';
import { dibujarMonedas, dibujarAvisoDecimales, efectoDeCambiarDecimales,
  intentarAgregarMoneda, intentarOcultarMoneda, intentarMostrarMoneda,
  intentarBorrarMoneda, intentarCambiarDecimales } from './pantallas/monedas.js';
import { dibujarLista, dibujarResultados, borrarMovimiento, restaurarMovimiento,
  buscarMovimiento } from './pantallas/lista.js';
import { dibujarDatos } from './pantallas/datos.js';
import { prepararRespaldo, anotarRespaldo } from '../datos/exportar.js';
import { leerRespaldo, previsualizar, aplicarImportacion } from '../datos/importar.js';
import { compartirRespaldo, sePuedeCompartir, archivoDelRespaldo } from './compartir.js';
import { estadoDelRecordatorio, posponerRecordatorio } from '../datos/recordatorio.js';
import { registrarServicio, pedirPersistencia } from '../datos/instalacion.js';
import { crearPlanilla } from '../datos/xlsx.js';
import { leerPlanilla } from '../datos/planilla.js';
import { interpretarPlanilla } from '../datos/importar-planilla.js';
import { interpretarAhorros, HOJA_DE_AHORROS } from '../datos/importar-ahorros.js';
import { prepararCsv } from '../datos/csv.js';

/**
 * La versión la inyecta tools/build.mjs al construir, leyéndola del archivo
 * VERSION. Fuera del archivo construido (por ejemplo en los tests) no hay
 * versión publicada, y decirlo es más honesto que inventar un número.
 */
export function versionApp() {
  return globalThis.__VIAJECOR_VERSION__ || 'sin construir';
}

/**
 * Escapa un texto para meterlo en HTML.
 *
 * No es una precaución teórica: el comentario y el detalle de un movimiento son
 * texto libre que escribe el usuario, y alcanza con un `<` para romper la
 * página. Todo lo que venga de los datos pasa por acá antes de entrar en una
 * plantilla; lo que no pase, es un error.
 */
export function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Las pantallas ────────────────────────────────────────────────────────────
//
// Cada pantalla se registra acá con su nombre, su etiqueta en la barra de abajo
// y una función que dibuja su contenido.
//
// Hasta el 2026-08-28 había además un `marcador()`: una pantalla de mentira que
// decía "todavía no está construida — T-0XX". Se fue con T-024, cuando dejó de
// haber pantallas sin construir. Si vuelve a hacer falta, está en el historial;
// lo que no se deja es una función que no llama nadie.

// ── Los perfiles ─────────────────────────────────────────────────────────────
//
// La app hace dos cosas que casi no se tocan entre sí:
//
//   - **Vida cotidiana**: los gastos e ingresos del mes, con sus rubros, sus
//     viajes y sus historiales. Todo en euros, todo con un mes de por medio.
//   - **Ahorros conjuntos**: la plata guardada de dos personas en tres monedas
//     que **no se convierten entre sí**, sin mes y sin rubros.
//
// Mezclarlas en una sola barra de abajo tiene un costo que se paga todos los
// días: cinco pestañas de las que dos no sirven para lo que estás haciendo. El
// selector de arriba cambia **de qué app estamos hablando**, y la barra pasa a
// mostrar solo lo de ese perfil.
//
// Lo pidió el usuario (2026-08-31) después de ver algo parecido en otra app.
// La decisión de fondo ya estaba tomada desde CU-14 —los ahorros son un
// registro aparte, no un rubro más—; esto la hace visible.

export const PERFIL_COTIDIANA = 'cotidiana';
export const PERFIL_AHORROS = 'ahorros';

export const PERFILES = Object.freeze([
  { clave: PERFIL_COTIDIANA, etiqueta: 'Vida cotidiana', inicio: 'mes' },
  { clave: PERFIL_AHORROS, etiqueta: 'Ahorros conjuntos', inicio: 'ahorros' },
]);

/** El perfil al que pertenece una pantalla. `ambos` la deja en los dos. */
export function perfilDe(definicion) {
  return definicion?.perfil ?? PERFIL_COTIDIANA;
}

/** ¿Esta pantalla se ve estando en este perfil? */
export function esDelPerfil(definicion, perfil) {
  const suyo = perfilDe(definicion);
  return suyo === 'ambos' || suyo === perfil;
}

const PANTALLAS = new Map();

export function registrarPantalla(nombre, definicion) {
  PANTALLAS.set(nombre, { nombre, ...definicion });
  return PANTALLAS.get(nombre);
}

export function pantallasRegistradas() {
  return [...PANTALLAS.values()];
}

export function pantalla(nombre) {
  return PANTALLAS.get(nombre) ?? null;
}

registrarPantalla('mes', {
  etiqueta: 'Mes',
  orden: 2,
  icono: '◧',
  conMes: true,
  dibujar: dibujarResumen,
});

registrarPantalla('movimientos', {
  etiqueta: 'Movimientos',
  orden: 3,
  icono: '≡',
  conMes: true,
  dibujar: dibujarLista,
});

// Los datos son de TODA la app —el respaldo lleva las dos mitades, y la
// planilla trae las dos hojas—, así que la pestaña está en los dos perfiles.
registrarPantalla('datos', {
  perfil: 'ambos',
  etiqueta: 'Datos',
  orden: 4,
  icono: '↧',
  conMes: false,
  dibujar: dibujarDatos,
});

// Fuera de la barra de abajo, y a propósito. Se llega desde el resumen del mes,
// que es donde nace la pregunta ("gasté 620 en gastos fijos… ¿es mucho?"). Una
// quinta pestaña dejaría a "Movimientos" sin lugar para su etiqueta en un
// teléfono de 390 px, y la evolución no es algo que se mire todos los días.
registrarPantalla('evolucion', {
  etiqueta: 'Evolución mes a mes',
  icono: '↗',
  conMes: false,
  enBarra: false,
  dibujar: dibujarEvolucion,
});

// Fuera de la barra, como monedas y cambios: se llega desde Datos. No es algo
// que se haga todos los días, es algo que se hace cuando un total no cuadra.
registrarPantalla('grupos', {
  etiqueta: 'Otros grupos de gastos',
  icono: '◇',
  conMes: false,
  enBarra: false,
  dibujar: dibujarGrupos,
});

registrarPantalla('ahorros', {
  etiqueta: 'Ahorros',
  orden: 2,
  icono: '◈',
  conMes: false,
  perfil: PERFIL_AHORROS,
  dibujar: dibujarAhorros,
});

registrarPantalla('nuevo-ahorro', {
  etiqueta: 'Cargar',
  orden: 1,
  icono: '+',
  conMes: false,
  destacada: true,
  perfil: PERFIL_AHORROS,
  dibujar: dibujarNuevoAhorro,
});

registrarPantalla('viajes', {
  etiqueta: 'Gasto por viaje',
  icono: '✈',
  conMes: false,
  enBarra: false,
  dibujar: dibujarViajes,
});

registrarPantalla('etiquetas', {
  etiqueta: 'Etiquetas y detalles',
  icono: '🏷',
  conMes: false,
  enBarra: false,
  dibujar: dibujarEtiquetas,
});

registrarPantalla('monedas', {
  etiqueta: 'Monedas',
  icono: '¤',
  conMes: false,
  enBarra: false,
  dibujar: dibujarMonedas,
});

registrarPantalla('cambios', {
  etiqueta: 'Tipos de cambio',
  icono: '⇄',
  conMes: false,
  enBarra: false,
  dibujar: dibujarCambios,
});

// Primera de la barra, por pedido del usuario (2026-08-27): cargar un gasto es
// lo que más se hace y lo que se hace apurado, parado en la caja del
// supermercado. `destacada` es lo que le da el aspecto distinto que ya tenía.
// La quinta pestaña, pedida por el usuario (2026-08-31). Va última: es lo que
// menos se toca, y en una barra el pulgar llega antes a lo de la izquierda.
registrarPantalla('rubros', {
  etiqueta: 'Rubros',
  icono: '◑',
  conMes: false,
  enBarra: false,
  dibujar: dibujarRubros,
});

registrarPantalla('ajustes', {
  etiqueta: 'Ajustes',
  orden: 5,
  icono: '⚙',
  conMes: false,
  perfil: 'ambos',
  dibujar: dibujarAjustes,
});

registrarPantalla('nuevo', {
  etiqueta: 'Cargar',
  orden: 1,
  icono: '+',
  conMes: false,
  destacada: true,
  dibujar: dibujarNuevo,
});

// ── Piezas de la pantalla ────────────────────────────────────────────────────

/**
 * El encabezado. Muestra el mes que se está mirando con flechas para moverse,
 * porque "¿cómo viene el mes?" es la pregunta que la app viene a responder y
 * tener que buscar dónde cambiarlo sería absurdo.
 *
 * En las pantallas que no son de un mes (los datos, las monedas) el selector no
 * se dibuja: un control que no hace nada enseña a desconfiar de los controles.
 */
export function dibujarEncabezado({ mes, conMes, perfil = PERFIL_COTIDIANA }) {
  const selector = conMes
    ? `
      <nav class="mes" aria-label="Mes que se está viendo">
        <button type="button" class="flecha" data-accion="mes-anterior" aria-label="Mes anterior">‹</button>
        <span class="mes-nombre" data-mes="${escapar(mes)}">${escapar(formatearMes(mes))}</span>
        <button type="button" class="flecha" data-accion="mes-siguiente" aria-label="Mes siguiente">›</button>
      </nav>`
    : '';

  return `
    <header class="encabezado">
      <h1>Viajecor</h1>
      <span class="version">v${escapar(versionApp())}</span>
    </header>
    ${dibujarPerfiles(perfil)}
    ${selector}
  `;
}

/**
 * El selector de perfil, arriba del todo.
 *
 * **Dos botones a la vista y no un desplegable.** Un desplegable esconde que
 * existe la otra mitad de la app: hay que saber que está para ir a buscarla.
 * Con dos, la primera vez que alguien abre la app **ve que hay dos cosas**, y
 * cambiar es un toque en vez de tres.
 *
 * Si algún día hubiera cuatro perfiles, esto tendría que ser un desplegable —
 * cuatro botones no entran a lo ancho de un teléfono—. Con dos, no.
 */
export function dibujarPerfiles(perfil = PERFIL_COTIDIANA) {
  const botones = PERFILES.map((p) => {
    const activo = p.clave === perfil;
    return `
      <button type="button" class="opcion-perfil${activo ? ' activa' : ''}"
              data-accion="perfil" data-perfil="${escapar(p.clave)}"
              aria-pressed="${activo}">${escapar(p.etiqueta)}</button>`;
  }).join('');

  return `<nav class="perfiles" aria-label="Qué parte de la app">${botones}</nav>`;
}

/**
 * La barra de navegación, abajo y no arriba: en un celular sostenido con una
 * mano, la parte de arriba de la pantalla es donde el pulgar no llega.
 */
export function dibujarNavegacion(actual, perfil = PERFIL_COTIDIANA) {
  // El orden lo decide el campo `orden` de cada pantalla, no el orden en que se
  // registraron: registrar depende de los `import`, y hacer que mover una
  // pestaña dependa de reordenar imports es una trampa esperando.
  //
  // "Cargar" estaba escrito dos veces —registrado acá y dibujado a mano al final
  // de la barra—, así que cambiar su etiqueta o su ícono había que hacerlo en
  // dos lugares. Ahora sale del registro como todas.
  const botones = pantallasRegistradas()
    .filter((p) => p.enBarra !== false && esDelPerfil(p, perfil))
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99))
    .map((p) => {
      const seleccionada = p.nombre === actual;
      return `
        <button type="button" class="pestania${p.destacada ? ' nueva' : ''}${seleccionada ? ' activa' : ''}"
                data-accion="ir" data-pantalla="${escapar(p.nombre)}"
                ${seleccionada ? 'aria-current="page"' : ''}>
          <span class="icono" aria-hidden="true">${escapar(p.icono)}</span>
          <span>${escapar(p.etiqueta)}</span>
        </button>`;
    })
    .join('');

  return `
    <nav class="navegacion" aria-label="Secciones">
      ${botones}
    </nav>
  `;
}

/**
 * Los avisos que devuelve el almacenamiento al leer (T-004): datos que no se
 * pudieron interpretar, registros descartados, espacio agotado.
 *
 * Se muestran arriba de todo y no se pueden cerrar de un toque distraído: son
 * exactamente la información que el usuario necesita para no perder datos, y
 * `almacenamiento.js` se toma el trabajo de producirla. Tragárnosla acá haría
 * inútil todo ese cuidado.
 */
export function dibujarAvisos(incidencias = []) {
  if (incidencias.length === 0) return '';
  const items = incidencias.map((texto) => `<li>${escapar(texto)}</li>`).join('');
  const titulo = incidencias.length === 1 ? 'Hay algo que tenés que saber' : 'Hay cosas que tenés que saber';

  return `
    <section class="aviso importante" role="alert">
      <h2>${titulo}</h2>
      <ul>${items}</ul>
    </section>
  `;
}

/**
 * El aviso de que el navegador no puede guardar — T-950.
 *
 * Va **arriba de todo, en todas las pantallas, y no se puede sacar**. No es una
 * excepción a la regla de que un aviso que no se puede cerrar molesta: es el
 * único caso donde molestar es lo correcto, porque lo que anuncia es que todo lo
 * que el usuario escriba se va a perder. Un aviso que se puede posponer es un
 * aviso que se va a posponer.
 *
 * Y dice **qué hacer**, no solo qué está mal. "Tus datos corren peligro" sin una
 * salida es angustia sin utilidad.
 */
export function dibujarRiesgoDeGuardado(riesgo) {
  if (!riesgo) return '';

  return `
    <section class="aviso peligro-datos" role="alert">
      <h2>${escapar(riesgo.titulo)}</h2>
      <p>${escapar(riesgo.explicacion)}</p>
      <p><strong>Qué hacer:</strong> ${escapar(riesgo.queHacer)}</p>
    </section>
  `;
}

/**
 * El recordatorio de respaldo — T-903.
 *
 * Aparece en la pantalla donde el usuario está, no solo en Datos, donde entra el
 * que ya se acordó. Es la contramedida al riesgo más grave de la arquitectura:
 * los datos viven en un solo navegador.
 *
 * **Dice cuántos movimientos, no solo cuántos días.** "Hace 9 días que no
 * respaldás" es un reproche; "23 movimientos existen en un solo lugar" es lo que
 * se pierde. El número concreto es el que hace que valga la pena tocar el botón.
 */
export function dibujarRecordatorio(vista, { fecha } = {}) {
  // En Datos no: ahí ya está toda la información y los dos botones de verdad.
  // Repetirlo sería ruido justo donde el usuario ya está haciendo lo correcto.
  if (vista.pantalla === 'datos') return '';

  const { haceFalta, cuantos, desde } = estadoDelRecordatorio(vista.estado, fecha ? { fecha } : {});
  if (!haceFalta) return '';

  // Siempre en días, también cuando nunca hubo un respaldo (pedido del usuario,
  // 2026-08-27). "Nunca respaldaste" es una etiqueta sobre la persona; "hace 12
  // días" es un dato que se puede comparar con el de mañana. Los días se cuentan
  // desde el movimiento más viejo cuando no hay respaldo previo, así que el
  // número significa lo mismo en los dos casos: hace cuánto que hay datos
  // expuestos.
  const cuando = `Hace ${desde} días que no respaldás.`;
  // La frase se arma entera acá y no dentro de la plantilla: partida en varias
  // líneas del HTML, los saltos quedan en el medio de las palabras y ningún test
  // que lea la frase completa la reconoce (fue exactamente lo que pasó).
  const queSePierde = cuantos === 1
    ? '1 movimiento tuyo existe en un solo lugar: si se borran los datos de este navegador, se pierde.'
    : `${cuantos} movimientos tuyos existen en un solo lugar: si se borran los datos de este navegador, se pierden.`;

  return `
    <section class="aviso recordatorio" role="status">
      <p><strong>${escapar(cuando)}</strong> ${escapar(queSePierde)}</p>
      <div class="acciones-recordatorio">
        <button type="button" class="principal" data-accion="ir" data-pantalla="datos">
          Respaldar ahora
        </button>
        <button type="button" class="secundario" data-accion="posponer-recordatorio">
          Ahora no
        </button>
      </div>
    </section>
  `;
}

/** La app entera, como texto. Es la función que los tests miran. */
export function dibujarApp(vista) {
  const perfil = vista.perfil ?? PERFIL_COTIDIANA;
  const pedida = pantalla(vista.pantalla);

  // Una pantalla que no es de este perfil no se dibuja: se cae a la de inicio
  // del perfil. Pasa con un enlace viejo o con el perfil recordado de la visita
  // anterior, y mostrarla igual dejaría la barra de abajo señalando otra cosa.
  const definicion = pedida && esDelPerfil(pedida, perfil)
    ? pedida
    : pantalla(PERFILES.find((p) => p.clave === perfil)?.inicio ?? 'mes');
  const contenido = definicion.dibujar(vista);

  return `
    ${dibujarEncabezado({ mes: vista.mes, conMes: definicion.conMes, perfil: vista.perfil })}
    ${dibujarRiesgoDeGuardado(vista.riesgoDeGuardado)}
    ${dibujarAvisos(vista.incidencias)}
    ${dibujarRecordatorio(vista)}
    <main class="contenido">${contenido}</main>
    ${dibujarNavegacion(definicion.nombre, vista.perfil)}
  `;
}

// ── El estado de la vista ────────────────────────────────────────────────────

/**
 * Qué se está mirando: la pantalla, el mes y los datos. Es lo único mutable de
 * la interfaz, y vive en un solo lugar para que "por qué se ve esto" tenga una
 * sola respuesta posible.
 */
export function vistaInicial({ estado, incidencias = [], mes, puedeCompartir = false, riesgoDeGuardado = null } = {}) {
  return {
    pantalla: 'mes',
    // El perfil elegido se recuerda entre visitas: quien está poniendo al día
    // los ahorros de un mes abre la app tres veces seguidas para eso mismo.
    perfil: estado?.preferencias?.perfil === PERFIL_AHORROS ? PERFIL_AHORROS : PERFIL_COTIDIANA,
    mes: mes ?? mesDe(hoy()),
    estado,
    incidencias,
    // Datos del entorno, no del usuario: se preguntan una vez al arrancar y
    // viajan en la vista para que las funciones que dibujan no miren el
    // navegador.
    puedeCompartir,
    riesgoDeGuardado,
  };
}

/** Mueve el mes visible. Devuelve una vista nueva, sin tocar la que recibe. */
export function moverMes(vista, direccion) {
  const mes = direccion === 'anterior' ? mesAnterior(vista.mes) : mesSiguiente(vista.mes);
  return { ...vista, mes };
}

/**
 * Cambia de perfil y aterriza en su pantalla de inicio.
 *
 * Guarda la elección en las preferencias, con la misma lógica que la moneda
 * predeterminada: es una preferencia de uso, no un dato del usuario.
 */
export function irAlPerfil(vista, clave) {
  const perfil = PERFILES.find((p) => p.clave === clave);
  if (!perfil || perfil.clave === vista.perfil) return vista;

  return {
    ...irA(vista, perfil.inicio),
    perfil: perfil.clave,
    estado: {
      ...vista.estado,
      preferencias: { ...vista.estado?.preferencias, perfil: perfil.clave },
    },
  };
}

export function irA(vista, nombre) {
  if (!pantalla(nombre)) return vista;

  // El aviso de "guardado" y el error de validación son de un momento, no del
  // estado: si sobrevivieran a cambiar de pantalla, alguien volvería a la carga
  // media hora después y vería un error que ya no significa nada.
  //
  // **El filtro de la lista es de un momento por el mismo motivo** (T-026), y
  // peor: una lista filtrada a la que se vuelve media hora después no se lee
  // como filtrada, se lee como datos que faltan. Se llega a la lista filtrada
  // tocando un total; se llega a la lista entera tocando la pestaña.
  const limpia = {
    ...vista, pantalla: nombre, aviso: null, error: null, borrando: null, borrado: null,
    filtro: null, busqueda: '',
    avisoRespaldo: null, mostrarRespaldo: false,
    importacion: null, errorImportar: null, avisoImportar: null,
    errorPlanilla: null, avisoPlanilla: null,
    planilla: null, errorPlanillaVieja: null, avisoPlanillaVieja: null,
  };
  return nombre === 'nuevo'
    ? { ...limpia, borrador: vista.borrador ?? borradorNuevo({ estado: vista.estado }) }
    : limpia;
}

// ── Lo único que toca el navegador ───────────────────────────────────────────

/**
 * Arranca la app dentro de un documento.
 *
 * El primer arranque necesita que alguien junte las piezas: el estado vacío lo
 * da `almacenamiento.js` y la lista de monedas la da `monedas.js`, a propósito
 * separados (dos listas de monedas se desincronizan). Acá se juntan, que es el
 * único lugar donde tiene sentido.
 */
/**
 * Cuelga el manifiesto de la app publicada — T-950.
 *
 * **No está escrito en el HTML** y es a propósito: el archivo que se baja es UNO
 * y no tiene al lado ningún `manifest.webmanifest` que buscar. Pedirlo desde
 * `file://` sería un error en la consola en el caso más usado, y además dejaría
 * en el HTML una dirección que la guardia de privacidad tendría que revisar.
 *
 * Así, el archivo bajado y el publicado siguen siendo el MISMO archivo, byte a
 * byte, y lo que cambia es lo que la app hace al arrancar según dónde esté.
 */
export function enlazarManifiesto(documento, protocolo) {
  if (protocolo !== 'http:' && protocolo !== 'https:') return false;
  if (documento.querySelector('link[rel="manifest"]')) return false;

  const enlace = documento.createElement('link');
  enlace.rel = 'manifest';
  enlace.href = '/manifest.webmanifest';
  documento.head.appendChild(enlace);
  return true;
}

export function iniciar(documento, almacen) {
  const lectura = leerEstado(almacen);
  let estado = lectura.estado;

  if (lectura.primerArranque) {
    estado = { ...estado, monedas: monedasIniciales() };
    // No se guarda todavía: escribir en el primer arranque, antes de que el
    // usuario cargue nada, es la forma más fácil de pisar algo que estaba y no
    // se entendió (ADR-015). Se guardará con el primer movimiento.
  }

  // ¿Este teléfono sabe compartir archivos? Se pregunta UNA vez, al arrancar, y
  // el resto de la app trabaja con la respuesta. Preguntar en cada dibujado
  // haría que las funciones que dibujan miren el navegador, que es justo lo que
  // ADR-022 saca del medio para poder probarlas.
  const puedeCompartir = sePuedeCompartir(
    documento.defaultView?.navigator,
    // Un archivo de mentira, del mismo tipo que el respaldo: `canShare` decide
    // por el tipo, no por el contenido, y armar el respaldo de verdad para
    // preguntar sería trabajo tirado en cada arranque.
    documento.defaultView?.File
      ? archivoDelRespaldo(
          { contenido: '{}', nombre: 'viajecor.json', tipo: 'application/json' },
          documento.defaultView.File
        )
      : null
  );

  // Se pregunta ANTES de dibujar nada: el usuario tiene que enterarse de que sus
  // datos no se van a guardar antes de cargar el primero, no después.
  const protocolo = documento.defaultView?.location?.protocol ?? '';
  const riesgo = riesgoDeGuardado(protocolo, almacen);

  // Lo que hace que la app publicada se comporte como una app — T-950.
  //
  // Nada de esto es necesario para que ande, y nada de esto tira: en el archivo
  // bajado no se hace, y en un navegador que no lo tenga, no pasa nada. Por eso
  // va acá y no antes: primero la app, después las comodidades.
  registrarServicio(documento.defaultView?.navigator, protocolo);
  enlazarManifiesto(documento, protocolo);

  // El navegador puede tardar en contestar si acepta guardar los datos de forma
  // permanente, y la app no lo va a esperar para dibujarse. Cuando conteste, se
  // guarda la respuesta y se repinta: es un dato de la pantalla de Datos, no
  // algo que frene el arranque.
  pedirPersistencia(documento.defaultView?.navigator).then((respuesta) => {
    vista = { ...vista, persistencia: respuesta };
    pintar();
  }).catch(() => {});

  let vista = vistaInicial({
    estado, incidencias: lectura.incidencias, puedeCompartir, riesgoDeGuardado: riesgo,
  });
  const raiz = documento.getElementById('app');

  function pintar() {
    raiz.innerHTML = dibujarApp(vista);
    // Los gráficos que se pueden recorrer necesitan sus escuchadores cada vez,
    // porque `innerHTML` tira los elementos viejos y con ellos los de antes.
    // El zoom se pierde en cada repintado, y está bien: es cómo estás mirando,
    // no un dato tuyo (T-942).
    conectarSeries(raiz);
  }

  /**
   * Lee lo que hay escrito en el formulario ahora mismo.
   *
   * Se lee del documento en vez de ir guardando cada tecla en el estado: así no
   * hay dos versiones de lo que el usuario escribió, que es la trampa de L-005
   * aplicada a un formulario.
   */
  function leerFormulario() {
    const formulario = raiz.querySelector('[data-formulario="movimiento"]');
    if (!formulario) return vista.borrador;

    const campo = (nombre) => formulario.elements[nombre]?.value ?? '';
    return {
      ...vista.borrador,
      fecha: campo('fecha'),
      monto: campo('monto'),
      moneda: campo('moneda'),
      rubro: campo('rubro'),
      comentario: campo('comentario'),
      detalle: campo('detalle'),
    };
  }

  /** Lo mismo que `leerFormulario`, para el formulario de ahorros — T-045. */
  function leerFormularioDeAhorro() {
    // El borrador **puede no existir todavía**: la vista inicial no lo trae,
    // porque el formulario de ahorros se abre desde su pantalla y no al
    // arrancar. Sin este respaldo, la primera carga salía con `tipo: undefined`
    // y el modelo la rechazaba con un mensaje que hablaba de "undefined". Lo
    // encontró el recorrido en el navegador, no los tests: los tests le pasan
    // siempre un borrador.
    const actual = vista.borradorDeAhorro ?? borradorDeAhorro({ estado: vista.estado });
    const formulario = raiz.querySelector('[data-formulario="ahorro"]');
    if (!formulario) return actual;

    const campo = (nombre) => formulario.elements[nombre]?.value ?? '';
    return {
      ...actual,
      fecha: campo('fecha'),
      monto: campo('monto'),
      moneda: campo('moneda'),
      persona: campo('persona'),
      comentario: campo('comentario'),
      detalle: campo('detalle'),
    };
  }

  /**
   * Guarda un movimiento de ahorro.
   *
   * Mismo camino que un gasto: se intenta, se escribe **antes** de decir que se
   * guardó, y si el navegador no puede escribir se muestra el error en vez de
   * una confirmación falsa (ADR-016). Lo único que no hace es pedir tipo de
   * cambio: los ahorros no se convierten nunca.
   */
  function guardarElAhorro() {
    const resultado = intentarGuardarAhorro(vista.estado, leerFormularioDeAhorro());

    if (resultado.error) {
      vista = { ...vista, borradorDeAhorro: resultado.borrador, error: resultado.error, aviso: null };
      pintar();
      return;
    }

    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, borradorDeAhorro: leerFormularioDeAhorro(), error: error.message, aviso: null };
      pintar();
      return;
    }

    vista = {
      ...vista,
      estado: resultado.estado,
      borradorDeAhorro: resultado.borrador,
      error: null,
      aviso: resultado.aviso,
      // Al corregir se vuelve a la lista, que es de donde se vino. Al cargar uno
      // nuevo se queda en el formulario: quien anota los ahorros del mes carga
      // varios seguidos.
      pantalla: resultado.corrigiendo ? 'ahorros' : vista.pantalla,
    };
    pintar();
  }

  /**
   * Aplica un cambio de rubros — T-048.
   *
   * Todos pasan por acá y no cada uno por su lado: **mueven movimientos**, así
   * que todos tienen que escribirse antes de decir que se hicieron (ADR-016) y
   * todos tienen que dejar el error a la vista si el modelo dice que no. Una
   * segunda puerta sería una segunda puerta sin alguna de las dos cosas.
   */
  function cambiarRubros(hacerlo, aviso) {
    let nuevoEstado;
    try {
      nuevoEstado = hacerlo();
    } catch (error) {
      vista = { ...vista, error: error.message, avisoRubro: null };
      pintar();
      return;
    }

    try {
      guardarEstado(nuevoEstado, almacen);
    } catch (error) {
      vista = { ...vista, error: error.message, avisoRubro: null };
      pintar();
      return;
    }

    vista = { ...vista, estado: nuevoEstado, rubroEditado: null, rubroUnido: null,
      error: null, avisoRubro: aviso };
    pintar();
  }

  function guardarMovimiento() {
    const resultado = intentarGuardar(vista.estado, leerFormulario());

    if (resultado.faltaCambio) {
      // No es un error del usuario: es un dato que la app necesita y no tiene.
      // Se interrumpe, se pide, y el movimiento queda esperando (CU-03).
      vista = {
        ...vista,
        borrador: resultado.borrador,
        faltaCambio: resultado.faltaCambio,
        borradorCambio: '',
        error: null,
        aviso: null,
      };
      pintar();
      return;
    }

    if (resultado.error) {
      // No se guardó nada, así que el borrador se conserva TAL CUAL: perder lo
      // escrito por un rubro sin elegir sería castigar dos veces el mismo error.
      vista = { ...vista, borrador: resultado.borrador, error: resultado.error, aviso: null };
      pintar();
      return;
    }

    // Se escribe en el almacenamiento ANTES de decir que se guardó. Si el
    // navegador no puede escribir (memoria llena), guardarEstado tira y el
    // usuario ve el error en vez de una confirmación falsa (ADR-016).
    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, borrador: leerFormulario(), error: error.message, aviso: null };
      pintar();
      return;
    }

    vista = {
      ...vista,
      estado: resultado.estado,
      borrador: resultado.borrador,
      aviso: resultado.aviso,
      error: null,
      faltaCambio: null,
      // El mes que se está mirando pasa a ser el del movimiento recién cargado:
      // si no, cargar un gasto de otro mes lo haría desaparecer de la vista.
      mes: mesDe(resultado.aviso.movimiento.fecha),
      // Al corregir se vuelve a la lista, que es de donde se vino. Al cargar uno
      // nuevo se sigue en el formulario, listo para el siguiente.
      pantalla: resultado.corrigiendo ? 'movimientos' : vista.pantalla,
    };
    pintar();
  }

  // El único trozo que se actualiza solo, sin redibujar la pantalla: la fecha
  // escrita en palabras. Redibujar entero acá sacaría el foco del calendario
  // que el usuario está usando, que es peor que el problema que resuelve.
  /**
   * Entrega el respaldo al navegador para que lo descargue.
   *
   * Es lo único de toda la app que crea un archivo, y se hace sin ninguna
   * petición de red: el contenido se arma en memoria, se envuelve en un `Blob` y
   * se le pasa al navegador con un enlace de descarga (ARQUITECTURA §7).
   *
   * Si algo falla —y puede fallar: la app se abre desde un archivo del disco, y
   * ahí las descargas dependen del navegador y del sistema— **se abre solo el
   * texto para copiar**, que es el camino que no depende de nadie. Un respaldo
   * que solo funciona si el navegador coopera no es un respaldo.
   */
  /**
   * Le pide al navegador que guarde un archivo. Devuelve el error, o `null`.
   *
   * Está aparte porque ahora salen dos archivos por el mismo camino —el respaldo
   * y la planilla— y dos copias de esto serían dos formas distintas de fallar.
   */
  function pedirDescarga({ contenido, nombre, tipo }) {
    try {
      const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
      const enlace = documento.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      documento.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      // Se libera después, no en el acto: revocarla enseguida le saca al
      // navegador el archivo de las manos mientras todavía lo está escribiendo.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return null;
    } catch (error) {
      return error.message;
    }
  }

  /**
   * Descarga la planilla de Excel — T-906.
   *
   * **No anota la fecha del respaldo, a propósito.** Un `.xlsx` no lleva los
   * identificadores de los movimientos, ni los tipos de cambio, ni las monedas:
   * se puede leer, pero no se puede volver a cargar en la app. Si descargarlo
   * apagara el aviso de "hace tantos días que no respaldás", el usuario se
   * quedaría tranquilo con un archivo que no lo puede salvar. Es la clase de
   * comodidad que cuesta los datos de alguien.
   */
  function descargarPlanilla() {
    const planilla = crearPlanilla(vista.estado);
    const error = pedirDescarga({ contenido: planilla.bytes, nombre: planilla.nombre, tipo: planilla.tipo });

    vista = error
      ? { ...vista, errorPlanilla: `No se pudo descargar la planilla (${error}). Probá con el respaldo de arriba.`, avisoPlanilla: null }
      : { ...vista, errorPlanilla: null, avisoPlanilla: avisoDePlanilla(planilla) };
    pintar();
  }

  /**
   * Descarga el CSV — T-018.
   *
   * Como la planilla, **no cuenta como respaldo**: un CSV no lleva los
   * identificadores de los movimientos, ni las monedas, ni el esquema, así que
   * no se puede volver a cargar sin perder cosas.
   */
  function descargarCsv() {
    const csv = prepararCsv(vista.estado);
    const error = pedirDescarga(csv);

    vista = error
      ? { ...vista, errorPlanilla: `No se pudo descargar el CSV (${error}).`, avisoPlanilla: null }
      : {
          ...vista,
          errorPlanilla: null,
          avisoPlanilla:
            `Listo: ${csv.nombre}, con ${csv.cuantos === 1 ? '1 fila' : `${csv.cuantos} filas`}.` +
            `${csv.sinConvertir > 0 ? ` ${csv.sinConvertir === 1 ? '1 quedó' : `${csv.sinConvertir} quedaron`} sin importe en euros, por falta de tipo de cambio.` : ''}` +
            ' Acordate de que esto no reemplaza al respaldo.',
        };
    pintar();
  }

  /** Comparte la planilla por el menú del teléfono, igual que el respaldo. */
  async function compartirLaPlanilla() {
    const planilla = crearPlanilla(vista.estado);
    const ventana = documento.defaultView;
    const resultado = await compartirRespaldo(
      ventana?.navigator,
      { contenido: planilla.bytes, nombre: planilla.nombre, tipo: planilla.tipo },
      ventana?.File
    );

    if (resultado.cancelado) return;

    vista = resultado.error
      ? {
          ...vista,
          estado: resultado.noVaAFuncionar ? anotarQueCompartirNoAnda(vista.estado) : vista.estado,
          errorPlanilla: resultado.error,
          avisoPlanilla: null,
        }
      : { ...vista, errorPlanilla: null, avisoPlanilla: avisoDePlanilla(planilla) };
    pintar();
  }

  /**
   * Deja anotado que compartir no funciona en este teléfono — T-914.
   *
   * `canShare({files})` dijo que sí y `share()` falló igual. Como el navegador
   * miente, la única fuente confiable es haberlo intentado: se guarda para no
   * volver a ofrecer un botón que ya se sabe que falla. Se puede deshacer desde
   * la pantalla, porque puede ser un permiso que el usuario cambie después.
   */
  function anotarQueCompartirNoAnda(estado) {
    const anotado = {
      ...estado,
      preferencias: { ...estado.preferencias, compartir_no_funciona: true },
    };
    try {
      guardarEstado(anotado, almacen);
    } catch {
      // Si no se puede guardar, se recuerda mientras la app esté abierta. Hay
      // problemas más grandes en ese caso, y T-950 ya los está avisando.
    }
    return anotado;
  }

  function avisoDePlanilla(planilla) {
    const meses = planilla.meses === 1 ? '1 mes' : `${planilla.meses} meses`;
    const falta = planilla.sinConvertir > 0
      ? ` ${planilla.sinConvertir === 1 ? '1 movimiento entró' : `${planilla.sinConvertir} movimientos entraron`} sin monto, por falta de tipo de cambio.`
      : '';
    return `Listo: ${planilla.nombre}, con ${meses}.${falta} Acordate de que esto no reemplaza al respaldo.`;
  }

  function descargarRespaldo() {
    const respaldo = prepararRespaldo(vista.estado);
    const error = pedirDescarga(respaldo);

    if (error) {
      vista = {
        ...vista,
        mostrarRespaldo: true,
        error: `No se pudo descargar el archivo (${error}). ` +
          'Copiá el texto de abajo y guardalo donde quieras: sirve igual.',
      };
      pintar();
      return;
    }

    anotarQueSeRespaldo(
      `Se preparó ${respaldo.nombre} con ${respaldo.cuantos === 1 ? '1 movimiento' : `${respaldo.cuantos} movimientos`}. ` +
      'Si no aparece en tus descargas, usá el texto para copiarlo.'
    );
  }

  /**
   * Anota que hoy se respaldó y lo dice.
   *
   * **Siempre DESPUÉS de que el archivo salió, nunca antes:** decir que se
   * respaldó algo que no se respaldó es peor que no anotar nada, porque apaga el
   * aviso que existe justamente para que no pasen semanas sin respaldo.
   */
  function anotarQueSeRespaldo(aviso) {
    const conRespaldo = anotarRespaldo(vista.estado);
    try {
      guardarEstado(conRespaldo, almacen);
    } catch {
      // Que no se pueda anotar la fecha no invalida el respaldo: el archivo ya
      // salió. Se sigue sin avisar de esto, que sería ruido sobre algo que salió
      // bien.
    }

    vista = { ...vista, estado: conRespaldo, error: null, avisoRespaldo: aviso };
    pintar();
  }

  /**
   * Entrega el respaldo al sistema operativo — T-905.
   *
   * La app no sube nada: le pasa el archivo al teléfono y el teléfono muestra
   * OneDrive, Drive o el correo. RN-06 queda intacta, porque no hay ninguna
   * petición de red de por medio.
   *
   * Es `async` y por eso no puede fallar en silencio: se espera el resultado y
   * recién ahí se anota la fecha. Anotarla al apretar el botón marcaría como
   * respaldado algo que el usuario todavía puede cancelar.
   */
  async function compartirElRespaldo() {
    const respaldo = prepararRespaldo(vista.estado);
    const ventana = documento.defaultView;
    const resultado = await compartirRespaldo(ventana?.navigator, respaldo, ventana?.File);

    // Cancelar no es fallar: si abrió el menú y se arrepintió, no pasó nada y no
    // hay nada que decirle.
    if (resultado.cancelado) return;

    if (resultado.error) {
      vista = {
        ...vista,
        estado: resultado.noVaAFuncionar ? anotarQueCompartirNoAnda(vista.estado) : vista.estado,
        mostrarRespaldo: true,
        error: `${resultado.error} Si no, copiá el texto de abajo: sirve igual.`,
      };
      pintar();
      return;
    }

    anotarQueSeRespaldo(
      `Se compartió ${respaldo.nombre} con ${respaldo.cuantos === 1 ? '1 movimiento' : `${respaldo.cuantos} movimientos`}. ` +
      'Comprobá que haya llegado a donde lo mandaste.'
    );
  }

  /**
   * Lee un respaldo y **muestra qué pasaría**. No toca nada del estado guardado.
   *
   * Es el primero de los tres pasos de CU-08. Separarlo del aplicar es toda la
   * diferencia entre "importar" y "importar sabiendo lo que va a pasar".
   */
  function prepararImportacion(texto) {
    const leido = leerRespaldo(texto);
    if (leido.error) {
      vista = { ...vista, importacion: null, errorImportar: leido.error, avisoImportar: null };
      pintar();
      return;
    }

    vista = {
      ...vista,
      importacion: { leido, datos: previsualizar(vista.estado, leido), exportado: leido.exportado },
      errorImportar: null,
      avisoImportar: null,
    };
    pintar();
  }

  /** Aplica lo que el usuario eligió, y recién ahí escribe. */
  function aplicarRespaldo(modo) {
    if (!vista.importacion) return;

    let nuevoEstado;
    try {
      nuevoEstado = aplicarImportacion(vista.estado, vista.importacion.leido, modo);
    } catch (error) {
      vista = { ...vista, errorImportar: error.message };
      pintar();
      return;
    }

    try {
      guardarEstado(nuevoEstado, almacen);
    } catch (error) {
      // No se pudo escribir: NO se cambia lo que está en pantalla. Mostrar los
      // datos importados sobre un almacenamiento que no los guardó haría creer
      // que la recuperación salió bien.
      vista = { ...vista, errorImportar: error.message };
      pintar();
      return;
    }

    const { datos } = vista.importacion;
    const cuantos = nuevoEstado.movimientos.length;
    vista = {
      ...vista,
      estado: nuevoEstado,
      importacion: null,
      errorImportar: null,
      avisoImportar: modo === 'reemplazar'
        ? `Listo. Ahora tenés ${cuantos === 1 ? '1 movimiento' : `${cuantos} movimientos`}: los del archivo.`
        : datos.nuevos === 0
          ? `No entró ninguno: ya los tenías a todos. Seguís con ${cuantos}.`
          : `Listo. Entraron ${datos.nuevos === 1 ? '1 movimiento' : `${datos.nuevos} movimientos`}` +
            `${datos.yaEstan > 0 ? ` y se saltearon ${datos.yaEstan} que ya tenías` : ''}. ` +
            `Ahora tenés ${cuantos}.`,
    };
    pintar();
  }

  /**
   * Lee la planilla de Excel y muestra qué se leyó — T-032, CU-13.
   *
   * **No toca nada todavía.** Esto se corre una sola vez sobre todo el
   * historial: el usuario tiene que poder ver qué entra, qué no entra y por qué,
   * antes de decidir.
   */
  async function prepararPlanillaVieja(bytes) {
    const leida = await leerPlanilla(bytes);
    if (leida.error) {
      vista = { ...vista, planilla: null, errorPlanillaVieja: leida.error, avisoPlanillaVieja: null };
      pintar();
      return;
    }

    const { movimientos, problemas, comprobaciones } = interpretarPlanilla(leida.filas);

    // La hoja de ahorros conjuntos, si la planilla la tiene — T-042, CU-14.
    //
    // Se lee en la MISMA importación: el usuario elige un archivo, no una hoja.
    // Que su planilla tenga los gastos y los ahorros en el mismo lugar es un
    // dato de su planilla, no algo que él tenga que traducir a dos pasos.
    //
    // Si no está la hoja, no pasa nada: `leerPlanilla` devuelve un error que acá
    // significa "no hay ahorros que traer", no "algo salió mal".
    const hojaDeAhorros = await leerPlanilla(bytes, { hoja: HOJA_DE_AHORROS });
    const ahorros = hojaDeAhorros.error
      ? { ahorros: [], problemas: [], comprobaciones: [] }
      : interpretarAhorros(hojaDeAhorros.filas, vista.estado.monedas ?? []);
    // Sin gastos NI ahorros no hay nada que mostrar. Con ahorros solos, sí: una
    // planilla puede traer la hoja de ahorros y no la de gastos —o tenerla ya
    // importada—, y negarse a abrirla por eso sería negarse a hacer lo único
    // que el usuario venía a hacer.
    if (movimientos.length === 0 && problemas.length === 0
        && ahorros.ahorros.length === 0 && ahorros.problemas.length === 0) {
      vista = {
        ...vista,
        planilla: null,
        errorPlanillaVieja:
          'La planilla se abrió, pero no se encontró ninguna fila con día y rubro. ' +
          '¿Puede ser que sea otra planilla, o que los datos estén en otra hoja?',
        avisoPlanillaVieja: null,
      };
      pintar();
      return;
    }

    const yaEstan = new Set((vista.estado.movimientos ?? []).map((m) => m.id));
    const ahorrosQueEstan = new Set((vista.estado.ahorros ?? []).map((a) => a.id));
    vista = {
      ...vista,
      planilla: {
        movimientos, problemas, comprobaciones,
        yaEstan: movimientos.filter((m) => yaEstan.has(m.id)).length,
        // **Cuáles son los que van a entrar**, no solo cuántos — T-044.
        //
        // Lo pidió el usuario después de reimportar su planilla: la app le dijo
        // "voy a traer 1 movimiento" y él no tenía forma de saber cuál. Pasa
        // justo cuando importa por segunda vez, que es cuando la diferencia es
        // chica y **el que aparece suele ser uno que había borrado a mano**. Un
        // número sin la lista lo obliga a aceptar a ciegas y buscarlo después.
        nuevos: movimientos.filter((m) => !yaEstan.has(m.id)),
        ahorros: ahorros.ahorros,
        problemasDeAhorros: ahorros.problemas,
        comprobacionesDeAhorros: ahorros.comprobaciones,
        ahorrosQueEstan: ahorros.ahorros.filter((a) => ahorrosQueEstan.has(a.id)).length,
        ahorrosNuevos: ahorros.ahorros.filter((a) => !ahorrosQueEstan.has(a.id)),
      },
      errorPlanillaVieja: null,
      avisoPlanillaVieja: null,
    };
    pintar();
  }

  /**
   * Trae los movimientos de la planilla.
   *
   * **Agrega, nunca reemplaza**, y no ofrece la otra opción: quien importa su
   * historial quiere sumarlo a lo que tiene, y un botón de "reemplazar todo" al
   * lado de uno que trae once meses es un accidente esperando. Los que ya están
   * no entran dos veces, porque el identificador sale de la propia fila.
   */
  function traerPlanillaVieja() {
    if (!vista.planilla) return;

    const yaEstan = new Set((vista.estado.movimientos ?? []).map((m) => m.id));
    const nuevos = vista.planilla.movimientos.filter((m) => !yaEstan.has(m.id));

    // Los ahorros entran en el mismo viaje, y con la misma regla: el
    // identificador sale de la fila, así que importar dos veces no duplica.
    const ahorrosQueEstan = new Set((vista.estado.ahorros ?? []).map((a) => a.id));
    const ahorrosNuevos = (vista.planilla.ahorros ?? []).filter((a) => !ahorrosQueEstan.has(a.id));

    const nuevoEstado = {
      ...vista.estado,
      movimientos: [...(vista.estado.movimientos ?? []), ...nuevos],
      ahorros: [...(vista.estado.ahorros ?? []), ...ahorrosNuevos],
    };

    try {
      guardarEstado(nuevoEstado, almacen);
    } catch (error) {
      vista = { ...vista, errorPlanillaVieja: error.message };
      pintar();
      return;
    }

    const problemas = vista.planilla.problemas.length;
    vista = {
      ...vista,
      estado: nuevoEstado,
      planilla: null,
      errorPlanillaVieja: null,
      avisoPlanillaVieja:
        `Listo: entraron ${nuevos.length === 1 ? '1 movimiento' : `${nuevos.length} movimientos`}.` +
        `${problemas > 0 ? ` Quedaron ${problemas === 1 ? '1 fila afuera' : `${problemas} filas afuera`}, con su motivo.` : ''}` +
        ' Acordate de hacer un respaldo ahora que están todos.',
    };
    pintar();
  }

  // Elegir un archivo lo lee y muestra la previa. El archivo se lee con
  // FileReader, que trabaja sobre el archivo que el usuario eligió a mano: no
  // hay ninguna petición de red de por medio (RN-06).
  // La planilla se lee como bytes, no como texto: es un ZIP.
  raiz.addEventListener('change', (evento) => {
    if (!evento.target.matches('input[type="file"][name="planilla"]')) return;
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => prepararPlanillaVieja(new Uint8Array(lector.result));
    lector.onerror = () => {
      vista = { ...vista, errorPlanillaVieja: 'No se pudo leer el archivo.' };
      pintar();
    };
    lector.readAsArrayBuffer(archivo);
  });

  raiz.addEventListener('change', (evento) => {
    if (!evento.target.matches('input[type="file"][name="archivo"]')) return;
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => prepararImportacion(String(lector.result ?? ''));
    lector.onerror = () => {
      vista = { ...vista, errorImportar: 'No se pudo leer el archivo. Probá pegando el texto.' };
      pintar();
    };
    lector.readAsText(archivo);
  });

  /**
   * Refresca las sugerencias de un campo mientras se escribe — T-920.
   *
   * Se cambia **solo el trozo de las sugerencias**, no el formulario entero:
   * ADR-023 dice que lo escrito vive en el documento y no se redibuja por tecla.
   * Redibujar todo acá borraría lo que el usuario tiene a medio escribir en los
   * otros campos, que es exactamente la trampa que ese ADR evita.
   */
  function refrescarSugerencias(campo, escrito) {
    const donde = raiz.querySelector(`[data-sugerencias="${campo}"]`);
    if (!donde) return;
    donde.innerHTML = dibujarSugerencias(campo, escrito, usadosDe(vista.estado)[campo] ?? []);
  }

  raiz.addEventListener('change', (evento) => {
    // El aviso de "esto reinterpreta N movimientos" tiene que moverse con el
    // número elegido: mostrarlo con el valor viejo sería peor que no mostrarlo.
    if (!evento.target.matches('[data-accion-cambio="decimales-elegidos"]')) return;
    const formulario = evento.target.closest('[data-formulario="decimales"]');
    refrescarAvisoDecimales(formulario?.elements.moneda?.value ?? '', Number(evento.target.value));
  });

  raiz.addEventListener('input', (evento) => {
    if (evento.target.matches('[data-accion-entrada="buscar"]')) {
      // Se guarda lo buscado en la vista —para que sobreviva a borrar un
      // movimiento desde los resultados— pero **se redibuja solo el trozo de
      // los resultados**: repintar la pantalla entera en cada tecla le sacaría
      // el foco al campo y movería el cursor (ADR-023, T-943).
      vista = { ...vista, busqueda: evento.target.value };
      const donde = raiz.querySelector('[data-resultados]');
      if (donde) donde.innerHTML = dibujarResultados(vista);
      return;
    }
    if (evento.target.matches('[data-accion-entrada="fechas-viaje"]')) {
      refrescarDuracion();
      return;
    }
    if (evento.target.matches('[data-accion-entrada="renombrar"]')) {
      refrescarAvisoEtiqueta(evento.target.value);
      return;
    }

    if (evento.target.matches('input[name="fecha"]')) {
      const etiqueta = raiz.querySelector('[data-fecha-legible]');
      if (etiqueta) etiqueta.textContent = fechaEnPalabras(evento.target.value);
      return;
    }

    if (evento.target.matches('input[name="comentario"], input[name="detalle"]')) {
      refrescarSugerencias(evento.target.name, evento.target.value);
      return;
    }

    // El aviso de "esto cambia el total de 2 movimientos, de 31,74 a 40,00 €"
    // solo sirve MIENTRAS se escribe el valor nuevo. Sin esto quedaba con el
    // texto genérico y nunca mostraba los números, que son todo su valor.
    // Elegir un rubro repinta su campo, sin redibujar la pantalla: redibujar
    // cerraría el desplegable en el mismo gesto en que se está usando.
    if (evento.target.matches('select[name="rubro"]')) {
      const campo = raiz.querySelector('[data-campo-rubro]');
      if (!campo) return;
      const tipo = vista.borrador?.tipo;
      for (let i = 1; i <= COLORES; i += 1) campo.classList.remove(`rubro-${i}`);
      campo.classList.remove('sin-elegir');
      campo.classList.add(evento.target.value ? claseDeRubro(tipo, evento.target.value) : 'sin-elegir');
      return;
    }

    if (evento.target.matches('input[name="unidadesPorEuro"]')) {
      const hueco = raiz.querySelector('[data-aviso-correccion]');
      if (!hueco || !vista.faltaCambio) return;
      vista = { ...vista, borradorCambio: evento.target.value };
      hueco.innerHTML = dibujarAvisoCorreccion(
        efectoDeCorregir(vista.estado, vista.faltaCambio.moneda, vista.faltaCambio.mes, evento.target.value),
        vista.faltaCambio.moneda
      );
    }
  });

  /**
   * Guarda el tipo de cambio que se acaba de pedir y REINTENTA el movimiento
   * solo.
   *
   * El reintento es lo que hace que la interrupción sea una interrupción y no un
   * desvío: el usuario escribió un número y su gasto quedó guardado. Obligarlo a
   * volver al formulario y darle a guardar otra vez sería hacerle pagar dos
   * veces por un dato que la app le pidió a él.
   */
  /**
   * Aplica un cambio del catálogo de monedas y lo guarda — T-024.
   *
   * Es la misma secuencia para agregar, ocultar, mostrar, borrar y cambiar
   * decimales: probar, guardar, y recién si las dos cosas salieron bien mover la
   * pantalla. Si se guardara después de pintar, un navegador que no puede
   * escribir mostraría el cambio aplicado y lo perdería al recargar —que es
   * exactamente el error que ya se cometió con los tipos de cambio.
   */
  function aplicarAlCatalogo(resultado, siguiente = {}) {
    if (resultado.error) {
      vista = { ...vista, error: resultado.error, avisoMoneda: null };
      pintar();
      return;
    }
    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, error: error.message };
      pintar();
      return;
    }
    vista = { ...vista, estado: resultado.estado, error: null, avisoMoneda: null, ...siguiente };
    pintar();
  }

  function agregarUnaMoneda() {
    const formulario = raiz.querySelector('[data-formulario="moneda"]');
    if (!formulario) return;
    const campo = (nombre) => formulario.elements[nombre]?.value ?? '';
    const entrada = {
      codigo: campo('codigo'),
      nombre: campo('nombre'),
      decimales: Number(campo('decimales')),
    };

    const resultado = intentarAgregarMoneda(vista.estado, entrada);
    if (resultado.error) {
      // Lo escrito se conserva: un código repetido no tiene por qué costar
      // volver a tipear el nombre.
      vista = { ...vista, borradorMoneda: entrada, error: resultado.error, avisoMoneda: null };
      pintar();
      return;
    }
    aplicarAlCatalogo(resultado, { borradorMoneda: undefined, avisoMoneda: `${entrada.codigo.toUpperCase()} ya se puede elegir al cargar un gasto.` });
  }

  function guardarLosDecimales() {
    const formulario = raiz.querySelector('[data-formulario="decimales"]');
    if (!formulario) return;
    const codigo = formulario.elements.moneda?.value ?? '';
    const decimales = Number(formulario.elements.decimales?.value ?? '');

    aplicarAlCatalogo(
      intentarCambiarDecimales(vista.estado, codigo, decimales),
      { monedaEditada: null, borradorDecimales: undefined },
    );
  }

  /**
   * Refresca el aviso mientras se elige el número de decimales.
   *
   * Se cambia solo el trozo del aviso y no el formulario entero: ADR-023. Y el
   * aviso tiene que moverse con la elección, porque decir "esto reinterpreta 47
   * movimientos" con el número viejo sería peor que no decir nada.
   */
  function refrescarAvisoDecimales(codigo, decimales) {
    const donde = raiz.querySelector('[data-aviso-decimales]');
    if (!donde) return;
    donde.innerHTML = dibujarAvisoDecimales(efectoDeCambiarDecimales(vista.estado, codigo, decimales));
  }

  /**
   * Renombrar una etiqueta — T-025. Toca los movimientos, así que guarda antes
   * de mover la pantalla, como todo lo que cambia datos en esta app.
   */
  function guardarLaEtiqueta() {
    const formulario = raiz.querySelector('[data-formulario="etiqueta"]');
    if (!formulario) return;
    const campo = formulario.elements.campo?.value ?? '';
    const clave = formulario.elements.clave?.value ?? '';
    const texto = formulario.elements.texto?.value ?? '';

    const resultado = intentarRenombrar(vista.estado, campo, clave, texto);
    if (resultado.error) {
      vista = { ...vista, borradorEtiqueta: texto, error: resultado.error };
      pintar();
      return;
    }
    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, borradorEtiqueta: texto, error: error.message };
      pintar();
      return;
    }
    vista = {
      ...vista, estado: resultado.estado, error: null,
      etiquetaEditada: null, borradorEtiqueta: undefined,
      avisoEtiqueta: `Ahora se llama ${texto.trim()}.`,
    };
    pintar();
  }

  function sacarLaEtiqueta(campo, clave) {
    const resultado = intentarBorrarEtiqueta(vista.estado, campo, clave);
    if (resultado.error) {
      vista = { ...vista, error: resultado.error, etiquetaBorrando: null };
      pintar();
      return;
    }
    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, error: error.message, etiquetaBorrando: null };
      pintar();
      return;
    }
    vista = {
      ...vista, estado: resultado.estado, error: null, etiquetaBorrando: null,
      avisoEtiqueta: 'La etiqueta se sacó. Los movimientos siguen ahí.',
    };
    pintar();
  }

  /** El aviso de "se van a unir" tiene que moverse con lo que se escribe. */
  function refrescarAvisoEtiqueta(texto) {
    const donde = raiz.querySelector('[data-aviso-etiqueta]');
    const formulario = raiz.querySelector('[data-formulario="etiqueta"]');
    if (!donde || !formulario) return;
    donde.innerHTML = dibujarAvisoRenombrar(efectoDeRenombrar(
      vista.estado.movimientos,
      formulario.elements.campo.value,
      formulario.elements.clave.value,
      texto,
    ));
  }

  /** Las fechas de un viaje — T-941. Toca datos, así que guarda antes de pintar. */
  function guardarLasFechas() {
    const formulario = raiz.querySelector('[data-formulario="fechas-viaje"]');
    if (!formulario) return;
    const clave = formulario.elements.clave?.value ?? '';
    const escrito = {
      desde: formulario.elements.desde?.value ?? '',
      hasta: formulario.elements.hasta?.value ?? '',
    };

    const resultado = intentarFijarFechas(vista.estado, clave, escrito.desde, escrito.hasta);
    if (resultado.error) {
      vista = { ...vista, borradorFechas: escrito, error: resultado.error };
      pintar();
      return;
    }
    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, borradorFechas: escrito, error: error.message };
      pintar();
      return;
    }
    vista = { ...vista, estado: resultado.estado, error: null, viajeEditado: null, borradorFechas: undefined };
    pintar();
  }

  /** La cuenta de los días se actualiza mientras se escriben las fechas. */
  function refrescarDuracion() {
    const formulario = raiz.querySelector('[data-formulario="fechas-viaje"]');
    const donde = raiz.querySelector('[data-duracion]');
    if (!formulario || !donde) return;
    donde.textContent = dibujarDuracion(
      formulario.elements.desde?.value ?? '',
      formulario.elements.hasta?.value ?? '',
    );
  }

  function olvidarLosDias(clave) {
    const resultado = intentarBorrarFechas(vista.estado, clave);
    if (resultado.error) {
      vista = { ...vista, error: resultado.error };
      pintar();
      return;
    }
    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, error: error.message };
      pintar();
      return;
    }
    vista = { ...vista, estado: resultado.estado, error: null, viajeEditado: null, borradorFechas: undefined };
    pintar();
  }

  function guardarTipoDeCambio() {
    const formulario = raiz.querySelector('[data-formulario="cambio"]');
    if (!formulario) return;
    const campo = (nombre) => formulario.elements[nombre]?.value ?? '';
    const escrito = campo('unidadesPorEuro');

    const resultado = intentarGuardarCambio(vista.estado, {
      moneda: campo('moneda'),
      mes: campo('mes'),
      unidadesPorEuro: escrito,
    });

    if (resultado.error) {
      vista = { ...vista, borradorCambio: escrito, error: resultado.error };
      pintar();
      return;
    }

    // El tipo de cambio se PERSISTE ya, antes de cualquier otra cosa. Antes esto
    // pasaba después del reintento del movimiento, y si el reintento fallaba
    // —por ejemplo al corregir un tipo de cambio sin ningún gasto esperando— la
    // corrección se perdía en silencio: la pantalla la mostraba aplicada y al
    // recargar volvía el valor viejo. Lo encontró el recorrido en el navegador.
    try {
      guardarEstado(resultado.estado, almacen);
    } catch (error) {
      vista = { ...vista, borradorCambio: escrito, error: error.message };
      pintar();
      return;
    }

    const conCambio = { ...vista, estado: resultado.estado, faltaCambio: null, borradorCambio: '', error: null };

    // ¿Había un movimiento esperando, o esto era solo corregir un tipo de
    // cambio? No es lo mismo, y confundirlos era el otro medio error.
    const esperaba = Boolean(vista.faltaCambio && vista.borrador?.monto);
    if (!esperaba) {
      vista = { ...conCambio, pantalla: 'cambios' };
      pintar();
      return;
    }

    const reintento = intentarGuardar(conCambio.estado, conCambio.borrador);
    if (reintento.error) {
      vista = { ...conCambio, error: reintento.error };
      pintar();
      return;
    }

    try {
      guardarEstado(reintento.estado, almacen);
    } catch (error) {
      vista = { ...conCambio, error: error.message };
      pintar();
      return;
    }

    vista = {
      ...conCambio,
      estado: reintento.estado,
      borrador: reintento.borrador,
      aviso: reintento.aviso,
      mes: mesDe(reintento.aviso.movimiento.fecha),
    };
    pintar();
  }

  raiz.addEventListener('submit', (evento) => {
    if (evento.target.matches('[data-formulario="movimiento"]')) {
      evento.preventDefault();
      guardarMovimiento();
    } else if (evento.target.matches('[data-formulario="ahorro"]')) {
      evento.preventDefault();
      guardarElAhorro();
    } else if (evento.target.matches('[data-formulario="nuevo-rubro"]')) {
      evento.preventDefault();
      const campos = evento.target.elements;
      cambiarRubros(() => crearRubro(vista.estado, campos.tipo.value, campos.nombre.value),
        `Se agregó "${campos.nombre.value.trim()}".`);
    } else if (evento.target.matches('[data-formulario="rubro"]')) {
      evento.preventDefault();
      const campos = evento.target.elements;
      cambiarRubros(
        () => renombrarRubro(vista.estado, campos.tipo.value, campos.viejo.value, campos.nombre.value),
        `Listo: "${campos.viejo.value}" ahora es "${campos.nombre.value.trim()}", con sus movimientos.`
      );
    } else if (evento.target.matches('[data-formulario="unir-rubro"]')) {
      evento.preventDefault();
      const campos = evento.target.elements;
      cambiarRubros(
        () => unirRubros(vista.estado, campos.tipo.value, campos.desde.value, campos.hasta.value),
        `Listo: los movimientos de "${campos.desde.value}" pasaron a "${campos.hasta.value}".`
      );
    } else if (evento.target.matches('[data-formulario="cambio"]')) {
      evento.preventDefault();
      guardarTipoDeCambio();
    }
  });

  raiz.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion]');
    if (!boton) return;

    const { accion, pantalla: destino, tipo } = boton.dataset;
    if (accion === 'mes-anterior') vista = moverMes(vista, 'anterior');
    else if (accion === 'mes-siguiente') vista = moverMes(vista, 'siguiente');
    else if (accion === 'ir') vista = irA(vista, destino);
    else if (accion === 'guardar') {
      evento.preventDefault();
      guardarMovimiento();
      return;
    } else if (accion === 'guardar-cambio') {
      evento.preventDefault();
      guardarTipoDeCambio();
      return;
    } else if (accion === 'cancelar-cambio') {
      // "Ahora no": se vuelve al formulario con el gasto tal como estaba. No se
      // pierde nada, pero tampoco se guarda: sin tipo de cambio ese movimiento
      // quedaría fuera de todos los totales (RN-04).
      vista = { ...vista, faltaCambio: null, borradorCambio: '', error: null };
    } else if (accion === 'fechas-viaje') {
      vista = { ...vista, viajeEditado: boton.dataset.clave, borradorFechas: undefined, error: null };
    } else if (accion === 'cancelar-fechas-viaje') {
      vista = { ...vista, viajeEditado: null, borradorFechas: undefined, error: null };
    } else if (accion === 'guardar-fechas-viaje') {
      evento.preventDefault();
      guardarLasFechas();
      return;
    } else if (accion === 'borrar-fechas-viaje') {
      olvidarLosDias(boton.dataset.clave);
      return;
    } else if (accion === 'renombrar-etiqueta') {
      vista = { ...vista, etiquetaEditada: { campo: boton.dataset.campo, clave: boton.dataset.clave },
        borradorEtiqueta: undefined, error: null, avisoEtiqueta: null };
    } else if (accion === 'cancelar-etiqueta') {
      vista = { ...vista, etiquetaEditada: null, borradorEtiqueta: undefined, error: null };
    } else if (accion === 'guardar-etiqueta') {
      evento.preventDefault();
      guardarLaEtiqueta();
      return;
    } else if (accion === 'borrar-etiqueta') {
      vista = { ...vista, etiquetaBorrando: { campo: boton.dataset.campo, clave: boton.dataset.clave },
        error: null, avisoEtiqueta: null };
    } else if (accion === 'cancelar-borrar-etiqueta') {
      vista = { ...vista, etiquetaBorrando: null };
    } else if (accion === 'confirmar-borrar-etiqueta') {
      sacarLaEtiqueta(boton.dataset.campo, boton.dataset.clave);
      return;
    } else if (accion === 'ver-rubro') {
      // Tocar una fila del desglose lleva a los movimientos que la componen,
      // en el mes que se está mirando (T-026).
      vista = { ...vista, pantalla: 'movimientos', error: null,
        filtro: { tipo: boton.dataset.tipo, rubro: boton.dataset.rubro } };
    } else if (accion === 'ver-comentario') {
      // El comentario mira TODOS los meses: la tarjeta de gastos fijos habla de
      // todo el historial, y mostrar solo el mes en curso sería una parte del
      // número que se acaba de tocar.
      vista = { ...vista, pantalla: 'movimientos', error: null,
        filtro: { comentario: boton.dataset.comentario, todosLosMeses: true } };
    } else if (accion === 'ver-celda') {
      // Una celda de la matriz: además del filtro, hay que MOVER el mes, porque
      // la celda es de un mes que no es necesariamente el que se está mirando.
      //
      // El tipo viene de la celda desde que la tabla tiene también los rubros de
      // ingreso: `otros` está en las dos listas y son cosas distintas (RN-02).
      // Darlo por sentado mostraría los otros GASTOS al tocar los otros
      // ingresos, que es la peor forma de fallar — con datos que parecen bien.
      vista = { ...vista, pantalla: 'movimientos', mes: boton.dataset.mes, error: null,
        filtro: { tipo: boton.dataset.tipo ?? TIPO_GASTO, rubro: boton.dataset.rubro } };
    } else if (accion === 'ver-mes') {
      vista = { ...vista, pantalla: 'movimientos', mes: boton.dataset.mes, error: null, filtro: null };
    } else if (accion === 'quitar-filtro') {
      vista = { ...vista, filtro: null };
    } else if (accion === 'agregar-moneda') {
      evento.preventDefault();
      agregarUnaMoneda();
      return;
    } else if (accion === 'decimales-moneda') {
      vista = { ...vista, monedaEditada: boton.dataset.moneda, borradorDecimales: undefined, error: null, avisoMoneda: null };
    } else if (accion === 'cancelar-decimales') {
      vista = { ...vista, monedaEditada: null, borradorDecimales: undefined, error: null };
    } else if (accion === 'guardar-decimales') {
      evento.preventDefault();
      guardarLosDecimales();
      return;
    } else if (accion === 'ocultar-moneda') {
      aplicarAlCatalogo(intentarOcultarMoneda(vista.estado, boton.dataset.moneda));
      return;
    } else if (accion === 'mostrar-moneda') {
      aplicarAlCatalogo(intentarMostrarMoneda(vista.estado, boton.dataset.moneda));
      return;
    } else if (accion === 'borrar-moneda') {
      aplicarAlCatalogo(intentarBorrarMoneda(vista.estado, boton.dataset.moneda));
      return;
    } else if (accion === 'corregir-cambio') {
      // Corregir uno existente reusa el mismo pedido, con su aviso de cuántos
      // movimientos toca.
      vista = {
        ...vista,
        pantalla: 'nuevo',
        faltaCambio: { moneda: boton.dataset.moneda, mes: boton.dataset.mes },
        borradorCambio: '',
        error: null,
        aviso: null,
      };
    } else if (accion === 'leer-pegado') {
      const campo = raiz.querySelector('textarea[name="pegado"]');
      prepararImportacion(campo?.value ?? '');
      return;
    } else if (accion === 'cancelar-importar') {
      vista = { ...vista, importacion: null, errorImportar: null, avisoImportar: null };
    } else if (accion === 'importar') {
      aplicarRespaldo(boton.dataset.modo);
      return;
    } else if (accion === 'posponer-recordatorio') {
      // Se guarda, porque si no el aviso volvería en cada recarga por más que lo
      // hubieras pospuesto — y un aviso que no se puede sacar deja de leerse.
      const pospuesto = posponerRecordatorio(vista.estado);
      try {
        guardarEstado(pospuesto, almacen);
      } catch {
        // Si no se puede guardar, el aviso se calla igual mientras la app esté
        // abierta y vuelve al recargar. No hay nada útil que decirle acá.
      }
      vista = { ...vista, estado: pospuesto };
    } else if (accion === 'sugerencia') {
      // Se escribe en el campo y se limpian las sugerencias, sin tocar nada más
      // del formulario: lo que el usuario tenga escrito en los otros campos
      // tiene que quedar como está.
      const campo = boton.dataset.campo;
      const donde = raiz.querySelector(`input[name="${campo}"]`);
      if (donde) {
        donde.value = boton.dataset.texto;
        donde.focus();
      }
      refrescarSugerencias(campo, boton.dataset.texto);
      return;
    } else if (accion === 'importar-planilla') {
      traerPlanillaVieja();
      return;
    } else if (accion === 'cancelar-planilla') {
      vista = { ...vista, planilla: null, errorPlanillaVieja: null, avisoPlanillaVieja: null };
    } else if (accion === 'exportar-csv') {
      descargarCsv();
      return;
    } else if (accion === 'exportar-planilla') {
      descargarPlanilla();
      return;
    } else if (accion === 'compartir-planilla') {
      compartirLaPlanilla();
      return;
    } else if (accion === 'reintentar-compartir') {
      const { compartir_no_funciona, ...resto } = vista.estado.preferencias ?? {};
      const limpio = { ...vista.estado, preferencias: resto };
      try {
        guardarEstado(limpio, almacen);
      } catch {
        // Igual que al anotarlo: se recuerda mientras la app esté abierta.
      }
      vista = { ...vista, estado: limpio, error: null, avisoRespaldo: null };
    } else if (accion === 'compartir') {
      compartirElRespaldo();
      return;
    } else if (accion === 'exportar') {
      descargarRespaldo();
      return;
    } else if (accion === 'ver-respaldo') {
      vista = { ...vista, mostrarRespaldo: !vista.mostrarRespaldo, error: null };
    } else if (accion === 'editar') {
      const movimiento = buscarMovimiento(vista.estado, boton.dataset.id);
      if (!movimiento) return;
      let decimales;
      try {
        decimales = decimalesDe(vista.estado.monedas, movimiento.moneda);
      } catch {
        decimales = 2;
      }
      vista = {
        ...vista,
        pantalla: 'nuevo',
        borrador: borradorDesde(movimiento, decimales),
        aviso: null,
        error: null,
        borrando: null,
        borrado: null,
      };
    } else if (accion === 'cancelar-edicion') {
      vista = { ...vista, pantalla: 'movimientos', borrador: borradorNuevo({ estado: vista.estado }), error: null, aviso: null };
    } else if (accion === 'borrar') {
      // Primer toque: no borra, pregunta. En un celular el borrar y el corregir
      // quedan a milímetros.
      vista = { ...vista, borrando: boton.dataset.id, borrado: null };
    } else if (accion === 'borrar-no') {
      vista = { ...vista, borrando: null };
    } else if (accion === 'borrar-si') {
      const resultado = borrarMovimiento(vista.estado, boton.dataset.id);
      if (!resultado.borrado) {
        vista = { ...vista, borrando: null };
      } else {
        try {
          guardarEstado(resultado.estado, almacen);
        } catch (error) {
          // No se pudo escribir: NO se saca de la pantalla lo que sigue estando
          // guardado. Decir "borrado" sobre un dato que sigue ahí sería mentir
          // en la dirección más confusa posible.
          vista = { ...vista, borrando: null, error: error.message };
          pintar();
          return;
        }
        vista = { ...vista, estado: resultado.estado, borrando: null, borrado: resultado.borrado };
      }
    } else if (accion === 'deshacer') {
      const estado = restaurarMovimiento(vista.estado, vista.borrado);
      try {
        guardarEstado(estado, almacen);
      } catch (error) {
        vista = { ...vista, error: error.message };
        pintar();
        return;
      }
      vista = { ...vista, estado, borrado: null };
    } else if (accion === 'editar-rubro') {
      vista = { ...vista, rubroEditado: { tipo: boton.dataset.tipo, rubro: boton.dataset.rubro },
        rubroUnido: null, error: null, avisoRubro: null };
    } else if (accion === 'unir-desde') {
      vista = { ...vista, rubroUnido: { tipo: boton.dataset.tipo, rubro: boton.dataset.rubro },
        rubroEditado: null, error: null, avisoRubro: null };
    } else if (accion === 'cancelar-rubro') {
      vista = { ...vista, rubroEditado: null, rubroUnido: null, error: null };
    } else if (accion === 'borrar-rubro') {
      // Sin confirmación, y a propósito: este botón solo aparece en los rubros
      // que **no tiene ningún movimiento**, así que no hay nada que perder. Los
      // que sí tienen se sacan uniéndolos, que es otra cosa y pregunta.
      cambiarRubros(() => borrarRubro(vista.estado, boton.dataset.tipo, boton.dataset.rubro),
        `Se sacó "${boton.dataset.rubro}".`);
      return;
    } else if (accion === 'perfil') {
      vista = irAlPerfil(vista, boton.dataset.perfil);
      // El perfil elegido se guarda: quien está poniendo al día los ahorros
      // abre la app varias veces seguidas para lo mismo. Si no se puede
      // escribir, se cambia igual y se recuerda solo mientras esté abierta:
      // negarse a cambiar de pantalla por eso sería absurdo.
      try {
        guardarEstado(vista.estado, almacen);
      } catch {
        // Ver arriba.
      }
    } else if (accion === 'guardar-ahorro') {
      evento.preventDefault();
      guardarElAhorro();
      return;
    } else if (accion === 'tipo-ahorro') {
      // Entró / salió del ahorro. Lo escrito no se pierde porque se lee antes.
      vista = { ...vista, borradorDeAhorro: { ...leerFormularioDeAhorro(), tipo }, error: null };
    } else if (accion === 'editar-ahorro') {
      const ahorro = buscarAhorro(vista.estado, boton.dataset.id);
      if (!ahorro) return;
      let decimales;
      try {
        decimales = decimalesDe(vista.estado.monedas, ahorro.moneda);
      } catch {
        // La moneda no está en el catálogo —un respaldo viejo, una moneda
        // borrada—: se muestra con dos decimales en vez de no dejar corregir.
        decimales = 2;
      }
      vista = {
        ...vista,
        pantalla: 'nuevo-ahorro',
        borradorDeAhorro: borradorDesdeAhorro(ahorro, decimales),
        error: null,
        aviso: null,
        confirmandoAhorro: null,
      };
    } else if (accion === 'borrar-ahorro') {
      // Primer toque: no borra, pregunta. Igual que en los movimientos.
      vista = { ...vista, confirmandoAhorro: boton.dataset.id, ahorroBorrado: null };
    } else if (accion === 'borrar-ahorro-no') {
      vista = { ...vista, confirmandoAhorro: null };
    } else if (accion === 'borrar-ahorro-si') {
      const resultado = borrarAhorro(vista.estado, boton.dataset.id);
      if (!resultado.borrado) {
        vista = { ...vista, confirmandoAhorro: null };
      } else {
        try {
          guardarEstado(resultado.estado, almacen);
        } catch (error) {
          // No se saca de la pantalla lo que sigue estando guardado.
          vista = { ...vista, confirmandoAhorro: null, error: error.message };
          pintar();
          return;
        }
        vista = { ...vista, estado: resultado.estado, confirmandoAhorro: null, ahorroBorrado: resultado.borrado };
      }
    } else if (accion === 'deshacer-ahorro') {
      const estado = restaurarAhorro(vista.estado, vista.ahorroBorrado);
      try {
        guardarEstado(estado, almacen);
      } catch (error) {
        vista = { ...vista, error: error.message };
        pintar();
        return;
      }
      vista = { ...vista, estado, ahorroBorrado: null };
    } else if (accion === 'tipo') {
      // Cambiar de gasto a ingreso cambia la lista de rubros (RN-02), así que hay
      // que volver a dibujar. Lo escrito no se pierde porque se lee antes; el
      // rubro sí se vacía, y tiene que vaciarse: el de antes ya no es válido.
      vista = { ...vista, borrador: { ...leerFormulario(), tipo, rubro: '' }, error: null };
    } else return;

    pintar();
  });

  pintar();
  return {
    get vista() {
      return vista;
    },
    pintar,
    guardar: () => guardarEstado(vista.estado, almacen),
  };
}

if (typeof document !== 'undefined') {
  iniciar(document);
}
