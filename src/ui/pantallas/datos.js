// La pantalla de Datos — CU-07: sacar los datos del dispositivo.
//
// Es la pantalla más importante de la app y la que menos se usa. Los gastos
// viven en un solo navegador: "limpiar datos de navegación" en el celular se los
// lleva todos, y no hay servidor ni papelera de donde recuperarlos. Este archivo
// es la única salida.
//
// Por eso hay **dos caminos** para el mismo respaldo y no uno:
//
//   1. **Descargar el archivo.** Es el camino normal.
//   2. **Ver el texto y copiarlo.** Es el camino para cuando el primero no
//      funciona — y puede no funcionar: la app se abre desde un archivo del
//      disco (`file://`), y ahí las descargas dependen del navegador y del
//      sistema. Un respaldo que solo funciona si el navegador coopera no es un
//      respaldo. El texto a la vista se puede copiar y pegar en cualquier lado.
//
// La segunda no es una curiosidad para programadores: es la red de contención de
// la única red de contención que tiene el usuario.

import { escapar } from '../app.js';
import { prepararRespaldo, diasSinRespaldar } from '../../datos/exportar.js';
import { MODO_REEMPLAZAR, MODO_AGREGAR } from '../../datos/importar.js';
import { formatearFechaLarga } from '../../core/formato.js';
import { hoy } from '../../core/modelo.js';

