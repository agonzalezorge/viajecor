// Importar la planilla del usuario — T-032, CU-13.
//
// Junta las dos mitades: el lector de `.xlsx` (T-031), que dice qué hay en cada
// celda, y el mapeo (`docs/MAPEO-EXCEL.md`, T-030), que dice qué significa. Acá
// se aplica el mapeo, se arman los movimientos y —sobre todo— **se explica fila
// por fila lo que no entró**.
//
// ── Por qué el informe es la mitad del trabajo, y no un adorno ───────────────
//
// Esto se corre **una sola vez**, sobre once meses que no están en ningún otro
// lado. Si se equivoca, se equivoca en silencio sobre todo el historial: los
// totales quedan mal y no hay con qué compararlos, porque el único lugar donde
// estaban bien es la planilla que se acaba de reemplazar.
//
// Un importador que dice «se importaron 1043 filas» y se calla las 14 que
// descartó empieza el reemplazo repitiendo el error que la app vino a arreglar:
// el Excel original miente sin avisar (L-001). Por eso cada fila que no entra
// sale con **su número de fila**, lo que decía y por qué — para poder abrir la
// planilla y mirarla.

import { crearMovimiento, normalizarTextoVisible, normalizarClave, rubrosDe,
  TIPO_GASTO, TIPO_INGRESO, validarFecha } from '../core/modelo.js';
import { fechaDeSerie } from './planilla.js';

// Las columnas, según `docs/MAPEO-EXCEL.md` §3. Con prefijo porque en el archivo
// construido todos los módulos comparten ámbito: `TIPO` a secas ya lo usa el
// generador de planillas para un estilo de celda, y el constructor lo rechaza —
// que es exactamente para lo que existe esa comprobación.
const COL_ACUMULADO = 'A';
const COL_COMENTARIO = 'B';
const COL_DIA = 'C';
const COL_MES = 'D';
const COL_DETALLE = 'E';
const COL_RUBRO = 'F';
const COL_MONTO = 'G';
const COL_TIPO = 'H';

/**
 * ¿Esta fila es un dato? — §2 del mapeo.
 *
 * **Se pregunta qué sí es un dato, no qué hay que saltear.** Reconocer los
 * títulos por su texto obliga a acertar la lista completa de lo que se ignora, y
 * basta con que un mes esté escrito distinto para que un encabezado entre como
 * un gasto. Es una lista blanca que hay que mantener, y este proyecto ya se
 * quemó dos veces con eso (L-015, L-017).
 */
export function esFilaDeDatos(celdas) {
  const dia = celdas.get(COL_DIA)?.valor;
  const rubro = celdas.get(COL_RUBRO)?.valor;

  return Number.isInteger(dia) && dia >= 1 && dia <= 31
    && typeof rubro === 'string' && rubro.trim() !== '';
}

/**
 * Un identificador derivado de la propia fila — §8 del mapeo.
 *
 * La misma fila de la misma planilla da siempre el mismo identificador, así que
 * **importar dos veces no duplica**: el mecanismo que ya tiene la app —no
 * agregar un movimiento cuyo identificador ya está (T-017)— alcanza sin código
 * nuevo que lo vigile.
 *
 * **Incluye el número de fila**, y eso no es un detalle: dos filas idénticas
 * —mismo día, mismo rubro, mismo importe, sin comentario— son dos gastos reales
 * distintos, y sin el número de fila la segunda se descartaría como repetida.
 * Comer un café dos veces el mismo día es lo más normal del mundo.
 */
export function idDeFila(numero, contenido) {
  // Dos pasadas con semillas distintas, para llegar a 64 bits. Con una sola de
  // 32 bits, mil filas ya tienen una posibilidad entre cuatro mil de chocar — y
  // una colisión acá no da error: hace desaparecer un gasto.
  const semilla = `${numero}|${contenido}`;
  return `${fnv1a(semilla, 0x811c9dc5)}${fnv1a(semilla, 0x01000193)}`;
}

