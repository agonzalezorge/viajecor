// T-071 — Tests de las pestañas que se prenden y se apagan (CU-21).
//
// ── Lo que hay que sostener acá ─────────────────────────────────────────────
//
// Una sola cosa, y es la que puede asustar a alguien de verdad: **apagar no
// borra**. Todo lo demás —que la barra muestre lo que corresponde, que no se
// pueda apagar la vida cotidiana— existe para que esa promesa se pueda cumplir.
//
// La segunda es más sutil: lo que se guarda son las decisiones del usuario, no
// el estado resultante. Una clave ausente quiere decir "nunca lo tocó", que no
// es lo mismo que "lo apagó" ni que "lo prendió".

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PERFILES, PERFIL_COTIDIANA, PERFIL_AHORROS, PERFIL_MIS_AHORROS,
  perfilDeClave, perfilPrendido, perfilesPrendidos, prenderPerfil,
} from '../src/core/perfiles.js';
import { estadoInicial, migrarEstado } from '../src/datos/almacenamiento.js';
import { monedasIniciales } from '../src/core/monedas.js';
import { dibujarPerfiles, dibujarApp, irA, irAlPerfil } from '../src/ui/app.js';
import { dibujarPestanias } from '../src/ui/pantallas/ajustes.js';
import { crearAhorro, AHORRO_ENTRA } from '../src/core/ahorros.js';

const vacio = () => estadoInicial({ monedas: monedasIniciales() });

const conAhorros = (cuantos) => {
  const estado = vacio();
  for (let i = 0; i < cuantos; i += 1) {
    estado.ahorros.push(crearAhorro({
      fecha: `2026-05-${String(i + 1).padStart(2, '0')}`, tipo: AHORRO_ENTRA, persona: 'ALE',
      monto: 100, moneda: 'EUR', comentario: '', detalle: '',
    }, { decimales: 2 }));
  }
  return estado;
};


// ── Qué está prendido ───────────────────────────────────────────────────────

test('de fábrica, la vida cotidiana y los ahorros conjuntos', () => {
  const estado = vacio();

  assert.equal(perfilPrendido(estado, PERFIL_COTIDIANA), true);
  assert.equal(perfilPrendido(estado, PERFIL_AHORROS), true);
});

test('un perfil que no existe no está prendido', () => {
  assert.equal(perfilPrendido(vacio(), 'inventado'), false);
  assert.equal(perfilDeClave('inventado'), null);
});

test('la vida cotidiana no se puede apagar', () => {
  // Es la app. Apagarla dejaría la pantalla vacía y sin ningún lugar desde
  // donde volver a prenderla.
  const estado = prenderPerfil(vacio(), PERFIL_COTIDIANA, false);

  assert.equal(perfilPrendido(estado, PERFIL_COTIDIANA), true);
});

test('ni siquiera un respaldo editado a mano puede apagar la vida cotidiana', () => {
  // Las dos guardas —la de leer y la de escribir— parecen la misma y no lo son.
  // Lo mostró una mutación: cada una sola hacía pasar todos los tests. Esta es
  // la que importa de verdad, porque el archivo de respaldo lo escribe
  // cualquiera: sin ella, un `{ cotidiana: false }` deja la app sin ninguna
  // pestaña y sin ningún lugar desde donde arreglarlo.
  const estado = migrarEstado({ preferencias: { perfiles: { [PERFIL_COTIDIANA]: false } } });

  assert.equal(perfilPrendido(estado, PERFIL_COTIDIANA), true);
  assert.ok(perfilesPrendidos(estado).length >= 1, 'la app nunca se queda sin perfiles');
});

test('y tampoco se escribe esa decisión, aunque alguien apriete el botón que no existe', () => {
  // La otra mitad de la mutación: `prenderPerfil` tampoco la deja pasar.
  const estado = prenderPerfil(vacio(), PERFIL_COTIDIANA, false);

  assert.equal(estado.preferencias?.perfiles?.[PERFIL_COTIDIANA], undefined);
});

test('PRENDER un perfil no te saca del que estabas mirando', () => {
  // Otra mutación: volver a la cotidiana es lo correcto al APAGAR el perfil en
  // curso, y un error al prender otro. Quien está en los ahorros y prende una
  // pestaña desde Ajustes no pidió que lo mudaran.
  const estado = { ...vacio(), preferencias: { perfil: PERFIL_AHORROS } };

  assert.equal(prenderPerfil(estado, PERFIL_AHORROS, true).preferencias.perfil, PERFIL_AHORROS);
});

