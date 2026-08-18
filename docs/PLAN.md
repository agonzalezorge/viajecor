# Plan de implementación — Viajecor

> **Este documento es la fuente de verdad del trabajo.** Cuando no hay una
> instrucción específica del usuario, lo que sigue es lo que dice este archivo.
> No hay una segunda lista en otro lado.
>
> Última actualización: 2026-08-18

---

## Cómo elegir la próxima tarea

Sin instrucciones específicas, se aplica este orden, sin saltearse pasos:

1. **¿Hay algo roto?** Si `node --test` falla o `node tools/build.mjs` no
   corre, arreglar eso es la tarea. Nada más avanza con el árbol roto.
2. **¿Hay una tarea `En curso` abandonada?** Si el trabajo está a medias y sin
   nadie encima, terminarla antes de empezar otra. Media tarea no sirve a nadie.
3. **Tomar la tarea `Lista` de menor número.** Una tarea está `Lista` cuando
   **todas** sus dependencias están en `Hecha`.
4. **Si varios agentes trabajan a la vez**, cada uno toma una tarea `Lista`
   distinta cuyo bloque *Toca* no se pise con el de otra tarea en curso. Ver
   `docs/AGENTES.md`.
5. **Si no queda ninguna tarea `Lista`**, tomar una de la sección
   *Independientes* — no dependen de nada y se pueden hacer siempre.
6. **Si una tarea está marcada `Necesita decisión`, no se adivina: se pregunta.**
   Hay una decisión de producto que le corresponde al usuario.

### Reglas al trabajar una tarea

- **Una tarea, un commit** (o unos pocos), con mensaje que explique el *por qué*.
- **Antes de marcar `Hecha`**: los tests pasan, la app construye, y lo que la
  tarea dice en *Terminada cuando* está efectivamente comprobado — no supuesto.
- **Actualizar los documentos en el mismo commit**: si la tarea completa un caso
  de uso, marcarlo `Hecho` en `docs/PRODUCTO.md`. Si tomó una decisión técnica no
  trivial, anotarla en `docs/DECISIONES.md`. Si reveló una trampa, anotarla en
  `docs/LECCIONES.md`.
- **Actualizar el estado en este archivo** al empezar y al terminar.

---

## Estados

| Estado | Significa |
|---|---|
| `Pendiente` | Tiene dependencias sin terminar. Todavía no se puede empezar. |
| `Lista` | Todas sus dependencias están hechas. Se puede tomar ya. |
| `En curso` | Alguien la está haciendo. Se anota quién y desde cuándo. |
| `Hecha` | Terminada y verificada según su criterio. |
| `Necesita decisión` | Frenada esperando una respuesta del usuario. |

---

## Tablero

