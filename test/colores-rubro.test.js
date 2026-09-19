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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { monedasIniciales } from '../src/core/monedas.js';
import { dibujarElegirColor, dibujarRubro, dibujarRubrosDe } from '../src/ui/pantallas/rubros.js';
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


// ── El color tiene que llegar a TODAS las pantallas (T-067) ─────────────────
//
// Lo reportó el usuario: el color elegido se veía en Ajustes y en ningún otro
// lado. Ocho llamadas pintaban con el catálogo de fábrica, así que ignoraban
// tanto los colores elegidos como los rubros que el usuario había creado — o
// sea que este agujero era más viejo que los colores: venía desde T-048, y
// poder elegir el color solo lo hizo visible.
//
// Es la segunda vez que pasa lo mismo con un parámetro que, si falta, miente en
// silencio (L-035). Por eso ahora hay una guardia de construcción, y por eso
// estos tests recorren las pantallas de verdad.

import { llamadasSinCatalogo } from '../tools/moneda-base.mjs';
import { dibujarResumen } from '../src/ui/pantallas/resumen.js';
import { dibujarEvolucion } from '../src/ui/pantallas/evolucion.js';
import { dibujarLista } from '../src/ui/pantallas/lista.js';
import { dibujarNuevo } from '../src/ui/pantallas/movimiento.js';
import { moverRubro } from '../src/core/rubros.js';

let cuenta = 0;
const gasto = (monto, rubro) => {
  cuenta += 1;
  return crearMovimiento({ monto, moneda: 'EUR', fecha: '2026-09-10', tipo: TIPO_GASTO, rubro, comentario: 'Feria' },
    { decimales: 2, id: `c${cuenta}`, creado: '2026-09-10' });
};

/** Un estado con supermercado pintado del color 14 y un gasto de ese rubro. */
const conColor = () => ({
  ...estadoInicial({ monedas: monedasIniciales() }),
  tipos_cambio: [],
  movimientos: [gasto('100', 'supermercado')],
  rubros: elegirColor(rubrosIniciales(), TIPO_GASTO, 'supermercado', 14),
});

test('el color elegido llega al resumen del mes, la lista, la evolución y el formulario', () => {
  // Una por una, porque el bug era justamente que una pantalla lo tenía y las
  // otras no. Comprobar solo `claseDeRubro` no habría encontrado nada: esa
  // función andaba bien, lo que fallaba era quién la llamaba.
  const estado = conColor();
  const vista = { estado, mes: '2026-09' };

  const pantallas = {
    resumen: dibujarResumen(vista, '2026-09'),
    lista: dibujarLista(vista),
    evolucion: dibujarEvolucion({ ...vista, estado: { ...estado, movimientos: [gasto('50', 'supermercado'), ...estado.movimientos] } }, '2026-09'),
    formulario: dibujarNuevo({ estado, borrador: { tipo: TIPO_GASTO, rubro: 'supermercado', monto: '10', moneda: 'EUR', fecha: '2026-09-10', comentario: '', detalle: '' } }),
  };

  for (const [cual, html] of Object.entries(pantallas)) {
    assert.match(html, /rubro-14/, `el color elegido no llegó a ${cual}`);
    assert.equal(/punto-rubro rubro-2\b/.test(html), false, `${cual} sigue pintando supermercado del color viejo`);
  }
});

test('la torta también, que es donde el color es todo lo que hay', () => {
  // Con un solo rubro no hay torta —un círculo de un color no dice nada—, así
  // que hace falta un segundo gasto para que se dibuje.
  const base = conColor();
  const estado = { ...base, movimientos: [...base.movimientos, gasto('50', 'viajes')] };
  const html = dibujarResumen({ estado, mes: '2026-09' }, '2026-09');
  const porciones = [...html.matchAll(/class="porcion rubro-(\d+)"/g)].map((m) => m[1]);

  assert.ok(porciones.includes('14'), `las porciones salieron ${porciones.join(', ')}`);
});

test('la guardia de construcción encuentra una llamada que se olvidó el catálogo', () => {
  // Lo importante: **dentro de una plantilla**, que es donde vive toda la
  // interfaz de esta app. La primera versión de la guardia blanqueaba las
  // plantillas y no encontraba nada; se probó rompiendo una llamada a propósito
  // y la construcción pasó igual.
  const dentro = 'const x = `<span class="p ${claseDeRubro(m.tipo, m.rubro)}"></span>`;';
  const bien = 'const x = `<span class="p ${claseDeRubro(m.tipo, m.rubro, cat)}"></span>`;';

  assert.equal(llamadasSinCatalogo(new Map([['p.js', dentro]])).length, 1);
  assert.equal(llamadasSinCatalogo(new Map([['p.js', bien]])).length, 0);
});