test('apagar los ahorros los saca de la lista, y prenderlos los devuelve', () => {
  const apagado = prenderPerfil(vacio(), PERFIL_AHORROS, false);
  assert.deepEqual(perfilesPrendidos(apagado).map((p) => p.clave), [PERFIL_COTIDIANA]);

  const prendido = prenderPerfil(apagado, PERFIL_AHORROS, true);
  assert.deepEqual(perfilesPrendidos(prendido).map((p) => p.clave), [PERFIL_COTIDIANA, PERFIL_AHORROS]);
});

test('apagar NO borra los movimientos de ahorro', () => {
  // Es la promesa de la pantalla. Si alguna vez falla, falla acá.
  const estado = prenderPerfil(conAhorros(3), PERFIL_AHORROS, false);

  assert.equal(estado.ahorros.length, 3);
  assert.equal(prenderPerfil(estado, PERFIL_AHORROS, true).ahorros.length, 3);
});

test('apagar el perfil en el que estabas te devuelve a la vida cotidiana', () => {
  // Si no, la próxima visita abre en un perfil que ya no está en la barra y la
  // app cae a otra pantalla sin decir por qué: el silencio de L-038.
  const estado = { ...vacio(), preferencias: { perfil: PERFIL_AHORROS } };

  assert.equal(prenderPerfil(estado, PERFIL_AHORROS, false).preferencias.perfil, PERFIL_COTIDIANA);
});

test('apagar OTRO perfil no te mueve de donde estabas', () => {
  const estado = { ...vacio(), preferencias: { perfil: PERFIL_COTIDIANA } };

  assert.equal(prenderPerfil(estado, PERFIL_AHORROS, false).preferencias.perfil, PERFIL_COTIDIANA);
});

test('se guarda la decisión, no el estado: lo que no se tocó no se escribe', () => {
  // El día que un perfil cambie de valor de fábrica, un respaldo viejo con los
  // tres valores escritos traería el valor viejo y lo pisaría, sin que nadie lo
  // haya decidido nunca.
  const estado = prenderPerfil(vacio(), PERFIL_AHORROS, false);

  assert.deepEqual(estado.preferencias.perfiles, { [PERFIL_AHORROS]: false });
});


test('prender una pestaña no pisa la decisión que tomaste sobre la otra', () => {
  // Lo encontró una mutación, que con un solo perfil apagable no se podía
  // distinguir: guardar `{ [clave]: valor }` en vez de agregarlo al objeto
  // borraba la otra decisión, y la pestaña apagada volvía a aparecer sola.
  let estado = prenderPerfil(vacio(), PERFIL_AHORROS, false);
  estado = prenderPerfil(estado, PERFIL_MIS_AHORROS, true);

  assert.equal(perfilPrendido(estado, PERFIL_AHORROS), false, 'los ahorros conjuntos se volvieron a prender solos');
  assert.equal(perfilPrendido(estado, PERFIL_MIS_AHORROS), true);
});

test('"Mis ahorros" viene apagada de fábrica y se prende en Ajustes', () => {
  // Lo eligió el usuario (2026-09-22): quien abre la app por primera vez ve lo
  // mismo que antes y no se encuentra con una pestaña vacía que no pidió.
  const estado = vacio();
  assert.equal(perfilPrendido(estado, PERFIL_MIS_AHORROS), false);

  assert.equal(perfilPrendido(prenderPerfil(estado, PERFIL_MIS_AHORROS, true), PERFIL_MIS_AHORROS), true);
});

test('con las tres prendidas, el selector las muestra a las tres', () => {
  const estado = prenderPerfil(vacio(), PERFIL_MIS_AHORROS, true);
  const html = dibujarPerfiles(PERFIL_COTIDIANA, estado);

  assert.match(html, /Vida cotidiana/);
  assert.match(html, /Ahorros conjuntos/);
  assert.match(html, /Mis ahorros/);
});


// ── El respaldo se lo lleva ─────────────────────────────────────────────────

test('el respaldo se lleva qué pestañas querías', () => {
  const guardado = { preferencias: { perfiles: { [PERFIL_AHORROS]: false } } };

  assert.equal(perfilPrendido(migrarEstado(guardado), PERFIL_AHORROS), false);
});

