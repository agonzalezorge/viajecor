// Las instrucciones de la app — T-065, CU-21.
//
// ── Para quién está escrito ─────────────────────────────────────────────────
//
// Lo pidió el usuario: una sección que le explique **a un desconocido que la
// abre por primera vez** todo lo que puede hacer y todo lo que puede configurar.
// No es una ayuda de referencia para buscar una cosa puntual: es lo que alguien
// lee una vez, de arriba abajo, para entender de qué se trata.
//
// Por eso está escrito en el orden en que las cosas se necesitan —primero anotar
// un gasto, al final los tipos de cambio— y no en el orden en que la app está
// construida. Y por eso cada sección dice **para qué sirve** antes de decir
// dónde se toca: quien no sabe qué es un "grupo" no encuentra la pantalla de
// grupos por más que se la nombren.
//
// ── Por qué va plegada ──────────────────────────────────────────────────────
//
// Entero es largo, y una pared de texto en un teléfono no se lee: se cierra.
// Cada sección es un `<details>` con su título a la vista, así la primera
// pantalla es un índice de siete líneas que se puede recorrer con el pulgar. El
// `<details>` es del navegador, no de la app: funciona sin JavaScript y el
// buscador del navegador encuentra adentro aunque esté cerrado.
//
// Igual que el resto de la interfaz (ADR-022), es una función pura.

import { escapar } from '../app.js';
import { monedaBaseDe } from '../../core/monedas.js';

/** Una sección plegable. El título se ve siempre; el cuerpo, al tocarlo. */
function seccion(titulo, cuerpo, abierta = false) {
  return `
    <details class="instruccion"${abierta ? ' open' : ''}>
      <summary>${escapar(titulo)}</summary>
      ${cuerpo}
    </details>
  `;
}

