// Buscar texto en todos los movimientos — CU-17, T-943.
//
// Pedido del usuario (2026-08-29): una lupa en la pestaña de movimientos que
// busque **en todos los movimientos cargados** y **en todos sus campos**.
//
// ── Buscar SÍ saca las tildes; agrupar NO ───────────────────────────────────
//
// Parece una contradicción con ADR-013, que decidió a propósito que `Perú` y
// `Peru` fueran dos etiquetas distintas. No lo es, y la diferencia importa:
//
//   - **Agrupar** junta plata. Sacar tildes automáticamente uniría totales que
//     el usuario quiso separar, y eso no se ve: el número sale mal y listo.
//   - **Buscar** solo muestra. Si de más, se ve; si de menos, el usuario cree
//     que el gasto no existe. Equivocarse siendo generoso es barato y visible;
//     equivocarse siendo estricto esconde datos.
//
// Por eso acá `Peru` encuentra `Perú`, y en los totales siguen siendo dos.
//
// ── Varias palabras: todas tienen que estar ─────────────────────────────────
//
// `roma cena` trae los movimientos que tienen **las dos**, no los que tienen
// alguna. Buscar dos palabras es como acordarse de dos cosas del mismo gasto, no
// de dos gastos distintos.
//
// Este archivo no toca el navegador. Es lógica pura y se testea con node --test.

import { TIPO_GASTO } from './modelo.js';
import { formatearFecha, formatearMonto, formatearEuros, formatearRubro } from './formato.js';
import { decimalesDe, monedaBaseDe } from './monedas.js';
import { movimientoEnEuros, faltaCambioPara } from './cambio.js';

/**
 * Deja un texto listo para comparar: sin tildes, en minúsculas y con un solo
 * espacio entre palabras.
 *
 * `normalize('NFD')` parte cada letra acentuada en la letra y su tilde, y el
 * reemplazo borra las tildes sueltas. Es la forma estándar y no una lista de
 * pares `á→a`, que se olvida de la ü o de las letras de otro idioma.
 *
 * **La ñ se salva a mano, y no es un detalle.** Para Unicode es una `n` con
 * tilde y `NFD` la parte igual que a la `á`; para el español es **otra letra**.
 * Sin esta línea, buscar `ano` encontraría todos los `año`, que además de
 * incorrecto es cómico. Se cambia por un carácter que no se usa nunca, se
 * normaliza el resto, y se vuelve a poner.
 */
const RESGUARDO_ENIE = '\u0000';

export function normalizarBusqueda(texto) {
  return String(texto ?? '')
    .replace(/ñ/g, RESGUARDO_ENIE)
    .replace(/Ñ/g, RESGUARDO_ENIE)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(new RegExp(RESGUARDO_ENIE, 'g'), 'ñ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Todo lo que un movimiento "dice", en un solo texto para buscar adentro.
 *
 * Lleva **cada campo en las dos formas**: como se guarda y como se muestra. Sin
 * eso, buscar `12,50` no encontraría un monto guardado como `1250`, y buscar
 * `14/03/2026` no encontraría una fecha guardada como `2026-03-14` — y el
 * usuario busca por lo que ve en la pantalla, no por lo que hay en el archivo.
 */
export function textoDeMovimiento(estado, movimiento) {
  const partes = [
    movimiento.comentario,
    movimiento.detalle,
    movimiento.rubro,
    formatearRubro(movimiento.rubro),
    movimiento.moneda,
    movimiento.fecha,
    movimiento.tipo === TIPO_GASTO ? 'gasto' : 'ingreso',
  ];

  try {
    partes.push(formatearFecha(movimiento.fecha));
  } catch {
    // Una fecha ilegible no puede dejar al movimiento fuera de toda búsqueda:
    // sigue estando por su etiqueta, su rubro y su importe.
  }

  try {
    const decimales = decimalesDe(estado.monedas, movimiento.moneda);
    partes.push(formatearMonto(movimiento.monto, decimales, movimiento.moneda));
    // El monto sin separadores ni símbolo, para que `1250` también encuentre
    // `1.250,00 €`.
    partes.push(String(movimiento.monto));

    // Y su valor en euros, que es el número que se ve en las listas cuando el
    // gasto es en otra moneda.
    if (movimiento.moneda !== 'EUR' && !faltaCambioPara(movimiento, estado.tipos_cambio)) {
      partes.push(formatearEuros(
        movimientoEnEuros(movimiento, estado.tipos_cambio, estado.monedas, monedaBaseDe(estado)),
        monedaBaseDe(estado),
      ));
    }
  } catch {
    partes.push(String(movimiento.monto));
  }

  return normalizarBusqueda(partes.filter(Boolean).join(' '));
}

/** Las palabras de lo buscado. Vacío si no se escribió nada que buscar. */
export function palabrasDe(texto) {
  const limpio = normalizarBusqueda(texto);
  return limpio === '' ? [] : limpio.split(' ');
}

/**
 * Los movimientos que tienen **todas** las palabras buscadas, del más nuevo al
 * más viejo.
 *
 * Mira **todo el historial**, no el mes que se está viendo: el usuario que
 * busca "psicóloga" no sabe en qué mes fue —si lo supiera no buscaría—, y
 * limitarlo al mes en curso daría "no hay nada" sobre datos que sí están.
 *
 * Sin ningún tope de filas (L-001).
 */
export function buscar(estado, texto) {
  const palabras = palabrasDe(texto);
  if (palabras.length === 0) return [];

  return (estado.movimientos ?? [])
    .filter((movimiento) => {
      const donde = textoDeMovimiento(estado, movimiento);
      return palabras.every((palabra) => donde.includes(palabra));
    })
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha)
      || String(b.creado).localeCompare(String(a.creado)));
}
