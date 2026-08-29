// T-015 — Tests de la lista, corregir y borrar.
//
// Es la única pantalla de la app que **destruye datos**, y detrás no hay
// papelera ni historial: lo que se borra acá se fue. Casi todos los tests son
// sobre las dos redes de contención —confirmar antes, deshacer después— y sobre
// que corregir un movimiento siga siendo el mismo movimiento.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dibujarLista,
  dibujarDeshacer,
  borrarMovimiento,
  restaurarMovimiento,
  buscarMovimiento,
} from '../src/ui/pantallas/lista.js';

import { intentarGuardar, borradorNuevo, borradorDesde } from '../src/ui/pantallas/movimiento.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { crearCambio, desdeUnidadesPorEuro } from '../src/core/cambio.js';
import { TIPO_INGRESO } from '../src/core/modelo.js';

const DURO = '\u00A0';
const MES = '2026-03';

const CAMBIO = crearCambio(
  { moneda: 'CRC', mes: MES, euros_por_unidad: desdeUnidadesPorEuro(630) },
  { creado: '2026-03-14' }
);

function estadoLimpio() {
  return { ...estadoInicial({ monedas: monedasIniciales() }), tipos_cambio: [CAMBIO] };
}

function cargar(estado, campos = {}) {
  const borrador = {
    ...borradorNuevo({ estado }),
    fecha: '2026-03-14',
    rubro: 'supermercado',
    monto: '12,50',
    ...campos,
  };
  const resultado = intentarGuardar(estado, borrador);
  assert.equal(resultado.error, undefined, `no se pudo cargar: ${resultado.error}`);
  return resultado.estado;
}

// ── La lista ─────────────────────────────────────────────────────────────────

test('adentro de un día, lo último cargado va PRIMERO', () => {
  // Pedido del usuario (2026-08-29). Los días ya iban del más nuevo al más
  // viejo, pero adentro de cada día quedaban en el orden en que se cargaron, así
  // que lo que acababas de anotar aparecía abajo de todo. Y esta pantalla se
  // abre casi siempre por lo mismo: arreglar el dedazo de hace dos minutos.
  let estado = cargar(estadoLimpio(), { fecha: '2026-03-14', monto: '10', detalle: 'primero' });
  estado = cargar(estado, { fecha: '2026-03-14', monto: '20', detalle: 'segundo' });
  estado = cargar(estado, { fecha: '2026-03-14', monto: '30', detalle: 'tercero' });

  const html = dibujarLista({ estado, mes: MES });
  const orden = ['primero', 'segundo', 'tercero'].map((d) => html.indexOf(d));

  assert.deepEqual([...orden].sort((a, b) => a - b), [orden[2], orden[1], orden[0]],
    'el último cargado tiene que estar más arriba');
});

test('el orden de los días no cambia: el más nuevo arriba', () => {
  // Lo que se invirtió es adentro del día, no los días entre sí.
  let estado = cargar(estadoLimpio(), { fecha: '2026-03-05', monto: '10' });
  estado = cargar(estado, { fecha: '2026-03-20', monto: '20' });

  const html = dibujarLista({ estado, mes: MES });
  assert.ok(html.indexOf('20 de marzo') < html.indexOf('5 de marzo'));
});

test('lo que ordena es la POSICIÓN en la lista, no `creado` ni el `id`', () => {
  // `creado` es una fecha sin hora, así que todo lo cargado el mismo día empata,
  // y el `id` es un número al azar. Lo único que sabe el orden de carga es dónde
  // quedó cada uno en la lista, que es donde se van agregando.
  const base = estadoLimpio();
  const igualitos = [
    { id: 'mov_zzz', fecha: '2026-03-14', creado: '2026-03-14', tipo: 'G', rubro: 'viajes',
      monto: 1000, moneda: 'EUR', comentario: '', detalle: 'cargado antes' },
    { id: 'mov_aaa', fecha: '2026-03-14', creado: '2026-03-14', tipo: 'G', rubro: 'viajes',
      monto: 2000, moneda: 'EUR', comentario: '', detalle: 'cargado después' },
  ];
  const html = dibujarLista({ estado: { ...base, movimientos: igualitos }, mes: MES });

  assert.ok(html.indexOf('cargado después') < html.indexOf('cargado antes'),
    'el id más chico va primero: no puede estar ordenando por id');
});

