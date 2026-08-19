// Forma y validación de un movimiento: la única puerta por la que un gasto o un
// ingreso entra a los datos de la app.
//
// Por qué existe un módulo entero para esto: un movimiento mal formado no
// explota, se guarda. Y una vez guardado contamina el total del mes, el del año
// y el del viaje, sin que nada lo delate. Las reglas que impiden eso —RN-01,
// RN-02, RN-03— tienen que estar en UN solo lugar, con tests, y no repartidas
// por cada pantalla que cargue datos.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { aMinimas, validarMonto } from './dinero.js';

// ── Vocabulario del dominio (PRODUCTO §4) ────────────────────────────────────
//
// Los nombres son los del Excel, tal cual (ADR-008): el usuario ya piensa en
// esos términos y renombrarlos lo obligaría a traducir mentalmente cada vez.

export const TIPO_GASTO = 'G';
export const TIPO_INGRESO = 'I';

export const RUBROS_GASTO = Object.freeze([
  'gastos fijos',
  'supermercado',
  'comida hecha',
  'viajes',
  'entretenimiento',
  'transporte',
  'salud',
  'otros',
]);

export const RUBROS_INGRESO = Object.freeze([
  'trabajo',
  'inversiones',
  'regalos',
  'otros',
]);

/**
 * Los rubros que acepta un tipo. `otros` aparece en las dos listas y son cosas
 * distintas: "otros gastos" y "otros ingresos" no se mezclan nunca en un total,
 * y lo que los mantiene separados es el campo `tipo`, no el nombre del rubro.
 */
export function rubrosDe(tipo) {
  const normalizado = normalizarTipo(tipo);
  return normalizado === TIPO_GASTO ? RUBROS_GASTO : RUBROS_INGRESO;
}

// ── Normalización de texto (RN-03, L-002) ────────────────────────────────────

/**
 * Deja un texto listo para MOSTRARSE: sin espacios al principio ni al final, y
 * sin espacios repetidos en el medio. Conserva las mayúsculas.
 *
 * El `normalize('NFC')` no es adorno. En Unicode, "café" se puede escribir de
 * dos maneras: con una única "é" (U+00E9) o con una "e" seguida de una tilde
 * suelta (U+0065 U+0301). Se ven idénticas en pantalla y `===` dice que son
 * distintas. Los teclados de iOS y el texto copiado desde macOS producen a
 * veces la segunda forma. Sin esta línea, dos comentarios que el usuario ve
 * iguales quedarían como dos viajes distintos — la trampa de L-003, pero
 * invisible incluso mirando el dato. NFC elige siempre la forma compuesta.
 */