test('y no se queja del nombre escrito dentro de un texto', () => {
  assert.equal(llamadasSinCatalogo(new Map([['p.js', "throw new Error('claseDeRubro(a, b) falló');"]])).length, 0);
  assert.equal(llamadasSinCatalogo(new Map([['p.js', 'const m = `usá claseDeRubro(a, b)`;']])).length, 0);
});

test('todo src/ pasa la guardia del catálogo', () => {
  const archivos = new Map();
  const recorrer = (carpeta) => {
    for (const entrada of readdirSync(carpeta)) {
      const ruta = join(carpeta, entrada);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (ruta.endsWith('.js')) archivos.set(ruta, readFileSync(ruta, 'utf8'));
    }
  };
  recorrer('src');

  assert.deepEqual(llamadasSinCatalogo(archivos).map((p) => p.mensaje), []);
});


// ── Reordenar los rubros ────────────────────────────────────────────────────

test('subir y bajar cambian el lugar en la lista', () => {
  const inicial = { ...estadoInicial({ monedas: monedasIniciales() }) };
  const lista = (e) => catalogoDe(e).gasto;
  const donde = (e, r) => lista(e).indexOf(r);

  const arriba = moverRubro(inicial, TIPO_GASTO, 'salud', 'arriba');
  assert.equal(donde(arriba, 'salud'), donde(inicial, 'salud') - 1);

  const abajo = moverRubro(inicial, TIPO_GASTO, 'salud', 'abajo');
  assert.equal(donde(abajo, 'salud'), donde(inicial, 'salud') + 1);
  assert.equal(lista(abajo).length, lista(inicial).length, 'no se pierde ni se duplica ninguno');
});

test('mover un rubro NO le cambia el color a ninguno', () => {
  // Es lo que hace que reordenar sea seguro: el color sale de la posición, así
  // que sin congelarlos, subir un rubro repintaría a todos los que se corren —
  // y el color es lo que ata la torta con la tabla y con la lista.
  const inicial = { ...estadoInicial({ monedas: monedasIniciales() }) };
  const antes = new Map(catalogoDe(inicial).gasto.map((r) => [r, franjaDeRubro(TIPO_GASTO, r, inicial.rubros)]));

  const movido = moverRubro(inicial, TIPO_GASTO, 'salud', 'arriba');

  for (const [rubro, franja] of antes) {
    assert.equal(franjaDeRubro(TIPO_GASTO, rubro, movido.rubros), franja, `${rubro} cambió de color`);
  }
});

test('y respeta el color que el usuario ya había elegido', () => {
  const conElegido = {
    ...estadoInicial({ monedas: monedasIniciales() }),
    rubros: elegirColor(rubrosIniciales(), TIPO_GASTO, 'salud', 19),
  };
  const movido = moverRubro(conElegido, TIPO_GASTO, 'salud', 'arriba');

  assert.equal(franjaDeRubro(TIPO_GASTO, 'salud', movido.rubros), 19);
});

test('contra los bordes no pasa nada, y no es un error', () => {
  // La pantalla no dibuja el botón que sobra, pero un toque doble o un respaldo
  // pueden llegar igual: tirar acá sería romper la app por un gesto.
  const inicial = { ...estadoInicial({ monedas: monedasIniciales() }) };
  const primero = catalogoDe(inicial).gasto[0];
  const ultimo = catalogoDe(inicial).gasto.at(-1);

  assert.deepEqual(catalogoDe(moverRubro(inicial, TIPO_GASTO, primero, 'arriba')).gasto, catalogoDe(inicial).gasto);
  assert.deepEqual(catalogoDe(moverRubro(inicial, TIPO_GASTO, ultimo, 'abajo')).gasto, catalogoDe(inicial).gasto);
});

test('un rubro que no está en la lista se rechaza en vez de mover otro', () => {
  const inicial = { ...estadoInicial({ monedas: monedasIniciales() }) };
  assert.throws(() => moverRubro(inicial, TIPO_GASTO, 'inventado', 'arriba'), /no está en la lista/);
});