test('un día de carga posterior manda sobre la posición', () => {
  // Editar un movimiento viejo no lo mueve, pero cargar hoy un gasto con fecha
  // de anteayer sí lo pone arriba de los de anteayer: es lo último que hiciste.
  const base = estadoLimpio();
  const movimientos = [
    { id: 'mov_1', fecha: '2026-03-14', creado: '2026-08-29', tipo: 'G', rubro: 'viajes',
      monto: 1000, moneda: 'EUR', comentario: '', detalle: 'cargado hoy' },
    { id: 'mov_2', fecha: '2026-03-14', creado: '2026-03-14', tipo: 'G', rubro: 'viajes',
      monto: 2000, moneda: 'EUR', comentario: '', detalle: 'cargado en marzo' },
  ];
  const html = dibujarLista({ estado: { ...base, movimientos }, mes: MES });

  assert.ok(html.indexOf('cargado hoy') < html.indexOf('cargado en marzo'));
});

test('muestra los movimientos del mes, agrupados por día', () => {
  let estado = cargar(estadoLimpio(), { fecha: '2026-03-05', monto: '10' });
  estado = cargar(estado, { fecha: '2026-03-20', monto: '20', rubro: 'viajes' });
  const html = dibujarLista({ estado, mes: MES });

  assert.ok(html.includes('5 de marzo de 2026'));
  assert.ok(html.includes('20 de marzo de 2026'));
  assert.ok(html.includes('2 movimientos en marzo de 2026'));
});

test('el día más nuevo va arriba', () => {
  // Lo que se corrige casi siempre es lo último que se cargó: tenerlo arriba
  // evita desplazarse por un mes entero para arreglar un dedazo de hace dos
  // minutos.
  let estado = cargar(estadoLimpio(), { fecha: '2026-03-05' });
  estado = cargar(estado, { fecha: '2026-03-25' });
  const html = dibujarLista({ estado, mes: MES });

  assert.ok(html.indexOf('25 de marzo') < html.indexOf('5 de marzo'));
});

test('no muestra movimientos de otro mes', () => {
  let estado = cargar(estadoLimpio(), { fecha: '2026-03-05', rubro: 'salud' });
  estado = cargar(estado, { fecha: '2026-04-05', rubro: 'viajes' });
  const html = dibujarLista({ estado, mes: MES });

  assert.ok(html.includes('Salud'));
  assert.equal(html.includes('Viajes'), false);
  assert.ok(html.includes('1 movimiento en marzo'));
});

test('un mes vacío ofrece cargar algo en vez de una lista en blanco', () => {
  const html = dibujarLista({ estado: estadoLimpio(), mes: MES });
  assert.ok(html.includes('No hay movimientos en este mes'));
  assert.ok(html.includes('data-pantalla="nuevo"'));
});

test('un gasto en otra moneda muestra su importe original y el de euros', () => {
  // Ver solo los euros escondería lo que realmente se pagó; ver solo los colones
  // impediría compararlo con el resto.
  const estado = cargar(estadoLimpio(), { moneda: 'CRC', monto: '12500', rubro: 'viajes' });
  const html = dibujarLista({ estado, mes: MES });

  assert.ok(html.includes(`12.500,00${DURO}CRC`));
  assert.ok(html.includes(`19,84${DURO}€`));
});

test('un movimiento sin tipo de cambio lo dice, no se calla', () => {
  const estado = { ...cargar(estadoLimpio(), { moneda: 'CRC', monto: '12500', rubro: 'viajes' }), tipos_cambio: [] };
  const html = dibujarLista({ estado, mes: MES });

  assert.ok(html.includes('sin tipo de cambio'));
});

test('cada movimiento ofrece corregir y borrar', () => {
  const estado = cargar(estadoLimpio());
  const html = dibujarLista({ estado, mes: MES });

  assert.ok(html.includes('data-accion="editar"'));
  assert.ok(html.includes('data-accion="borrar"'));
});

