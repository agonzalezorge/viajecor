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

import { hoy, mesDe, mesAnterior, mesSiguiente } from '../core/modelo.js';
import { formatearMes } from '../core/formato.js';
import { leerEstado, guardarEstado } from '../datos/almacenamiento.js';
import { monedasIniciales } from '../core/monedas.js';
import { dibujarNuevo, borradorNuevo, intentarGuardar, fechaEnPalabras } from './pantallas/movimiento.js';

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
// y una función que dibuja su contenido. Las de verdad llegan con T-011 y
// siguientes; por ahora hay marcadores, para que el armazón se pueda ver y usar
// antes de que exista ninguna.

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

/** Un marcador honesto: dice qué va a haber acá y qué tarea lo trae. */
function marcador(titulo, explicacion, tarea) {
  return () => `
    <section class="tarjeta">
      <h2>${escapar(titulo)}</h2>
      <p class="suave">${escapar(explicacion)}</p>
      <p class="suave pendiente">Todavía no está construida — ${escapar(tarea)}.</p>
    </section>
  `;
}

registrarPantalla('mes', {
  etiqueta: 'Mes',
  icono: '◧',
  conMes: true,
  dibujar: marcador(
    'Resumen del mes',
    'Cuánto gastaste, cuánto entró y el saldo, con el desglose por rubro.',
    'T-014'
  ),
});

registrarPantalla('movimientos', {
  etiqueta: 'Movimientos',
  icono: '≡',
  conMes: true,
  dibujar: marcador(
    'Movimientos del mes',
    'La lista de lo que cargaste, para revisarlo, corregirlo o borrarlo.',
    'T-015'
  ),
});

registrarPantalla('datos', {
  etiqueta: 'Datos',
  icono: '↧',
  conMes: false,
  dibujar: marcador(
    'Tus datos',
    'Exportar un respaldo, volver a importarlo, y la lista de monedas.',
    'T-016 y T-024'
  ),
});

registrarPantalla('nuevo', {
  etiqueta: 'Cargar',
  icono: '+',
  conMes: false,
  enBarra: false,
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
export function dibujarEncabezado({ mes, conMes }) {
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
    ${selector}
  `;
}

/**
 * La barra de navegación, abajo y no arriba: en un celular sostenido con una
 * mano, la parte de arriba de la pantalla es donde el pulgar no llega.
 */
export function dibujarNavegacion(actual) {
  const botones = pantallasRegistradas()
    .filter((p) => p.enBarra !== false)
    .map((p) => {
      const seleccionada = p.nombre === actual;
      return `
        <button type="button" class="pestania${seleccionada ? ' activa' : ''}"
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
      <button type="button" class="pestania nueva${actual === 'nuevo' ? ' activa' : ''}"
              data-accion="ir" data-pantalla="nuevo"
              ${actual === 'nuevo' ? 'aria-current="page"' : ''}>
        <span class="icono" aria-hidden="true">+</span>
        <span>Cargar</span>
      </button>
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

/** La app entera, como texto. Es la función que los tests miran. */
export function dibujarApp(vista) {
  const definicion = pantalla(vista.pantalla) ?? pantalla('mes');
  const contenido = definicion.dibujar(vista);

  return `
    ${dibujarEncabezado({ mes: vista.mes, conMes: definicion.conMes })}
    ${dibujarAvisos(vista.incidencias)}
    <main class="contenido">${contenido}</main>
    ${dibujarNavegacion(definicion.nombre)}
  `;
}

// ── El estado de la vista ────────────────────────────────────────────────────

/**
 * Qué se está mirando: la pantalla, el mes y los datos. Es lo único mutable de
 * la interfaz, y vive en un solo lugar para que "por qué se ve esto" tenga una
 * sola respuesta posible.
 */
export function vistaInicial({ estado, incidencias = [], mes } = {}) {
  return {
    pantalla: 'mes',
    mes: mes ?? mesDe(hoy()),
    estado,
    incidencias,
  };
}

/** Mueve el mes visible. Devuelve una vista nueva, sin tocar la que recibe. */
export function moverMes(vista, direccion) {
  const mes = direccion === 'anterior' ? mesAnterior(vista.mes) : mesSiguiente(vista.mes);
  return { ...vista, mes };
}

export function irA(vista, nombre) {
  if (!pantalla(nombre)) return vista;

  // El aviso de "guardado" y el error de validación son de un momento, no del
  // estado: si sobrevivieran a cambiar de pantalla, alguien volvería a la carga
  // media hora después y vería un error que ya no significa nada.
  const limpia = { ...vista, pantalla: nombre, aviso: null, error: null };
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
export function iniciar(documento, almacen) {
  const lectura = leerEstado(almacen);
  let estado = lectura.estado;

  if (lectura.primerArranque) {
    estado = { ...estado, monedas: monedasIniciales() };
    // No se guarda todavía: escribir en el primer arranque, antes de que el
    // usuario cargue nada, es la forma más fácil de pisar algo que estaba y no
    // se entendió (ADR-015). Se guardará con el primer movimiento.
  }

  let vista = vistaInicial({ estado, incidencias: lectura.incidencias });
  const raiz = documento.getElementById('app');

  function pintar() {
    raiz.innerHTML = dibujarApp(vista);
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

  function guardarMovimiento() {
    const resultado = intentarGuardar(vista.estado, leerFormulario());

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
      // El mes que se está mirando pasa a ser el del movimiento recién cargado:
      // si no, cargar un gasto de otro mes lo haría desaparecer de la vista.
      mes: mesDe(resultado.aviso.movimiento.fecha),
    };
    pintar();
  }

  // El único trozo que se actualiza solo, sin redibujar la pantalla: la fecha
  // escrita en palabras. Redibujar entero acá sacaría el foco del calendario
  // que el usuario está usando, que es peor que el problema que resuelve.
  raiz.addEventListener('input', (evento) => {
    if (!evento.target.matches('input[name="fecha"]')) return;
    const etiqueta = raiz.querySelector('[data-fecha-legible]');
    if (etiqueta) etiqueta.textContent = fechaEnPalabras(evento.target.value);
  });

  raiz.addEventListener('submit', (evento) => {
    if (!evento.target.matches('[data-formulario="movimiento"]')) return;
    evento.preventDefault();
    guardarMovimiento();
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
