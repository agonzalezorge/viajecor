// Mis ahorros: dónde está la plata que no uso todos los días — T-072, CU-22.
//
// ── Qué contesta ────────────────────────────────────────────────────────────
//
// "¿Cuánto tengo guardado, y en qué cuentas?" Plata repartida entre bancos y
// plataformas de inversión, que no se toca en el mes y que —justamente por eso—
// es la más fácil de perder de vista. Lo pidió el usuario (2026-09-22).
//
// ── En qué se parece a los ahorros conjuntos, y en qué no ───────────────────
//
// Se parece en todo lo que importa: es un **historial** de plata que entró y
// salió, no una foto de saldos. Así se ve cómo evolucionó y no solo cuánto hay
// hoy; y corregir un error es anotar el movimiento que faltaba, no pisar un
// número. Y **no se convierte nada a la moneda base**: mil dólares son mil
// dólares, y pasarlos a euros al cambio de hoy inventa un número que cambia
// solo todos los días. Total por moneda, y ninguno que los junte.
//
// Se diferencia en una sola cosa, y es la que obliga a que sea un módulo
// aparte: **dónde está la plata es texto libre**, no una lista cerrada. Los
// ahorros conjuntos son de dos personas con nombre propio —ALE e IRE, y no van
// a cambiar—; las cuentas de alguien no las puede saber la app. Se escriben, y
// la app sugiere las que ya usaste.
//
// ── Por qué sugerir y no una lista para mantener ────────────────────────────
//
// Lo eligió el usuario entre las dos opciones, con el costo dicho: sin lista
// cerrada, "Santander" y "santander " podrían terminar siendo dos cuentas. No
// pasa, porque **agrupar normaliza** (RN-03, L-002): las cuentas se comparan por
// su clave normalizada y se muestran como se escribieron la primera vez. Lo que
// sí se paga es que un error de tipeo de verdad —"Santnder"— crea una cuenta
// nueva, visible en el acto en la lista de totales.
//
// Este archivo no toca el navegador: es lógica pura.

import {
  validarFecha, nuevoId, normalizarClave, normalizarTextoVisible, normalizarMoneda,
} from './modelo.js';
import { aMinimas, sumar } from './dinero.js';
import { AHORRO_ENTRA, AHORRO_SALE, aporteDe, totalPorMonedaDe, ordenadosPorFecha } from './ahorros.js';
import { normalizarBusqueda } from './busqueda.js';


/** Los movimientos guardados. Lista aparte de los ahorros conjuntos. */
export function misAhorrosDe(estado) {
  return estado?.mis_ahorros ?? [];
}

/**
 * Arma un movimiento válido, o tira explicando qué falta.
 *
 * La cuenta se guarda **tal como se escribió** y se compara normalizada, igual
 * que las etiquetas de los gastos (ADR-013 y RN-03). Una cuenta vacía sí se
 * rechaza: el sentido entero de esta pantalla es saber dónde está la plata, y
 * "en algún lado" no es una respuesta.
 */
export function crearMiAhorro(entrada, { decimales, id, creado } = {}) {
  if (!Number.isInteger(decimales)) {
    throw new Error(
      'Falta saber cuántos decimales usa la moneda: sin ese dato el monto se guardaría cien veces más grande o más chico (RN-04b).'
    );
  }

  const cuenta = normalizarTextoVisible(entrada.cuenta ?? '');
  if (cuenta === '') {
    throw new Error('Falta decir dónde está: el banco, la plataforma o la cuenta.');
  }

  const tipo = normalizarClave(String(entrada.tipo ?? ''));
  if (tipo !== AHORRO_ENTRA.toLowerCase() && tipo !== AHORRO_SALE.toLowerCase()) {
    throw new Error(`"${entrada.tipo}" no dice si la plata entró (I) o salió (G) de la cuenta.`);
  }

  const monto = aMinimas(entrada.monto, decimales);
  if (monto === 0) {
    throw new Error('Un movimiento de cero no se guarda: si no hubo dinero de por medio, no hay nada que registrar.');
  }

  return {
    id: id ?? nuevoId('mio'),
    fecha: validarFecha(entrada.fecha),
    cuenta,
    tipo: tipo === AHORRO_ENTRA.toLowerCase() ? AHORRO_ENTRA : AHORRO_SALE,
    monto,
    moneda: normalizarMoneda(entrada.moneda),
    detalle: normalizarTextoVisible(entrada.detalle ?? ''),
    creado: creado ?? validarFecha(entrada.fecha),
  };
}

