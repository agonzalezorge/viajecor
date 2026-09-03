// El catálogo de monedas.
//
// La lista vive en los DATOS del usuario, no en este código (RN-04b, ADR-011).
// El motivo es concreto: si estuviera en el código, agregar una moneda para un
// viaje imprevisto exigiría publicar una versión nueva de la app — con la persona
// en otro país, sin poder registrar sus gastos, esperando un archivo.
//
// Este módulo no guarda nada: recibe la lista y devuelve una lista nueva. Quien
// persiste es `datos/almacenamiento.js`. Todas las funciones de acá son puras y
// **no modifican la lista que reciben**, porque una función que muta lo que le
// pasan obliga a acordarse de copiar en cada llamada, y basta olvidarse una vez.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { unidadMinima } from './dinero.js';
import { normalizarMoneda, normalizarTextoVisible, normalizarClave } from './modelo.js';

/**
 * La moneda base de fábrica — RN-04.
 *
 * **Es el punto de partida, no la verdad.** Desde T-050 la base la elige el
 * usuario en Ajustes: hay gente que lleva sus cuentas en pesos uruguayos y para
 * ella el euro es una moneda más. Quien manda es `monedaBaseDe(estado)`; esta
 * constante es lo que vale mientras nadie haya elegido otra cosa.
 */
export const MONEDA_BASE = 'EUR';

/**
 * La moneda en la que se expresan todos los totales.
 *
 * Es la que **no lleva tipo de cambio** —vale 1 contra sí misma— y la que por
 * eso no se puede borrar ni ocultar. Recibe el estado y no lo toma de ningún
 * lado global: así una función que convierte dinero no puede depender de en qué
 * pantalla está el usuario.
 */
export function monedaBaseDe(estado) {
  const elegida = estado?.preferencias?.moneda_base;
  return typeof elegida === 'string' && /^[A-Za-z]{3}$/.test(elegida.trim())
    ? elegida.trim().toUpperCase()
    : MONEDA_BASE;
}

// Las cuatro que el usuario usa hoy (RN-04b). Son un punto de partida editable,
// no una lista cerrada: se agregan y se ocultan desde la app (CU-15).
const INICIALES = [
  { codigo: 'EUR', nombre: 'Euro', decimales: 2, oculta: false },
  { codigo: 'UYU', nombre: 'Peso uruguayo', decimales: 2, oculta: false },
  { codigo: 'USD', nombre: 'Dólar estadounidense', decimales: 2, oculta: false },
  { codigo: 'CRC', nombre: 'Colón costarricense', decimales: 2, oculta: false },
];

/**
 * Las monedas de un primer arranque. Devuelve copias nuevas cada vez: si
 * devolviera siempre los mismos objetos, ocultar una moneda en un juego de datos
 * la ocultaría también en el siguiente.
 */
export function monedasIniciales() {
  return INICIALES.map((moneda) => ({ ...moneda }));
}

/**
 * Arma una moneda válida a partir de lo que el usuario escribió.
 *
 * Los decimales los valida `dinero.js` llamando a `unidadMinima()`, en vez de
 * repetir acá el rango permitido. Dos reglas iguales escritas en dos lugares es
 * cómo terminan diciendo cosas distintas.
 */
export function crearMoneda({ codigo, nombre, decimales = 2 } = {}) {
  const codigoNormalizado = normalizarMoneda(codigo);

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new Error(`Falta el nombre de la moneda ${codigoNormalizado}.`);
  }
  unidadMinima(decimales); // tira si no es un entero de 0 a 4

  return {
    codigo: codigoNormalizado,
    nombre: normalizarTextoVisible(nombre),
    decimales,
    oculta: false,
  };
}

/** Busca por código, sin distinguir mayúsculas ni espacios (RN-03). */
export function buscarMoneda(monedas, codigo) {
  const buscado = normalizarClave(String(codigo ?? ''));
  return listaDe(monedas).find((m) => normalizarClave(String(m?.codigo ?? '')) === buscado) ?? null;
}

/**
 * Cuántos decimales usa una moneda.
 *
 * **Tira si la moneda no está en la lista**, en vez de suponer 2. Suponer sería
 * cómodo y equivocarse costaría un factor de cien en todos los importes de esa
 * moneda (ADR-005, ADR-011). Un error acá se ve enseguida; una suposición
 * silenciosa aparece meses después, en un total que nadie sabe explicar.
 */
export function decimalesDe(monedas, codigo) {
  const moneda = buscarMoneda(monedas, codigo);
  if (moneda === null) {
    throw new Error(
      `La moneda "${codigo}" no está en tu lista, así que no se sabe cuántos decimales usa. Agregala antes de cargar el movimiento.`
    );
  }
  return moneda.decimales;
}