| ID | Tarea | Estado | Depende de |
|---|---|---|---|
| **Etapa 0 — Cimientos** ||||
| T-001 | Esqueleto del proyecto y construcción | **Hecha** | — |
| T-002 | Aritmética de dinero (`core/dinero.js`) | En curso (claude, 2026-08-18) | T-001 |
| T-003 | Modelo y validación del movimiento | Pendiente | T-002 |
| T-004 | Almacenamiento local | Pendiente | T-003 |
| T-005 | Tipos de cambio y conversión a euros | Pendiente | T-002, T-008 |
| T-006 | Formateo de montos y fechas | Pendiente | T-002 |
| T-007 | Guardia automática de privacidad | **Hecha** | T-001 |
| T-008 | Catálogo de monedas | Pendiente | T-002 |
| T-009 | Planilla de ejemplo para probar el importador | **Hecha** | — |
| **Etapa 1 — v0.1: registrar, ver y exportar** ||||
| T-010 | Armazón de la interfaz | **Lista** | T-001 |
| T-011 | Pantalla de carga de movimiento | Pendiente | T-003, T-004, T-010 |
| T-012 | Pedir el tipo de cambio al vuelo | Pendiente | T-005, T-011 |
| T-013 | Cálculos del mes | Pendiente | T-003, T-005 |
| T-014 | Pantalla de resumen del mes | Pendiente | T-013, T-010, T-006 |
| T-015 | Lista de movimientos, editar y borrar | Pendiente | T-011 |
| T-016 | Exportar a JSON | Pendiente | T-004 |
| T-017 | Importar un respaldo JSON | Pendiente | T-016 |
| T-018 | Exportar a CSV | Pendiente | T-005, T-016 |
| T-019 | Verificación real sin conexión | Pendiente | T-011…T-018 |
| **Etapa 2 — Análisis** ||||
| T-020 | Gasto día por día del mes | Pendiente | T-013 |
| T-021 | Evolución mes a mes | Pendiente | T-013 |
| T-022 | Promedio de gastos fijos | Pendiente | T-013 |
| T-023 | Gasto por viaje | Necesita decisión | T-013 |
| T-024 | Pantalla de monedas | Pendiente | T-008, T-010 |
| **Etapa 3 — Traer el historial del Excel** ||||
| T-030 | Definir el mapeo Excel → modelo | Pendiente | T-003, T-009 |
| T-031 | Lector de `.xlsx` sin librerías | Pendiente | T-009 |
| T-032 | Importador con informe de filas no interpretadas | Pendiente | T-030, T-031, T-017 |
| **Etapa 4 — Ahorros conjuntos** ||||
| T-040 | Modelo de ahorros multimoneda | Pendiente | T-004 |
| T-041 | Pantalla de ahorros conjuntos | Pendiente | T-040, T-010 |
| **Independientes** ||||
| T-900 | README de uso | Lista | — |
| T-901 | Versionado y CHANGELOG | Lista | — |
| T-902 | Uso cómodo en celular | Pendiente | T-010 |
| T-903 | Recordatorio de respaldo | Pendiente | T-016 |
| T-904 | Modo oscuro | Pendiente | T-010 |

**Hito v0.1:** T-001 a T-019, más T-008 y T-024 que la multimoneda necesita.
En ese punto la app ya reemplaza al Excel para
cargar gastos y ver cómo viene el mes, y los datos se pueden sacar.

---

## Etapa 0 — Cimientos

Nada de la interfaz tiene sentido antes de que la lógica de dinero esté bien.
Un error de redondeo acá se propaga a todos los números de la app.

### T-001 · Esqueleto del proyecto y construcción
**Estado:** Hecha (2026-08-18) · **Depende de:** —
**Toca:** `src/plantilla.html`, `src/estilos.css`, `src/ui/app.js`, `tools/build.mjs`, `dist/viajecor.html`

Armar la estructura de carpetas de `docs/ARQUITECTURA.md` §4 y el script que pega
`src/` en un único `dist/viajecor.html`.

**Terminada cuando:**
- [x] `node tools/build.mjs` genera `dist/viajecor.html` (4,4 kB).
- [x] Ese archivo, abierto desde el disco con toda la red bloqueada, dibuja la app:
      **0 intentos de red, 0 errores de consola**. Verificado con un navegador real
      controlado por Playwright, no deducido.
- [x] El HTML generado no tiene ninguna referencia a una URL externa.

**Falta verificar en un dispositivo real:** todo lo anterior se comprobó en un
navegador de escritorio automatizado. El recorrido en un celular con modo avión es
parte de T-019.

---

### T-002 · Aritmética de dinero
**Estado:** En curso (claude, 2026-08-18) · **Depende de:** T-001
**Toca:** `src/core/dinero.js`, `test/dinero.test.js`

Montos como enteros en unidad mínima (`docs/ARQUITECTURA.md` §5.1). Interpretar lo
que escribe el usuario, sumar, convertir con un tipo de cambio, promediar, y
redondear una sola vez al final.

**Cuántos decimales tiene cada moneda no lo decide este módulo:** lo recibe como
parámetro, porque la lista de monedas la maneja el usuario (RN-04b, ADR-011). Una
tabla acá se desactualizaría en cuanto se agregue una moneda nueva.

