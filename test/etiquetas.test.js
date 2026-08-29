// T-025 — Tests de ver, renombrar y borrar las etiquetas ya escritas (CU-16).
//
// Lo que esta pantalla puede hacer mal no es no funcionar: es **cambiar plata de
// grupo sin avisar** (renombrar une dos totales) y **hacer creer que borra
// movimientos** cuando solo saca una etiqueta. Los dos son irreversibles para el
// usuario, uno de verdad y el otro en su cabeza.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  etiquetasUsadas, movimientosCon, efectoDeRenombrar, renombrarEtiqueta,
  borrarEtiqueta, CAMPOS,
} from '../src/core/etiquetas.js';

import {
  dibujarEtiquetas, dibujarEtiqueta, dibujarRenombrar, dibujarBorrarEtiqueta,
  dibujarAvisoRenombrar, enCuantos, intentarRenombrar, intentarBorrarEtiqueta,
} from '../src/ui/pantallas/etiquetas.js';

import { crearMovimiento, TIPO_GASTO } from '../src/core/modelo.js';
import { estadoInicial } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { porComentario } from '../src/core/calculos.js';

let contador = 0;
function mov({ monto = '10', comentario = '', detalle = '', rubro = 'viajes', fecha = '2026-03-14' }) {
  contador += 1;
  const m = crearMovimiento(
    { monto, rubro, fecha, tipo: TIPO_GASTO, moneda: 'EUR', comentario },
    { decimales: 2, id: `mov_${String(contador).padStart(16, '0')}`, creado: fecha }
  );
  return { ...m, detalle };
}

const estadoCon = (movimientos) =>
  ({ ...estadoInicial({ monedas: monedasIniciales() }), movimientos, tipos_cambio: [] });

// El caso real: un viaje escrito de dos formas, que son dos totales distintos.
const PARTIDO = () => [
  mov({ monto: '100', comentario: 'Barcelona26' }),
  mov({ monto: '50', comentario: 'barcelona 26' }),
  mov({ monto: '30', comentario: 'Roma' }),
  mov({ monto: '20' }),
];


// ── Lo que hay ───────────────────────────────────────────────────────────────

test('lista las etiquetas con cuántos movimientos usa cada una', () => {
  const etiquetas = etiquetasUsadas(PARTIDO(), 'comentario');

  // Los tres tienen un movimiento, así que el orden entre ellos lo decide el
  // texto y no vale la pena fijarlo acá: lo que importa es que estén los tres y
  // que el movimiento sin comentario no invente una fila.
  assert.deepEqual(
    etiquetas.map((e) => [e.texto, e.cuantos]).sort(),
    [['Barcelona26', 1], ['Roma', 1], ['barcelona 26', 1]].sort(),
  );
  assert.equal(etiquetas.length, 3);
});

test('las que solo difieren en mayúsculas o espacios son UNA, y dice cuántas formas', () => {
  // Es el dato que delata el typo. Sin él, `Luz` y `luz` se ven como dos filas
  // cualesquiera y nadie va a ir a arreglarlas.
  const etiquetas = etiquetasUsadas([
    mov({ comentario: 'Luz' }), mov({ comentario: 'luz' }), mov({ comentario: ' LUZ ' }),
  ], 'comentario');

  assert.equal(etiquetas.length, 1);
  assert.equal(etiquetas[0].cuantos, 3);
  assert.equal(etiquetas[0].escrituras, 3);
  assert.equal(etiquetas[0].texto, 'Luz', 'se muestra la primera escritura que apareció');
});

test('los movimientos sin etiqueta no inventan una vacía', () => {
  assert.deepEqual(etiquetasUsadas([mov({}), mov({ comentario: '   ' })], 'comentario'), []);
});

test('van de más usada a menos', () => {
  const etiquetas = etiquetasUsadas([
    mov({ comentario: 'Roma' }), mov({ comentario: 'Luz' }), mov({ comentario: 'Luz' }),
  ], 'comentario');

  assert.deepEqual(etiquetas.map((e) => e.texto), ['Luz', 'Roma']);
});

