// Entregarle el respaldo al teléfono — T-905.
//
// El respaldo ya se puede descargar (T-016), pero en un celular "descargar" deja
// el archivo en una carpeta que después hay que ir a buscar con un explorador de
// archivos para subirlo a OneDrive. Son cuatro pasos, y el respaldo que exige
// cuatro pasos cada semana es el que no se hace.
//
// El botón de compartir del sistema lo resuelve en uno: la app le entrega el
// archivo al teléfono y el teléfono muestra OneDrive, Drive, el correo, lo que
// haya instalado.
//
// ── Por qué esto NO rompe RN-06 ──────────────────────────────────────────────
//
// La app no hace ninguna petición de red. Le pasa un archivo al sistema
// operativo y termina ahí su participación; quien lo sube es OneDrive, con la
// sesión del usuario, fuera de la app. Es exactamente lo mismo que descargar el
// archivo y arrastrarlo a una carpeta sincronizada, pero sin los tres pasos del
// medio. La guardia de privacidad de `tools/build.mjs` lo confirma: no aparece
// ninguna URL ni ninguna llamada de red en este archivo.
//
// Lo que sí hay que decirle al usuario, y la pantalla se lo dice: **un respaldo
// guardado en la nube deja de ser privado.** La app garantiza la privacidad
// hasta que el archivo sale; de ahí en adelante la garantiza el usuario.

/**
 * El respaldo como archivo, para poder entregarlo.
 *
 * Recibe `File` en vez de tomarlo del entorno para poder probarlo con
 * `node --test`, donde no hay navegador (ADR-022).
 */
export function archivoDelRespaldo(respaldo, ConstructorArchivo) {
  return new ConstructorArchivo([respaldo.contenido], respaldo.nombre, { type: respaldo.tipo });
}

/**
 * ¿Este navegador puede compartir **archivos**?
 *
 * Se exige `canShare` y no alcanza con que exista `share`: hay navegadores que
 * comparten texto y direcciones pero no archivos, y ahí `share({files})` falla
 * **después** de que el usuario apretó el botón. Un botón que falla al apretarlo
 * es peor que un botón que no está (L-016): en esta pantalla, encima, el usuario
 * se quedaría creyendo que respaldó.
 *
 * `canShare` puede tirar con datos que no le gustan, así que se pregunta dentro
 * de un `try`: la respuesta a "¿se puede?" no puede ser una excepción.
 */
export function sePuedeCompartir(navegador, archivo) {
  try {
    return (
      typeof navegador?.share === 'function' &&
      typeof navegador?.canShare === 'function' &&
      navegador.canShare({ files: [archivo] })
    );
  } catch {
    return false;
  }
}

/**
 * Comparte el respaldo. **Nunca tira**: devuelve qué pasó.
 *
 * Tres resultados y no dos, porque **cancelar no es fallar**. Si el usuario abre
 * el menú de compartir y se arrepiente, el navegador rechaza la promesa con
 * `AbortError`. Mostrarle un error rojo por haber cambiado de idea le enseñaría
 * que la app se rompe sola.
 */
export async function compartirRespaldo(navegador, respaldo, ConstructorArchivo) {
  let archivo;
  try {
    archivo = archivoDelRespaldo(respaldo, ConstructorArchivo);
  } catch (error) {
    return { error: `No se pudo preparar el archivo (${error.message}).` };
  }

  if (!sePuedeCompartir(navegador, archivo)) {
    return { error: 'Este navegador no puede compartir archivos. Usá el botón de descargar.' };
  }

  try {
    await navegador.share({
      files: [archivo],
      // Sin `text` ni `url`: hay destinos que, si viene texto, mandan el texto y
      // se olvidan del archivo. Acá lo único que importa es el archivo.
      title: respaldo.nombre,
    });
    return { compartido: true };
  } catch (error) {
    if (error?.name === 'AbortError') return { cancelado: true };
    return { error: `No se pudo compartir el archivo (${error.message}). Probá con el botón de descargar.` };
  }
}
