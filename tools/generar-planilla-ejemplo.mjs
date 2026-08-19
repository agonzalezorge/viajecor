// Genera test/ejemplo/planilla-ejemplo.xlsx: una copia de la estructura de la
// planilla real del usuario, con montos y detalles INVENTADOS.
//
// Por qué existe: los gastos reales del usuario son confidenciales y no van a un
// repositorio. Pero el importador (T-031) necesita algo contra qué construirse y
// testearse, y ese algo tiene que tener las mismas rarezas que el original —
// mayúsculas inconsistentes, día y mes en columnas separadas, bloques mensuales
// repetidos— o el importador va a andar contra el ejemplo y fallar contra la
// planilla de verdad.
//
// Por qué un generador y no un .xlsx commiteado: un binario en el repositorio no
// se puede leer ni revisar. Este archivo, además de producir el ejemplo,
// documenta en código cómo está armada la planilla original.
//
// Se escribe el ZIP a mano con zlib, que ya viene en Node: sin dependencias.
//
// Uso:  node tools/generar-planilla-ejemplo.mjs

import { deflateRawSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Estructura tomada de la planilla real ────────────────────────────────────

const RUBROS_GASTO = ['gastos fijos', 'supermercado', 'comida hecha', 'viajes',
  'entretenimiento', 'transporte', 'salud', 'otros'];
const RUBROS_INGRESO = ['trabajo', 'inversiones', 'regalos', 'otros'];

// Los comentarios funcionan como etiqueta: nombres de viaje y de gastos fijos
// recurrentes conviven en la misma columna, igual que en el original.
const VIAJES = ['Lisboa', 'Roma', 'Coruña', 'Guanacaste', 'Praga', 'Atenas'];
const FIJOS = ['Luz', 'Gas', 'Internet+celular', 'Psicóloga'];

const MESES = [
  { titulo: 'OCTUBRE 2025', anio: 2025, mes: 10, dias: 31 },
  { titulo: 'NOVIEMBRE 2025', anio: 2025, mes: 11, dias: 30 },
  { titulo: 'DICIEMBRE 2025', anio: 2025, mes: 12, dias: 31 },
  { titulo: 'ENERO 2026', anio: 2026, mes: 1, dias: 31 },
];

// Generador de números reproducible: la misma semilla da siempre el mismo
// archivo, así un test que dependa de él no cambia de resultado entre corridas.
function azar(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const r = azar(20260818);
const elegir = (lista) => lista[Math.floor(r() * lista.length)];

// Excel guarda las fechas como días desde el 1900-01-01, con el famoso error de
// considerar 1900 bisiesto. Por eso el desfase es 25569 desde la época Unix.
function fechaExcel(anio, mes, dia) {
  return Math.round(Date.UTC(anio, mes - 1, dia) / 86400000) + 25569;
}

function generarMovimientos() {
  const filas = [];
  for (const m of MESES) {
    const cantidad = 55 + Math.floor(r() * 25);
    for (let i = 0; i < cantidad; i++) {
      const dia = 1 + Math.floor(r() * m.dias);
      const esIngreso = r() < 0.08;
      const rubro = esIngreso ? elegir(RUBROS_INGRESO) : elegir(RUBROS_GASTO);

      let comentario = '';
      if (rubro === 'viajes') comentario = elegir(VIAJES);
      else if (rubro === 'gastos fijos' && r() < 0.7) comentario = elegir(FIJOS);

      // Los montos son inventados, pero con órdenes de magnitud plausibles para
      // que los totales de prueba no queden absurdos.
      let monto;
      if (esIngreso) monto = 200 + r() * 2000;
      else if (rubro === 'gastos fijos') monto = 20 + r() * 120;
      else if (rubro === 'supermercado') monto = 8 + r() * 70;
      else if (rubro === 'comida hecha') monto = 4 + r() * 25;
      else if (rubro === 'viajes') monto = 15 + r() * 250;
      else monto = 5 + r() * 90;

      filas.push({
        anio: m.anio,
        mes: m.mes,
        dia,
        comentario,
        detalle: r() < 0.25 ? 'detalle de ejemplo' : '',
        // Mayúsculas inconsistentes a propósito: el original las tiene, y el
        // importador tiene que resolverlas (RN-03, L-002).
        rubro: r() < 0.05 ? rubro.toUpperCase() : rubro,
        monto: Math.round(monto * 100) / 100,
        tipo: esIngreso ? (r() < 0.1 ? 'i' : 'I') : (r() < 0.1 ? 'g' : 'G'),
      });
    }
  }
  return filas;
}

// ── Armado del XML de la hoja ────────────────────────────────────────────────

const escapar = (t) => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const columna = (n) => n < 26 ? LETRAS[n] : LETRAS[Math.floor(n / 26) - 1] + LETRAS[n % 26];

function celda(col, fila, valor, estilo) {
  const ref = `${columna(col)}${fila}`;
  const s = estilo ? ` s="${estilo}"` : '';
  if (valor === '' || valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
}

function hojaGastos(movimientos) {
  const filas = [];
  let n = 1;

  const agregar = (celdas) => {
    const contenido = celdas.join('');
    if (contenido) filas.push(`<row r="${n}">${contenido}</row>`);
    n++;
  };

  for (const m of MESES) {
    const delMes = movimientos.filter((x) => x.anio === m.anio && x.mes === m.mes);

    agregar([]); // separación, como en el original
    agregar([celda(0, n, m.titulo)]);
    agregar([]);
    agregar([celda(0, n, 'INGRESOS Y GASTOS'), celda(9, n, 'GASTOS POR TIPO')]);
    agregar([
      celda(0, n, 'G/Acum./Mes'), celda(1, n, 'Comentarios'), celda(2, n, 'DÍA'),
      celda(3, n, 'MES'), celda(4, n, 'DETALLES'), celda(5, n, 'RUBRO'),
      celda(6, n, 'MONTO'), celda(7, n, 'I/G'),
    ]);

    for (const mov of delMes) {
      agregar([
        celda(1, n, mov.comentario),
        celda(2, n, mov.dia),
        celda(3, n, fechaExcel(mov.anio, mov.mes, 1), 1), // MES = día 1, como el original
        celda(4, n, mov.detalle),
        celda(5, n, mov.rubro),
        celda(6, n, mov.monto),
        celda(7, n, mov.tipo),
      ]);
    }
    agregar([]);
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${filas.join('')}</sheetData></worksheet>`;
}

// ── Armado del ZIP (un .xlsx es un ZIP) ──────────────────────────────────────

function crearZip(entradas) {
  const locales = [];
  const central = [];
  let desplazamiento = 0;

  // Tabla CRC-32, que el formato ZIP exige por cada entrada.
  const tablaCrc = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tablaCrc[i] = c;
  }
  const crc32 = (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = tablaCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };

  for (const [nombre, texto] of Object.entries(entradas)) {
    const crudo = Buffer.from(texto, 'utf8');
    const comprimido = deflateRawSync(crudo);
    const nombreBuf = Buffer.from(nombre, 'utf8');
    const crc = crc32(crudo);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);              // método DEFLATE
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(crudo.length, 22);
    local.writeUInt16LE(nombreBuf.length, 26);
    locales.push(local, nombreBuf, comprimido);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(comprimido.length, 20);
    dir.writeUInt32LE(crudo.length, 24);
    dir.writeUInt16LE(nombreBuf.length, 28);
    dir.writeUInt32LE(desplazamiento, 42);
    central.push(dir, nombreBuf);

    desplazamiento += 30 + nombreBuf.length + comprimido.length;
  }

  const cuerpo = Buffer.concat(locales);
  const directorio = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(Object.keys(entradas).length, 8);
  fin.writeUInt16LE(Object.keys(entradas).length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(cuerpo.length, 16);

  return Buffer.concat([cuerpo, directorio, fin]);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const movimientos = generarMovimientos();

const zip = crearZip({
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,

  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,

  'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Gastos" sheetId="1" r:id="rId1"/></sheets></workbook>`,

  'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,

  // El estilo 1 marca las celdas de fecha: sin él, Excel muestra el número de
  // serie en vez de la fecha, igual que le pasaría al importador si lo ignorara.
  'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="2"><xf xfId="0"/><xf numFmtId="164" applyNumberFormat="1" xfId="0"/></cellXfs>
</styleSheet>`,

  'xl/worksheets/sheet1.xml': hojaGastos(movimientos),
});

await mkdir(join(RAIZ, 'test/ejemplo'), { recursive: true });
await writeFile(join(RAIZ, 'test/ejemplo/planilla-ejemplo.xlsx'), zip);

const gastos = movimientos.filter((m) => m.tipo.toUpperCase() === 'G');
const ingresos = movimientos.filter((m) => m.tipo.toUpperCase() === 'I');
const total = (l) => l.reduce((a, m) => a + m.monto, 0).toFixed(2);

console.log(`test/ejemplo/planilla-ejemplo.xlsx — ${(zip.length / 1024).toFixed(1)} kB`);
console.log(`  ${movimientos.length} movimientos en ${MESES.length} meses`);
console.log(`  ${gastos.length} gastos por ${total(gastos)} · ${ingresos.length} ingresos por ${total(ingresos)}`);
console.log(`  montos inventados, estructura igual a la planilla real`);
