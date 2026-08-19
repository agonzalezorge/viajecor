# Arquitectura — Viajecor

> Documento vivo. Se actualiza en el mismo cambio que modifica la estructura o el
> modelo de datos. Las decisiones con su justificación están en
> `docs/DECISIONES.md`; acá está el resultado.
>
> Última actualización: 2026-08-19 · Versión del documento: v0.1

---

## 1. Las tres restricciones que mandan

Todo lo demás se deduce de estas tres, que vienen del producto
(`docs/PRODUCTO.md`, secciones 2 y 6):

1. **Un solo archivo HTML.** El usuario tiene que poder guardar un archivo y
   abrirlo. Nada de instalar, compilar o servir.
2. **Funciona sin conexión, abierto desde el disco** (`file://`).
3. **Cero red.** La app no hace ni una petición a internet, nunca.

## 2. La forma de la app

```
navegador (celular o compu)
└── viajecor.html          ← un archivo, todo adentro: HTML + CSS + JS
    ├── interfaz
    ├── lógica de cálculo  ← pura, sin depender del navegador → se puede testear
    └── almacenamiento     ← localStorage del navegador
```

No hay backend. No hay base de datos remota. No hay proceso de servidor. El
archivo HTML **es** la aplicación.

## 3. Por qué el código fuente está partido si el resultado es un archivo

El código vive en `src/` en varios archivos, y un script de construcción
(`tools/build.mjs`) los pega en un único `dist/viajecor.html`. Parece un rodeo.
No lo es, por tres motivos:

1. **Los módulos de JavaScript no funcionan desde `file://`.** Si el HTML hiciera
   `<script type="module" src="app.js">`, el navegador lo bloquearía por seguridad
   al abrirlo desde el disco. La única forma de tener JavaScript modular y a la vez
   abrir el archivo sin servidor es **pegar todo en un archivo al construir**.
2. **La lógica se puede testear.** Los archivos de `src/core/` son funciones puras:
   entra un dato, sale un resultado, sin tocar el navegador. Eso permite correrlos
   con el ejecutor de tests de Node y comprobar que los cálculos de dinero están
   bien **sin abrir un navegador**.
3. **Varios agentes pueden trabajar en paralelo.** Un archivo único de 3000 líneas
   garantiza conflictos cada vez que dos agentes tocan la app. Ver
   `docs/AGENTES.md`.

El usuario nunca ve `src/`: descarga `dist/viajecor.html` y listo.

## 4. Estructura de carpetas

```
viajecor/
├── VERSION                  # una línea: la versión actual
├── CHANGELOG.md             # qué cambió en cada versión
├── CLAUDE.md                # puerta de entrada para agentes de IA
├── README.md
├── docs/
│   ├── PRODUCTO.md          # qué hace la app y por qué  ← reglas de negocio
│   ├── ARQUITECTURA.md      # este archivo
│   ├── PLAN.md              # qué se hace después  ← fuente de verdad del trabajo
│   ├── DECISIONES.md        # decisiones técnicas con su porqué (ADR)
│   ├── LECCIONES.md         # trampas en las que este proyecto ya cayó
│   ├── AGENTES.md           # cómo trabajan varios agentes sin pisarse
│   └── HISTORIAL-INICIAL.md # documento cerrado: el porqué de los 6 primeros commits
├── src/
│   ├── core/                # lógica pura, sin navegador. Testeable.
│   │   ├── dinero.js        # aritmética de dinero en unidades enteras
│   │   ├── modelo.js        # forma y validación de un movimiento
│   │   ├── cambio.js        # tipos de cambio y conversión a euros
│   │   ├── calculos.js      # totales por mes, por rubro, por día, por viaje
│   │   └── formato.js       # cómo se muestran montos y fechas
│   ├── datos/               # persistencia y transporte
│   │   ├── almacenamiento.js  # leer/escribir en localStorage
│   │   ├── exportar.js
│   │   └── importar.js
│   ├── ui/                  # todo lo que toca el DOM
│   │   ├── app.js           # arranque y ruteo entre pantallas
│   │   └── pantallas/       # una pantalla por archivo
│   ├── estilos.css
│   └── plantilla.html       # el esqueleto donde se inyecta todo
├── tools/
│   └── build.mjs            # arma dist/viajecor.html
├── test/                    # tests de src/core y src/datos
└── dist/
    └── viajecor.html        # el entregable
```

**Regla de dependencias, en una línea:** `ui/` puede usar `datos/` y `core/`;
`datos/` puede usar `core/`; **`core/` no usa nada**. Si un archivo de `core/`
menciona `document`, `window` o `localStorage`, está mal ubicado.

## 5. Modelo de datos

Todo lo que la app guarda vive bajo una sola clave de `localStorage`,
`viajecor:datos:v1`, con esta forma:

