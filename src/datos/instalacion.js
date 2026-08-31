// Lo que la app le pide al navegador para portarse como una app — T-950.
//
// Dos pedidos, los dos opcionales y los dos que pueden decir que no:
//
//   1. **Que guarde una copia de la página** (el trabajador de servicio), para
//      que abra sin conexión.
//   2. **Que no borre los datos para hacer lugar** (`storage.persist()`).
//
// ── Por qué está acá y no en `ui/` ───────────────────────────────────────────
//
// Es acceso al navegador, como `almacenamiento.js`: no dibuja nada. Y recibe el
// `navigator` en vez de tomarlo del ámbito, que es lo que permite probarlo con
// un doble en `node --test` en vez de solo mirándolo en un teléfono.
//
// ── Ninguno de los dos puede romper la app ───────────────────────────────────
//
// Un navegador viejo no tiene estas cosas; un navegador en ventana privada las
// niega; `file://` no admite trabajadores de servicio. Las tres son respuestas
// legítimas y frecuentes, así que **nada de esto tira**: devuelve qué pasó, y
// la app sigue andando exactamente igual que antes. Lo único que se pierde es
// abrir sin conexión.

/** Dónde vive el trabajador de servicio, servido desde la raíz del sitio. */
export const RUTA_DEL_SERVICIO = '/sw.js';

/**
 * Registra el trabajador de servicio, si este navegador puede.
 *
 * **Solo con `http:` o `https:`.** Desde `file://` el navegador no los admite —y
 * ahí no hace falta: el archivo ya está en el disco—. Preguntarlo antes evita
 * un error en la consola en el caso que MÁS se usa hoy, que es el archivo.
 */
export function registrarServicio(navegador, protocolo) {
  if (protocolo !== 'http:' && protocolo !== 'https:') return { pedido: false, motivo: 'archivo' };
  if (!navegador?.serviceWorker?.register) return { pedido: false, motivo: 'no lo tiene' };

  try {
    const promesa = navegador.serviceWorker.register(RUTA_DEL_SERVICIO);
    // Si falla, no hay nada que hacer ni nada que decirle al usuario: la app
    // funciona igual, solo que necesitando red para abrir.
    promesa?.catch?.(() => {});
    return { pedido: true, motivo: null };
  } catch {
    return { pedido: false, motivo: 'falló' };
  }
}

/**
 * Le pide al navegador que no borre los datos para hacer lugar.
 *
 * Sin esto, un teléfono con poco espacio puede tirar lo guardado por este sitio
 * sin avisar. Chrome suele conceder el permiso a los sitios agregados a la
 * pantalla de inicio; Safari lo maneja distinto y puede decir que no.
 *
 * **La respuesta importa y por eso se devuelve**: la pantalla de Datos la
 * escribe, para que el usuario sepa si está protegido o si el respaldo es su
 * única red.
 */
export async function pedirPersistencia(navegador) {
  const almacen = navegador?.storage;
  if (!almacen?.persist) return 'no se sabe';

  try {
    // Si ya está concedido, `persisted()` lo dice sin volver a pedir nada.
    if (almacen.persisted && await almacen.persisted()) return 'sí';
    return await almacen.persist() ? 'sí' : 'no';
  } catch {
    return 'no se sabe';
  }
}