export function normalizarTextoVisible(texto) {
  if (typeof texto !== 'string') {
    throw new Error(`Se esperaba un texto y llegó ${JSON.stringify(texto)}.`);
  }
  return texto.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/**
 * La clave con la que se COMPARA y se AGRUPA un texto (RN-03): lo mismo que
 * arriba, más pasarlo a minúsculas.
 *
 * `VIAJES`, `viajes` y ` Viajes ` dan la misma clave. Excel comparaba así de
 * fábrica y nadie lo pidió; al reimplementar los cálculos en JavaScript, que
 * compara exacto, esa regla hay que escribirla o desaparece con parte del
 * dinero adentro de una categoría fantasma (L-002).
 *
 * Lo que esta función NO hace es sacar las tildes: `Perú` y `Peru` quedan como
 * dos claves distintas. Es a propósito y está anotado en ADR-013 — sacar
 * tildes también juntaría palabras que el usuario quiso separar, y es una
 * decisión de producto, no técnica.
 */
export function normalizarClave(texto) {
  return normalizarTextoVisible(texto).toLowerCase();
}

/** El comentario es lo que agrupa un viaje o un gasto fijo. Se agrupa por esto. */
export function claveDeComentario(comentario) {
  return normalizarClave(comentario);
}

export function normalizarTipo(tipo) {
  const clave = normalizarClave(String(tipo ?? '')).toUpperCase();
  if (clave !== TIPO_GASTO && clave !== TIPO_INGRESO) {
    throw new Error(
      `El tipo de un movimiento es "${TIPO_GASTO}" (gasto) o "${TIPO_INGRESO}" (ingreso), y llegó ${JSON.stringify(tipo)}.`
    );
  }
  return clave;
}

/**
 * El rubro se guarda ya normalizado, en minúsculas. No se pierde nada al
 * mostrarlo: viene de una lista cerrada cuya forma canónica ya es minúscula
 * (`supermercado`, `gastos fijos`).
 */
export function normalizarRubro(rubro, tipo) {
  const clave = normalizarClave(String(rubro ?? ''));
  const permitidos = rubrosDe(tipo);
  if (!permitidos.includes(clave)) {
    const nombreTipo = normalizarTipo(tipo) === TIPO_GASTO ? 'gasto' : 'ingreso';
    throw new Error(
      `"${rubro}" no es un rubro de ${nombreTipo}. Los de ${nombreTipo} son: ${permitidos.join(', ')}.`
    );
  }
  return clave;
}

/**
 * El código de moneda se guarda en mayúsculas (`EUR`, `CRC`).
 *
 * Acá solo se comprueba la FORMA. Que la moneda exista en la lista del usuario
 * lo decide `core/monedas.js` (T-008): la lista vive en los datos, no en el
 * código (RN-04b, ADR-011), así que este módulo no puede saberla sin tener una
 * copia que se desactualice.
 */
export function normalizarMoneda(moneda) {
  const codigo = normalizarClave(String(moneda ?? '')).toUpperCase();
  if (!/^[A-Z]{3}$/.test(codigo)) {
    throw new Error(
      `El código de una moneda son tres letras, como EUR o CRC, y llegó ${JSON.stringify(moneda)}.`
    );
  }
  return codigo;
}

// ── Fecha (RN-01, L-005) ─────────────────────────────────────────────────────

const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Un movimiento tiene UNA fecha, `AAAA-MM-DD`, y de ella se derivan el día, el
 * mes y el año (RN-01). En el Excel el día y el mes eran dos columnas
 * independientes y nada obligaba a que dijeran lo mismo (L-005).
 *
 * La validación comprueba que el día EXISTA, no solo que el texto tenga la
 * forma correcta. `new Date('2026-02-30')` no falla: devuelve el 2 de marzo. Si
 * nos conformáramos con la forma, un dedazo mandaría el gasto a otro mes y el
 * total de febrero daría de menos sin ningún aviso.
 */
export function validarFecha(valor) {
  if (typeof valor !== 'string') {
    throw new Error(`La fecha tiene que ser un texto AAAA-MM-DD, y llegó ${JSON.stringify(valor)}.`);
  }
  const coincidencia = PATRON_FECHA.exec(valor.trim());
  if (!coincidencia) {
    throw new Error(`La fecha se escribe como AAAA-MM-DD (por ejemplo 2026-03-14), y llegó "${valor}".`);
  }
  const [, textoAnio, textoMes, textoDia] = coincidencia;
  const anio = Number(textoAnio);
  const mes = Number(textoMes);
  const dia = Number(textoDia);

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const existe =
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia;

  if (!existe) {
    throw new Error(`El ${textoDia}/${textoMes}/${textoAnio} no existe en el calendario.`);
  }
  return `${textoAnio}-${textoMes}-${textoDia}`;
}

/**
 * El día de hoy, `AAAA-MM-DD`, según el calendario del dispositivo.
 *
 * Se leen el año, el mes y el día locales en vez de recortar un instante en UTC:
 * lo que importa es qué día es para la persona que está cargando el gasto, no
 * qué día es en Greenwich. A las 22:00 de un martes en Montevideo, recortar un
 * instante UTC daría el miércoles.
 */
export function hoy(momento = new Date()) {
  const anio = momento.getFullYear();
  const mes = String(momento.getMonth() + 1).padStart(2, '0');
  const dia = String(momento.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** El mes al que pertenece un movimiento, `AAAA-MM`. Se DERIVA de la fecha. */
export function mesDe(fecha) {
  return validarFecha(fecha).slice(0, 7);
}

/**
 * El mes anterior y el siguiente, `AAAA-MM`.
 *
 * Se calculan con aritmética sobre los números, no moviendo un `Date`: restarle
 * un mes a un `Date` del 31 de marzo da el 3 de marzo, porque febrero no tiene
 * 31 días. Acá no hay días de por medio, así que el problema no puede aparecer.
 */
export function mesAnterior(mes) {
  const [anio, numero] = partesDelMes(mes);
  return numero === 1 ? `${anio - 1}-12` : `${anio}-${String(numero - 1).padStart(2, '0')}`;
}

export function mesSiguiente(mes) {
  const [anio, numero] = partesDelMes(mes);
  return numero === 12 ? `${anio + 1}-01` : `${anio}-${String(numero + 1).padStart(2, '0')}`;
}

function partesDelMes(mes) {
  if (typeof mes !== 'string' || !/^\d{4}-\d{2}$/.test(mes)) {
    throw new Error(`El mes se escribe como AAAA-MM (por ejemplo 2026-03), y llegó ${JSON.stringify(mes)}.`);
  }
  const numero = Number(mes.slice(5));
  if (numero < 1 || numero > 12) throw new Error(`No existe el mes ${mes}.`);
  return [Number(mes.slice(0, 4)), numero];
}

/**
 * Una fecha futura se PERMITE —se puede querer anotar algo ya pagado que
 * corresponde a otro día (CU-01)— pero la app avisa. Esta función es la que le
 * permite avisar; no rechaza nada.
 */
export function esFechaFutura(fecha, hoy) {
  return validarFecha(fecha) > validarFecha(hoy);
}

// ── Identificador ────────────────────────────────────────────────────────────

/**
 * Un identificador estable, del estilo `mov_9f2c1a4b3d7e5602`.
 *
 * Son 8 bytes al azar (16 dígitos hexadecimales) y no 4, aunque el ejemplo de
 * ARQUITECTURA §5 mostrara 8 dígitos. Con 8 dígitos hay 4.294.967.296 valores
 * posibles, que suena a muchísimo, pero por la paradoja del cumpleaños la
 * probabilidad de que DOS movimientos compartan identificador ronda el 10% con
 * apenas 30.000 movimientos — el volumen que ARQUITECTURA §6 da por esperable.
 * Dos movimientos con el mismo id significan que editar uno cambia el otro y
 * que borrar uno borra el que no era. Con 16 dígitos la probabilidad se vuelve
 * despreciable y cuesta ocho caracteres más.
 *
 * `crypto` es un objeto global tanto en el navegador como en Node, así que usarlo
 * no rompe la regla de que `core/` no depende del navegador.
 */
export function nuevoId(prefijo = 'mov') {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefijo}_${hex}`;
}

// ── Crear y validar un movimiento ────────────────────────────────────────────

/**
 * Arma un movimiento a partir de lo que una persona ESCRIBIÓ.
 *
 * `monto` viene en unidades de la moneda —lo que el usuario tipeó: `"12,50"`,
 * `12.5`— y sale guardado en unidades mínimas (`1250`). Por eso hace falta
 * `decimales`: cuántos usa esa moneda lo dice la lista del usuario (RN-04b), no
 * este módulo.
 *
 * `creado` es el DÍA en que se cargó, no un instante: la app no registra la
 * hora de nada (ADR-021).
 *
 * Para un movimiento que YA está guardado —leído de localStorage o de un
 * respaldo, con el monto ya en enteros— está `validarMovimiento()`. Son dos
 * puertas separadas a propósito (ADR-014): si una sola función tuviera que
 * adivinar si `1250` son 1250 € o 12,50 €, se equivocaría por un factor de cien
 * en silencio, que es exactamente el error que ADR-005 vino a evitar.
 */
export function crearMovimiento(entrada, opciones = {}) {
  if (entrada === null || typeof entrada !== 'object') {
    throw new Error('Para crear un movimiento hace falta un objeto con sus datos.');
  }
  const { decimales, id, creado } = opciones;
  if (decimales === undefined) {
    throw new Error(
      'Falta saber cuántos decimales usa la moneda: sin ese dato el monto se guardaría cien veces más grande o más chico (RN-04b).'
    );
  }

  const tipo = normalizarTipo(entrada.tipo);
  const monto = aMinimas(entrada.monto, decimales);
  if (monto === 0) {
    throw new Error('Un movimiento de cero no se guarda: si no hubo dinero de por medio, no hay nada que registrar.');
  }

  return {
    id: id ?? nuevoId(),
    fecha: validarFecha(entrada.fecha),
    tipo,
    rubro: normalizarRubro(entrada.rubro, tipo),
    monto,
    moneda: normalizarMoneda(entrada.moneda),
    // El comentario se guarda TAL COMO SE ESCRIBIÓ (sin espacios de más) para
    // que la app pueda mostrar "Roma" y no "roma". Lo que agrupa no es este
    // texto sino su clave, que sale de claveDeComentario(). Ver ADR-013.
    comentario: entrada.comentario ? normalizarTextoVisible(entrada.comentario) : '',
    // El detalle es texto libre y NO agrupa nada (PRODUCTO §4), así que se
    // respeta entero: solo se le sacan los espacios de los bordes.
    detalle: entrada.detalle ? entrada.detalle.normalize('NFC').trim() : '',
    creado: creado ? validarFecha(creado) : hoy(),
  };
}

/**
 * Comprueba un movimiento que YA viene guardado y devuelve una copia limpia.
 * Acá `monto` es un entero en unidades mínimas: no se reinterpreta.
 *
 * Devuelve una copia con solo los campos del modelo, en vez del objeto original:
 * un respaldo editado a mano o el archivo de otra versión de la app pueden traer
 * campos de más, y arrastrarlos hacia adentro es cómo un dato viejo sobrevive a
 * su propia migración.
 */
export function validarMovimiento(movimiento) {
  if (movimiento === null || typeof movimiento !== 'object') {
    throw new Error(`Se esperaba un movimiento y llegó ${JSON.stringify(movimiento)}.`);
  }
  if (typeof movimiento.id !== 'string' || movimiento.id.trim() === '') {
    throw new Error('El movimiento no tiene identificador.');
  }
  const tipo = normalizarTipo(movimiento.tipo);
  const monto = validarMonto(movimiento.monto);
  if (monto === 0) {
    throw new Error(`El movimiento ${movimiento.id} tiene monto cero.`);
  }
  let creado;
  try {
    creado = validarFecha(movimiento.creado);
  } catch {
    throw new Error(`El movimiento ${movimiento.id} no tiene una fecha de creación válida.`);
  }

  return {
    id: movimiento.id.trim(),
    fecha: validarFecha(movimiento.fecha),
    tipo,
    rubro: normalizarRubro(movimiento.rubro, tipo),
    monto,
    moneda: normalizarMoneda(movimiento.moneda),
    comentario: movimiento.comentario ? normalizarTextoVisible(movimiento.comentario) : '',
    detalle: movimiento.detalle ? movimiento.detalle.normalize('NFC').trim() : '',
    creado,
  };
}
