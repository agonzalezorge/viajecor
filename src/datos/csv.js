// Exportar a CSV — T-018, CU-07.
//
// El `.xlsx` (T-906) es para mirar: tiene la forma de la planilla de siempre,
// con sus colores y sus bloques. El CSV es para **procesar**: una fila por
// movimiento, todas las columnas, sin adornos. Son dos cosas distintas y por eso
// existen las dos.
//
// ── Las tres decisiones que hacen que un CSV se abra bien o mal ──────────────
//
// Un CSV mal exportado no falla: se abre y muestra cosas equivocadas. Es la
// forma de fallar más cara que hay, y depende de tres detalles que nadie mira.
//
//   1. **El separador es `;`, no `,`.** En español la coma es el separador
//      decimal: `12,50` con separador coma se parte en dos columnas, `12` y
//      `50`. Excel en español espera `;` y es lo que produce cuando exporta.
//   2. **El archivo lleva BOM.** Sin esos tres bytes al principio, Excel abre el
//      archivo como si fuera de los años 90 y `Ñandú` se convierte en `Ã‘andÃº`.
//      Todos los demás programas lo ignoran sin quejarse.
//   3. **Los decimales van con coma**, `12,50`, porque el separador ya es `;` y
//      porque es lo que el usuario ve en la app y en su planilla.
//
// ── Qué lleva, y por qué más que el `.xlsx` ─────────────────────────────────
//
// La planilla lleva **solo euros**, porque el usuario la mira y sumar una
// columna con monedas mezcladas daría un número sin sentido. El CSV lleva las
// dos cosas —el monto original con su moneda, el cambio que se aplicó y el
// importe en euros—, porque es el formato para hacer cuentas en otro lado, y ahí
// perder el dato original sí duele. Un CSV que redondea es un CSV que miente.

import { movimientosDelMes, mesesConMovimientos } from '../core/calculos.js';
import { movimientoEnEuros, faltaCambioPara, buscarCambio, aUnidadesPorEuro } from '../core/cambio.js';
import { mesDe, hoy } from '../core/modelo.js';
import { decimalesDe } from '../core/monedas.js';
import { formatearRubro } from '../core/formato.js';

export const TIPO_CSV = 'text/csv;charset=utf-8';

/**
 * Los tres bytes que le dicen a Excel que el archivo está en UTF-8.
 *
 * Sin ellos, Excel en Windows lo abre con la codificación del sistema y los
 * acentos se rompen. No es un detalle estético: `Coruña` y `CoruÃ±a` son dos
 * comentarios distintos, así que un archivo sin BOM **parte los grupos en dos**
 * apenas se lo vuelve a leer.
 */
export const MARCA_UTF8 = '﻿';

/** El separador. Ver arriba: con `,` los importes se parten en dos columnas. */
export const SEPARADOR = ';';

export const COLUMNAS = Object.freeze([
  'fecha', 'dia', 'mes', 'tipo', 'rubro', 'comentario', 'detalle',
  'moneda', 'monto', 'unidades_por_euro', 'euros',
]);

/** El nombre del archivo: la fecha adelante, para que ordenen solos. */
export function nombreDelCsv(fecha = hoy()) {
  return `viajecor-${fecha}.csv`;
}

/**
 * Un valor, listo para meter en el archivo.
 *
 * Se entrecomilla lo que lo necesita —lo que lleva el separador, comillas o un
 * salto de línea— y las comillas de adentro se duplican, que es como manda el
 * formato. Sin esto, un comentario con un `;` corre todas las columnas de esa
 * fila una posición, y el archivo se abre igual: mal, y sin avisar.
 */
export function comoCampo(valor) {
  const texto = String(valor ?? '');
  if (!/[";\n\r]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Un importe en unidades mínimas, con coma decimal y sin separador de miles. */
export function comoImporte(minimas, decimales) {
  const signo = minimas < 0 ? '-' : '';
  const enteras = Math.abs(minimas);

  if (decimales === 0) return `${signo}${enteras}`;

  const divisor = 10 ** decimales;
  const parteEntera = Math.floor(enteras / divisor);
  const resto = String(enteras % divisor).padStart(decimales, '0');

  // Coma, no punto: es el separador decimal del castellano, y el separador de
  // columnas ya es `;` justamente para poder usarla.
  return `${signo}${parteEntera},${resto}`;
}

/**
 * Una fila por movimiento, con todo lo que hace falta para rehacer la cuenta.
 *
 * `unidades_por_euro` es el tipo de cambio que se aplicó, no el que hay hoy: un
 * gasto de marzo se convirtió con el cambio de marzo, y sin ese dato el importe
 * en euros es un número que no se puede volver a comprobar.
 */
export function filasDelCsv(estado) {
  const meses = mesesConMovimientos(estado.movimientos ?? []).slice().sort();
  const filas = [];

  for (const mes of meses) {
    const movimientos = movimientosDelMes(estado.movimientos, mes)
      .slice()
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado).localeCompare(String(b.creado)));

    for (const movimiento of movimientos) {
      const decimales = decimalesDe(estado.monedas, movimiento.moneda);
      const falta = faltaCambioPara(movimiento, estado.tipos_cambio);
      const cambio = falta ? null : buscarCambio(estado.tipos_cambio, movimiento.moneda, mesDe(movimiento.fecha));

      filas.push({
        fecha: movimiento.fecha,
        dia: String(Number(movimiento.fecha.slice(8, 10))),
        mes: `${movimiento.fecha.slice(5, 7)}/${movimiento.fecha.slice(2, 4)}`,
        tipo: movimiento.tipo,
        rubro: formatearRubro(movimiento.rubro),
        comentario: movimiento.comentario ?? '',
        detalle: movimiento.detalle ?? '',
        moneda: movimiento.moneda,
        monto: comoImporte(movimiento.monto, decimales),
        // El euro no tiene "unidades por euro" que decir: es 1 y decirlo sería
        // ruido en el 90 % de las filas.
        unidades_por_euro: cambio === null || movimiento.moneda === 'EUR'
          ? ''
          : comoImporte(Math.round(aUnidadesPorEuro(cambio) * 100), 2),
        euros: falta
          ? ''
          : comoImporte(movimientoEnEuros(movimiento, estado.tipos_cambio, estado.monedas), 2),
      });
    }
  }

  return filas;
}

/**
 * El archivo entero, como texto.
 *
 * Los saltos de línea son `\r\n` y no `\n`: es lo que dice el formato y lo que
 * Excel en Windows espera. Con solo `\n` hay versiones que meten todo en una
 * sola fila.
 */
export function contenidoDelCsv(estado) {
  const filas = filasDelCsv(estado);
  const lineas = [
    COLUMNAS.join(SEPARADOR),
    ...filas.map((fila) => COLUMNAS.map((columna) => comoCampo(fila[columna])).join(SEPARADOR)),
  ];

  return MARCA_UTF8 + lineas.join('\r\n') + '\r\n';
}

/** El CSV listo para guardar: `{ nombre, contenido, tipo, cuantos, sinConvertir }`. */
export function prepararCsv(estado, { fecha = hoy() } = {}) {
  const filas = filasDelCsv(estado);

  return {
    nombre: nombreDelCsv(fecha),
    contenido: contenidoDelCsv(estado),
    tipo: TIPO_CSV,
    cuantos: filas.length,
    sinConvertir: filas.filter((f) => f.euros === '').length,
  };
}
