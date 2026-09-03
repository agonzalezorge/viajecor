// Cambiar la moneda base — T-050, CU-20.
//
// ── Qué es la moneda base y por qué cambiarla no es un ajuste más ────────────
//
// Es la moneda en la que se expresan **todos los totales**, la que vale 1 y la
// única que no lleva tipo de cambio. Los movimientos guardan su propia moneda y
// no se tocan nunca; lo que cambia es en qué se suman.
//
// Y ahí está el problema: **los tipos de cambio guardados están expresados en la
// base vieja**. "0,0016" para el colón significa "0,0016 euros por colón", y si
// la base pasa a ser el peso uruguayo ese número deja de querer decir nada.
//
// ── Cómo se reexpresan ───────────────────────────────────────────────────────
//
// Si para un mes existe el tipo de la moneda que va a ser la base nueva, todo lo
// de ese mes se puede reexpresar dividiendo por él:
//
//     nuevo(moneda) = viejo(moneda) / viejo(baseNueva)
//
// Y la base vieja pasa a ser una moneda más, con su propio tipo:
//
//     nuevo(baseVieja) = 1 / viejo(baseNueva)
//
// **En los meses donde no existe el tipo de la base nueva no se puede.** Ahí los
// tipos de ese mes se pierden —y hay que volver a cargarlos—, porque inventar
// una cotización que el usuario no dio es exactamente lo que esta app no hace.
//
// ── Por qué el efecto se mide sobre los movimientos, no sobre los tipos ──────
//
// El caso que duele es justamente el que **no tiene ningún tipo cargado**: un
// historial entero en euros, con base en euros, no necesita ninguna cotización.
// Si mañana la base pasa a ser el peso, cada uno de esos movimientos pasa a
// necesitar el tipo del euro **retroactivamente, en todos los meses en que hay
// datos**, y contar los tipos guardados diría "no se pierde nada" mientras el
// total de todos los meses se queda sin poder calcularse.
//
// Por eso `efectoDeCambiarBase()` simula el cambio y después pregunta, movimiento
// por movimiento, cuáles quedarían sin poder convertirse — y descuenta los que ya
// hoy no se pueden, para no culpar al cambio de base de un faltante anterior.
//
// Este archivo no toca el navegador: es lógica pura.

import { normalizarMoneda, mesDe } from './modelo.js';
import { monedaBaseDe } from './monedas.js';
import { faltaCambioPara } from './cambio.js';

/** El tipo de la moneda que va a ser la base nueva, para un mes. */
function cotizacionDe(cambios, moneda, mes) {
  const encontrado = (cambios ?? []).find(
    (c) => c && normalizarMoneda(c.moneda) === moneda && c.mes === mes,
  );
  return encontrado ? encontrado.euros_por_unidad : null;
}

/**
 * Los tipos de cambio de `cambios`, expresados en `destino` en vez de en
 * `actual`. Los meses sin cotización de `destino` quedan afuera: no se pueden.
 */
function reexpresar(cambios, actual, destino) {
  const salida = [];

  for (const mes of [...new Set(cambios.map((c) => c.mes))]) {
    const cotizacion = cotizacionDe(cambios, destino, mes);
    if (cotizacion === null) continue;   // ese mes no se puede: se pierde

    for (const cambio of cambios.filter((c) => c.mes === mes)) {
      if (normalizarMoneda(cambio.moneda) === destino) continue;  // la nueva base no lleva tipo
      salida.push({ ...cambio, euros_por_unidad: cambio.euros_por_unidad / cotizacion });
    }

    // La base vieja pasa a ser una moneda más y necesita su cotización.
    salida.push({
      moneda: actual,
      mes,
      euros_por_unidad: 1 / cotizacion,
      creado: cambios.find((c) => c.mes === mes)?.creado ?? mes + '-01',
    });
  }

  return salida;
}

/** Qué movimientos no se pueden convertir con estos tipos y esta base. */
function sinConvertir(movimientos, cambios, base) {
  const porMes = new Map();

  for (const movimiento of movimientos) {
    if (!movimiento || !movimiento.fecha) continue;
    if (faltaCambioPara(movimiento, cambios, base) === null) continue;

    const mes = mesDe(movimiento.fecha);
    const monedas = porMes.get(mes) ?? new Set();
    monedas.add(normalizarMoneda(movimiento.moneda));
    porMes.set(mes, monedas);
  }

  return porMes;
}

/**
 * Qué va a pasar si se cambia la base. **No cambia nada**: solo lo cuenta.
 *
 * Devuelve cuántos tipos de cambio se reexpresan, cuáles se pierden, y —lo que
 * de verdad importa— en qué meses van a quedar movimientos sin poder convertirse
 * porque falta la cotización de la moneda nueva.
 */
export function efectoDeCambiarBase(estado, nueva) {
  const destino = normalizarMoneda(nueva);
  const actual = monedaBaseDe(estado);
  const cambios = estado?.tipos_cambio ?? [];
  const movimientos = estado?.movimientos ?? [];

  if (destino === actual) {
    return {
      actual, destino, sinCambios: true, reexpresados: 0, perdidos: [], meses: [],
      faltantes: [], movimientosSinConvertir: 0, movimientosSinConvertirAhora: 0,
    };
  }

  const nuevos = reexpresar(cambios, actual, destino);
  const mesesQueSobreviven = new Set(nuevos.map((c) => c.mes));

  // Los tipos guardados que no se pueden reexpresar: hay que volver a cargarlos.
  const perdidos = cambios
    .filter((c) => !mesesQueSobreviven.has(c.mes))
    .map((c) => ({ moneda: normalizarMoneda(c.moneda), mes: c.mes }));

  // Lo que ya hoy no se puede convertir no lo causa este cambio: se descuenta.
  const rotoAhora = sinConvertir(movimientos, cambios, actual);
  const rotoDespues = sinConvertir(movimientos, nuevos, destino);

  const faltantes = [...rotoDespues.entries()]
    .map(([mes, monedas]) => ({
      mes,
      monedas: [...monedas].sort(),
      nuevo: !rotoAhora.has(mes),
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const cuantos = (mapa) => movimientos.filter(
    (m) => m && m.fecha && mapa.has(mesDe(m.fecha))
      && mapa.get(mesDe(m.fecha)).has(normalizarMoneda(m.moneda)),
  ).length;

  return {
    actual,
    destino,
    sinCambios: false,
    reexpresados: nuevos.length,
    perdidos,
    meses: [...mesesQueSobreviven].sort(),
    // Los meses en los que va a faltar la cotización de la moneda nueva, con las
    // monedas que quedan colgadas en cada uno.
    faltantes,
    movimientosSinConvertir: cuantos(rotoDespues),
    movimientosSinConvertirAhora: cuantos(rotoAhora),
  };
}

/**
 * Cambia la base y reexpresa los tipos de cambio que se puedan.
 *
 * Los movimientos **no se tocan**: cada uno sigue guardado en su moneda y con su
 * monto. Lo único que cambia es en qué moneda se suman.
 */
export function cambiarMonedaBase(estado, nueva) {
  const destino = normalizarMoneda(nueva);
  const actual = monedaBaseDe(estado);
  if (destino === actual) return estado;

  return {
    ...estado,
    tipos_cambio: reexpresar(estado?.tipos_cambio ?? [], actual, destino),
    preferencias: { ...estado?.preferencias, moneda_base: destino },
  };
}