test('mover los de ingreso no toca los de gasto', () => {
  const inicial = { ...estadoInicial({ monedas: monedasIniciales() }) };
  const movido = moverRubro(inicial, TIPO_INGRESO, 'inversiones', 'arriba');

  assert.deepEqual(catalogoDe(movido).gasto, catalogoDe(inicial).gasto);
  assert.equal(catalogoDe(movido).ingreso[0], 'inversiones');
});

test('el nuevo orden sobrevive a guardar y volver a leer', () => {
  const movido = moverRubro({ ...estadoInicial({ monedas: monedasIniciales() }) }, TIPO_GASTO, 'salud', 'arriba');
  const leido = migrarEstado(JSON.parse(JSON.stringify(movido)));

  assert.deepEqual(catalogoDe(leido).gasto, catalogoDe(movido).gasto);
  assert.equal(franjaDeRubro(TIPO_GASTO, 'salud', leido.rubros), 7, 'y el color congelado también');
});

test('la fila trae los botones de mover, salvo en los extremos', () => {
  const estado = { ...estadoInicial({ monedas: monedasIniciales() }) };
  const lista = catalogoDe(estado).gasto;
  const fila = (r, i) => dibujarRubro(r, 0, TIPO_GASTO, lista, { estado }, i);

  assert.equal(fila(lista[0], 0).includes('data-hacia="arriba"'), false, 'el primero no puede subir');
  assert.match(fila(lista[0], 0), /data-hacia="abajo"/);

  const ultimo = lista.length - 1;
  assert.match(fila(lista[ultimo], ultimo), /data-hacia="arriba"/);
  assert.equal(fila(lista[ultimo], ultimo).includes('data-hacia="abajo"'), false, 'el último no puede bajar');

  const medio = fila(lista[3], 3);
  assert.match(medio, /data-hacia="arriba"/);
  assert.match(medio, /data-hacia="abajo"/);
});

test('al reordenar, el color elegido a mano no se pisa con el de la posición', () => {
  // Congelar los colores no puede significar "pisarlos todos": el que el usuario
  // eligió tiene que seguir siendo el suyo después de mover cualquier rubro.
  const conElegido = {
    ...estadoInicial({ monedas: monedasIniciales() }),
    rubros: elegirColor(rubrosIniciales(), TIPO_GASTO, 'viajes', 19),
  };
  const movido = moverRubro(conElegido, TIPO_GASTO, 'salud', 'arriba');

  assert.equal(colorElegido(movido.rubros, TIPO_GASTO, 'viajes'), 19,
    'se pisó el color elegido con el de la posición');
});

test('la lista de Ajustes le pasa a cada fila su posición', () => {
  // Sin la posición, ninguna fila sabe si es la primera o la última y todas
  // dibujan los dos botones — incluido el que no hace nada.
  const estado = { ...estadoInicial({ monedas: monedasIniciales() }) };
  const html = dibujarRubrosDe({ estado }, TIPO_GASTO);
  const filas = html.split('<li class="fila-rubro">').slice(1);

  assert.equal(filas[0].includes('data-hacia="arriba"'), false, 'la primera fila no puede subir');
  assert.equal(filas.at(-1).includes('data-hacia="abajo"'), false, 'la última no puede bajar');
  assert.match(filas[1], /data-hacia="arriba"/);
});

test('la guardia vigila las dos funciones que pintan, no solo una', () => {
  const soloUna = 'const x = `${franjaDeRubro(t, r)}`;';
  assert.equal(llamadasSinCatalogo(new Map([['p.js', soloUna]])).length, 1, 'franjaDeRubro no se está vigilando');
});


// ── El orden de la torta sigue el de Ajustes (T-068) ────────────────────────

import { dibujarTorta } from '../src/ui/pantallas/graficos.js';
import { rubrosDe } from '../src/core/modelo.js';

/** Los rubros de la torta, en el orden en que se dibujaron. */
const enLaTorta = (html) => [...html.matchAll(/<title>([^:<]+):/g)].map((m) => m[1].toLowerCase());

test('las porciones van en el orden de la lista de rubros, no por tamaño', () => {
  // Lo de "no por tamaño" es la regla vieja (ADR-029) y sigue en pie: si el
  // orden dependiera de los montos, cargar un gasto cambiaría qué color queda
  // pegado a cuál, y un par que hoy se distingue mañana no.
  const catalogo = rubrosIniciales();
  const filas = [
    { rubro: 'salud', total: 90000 },        // el más caro, y va séptimo
    { rubro: 'supermercado', total: 1000 },  // el más barato, y va segundo
    { rubro: 'viajes', total: 5000 },
  ];

  assert.deepEqual(enLaTorta(dibujarTorta(filas, TIPO_GASTO, 'EUR', catalogo)),
    ['supermercado', 'viajes', 'salud']);
});

