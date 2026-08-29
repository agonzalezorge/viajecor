// T-026 — Tests de "tocar un total y ver qué lo compone".
//
// Hasta ahora cada agrupamiento era un callejón sin salida: el resumen decía
// "Supermercado 410,00 €" y para saber de qué se componía había que ir a la
// lista y leer el mes entero.
//
// Lo que puede salir mal acá no es que el filtro filtre: es que la lista
// filtrada **no diga que lo está**. Siete movimientos de doscientos, sin decir
// por qué, no se leen como "filtrado" sino como datos perdidos.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { movimientosFiltrados, hayFiltro } from '../src/core/calculos.js';
import { dibujarLista, dibujarFiltro } from '../src/ui/pantallas/lista.js';
import { dibujarDesglose } from '../src/ui/pantallas/resumen.js';
import { dibujarGastosFijos } from '../src/ui/pantallas/fijos.js';
import { dibujarEvolucion } from '../src/ui/pantallas/evolucion.js';
import { irA } from '../src/ui/app.js';

import { crearMovimiento, TIPO_GASTO, TIPO_INGRESO } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';

const MES = '2026-03';
let contador = 0;
function mov({ monto, rubro = 'supermercado', fecha = '2026-03-14', tipo = TIPO_GASTO, comentario = '', moneda = 'EUR' }) {
  contador += 1;
  return crearMovimiento(
    { monto, rubro, fecha, tipo, moneda, comentario },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: fecha }
  );
}

const estadoCon = (movimientos) =>
  ({ ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: [] });

const VARIOS = () => estadoCon([
  mov({ monto: '10', rubro: 'supermercado' }),
  mov({ monto: '20', rubro: 'supermercado' }),
  mov({ monto: '30', rubro: 'viajes' }),
  mov({ monto: '900', rubro: 'trabajo', tipo: TIPO_INGRESO }),
  mov({ monto: '40', rubro: 'supermercado', fecha: '2026-02-10' }),
]);


// ── El filtro ────────────────────────────────────────────────────────────────

test('filtra por rubro dentro del mes que se está mirando', () => {
  const filtrados = movimientosFiltrados(VARIOS(), MES, { tipo: TIPO_GASTO, rubro: 'supermercado' });

  assert.equal(filtrados.length, 2, 'febrero no tiene que entrar');
  assert.equal(filtrados.every((m) => m.rubro === 'supermercado'), true);
});

test('el tipo separa un ingreso de un gasto del mismo rubro', () => {
  // "Otros" existe en los dos lados: sin el tipo, tocar los gastos traería
  // ingresos y el total de la lista no cerraría con el que se tocó.
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'otros' }),
    mov({ monto: '900', rubro: 'otros', tipo: TIPO_INGRESO }),
  ]);

  assert.equal(movimientosFiltrados(estado, MES, { tipo: TIPO_GASTO, rubro: 'otros' }).length, 1);
  assert.equal(movimientosFiltrados(estado, MES, { tipo: TIPO_INGRESO, rubro: 'otros' }).length, 1);
});

test('el comentario mira todos los meses cuando se lo pide', () => {
  // La tarjeta de gastos fijos habla de TODO el historial: tocarla y ver un mes
  // sería mostrar una parte del número que se acaba de tocar.
  const estado = estadoCon([
    mov({ monto: '10', comentario: 'Luz', fecha: '2026-01-05' }),
    mov({ monto: '20', comentario: 'Luz', fecha: '2026-03-05' }),
  ]);

  assert.equal(movimientosFiltrados(estado, MES, { comentario: 'Luz' }).length, 1);
  assert.equal(movimientosFiltrados(estado, MES, { comentario: 'Luz', todosLosMeses: true }).length, 2);
});

test('compara por la clave, no por el texto (RN-03)', () => {
  // Tocar "Luz" tiene que traer los que se escribieron "luz", porque son los
  // mismos que se sumaron para dar ese número.
  const estado = estadoCon([
    mov({ monto: '10', comentario: 'Luz' }),
    mov({ monto: '20', comentario: 'luz' }),
    mov({ monto: '30', comentario: ' LUZ ' }),
  ]);

  assert.equal(movimientosFiltrados(estado, MES, { comentario: 'Luz', todosLosMeses: true }).length, 3);
});

test('un filtro vacío no es un filtro', () => {
  assert.equal(hayFiltro({}), false);
  assert.equal(hayFiltro(null), false);
  assert.equal(hayFiltro(undefined), false);
  assert.equal(hayFiltro({ todosLosMeses: true }), false, 'eso solo cambia el alcance, no filtra');
  assert.equal(hayFiltro({ rubro: 'viajes' }), true);
});

test('no tiene ningún tope de filas (L-001)', () => {
  const movimientos = Array.from({ length: 1500 }, () => mov({ monto: '1', rubro: 'viajes' }));
  assert.equal(movimientosFiltrados(estadoCon(movimientos), MES, { rubro: 'viajes' }).length, 1500);
});


// ── La lista filtrada TIENE que decir que lo está ────────────────────────────

test('la lista dice en qué está filtrada y cómo salir', () => {
  const html = dibujarLista({
    estado: VARIOS(), mes: MES, filtro: { tipo: TIPO_GASTO, rubro: 'supermercado' },
  });

  assert.ok(html.includes('Mostrando solo'), 'no dice que está filtrada');
  assert.ok(html.includes('Supermercado'));
  assert.ok(html.includes('marzo de 2026'), 'no dice de qué mes');
  assert.ok(html.includes('data-accion="quitar-filtro"'), 'no hay salida');
});

