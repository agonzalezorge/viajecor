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
import { PERFIL_COTIDIANA } from '../app.js';
import { monedaBaseDe } from '../../core/monedas.js';

export function dibujarAjustes(vista) {
  const enCotidiana = (vista.perfil ?? PERFIL_COTIDIANA) === PERFIL_COTIDIANA;
  const base = monedaBaseDe(vista.estado);

  return `
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
