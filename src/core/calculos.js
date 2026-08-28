// Los cálculos del mes — CU-04 y CU-05.
//
// Este archivo reemplaza los bloques `GASTOS POR TIPO`, `INGRESOS POR TIPO`,
// `TOTALES` y `GASTO POR DÍA` del Excel original, y existe sobre todo para no
// repetir su error más grave:
//
//   **Ninguna función de acá recibe un rango.** Todas reciben la lista completa
//   de movimientos y filtran adentro. En la planilla, cada fórmula suma hasta
//   una fila escrita a mano ($G$8:$G$1027) y el día que el registro pase esa
//   fila los totales van a dar de menos, sin ningún aviso (L-001). No fallan:
//   mienten. Si alguna vez aparece un número máximo de filas en este archivo,
//   es un error, no una optimización.
//
// Todo se devuelve en **céntimos de euro** (RN-04). Formatearlo es de
// `core/formato.js`; decidir qué se muestra, de la pantalla.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { sumar, redondear } from './dinero.js';
import { mesDe, TIPO_GASTO, TIPO_INGRESO, rubrosDe, normalizarClave, normalizarTextoVisible, claveDeComentario } from './modelo.js';
import { movimientoEnEuros, faltaCambioPara } from './cambio.js';

/** Los movimientos de un mes. Recorre la lista entera, sin ningún tope (L-001). */
export function movimientosDelMes(movimientos, mes) {
  if (!Array.isArray(movimientos)) return [];
  return movimientos.filter((m) => mesDe(m.fecha) === mes);
}

/** Los meses que tienen al menos un movimiento, del más nuevo al más viejo. */
export function mesesConMovimientos(movimientos) {
  if (!Array.isArray(movimientos)) return [];
  return [...new Set(movimientos.map((m) => mesDe(m.fecha)))].sort().reverse();
}

/** Cuántos días tiene un mes. Se calcula: febrero de 2028 tiene 29. */
export function diasDelMes(mes) {
  const anio = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5));
  return new Date(Date.UTC(anio, numero, 0)).getUTCDate();
}

/**
 * Separa los movimientos que se pueden convertir a euros de los que no.
 *
 * Un movimiento sin tipo de cambio **no se cuenta como cero** y **no se
 * descarta en silencio**: sale aparte, para que la pantalla pueda decir que el
 * total está incompleto. Un total al que le falta un gasto y que no lo dice es
 * peor que no mostrar ningún total: parece completo.
 *
 * Cargar un movimiento así no debería ser posible (RN-04, T-012), pero puede
 * llegar desde un respaldo importado o desde datos editados a mano.
 */
export function separarConvertibles(movimientos, cambios) {
  const convertibles = [];
  const sinConvertir = [];
  for (const movimiento of movimientos) {
    if (faltaCambioPara(movimiento, cambios)) sinConvertir.push(movimiento);
    else convertibles.push(movimiento);
  }
  return { convertibles, sinConvertir };
}

function enEuros(movimientos, cambios, monedas) {
  return movimientos.map((m) => movimientoEnEuros(m, cambios, monedas));
}

/**
 * Los tres números del mes: gastos, ingresos y saldo. Reemplaza el bloque
 * `TOTALES` del Excel.
 *
 * `saldo` es ingresos − gastos y **puede ser negativo**, que es justamente el
 * caso en que mirarlo importa.
 */
export function totalesDelMes(estado, mes) {
  const delMes = movimientosDelMes(estado.movimientos, mes);
  const { convertibles, sinConvertir } = separarConvertibles(delMes, estado.tipos_cambio);

  const gastos = sumar(
    enEuros(convertibles.filter((m) => m.tipo === TIPO_GASTO), estado.tipos_cambio, estado.monedas)
  );
  const ingresos = sumar(
    enEuros(convertibles.filter((m) => m.tipo === TIPO_INGRESO), estado.tipos_cambio, estado.monedas)
  );

  return {
    gastos,
    ingresos,
    saldo: ingresos - gastos,
    cuantos: delMes.length,
    sinConvertir,
  };
}

/**
 * El desglose por rubro, de mayor a menor. Reemplaza `GASTOS POR TIPO` e
 * `INGRESOS POR TIPO`.
 *
 * Devuelve **solo los rubros con movimientos**: una fila en cero por cada rubro
 * que no usaste llena la pantalla de nada. El porcentaje es sobre el total de
 * ese tipo en ese mes.
 */