test('sin filtro no se dibuja ningún cartel', () => {
  const html = dibujarLista({ estado: VARIOS(), mes: MES });

  assert.equal(html.includes('Mostrando solo'), false);
  assert.equal(html.includes('quitar-filtro'), false);
});

test('el cartel dice "en todos los meses" cuando el filtro los mira todos', () => {
  const html = dibujarFiltro({
    estado: VARIOS(), mes: MES, filtro: { comentario: 'Luz', todosLosMeses: true },
  });

  assert.ok(html.includes('en todos los meses'));
  assert.equal(html.includes('marzo'), false, 'nombrar un mes acá sería mentira');
});

test('la lista filtrada muestra el total de lo filtrado', () => {
  // Es el número que se venía a desarmar: verlo repetido arriba confirma que la
  // lista de abajo es de verdad lo que lo compone.
  const html = dibujarLista({
    estado: VARIOS(), mes: MES, filtro: { tipo: TIPO_GASTO, rubro: 'supermercado' },
  });

  assert.ok(html.includes('30,00'), 'no muestra el total de los dos movimientos filtrados');
  assert.ok(html.includes('2 movimientos'));
});

test('un filtro sin resultados no dice "no hay movimientos en este mes"', () => {
  // Sería mentira: los hay, pero ninguno entra en el filtro. Y ofrecer cargar
  // uno nuevo sería el consejo equivocado: lo que hace falta es sacar el filtro.
  const html = dibujarLista({ estado: VARIOS(), mes: MES, filtro: { rubro: 'salud' } });

  assert.equal(html.includes('No hay movimientos en este mes'), false);
  assert.ok(html.includes('Ningún movimiento entra en este filtro'));
  assert.ok(html.includes('quitar-filtro'), 'y la salida tiene que estar igual');
  assert.equal(html.includes('data-pantalla="nuevo"'), false, 'cargar otro no arregla nada acá');
});

test('el filtro no sobrevive a cambiar de pestaña', () => {
  // Una lista filtrada a la que se vuelve media hora después no se lee como
  // filtrada: se lee como datos que faltan. Se llega filtrado tocando un total;
  // se llega entero tocando la pestaña.
  const vista = { pantalla: 'movimientos', mes: MES, estado: VARIOS(), filtro: { rubro: 'viajes' } };

  assert.equal(irA(vista, 'datos').filtro, null);
  assert.equal(irA(vista, 'movimientos').filtro, null);
});


// ── Las puertas de entrada ───────────────────────────────────────────────────

test('cada fila del desglose lleva a sus movimientos', () => {
  const html = dibujarDesglose(VARIOS(), MES, TIPO_GASTO);

  assert.ok(html.includes('data-accion="ver-rubro"'));
  assert.ok(html.includes('data-rubro="supermercado"'));
  assert.ok(html.includes(`data-tipo="${TIPO_GASTO}"`), 'sin el tipo traería ingresos del mismo rubro');
});

test('cada gasto fijo lleva a sus pagos, en todos los meses', () => {
  const estado = estadoCon([
    mov({ monto: '10', rubro: 'gastos fijos', comentario: 'Luz', fecha: '2026-01-05' }),
    mov({ monto: '20', rubro: 'gastos fijos', comentario: 'Luz', fecha: '2026-03-05' }),
  ]);
  const html = dibujarGastosFijos(estado);

  assert.ok(html.includes('data-accion="ver-comentario"'));
  assert.ok(html.includes('data-comentario="Luz"'));
});

test('una celda con plata de la matriz lleva a sus movimientos; la de cero no', () => {
  // Un botón que abre una lista vacía es peor que una celda quieta.
  const estado = estadoCon([mov({ monto: '10', rubro: 'viajes', fecha: '2026-01-05' })]);
  const html = dibujarEvolucion({ estado }, '2026-09');

  const celdas = [...html.matchAll(/<td class="importe( vacio)?"[^>]*>([\s\S]*?)<\/td>/g)];
  const conBoton = celdas.filter(([, , c]) => c.includes('ver-celda'));

  assert.equal(conBoton.length, 1, 'solo la celda de viajes tiene que llevar a algún lado');

  // Se mira DENTRO del botón de la celda, no en toda la página: `data-mes` está
  // también en el botón del mes, así que buscarlo suelto lo encuentra ahí y da
  // por buena una celda que no lleva su mes. Es L-024 otra vez, y esta versión
  // del test la escribí después de que una mutación sobreviviera.
  const boton = conBoton[0][2];
  assert.match(boton, /data-mes="2026-01"/, 'la celda tiene que llevar SU mes, no el que se mira');
  assert.match(boton, /data-rubro="viajes"/);
});

test('el mes de la matriz lleva a todos los movimientos de ese mes', () => {
  const estado = estadoCon([mov({ monto: '10', rubro: 'viajes', fecha: '2026-01-05' })]);
  const html = dibujarEvolucion({ estado }, '2026-09');

  assert.ok(html.includes('data-accion="ver-mes"'));
  assert.ok(html.includes('data-mes="2026-01"'));
});

test('el texto del usuario no puede romper la página desde un filtro', () => {
  const html = dibujarFiltro({ mes: MES, filtro: { comentario: '<script>x' } });

  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});
