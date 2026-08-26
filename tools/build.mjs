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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// Orden de concatenación: cada archivo puede usar lo que definieron los
// anteriores. core/ primero (no depende de nada), después datos/, después ui/.
// Al agregar un módulo nuevo, agregarlo acá en la posición que le corresponde.
const MODULOS = [
  'src/core/dinero.js',
  'src/core/modelo.js',
  'src/core/monedas.js',
  'src/core/cambio.js',
  'src/core/calculos.js',
  'src/core/formato.js',
  'src/datos/almacenamiento.js',
  'src/ui/pantallas/cambio.js',
  'src/ui/pantallas/movimiento.js',
  'src/ui/app.js',
];

// Nada de esto puede aparecer en el archivo final: cada uno sería una forma de
// que un dato salga del dispositivo. Ver RN-06 y ADR-009.
const PROHIBIDO = [
  /\bhttps?:\/\//i,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /navigator\s*\.\s*sendBeacon/,
  /\bimport\s*\(/,
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

async function construir() {
  const version = (await readFile(join(RAIZ, 'VERSION'), 'utf8')).trim();
  const plantilla = await readFile(join(RAIZ, 'src/plantilla.html'), 'utf8');
  const estilos = await readFile(join(RAIZ, 'src/estilos.css'), 'utf8');

  const partes = [];
  const vistos = new Map();

  for (const ruta of MODULOS) {
    const codigo = aplanarModulo(await readFile(join(RAIZ, ruta), 'utf8'));

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

  const html = plantilla
    .replace('/*{{ESTILOS}}*/', () => estilos.trim())
    .replace('/*{{GUION}}*/', () => `(function () {\n${guion}\n})();`);

  for (const patron of PROHIBIDO) {
    const encontrado = html.match(patron);
    if (encontrado) {
      throw new Error(
        `El archivo construido contiene "${encontrado[0]}", que permitiría que un dato ` +
        `salga del dispositivo. La app no hace ninguna petición de red (RN-06).`
      );
    }
  }

  await mkdir(join(RAIZ, 'dist'), { recursive: true });
  await writeFile(join(RAIZ, 'dist/viajecor.html'), html, 'utf8');

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`dist/viajecor.html — v${version} — ${kb} kB — ${MODULOS.length} módulo(s)`);
}

construir().catch((error) => {
  console.error(`\nNo se pudo construir:\n  ${error.message}\n`);
  process.exit(1);
});