/** Cuánto hay en cada moneda. Sin ningún total que las junte, a propósito. */
export function totalPorMonedaMio(estado) {
  return totalPorMonedaDe(misAhorrosDe(estado));
}

/**
 * Cuánto hay en cada cuenta, dentro de cada moneda.
 *
 * Solo aparecen las cuentas que tienen movimientos **en esa moneda**: la lista
 * es abierta, así que mostrarlas todas en todas las monedas llenaría la pantalla
 * de ceros que no dicen nada. Es al revés que en los ahorros conjuntos, donde
 * las dos personas van siempre porque son dos y fijas.
 *
 * Una cuenta que quedó en cero **sí se muestra**: que la hayas vaciado es
 * información, y una fila que desaparece se lee como que nunca existió.
 */
export function totalPorCuenta(estado) {
  const lista = misAhorrosDe(estado);

  return totalPorMonedaMio(estado).map(({ moneda, total }) => {
    const deLaMoneda = lista.filter((m) => m.moneda === moneda);

    return {
      moneda,
      total,
      cuentas: cuentasDe(deLaMoneda).map((cuenta) => ({
        cuenta,
        total: sumar(deLaMoneda
          .filter((m) => normalizarClave(m.cuenta) === normalizarClave(cuenta))
          .map(aporteDe)),
      })).sort((a, b) => b.total - a.total || a.cuenta.localeCompare(b.cuenta)),
    };
  });
}

/**
 * Las cuentas que aparecen en una lista, como se escribieron la primera vez.
 *
 * **Se agrupan por su clave normalizada** (RN-03): "Santander" y "santander "
 * son la misma cuenta, y la que gana es la primera forma que se escribió. Sin
 * esto, la lista de totales se llenaría de duplicados que el usuario ve como un
 * error de la app, porque para él escribió lo mismo las dos veces.
 */
export function cuentasDe(lista) {
  const vistas = new Map();

  for (const movimiento of lista ?? []) {
    const clave = normalizarClave(String(movimiento?.cuenta ?? ''));
    if (clave !== '' && !vistas.has(clave)) vistas.set(clave, movimiento.cuenta);
  }

  return [...vistas.values()];
}

/** Las cuentas que ya usaste, para sugerirlas al cargar. Ordenadas alfabéticamente. */
export function cuentasUsadas(estado) {
  return cuentasDe(misAhorrosDe(estado)).sort((a, b) => a.localeCompare(b, 'es'));
}

/** Los movimientos, del más nuevo al más viejo. */
export function misAhorrosOrdenados(estado) {
  return ordenadosPorFecha(misAhorrosDe(estado));
}

/** Uno por su id, o `null`. */
export function buscarMiAhorro(estado, id) {
  return misAhorrosDe(estado).find((m) => m.id === id) ?? null;
}

/**
 * Los que coinciden con lo que se escribió en el buscador.
 *
 * Busca en la cuenta y en el detalle, sin tildes ni mayúsculas, igual que la
 * lista de gastos: quien busca "santander" no debería tener que acordarse de
 * cómo lo escribió.
 */
export function buscarEnMisAhorros(estado, texto) {
  const buscado = normalizarBusqueda(texto ?? '');
  if (buscado === '') return misAhorrosOrdenados(estado);

  return misAhorrosOrdenados(estado).filter((m) =>
    normalizarBusqueda(m.cuenta).includes(buscado)
    || normalizarBusqueda(m.detalle).includes(buscado));
}
