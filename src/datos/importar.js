// Volver a cargar un respaldo — CU-08.
//
// Es la otra mitad de la garantía de que los datos son del usuario: exportar sin
// poder volver a importar produce un archivo, no un respaldo. Y es el camino que
// se usa al cambiar de teléfono, que es cuando más caro sale que salga mal.
//
// ── Por qué esto es delicado ─────────────────────────────────────────────────
//
// Importar es la única operación de la app que puede **destruir datos que el
// usuario no está mirando**. Borrar un movimiento se ve; importar reemplazando
// todo se lleva meses de registro de un toque, y quien lo hace suele estar
// convencido de que está recuperando datos, no perdiéndolos.
//
// De ahí las tres reglas de este archivo:
//
//   1. **Primero se lee, después se decide.** Nunca se toca el estado sin haber
//      podido mostrar antes qué va a pasar, con números concretos.
//   2. **El usuario elige entre reemplazar y agregar**, y la app no elige por
//      él. Son dos cosas muy distintas y solo él sabe cuál quiere.
//   3. **Agregar no duplica.** Un movimiento que ya está —mismo identificador—
//      no entra dos veces. Importar dos veces el mismo respaldo tiene que dejar
//      lo mismo que importarlo una.

import { migrarEstado } from './almacenamiento.js';
import { validarFecha, normalizarClave } from '../core/modelo.js';

/**
 * Lee el texto de un respaldo. **Nunca tira**: devuelve el resultado o el
 * motivo, porque el usuario tiene que poder entender qué pasó y volver a
 * intentar con otro archivo.
 */
export function leerRespaldo(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') {
    return { error: 'El archivo está vacío.' };
  }

  let leido;
  try {
    leido = JSON.parse(texto);
  } catch {
    return {
      error: 'Este archivo no es un respaldo de Viajecor: no se pudo leer como JSON. ' +
        '¿Puede ser que sea un CSV, o que se haya copiado a medias?',
    };
  }

  if (leido === null || typeof leido !== 'object' || Array.isArray(leido)) {
    return { error: 'Este archivo no tiene la forma de un respaldo de Viajecor.' };
  }

  if (!Array.isArray(leido.movimientos)) {
    return {
      error: 'Este archivo no tiene una lista de movimientos, así que no parece un respaldo de Viajecor. ' +
        'Los respaldos se llaman viajecor-AAAA-MM-DD.json.',
    };
  }

  // Se pasa por la misma puerta que los datos guardados: un respaldo editado a
  // mano no puede meter nada que el almacenamiento no aceptaría (ADR-017).
  const incidencias = [];
  const estado = migrarEstado(leido, incidencias);

  return {
    estado,
    incidencias,
    // Datos del archivo, para que la pantalla pueda decir de cuándo es.
    exportado: typeof leido.exportado === 'string' ? leido.exportado : null,
    version_app: typeof leido.version_app === 'string' ? leido.version_app : null,
  };
}

/**
 * Qué pasaría si se importara. **No cambia nada**: es lo que se le muestra al
 * usuario antes de que decida.
 *
 * `yaEstan` son los movimientos del respaldo que ya existen en la app, contados
 * por identificador. Es el número que explica por qué "agregar" a veces suma
 * menos de lo que trae el archivo — sin él, alguien creería que se perdieron.
 */
export function previsualizar(estadoActual, leido) {
  const actuales = new Set((estadoActual.movimientos ?? []).map((m) => m.id));
  const delRespaldo = leido.estado.movimientos ?? [];

  const yaEstan = delRespaldo.filter((m) => actuales.has(m.id)).length;

  return {
    trae: delRespaldo.length,
    yaEstan,
    nuevos: delRespaldo.length - yaEstan,
    tenes: actuales.size,
    // Cuántos quedarían con cada camino. Son los dos números que hacen la
    // diferencia entre las dos opciones entendible sin explicarla.
    siReemplazo: delRespaldo.length,
    siAgrego: actuales.size + (delRespaldo.length - yaEstan),
    // Cuántos se PERDERÍAN al reemplazar: los que hay ahora y no están en el
    // archivo. Es el número que nadie mira y el que más duele.
    sePierden: (estadoActual.movimientos ?? []).filter(
      (m) => !delRespaldo.some((r) => r.id === m.id)
    ).length,
    incidencias: leido.incidencias ?? [],
  };
}

export const MODO_REEMPLAZAR = 'reemplazar';
export const MODO_AGREGAR = 'agregar';

/**
 * Aplica la importación. Devuelve un estado nuevo; no modifica el que recibe.
 *
 * **Agregar no duplica:** un movimiento cuyo identificador ya está se saltea.
 * Importar dos veces el mismo respaldo deja lo mismo que importarlo una vez, que
 * es lo que cualquiera espera y lo que evita el desastre silencioso de tener
 * cada gasto contado dos veces en todos los totales.
 */
