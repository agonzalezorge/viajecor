// El recordatorio de respaldo — T-903.
//
// Es la contramedida al riesgo más grave de toda la arquitectura: los datos
// viven en un solo navegador, y "limpiar datos de navegación" en el celular se
// los lleva todos. No hay servidor ni papelera. El respaldo es la única red, y
// una red que hay que acordarse de tender no se tiende.
//
// ── Por qué el aviso vive acá y no solo en la pantalla de Datos ──────────────
//
// La pantalla de Datos ya dice cuánto hace que no respaldás (T-016), pero ahí
// solo entra quien ya se acordó. El aviso tiene que encontrar al usuario en la
// pantalla donde está, que es la del mes.
//
// ── Por qué cuenta movimientos y no solo días ────────────────────────────────
//
// "Hace 9 días que no respaldás" es un reproche. "Tenés 23 movimientos que
// existen en un solo lugar" es lo que efectivamente se pierde, y es el número
// que hace que valga la pena tocar el botón. Se dicen los dos, pero el que
// manda es el de los movimientos: si hace tres semanas que no respaldás y no
// cargaste nada, no hay nada que hacer y el aviso no aparece.
//
// ── Por qué se puede posponer, pero solo por hoy ─────────────────────────────
//
// Un aviso que no se puede sacar de la pantalla se vuelve parte del decorado y
// deja de leerse. Uno que se apaga para siempre no sirve para nada. Se pospone
// por el día: mañana vuelve.

import { diasEntre, hoy, validarFecha } from '../core/modelo.js';
import { diasSinRespaldar } from './exportar.js';

/** Decidido por el usuario el 2026-08-19: una semana. */
export const DIAS_PARA_RECORDAR = 7;

/**
 * Los movimientos que todavía no entraron en ningún respaldo.
 *
 * Se comparan por el día en que se cargaron (`creado`), no por la fecha del
 * gasto: cargar hoy un gasto de la semana pasada lo deja **sin respaldar**, por
 * más que su fecha sea vieja. Es lo que se pierde, no lo que dice el papel.
 *
 * Un movimiento creado **el mismo día** del último respaldo se cuenta como sin
 * respaldar. La app no guarda horas (ADR-021), así que no hay forma de saber si
 * se cargó antes o después de haber exportado, y equivocarse hacia "ya está
 * respaldado" es equivocarse hacia perder datos.
 */
export function sinRespaldar(estado) {
  const movimientos = estado.movimientos ?? [];
  const ultimo = estado.preferencias?.ultimo_respaldo;

  if (typeof ultimo !== 'string') return movimientos;
  return movimientos.filter((m) => typeof m.creado !== 'string' || m.creado >= ultimo);
}

/**
 * Qué hay que decirle al usuario sobre su respaldo. **No decide cómo se ve**:
 * devuelve los hechos y la pantalla los escribe (ADR-022).
 *
 * `desde` son los días que corren: desde el último respaldo, o —si nunca hubo
 * uno— desde que se cargó el movimiento sin respaldar más viejo. Contar desde
 * el primer movimiento y no desde siempre evita que la app le reclame un
 * respaldo a alguien que cargó su primer gasto hace diez minutos.
 */
export function estadoDelRecordatorio(estado, { fecha = hoy(), dias = DIAS_PARA_RECORDAR } = {}) {
  const pendientes = sinRespaldar(estado);
  const desdeElRespaldo = diasSinRespaldar(estado, { fecha });
  const nunca = desdeElRespaldo === null;

  const desde = nunca ? diasDesdeElMasViejo(pendientes, fecha) : desdeElRespaldo;

  return {
    cuantos: pendientes.length,
    desde,
    nunca,
    // Hay algo que perder Y pasó el tiempo Y no se pospuso hoy. Las tres cosas:
    // sin movimientos nuevos no hay nada que respaldar por más que pase un mes.
    haceFalta:
      pendientes.length > 0 &&
      desde !== null &&
      desde >= dias &&
      estado.preferencias?.recordatorio_pospuesto !== fecha,
  };
}

/** Guarda que hoy el usuario dijo "ahora no". Mañana el aviso vuelve. */
export function posponerRecordatorio(estado, { fecha = hoy() } = {}) {
  return {
    ...estado,
    preferencias: { ...estado.preferencias, recordatorio_pospuesto: validarFecha(fecha) },
  };
}

/** Cuántos días hace que se cargó el más viejo de estos movimientos. */
function diasDesdeElMasViejo(movimientos, fecha) {
  const fechas = movimientos.map((m) => m.creado).filter((c) => typeof c === 'string');
  if (fechas.length === 0) return null;

  const masViejo = fechas.reduce((a, b) => (a < b ? a : b));
  return Math.max(0, diasEntre(masViejo, fecha));
}