```jsonc
{
  "esquema": 1,                    // sube solo si cambia la forma de los datos
  "version_app": "0.1.0",          // versión que escribió estos datos
  "movimientos": [ /* ... */ ],
  "tipos_cambio": [ /* ... */ ],
  "monedas": [ /* ... */ ],        // RN-04b: las maneja el usuario, no el código
  "preferencias": {
    "moneda_predeterminada": "EUR" // RN-04: se recuerda la última usada
  }
}
```

### Moneda

```jsonc
{
  "codigo": "CRC",
  "nombre": "Colón costarricense",
  "decimales": 2,           // de esto depende cómo se guarda el monto. Ver 5.1
  "oculta": false           // se ocultan, no se borran, si ya tienen movimientos
}
```

La app arranca con `EUR`, `UYU`, `USD` y `CRC`. El euro es la moneda base: viene
fijo, no se puede borrar ni cambiarle los decimales.

**Por qué la lista es un dato y no una constante del código:** agregar una moneda
para un viaje imprevisto no puede depender de publicar una versión nueva de la
app. La persona estaría en otro país, sin poder registrar nada. Ver ADR-011.

### Movimiento

```jsonc
{
  "id": "mov_9f2c1a4b3d7e5602",  // 8 bytes al azar, generados al crear
  "fecha": "2026-03-14",    // AAAA-MM-DD. Una sola fecha (RN-01)
  "tipo": "G",              // "G" gasto | "I" ingreso
  "rubro": "supermercado",  // siempre normalizado (RN-03)
  "monto": 1250,            // ¡entero! ver 5.1
  "moneda": "EUR",          // código de 3 letras
  "comentario": "Roma",     // etiqueta para agrupar. Puede estar vacío
  "detalle": "cena",        // texto libre. Puede estar vacío
  "creado": "2026-03-14"      // el DÍA de la carga. La app no registra horas
}
```

No se guarda el importe convertido a euros: **se calcula** (RN-05).

**Por qué el identificador es tan largo:** son 16 dígitos hexadecimales (8 bytes)
y no 8. Con 8 dígitos hay unos 4.300 millones de valores posibles, que suena de
sobra, pero por la paradoja del cumpleaños la probabilidad de que **dos**
movimientos compartan identificador ronda el 10% con 30.000 movimientos — el
volumen que la sección 6 da por esperable. Dos movimientos con el mismo
identificador significan que editar uno cambia el otro y que borrar uno borra el
que no era. Con 16 dígitos la probabilidad se vuelve despreciable, y cuesta ocho
caracteres por movimiento.

**En ningún campo hay una hora.** Ni en la fecha del gasto ni en `creado`: la app
registra días, no instantes (ADR-021). Es lo que hace que ninguna zona horaria
pueda correr ningún dato de día, sin depender de que nadie se olvide.

**El comentario se guarda tal como se escribió** (`Roma`, no `roma`), y agrupar
por comentario es agrupar por su **clave** —`claveDeComentario()` de
`core/modelo.js`—, nunca por el texto. Ver ADR-013. El rubro, el tipo y el código
de moneda sí se guardan ya normalizados, porque salen de listas cerradas y su
forma canónica es la que se muestra.

### Tipo de cambio

```jsonc
{
  "moneda": "CRC",
  "mes": "2026-03",         // AAAA-MM. Rige para todo ese mes (RN-04)
  "euros_por_unidad": 0.00164,
  "creado": "2026-03-14"
}
```

La clave única es el par `(moneda, mes)`. Guardamos **euros por unidad de moneda
extranjera** — se multiplica para convertir, que es la operación que menos se
presta a error. Al usuario se le puede pedir en cualquiera de los dos sentidos
(CU-03); la app invierte el número antes de guardarlo.

### 5.1 El dinero se guarda como número entero

`monto: 1250` son **12,50 €**, no 1250 €. Los montos se guardan en la unidad
mínima de la moneda (céntimos para el euro).

*Por qué:* en JavaScript, `0.1 + 0.2` da `0.30000000000000004`. Sumar cientos de
gastos con decimales acumula error, y un total de gastos que no cierra por un
céntimo destruye la confianza en la app entera. Con enteros, `10 + 20 = 30`,
siempre.

*Consecuencias, que hay que respetar:*
- La conversión de moneda y los promedios **sí** producen decimales. Se redondea
  al céntimo **una sola vez, al final** de cada cálculo, nunca en el medio.
- Cuántos decimales tiene cada moneda **no lo decide el código**: sale del campo
  `decimales` de la moneda (RN-04b). `core/dinero.js` recibe ese número; no tiene
  una tabla propia que se desactualice.

## 6. Almacenamiento

`localStorage`, una sola clave, escritura completa en cada cambio.

