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
import { crearPlanilla } from '../../datos/xlsx.js';
import { prepararCsv } from '../../datos/csv.js';
import { MODO_REEMPLAZAR, MODO_AGREGAR } from '../../datos/importar.js';
import { formatearEuros } from '../../core/formato.js';
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

/**
 * ¿Se ofrece el botón de compartir? — T-914.
 *
 * Dos condiciones: que el navegador diga que puede, **y** que no haya fallado
 * antes en este teléfono. Lo segundo hace falta porque lo primero miente: en el
 * Android del usuario `canShare({files})` dice que sí y `share()` falla con
 * "Permission denied". Un botón que falla al apretarlo es peor que uno que no
 * está (L-016), y repetirlo cada semana enseña a desconfiar de la pantalla justo
 * donde el usuario tiene que confiar.
 */
export function ofreceCompartir(vista) {
  return vista.puedeCompartir === true && !compartirFallo(vista);
}

/** Si ya se comprobó que compartir no funciona acá. */
export function compartirFallo(vista) {
  return vista.estado?.preferencias?.compartir_no_funciona === true;
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
      ${ofreceCompartir(vista) ? `
      <button type="button" class="principal" data-accion="compartir"${cuantos === 0 ? ' disabled' : ''}>
        Compartir el respaldo
      </button>
      <p class="suave">Se abre el menú de tu teléfono y elegís dónde va: OneDrive,
      Drive, un correo a vos mismo. <strong>La app no sube nada</strong>: le pasa
      el archivo al teléfono y ahí termina su parte.</p>` : ''}

      <button type="button" class="${ofreceCompartir(vista) ? 'secundario' : 'principal'}" data-accion="exportar"${cuantos === 0 ? ' disabled' : ''}>
        Descargar ${escapar(respaldo.nombre)}
      </button>

      <!-- El segundo camino. No es una curiosidad: la app se abre desde un
           archivo del disco, y ahí las descargas dependen del navegador. Un
           respaldo que solo funciona si el navegador coopera no es un respaldo. -->
      <button type="button" class="secundario" data-accion="ver-respaldo"${cuantos === 0 ? ' disabled' : ''}>
        ${vista.mostrarRespaldo ? 'Ocultar el texto' : 'Ver el texto para copiarlo'}
      </button>

      <!-- Cuando compartir no funciona en este teléfono no se explica nada: el
           usuario ya lo vio fallar una vez, con su motivo. Repetírselo cada vez
           que entra a la pantalla es dejarle un cartel en la cara sobre algo que
           no puede hacer (pedido del usuario, 2026-08-28). Queda solo la forma
           de volver a intentarlo, por si algún día cambia un permiso. -->
      ${compartirFallo(vista) ? `
      <p class="suave discreto">
        <button type="button" class="enlace" data-accion="reintentar-compartir">Probar el botón de compartir</button>
      </p>` : ''}

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

    ${dibujarPlanilla(vista)}

    ${dibujarImportar(vista)}

    ${dibujarPlanillaVieja(vista)}

    <section class="tarjeta">
      <h2>Tipos de cambio</h2>
      <p class="suave">Ver y corregir cuánto vale cada moneda en cada mes.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="cambios">
        Ver tipos de cambio
      </button>
    </section>

    <section class="tarjeta">
      <h2>Monedas</h2>
      <p class="suave">Ver las que hay, agregar una nueva u ocultar las que ya no usás.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="monedas">
        Ver monedas
      </button>
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

/**
 * La planilla de Excel — T-906.
 *
 * Es para **mirar**, no para restaurar, y la pantalla lo dice con todas las
 * letras. Un `.xlsx` no lleva los identificadores de los movimientos, ni los
 * tipos de cambio, ni tus monedas: se puede abrir y leer, pero no se puede
 * volver a cargar en la app sin perder cosas. Por eso **descargarla no cuenta
 * como respaldo** y no apaga el aviso de "hace tantos días que no respaldás".
 *
 * Dejar que lo apagara sería lo peor que puede hacer esta pantalla: el usuario
 * se quedaría tranquilo con un archivo que no lo puede salvar.
 */
export function dibujarPlanilla(vista) {
  const cuantos = (vista.estado.movimientos ?? []).length;
  const planilla = cuantos === 0 ? null : crearPlanilla(vista.estado);
  const csv = cuantos === 0 ? null : prepararCsv(vista.estado);

  return `
    <section class="tarjeta">
      <h2>Planilla de Excel</h2>

      <p class="suave">Tus gastos con la forma de tu planilla de siempre: un
      bloque por mes, los mismos encabezados, el acumulado y el total por rubro.
      La diferencia es que <strong>los totales están calculados sobre todas las
      filas</strong>, no con fórmulas de rango escritas a mano.</p>

      ${planilla && planilla.sinConvertir > 0 ? `
      <p class="aviso-respaldo pendiente-respaldo" role="status">
        ${planilla.sinConvertir === 1
          ? 'Hay 1 movimiento que no se puede pasar a euros porque falta su tipo de cambio.'
          : `Hay ${planilla.sinConvertir} movimientos que no se pueden pasar a euros porque falta su tipo de cambio.`}
        Entran igual en la planilla, con el monto vacío y el motivo escrito al lado.
      </p>` : ''}

      ${vista.errorPlanilla ? `<p class="error-carga" role="alert">${escapar(vista.errorPlanilla)}</p>` : ''}
      ${vista.avisoPlanilla ? `<p class="confirmacion" role="status">${escapar(vista.avisoPlanilla)}</p>` : ''}

      ${ofreceCompartir(vista) ? `
      <button type="button" class="secundario" data-accion="compartir-planilla"${cuantos === 0 ? ' disabled' : ''}>
        Compartir la planilla
      </button>` : ''}

      <button type="button" class="secundario" data-accion="exportar-planilla"${cuantos === 0 ? ' disabled' : ''}>
        Descargar ${planilla ? escapar(planilla.nombre) : 'la planilla'}
      </button>

      <p class="suave"><strong>Esto no es un respaldo.</strong> La planilla se
      puede leer pero no se puede volver a cargar en la app: no lleva los tipos
      de cambio ni tus monedas. Para eso está el archivo de arriba.</p>

      <h3>Y en CSV, para hacer cuentas en otro lado</h3>
      <p class="suave">Una fila por movimiento, con todas las columnas: el monto
      original con su moneda, <strong>el tipo de cambio que se aplicó</strong> y el
      importe en euros. La planilla lleva solo euros porque se mira; el CSV lleva
      las dos cosas porque es para procesar, y ahí perder el dato original duele.</p>

      <button type="button" class="secundario" data-accion="exportar-csv"${cuantos === 0 ? ' disabled' : ''}>
        Descargar ${csv ? escapar(csv.nombre) : 'el CSV'}
      </button>
    </section>
  `;
}

/**
 * Traer la planilla de Excel — T-032, CU-13.
 *
 * Es la operación que se corre **una sola vez**, sobre todo el historial. Por
 * eso la pantalla insiste en dos cosas antes de dejar tocar nada: **qué se
 * importó** y —sobre todo— **qué no**.
 */
export function dibujarPlanillaVieja(vista) {
  const previa = vista.planilla;

  return `
    <section class="tarjeta">
      <h2>Traer tu planilla de Excel</h2>

      ${previa ? '' : `
      <p class="suave">Para cargar de una vez todo lo que venías anotando. Elegí
      tu archivo <code>.xlsx</code>: la app lo lee sin que tengas que convertirlo
      a nada, y <strong>no lo modifica</strong>.</p>

      <label class="campo">
        <span>Elegir la planilla</span>
        <input type="file" name="planilla" accept=".xlsx" data-accion="elegir-planilla">
      </label>`}

      ${vista.errorPlanillaVieja ? `<p class="error-carga" role="alert">${escapar(vista.errorPlanillaVieja)}</p>` : ''}
      ${vista.avisoPlanillaVieja ? `<p class="confirmacion" role="status">${escapar(vista.avisoPlanillaVieja)}</p>` : ''}
      ${previa ? dibujarPreviaDePlanilla(previa) : ''}
    </section>
  `;
}

/** Lo que se leyó, antes de tocar nada. */
function dibujarPreviaDePlanilla({ movimientos, problemas, comprobaciones, yaEstan }) {
  const nuevos = movimientos.length - yaEstan;

  return `
    <p class="suave">Se leyeron
    <strong>${movimientos.length === 1 ? '1 movimiento' : `${movimientos.length} movimientos`}</strong>.
    ${yaEstan > 0
      ? `${yaEstan === 1 ? '1 ya está' : `${yaEstan} ya están`} cargado${yaEstan === 1 ? '' : 's'} en la app, así que
         ${nuevos === 1 ? 'entraría 1' : `entrarían ${nuevos}`}.`
      : 'Ninguno está todavía en la app.'}</p>

    ${dibujarComprobaciones(comprobaciones)}
    ${dibujarProblemas(problemas)}

    <button type="button" class="principal" data-accion="importar-planilla"${nuevos === 0 ? ' disabled' : ''}>
      ${nuevos === 0 ? 'No hay nada nuevo que traer' : `Traer ${nuevos === 1 ? 'el movimiento' : `los ${nuevos} movimientos`}`}
    </button>
    <button type="button" class="secundario" data-accion="cancelar-planilla">Dejar como está</button>
  `;
}

/**
 * La comparación contra el acumulado que traía la planilla.
 *
 * Es la única vez que se puede contrastar el resultado con un número calculado
 * por **otra herramienta**: después de importar, la planilla se archiva. Si acá
 * no se mira, no se mira nunca.
 */
function dibujarComprobaciones(comprobaciones) {
  if (comprobaciones.length === 0) return '';
  const difieren = comprobaciones.filter((c) => !c.coincide);

  if (difieren.length === 0) {
    return `<p class="suave">Los totales de los ${comprobaciones.length} meses coinciden con
    los que traía tu planilla.</p>`;
  }

  // El signo de la diferencia dice de qué lado mirar, y por eso se separan. Un
  // "no cuadra" a secas hace pensar que la app se equivocó, y en el caso más
  // común es al revés: apareció un gasto que la planilla no estaba sumando.
  const deMas = difieren.filter((c) => c.diferencia > 0);
  const deMenos = difieren.filter((c) => c.diferencia < 0);

  const linea = (c) => `<li>${escapar(c.mes)}: tu planilla dice
    ${escapar(formatearEuros(c.enLaPlanilla))} y acá suman
    ${escapar(formatearEuros(c.importado))}
    <strong>(${c.diferencia > 0 ? '+' : ''}${escapar(formatearEuros(c.diferencia))})</strong></li>`;

  return `
    <div class="aviso importante" role="alert">
      <h2>${difieren.length === 1 ? 'Un mes no coincide' : `${difieren.length} meses no coinciden`}</h2>

      ${deMas.length > 0 ? `
      <p class="suave"><strong>Se leyó de más</strong> en
      ${deMas.length === 1 ? 'un mes' : `${deMas.length} meses`}. La causa más
      frecuente es un gasto que <strong>tu planilla no estaba sumando</strong>:
      cuando un monto quedó escrito como texto —se ve igual, pero está pegado a la
      izquierda de la celda— Excel lo saltea sin avisar. Si la diferencia coincide
      con el importe de alguna fila, es eso.</p>
      <ul>${deMas.map(linea).join('')}</ul>` : ''}

      ${deMenos.length > 0 ? `
      <p class="suave"><strong>Se leyó de menos</strong> en
      ${deMenos.length === 1 ? 'un mes' : `${deMenos.length} meses`}. Acá sí conviene
      mirar la lista de filas que quedaron afuera: puede que alguna sea un gasto de
      verdad que no se pudo interpretar.</p>
      <ul>${deMenos.map(linea).join('')}</ul>` : ''}
    </div>`;
}

/**
 * Las filas que no entraron, **con su número de fila**.
 *
 * Sin el número, el informe dice «hubo 14 problemas» y no sirve para nada. Con
 * él, el usuario abre su planilla, va a esa fila y decide.
 */
function dibujarProblemas(problemas) {
  if (problemas.length === 0) {
    return `<p class="suave">No quedó ninguna fila afuera.</p>`;
  }

  return `
    <div class="aviso importante" role="alert">
      <h2>${problemas.length === 1 ? 'Una fila no se pudo traer' : `${problemas.length} filas no se pudieron traer`}</h2>
      <p class="suave">Están con su número de fila para que puedas abrir tu planilla y
      mirarlas. El resto se importa igual.</p>
      <ul class="filas-con-problema">${problemas.map((p) => `<li>
        <strong>Fila ${p.fila}:</strong> ${escapar(p.motivo)}.
        <span class="suave">Decía: ${escapar(p.decia)}.</span>
      </li>`).join('')}</ul>
    </div>`;
}