test('al mover un rubro en Ajustes, la torta se reordena con él', () => {
  // Es el pedido del usuario. Antes el orden salía del COLOR, que desde T-067
  // se congela al reordenar: la torta quedaba en un orden que ya no se
  // correspondía con ninguna lista visible.
  const filas = [
    { rubro: 'salud', total: 90000 },
    { rubro: 'supermercado', total: 1000 },
    { rubro: 'viajes', total: 5000 },
  ];
  let estado = { ...estadoInicial({ monedas: monedasIniciales() }) };

  const antes = enLaTorta(dibujarTorta(filas, TIPO_GASTO, 'EUR', estado.rubros));
  assert.deepEqual(antes, ['supermercado', 'viajes', 'salud']);

  // Salud sube hasta quedar antes que viajes (de la 7 a la 4).
  for (let i = 0; i < 3; i += 1) estado = moverRubro(estado, TIPO_GASTO, 'salud', 'arriba');
  assert.ok(rubrosDe(TIPO_GASTO, estado.rubros).indexOf('salud')
    < rubrosDe(TIPO_GASTO, estado.rubros).indexOf('viajes'));

  assert.deepEqual(enLaTorta(dibujarTorta(filas, TIPO_GASTO, 'EUR', estado.rubros)),
    ['supermercado', 'salud', 'viajes'], 'la torta no siguió a la lista');
});

test('y los colores siguen siendo los de cada rubro, no los de su lugar en la torta', () => {
  // La otra mitad: reordenar cambia el ORDEN de las porciones, no su color.
  const filas = [{ rubro: 'salud', total: 90000 }, { rubro: 'supermercado', total: 1000 }];
  let estado = { ...estadoInicial({ monedas: monedasIniciales() }) };
  for (let i = 0; i < 5; i += 1) estado = moverRubro(estado, TIPO_GASTO, 'salud', 'arriba');

  const html = dibujarTorta(filas, TIPO_GASTO, 'EUR', estado.rubros);

  assert.match(html, /class="porcion rubro-7"/, 'salud conserva su color');
  assert.match(html, /class="porcion rubro-2"/, 'y supermercado el suyo');
});

test('un rubro que ya no está en la lista va al final en vez de romper el dibujo', () => {
  // Puede llegar de un respaldo de otro dispositivo con más rubros (T-048).
  const filas = [
    { rubro: 'fantasma', total: 1000 },
    { rubro: 'supermercado', total: 2000 },
  ];
  const html = dibujarTorta(filas, TIPO_GASTO, 'EUR', rubrosIniciales());

  assert.deepEqual(enLaTorta(html), ['supermercado', 'fantasma']);
});

test('un rubro escrito con mayúsculas o tildes cae en su lugar, no al final', () => {
  // Lo encontró una mutación: sacarle el `normalizarClave` al orden no rompía
  // ningún test. Y sin embargo importa, porque `franjaDeRubro` SÍ normaliza: un
  // rubro escrito distinto se pintaría con el color de su rubro y se dibujaría
  // al final igual, que es exactamente el vecindario de colores impredecible
  // que ADR-029 quiere evitar. Los dos lados normalizan o ninguno.
  const filas = [
    { rubro: 'Salud', total: 1000 },
    { rubro: 'SUPERMERCADO', total: 2000 },
  ];
  const html = dibujarTorta(filas, TIPO_GASTO, 'EUR', rubrosIniciales());

  assert.deepEqual(enLaTorta(html), ['supermercado', 'salud']);
});

test('un rubro que no es texto no rompe el dibujo', () => {
  // Otra mutación sobreviviente: sin el `String(...)`, `normalizarClave` TIRA
  // cuando lo que llega no es texto. Y una excepción acá no es una torta fea:
  // mata el repintado entero de la pantalla, que es como quedó trancada la
  // carga en T-056 (L-033). Un respaldo editado a mano alcanza para llegar.
  const filas = [{ rubro: 7, total: 1000 }, { rubro: 'supermercado', total: 2000 }];

  const html = dibujarTorta(filas, TIPO_GASTO, 'EUR', rubrosIniciales());
  assert.deepEqual(enLaTorta(html), ['supermercado', '7']);
});