/** Las que se muestran en el formulario de carga: todas menos las ocultas. */
export function monedasVisibles(monedas) {
  return listaDe(monedas).filter((m) => m?.oculta !== true);
}

/**
 * Agrega una moneda. El código repetido se rechaza sin distinguir mayúsculas:
 * `crc` y `CRC` son la misma moneda, y admitir las dos partiría los totales de
 * Costa Rica en dos mitades que nunca se suman (L-002).
 */
export function agregarMoneda(monedas, entrada) {
  const lista = listaDe(monedas);
  const nueva = crearMoneda(entrada);

  if (buscarMoneda(lista, nueva.codigo) !== null) {
    throw new Error(`Ya tenés una moneda con el código ${nueva.codigo}.`);
  }
  return [...lista, nueva];
}

/**
 * Cambia los decimales de una moneda.
 *
 * **Esto reinterpreta todos los importes ya cargados en esa moneda** (PRODUCTO,
 * CU-15): un monto guardado como `1500` son 15,00 con dos decimales y 1500 con
 * cero. No se reescriben los montos, se leen distinto. Quien llame tiene que
 * avisarle al usuario cuántos movimientos cambian de significado — para eso está
 * `contarMovimientosDe()`.
 */
export function cambiarDecimalesDe(monedas, codigo, decimales, base = MONEDA_BASE) {
  const lista = listaDe(monedas);
  const moneda = exigirMoneda(lista, codigo);

  if (moneda.codigo === base) {
    throw new Error(
      `${moneda.codigo} es la moneda base y siempre usa dos decimales: todos los totales de la app se expresan en ella.`
    );
  }
  unidadMinima(decimales);

  return lista.map((m) => (m === moneda ? { ...m, decimales } : m));
}

/** Cuántos movimientos hay cargados en una moneda. Sin tope de filas (L-001). */
export function contarMovimientosDe(movimientos, codigo) {
  const buscado = normalizarClave(String(codigo ?? ''));
  if (!Array.isArray(movimientos)) return 0;
  return movimientos.filter((m) => normalizarClave(String(m?.moneda ?? '')) === buscado).length;
}

/**
 * Oculta una moneda: deja de ofrecerse al cargar, pero sus movimientos siguen
 * existiendo y contando en los totales.
 *
 * Es la salida para "esta ya no la uso" sin perder el historial del viaje.
 */
export function ocultarMoneda(monedas, codigo, base = MONEDA_BASE) {
  const lista = listaDe(monedas);
  const moneda = exigirMoneda(lista, codigo);

  if (moneda.codigo === base) {
    throw new Error(`${moneda.codigo} no se puede ocultar: es la moneda en la que se expresan todos los totales.`);
  }
  return lista.map((m) => (m === moneda ? { ...m, oculta: true } : m));
}

export function mostrarMoneda(monedas, codigo) {
  const lista = listaDe(monedas);
  const moneda = exigirMoneda(lista, codigo);
  return lista.map((m) => (m === moneda ? { ...m, oculta: false } : m));
}

/**
 * Borra una moneda de la lista. Solo se puede si NO tiene movimientos.
 *
 * Borrar una moneda con movimientos dejaría gastos sin forma de saber cuántos
 * decimales tienen ni cómo convertirlos a euros: registros huérfanos que ninguna
 * pantalla podría mostrar bien y que ningún total podría sumar. Por eso la
 * respuesta no es "¿estás seguro?" sino "no, y en cambio podés ocultarla".
 */
export function borrarMoneda(monedas, codigo, movimientos = [], base = MONEDA_BASE) {
  const lista = listaDe(monedas);
  const moneda = exigirMoneda(lista, codigo);

  if (moneda.codigo === base) {
    throw new Error(`${moneda.codigo} no se puede borrar: es la moneda base de la app.`);
  }

  const cuantos = contarMovimientosDe(movimientos, moneda.codigo);
  if (cuantos > 0) {
    const plural = cuantos === 1 ? 'movimiento cargado' : 'movimientos cargados';
    throw new Error(
      `${moneda.nombre} tiene ${cuantos} ${plural}: borrarla los dejaría sin forma de convertirse a la moneda base. Ocultala en vez de borrarla.`
    );
  }
  return lista.filter((m) => m !== moneda);
}

function listaDe(monedas) {
  if (!Array.isArray(monedas)) {
    throw new Error('El catálogo de monedas tiene que ser una lista.');
  }
  return monedas;
}

function exigirMoneda(lista, codigo) {
  const moneda = buscarMoneda(lista, codigo);
  if (moneda === null) {
    throw new Error(`No hay ninguna moneda con el código "${codigo}" en tu lista.`);
  }
  return moneda;
}
