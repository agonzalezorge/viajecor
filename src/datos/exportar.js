// Exportar los datos — CU-07.
//
// Esta no es una función más de la app: **es la única copia de seguridad que el
// usuario va a tener**. Los datos viven en un solo navegador, sin servidor y sin
// papelera; "limpiar datos de navegación" en el celular se lleva meses de
// registro y no hay de dónde recuperarlos (ARQUITECTURA §6).
//
// De eso salen las tres decisiones de este archivo:
//
//   1. **Se exporta TODO**, no lo que se está mirando. Un respaldo que solo
//      guarda el mes en pantalla es un respaldo que descubrís incompleto el día
//      que lo necesitás.
//   2. **El archivo se puede leer sin la app.** Es JSON con nombres en
//      castellano, con saltos de línea y sangría. Si dentro de cinco años esta
//      app no abre, el respaldo se sigue entendiendo con cualquier editor de
//      texto — que es media garantía de que los datos son del usuario.
//   3. **El archivo dice de dónde salió y cuándo.** Un `viajecor-2026-08-25.json`
//      encontrado dentro de tres años tiene que poder explicarse solo.
//
// Este archivo no toca el navegador: arma el contenido y el nombre, y quien lo
// descarga es la pantalla. Así se puede testear el respaldo sin un navegador.

import { diasEntre, hoy } from '../core/modelo.js';
import { ESQUEMA_ACTUAL } from './almacenamiento.js';

export const TIPO_JSON = 'application/json';

/**
 * El nombre del archivo: `viajecor-2026-08-25.json`.
 *
 * Con la fecha al principio en formato AAAA-MM-DD para que varios respaldos en
 * una carpeta queden ordenados por fecha al ordenarlos por nombre, que es como
 * los va a ordenar el celular.
 */
export function nombreDelRespaldo(fecha = hoy(), extension = 'json') {
  return `viajecor-${fecha}.${extension}`;
}

/**
 * El contenido del respaldo.
 *
 * Lleva **más cosas de las que la app necesita** para reimportarlo: la versión
 * que lo escribió y el día en que se exportó. Ninguna de las dos se usa al
 * importar; están para que el archivo se explique solo dentro de tres años.
 *
 * Con sangría de dos espacios, a propósito. Ocupa alrededor de un tercio más de
 * lugar y a cambio el archivo se puede abrir y leer: para un respaldo de unos
 * cientos de kilobytes, es un intercambio que conviene siempre.
 */
export function contenidoDelRespaldo(estado, { fecha = hoy() } = {}) {
  const respaldo = {
    // Estos tres campos son para quien LEA el archivo, no para la app.
    aplicacion: 'Viajecor',
    exportado: fecha,
    version_app: estado.version_app ?? 'desconocida',

    esquema: ESQUEMA_ACTUAL,
    movimientos: estado.movimientos ?? [],
    tipos_cambio: estado.tipos_cambio ?? [],
    monedas: estado.monedas ?? [],
    // Las fechas de cada viaje (T-941). **Faltaban acá hasta la 0.2.1**, y era
    // pérdida de datos silenciosa: son lo único del estado que NO se puede
    // deducir de los movimientos —un viaje empieza antes del primer gasto—, así
    // que al restaurar un respaldo se perdían para siempre y la app volvía a
    // decir "¿Cuándo fue?" sin que nada avisara. Ver L-031.
    fechas_de_viaje: estado.fechas_de_viaje ?? [],
    preferencias: estado.preferencias ?? {},
  };

  return `${JSON.stringify(respaldo, null, 2)}\n`;
}

/**
 * Un respaldo listo para descargar: nombre, contenido y tipo.
 *
 * Devuelve también `cuantos`, porque la pantalla tiene que poder decir qué se
 * llevó el archivo. "Se exportó" no informa nada; "se exportaron 312
 * movimientos" permite darse cuenta de que faltan.
 */
export function prepararRespaldo(estado, { fecha = hoy() } = {}) {
  const contenido = contenidoDelRespaldo(estado, { fecha });
  return {
    nombre: nombreDelRespaldo(fecha),
    contenido,
    tipo: TIPO_JSON,
    cuantos: (estado.movimientos ?? []).length,
    bytes: new TextEncoder().encode(contenido).length,
  };
}

/**
 * Deja anotado en los datos el día del último respaldo.
 *
 * Sin este dato no hay forma de avisar "hace tres semanas que no respaldás"
 * (T-903), que es la contramedida al riesgo más grave de toda la arquitectura.
 * Se anota **después** de que la descarga se haya pedido, nunca antes: decir que
 * se respaldó algo que no se respaldó es peor que no anotar nada.
 */
export function anotarRespaldo(estado, { fecha = hoy() } = {}) {
  return {
    ...estado,
    preferencias: { ...estado.preferencias, ultimo_respaldo: fecha },
  };
}

/**
 * Cuántos días pasaron desde el último respaldo. `null` si nunca se hizo uno.
 *
 * Cuenta días de calendario, no horas: la app no guarda horas (ADR-021).
 */
export function diasSinRespaldar(estado, { fecha = hoy() } = {}) {
  const ultimo = estado.preferencias?.ultimo_respaldo;
  if (typeof ultimo !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ultimo)) return null;

  return Math.max(0, diasEntre(ultimo, fecha));
}