test('un respaldo sin esa clave deja los valores de fábrica', () => {
  // Es el caso de todos los respaldos anteriores a T-071.
  assert.equal(perfilPrendido(migrarEstado({ preferencias: {} }), PERFIL_AHORROS), true);
});

test('un respaldo editado a mano no puede prender cosas que no existen', () => {
  const guardado = { preferencias: { perfiles: { inventado: true, [PERFIL_AHORROS]: 'sí' } } };
  const estado = migrarEstado(guardado);

  assert.equal(estado.preferencias.perfiles, undefined, 'no se guardó ninguna clave válida');
  assert.equal(perfilPrendido(estado, 'inventado'), false);
  assert.equal(perfilPrendido(estado, PERFIL_AHORROS), true, 'un "sí" que no es booleano no apaga nada');
});


// ── Lo que se ve ────────────────────────────────────────────────────────────

test('el selector de arriba muestra solo los prendidos', () => {
  const html = dibujarPerfiles(PERFIL_COTIDIANA, vacio());

  assert.match(html, /Vida cotidiana/);
  assert.match(html, /Ahorros conjuntos/);
});

test('y con un solo perfil prendido no se dibuja nada', () => {
  // Un selector con un botón único no elige nada y ocupa el lugar del
  // contenido. Quien apagó los ahorros quiere la app de antes de que existieran.
  const estado = prenderPerfil(vacio(), PERFIL_AHORROS, false);

  assert.equal(dibujarPerfiles(PERFIL_COTIDIANA, estado), '');
});

test('con el perfil apagado, la app se dibuja igual y aterriza en la cotidiana', () => {
  // Pasa al abrir con el perfil de la visita anterior guardado, después de
  // haberlo apagado. Antes de T-071 esto era una pantalla en blanco.
  const estado = prenderPerfil(conAhorros(1), PERFIL_AHORROS, false);
  const html = dibujarApp({ pantalla: 'ahorros', perfil: PERFIL_AHORROS, mes: '2026-05', estado, incidencias: [] });

  assert.doesNotMatch(html, /<h2>Ahorros conjuntos<\/h2>/);
  assert.match(html, /data-pantalla="mes"/, 'la barra es la de la vida cotidiana');
});

test('no se puede entrar a un perfil apagado, ni por enlace ni por el selector', () => {
  const estado = prenderPerfil(vacio(), PERFIL_AHORROS, false);
  const vista = { pantalla: 'mes', perfil: PERFIL_COTIDIANA, estado };

  assert.equal(irA(vista, 'ahorros'), vista);
  assert.equal(irAlPerfil(vista, PERFIL_AHORROS), vista);
});


// ── La pantalla de Ajustes ──────────────────────────────────────────────────

test('Ajustes dice cuántos movimientos esconde apagar, y que no se borran', () => {
  // El número es la diferencia entre un ajuste y un susto.
  const html = dibujarPestanias(conAhorros(11));

  assert.match(html, /esconde 11 movimientos/);
  assert.match(html, /No se borran/);
});

test('con un solo movimiento lo dice en singular', () => {
  assert.match(dibujarPestanias(conAhorros(1)), /esconde 1 movimiento\b/);
});

test('sin movimientos no promete nada sobre movimientos que no hay', () => {
  const html = dibujarPestanias(vacio());

  assert.doesNotMatch(html, /esconde/);
  assert.match(html, /Apagar\s*<\/button>/, 'pero el botón está igual');
});

test('ya apagada, dice que los movimientos siguen ahí esperando', () => {
  const html = dibujarPestanias(prenderPerfil(conAhorros(4), PERFIL_AHORROS, false));

  assert.match(html, /4 movimientos guardados/);
  assert.match(html, /Prender\s*<\/button>/);
});

test('la vida cotidiana aparece sin botón: dice "Siempre"', () => {
  const html = dibujarPestanias(vacio());

  assert.match(html, /Vida cotidiana[\s\S]*?Siempre/);
  assert.doesNotMatch(html, /data-perfil="cotidiana"/);
});

test('todos los perfiles que existen salen en la pantalla', () => {
  // Para que agregar uno nuevo no se olvide de esta lista.
  const html = dibujarPestanias(vacio());

  for (const perfil of PERFILES) assert.match(html, new RegExp(perfil.etiqueta));
});
