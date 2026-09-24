// Qué partes de la app están prendidas — T-071, CU-21.
//
// ── Qué es un perfil ────────────────────────────────────────────────────────
//
// Cada perfil es una app chica adentro de la grande: tiene sus pantallas, su
// barra de abajo y su pantalla de inicio. Existen porque los ahorros no son
// gastos —no entran en ningún total del mes— y mezclarlos dejaba dos pestañas
// que no servían para lo que uno estaba haciendo.
//
// ── Por qué se pueden apagar ────────────────────────────────────────────────
//
// Lo pidió el usuario (2026-09-22). Los ahorros conjuntos son de dos personas
// con nombre propio; quien use la app solo no tiene nada que hacer ahí, y una
// pestaña vacía que no se puede sacar es una pestaña que enseña a ignorar la
// barra de arriba.
//
// ── La regla que evita el peor error posible: apagar NO borra ───────────────
//
// Apagar un perfil lo saca de la barra. **Los movimientos siguen guardados**, el
// respaldo se los sigue llevando, y al volver a prenderlo está todo. Por eso
// Ajustes dice cuántos esconde antes de apagarlo: un número ahí es la diferencia
// entre "esto no me sirve" y "esto me está borrando algo".
//
// ── Cómo se guarda, y por qué solo lo que el usuario eligió ─────────────────
//
// En `preferencias.perfiles` van **únicamente las decisiones explícitas**:
// `{ ahorros: false }` quiere decir "el usuario apagó los ahorros conjuntos", y
// una clave ausente quiere decir "nunca lo tocó". Guardar los tres valores
// siempre sería más simple de leer y peor de vivir: el día que un perfil nuevo
// cambie de valor de fábrica, cada respaldo viejo traería el valor viejo
// escrito y lo pisaría, sin que nadie lo haya decidido nunca.
//
// Este archivo no toca el navegador: es lógica pura.

export const PERFIL_COTIDIANA = 'cotidiana';
export const PERFIL_AHORROS = 'ahorros';
export const PERFIL_MIS_AHORROS = 'mis-ahorros';

/**
 * Los perfiles que existen.
 *
 * - `inicio`: dónde aterriza al entrar.
 * - `fijo`: no se puede apagar. Solo la vida cotidiana, que es la app.
 * - `deFabrica`: si viene prendido cuando nadie eligió nada.
 * - `registro`: en qué lista del estado viven sus movimientos, para poder decir
 *   **cuántos esconde apagarlo**. Lo declara el perfil y no la pantalla de
 *   Ajustes: ahí estaba escrito a mano y solo conocía los ahorros conjuntos, así
 *   que "Mis ahorros" nunca avisaba nada aunque tuviera datos cargados (T-074).
 * - `cosas`: cómo se llaman esos movimientos cuando hay que contarlos en voz
 *   alta, en singular y en plural.
 */
export const PERFILES = Object.freeze([
  Object.freeze({
    clave: PERFIL_COTIDIANA,
    etiqueta: 'Vida cotidiana',
    inicio: 'mes',
    fijo: true,
    deFabrica: true,
  }),
  Object.freeze({
    clave: PERFIL_AHORROS,
    etiqueta: 'Ahorros conjuntos',
    inicio: 'ahorros',
    fijo: false,
    deFabrica: true,
    registro: 'ahorros',
    cosas: ['movimiento de ahorro', 'movimientos de ahorro'],
  }),
  // Apagada de fábrica, elegido por el usuario (2026-09-22): quien abre la app
  // por primera vez ve lo mismo que antes y no se encuentra con una pestaña
  // vacía que no pidió. Se prende una vez, en Ajustes, y queda.
  Object.freeze({
    clave: PERFIL_MIS_AHORROS,
    etiqueta: 'Mis ahorros',
    inicio: 'mis-ahorros',
    fijo: false,
    deFabrica: false,
    registro: 'mis_ahorros',
    cosas: ['movimiento', 'movimientos'],
  }),
]);

/** El perfil con esta clave, o `null`. */
export function perfilDeClave(clave) {
  return PERFILES.find((p) => p.clave === clave) ?? null;
}

/**
 * ¿Este perfil está prendido?
 *
 * Los fijos siempre. Los demás, lo que haya elegido el usuario — y si no eligió
 * nada, lo que trae de fábrica.
 */
export function perfilPrendido(estado, clave) {
  const perfil = perfilDeClave(clave);
  if (!perfil) return false;
  if (perfil.fijo) return true;

  const elegido = estado?.preferencias?.perfiles?.[clave];
  return typeof elegido === 'boolean' ? elegido : perfil.deFabrica;
}

/** Los perfiles prendidos, en el orden en que se dibujan arriba. */
export function perfilesPrendidos(estado) {
  return PERFILES.filter((p) => perfilPrendido(estado, p.clave));
}

/**
 * Cuántos movimientos guarda un perfil — o sea, cuántos esconde apagarlo.
 *
 * Los sabe **por el perfil**, no por una lista escrita en la pantalla: es lo que
 * garantiza que un perfil nuevo no nazca callado. Un perfil sin registro propio
 * —la vida cotidiana, que no se puede apagar— no esconde nada.
 */
export function cuantosGuarda(estado, clave) {
  // Sin `Array.isArray` no alcanza con mirar el registro: un respaldo editado a
  // mano puede traer cualquier cosa ahí. Y con él, la guarda de "este perfil no
  // tiene registro" sobra — la sacó una mutación que sobrevivió.
  const lista = estado?.[perfilDeClave(clave)?.registro];
  return Array.isArray(lista) ? lista.length : 0;
}

/**
 * Cómo se llaman esos movimientos, ya en singular o plural según cuántos sean.
 *
 * Va acá al lado y no en la pantalla por lo mismo: "movimientos de ahorro" es
 * correcto para los conjuntos y raro para los propios, y elegir la palabra en la
 * pantalla es volver a escribir a mano lo que cada perfil ya sabe de sí.
 */
export function nombreDeLoQueGuarda(clave, cuantos) {
  const [uno, varios] = perfilDeClave(clave)?.cosas ?? ['movimiento', 'movimientos'];
  return cuantos === 1 ? uno : varios;
}

/**
 * Prende o apaga un perfil. Devuelve estado nuevo; **no borra ningún dato**.
 *
 * Un perfil fijo no se puede apagar: la app quedaría sin nada que mostrar y sin
 * ningún lugar desde donde volver a prenderlo.
 */
export function prenderPerfil(estado, clave, prendido) {
  const perfil = perfilDeClave(clave);
  if (!perfil || perfil.fijo) return estado;

  const perfiles = { ...estado?.preferencias?.perfiles, [clave]: prendido === true };

  // Si se apaga el perfil en el que estabas, el que queda guardado como "dónde
  // estaba" tiene que ser uno prendido. Si no, la próxima visita abre en un
  // perfil que ya no está en la barra, y `dibujarApp()` cae a otra pantalla sin
  // decir por qué — que es exactamente el silencio de L-038.
  const siguiente = { ...estado, preferencias: { ...estado?.preferencias, perfiles } };
  if (prendido !== true && estado?.preferencias?.perfil === clave) {
    siguiente.preferencias = { ...siguiente.preferencias, perfil: PERFIL_COTIDIANA };
  }

  return siguiente;
}