test('el detalle se lista igual que el comentario', () => {
  const etiquetas = etiquetasUsadas([mov({ detalle: 'cena' }), mov({ detalle: 'cena' })], 'detalle');
  assert.deepEqual(etiquetas.map((e) => [e.texto, e.cuantos]), [['cena', 2]]);
});

test('no se puede limpiar un campo que no es de texto libre', () => {
  // Sin esto, `etiquetasUsadas(movs, 'monto')` devolvería una lista de importes
  // y `borrarEtiqueta` dejaría movimientos sin plata.
  for (const campo of ['monto', 'rubro', 'fecha', 'tipo', 'id']) {
    assert.throws(() => etiquetasUsadas(PARTIDO(), campo), /solo comentario y detalle/);
    assert.throws(() => borrarEtiqueta(PARTIDO(), campo, 'x'), /solo comentario y detalle/);
    assert.throws(() => renombrarEtiqueta(PARTIDO(), campo, 'x', 'y'), /solo comentario y detalle/);
  }
  assert.deepEqual([...CAMPOS], ['comentario', 'detalle']);
});

test('sin tope de filas (L-001)', () => {
  const movimientos = Array.from({ length: 1500 }, () => mov({ comentario: 'Roma' }));
  assert.equal(etiquetasUsadas(movimientos, 'comentario')[0].cuantos, 1500);
});


// ── Renombrar: lo que UNE dos totales ────────────────────────────────────────

test('renombrar reescribe el texto en todos sus movimientos', () => {
  const nuevos = renombrarEtiqueta(PARTIDO(), 'comentario', 'roma', 'Roma 2026');

  assert.equal(movimientosCon(nuevos, 'comentario', 'roma').length, 0);
  assert.equal(movimientosCon(nuevos, 'comentario', 'Roma 2026').length, 1);
});

test('renombrar con el nombre de otra etiqueta LAS UNE, y se avisa antes', () => {
  // Es la razón de ser de la pantalla, y también lo que puede sorprender: dos
  // totales pasan a ser uno.
  const efecto = efectoDeRenombrar(PARTIDO(), 'comentario', 'barcelona 26', 'Barcelona26');

  assert.equal(efecto.afectados, 1);
  assert.deepEqual(efecto.seUneCon, { texto: 'Barcelona26', cuantos: 1 });
  assert.equal(efecto.quedan, 2);

  const html = dibujarAvisoRenombrar(efecto);
  assert.ok(html.includes('Se van a unir'));
  assert.ok(html.includes('Barcelona26'));
});

test('y al unirlas, el total del viaje deja de estar partido', () => {
  // La comprobación que importa: no que el texto cambie, sino que el NÚMERO
  // quede bien. 100 + 50 estaban en dos grupos y pasan a estar en uno.
  const antes = porComentario(estadoCon(PARTIDO()));
  assert.equal(antes.find((c) => c.clave === 'barcelona26').total, 10000);
  assert.equal(antes.find((c) => c.clave === 'barcelona 26').total, 5000);

  const nuevos = renombrarEtiqueta(PARTIDO(), 'comentario', 'barcelona 26', 'Barcelona26');
  const despues = porComentario(estadoCon(nuevos));

  assert.equal(despues.find((c) => c.clave === 'barcelona26').total, 15000);
  assert.equal(despues.find((c) => c.clave === 'barcelona 26'), undefined);
});

test('cambiar solo mayúsculas no une nada, y el aviso no lo dice', () => {
  // `Roma` → `ROMA` es la misma clave: no hay dos grupos que juntar.
  const efecto = efectoDeRenombrar(PARTIDO(), 'comentario', 'roma', 'ROMA');

  assert.equal(efecto.seUneCon, null);
  assert.ok(dibujarAvisoRenombrar(efecto).includes('Se reescribe en 1 movimiento'));
  assert.equal(dibujarAvisoRenombrar(efecto).includes('unir'), false);
});