export function dibujarInstrucciones(vista) {
  const base = monedaBaseDe(vista?.estado ?? {});

  return `
    <section class="tarjeta">
      <h2>Cómo funciona Viajecor</h2>
      <p class="suave nota">Una app para anotar en qué se te va la plata. Está
      pensada para el momento en que gastás —parado en la caja, con una mano— y
      para responder después las preguntas que uno se hace: en qué se me fue el
      mes, cuánto me salió ese viaje, cuánto me sale la luz.</p>

      <p class="suave nota"><strong>Tus datos son tuyos y están en este
      dispositivo.</strong> La app no manda nada a ningún lado: no tiene cuenta,
      ni nube, ni funciona peor sin internet — funciona igual, porque nunca la
      usa. Eso tiene una contracara importante, y está explicada abajo, en
      <em>Respaldos</em>: si perdés el dispositivo sin haber bajado una copia,
      los datos se van con él.</p>
    </section>

    <section class="tarjeta">
      ${seccion('1 · Anotar un gasto o un ingreso', `
        <p>La pestaña <strong>Cargar</strong> es la primera y es donde la app se
        abre. Escribís el monto, elegís el rubro y guardás: eso es todo lo
        obligatorio. La fecha ya viene puesta en hoy y la moneda en la última
        que usaste.</p>
        <p><strong>Gasto o ingreso</strong> se elige con los dos botones de
        arriba. Un gasto nunca se anota en negativo: para eso está el botón.</p>
        <p><strong>Rubro</strong> es la categoría —supermercado, transporte,
        salud—. Cada uno tiene su color, y ese color es el mismo en toda la app.</p>
        <p><strong>Detalle</strong> es una nota para vos ("cena con Ana"). No
        agrupa nada, es para acordarte.</p>
        <p><strong>Etiquetas</strong> sí agrupan, y son la idea más útil de la
        app: poniéndole <em>Roma</em> a todos los gastos de un viaje, la app te
        dice sola cuánto salió ese viaje. Podés poner <strong>varias separadas
        por coma</strong> — un viaje de trabajo va con <em>Roma, Trabajo</em> y
        cuenta en los dos grupos. Mientras escribís te ofrece las que ya usaste:
        conviene elegirlas de ahí, porque <em>Roma</em> y <em>roma 26</em> son
        dos grupos distintos.</p>
        <p>Si la fecha que quedó puesta no es la de hoy, aparece un botón
        <strong>Hoy</strong> al lado del calendario.</p>
        <p>Abajo de todo están los últimos cinco que cargaste, para confirmar de
        un vistazo que se guardó.</p>
      `, true)}

      ${seccion('2 · Ver cómo viene el mes', `
        <p>La pestaña <strong>Mes</strong> responde "¿cómo vengo?". Arriba, los
        tres números: gastos, ingresos y saldo. Debajo, en qué se te fue, con una
        torta y la lista de rubros al lado.</p>
        <p><strong>Cualquier número se puede tocar</strong> y te lleva a los
        movimientos que lo componen. Es la regla de toda la app: ningún total es
        un callejón sin salida.</p>
        <p>Las porciones de la torta van <strong>en el orden de tus rubros</strong>,
        no de mayor a menor: así cargar un gasto no cambia qué color queda al lado
        de cuál. La lista de al lado, que es donde se comparan los números, sí va
        del que más gastaste al que menos.</p>
        <p>Con las flechas de arriba cambiás de mes.</p>
      `)}

      ${seccion('3 · Corregir, borrar y buscar', `
        <p>La pestaña <strong>Movimientos</strong> es la lista completa del mes,
        donde se corrige y se borra. Cada uno tiene sus dos botones.</p>
        <p><strong>Borrar se puede deshacer</strong>: aparece un aviso con
        "Deshacer" justo después.</p>
        <p>Arriba hay una <strong>lupa</strong> que busca en
        <strong>todos</strong> los meses y en todos los campos: la etiqueta, el
        detalle, el rubro, el importe, la moneda y la fecha. No distingue
        mayúsculas ni tildes.</p>
      `)}

      ${seccion('4 · Las preguntas del historial', `
        <p>En <strong>Datos → Mirar el historial</strong> están las cuatro
        respuestas que la app calcula sola:</p>
        <p><strong>Evolución mes a mes.</strong> La tabla de todos tus meses por
        rubro, con su total y su promedio, más dos gráficos. Arriba podés
        <strong>recortar el período</strong> y todo lo de abajo se recalcula.</p>
        <p><strong>Gasto por viaje.</strong> Cada etiqueta que tenga al menos un
        gasto del rubro <em>viajes</em> se convierte en un viaje, con
        <strong>todos</strong> sus rubros adentro —la comida y el transporte de
        esos días también son del viaje—. Si le escribís las fechas, te dice
        cuánto salió por día. Si el viaje tuvo ingresos, lo que cuesta es lo que
        quedaste poniendo, y al abrirlo ves los tres números.</p>
        <p><strong>Cuánto sale cada gasto fijo.</strong> Las etiquetas cuyos
        gastos son todos del rubro <em>gastos fijos</em>: la luz, el alquiler. Lo
        que se destaca es el promedio por pago, no el total.</p>
        <p><strong>Otros grupos.</strong> Todo lo demás que agrupaste con una
        etiqueta: una mudanza, unos regalos, un trabajo suelto. Pueden ser de
        gastos, de ingresos —ahí te dice cuánto entra por mes— o de los dos.</p>
      `)}

      ${seccion('5 · Los ahorros: dónde está la plata guardada', `
        <p>Con los botones de arriba del todo cambiás de pestaña. Son partes
        separadas de la app: lo que cargues en una no aparece en la otra, y
        ninguna entra en los totales del mes.</p>
        <p><strong>Ahorros conjuntos</strong> es la plata de dos, con la pregunta
        de <em>quién la tiene</em> — no de quién es: es de los dos, y lo que se
        anota es dónde está guardada hoy.</p>
        <p><strong>Mis ahorros</strong> es la tuya: lo que tenés en cada banco,
        en cada plataforma, en cada cuenta. La cuenta se escribe a mano y la app
        te sugiere las que ya usaste; da lo mismo cómo la escribas la segunda vez
        —<em>Santander</em> y <em>santander</em> son la misma—. Viene apagada:
        se prende en <strong>Ajustes → Pestañas</strong>.</p>
        <p>Las dos funcionan igual: son un <strong>historial</strong> de plata
        que entró y salió, no una foto de saldos. Así ves cómo evolucionó, y
        corregir un error es anotar el movimiento que faltaba.</p>
        <p><strong>Cada moneda se muestra por separado y nunca se
        convierte</strong>: sumar dólares y pesos al cambio de hoy daría un
        número que mañana es otro.</p>
      `)}

      ${seccion('6 · Datos: respaldos, importar y exportar', `
        <p class="nota"><strong>Los datos viven en este dispositivo y en ningún
        otro lado.</strong> Se pierden si borrás los datos del navegador, si
        desinstalás la app, o si el teléfono se rompe o se pierde.</p>
        <p>En la pestaña <strong>Datos</strong> tenés <strong>Bajar un
        respaldo</strong>: un
        archivo con todo —movimientos, monedas, tipos de cambio, rubros y
        ajustes— que podés volver a cargar acá o en otro dispositivo. Hacelo cada
        tanto y guardalo en otro lado.</p>
        <p>También podés exportar una <strong>planilla de Excel</strong> para
        mirarla, o un <strong>CSV</strong> para hacer cuentas en otro lado. Esos
        dos <em>no</em> son un respaldo: no traen los tipos de cambio ni tus
        monedas.</p>
        <p>Y podés <strong>importar</strong>: un respaldo, o una planilla de
        Excel con tus gastos. Antes de tocar nada te muestra qué va a entrar.</p>
      `)}

      ${seccion('7 · Lo que podés configurar', `
        <p>Todo esto está en <strong>Ajustes</strong>, esta misma pantalla.</p>
        <p><strong>Pestañas.</strong> Qué partes de la app se ven arriba. Si no
        compartís ahorros con nadie, apagá <em>Ahorros conjuntos</em>; si querés
        llevar la cuenta de tus bancos, prendé <em>Mis ahorros</em>. Apagar una
        <strong>no borra nada</strong>: los movimientos quedan guardados, el
        respaldo se los sigue llevando y vuelven al prenderla.</p>
        <p><strong>Rubros.</strong> Crear, renombrar, unir dos en uno,
        <strong>cambiarles el color</strong> (entre veinte elegidos para que se
        distingan entre sí) y <strong>cambiarles el orden</strong> con ↑ y ↓.
        Renombrar y unir mueven también los movimientos: nada se borra.</p>
        <p>El orden que les des es el que tienen <strong>en toda la app</strong>:
        las listas, la tabla de la evolución y las porciones de las tortas. Los
        colores <strong>no se mueven con ellos</strong>: cada rubro se queda con
        el suyo, así que un rubro que subís sigue siendo del mismo color.</p>
        <p><strong>Etiquetas y detalles.</strong> Ver todo lo que escribiste y
        arreglarlo. Renombrar una etiqueta con el nombre de otra las une — es la
        salida cuando <em>Roma</em> y <em>roma 26</em> quedaron separadas.</p>
        <p><strong>Moneda base.</strong> La moneda en la que se muestran todos
        los totales; ahora es <strong>${escapar(base)}</strong>. Cambiarla no
        toca ningún movimiento: cada uno sigue guardado en su moneda. Antes de
        confirmar, la app te dice con números qué va a pasar.</p>
        <p><strong>Monedas.</strong> Agregar las que uses, con sus decimales.</p>
        <p><strong>Tipos de cambio.</strong> Cuánto vale cada moneda en
        ${escapar(base)}, mes por mes. No hace falta ir a buscarlos: la app te
        los pide sola la primera vez que cargás un gasto en otra moneda. Acá
        están para corregirlos o para cargar los que falten.</p>
      `)}

      ${seccion('Dos reglas que la app nunca rompe', `
        <p><strong>No inventa números.</strong> Si le falta un tipo de cambio, un
        gasto no se cuenta como cero: el total sale marcado como incompleto y te
        dice qué falta. Un número que parece exacto y no lo es es peor que
        ningún número.</p>
        <p><strong>Nada se borra solo.</strong> Renombrar, unir, cambiar la
        moneda base o los decimales de una moneda nunca borra un movimiento, y
        cuando algo va a cambiar totales que ya viste, la app te lo dice antes
        con los números en la mano.</p>
      `)}
    </section>
  `;
}
