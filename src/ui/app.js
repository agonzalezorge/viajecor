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
import { dibujarNuevo, borradorNuevo, borradorDesde, intentarGuardar, fechaEnPalabras } from './pantallas/movimiento.js';
import { claseDeRubro, COLORES } from './colores.js';
import { decimalesDe } from '../core/monedas.js';
import { dibujarCambios, intentarGuardarCambio, dibujarAvisoCorreccion, efectoDeCorregir } from './pantallas/cambio.js';
import { dibujarResumen } from './pantallas/resumen.js';
import { dibujarLista, borrarMovimiento, restaurarMovimiento, buscarMovimiento } from './pantallas/lista.js';
import { dibujarDatos } from './pantallas/datos.js';
import { prepararRespaldo, anotarRespaldo } from '../datos/exportar.js';
import { leerRespaldo, previsualizar, aplicarImportacion } from '../datos/importar.js';
import { compartirRespaldo, sePuedeCompartir, archivoDelRespaldo } from './compartir.js';

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
  dibujar: dibujarResumen,
});

registrarPantalla('movimientos', {
  etiqueta: 'Movimientos',
  icono: '≡',
  conMes: true,
  dibujar: dibujarLista,
});

registrarPantalla('datos', {
  etiqueta: 'Datos',
  icono: '↧',
  conMes: false,
  dibujar: dibujarDatos,
});

registrarPantalla('cambios', {
  etiqueta: 'Tipos de cambio',
  icono: '⇄',
  conMes: false,
  enBarra: false,
  dibujar: dibujarCambios,
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
export function vistaInicial({ estado, incidencias = [], mes, puedeCompartir = false } = {}) {
  return {
    pantalla: 'mes',
    mes: mes ?? mesDe(hoy()),
    estado,
    incidencias,
    // Dato del entorno, no del usuario: se pregunta una vez al arrancar y viaja
    // en la vista para que las funciones que dibujan no miren el navegador.
    puedeCompartir,
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
  const limpia = {
    ...vista, pantalla: nombre, aviso: null, error: null, borrando: null, borrado: null,
    avisoRespaldo: null, mostrarRespaldo: false,
    importacion: null, errorImportar: null, avisoImportar: null,
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

  let vista = vistaInicial({ estado, incidencias: lectura.incidencias, puedeCompartir });
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
  function descargarRespaldo() {
    const respaldo = prepararRespaldo(vista.estado);

    try {
      const url = URL.createObjectURL(new Blob([respaldo.contenido], { type: respaldo.tipo }));
      const enlace = documento.createElement('a');
      enlace.href = url;
      enlace.download = respaldo.nombre;
      documento.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      // Se libera después, no en el acto: revocarla enseguida le saca al
      // navegador el archivo de las manos mientras todavía lo está escribiendo.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      vista = {
        ...vista,
        mostrarRespaldo: true,
        error: `No se pudo descargar el archivo (${error.message}). ` +
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

  // Elegir un archivo lo lee y muestra la previa. El archivo se lee con
  // FileReader, que trabaja sobre el archivo que el usuario eligió a mano: no
  // hay ninguna petición de red de por medio (RN-06).
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

  raiz.addEventListener('input', (evento) => {
    if (evento.target.matches('input[name="fecha"]')) {
      const etiqueta = raiz.querySelector('[data-fecha-legible]');
      if (etiqueta) etiqueta.textContent = fechaEnPalabras(evento.target.value);
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