function fnv1a(texto, inicial) {
  let hash = inicial >>> 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Traduce una fila. Devuelve `{ movimiento }` o `{ problema }`.
 *
 * Nunca tira: una fila rota tiene que producir una línea del informe, no
 * interrumpir la importación de las otras mil.
 */
export function interpretarFila(numero, celdas) {
  const crudo = {
    comentario: texto(celdas.get(COL_COMENTARIO)),
    detalle: texto(celdas.get(COL_DETALLE)),
    rubro: texto(celdas.get(COL_RUBRO)),
    dia: celdas.get(COL_DIA)?.valor,
    monto: celdas.get(COL_MONTO)?.valor,
    tipo: texto(celdas.get(COL_TIPO)),
  };

  const problema = (motivo) => ({ problema: { fila: numero, motivo, decia: describir(crudo) } });

  // ── El tipo, primero: sin él no se puede juzgar el rubro (§5, §7) ──────────
  const letra = crudo.tipo.trim().toUpperCase();
  if (letra !== 'G' && letra !== 'I') {
    return problema(crudo.tipo.trim() === ''
      ? 'la columna I/G está vacía, así que no se sabe si es un gasto o un ingreso'
      : `la columna I/G dice "${crudo.tipo}", y tiene que decir G o I`);
  }
  const tipo = letra === 'G' ? TIPO_GASTO : TIPO_INGRESO;

  // ── El rubro (§5) ──────────────────────────────────────────────────────────
  const rubro = normalizarClave(crudo.rubro);
  if (!rubrosDe(tipo).includes(rubro)) {
    const otro = tipo === TIPO_GASTO ? TIPO_INGRESO : TIPO_GASTO;
    return problema(rubrosDe(otro).includes(rubro)
      ? `"${crudo.rubro}" no es un rubro de ${tipo === TIPO_GASTO ? 'gasto' : 'ingreso'}`
      : `el rubro "${crudo.rubro}" no existe en la app`);
  }

  // ── La fecha: día y mes son dos columnas y hay que casarlas (§4) ───────────
  const serie = celdas.get(COL_MES)?.valor;
  const primeroDelMes = typeof serie === 'number' ? fechaDeSerie(serie) : null;
  if (primeroDelMes === null) {
    return problema('no se pudo leer el mes de la columna MES');
  }

  const fecha = `${primeroDelMes.slice(0, 8)}${String(crudo.dia).padStart(2, '0')}`;
  try {
    validarFecha(fecha);
  } catch {
    // No se ajusta al último día del mes ni se pasa al siguiente: inventar una
    // fecha que el usuario no escribió es peor que no importar la fila.
    return problema(`el día ${crudo.dia} no existe en ${primeroDelMes.slice(0, 7)}`);
  }

  // ── El monto (§6) ──────────────────────────────────────────────────────────
  //
  // **El número de una celda se pasa como número, nunca como texto.** La primera
  // versión hacía `String(monto)`, y eso le daba a `aMinimas()` —que está hecho
  // para lo que escribe una PERSONA, donde el punto es separador de miles— un
  // texto como "80.13149784261351". Leído con reglas humanas, eso está mal
  // escrito, y lo rechazaba con razón.
  //
  // El resultado: **127 filas de la planilla real del usuario rechazadas por un
  // error de traducción**, todas con montos perfectamente válidos. El número ya
  // estaba; convertirlo a texto para volver a interpretarlo fue meter un
  // traductor entre dos que ya se entendían.
  //
  // Los decimales largos son conversiones de moneda hechas con fórmulas en la
  // planilla: `2.245250431778929` son 2,25 €. `aMinimas()` los redondea al
  // céntimo, que es la unidad en la que la app guarda el dinero (ADR-005).
  const monto = crudo.monto;
  if (monto === undefined || monto === null || monto === '') {
    return problema('el monto está vacío');
  }
  if (typeof monto === 'number' && !Number.isFinite(monto)) {
    return problema('el monto de la celda no es un número que se pueda usar');
  }
  if (typeof monto === 'number' && monto < 0) {
    // Podría ser una devolución o un dedazo, y no hay forma de saber cuál.
    return problema(`el monto es negativo (${monto})`);
  }
  if (monto === 0) {
    // El modelo no guarda movimientos de cero desde T-003 —«si no hubo dinero de
    // por medio, no hay nada que registrar»— y esa decisión manda. Se detecta
    // acá igual, en vez de dejar que lo rechace el modelo, para poder decirlo
    // con el número de fila y distinguirlo de la celda vacía: un 0 escrito a
    // mano casi siempre es una fila a medio cargar que el usuario va a querer
    // mirar.
    return problema('el monto es 0, así que no hay nada que registrar');
  }

  const contenido = `${fecha}|${tipo}|${rubro}|${monto}|${crudo.comentario}|${crudo.detalle}`;

  try {
    return {
      movimiento: crearMovimiento(
        {
          tipo,
          rubro,
          // Todos los importes de la planilla están en euros, convertidos a mano
          // por el usuario (decidido con él, 2026-08-28).
          moneda: 'EUR',
          // Tal cual: si la celda trae un número, va el número; si trae texto
          // —hay celdas escritas a mano en la planilla—, va el texto y lo
          // interpreta `aMinimas()` con las reglas de escritura de siempre.
          monto,
          fecha,
          comentario: crudo.comentario,
          detalle: crudo.detalle,
        },
        { decimales: 2, id: idDeFila(numero, contenido), creado: fecha }
      ),
    };
  } catch (error) {
    // La última red: si el modelo rechaza algo que el mapeo dio por bueno, se
    // informa en vez de romper la importación entera.
    return problema(error.message);
  }
}

/**
 * Traduce la planilla entera.
 *
 * Devuelve los movimientos, los problemas fila por fila, y **las comprobaciones
 * de cada mes** (ver abajo).
 */
export function interpretarPlanilla(filas) {
  const movimientos = [];
  const problemas = [];
  const acumulados = new Map();
  const sumas = new Map();
  const cuantos = new Map();

  const numeros = [...filas.keys()].sort((a, b) => a - b);

  for (const numero of numeros) {
    const celdas = filas.get(numero);
    if (!esFilaDeDatos(celdas)) continue;

    const resultado = interpretarFila(numero, celdas);
    if (resultado.problema) {
      problemas.push(resultado.problema);
      continue;
    }

    const movimiento = resultado.movimiento;
    movimientos.push(movimiento);

    // Para la comprobación: la suma de gastos de cada mes, y el último valor de
    // la columna de acumulado que traía la planilla.
    const mes = movimiento.fecha.slice(0, 7);
    if (movimiento.tipo === TIPO_GASTO) {
      sumas.set(mes, (sumas.get(mes) ?? 0) + movimiento.monto);
      cuantos.set(mes, (cuantos.get(mes) ?? 0) + 1);
      const acumulado = celdas.get(COL_ACUMULADO)?.valor;
      if (typeof acumulado === 'number') acumulados.set(mes, Math.round(acumulado * 100));
    }
  }

  return { movimientos, problemas, comprobaciones: comprobar(sumas, acumulados, cuantos) };
}

/**
 * Compara lo importado contra el acumulado que traía la planilla — §6 del mapeo.
 *
 * Es la única oportunidad de contrastar el resultado con un número que **calculó
 * otra herramienta**. Después de importar, la planilla se archiva y no queda con
 * qué comparar: si acá no se mira, no se mira nunca.
 *
 * Una diferencia no significa necesariamente que la app se equivocó —puede ser
 * que la planilla tuviera una fórmula con un rango corto, que es justamente
 * L-001—, pero significa que **alguno de los dos está mal** y hay que mirarlo.
 */
export function comprobar(sumas, acumulados, cuantos = new Map()) {
  const comprobaciones = [];

  for (const mes of [...sumas.keys()].sort()) {
    const importado = sumas.get(mes);
    const enLaPlanilla = acumulados.get(mes);
    if (enLaPlanilla === undefined) continue;

    // **La tolerancia crece con la cantidad de filas, y tiene que ser así.**
    // Muchos montos de la planilla son el resultado de una fórmula de
    // conversión de moneda y traen decimales largos: `2.245250431778929`. La
    // app guarda céntimos enteros (ADR-005), así que cada uno se redondea, y
    // cada redondeo mueve hasta medio céntimo. Con cien filas, medio euro de
    // diferencia es aritmética, no un dato perdido.
    //
    // Una tolerancia fija de un céntimo marcaría como sospechosos meses que
    // están perfectos, y un aviso que salta cuando todo está bien es un aviso
    // que se aprende a ignorar — que es lo último que puede pasar con el único
    // control que existe sobre una importación de once meses.
    const filas = cuantos.get(mes) ?? 1;
    const tolerancia = Math.max(1, Math.ceil(filas / 2));
    const diferencia = importado - enLaPlanilla;

    comprobaciones.push({
      mes, importado, enLaPlanilla, diferencia,
      coincide: Math.abs(diferencia) <= tolerancia,
    });
  }

  return comprobaciones;
}

/** El texto de una celda, normalizado, o cadena vacía. */
function texto(celda) {
  return celda === undefined ? '' : normalizarTextoVisible(String(celda.valor ?? ''));
}

/** Lo que decía la fila, para poder reconocerla en la planilla. */
function describir({ dia, rubro, monto, comentario, detalle }) {
  const partes = [
    dia !== undefined ? `día ${dia}` : null,
    rubro ? `rubro "${rubro}"` : null,
    monto !== undefined && monto !== null && monto !== '' ? `monto ${monto}` : null,
    comentario ? `comentario "${comentario}"` : null,
    detalle ? `detalle "${detalle}"` : null,
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(', ') : 'la fila estaba casi vacía';
}
