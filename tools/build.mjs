// Arma dist/viajecor.html: un archivo autocontenido que se abre desde el disco,
// sin conexión y sin servidor.
//
// Por qué existe este paso: el navegador bloquea los módulos de JavaScript
// cuando la página se abre desde file://. Para tener código partido en archivos
// (testeable, y trabajable por varios agentes a la vez) y a la vez un entregable
// de un solo archivo, hay que pegarlo todo al construir. Ver ADR-002.
//
// Uso:  node tools/build.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarFugas, buscarFugasDelServicio } from './privacidad.mjs';
import { buscarErrorDeSintaxis } from './sintaxis.mjs';
import { iconoComoDataUri, pngDelIcono } from './icono.mjs';
import { manifiesto } from './manifiesto.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Orden de concatenación: cada archivo puede usar lo que definieron los
// anteriores. core/ primero (no depende de nada), después datos/, después ui/.
// Al agregar un módulo nuevo, agregarlo acá en la posición que le corresponde.
const MODULOS = [
  'src/core/dinero.js',
  'src/core/modelo.js',
  'src/core/monedas.js',
  'src/core/cambio.js',
  'src/core/agrupamientos.js',

  'src/core/busqueda.js',
  'src/core/base.js',
  'src/core/rubros.js',
  'src/core/ahorros.js',
  'src/core/calculos.js',
  'src/core/formato.js',
  'src/core/paleta.js',
  'src/datos/almacenamiento.js',
  'src/datos/exportar.js',
  'src/datos/importar.js',
  'src/datos/recordatorio.js',
  'src/datos/instalacion.js',
  'src/datos/zip.js',
  'src/datos/xlsx.js',
  'src/datos/csv.js',
  'src/datos/xml.js',
  'src/datos/planilla.js',
  'src/datos/importar-ahorros.js',
  'src/datos/importar-planilla.js',
  'src/ui/colores.js',
  'src/ui/compartir.js',
  'src/ui/pantallas/cambio.js',
  'src/ui/pantallas/series.js',
  'src/ui/pantallas/graficos.js',
  'src/ui/pantallas/resumen.js',
  'src/core/etiquetas.js',
  'src/core/viajes.js',
  'src/ui/pantallas/etiquetas.js',
  'src/ui/pantallas/viajes.js',
  'src/ui/pantallas/base.js',
  'src/ui/pantallas/rubros.js',
  'src/ui/pantallas/ajustes.js',
  'src/ui/pantallas/ahorro.js',
  'src/ui/pantallas/ahorros.js',
  'src/ui/pantallas/monedas.js',
  'src/ui/pantallas/grupos.js',
  'src/ui/pantallas/fijos.js',
  'src/ui/pantallas/evolucion.js',
  'src/ui/pantallas/lista.js',
  'src/ui/pantallas/datos.js',
  'src/ui/pantallas/movimiento.js',
  'src/ui/series-interaccion.js',
  'src/ui/app.js',
];


// Quita las líneas `import ... from '...'` y la palabra `export`. Los archivos
// de src/ se escriben como módulos de verdad para que los tests de Node los
// puedan importar; el archivo construido no los necesita porque queda todo
// junto en el mismo ámbito.
function aplanarModulo(codigo) {
  return codigo
    .replace(/^\s*import\s[^;]*?;\s*$/gm, '')
    .replace(/^(\s*)export\s+(?=(const|let|var|function|class|async)\b)/gm, '$1')
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
}

// Con todos los módulos en el mismo ámbito, dos archivos que declaren el mismo
// nombre producen un error de sintaxis recién al abrir la app en el navegador.
// Detectarlo acá convierte ese error tardío en un error de construcción.
function nombresDeclarados(codigo) {
  const nombres = [];
  const patron = /^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm;
  let coincidencia;
  while ((coincidencia = patron.exec(codigo)) !== null) nombres.push(coincidencia[1]);
  return nombres;
}

/**
 * Las rutas que un módulo importa, resueltas contra la raíz del proyecto.
 *
 * Sirve para comprobar que la lista de arriba esté completa. Sin esto, importar
 * un archivo y olvidarse de agregarlo a MODULOS construye un `dist/` que se
 * rompe recién al abrirlo, con un ReferenceError que no dice de dónde viene: la
 * construcción sale en verde y el error aparece en el celular del usuario.
 * Es L-015 otra vez —una lista escrita a mano que hay que acordarse de
 * actualizar—, así que se comprueba en vez de recordarse.
 */
function importaciones(codigo, rutaDelModulo) {
  const patron = /^\s*import\s[^;]*?\sfrom\s*['"]([^'"]+)['"]\s*;?\s*$/gm;
  const rutas = [];
  let coincidencia;
  while ((coincidencia = patron.exec(codigo)) !== null) {
    const destino = coincidencia[1];
    if (!destino.startsWith('.')) continue;
    // `posix.normalize` sobre el directorio del módulo: las rutas de MODULOS se
    // escriben con barras normales, así que se comparan como texto.
    const carpeta = rutaDelModulo.split('/').slice(0, -1).join('/');
    rutas.push(posix.normalize(`${carpeta}/${destino}`));
  }
  return rutas;
}

