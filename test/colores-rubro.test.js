// T-061 — Los colores de los rubros se eligen.
//
// ── Lo que hay que sostener acá ─────────────────────────────────────────────
//
// El color de un rubro salía de su POSICIÓN en la lista (ADR-049). Ahora el
// usuario puede elegirlo, y eso abre dos maneras de romper cosas:
//
//   1. Que el color elegido **no llegue** a alguna pantalla. Pasó exactamente
//      eso con la moneda base (L-035): un parámetro nuevo con valor por defecto
//      dejó once llamadas pintando con lo viejo, en silencio. Por eso los
//      colores viajan DENTRO del catálogo, que es el objeto que todas las
//      llamadas ya reciben — y por eso hay un test que recorre las pantallas.
//   2. Que un color inventado en un respaldo editado a mano rompa la app.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { franjaDeRubro, elegirColor, colorElegido, claveDeColor, COLORES } from '../src/core/paleta.js';
import { catalogoDe } from '../src/core/rubros.js';
import { rubrosIniciales, TIPO_GASTO, TIPO_INGRESO, crearMovimiento } from '../src/core/modelo.js';
import { estadoInicial, migrarEstado, leerColoresDeRubro } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { dibujarElegirColor, dibujarRubro } from '../src/ui/pantallas/rubros.js';
import { claseDeRubro } from '../src/ui/colores.js';

const estadoCon = (rubros) => ({ ...estadoInicial({ monedas: monedasIniciales() }), rubros });


// ── Elegir, y volver atrás ──────────────────────────────────────────────────

test('sin elegir nada, cada rubro tiene el color que le toca por su posición', () => {
  const catalogo = rubrosIniciales();
  assert.equal(franjaDeRubro(TIPO_GASTO, 'gastos fijos', catalogo), 1);
  assert.equal(franjaDeRubro(TIPO_GASTO, 'supermercado', catalogo), 2);
});

test('el color elegido gana sobre el de la posición', () => {
  const catalogo = elegirColor(rubrosIniciales(), TIPO_GASTO, 'supermercado', 14);

  assert.equal(franjaDeRubro(TIPO_GASTO, 'supermercado', catalogo), 14);
  assert.equal(franjaDeRubro(TIPO_GASTO, 'gastos fijos', catalogo), 1, 'los demás no se mueven');
});

test('se puede volver al de siempre sin acordarse de cuál era', () => {
  const con = elegirColor(rubrosIniciales(), TIPO_GASTO, 'supermercado', 14);
  const sin = elegirColor(con, TIPO_GASTO, 'supermercado', undefined);

  assert.equal(franjaDeRubro(TIPO_GASTO, 'supermercado', sin), 2);
  assert.equal(colorElegido(sin, TIPO_GASTO, 'supermercado'), undefined);
});

test('"otros" de gasto y "otros" de ingreso son dos rubros distintos', () => {
  // Existen en las dos listas y son cosas distintas (RN-02): pintar uno no puede
  // pintar el otro.
  const catalogo = elegirColor(rubrosIniciales(), TIPO_INGRESO, 'otros', 5);

  assert.equal(franjaDeRubro(TIPO_INGRESO, 'otros', catalogo), 5);
  assert.equal(franjaDeRubro(TIPO_GASTO, 'otros', catalogo), 8, 'el de gasto se quedó donde estaba');
  assert.notEqual(claveDeColor(TIPO_GASTO, 'otros'), claveDeColor(TIPO_INGRESO, 'otros'));
});

test('un color fuera de la paleta se rechaza al elegirlo', () => {
  for (const malo of [0, 21, -3, 2.5, 'azul', {}]) {
    assert.throws(() => elegirColor(rubrosIniciales(), TIPO_GASTO, 'viajes', malo), /color/i, String(malo));
  }
});

test('renombrar un rubro no le cambia el color al de su vecino', () => {
  // Con el color por posición, sacar un rubro corría todos los de abajo. El
  // color elegido queda atado a la clave, así que no se mueve — pero el que NO
  // fue elegido sigue dependiendo de la posición, y eso es lo de siempre.
  const catalogo = elegirColor(rubrosIniciales(), TIPO_GASTO, 'salud', 17);
  assert.equal(franjaDeRubro(TIPO_GASTO, 'salud', catalogo), 17);
});


// ── Que llegue a las pantallas ──────────────────────────────────────────────

test('el color elegido llega a claseDeRubro, que es lo que pinta todo', () => {
  // claseDeRubro() es por donde pasan el punto de la lista, la columna de la
  // tabla, la porción de la torta y el borde del campo. Si el color no llega
  // acá, no llega a ningún lado.
  const rubros = elegirColor(rubrosIniciales(), TIPO_GASTO, 'supermercado', 14);

  assert.equal(claseDeRubro(TIPO_GASTO, 'supermercado', rubros), 'rubro-14');
});