**Terminada cuando:** hay tests que cubren el redondeo hacia arriba y hacia abajo,
el caso `0.1 + 0.2`, una moneda sin decimales, y montos negativos rechazados.

---

### T-003 · Modelo y validación del movimiento
**Estado:** Pendiente · **Depende de:** T-002
**Toca:** `src/core/modelo.js`, `test/modelo.test.js`

Crear un movimiento válido, normalizar textos (RN-03), validar fecha (RN-01) y
la correspondencia tipo↔rubro (RN-02). Las listas de rubros viven acá, tal como
están en `docs/PRODUCTO.md` §4.

**Terminada cuando:** hay tests para `VIAJES`/`viajes`/` Viajes ` como el mismo
rubro, para un rubro de ingreso rechazado en un gasto, y para monto cero o
negativo rechazado.

---

### T-004 · Almacenamiento local
**Estado:** Pendiente · **Depende de:** T-003
**Toca:** `src/datos/almacenamiento.js`, `test/almacenamiento.test.js`

Leer y escribir el estado completo bajo `viajecor:datos:v1`, con el número de
esquema y un lugar previsto para migrar si cambia.

**Terminada cuando:** hay tests con un `localStorage` simulado que cubren primer
arranque sin datos, ida y vuelta de guardar y leer, y datos corruptos que no
tumban la app.

---

### T-005 · Tipos de cambio y conversión a euros
**Estado:** Pendiente · **Depende de:** T-002, T-008 · *Se puede hacer en paralelo con T-003 y T-004*
**Toca:** `src/core/cambio.js`, `test/cambio.test.js`

Guardar y buscar el tipo de cambio por `(moneda, mes)`, convertir un movimiento a
euros (RN-04, RN-05), y responder "¿falta el tipo de cambio para esto?".

**Terminada cuando:** hay tests para euro sin conversión, para una moneda con dos
meses de tipos distintos, para tipo de cambio faltante, y para el cálculo inverso
("cuántos colones es un euro" → guardado como euros por colón).

---

### T-006 · Formateo de montos y fechas
**Estado:** Pendiente · **Depende de:** T-002 · *Paralelizable*
**Toca:** `src/core/formato.js`, `test/formato.test.js`

Mostrar `1250` como `12,50 €` en formato español, y las fechas de forma legible.
Sin librerías: `Intl` viene en el navegador.

---

### T-007 · Guardia automática de privacidad
**Estado:** Hecha (2026-08-18) · **Depende de:** T-001
**Toca:** `test/privacidad.test.js`, `tools/build.mjs`

Un test que revisa `dist/viajecor.html` y **falla** si encuentra `http://`,
`https://`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`navigator.sendBeacon`, `import(`, un `<script src>`, un `<link rel=stylesheet>`,
una imagen externa o un formulario con `action`.

*Por qué existe:* RN-06 es la promesa central del producto. Una promesa que
depende de que nadie se olvide no es una promesa. Este test la vuelve verificable
en cada cambio.

**Terminada cuando:**
- [x] El test corre y pasa sobre el archivo construido.
- [x] La misma comprobación está también en `tools/build.mjs`, así que la
      construcción **falla antes de escribir el archivo**. Comprobado agregando a
      propósito una fuente de Google: la construcción se cayó con el mensaje
      correcto y no generó el archivo.

---

### T-008 · Catálogo de monedas — CU-15
**Estado:** Pendiente · **Depende de:** T-002 · *Paralelizable con T-003 y T-004*
**Toca:** `src/core/monedas.js`, `test/monedas.test.js`

La lista de monedas vive en los datos, no en el código (RN-04b, ADR-011). Este
módulo la maneja: las cuatro precargadas (`EUR`, `UYU`, `USD`, `CRC`), agregar una
nueva con código, nombre y decimales, validar, y ocultar en vez de borrar cuando
ya tiene movimientos.

**Terminada cuando:** hay tests para código repetido rechazado, para el euro que
no se puede borrar ni cambiar de decimales, para una moneda de 0 decimales, y para
el rechazo de borrar una moneda con movimientos.