export function porRubro(estado, mes, tipo) {
  const delMes = movimientosDelMes(estado.movimientos, mes);
  const { convertibles } = separarConvertibles(delMes, estado.tipos_cambio);
  const delTipo = convertibles.filter((m) => m.tipo === tipo);

  const acumulado = new Map();
  for (const movimiento of delTipo) {
    const euros = movimientoEnEuros(movimiento, estado.tipos_cambio, estado.monedas);
    const anterior = acumulado.get(movimiento.rubro) ?? { rubro: movimiento.rubro, total: 0, cuantos: 0 };
    acumulado.set(movimiento.rubro, {
      rubro: movimiento.rubro,
      total: anterior.total + euros,
      cuantos: anterior.cuantos + 1,
    });
  }

  const total = sumar([...acumulado.values()].map((r) => r.total));

  return [...acumulado.values()]
    .map((r) => ({ ...r, porcentaje: total === 0 ? 0 : (r.total / total) * 100 }))
    // De mayor a menor, y con el nombre como desempate para que el orden no
    // dependa de en qué orden se cargaron dos rubros que suman lo mismo.
    .sort((a, b) => b.total - a.total || a.rubro.localeCompare(b.rubro));
}

/** Los rubros de un tipo que el usuario NO usó este mes. Para el detalle. */
export function rubrosSinUsar(estado, mes, tipo) {
  const usados = new Set(porRubro(estado, mes, tipo).map((r) => normalizarClave(r.rubro)));
  return rubrosDe(tipo).filter((r) => !usados.has(r));
}

/**
 * Día por día del mes — CU-05. Reemplaza el bloque `GASTO POR DÍA`.
 *
 * Devuelve **todos** los días del mes, incluidos los que no tienen nada: el
 * acumulado tiene que poder leerse como una línea continua, y un día faltante
 * en el medio se lee como si ese día no hubiera existido.
 */
export function porDia(estado, mes) {
  const delMes = movimientosDelMes(estado.movimientos, mes);
  const { convertibles } = separarConvertibles(delMes, estado.tipos_cambio);

  const gastoPorDia = new Map();
  const ingresoPorDia = new Map();
  for (const movimiento of convertibles) {
    const dia = Number(movimiento.fecha.slice(8));
    const euros = movimientoEnEuros(movimiento, estado.tipos_cambio, estado.monedas);
    const donde = movimiento.tipo === TIPO_GASTO ? gastoPorDia : ingresoPorDia;
    donde.set(dia, (donde.get(dia) ?? 0) + euros);
  }

  const dias = [];
  let gastoAcumulado = 0;
  let ingresoAcumulado = 0;

  for (let dia = 1; dia <= diasDelMes(mes); dia += 1) {
    const gasto = gastoPorDia.get(dia) ?? 0;
    const ingreso = ingresoPorDia.get(dia) ?? 0;
    gastoAcumulado += gasto;
    ingresoAcumulado += ingreso;
    dias.push({
      dia,
      fecha: `${mes}-${String(dia).padStart(2, '0')}`,
      gasto,
      ingreso,
      gastoAcumulado,
      ingresoAcumulado,
    });
  }
  return dias;
}

/**
 * El promedio de gasto por día del mes.
 *
 * **Divide por los días transcurridos, no por los del mes**, cuando el mes es el
 * que está en curso: a mitad de mes, dividir por 31 da un promedio artificalmente
 * bajo y hace creer que se está gastando menos de lo real. Para un mes ya
 * terminado los dos números coinciden.
 *
 * `hasta` es el día hasta el que contar; sin él, el mes entero.
 */
export function promedioPorDia(estado, mes, hasta) {
  const { gastos } = totalesDelMes(estado, mes);
  const dias = Math.min(hasta ?? diasDelMes(mes), diasDelMes(mes));
  if (dias <= 0) return 0;
  return redondear(gastos / dias);
}

/**
 * Los comentarios usados en un mes, con su total. Es la base de "cuánto costó un
 * viaje" (CU-11) y del promedio de gastos fijos (CU-12).
 *
 * Agrupa por la **clave** del comentario, no por el texto: `Roma` y `roma` son
 * el mismo viaje (RN-03, L-003). Se muestra la primera escritura que apareció.
 */
export function porComentario(estado, mes) {
  const movimientos = mes ? movimientosDelMes(estado.movimientos, mes) : estado.movimientos;
  const { convertibles } = separarConvertibles(movimientos, estado.tipos_cambio);

  const acumulado = new Map();
  for (const movimiento of convertibles) {
    if (!movimiento.comentario) continue;
    const clave = normalizarClave(movimiento.comentario);
    const euros = movimientoEnEuros(movimiento, estado.tipos_cambio, estado.monedas);
    const anterior = acumulado.get(clave);
    acumulado.set(clave, {
      clave,
      comentario: anterior?.comentario ?? movimiento.comentario,
      total: (anterior?.total ?? 0) + euros,
      cuantos: (anterior?.cuantos ?? 0) + 1,
    });
  }

  return [...acumulado.values()]
    .map((c) => ({ ...c, promedio: redondear(c.total / c.cuantos) }))
    .sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}