test('el texto nuevo se guarda normalizado, como si se hubiera cargado a mano', () => {
  // Si acá se guardara crudo, esta pantalla sería la única forma de meter en los
  // datos un texto con dos espacios o sin normalizar en NFC — que es justo lo
  // que esa normalización existe para impedir (L-003).
  const nuevos = renombrarEtiqueta(PARTIDO(), 'comentario', 'roma', '  Roma   vieja  ');

  assert.equal(movimientosCon(nuevos, 'comentario', 'roma vieja')[0].comentario, 'Roma vieja');
});

test('renombrar a vacío se rechaza y manda a borrar', () => {
  // Dejarlo pasar haría que "renombrar" borrara la etiqueta sin la confirmación
  // que borrar sí tiene.
  assert.throws(() => renombrarEtiqueta(PARTIDO(), 'comentario', 'roma', '   '), /usá borrar/);
  assert.equal(intentarRenombrar(estadoCon(PARTIDO()), 'comentario', 'roma', '').estado, undefined);
});

test('renombrar no toca los movimientos que no tienen esa etiqueta', () => {
  const originales = PARTIDO();
  const nuevos = renombrarEtiqueta(originales, 'comentario', 'roma', 'Roma 2026');

  assert.equal(nuevos.length, originales.length);
  assert.equal(nuevos.filter((m) => m.comentario === '').length, 1);
  assert.equal(originales[2].comentario, 'Roma', 'la lista original no se modificó');
});


// ── Borrar: lo que NO borra ──────────────────────────────────────────────────

test('borrar la etiqueta deja los movimientos, sin ese campo', () => {
  const nuevos = borrarEtiqueta(PARTIDO(), 'comentario', 'roma');

  assert.equal(nuevos.length, 4, 'no se puede haber ido ningún movimiento');
  assert.equal(movimientosCon(nuevos, 'comentario', 'roma').length, 0);
  assert.equal(nuevos.find((m) => m.monto === 3000).monto, 3000, 'el importe sigue ahí');
});

test('LA PANTALLA DICE QUE LOS MOVIMIENTOS NO SE BORRAN', () => {
  // "Borrar Luz" y "borrar los gastos de luz" se confunden con una lectura
  // rápida, y una de las dos no se puede deshacer.
  const vista = { estado: estadoCon(PARTIDO()), etiquetaBorrando: { campo: 'comentario', clave: 'roma' } };
  const html = dibujarBorrarEtiqueta(vista);

  assert.ok(html.includes('Los movimientos no se borran'));
  assert.ok(html.includes('1 movimiento'));
  assert.ok(html.includes('confirmar-borrar-etiqueta'));
  assert.ok(html.includes('cancelar-borrar-etiqueta'), 'sin salida no es una confirmación');
});

test('borrar un comentario avisa que sale de los totales agrupados', () => {
  const html = dibujarBorrarEtiqueta({
    estado: estadoCon(PARTIDO()), etiquetaBorrando: { campo: 'comentario', clave: 'roma' },
  });
  assert.ok(html.includes('dejar de contarse'));
});

test('borrar un detalle no promete que cambie ningún total, porque no cambia', () => {
  const html = dibujarBorrarEtiqueta({
    estado: estadoCon([mov({ detalle: 'cena' })]),
    etiquetaBorrando: { campo: 'detalle', clave: 'cena' },
  });

  assert.ok(html.includes('Los movimientos no se borran'));
  assert.equal(html.includes('dejar de contarse'), false);
});

test('un toque no borra: primero pregunta', () => {
  const html = dibujarEtiquetas({ estado: estadoCon(PARTIDO()) });

  assert.ok(html.includes('data-accion="borrar-etiqueta"'));
  assert.equal(html.includes('confirmar-borrar-etiqueta'), false);
});


// ── La pantalla ──────────────────────────────────────────────────────────────

test('están las dos secciones, y cada una dice para qué sirve', () => {
  const html = dibujarEtiquetas({ estado: estadoCon([mov({ comentario: 'Roma', detalle: 'cena' })]) });

  // Se llamaba "Comentarios" hasta el 2026-08-28. Lo renombró el usuario:
  // "Etiqueta (agrupar por)" dice para qué sirve, y "comentario" sonaba a nota
  // suelta cuando es de lo que dependen los totales por viaje y por gasto fijo.
  assert.ok(html.includes('Etiquetas'));
  assert.ok(html.includes('Detalles'));
  assert.ok(html.includes('agrupa'), 'no explica por qué la etiqueta importa');
  assert.ok(html.includes('no agrupa nada'), 'no aclara que el detalle es solo una nota');
});