---

### T-009 · Planilla de ejemplo para probar el importador
**Estado:** Hecha (2026-08-18) · **Depende de:** —
**Toca:** `tools/generar-planilla-ejemplo.mjs`, `test/ejemplo/planilla-ejemplo.xlsx`

Los gastos reales del usuario son confidenciales y no van a un repositorio, pero
el importador necesita algo contra qué construirse. Este generador produce una
planilla con **montos inventados** y **la misma estructura y las mismas rarezas**
que la original: bloques mensuales, día y mes en columnas separadas, mayúsculas
inconsistentes en rubro y tipo, fechas como número de serie de Excel.

Es un generador y no un `.xlsx` commiteado a mano porque un binario en el
repositorio no se puede leer ni revisar; el script, además, documenta en código
cómo está armada la planilla original. Usa una semilla fija, así que produce
siempre el mismo archivo y un test que dependa de él no cambia entre corridas.

**Terminada cuando:**
- [x] `node tools/generar-planilla-ejemplo.mjs` genera el archivo (288 movimientos,
      4 meses, 10,7 kB).
- [x] Un lector de Excel real (openpyxl) lo abre y devuelve las fechas como fechas.
- [x] El navegador lo lee con el método de ADR-010: 1614 celdas, sin librerías.

---

## Etapa 1 — v0.1: registrar, ver y exportar

### T-010 · Armazón de la interfaz
**Estado:** Lista · **Depende de:** T-001 · *Paralelizable con toda la Etapa 0*
**Toca:** `src/ui/app.js`, `src/estilos.css`

Navegación entre pantallas, encabezado con el mes visible y la versión, y los
estilos base pensados para celular.

---

### T-011 · Pantalla de carga de movimiento — CU-01, CU-02
**Estado:** Pendiente · **Depende de:** T-003, T-004, T-010
**Toca:** `src/ui/pantallas/movimiento.js`

Formulario con fecha (hoy por defecto), tipo, monto, moneda (la última usada),
rubro, comentario y detalle. Guarda y vuelve a la lista.

**Terminada cuando:** se puede cargar un gasto y un ingreso, quedan guardados
después de recargar la página, y los errores de validación se muestran claros.

---

### T-012 · Pedir el tipo de cambio al vuelo — CU-03
**Estado:** Pendiente · **Depende de:** T-005, T-011
**Toca:** `src/ui/pantallas/cambio.js`, `src/ui/pantallas/movimiento.js`

Al guardar un movimiento en una moneda sin tipo de cambio para ese mes, pedirlo
antes de guardar, aceptando el valor en cualquiera de los dos sentidos. Más una
pantalla para ver y corregir tipos de cambio, que avisa cuántos movimientos
afecta una corrección.

---

### T-013 · Cálculos del mes — CU-04
**Estado:** Pendiente · **Depende de:** T-003, T-005
**Toca:** `src/core/calculos.js`, `test/calculos.test.js`

Funciones puras: total de gastos, de ingresos y saldo de un mes; desglose por
rubro; serie por día. Todo en euros.

**Terminada cuando:** hay tests con movimientos en más de una moneda y en más de
un mes, comprobando que ninguno se cuenta en el mes equivocado.

---

### T-014 · Pantalla de resumen del mes — CU-04
**Estado:** Pendiente · **Depende de:** T-013, T-010, T-006
**Toca:** `src/ui/pantallas/resumen.js`

---

### T-015 · Lista de movimientos, editar y borrar — CU-06
**Estado:** Pendiente · **Depende de:** T-011
**Toca:** `src/ui/pantallas/lista.js`

Con confirmación y deshacer al borrar. Borrar sin red de contención es la forma
más fácil de perder datos que el usuario no puede recuperar.

---

### T-016 · Exportar a JSON — CU-07
**Estado:** Pendiente · **Depende de:** T-004
**Toca:** `src/datos/exportar.js`, `test/exportar.test.js`, `src/ui/pantallas/datos.js`