export function aplicarImportacion(estadoActual, leido, modo) {
  if (modo !== MODO_REEMPLAZAR && modo !== MODO_AGREGAR) {
    throw new Error(`Modo de importación desconocido: ${JSON.stringify(modo)}.`);
  }

  const importado = leido.estado;
  const ultimo_respaldo = ultimoRespaldoDespuesDe(estadoActual, leido);

  if (modo === MODO_REEMPLAZAR) {
    // Se conserva una sola cosa de lo que había: la fecha del último respaldo.
    // Es un dato sobre el dispositivo, no sobre los gastos, y perderlo haría
    // que la app dijera "nunca respaldaste" justo después de haber importado un
    // respaldo, que es lo contrario de la verdad.
    return {
      ...importado,
      preferencias: { ...importado.preferencias, ultimo_respaldo },
    };
  }

  const yaEstan = new Set((estadoActual.movimientos ?? []).map((m) => m.id));
  const nuevos = (importado.movimientos ?? []).filter((m) => !yaEstan.has(m.id));

  return {
    ...estadoActual,
    movimientos: [...(estadoActual.movimientos ?? []), ...nuevos],
    // Los tipos de cambio y las monedas del respaldo se suman a los que hay: si
    // el archivo trae el cambio del colón de marzo y la app no lo tiene, sin él
    // esos movimientos entrarían sin poder convertirse a euros.
    tipos_cambio: unirPorClave(
      estadoActual.tipos_cambio ?? [],
      importado.tipos_cambio ?? [],
      (c) => `${c.moneda}|${c.mes}`
    ),
    monedas: unirPorClave(estadoActual.monedas ?? [], importado.monedas ?? [], (m) => m.codigo),
    // Las fechas de viaje también se suman, y **las que ya están mandan**: al
    // agregar un respaldo a lo que hay, lo de este dispositivo es lo más nuevo
    // que se sabe. Sin esta línea, un viaje del respaldo llegaba sin sus fechas
    // y la app volvía a preguntar "¿Cuándo fue?" por algo ya contestado (L-031).
    // Los ahorros del respaldo se suman por id, igual que los movimientos: dos
    // importaciones del mismo archivo no pueden duplicar la plata ahorrada.
    ahorros: unirPorClave(
      estadoActual.ahorros ?? [],
      importado.ahorros ?? [],
      (a) => a.id
    ),
    fechas_de_viaje: unirPorClave(
      estadoActual.fechas_de_viaje ?? [],
      importado.fechas_de_viaje ?? [],
      (v) => normalizarClave(String(v?.clave ?? ''))
    ),
    preferencias: { ...estadoActual.preferencias, ultimo_respaldo },
  };
}

/**
 * La fecha del último respaldo después de importar: la más reciente entre la
 * que tenía el dispositivo y la que dice el archivo.
 *
 * El archivo **es** la prueba de que ese día hubo un respaldo. Sin esto, un
 * teléfono nuevo que acaba de importar un archivo de hoy diría "nunca
 * respaldaste", que es falso y empuja a respaldar de nuevo lo que ya está
 * respaldado. Si la del dispositivo es más nueva, gana esa: el archivo puede
 * ser viejo, y decir que el último respaldo es más antiguo de lo que fue
 * también sería mentir.
 */
function ultimoRespaldoDespuesDe(estadoActual, leido) {
  const propio = estadoActual.preferencias?.ultimo_respaldo ?? null;
  // `validarFecha` tira: el archivo lo pudo escribir cualquiera, y una fecha
  // rota ahí no puede impedir recuperar los gastos.
  let delArchivo = null;
  try {
    delArchivo = validarFecha(leido.exportado);
  } catch {
    delArchivo = null;
  }

  if (propio === null) return delArchivo ?? undefined;
  if (delArchivo === null) return propio;
  // Las fechas son AAAA-MM-DD: comparar como texto es comparar como calendario.
  return delArchivo > propio ? delArchivo : propio;
}

/**
 * Une dos listas sin repetir, **dando prioridad a lo que ya tenía el usuario**.
 *
 * Si el respaldo trae un tipo de cambio para un mes que la app ya tiene, gana el
 * de la app: el usuario pudo haberlo corregido después de exportar, y pisarlo
 * con el viejo cambiaría totales que él ya dio por buenos sin decírselo.
 */
function unirPorClave(propios, ajenos, clave) {
  const vistos = new Set(propios.map(clave));
  return [...propios, ...ajenos.filter((a) => !vistos.has(clave(a)))];
}