test('el comentario del usuario no rompe la página', () => {
  const estado = cargar(estadoLimpio(), { comentario: '<b>Roma</b>' });
  const html = dibujarLista({ estado, mes: MES });

  assert.equal(html.includes('<b>Roma</b>'), false);
  assert.ok(html.includes('&lt;b&gt;Roma&lt;/b&gt;'));
});

// ── Borrar: la red de contención ─────────────────────────────────────────────

test('el primer toque no borra: pregunta', () => {
  // En un celular, el borrar y el corregir quedan a milímetros.
  const estado = cargar(estadoLimpio());
  const id = estado.movimientos[0].id;
  const html = dibujarLista({ estado, mes: MES, borrando: id });

  assert.ok(html.includes('¿Borrar este movimiento?'));
  assert.ok(html.includes('data-accion="borrar-si"'));
  assert.ok(html.includes('data-accion="borrar-no"'));
  // Y sigue existiendo: preguntar no es borrar.
  assert.equal(estado.movimientos.length, 1);
});

test('la confirmación aparece SOLO en el movimiento que se está por borrar', () => {
  let estado = cargar(estadoLimpio(), { rubro: 'salud' });
  estado = cargar(estado, { rubro: 'viajes' });
  const html = dibujarLista({ estado, mes: MES, borrando: estado.movimientos[0].id });

  assert.equal((html.match(/¿Borrar este movimiento\?/g) ?? []).length, 1);
});

test('borrar saca el movimiento y devuelve con qué reponerlo', () => {
  const estado = cargar(estadoLimpio());
  const id = estado.movimientos[0].id;
  const resultado = borrarMovimiento(estado, id);

  assert.equal(resultado.estado.movimientos.length, 0);
  assert.equal(resultado.borrado.movimiento.id, id);
  assert.equal(resultado.borrado.posicion, 0);
  // Y no modifica el estado que recibe.
  assert.equal(estado.movimientos.length, 1);
});

test('borrar un movimiento que no existe no rompe nada', () => {
  const estado = cargar(estadoLimpio());
  const resultado = borrarMovimiento(estado, 'mov_inventado');

  assert.equal(resultado.borrado, null);
  assert.equal(resultado.estado.movimientos.length, 1);
});

// ── Deshacer: la red que atrapa al que ya dijo que sí ────────────────────────

test('deshacer devuelve el movimiento a su lugar EXACTO', () => {
  // Restaurarlo al final lo dejaría en otro lugar del que estaba, y quien
  // deshace un borrado espera encontrar todo como lo tenía.
  let estado = estadoLimpio();
  for (const rubro of ['salud', 'viajes', 'transporte']) estado = cargar(estado, { rubro });
  const ordenOriginal = estado.movimientos.map((m) => m.id);

  const { estado: sinElDelMedio, borrado } = borrarMovimiento(estado, ordenOriginal[1]);
  assert.deepEqual(sinElDelMedio.movimientos.map((m) => m.id), [ordenOriginal[0], ordenOriginal[2]]);

  const restaurado = restaurarMovimiento(sinElDelMedio, borrado);
  assert.deepEqual(restaurado.movimientos.map((m) => m.id), ordenOriginal);
});

test('el movimiento restaurado es idéntico al que se borró', () => {
  const estado = cargar(estadoLimpio(), { comentario: 'Roma', detalle: 'cena' });
  const original = estado.movimientos[0];

  const { estado: sinEl, borrado } = borrarMovimiento(estado, original.id);
  const restaurado = restaurarMovimiento(sinEl, borrado);

  assert.deepEqual(restaurado.movimientos[0], original);
});

test('el aviso de deshacer dice qué se borró', () => {
  const estado = cargar(estadoLimpio(), { rubro: 'gastos fijos', fecha: '2026-03-14' });
  const { borrado } = borrarMovimiento(estado, estado.movimientos[0].id);
  const html = dibujarDeshacer({ borrado });

  assert.ok(html.includes('Gastos fijos'));
  assert.ok(html.includes('14/03/2026'));
  assert.ok(html.includes('data-accion="deshacer"'));
  assert.ok(html.includes('role="status"'));
});