test('la fila avisa cuando una etiqueta tiene varias escrituras', () => {
  const html = dibujarEtiqueta('comentario', { texto: 'Luz', clave: 'luz', cuantos: 3, escrituras: 2 });
  assert.ok(html.includes('2 formas de escribirlo'));

  const limpia = dibujarEtiqueta('comentario', { texto: 'Gas', clave: 'gas', cuantos: 3, escrituras: 1 });
  assert.equal(limpia.includes('formas de escribirlo'), false);
});

test('solo el comentario ofrece "Ver": el detalle no filtra nada', () => {
  // Y el del detalle no se dibuja escondido: no se dibuja. Un botón con `hidden`
  // sigue estando en la página, sale en el texto y hay que acordarse de él.
  const conVer = dibujarEtiqueta('comentario', { texto: 'Roma', clave: 'roma', cuantos: 1, escrituras: 1 });
  const sinVer = dibujarEtiqueta('detalle', { texto: 'cena', clave: 'cena', cuantos: 1, escrituras: 1 });

  assert.ok(conVer.includes('data-accion="ver-comentario"'));
  assert.equal(sinVer.includes('ver-comentario'), false);
  assert.equal(sinVer.includes('hidden'), false);
  // Renombrar y borrar sí están en los dos.
  assert.ok(sinVer.includes('renombrar-etiqueta') && sinVer.includes('borrar-etiqueta'));
});

test('renombrar y borrar no se muestran juntos ni con la lista', () => {
  // Dos cosas delicadas a la vez son dos decisiones simultáneas.
  const estado = estadoCon(PARTIDO());
  const renombrando = dibujarEtiquetas({ estado, etiquetaEditada: { campo: 'comentario', clave: 'roma' } });
  const borrando = dibujarEtiquetas({ estado, etiquetaBorrando: { campo: 'comentario', clave: 'roma' } });

  assert.ok(renombrando.includes('data-formulario="etiqueta"'));
  assert.equal(renombrando.includes('data-accion="borrar-etiqueta"'), false);
  assert.ok(borrando.includes('confirmar-borrar-etiqueta'));
  assert.equal(borrando.includes('data-formulario="etiqueta"'), false);
});

test('el formulario de renombrar trae el aviso ya dibujado', () => {
  const html = dibujarRenombrar({
    estado: estadoCon(PARTIDO()),
    etiquetaEditada: { campo: 'comentario', clave: 'barcelona 26' },
    borradorEtiqueta: 'Barcelona26',
  });

  assert.ok(html.includes('Se van a unir'));
  assert.ok(html.includes('value="Barcelona26"'));
});

test('sin etiquetas la pantalla lo dice en vez de mostrar listas vacías', () => {
  const html = dibujarEtiquetas({ estado: estadoCon([mov({})]) });
  assert.equal((html.match(/Todavía no escribiste ninguno/g) ?? []).length, 2);
});

test('un texto con HTML adentro no rompe la página', () => {
  const html = dibujarEtiquetas({ estado: estadoCon([mov({ comentario: '<script>x' })]) });

  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('la pantalla no pide nada a internet', () => {
  assert.equal(/https?:\/\//.test(dibujarEtiquetas({ estado: estadoCon(PARTIDO()) })), false);
});

test('enCuantos habla en singular y en plural', () => {
  assert.equal(enCuantos(1), '1 movimiento');
  assert.equal(enCuantos(3), '3 movimientos');
});

test('intentarBorrarEtiqueta devuelve un estado nuevo, sin tocar el viejo', () => {
  const estado = estadoCon(PARTIDO());
  const { estado: nuevo } = intentarBorrarEtiqueta(estado, 'comentario', 'roma');

  assert.equal(estado.movimientos[2].comentario, 'Roma');
  assert.equal(nuevo.movimientos[2].comentario, '');
});