async function construir() {
  const version = (await readFile(join(RAIZ, 'VERSION'), 'utf8')).trim();
  const plantilla = await readFile(join(RAIZ, 'src/plantilla.html'), 'utf8');
  const estilos = await readFile(join(RAIZ, 'src/estilos.css'), 'utf8');

  const partes = [];
  const vistos = new Map();

  const enLaLista = new Set(MODULOS);

  for (const ruta of MODULOS) {
    const original = await readFile(join(RAIZ, ruta), 'utf8');

    for (const importada of importaciones(original, ruta)) {
      if (!enLaLista.has(importada)) {
        throw new Error(
          `${ruta} importa ${importada}, que no está en MODULOS. Al concatenar, ese ` +
          `archivo no entraría y la app fallaría recién al abrirla. Agregalo a la lista.`
        );
      }
    }

    const codigo = aplanarModulo(original);

    for (const nombre of nombresDeclarados(codigo)) {
      if (vistos.has(nombre)) {
        throw new Error(
          `Nombre repetido: "${nombre}" se declara en ${vistos.get(nombre)} y en ${ruta}. ` +
          `Al quedar todo en el mismo ámbito, uno pisaría al otro. Renombrá uno de los dos.`
        );
      }
      vistos.set(nombre, ruta);
    }

    partes.push(`// ── ${ruta} ${'─'.repeat(Math.max(0, 60 - ruta.length))}\n${codigo.trim()}`);
  }

  const guion = [
    `'use strict';`,
    `globalThis.__VIAJECOR_VERSION__ = ${JSON.stringify(version)};`,
    ...partes,
  ].join('\n\n');

  // Que el guión al menos se pueda leer. La guardia vive en tools/sintaxis.mjs
  // y el test usa la misma función, igual que la de privacidad. Ver L-028.
  const roto = buscarErrorDeSintaxis(guion);
  if (roto) throw new Error(roto);

  const html = plantilla
    .replaceAll('/*{{ICONO}}*/', () => iconoComoDataUri())
    .replace('/*{{ESTILOS}}*/', () => estilos.trim())
    .replace('/*{{GUION}}*/', () => `(function () {\n${guion}\n})();`);

  // La guardia vive en tools/privacidad.mjs, y el test usa exactamente la misma
  // función: dos copias de esta regla serían dos reglas que se separan.
  const fuga = buscarFugas(html);
  if (fuga) throw new Error(fuga);

  await mkdir(join(RAIZ, 'dist'), { recursive: true });
  await writeFile(join(RAIZ, 'dist/viajecor.html'), html, 'utf8');

  // La misma app, otra vez, en `public/` — T-948, ADR-043.
  //
  // Es lo que se publica. La carpeta se llama así porque es la que Vercel busca
  // sin que haya que configurar nada, y el archivo se llama `index.html` para
  // que la dirección no tenga nombre de archivo: en un iPhone la app se abre por
  // la web —Chrome en iOS no abre archivos locales— y hay que poder escribirla
  // en un teclado de teléfono.
  //
  // **Es una copia byte a byte, escrita por el build**, nunca a mano: dos
  // archivos que se editan por separado son dos apps distintas con el mismo
  // nombre, y el usuario no tendría forma de saber cuál está usando. Por eso
  // tampoco va al repositorio: la genera el mismo build que corre al publicar.
  await mkdir(join(RAIZ, 'public'), { recursive: true });
  await writeFile(join(RAIZ, 'public/index.html'), html, 'utf8');

  // El trabajador de servicio y el manifiesto — T-950, ADR-045.
  //
  // Van SOLO en lo publicado. El archivo que se baja sigue siendo uno solo: no
  // los necesita, porque desde el disco ya abre sin conexión.
  //
  // La versión va adentro del nombre de la caché a propósito: es lo que hace
  // que al publicar una versión nueva el navegador tire la copia vieja en vez
  // de dejarla dando vueltas.
  const servicio = await readFile(join(RAIZ, 'src/servicio.js'), 'utf8');

  // El trabajador de servicio pasa por SU guardia, que es otra: puede usar
  // `fetch` —es su trabajo— pero no puede hablar con nadie más que con esta
  // misma dirección.
  const fugaDelServicio = buscarFugasDelServicio(servicio);
  if (fugaDelServicio) throw new Error(fugaDelServicio);

  const rotoElServicio = buscarErrorDeSintaxis(servicio);
  if (rotoElServicio) throw new Error(`El trabajador de servicio no se puede leer: ${rotoElServicio}`);
  await writeFile(join(RAIZ, 'public/sw.js'),
    servicio.replaceAll('{{VERSION}}', () => version), 'utf8');
  await writeFile(join(RAIZ, 'public/manifest.webmanifest'),
    JSON.stringify(manifiesto(version), null, 2) + '\n', 'utf8');
  await writeFile(join(RAIZ, 'public/icono.png'), pngDelIcono());

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`dist/viajecor.html + public/ (app, sw, manifiesto, ícono) — v${version} — ${kb} kB — ${MODULOS.length} módulo(s)`);
}

construir().catch((error) => {
  console.error(`\nNo se pudo construir:\n  ${error.message}\n`);
  process.exit(1);
});
