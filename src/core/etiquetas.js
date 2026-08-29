// Las etiquetas que el usuario ya escribió — CU-16, T-025.
//
// ── Lo primero que hay que entender, porque cambia todo lo demás ────────────
//
// **No existe ningún catálogo de comentarios ni de detalles.** Los rubros sí son
// una lista cerrada de ocho; el comentario y el detalle son **texto libre
// escrito en cada movimiento**. Este archivo no lee un catálogo: lo *deduce*
// recorriendo los movimientos.
//
// Por eso "borrar una etiqueta" no es borrar un registro: es **vaciar ese texto
// en los N movimientos que lo tienen**, y "renombrarla" es reescribirlo en los
// N. Son operaciones en lote sobre datos ya cargados, así que les corresponde la
// regla de siempre (ADR-019, ADR-033): **decir cuántos movimientos tocan antes
// de tocarlos**. Por eso cada operación viene con su `efectoDe…`.
//
// ── Para qué sirve de verdad ────────────────────────────────────────────────
//
// El comentario es lo que AGRUPA: los totales por viaje y por gasto fijo salen
// de él. `Barcelona26` y `barcelona 26` son dos grupos distintos, y un typo
// parte un total en dos sin avisar (L-002). Renombrar uno con el nombre del otro
// **los une**, y esa es la razón principal de esta pantalla.
//
// Es también la salida a la pregunta que ADR-013 dejó abierta: `Perú` y `Peru`
// son dos claves distintas a propósito —sacar tildes automáticamente juntaría
// palabras que el usuario quiso separar—, y acá se pueden juntar a mano las que
// él decida que son la misma.
//
// El detalle no agrupa nada: limpiarlo es orden, no arreglar un total. Se ofrece
// igual porque el usuario lo pidió, pero la pantalla lo dice.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { normalizarTextoVisible, normalizarClave } from './modelo.js';

/** Los campos de texto libre que se pueden limpiar. */
export const CAMPOS = Object.freeze(['comentario', 'detalle']);

function exigirCampo(campo) {
  if (!CAMPOS.includes(campo)) {
    throw new Error(`No se puede limpiar el campo ${JSON.stringify(campo)}: solo ${CAMPOS.join(' y ')}.`);
  }
}

/**
 * Las etiquetas que existen en un campo, con cuántos movimientos usa cada una.
 *
 * Agrupa por la **clave** (RN-03) y muestra **la primera escritura que
 * apareció**, igual que `porComentario()` y que las sugerencias: tres criterios
 * distintos para elegir cómo se escribe un grupo terminarían mostrando tres
 * nombres para la misma cosa.
 *
 * Devuelve también cuántas **escrituras distintas** tiene cada etiqueta. Es el
 * dato que delata un typo: "Barcelona26 · 2 formas de escribirlo" es exactamente
 * lo que hay que ir a arreglar.
 *
 * Sin ningún tope de filas (L-001).
 */
export function etiquetasUsadas(movimientos, campo) {
  exigirCampo(campo);
  if (!Array.isArray(movimientos)) return [];

  const porClave = new Map();

  for (const movimiento of movimientos) {
    const texto = normalizarTextoVisible(String(movimiento?.[campo] ?? ''));
    if (texto === '') continue;

    const clave = normalizarClave(texto);
    const visto = porClave.get(clave);
    if (!visto) {
      porClave.set(clave, { clave, texto, cuantos: 1, escrituras: new Set([texto]) });
    } else {
      visto.cuantos += 1;
      visto.escrituras.add(texto);
    }
  }

  return [...porClave.values()]
    .map(({ escrituras, ...resto }) => ({ ...resto, escrituras: escrituras.size }))
    // De más usada a menos, y por texto para desempatar: el orden no puede
    // depender de en qué orden se cargaron dos etiquetas con el mismo uso.
    .sort((a, b) => b.cuantos - a.cuantos || a.texto.localeCompare(b.texto));
}

/** Los movimientos que tienen esa etiqueta en ese campo. */
export function movimientosCon(movimientos, campo, clave) {
  exigirCampo(campo);
  const buscada = normalizarClave(String(clave ?? ''));
  return (movimientos ?? []).filter(
    (m) => normalizarClave(String(m?.[campo] ?? '')) === buscada,
  );
}

/**
 * Qué pasaría al renombrar. **Lo importante es `seUneCon`**: si el texto nuevo
 * ya existe, los dos grupos pasan a ser uno solo, y eso cambia totales. Es la
 * razón de ser de la pantalla y, si no se dice antes, es una sorpresa.
 */
export function efectoDeRenombrar(movimientos, campo, clave, nuevoTexto) {
  exigirCampo(campo);
  const texto = normalizarTextoVisible(String(nuevoTexto ?? ''));
  const claveVieja = normalizarClave(String(clave ?? ''));
  const claveNueva = texto === '' ? '' : normalizarClave(texto);

  const afectados = movimientosCon(movimientos, campo, claveVieja).length;
  const otra = claveNueva !== '' && claveNueva !== claveVieja
    ? etiquetasUsadas(movimientos, campo).find((e) => e.clave === claveNueva)
    : undefined;

  return {
    afectados,
    // Cambiar solo mayúsculas o espacios NO une nada: es la misma clave. Se
    // informa igual, porque para el usuario el texto sí cambió.
    seUneCon: otra ? { texto: otra.texto, cuantos: otra.cuantos } : null,
    quedan: afectados + (otra?.cuantos ?? 0),
  };
}

/**
 * Renombra una etiqueta en todos los movimientos que la tienen.
 *
 * Devuelve una lista nueva; no modifica la que recibe. El texto se guarda
 * **normalizado igual que al cargarlo** (`normalizarTextoVisible`): si acá se
 * guardara crudo, esta pantalla sería la única forma de meter en los datos un
 * texto con dos espacios o sin normalizar en NFC, que es justo lo que esa
 * función existe para impedir (L-003).
 */
export function renombrarEtiqueta(movimientos, campo, clave, nuevoTexto) {
  exigirCampo(campo);
  const texto = normalizarTextoVisible(String(nuevoTexto ?? ''));
  if (texto === '') {
    throw new Error('Para dejar la etiqueta vacía, usá borrar: así queda claro que se saca de todos sus movimientos.');
  }

  const buscada = normalizarClave(String(clave ?? ''));
  return (movimientos ?? []).map((m) =>
    normalizarClave(String(m?.[campo] ?? '')) === buscada ? { ...m, [campo]: texto } : m,
  );
}

/**
 * Saca una etiqueta de todos sus movimientos. **No borra ningún movimiento**:
 * les deja ese campo vacío. La pantalla tiene que decirlo con todas las letras
 * —"borrar la etiqueta" y "borrar los gastos" se confunden fácil, y uno de los
 * dos no se puede deshacer.
 */
export function borrarEtiqueta(movimientos, campo, clave) {
  exigirCampo(campo);
  const buscada = normalizarClave(String(clave ?? ''));
  return (movimientos ?? []).map((m) =>
    normalizarClave(String(m?.[campo] ?? '')) === buscada ? { ...m, [campo]: '' } : m,
  );
}
