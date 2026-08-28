// Un lector de XML mínimo — T-031.
//
// ── Por qué no se usa el del navegador ───────────────────────────────────────
//
// ADR-010 decía que el `.xlsx` se iba a parsear con `DOMParser`, que trae el
// navegador. Al ir a escribirlo aparecieron dos problemas con esa decisión:
//
//   1. **`DOMParser` es del navegador.** `datos/` no puede tocarlo (ver
//      ARQUITECTURA y la regla 2 de CLAUDE.md). No es formalismo: significa que
//      el importador **no se podría probar con `node --test`**, y el importador
//      es lo que va a tocar once meses de datos que no están en ningún otro
//      lado. Un módulo que solo se puede probar abriendo un navegador se prueba
//      menos.
//   2. Un `.xlsx` de Excel trae megabytes de XML con cosas que no interesan.
//      Construir un árbol entero para leer las celdas de una hoja es trabajo y
//      memoria por nada, en un teléfono.
//
// Así que se lee a mano. **No es un parser de XML de propósito general** y no
// pretende serlo: entiende exactamente lo que un `.xlsx` usa —etiquetas,
// atributos, texto y las cinco entidades del formato— y nada más. No hay
// espacios de nombres, ni DTD, ni CDATA, ni entidades definidas por el
// documento, porque un `.xlsx` no los tiene.
//
// Ver ADR-028.

/** Las cinco entidades que XML define, y las numéricas. */
export function desescapar(texto) {
  if (!texto.includes('&')) return texto;

  return texto.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (entera, cuerpo) => {
    if (cuerpo === 'amp') return '&';
    if (cuerpo === 'lt') return '<';
    if (cuerpo === 'gt') return '>';
    if (cuerpo === 'quot') return '"';
    if (cuerpo === 'apos') return "'";
    if (cuerpo.startsWith('#x') || cuerpo.startsWith('#X')) {
      return String.fromCodePoint(parseInt(cuerpo.slice(2), 16));
    }
    if (cuerpo.startsWith('#')) return String.fromCodePoint(parseInt(cuerpo.slice(1), 10));
    return entera;
  });
}

/**
 * Recorre el XML y avisa de cada etiqueta y de cada texto.
 *
 * Es un recorrido y no un árbol: una hoja de Excel con 30 000 celdas no tiene
 * por qué entrar entera en memoria para leer sus filas. Quien llama arma lo que
 * necesita a medida que pasa.
 *
 * `alAbrir(nombre, atributos, vacia)`, `alCerrar(nombre)` y `alTexto(texto)`.
 */
export function recorrerXml(xml, { alAbrir, alCerrar, alTexto } = {}) {
  let i = 0;
  const largo = xml.length;

  while (i < largo) {
    const abre = xml.indexOf('<', i);

    if (abre === -1) {
      if (alTexto && i < largo) alTexto(desescapar(xml.slice(i)));
      return;
    }

    if (abre > i && alTexto) alTexto(desescapar(xml.slice(i, abre)));

    // Comentarios, declaraciones y CDATA: se saltean enteros. No aparecen en las
    // hojas, pero un archivo de otro programa puede traerlos y no son un error.
    if (xml.startsWith('<!--', abre)) { i = saltar(xml, abre, '-->'); continue; }
    if (xml.startsWith('<![CDATA[', abre)) {
      const fin = xml.indexOf(']]>', abre);
      if (alTexto) alTexto(xml.slice(abre + 9, fin === -1 ? largo : fin));
      i = fin === -1 ? largo : fin + 3;
      continue;
    }
    if (xml.startsWith('<?', abre)) { i = saltar(xml, abre, '?>'); continue; }
    if (xml.startsWith('<!', abre)) { i = saltar(xml, abre, '>'); continue; }

    const cierra = buscarFinDeEtiqueta(xml, abre);
    if (cierra === -1) return;  // etiqueta sin cerrar: se termina, no se adivina

    const cuerpo = xml.slice(abre + 1, cierra);
    i = cierra + 1;

    if (cuerpo.startsWith('/')) {
      if (alCerrar) alCerrar(cuerpo.slice(1).trim());
      continue;
    }

    const vacia = cuerpo.endsWith('/');
    const sinBarra = vacia ? cuerpo.slice(0, -1) : cuerpo;
    const espacio = sinBarra.search(/[\s]/);
    const nombre = espacio === -1 ? sinBarra : sinBarra.slice(0, espacio);

    if (alAbrir) {
      alAbrir(nombre, espacio === -1 ? {} : leerAtributos(sinBarra.slice(espacio)), vacia);
    }
    if (vacia && alCerrar) alCerrar(nombre);
  }
}

function saltar(xml, desde, hasta) {
  const fin = xml.indexOf(hasta, desde);
  return fin === -1 ? xml.length : fin + hasta.length;
}

/**
 * Busca el `>` que cierra la etiqueta, **sin contar los que están dentro de un
 * valor entre comillas**.
 *
 * Un atributo puede contener `>`: `<c r="A1" t="x>y">`. Buscar el primer `>` a
 * secas parte la etiqueta al medio y todo lo que sigue se lee corrido.
 */
function buscarFinDeEtiqueta(xml, desde) {
  let comilla = '';
  for (let i = desde + 1; i < xml.length; i += 1) {
    const c = xml[i];
    if (comilla) {
      if (c === comilla) comilla = '';
    } else if (c === '"' || c === "'") {
      comilla = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

function leerAtributos(texto) {
  const atributos = {};
  const patron = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let coincidencia;

  while ((coincidencia = patron.exec(texto)) !== null) {
    atributos[coincidencia[1]] = desescapar(coincidencia[3] ?? coincidencia[4] ?? '');
  }
  return atributos;
}