*Por qué localStorage y no IndexedDB:* es síncrono y trivial de usar, no necesita
manejo de transacciones ni de versiones, y el límite (~5 MB) alcanza de sobra. Un
movimiento ocupa unos 150 bytes, así que entran del orden de 30.000 movimientos:
el Excel actual tiene alrededor de 1.000 en un año. IndexedDB sería complejidad
comprada para un problema que no existe.

*Cuándo revisar esta decisión:* si se agregan adjuntos (fotos de tickets) o si el
volumen se acerca a los 20.000 movimientos. El módulo `datos/almacenamiento.js`
es la única puerta a la persistencia, así que cambiarlo es cambiar un archivo.

**Qué pasa si lo guardado no se entiende:** la app abre igual, con lo que haya
podido rescatar, y **nunca escribe encima de lo que no entendió**. Lo ilegible se
copia a una clave aparte, `viajecor:rescate:<fecha>`, y la clave original queda
intacta. Un registro roto no invalida a los demás: se descarta ese y se informa
cuál y por qué. Ver ADR-015 y ADR-017.

**Guardar, en cambio, falla ruidosamente.** Si el almacenamiento está lleno, la
operación tira un error en vez de seguir como si nada: una app que dice haber
guardado y no guardó le hace perder al usuario una tarde entera de carga. Ver
ADR-016.

**Riesgo asumido, y no es menor:** borrar los datos del navegador borra todo.
Por eso exportar (CU-07) no es una función secundaria: es la copia de seguridad.
La app tiene que empujar a exportar de forma visible y periódica.

## 7. Exportar e importar

**JSON** (`viajecor-AAAA-MM-DD.json`): el estado completo, tal cual la sección 5.
Es el formato de respaldo y el único que se puede reimportar sin pérdida.

**CSV** (`viajecor-AAAA-MM-DD.csv`): una fila por movimiento, para abrir en Excel.
Incluye el monto original, la moneda, el tipo de cambio aplicado y el importe en
euros, para que la planilla sea comprensible sin la app. Se exporta con separador
`,`, codificación UTF-8 y BOM (sin BOM, Excel rompe los acentos).

La descarga se hace generando el archivo en memoria y usando un enlace de
descarga del navegador. No hay servidor involucrado.

## 8. Cero dependencias

El proyecto **no usa ninguna librería**: ni framework de interfaz, ni de fechas,
ni de tests, ni de construcción. No hay `npm install`.

*Por qué:*
- Cualquier librería habría que empaquetarla dentro del HTML, lo que agranda el
  entregable, o cargarla de un CDN, **lo que viola RN-06**.
- La app tiene que seguir funcionando dentro de cinco años desde un archivo
  guardado. Cero dependencias es cero cosas que se pudran.
- Para tests alcanza el ejecutor incluido en Node (`node --test`).
- El alcance es chico: no hay nada acá que justifique un framework.

Node se usa **solo** para construir y para correr los tests. La app entregada no
necesita Node ni nada instalado.

## 9. Construir y probar

```bash
node tools/build.mjs      # genera dist/viajecor.html
node --test                # corre los tests de la lógica
```

`tools/build.mjs` toma `src/plantilla.html`, le inyecta el CSS y todos los
módulos de JavaScript concatenados en orden de dependencia, y escribe el
resultado. No minifica: el archivo tiene que quedar legible, porque poder abrir
el HTML y leer qué hace es parte de la garantía de privacidad.

**`dist/viajecor.html` se versiona en git.** Es lo que el usuario descarga, y
tener que construirlo para usarlo rompería la premisa del proyecto.

## 10. Compatibilidad

Navegadores modernos de celular y escritorio (Chrome, Safari, Firefox, Edge de los
últimos dos años). Sin transpilar, sin polyfills. Se usa JavaScript moderno
directamente.

## 11. Lo que esta arquitectura no soporta, y está bien

- **Varios dispositivos con los mismos datos** — no hay sincronización, ni la
  habrá sin un servidor, que violaría RN-06. La forma de mover datos es exportar
  e importar.
- **Varias personas** — hay un solo juego de datos por navegador.
- **Recuperar datos borrados** — no hay papelera ni historial. El respaldo es la
  exportación.

## 12. Riesgos técnicos conocidos

| Riesgo | Impacto | Qué hacemos |
|---|---|---|
| Borrado de datos del navegador | Pérdida total | Exportación visible y recordatorios (CU-07) |
| Safari en iOS puede borrar `localStorage` tras semanas sin uso | Pérdida total, silenciosa | Documentado acá y en la app; refuerza el respaldo periódico |
| Errores de redondeo en dinero | Totales que no cierran | Enteros + redondeo único al final (5.1) |
| Un tipo de cambio mal cargado cambia totales históricos | Números que "cambian solos" | Aviso con cantidad de movimientos afectados antes de aplicar (RN-05) |
| El HTML crece y se vuelve lento en celulares viejos | App pesada | Medir antes de optimizar; sin minificar el archivo queda en decenas de KB |