test('el catálogo que se le pasa a las pantallas lleva los colores', () => {
  // Es lo que hace que no haga falta un parámetro nuevo en cincuenta llamadas
  // — que es lo que causó L-035.
  const estado = estadoCon(elegirColor(rubrosIniciales(), TIPO_GASTO, 'viajes', 9));

  assert.equal(catalogoDe(estado).colores[claveDeColor(TIPO_GASTO, 'viajes')], 9);
  assert.equal(franjaDeRubro(TIPO_GASTO, 'viajes', catalogoDe(estado)), 9);
});

test('la fila del rubro trae el botón para cambiarle el color', () => {
  const html = dibujarRubro('viajes', 3, TIPO_GASTO, ['viajes', 'salud'], { estado: estadoCon(rubrosIniciales()) });

  assert.match(html, /data-accion="pintar-rubro"[^>]*data-rubro="viajes"/);
});

test('el selector ofrece los veinte colores y marca el que está puesto', () => {
  const estado = estadoCon(elegirColor(rubrosIniciales(), TIPO_GASTO, 'viajes', 9));
  const html = dibujarElegirColor('viajes', TIPO_GASTO, { estado });

  assert.equal((html.match(/data-accion="elegir-color"/g) ?? []).length, COLORES + 1,
    'los veinte, más el de volver al de siempre');
  assert.match(html, /class="casilla-color rubro-9 puesto"/);
  assert.match(html, /data-franja="20"/);
});

test('sin color propio no se ofrece "volver al de siempre"', () => {
  // No haría nada: es un botón que promete un cambio que ya está hecho.
  const html = dibujarElegirColor('viajes', TIPO_GASTO, { estado: estadoCon(rubrosIniciales()) });

  assert.equal(html.includes('Volver al de siempre'), false);
  assert.equal((html.match(/data-accion="elegir-color"/g) ?? []).length, COLORES);
});

test('avisa cuáles colores ya usa otro rubro, sin prohibirlos', () => {
  // Si alguien quiere sus dos rubros de comida del mismo verde, es su planilla.
  // Lo que no puede pasar es que lo haga sin enterarse.
  const html = dibujarElegirColor('viajes', TIPO_GASTO, { estado: estadoCon(rubrosIniciales()) });

  assert.match(html, /lo usa Supermercado/, 'dice quién usa el color 2');
  assert.match(html, /data-franja="2"/, 'y deja elegirlo igual');
});


// ── Guardar y volver a leer ─────────────────────────────────────────────────

test('el color sobrevive a guardar y volver a leer', () => {
  const estado = estadoCon(elegirColor(rubrosIniciales(), TIPO_GASTO, 'salud', 11));
  const leido = migrarEstado(JSON.parse(JSON.stringify(estado)));

  assert.equal(franjaDeRubro(TIPO_GASTO, 'salud', leido.rubros), 11);
});

test('un color inventado en un respaldo se descarta, y no se lleva puesto el archivo', () => {
  // Un respaldo editado a mano puede traer cualquier cosa. Perder los
  // movimientos por un color raro sería desproporcionado: el rubro vuelve al
  // color de siempre y se avisa.
  const incidencias = [];
  const colores = leerColoresDeRubro({ 'G:salud': 99, 'G:viajes': 7, 'mal': 3, 'I:otros': 'azul' }, incidencias);

  assert.deepEqual(colores, { 'G:viajes': 7 });
  assert.equal(incidencias.length, 1);
  assert.match(incidencias[0], /colores de rubro/i);
});

test('sin colores guardados, un estado viejo se lee sin incidencias', () => {
  const incidencias = [];
  assert.deepEqual(leerColoresDeRubro(undefined, incidencias), {});
  assert.deepEqual(leerColoresDeRubro(null, incidencias), {});
  assert.deepEqual(incidencias, []);
});

test('un color fuera de rango ya guardado se ignora al pintar', () => {
  // `elegirColor()` no deja guardarlo y la lectura lo descarta, pero un estado
  // armado a mano —o un dato de una versión futura con más colores— puede llegar
  // igual hasta acá. Que el rubro vuelva al color de siempre es mejor que pintar
  // con una clase CSS que no existe, que lo dejaría invisible.
  for (const malo of [0, 21, 99, -1, 2.5, 'azul', null]) {
    const catalogo = { ...rubrosIniciales(), colores: { [claveDeColor(TIPO_GASTO, 'salud')]: malo } };

    assert.equal(colorElegido(catalogo, TIPO_GASTO, 'salud'), undefined, String(malo));
    assert.equal(franjaDeRubro(TIPO_GASTO, 'salud', catalogo), 7, 'vuelve al de su posición');
  }
});
