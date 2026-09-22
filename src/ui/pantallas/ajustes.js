// La pestaña de Configuración — T-047.
//
// ── Qué va acá y qué no ──────────────────────────────────────────────────────
//
// Acá va lo que **cambia cómo funciona la app**: los rubros, las etiquetas, las
// monedas, los tipos de cambio. En **Datos** queda lo que mueve información
// hacia afuera o hacia adentro: respaldos, importar, exportar.
//
// La diferencia importa porque son dos preguntas distintas. "¿Cómo guardo mis
// datos?" y "¿cómo quiero que la app se comporte?" se responden en momentos
// distintos y con cabezas distintas; tenerlas en la misma pantalla obligaba a
// leer seis tarjetas para encontrar una.
//
// Las tarjetas que ya existían no se duplican: se **mudaron** de Datos a acá.
// Dos puertas a la misma pantalla es la forma más barata de que una de las dos
// quede desactualizada.
//
// Igual que el resto de la interfaz (ADR-022), son funciones puras.

import { escapar } from '../app.js';
import { PERFIL_COTIDIANA, PERFILES, perfilPrendido } from '../../core/perfiles.js';
import { monedaBaseDe } from '../../core/monedas.js';

/**
 * Qué pestañas se ven — T-071, a pedido del usuario.
 *
 * ── Por qué dice cuántos movimientos esconde ────────────────────────────────
 *
 * Apagar una pestaña **no borra nada**: los movimientos quedan guardados, el
 * respaldo se los sigue llevando y al prenderla otra vez está todo. Pero eso lo
 * sé yo, que escribí la función. Quien toca "Apagar" y ve desaparecer una
 * pestaña con once movimientos adentro no tiene forma de saber si los perdió.
 * El número y la frase son la diferencia entre un ajuste y un susto.
 *
 * La vida cotidiana no aparece con botón: es la app. Apagarla dejaría la
 * pantalla vacía y sin ningún lugar desde donde volver.
 */
export function dibujarPestanias(estado) {
  const cuantos = { ahorros: (estado?.ahorros ?? []).length };

  const filas = PERFILES.map((perfil) => {
    const prendido = perfilPrendido(estado, perfil.clave);
    const tiene = cuantos[perfil.clave] ?? 0;

    const dice = perfil.fijo
      ? '<span class="suave">Siempre</span>'
      : `<button type="button" class="secundario chico" data-accion="prender-perfil"
                 data-perfil="${escapar(perfil.clave)}" data-prendido="${prendido ? 'no' : 'si'}">
           ${prendido ? 'Apagar' : 'Prender'}
         </button>`;

    const nota = prendido && !perfil.fijo && tiene > 0
      ? `<p class="rubro-pie suave">Apagarla esconde ${tiene} ${tiene === 1 ? 'movimiento' : 'movimientos'} de
         ahorro. <strong>No se borran</strong>: vuelven al prenderla.</p>`
      : (!prendido && tiene > 0
        ? `<p class="rubro-pie suave">Tiene ${tiene} ${tiene === 1 ? 'movimiento' : 'movimientos'} guardados,
           esperando.</p>`
        : '');

    return `
      <li class="fila-rubro">
        <span class="rubro-cabeza">
          <span class="nombre">${escapar(perfil.etiqueta)}</span>
          ${dice}
        </span>
        ${nota}
      </li>`;
  }).join('');

  return `
    <section class="tarjeta">
      <h2>Pestañas</h2>
      <p class="suave">Qué partes de la app se ven arriba. Apagar una
      <strong>no borra nada</strong>: los movimientos quedan guardados y el
      respaldo se los sigue llevando.</p>
      <ul class="rubros">${filas}</ul>
    </section>
  `;
}

export function dibujarAjustes(vista) {
  const enCotidiana = (vista.perfil ?? PERFIL_COTIDIANA) === PERFIL_COTIDIANA;
  const base = monedaBaseDe(vista.estado);

  return `
    ${vista.avisoAjustes ? `<p class="confirmacion" role="status">${escapar(vista.avisoAjustes)}</p>` : ''}
    ${vista.error ? `<p class="error-carga" role="alert">${escapar(vista.error)}</p>` : ''}

    <!-- Arriba del todo, por pedido del usuario: es lo primero que necesita
         alguien que abre la app sin saber qué es, y el último lugar donde lo
         buscaría es abajo de "Tipos de cambio". -->
    <section class="tarjeta">
      <h2>Instrucciones</h2>
      <p class="suave">Qué hace la app, cómo se usa y qué se puede configurar.
      Está escrito para leerlo de arriba abajo la primera vez.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="instrucciones">
        Cómo funciona Viajecor
      </button>
    </section>

    ${dibujarPestanias(vista.estado)}

    ${enCotidiana ? `
    <section class="tarjeta">
      <h2>Rubros</h2>
      <p class="suave">Los rubros de gasto y de ingreso: crear uno nuevo,
      renombrarlo, o unir dos en uno solo. Los movimientos se mueven con
      ellos.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="rubros">
        Ver los rubros
      </button>
    </section>` : ''}

    <section class="tarjeta">
      <h2>Etiquetas y detalles</h2>
      <p class="suave">Ver las que ya escribiste, renombrarlas —renombrar una con
      el nombre de otra las une— o sacarlas. Los movimientos no se tocan.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="etiquetas">
        Ver etiquetas y detalles
      </button>
    </section>

    <section class="tarjeta">
      <h2>Moneda base</h2>
      <p class="suave">En qué moneda se muestran todos los totales. De fábrica es
      el euro; se puede usar cualquiera de tus monedas.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="moneda-base">
        Ver la moneda base
      </button>
    </section>

    <section class="tarjeta">
      <h2>Monedas</h2>
      <p class="suave">Ver las que hay, agregar una nueva u ocultar las que ya no
      usás. Sirve para los dos lados de la app.</p>
      <button type="button" class="secundario" data-accion="ir" data-pantalla="monedas">
        Ver monedas
      </button>
    </section>

    ${enCotidiana ? `
    <section class="tarjeta">
      <h2>Tipos de cambio</h2>
      <p class="suave">Lo que vale cada moneda en ${escapar(base)}, mes por mes.
      Sin esto, un gasto en otra moneda no puede entrar en ningún total.</p>
      <!-- Solo en vida cotidiana: los ahorros NO se convierten a euros nunca
           (CU-14), así que ahí un tipo de cambio no cambiaría ningún número. -->
      <button type="button" class="secundario" data-accion="ir" data-pantalla="cambios">
        Ver tipos de cambio
      </button>
    </section>` : ''}
  `;
}
