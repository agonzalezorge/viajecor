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

      <button type="button" class="principal" data-accion="exportar"${cuantos === 0 ? ' disabled' : ''}>
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
      (RN-06). Una vez descargado, el archivo es tuyo: guardalo donde quieras
      —OneDrive, Drive, un correo a vos mismo— con el botón de compartir de tu
      teléfono.</p>
      <p class="suave">Ojo con esto: un respaldo guardado en la nube deja de ser
      privado. La app garantiza la privacidad hasta que el archivo sale; de ahí
      en adelante la garantizás vos.</p>
    </section>

    <section class="tarjeta">
      <h2>Tipos de cambio</h2>
      <p class="suave">Ver y corregir cuánto vale cada moneda en cada mes.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="cambios">
        Ver tipos de cambio
      </button>
    </section>

    <section class="tarjeta">
      <h2>Todavía no</h2>
      <p class="suave pendiente">Volver a cargar un respaldo — T-017. Exportar a
      CSV para abrir en Excel — T-018. Ver y agregar monedas — T-024.</p>
    </section>
  `;
}