**Prioridad alta pese al número:** hasta que esto exista, los datos del usuario
solo viven en un navegador y un borrado accidental los pierde para siempre.

---

### T-017 · Importar un respaldo JSON — CU-08
**Estado:** Pendiente · **Depende de:** T-016
**Toca:** `src/datos/importar.js`, `test/importar.test.js`

Con la elección explícita entre *reemplazar todo* y *agregar*, y con exportación
sugerida antes de importar.

---

### T-018 · Exportar a CSV — CU-07
**Estado:** Pendiente · **Depende de:** T-005, T-016
**Toca:** `src/datos/exportar.js`

Con monto original, moneda, tipo de cambio aplicado e importe en euros. UTF-8 con
BOM (sin BOM, Excel rompe los acentos).

---

### T-019 · Verificación real sin conexión — CU-09
**Estado:** Pendiente · **Depende de:** T-011 a T-018
**Toca:** `docs/PRODUCTO.md` (marcar casos de uso hechos), `CHANGELOG.md`, `VERSION`

Recorrido completo con el modo avión activado, sobre `dist/viajecor.html` abierto
desde el disco, en un celular real. Se anota qué se probó y qué falló.

**No se marca `Hecha` por deducción.** Se marca cuando alguien lo hizo.

---

## Etapa 2 — Análisis

Las cuatro son independientes entre sí: cuatro agentes pueden tomar una cada uno.

### T-020 · Gasto día por día del mes — CU-05
**Depende de:** T-013 · **Toca:** `src/ui/pantallas/dias.js`

### T-021 · Evolución mes a mes — CU-10
**Depende de:** T-013 · **Toca:** `src/ui/pantallas/evolucion.js`, `src/core/calculos.js`

Matriz mes × rubro con fila de total y de promedio, como `Analisis1`.

### T-022 · Promedio de gastos fijos — CU-12
**Depende de:** T-013 · **Toca:** `src/ui/pantallas/fijos.js`

Agrupado por comentario: cuántas veces, total y promedio por pago.

### T-024 · Pantalla de monedas — CU-15
**Depende de:** T-008, T-010 · **Toca:** `src/ui/pantallas/monedas.js`

Ver las monedas, agregar una nueva (código, nombre, decimales) y ocultar las que
ya no se usan. Accesible también desde el formulario de carga, para cuando la
moneda que hace falta no está en la lista.

### T-023 · Gasto por viaje — CU-11
**Estado:** Necesita decisión · **Depende de:** T-013

**Preguntas abiertas para el usuario, antes de construir:**
1. ¿El viaje se elige de una lista que la app mantiene, o se sigue escribiendo a
   mano? Escribirlo a mano es lo que hoy hace que un typo saque gastos del total
   sin avisar.
2. ¿Cómo se cargan los vuelos y el alojamiento pagados antes del viaje? En el
   Excel están sumados a mano dentro de la fórmula (`=96+SUMIFS(...)` en París,
   `=850+...` en Costa Rica) y no hay registro de qué son.
3. ¿La duración del viaje se escribe, o se deduce de la primera y la última fecha
   con gastos de ese viaje?

---

## Etapa 3 — Traer el historial del Excel

### T-030 · Definir el mapeo Excel → modelo — CU-13
**Estado:** Pendiente · **Depende de:** T-003, T-009
**Toca:** `docs/MAPEO-EXCEL.md`

Escribir cómo se traduce cada columna de la planilla al modelo de la app, y qué se
hace con cada caso raro. Se trabaja contra `test/ejemplo/planilla-ejemplo.xlsx`,
que tiene la estructura real con montos inventados (T-009).

**Casos que el mapeo tiene que resolver, ya identificados:**
- Día (`C`) y mes (`D`) en columnas separadas → una sola fecha (RN-01).
- Rubro y tipo con mayúsculas inconsistentes → normalizar (RN-03).
- Filas sin monto: ¿se descartan o se importan en cero? Hay muchas en el original.
- Los bloques mensuales se repiten con encabezados en el medio: hay que saltearlos
  sin confundirlos con datos.
