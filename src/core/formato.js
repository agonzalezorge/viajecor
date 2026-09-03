// Cómo se muestran los montos y las fechas.
//
// Es el único módulo cuyo trabajo es puramente cosmético, y aun así puede mentir:
// un importe formateado con los decimales equivocados o una fecha corrida un día
// son errores que el usuario ve como datos, no como fallas de presentación. Y a
// diferencia de un cálculo mal, nadie los va a descubrir con un test de negocio:
// se descubren mirando la pantalla y desconfiando.
//
// Sin librerías: `Intl` viene en el navegador y en Node (ADR-003).
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { aNumero, DECIMALES_EURO } from './dinero.js';
import { normalizarMoneda, validarFecha } from './modelo.js';
import { decimalesDe } from './monedas.js';

// El español de España: coma decimal, punto de miles, y la fecha como
// día/mes/año. Es el idioma en el que el usuario piensa sus gastos.
export const IDIOMA = 'es-ES';

/**
 * Un monto guardado, listo para mostrar: `1250` con 2 decimales sale `12,50 €`.
 *
 * **Los decimales los manda el catálogo del usuario, no `Intl`.** Es la parte
 * que importa de esta función. `Intl` trae su propia idea de cuántos decimales
 * usa cada moneda —para el yen, cero— y si la dejáramos decidir, una moneda que
 * el usuario configuró distinto se mostraría con otros decimales de los que se
 * guardó. El número seguiría siendo correcto por dentro y la pantalla estaría
 * mintiendo. Se fuerzan los nuestros, en los dos sentidos (mínimo y máximo).
 *
 * Para un código de moneda que no existe en el estándar —el usuario puede
 * inventar el que quiera (ADR-011)— `Intl` no falla: muestra el código tal cual,
 * `1.234,50 XYZ`. Comprobado, no supuesto.
 */