/** Un tamaño legible: 12 kB dice más que 12.283 bytes. */
export function tamanoLegible(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * El aviso de cuánto hace que no se respalda.
 *
 * Se dice siempre, no solo cuando pasó mucho: saber que respaldaste ayer es
 * información útil, y un aviso que solo aparece cuando hay problema enseña a
 * ignorarlo cuando aparece.
 */
export function dibujarEstadoRespaldo(estado, { fecha = hoy() } = {}) {
  const dias = diasSinRespaldar(estado, { fecha });
  const cuantos = (estado.movimientos ?? []).length;

  if (cuantos === 0) {
    return `<p class="suave">Todavía no cargaste nada, así que no hay nada que respaldar.</p>`;
  }

  if (dias === null) {
    return `
      <p class="aviso-respaldo pendiente-respaldo" role="status">
        <strong>Nunca respaldaste.</strong> Tus ${cuantos === 1 ? 'datos viven' : `${cuantos} movimientos viven`}
        solo en este navegador: si se borran los datos de navegación, se pierden.
      </p>`;
  }

  if (dias === 0) return `<p class="aviso-respaldo suave">Respaldaste hoy.</p>`;
  if (dias === 1) return `<p class="aviso-respaldo suave">Respaldaste ayer.</p>`;

  const hace = `Hace ${dias} días que no respaldás.`;
  return dias >= 7
    ? `<p class="aviso-respaldo pendiente-respaldo" role="status"><strong>${hace}</strong>
       Todo lo que cargaste desde entonces existe en un solo lugar.</p>`
    : `<p class="aviso-respaldo suave">${escapar(hace)}</p>`;
}

export function dibujarDatos(vista) {
  const estado = vista.estado;
  const respaldo = prepararRespaldo(estado);
  const cuantos = (estado.movimientos ?? []).length;

  return `
    <section class="tarjeta">
      <h2>Respaldo</h2>

      ${dibujarEstadoRespaldo(estado)}

      ${vista.error ? `<p class="error-carga" role="alert">${escapar(vista.error)}</p>` : ''}
      ${vista.avisoRespaldo ? `<p class="confirmacion" role="status">${escapar(vista.avisoRespaldo)}</p>` : ''}

      <p class="suave">El archivo lleva <strong>todo</strong>: los
      ${cuantos === 1 ? '1 movimiento' : `${cuantos} movimientos`}, los tipos de
      cambio y tus monedas. Pesa ${escapar(tamanoLegible(respaldo.bytes))} y se
      puede abrir con cualquier editor de texto, sin esta app.</p>

      <!-- Cuando el teléfono sabe compartir, ese es el camino principal: deja
           el respaldo en OneDrive de un toque, en vez de dejarlo en una carpeta
           que después hay que ir a buscar. La descarga no desaparece: sigue
           siendo la salida cuando el compartir no está o falla. -->
      ${vista.puedeCompartir ? `
      <button type="button" class="principal" data-accion="compartir"${cuantos === 0 ? ' disabled' : ''}>
        Compartir el respaldo
      </button>
      <p class="suave">Se abre el menú de tu teléfono y elegís dónde va: OneDrive,
      Drive, un correo a vos mismo. <strong>La app no sube nada</strong>: le pasa
      el archivo al teléfono y ahí termina su parte.</p>` : ''}

      <button type="button" class="${vista.puedeCompartir ? 'secundario' : 'principal'}" data-accion="exportar"${cuantos === 0 ? ' disabled' : ''}>
        Descargar ${escapar(respaldo.nombre)}
      </button>

      <!-- El segundo camino. No es una curiosidad: la app se abre desde un
           archivo del disco, y ahí las descargas dependen del navegador. Un
           respaldo que solo funciona si el navegador coopera no es un respaldo. -->
      <button type="button" class="secundario" data-accion="ver-respaldo"${cuantos === 0 ? ' disabled' : ''}>
        ${vista.mostrarRespaldo ? 'Ocultar el texto' : 'Ver el texto para copiarlo'}
      </button>

      ${vista.mostrarRespaldo ? `
      <p class="suave">Copiá todo este texto y pegalo en una nota, un correo o
      donde lo quieras guardar. Sirve igual que el archivo.</p>
      <textarea class="respaldo-texto" readonly rows="12"
                aria-label="Contenido del respaldo">${escapar(respaldo.contenido)}</textarea>` : ''}
    </section>

    <section class="tarjeta">
      <h2>Dónde guardarlo</h2>
      <p class="suave">La app no sube nada a ningún lado y nunca lo va a hacer
      (RN-06). ${vista.puedeCompartir
        ? 'El botón de compartir le entrega el archivo a tu teléfono, y es el teléfono el que lo sube: para la app, el respaldo termina cuando sale de acá.'
        : 'Una vez descargado, el archivo es tuyo: guardalo donde quieras —OneDrive, Drive, un correo a vos mismo— con el botón de compartir de tu teléfono.'}</p>
      <p class="suave">Ojo con esto: un respaldo guardado en la nube deja de ser
      privado. La app garantiza la privacidad hasta que el archivo sale; de ahí
      en adelante la garantizás vos.</p>
    </section>

    ${dibujarImportar(vista)}

    <section class="tarjeta">
      <h2>Tipos de cambio</h2>
      <p class="suave">Ver y corregir cuánto vale cada moneda en cada mes.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="cambios">
        Ver tipos de cambio
      </button>
    </section>

    <section class="tarjeta">
      <h2>Todavía no</h2>
      <p class="suave pendiente">Exportar a CSV para abrir en Excel — T-018.
      Ver y agregar monedas — T-024.</p>
    </section>
  `;
}

/**
 * Traer un respaldo — CU-08.
 *
 * Es la única operación de la app que puede **destruir datos que el usuario no
 * está mirando**, y la hace alguien convencido de que está recuperando datos.
 * Por eso la pantalla tiene tres pasos y no uno: elegir el archivo, **ver qué va
 * a pasar con números concretos**, y recién ahí elegir entre las dos formas.
 */
export function dibujarImportar(vista) {
  const previa = vista.importacion;

  return `
    <section class="tarjeta">
      <h2>Traer un respaldo</h2>

      ${previa ? '' : `
      <p class="suave">Para recuperar tus datos en un teléfono nuevo, o después de
      un borrado. Podés elegir el archivo o pegar el texto que copiaste.</p>

      <label class="campo">
        <span>Elegir el archivo</span>
        <input type="file" name="archivo" accept="application/json,.json" data-accion="elegir-archivo">
      </label>

      <label class="campo">
        <span>O pegar el texto del respaldo</span>
        <textarea class="respaldo-texto" name="pegado" rows="5"
                  placeholder="Pegá acá el contenido del respaldo…"></textarea>
      </label>

      <button type="button" class="secundario" data-accion="leer-pegado">
        Leer el texto pegado
      </button>`}

      ${vista.errorImportar ? `<p class="error-carga" role="alert">${escapar(vista.errorImportar)}</p>` : ''}
      ${vista.avisoImportar ? `<p class="confirmacion" role="status">${escapar(vista.avisoImportar)}</p>` : ''}
      ${previa ? dibujarPrevia(previa) : ''}
    </section>
  `;
}

/**
 * Lo que va a pasar, con números.
 *
 * El número que más importa es **cuántos movimientos se perderían** al
 * reemplazar. Es el que nadie mira y el que más duele, así que va escrito con
 * todas las letras y no como "esto borra todo".
 */
function dibujarPrevia(previa) {
  const { datos, exportado } = previa;

  return `
    <p class="suave">El archivo${exportado ? ` es del ${escapar(formatearFechaLarga(exportado))} y` : ''}
    trae <strong>${datos.trae === 1 ? '1 movimiento' : `${datos.trae} movimientos`}</strong>.
    Ahora tenés ${datos.tenes === 1 ? '1 movimiento' : `${datos.tenes} movimientos`}.</p>

    ${datos.incidencias.length > 0 ? `
    <div class="aviso importante" role="alert">
      <h2>Hay cosas que no se pudieron leer</h2>
      <ul>${datos.incidencias.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
    </div>` : ''}

    <div class="opcion-importar">
      <h3>Agregar a lo que tenés</h3>
      <p class="suave">
        ${datos.nuevos === 0
          ? `No entra ninguno: ${datos.trae === 1 ? 'el movimiento del archivo ya lo tenías' : `los ${datos.trae} movimientos del archivo ya los tenías`}.
             Seguirías con <strong>${datos.siAgrego}</strong>.`
          : `Entran ${datos.nuevos === 1 ? '1 movimiento nuevo' : `${datos.nuevos} movimientos nuevos`}${datos.yaEstan > 0
              ? ` y se saltea${datos.yaEstan === 1 ? ' 1 que ya tenías' : `n ${datos.yaEstan} que ya tenías`}, para no duplicarlos`
              : ''}.
             Te quedarían <strong>${datos.siAgrego}</strong> en total.`}
      </p>
      <button type="button" class="principal" data-accion="importar" data-modo="${MODO_AGREGAR}"${datos.nuevos === 0 ? ' disabled' : ''}>
        Agregar
      </button>
    </div>

    <div class="opcion-importar peligrosa">
      <h3>Reemplazar todo</h3>
      <p class="suave">
        Te quedarían <strong>${datos.siReemplazo}</strong>: solo los del archivo.
        ${datos.sePierden > 0
          ? `<strong class="perdida">${datos.sePierden === 1
              ? 'Se borraría 1 movimiento que tenés ahora y no está en el archivo'
              : `Se borrarían ${datos.sePierden} movimientos que tenés ahora y no están en el archivo`}.</strong>`
          : 'No perderías ninguno de los que tenés: están todos en el archivo.'}
      </p>
      <button type="button" class="peligro" data-accion="importar" data-modo="${MODO_REEMPLAZAR}">
        Reemplazar todo
      </button>
    </div>

    <button type="button" class="secundario" data-accion="cancelar-importar">
      Dejar como está
    </button>
  `;
}