/**
 * Los comentarios que el usuario ya usó, del más reciente al más viejo — T-912.
 *
 * Sirve para ofrecerlos mientras escribe. **No es una comodidad:** el comentario
 * es lo que agrupa los gastos de un viaje (RN-03), y `Barcelona26` y
 * `barcelona 26` son dos viajes distintos en los totales. Ofrecer lo que ya
 * existe es la forma más barata de que el usuario elija la escritura que ya
 * tiene en vez de inventar una nueva.
 *
 * Se devuelve **la primera escritura que apareció** de cada comentario, igual
 * que `porComentario()`: dos criterios distintos para elegir cómo se escribe un
 * grupo terminarían mostrando dos nombres para la misma cosa.
 *
 * El orden es por el movimiento más reciente que lo usó: el viaje en curso queda
 * arriba, que es el que se va a repetir.
 *
 * No recibe ningún límite: recorre la lista entera (L-001).
 */
export function comentariosUsados(movimientos) {
  return textosUsados(movimientos, 'comentario');
}

/** Lo mismo para los detalles: `alquiler`, `luz`, `psicóloga` se repiten. */
export function detallesUsados(movimientos) {
  return textosUsados(movimientos, 'detalle');
}

/**
 * Los textos ya escritos en un campo, del más reciente al más viejo.
 *
 * Es la misma función para el comentario y para el detalle. Se generalizó cuando
 * el usuario probó el autocompletado en el detalle (2026-08-28): tenía razón en
 * esperarlo ahí, y dos copias de esto habrían sido dos formas de agrupar.
 */
function textosUsados(movimientos, campo) {
  if (!Array.isArray(movimientos)) return [];

  const porClave = new Map();

  for (const movimiento of movimientos) {
    const texto = normalizarTextoVisible(movimiento?.[campo] ?? '');
    if (texto === '') continue;

    const clave = claveDeComentario(texto);
    const visto = porClave.get(clave);
    const cuando = movimiento.fecha ?? '';

    if (!visto) {
      porClave.set(clave, { texto, ultima: cuando });
    } else if (cuando > visto.ultima) {
      // Se actualiza cuándo se usó por última vez, pero NO el texto: la
      // escritura que se muestra sigue siendo la primera que apareció.
      visto.ultima = cuando;
    }
  }

  return [...porClave.values()]
    .sort((a, b) => b.ultima.localeCompare(a.ultima) || a.texto.localeCompare(b.texto))
    .map((c) => c.texto);
}

/**
 * Las sugerencias para lo que se está escribiendo — T-920.
 *
 * Coincide por **clave normalizada** y no por el texto tal cual: escribir `barce`
 * tiene que ofrecer `Barcelona26`, porque si hubiera que acertar las mayúsculas
 * el autocompletado no serviría para lo único que sirve, que es no volver a
 * escribir lo mismo de otra manera (RN-03).
 *
 * Se ofrece lo que **empieza** con lo escrito primero, y después lo que lo
 * contiene en el medio. Escribir `Roma` y que aparezca `Aeropuerto de Roma`
 * antes que `Roma` sería contraintuitivo.
 *
 * Con el campo vacío no se ofrece nada: una lista de veinte sugerencias apenas
 * se toca el campo tapa el formulario en un celular.
 */
export function sugerenciasPara(escrito, usados, limite = 5) {
  const visible = normalizarTextoVisible(String(escrito ?? ''));
  const clave = normalizarClave(visible);
  if (clave === '') return [];

  const empiezan = [];
  const contienen = [];

  for (const texto of usados) {
    // Se saltea solo lo que ya está escrito **igual**, no lo que coincide en
    // clave: si escribió `roma` y existe `Roma`, hay que ofrecerlo. Ahí está
    // todo el sentido de esto — que elija la escritura que ya tiene en vez de
    // crear un segundo grupo con la misma palabra (RN-03).
    if (texto === visible) continue;

    const suya = normalizarClave(texto);
    if (suya.startsWith(clave)) empiezan.push(texto);
    else if (suya.includes(clave)) contienen.push(texto);
  }

  return [...empiezan, ...contienen].slice(0, limite);
}