export function formatearMonto(minimas, decimales, moneda = 'EUR') {
  const codigo = normalizarMoneda(moneda);
  const numero = aNumero(minimas, decimales);

  return new Intl.NumberFormat(IDIOMA, {
    style: 'currency',
    currency: codigo,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(numero);
}

/**
 * Un importe en **su** moneda, con los decimales que esa moneda usa.
 *
 * Los decimales salen del catálogo del usuario (ADR-011) en vez de suponer dos:
 * el yen usa cero, y mostrar `¥1.500,00` es mostrar un número que no existe.
 *
 * **Si la moneda no está en el catálogo, se muestran dos y no se rompe nada.**
 * Puede pasar con un respaldo viejo o una moneda borrada, y una pantalla en
 * blanco es peor que un importe con dos decimales de más.
 */
export function formatearEnSuMoneda(minimas, moneda, monedas) {
  let decimales = 2;
  try {
    decimales = decimalesDe(monedas ?? [], moneda);
  } catch {
    // Ver arriba: se muestra igual.
  }
  return formatearMonto(minimas, decimales, moneda);
}

/** Un importe en céntimos de euro, que es la unidad de todos los totales. */
export function formatearEuros(centimos, base = 'EUR') {
  return formatearMonto(centimos, DECIMALES_EURO, base);
}

/**
 * Un total, en la moneda base que el usuario haya elegido — T-050.
 *
 * Es `formatearEuros` con el nombre que corresponde desde que la base dejó de
 * ser siempre el euro. El nombre viejo queda porque lo usan veintiséis lugares
 * y renombrarlos todos de una es más riesgo que valor: los dos hacen lo mismo.
 *
 * **Siempre dos decimales**, sea cual sea la base. Los totales de la app se
 * calculan en centésimas desde ADR-005 y cambiar eso tocaría cada cuenta del
 * programa. Con euros y pesos uruguayos —las bases que hay— es exacto.
 */
export function formatearEnBase(minimas, base = 'EUR') {
  return formatearMonto(minimas, DECIMALES_EURO, base);
}

/**
 * Un monto sin el símbolo de la moneda, para las tablas donde la moneda ya está
 * en otra columna y repetirla en cada fila es ruido.
 *
 * `decimales` dice **cuántos tiene el número guardado** y `mostrar`, cuántos
 * escribir. Son distintos en el eje de un gráfico: `2.100,00` ocupa el doble que
 * `2.100` en el margen de un teléfono y no dice nada más. Por omisión son el
 * mismo, que es el caso de siempre.
 */
export function formatearNumero(minimas, decimales, mostrar = decimales) {
  return new Intl.NumberFormat(IDIOMA, {
    minimumFractionDigits: mostrar,
    maximumFractionDigits: mostrar,
  }).format(aNumero(minimas, decimales));
}

/**
 * El rótulo de un rubro, con la primera letra en mayúscula: `gastos fijos` se
 * muestra como `Gastos fijos`.
 *
 * Solo cambia cómo SE VE. Guardado sigue en minúsculas, que es su forma
 * canónica y la que hace que `VIAJES` y `viajes` sean el mismo rubro (RN-03).
 * Poner la mayúscula acá y no en el dato es lo que permite tener las dos cosas.
 *
 * Va la primera letra de la frase y no la de cada palabra: en español se escribe
 * "Gastos fijos", no "Gastos Fijos".
 */
export function formatearRubro(rubro) {
  const texto = String(rubro ?? '').trim();
  if (texto === '') return '';
  return texto[0].toLocaleUpperCase(IDIOMA) + texto.slice(1);
}

// ── Fechas ───────────────────────────────────────────────────────────────────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Convierte `AAAA-MM-DD` en un `Date` fijado al mediodía UTC.
 *
 * **Por qué no `new Date('2026-03-14')` a secas:** eso da la medianoche UTC, y
 * al mostrarla el navegador la traduce a la zona horaria del dispositivo. En
 * Montevideo (UTC−3) la medianoche del 14 es **las 21:00 del 13**, así que la
 * app mostraría un día menos. Comprobado, no supuesto:
 *
 *     America/Montevideo  →  13/3/2026     ← el gasto se ve el día anterior
 *     Europe/Madrid       →  14/3/2026
 *
 * Y no es un caso de laboratorio: el usuario tiene ahorros y gastos en pesos
 * uruguayos. Un gasto que aparece un día antes en el celular es indistinguible
 * de un error de carga, y ensucia el gasto por día (CU-05).
 *
 * La fecha de un movimiento es un día del calendario, no un instante: no tiene
 * hora ni zona. Fijarla al mediodía UTC hace que ninguna zona horaria del mundo
 * —de UTC−12 a UTC+14— la corra de día.
 */
function comoFecha(iso) {
  const [anio, mes, dia] = validarFecha(iso).split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}

/**
 * `2026-03-14` → `14/03/2026`. Para listas.
 *
 * Con día y mes de dos dígitos siempre, aunque `Intl` por omisión escriba
 * `14/3/2026`: en una lista de gastos las fechas se leen en columna, y el ancho
 * fijo hace que se puedan comparar de un vistazo.
 */
export function formatearFecha(iso) {
  return new Intl.DateTimeFormat(IDIOMA, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(comoFecha(iso));
}

/** `2026-03-14` → `14 de marzo de 2026`. Para encabezados y confirmaciones. */
export function formatearFechaLarga(iso) {
  const [anio, mes, dia] = validarFecha(iso).split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

/** `2026-03-14` → `sábado`. Para el detalle del día. */
export function formatearDiaSemana(iso) {
  return new Intl.DateTimeFormat(IDIOMA, { weekday: 'long', timeZone: 'UTC' }).format(comoFecha(iso));
}

/**
 * `2026-03` → `marzo de 2026`. Es el título de la pantalla del mes.
 *
 * Recibe el mes como `AAAA-MM` y no una fecha, porque el mes es lo que agrupa
 * (RN-04) y pedir una fecha obligaría a inventar un día.
 */
export function formatearMes(mes) {
  if (typeof mes !== 'string' || !/^\d{4}-\d{2}$/.test(mes)) {
    throw new Error(`El mes se escribe como AAAA-MM (por ejemplo 2026-03), y llegó ${JSON.stringify(mes)}.`);
  }
  const numeroMes = Number(mes.slice(5));
  if (numeroMes < 1 || numeroMes > 12) {
    throw new Error(`No existe el mes ${mes}.`);
  }
  return `${MESES[numeroMes - 1]} de ${mes.slice(0, 4)}`;
}

/**
 * `2026-03` → `mar 26`. Para la columna de meses de la evolución (T-021).
 *
 * `marzo de 2026` completo haría que la única columna que no se puede achicar
 * —la que queda fija al deslizar— se comiera media pantalla del teléfono. Se
 * abrevia el mes y se deja el año, que es lo que se necesita para no confundir
 * marzo de 2025 con marzo de 2026 en una tabla de varios años.
 */
export function formatearMesCorto(mes) {
  const largo = formatearMes(mes);
  return `${largo.slice(0, 3)} ${mes.slice(2, 4)}`;
}

/**
 * El tipo de cambio como el usuario lo conoce: "1 EUR = 630,25 CRC".
 *
 * Se muestra en el sentido de "cuántas unidades por unidad de la base" y no al
 * revés, aunque
 * por dentro se guarde al revés (ADR: `core/cambio.js`). Un `0,001587` en
 * pantalla no le dice nada a nadie; `630,25` es el número que la persona vio en
 * la casa de cambio.
 */
export function formatearTipoDeCambio(eurosPorUnidad, moneda, base = 'EUR') {
  const codigo = normalizarMoneda(moneda);
  if (!Number.isFinite(eurosPorUnidad) || eurosPorUnidad <= 0) {
    throw new Error('El tipo de cambio tiene que ser un número mayor que cero.');
  }

  const unidadesPorEuro = 1 / eurosPorUnidad;
  // Los decimales que se muestran dependen de la magnitud: con 630 colones por
  // euro sobran dos, pero con 1,08 dólares por euro dos decimales esconderían la
  // diferencia entre 1,085 y 1,089 — que en un mes de gastos son varios euros.
  const decimales = unidadesPorEuro >= 100 ? 2 : unidadesPorEuro >= 1 ? 4 : 6;

  const numero = new Intl.NumberFormat(IDIOMA, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(unidadesPorEuro);

  return `1 ${normalizarMoneda(base)} = ${numero} ${codigo}`;
}