- Fechas como número de serie de Excel (`45931` = 2025-10-01), incluido el error
  histórico de que Excel considera 1900 bisiesto.
- El comentario (`B`) mezcla nombres de viaje y de gastos fijos recurrentes.

### T-031 · Lector de `.xlsx` sin librerías — CU-13
**Depende de:** T-009 · *Paralelizable con T-030*
**Toca:** `src/datos/xlsx.js`, `test/xlsx.test.js`

Leer un `.xlsx` en el navegador sin ninguna librería: abrir el ZIP a mano y
parsear el XML con `DOMParser`. Ver ADR-010 — está comprobado que se puede, sobre
la planilla real del usuario.

**Terminada cuando:** lee `test/ejemplo/planilla-ejemplo.xlsx` y devuelve las
celdas con su valor, distinguiendo texto, número y fecha.

### T-032 · Importador con informe de filas no interpretadas — CU-13
**Depende de:** T-030, T-031, T-017 · **Toca:** `src/datos/importar.js`

Fila por fila, qué no se pudo leer y por qué. Importar mal en silencio es peor
que no importar.

**También acepta CSV**, que es el formato de exportación de la app y sirve para
traer datos de otras fuentes.

---

## Etapa 4 — Ahorros conjuntos

### T-040 · Modelo de ahorros multimoneda — CU-14
**Depende de:** T-004 · **Toca:** `src/core/ahorros.js`, `test/ahorros.test.js`

Registro aparte: comentario, fecha, detalle, moneda, monto, persona (ALE/IRE),
tipo. **No se convierte a euros** — un plazo fijo en pesos uruguayos es en pesos
uruguayos.

### T-041 · Pantalla de ahorros conjuntos
**Depende de:** T-040, T-010 · **Toca:** `src/ui/pantallas/ahorros.js`

Total por moneda y total por persona y moneda.

---

## Independientes

Se pueden tomar en cualquier momento, no bloquean ni son bloqueadas.

- **T-900 · README de uso** — cómo descargar el HTML, guardarlo en el celular y
  usarlo sin conexión. Escrito para el usuario, no para un programador.
- **T-901 · Versionado y CHANGELOG** — el archivo `VERSION`, el `CHANGELOG.md` y
  la regla de `docs/PRODUCTO.md` §9 aplicada de verdad en cada publicación.
- **T-902 · Uso cómodo en celular** — botones grandes, teclado numérico al cargar
  montos, nada de texto de 11 píxeles. *(Depende de T-010.)*
- **T-903 · Recordatorio de respaldo** — la app avisa si hace mucho que no se
  exporta. Es la contramedida al riesgo más grave de la arquitectura.
  *(Depende de T-016.)*
- **T-904 · Modo oscuro** — *(Depende de T-010.)*

---

## Preguntas abiertas para el usuario

Se responden cuando el usuario quiera; hasta entonces las tareas que dependen de
ellas quedan `Necesita decisión`.

1. **Tipos de cambio históricos (RN-05).** Cambiar un tipo de cambio recalcula
   totales de meses ya cerrados. ¿Está bien así, o preferís que un movimiento
   quede congelado al tipo de cambio del momento en que lo cargaste?
2. **Viajes (T-023).** Las tres preguntas de esa tarea.

### Respondidas

- ~~**Monedas.**~~ (2026-08-18) Euro, peso uruguayo, dólar y colón costarricense,
  **y la lista tiene que poder ampliarse desde la app en cualquier momento**.
  → RN-04b, ADR-011, T-008, T-024.
- ~~**Historial.**~~ (2026-08-18) Los montos reales son confidenciales y no van al
  repositorio. Se trabaja contra una planilla de ejemplo con la misma estructura y
  montos inventados. → T-009.
- ~~**Formato de importación.**~~ (2026-08-18) Se lee el `.xlsx` directo, sin
  convertir a CSV. → ADR-010.