test('sin nada borrado no se dibuja el aviso de deshacer', () => {
  assert.equal(dibujarDeshacer({}), '');
  assert.equal(dibujarDeshacer({ borrado: null }), '');
});

test('restaurar sin nada que restaurar no cambia el estado', () => {
  const estado = cargar(estadoLimpio());
  assert.equal(restaurarMovimiento(estado, null), estado);
});

// ── Corregir: sigue siendo el mismo movimiento ───────────────────────────────

test('corregir cambia los datos y NO crea un movimiento nuevo', () => {
  const estado = cargar(estadoLimpio(), { monto: '12,50' });
  const original = estado.movimientos[0];

  const resultado = intentarGuardar(estado, { ...borradorDesde(original, 2), monto: '15,00' });

  assert.equal(resultado.error, undefined);
  assert.equal(resultado.estado.movimientos.length, 1, 'no se duplicó');
  assert.equal(resultado.estado.movimientos[0].monto, 1500);
  assert.equal(resultado.corrigiendo, true);
});

test('al corregir se conservan el identificador y el día de carga', () => {
  // Cambiarle el id rompería cualquier cosa que lo señale; cambiarle la fecha de
  // carga borraría cuándo entró de verdad.
  const estado = cargar(estadoLimpio());
  const original = estado.movimientos[0];

  const { estado: despues } = intentarGuardar(estado, { ...borradorDesde(original, 2), monto: '99,00' });

  assert.equal(despues.movimientos[0].id, original.id);
  assert.equal(despues.movimientos[0].creado, original.creado);
});

test('corregir deja el movimiento en su lugar de la lista', () => {
  let estado = estadoLimpio();
  for (const rubro of ['salud', 'viajes', 'transporte']) estado = cargar(estado, { rubro });
  const orden = estado.movimientos.map((m) => m.id);

  const { estado: despues } = intentarGuardar(estado, {
    ...borradorDesde(estado.movimientos[1], 2),
    monto: '77,00',
  });

  assert.deepEqual(despues.movimientos.map((m) => m.id), orden);
  assert.equal(despues.movimientos[1].monto, 7700);
});

test('el borrador de una corrección trae el monto como se escribe en español', () => {
  // Si volviera "12.5", el usuario vería su gasto escrito de una forma en la que
  // él nunca lo escribiría.
  const estado = cargar(estadoLimpio(), { monto: '12,50' });
  const borrador = borradorDesde(estado.movimientos[0], 2);

  assert.equal(borrador.monto, '12,50');
  assert.equal(borrador.id, estado.movimientos[0].id);
  assert.equal(borrador.rubro, 'supermercado');
});

test('corregir con un dato inválido no rompe ni pisa el movimiento', () => {
  const estado = cargar(estadoLimpio(), { monto: '12,50' });
  const original = estado.movimientos[0];

  const resultado = intentarGuardar(estado, { ...borradorDesde(original, 2), monto: '0' });

  assert.ok(resultado.error);
  assert.deepEqual(resultado.estado.movimientos[0], original, 'el original quedó intacto');
});

test('corregir un ingreso sigue siendo un ingreso', () => {
  const estado = cargar(estadoLimpio(), { tipo: TIPO_INGRESO, rubro: 'trabajo', monto: '2100' });
  const { estado: despues } = intentarGuardar(estado, {
    ...borradorDesde(estado.movimientos[0], 2),
    monto: '2200',
  });

  assert.equal(despues.movimientos[0].tipo, 'I');
  assert.equal(despues.movimientos[0].monto, 220000);
});

test('buscarMovimiento encuentra por identificador, o devuelve null', () => {
  const estado = cargar(estadoLimpio());
  assert.equal(buscarMovimiento(estado, estado.movimientos[0].id).id, estado.movimientos[0].id);
  assert.equal(buscarMovimiento(estado, 'mov_inventado'), null);
});
