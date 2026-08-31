# Plan de implementación — Viajecor

> **Este documento es la fuente de verdad del trabajo.** Cuando no hay una
> instrucción específica del usuario, lo que sigue es lo que dice este archivo.
> No hay una segunda lista en otro lado.
>
> Última actualización: 2026-08-19

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
| T-002 | Aritmética de dinero (`core/dinero.js`) | **Hecha** | T-001 |
| T-003 | Modelo y validación del movimiento | **Hecha** | T-002 |
| T-004 | Almacenamiento local | **Hecha** | T-003 |
| T-005 | Tipos de cambio y conversión a euros | **Hecha** | T-002, T-008 |
| T-006 | Formateo de montos y fechas | **Hecha** | T-002 |
| T-007 | Guardia automática de privacidad | **Hecha** | T-001 |
| T-008 | Catálogo de monedas | **Hecha** | T-002 |
| T-009 | Planilla de ejemplo para probar el importador | **Hecha** | — |
| **Etapa 1 — v0.1: registrar, ver y exportar** ||||
| T-010 | Armazón de la interfaz | **Hecha** | T-001 |
| T-011 | Pantalla de carga de movimiento | **Hecha** | T-003, T-004, T-010 |
| T-012 | Pedir el tipo de cambio al vuelo | **Hecha** | T-005, T-011 |
| T-013 | Cálculos del mes | **Hecha** | T-003, T-005 |
| T-014 | Pantalla de resumen del mes | **Hecha** | T-013, T-010, T-006 |
| T-015 | Lista de movimientos, editar y borrar | **Hecha** | T-011 |
| T-016 | Exportar a JSON | **Hecha** | T-004 |
| T-017 | Importar un respaldo JSON | **Hecha** | T-016 |
| T-018 | Exportar a CSV | **Hecha** | T-005, T-016 |
| T-019 | Verificación real sin conexión | **Hecha** (usuario, 2026-08-27) | T-011…T-018 |
| **Etapa 2 — Análisis** ||||
| T-020 | ~~Gasto día por día del mes~~ | **Descartada** (usuario, 2026-08-28) | — |
| T-021 | Evolución mes a mes | **Hecha** | T-013 |
| T-022 | Promedio de gastos fijos | **Hecha** | T-013 |
| T-023 | Gasto por viaje | **Hecha** | T-013, T-025 |
| T-024 | Pantalla de monedas | **Hecha** | T-008, T-010 |
| **Etapa 3 — Traer el historial del Excel** ||||
| T-030 | Definir el mapeo Excel → modelo | **Hecha** | T-003, T-009 |
| T-031 | Lector de `.xlsx` sin librerías | **Hecha** | T-009 |
| T-032 | Importador con informe de filas no interpretadas | **Hecha** | T-030, T-031, T-017 |
| **Etapa 4 — Ahorros conjuntos** ||||
| T-040 | Modelo de ahorros multimoneda | **Hecha** | T-004 |
| T-041 | Pantalla de ahorros conjuntos | **Hecha** | T-040, T-010 |
| T-042 | Importar la hoja de ahorros de la planilla | **Hecha** | T-040, T-031 |
| T-045 | Cargar, corregir y borrar ahorros desde la app | **Hecha** | T-041 |
| **Independientes** ||||
| T-900 | README de uso | **Hecha** | — |
| T-025 | Ver, renombrar y borrar los comentarios y detalles que ya existen | **Hecha** | T-015 |
| T-026 | Tocar un grupo y ver los movimientos que contiene | **Hecha** | T-015 |
| T-940 | Los dos gráficos de `Analisis1`, y la tabla en el orden del usuario | **Hecha** | T-021, T-918 |
| T-941 | Fechas del viaje, orden por fecha de fin, y «Etiqueta» en vez de «Comentario» | **Hecha** | T-023 |
| T-942 | Los dos gráficos del historial, interactivos: zoom, más marcas y tocar un punto | **Hecha** | T-940 |
| T-943 | Buscar texto en todos los movimientos | **Hecha** | T-015 |
| T-944 | Eje Y con marcas cada tanto, no solo el máximo | **Hecha** | T-942 |
| T-945 | Dentro de cada día, lo último cargado arriba | **Hecha** | T-015 |
| T-946 | Otros grupos de gastos: las etiquetas que no son ni gasto fijo ni viaje | **Hecha** | T-022, T-023 |
| T-947 | Los rubros de ingreso en la tabla mes a mes | **Hecha** | T-021 |
| T-948 | Publicar la app para poder usarla en un iPhone | **Hecha** | — |
| T-949 | Publicar en Vercel, con la CSP que hace cumplir el cero red | **Hecha** | T-948 |
| T-950 | Que la app publicada abra sin conexión | **Hecha** | T-949 |
| T-951 | El respaldo perdía las fechas de los viajes | **Hecha** | T-941 |
| T-901 | Versionado y CHANGELOG | Lista | — |
| T-902 | Uso cómodo en celular | Lista (empezada en T-010) | T-010 |
| T-903 | Recordatorio semanal de respaldo | **Hecha** | T-016 |
| T-904 | Modo oscuro | **Hecha** (venía de T-001) | T-010 |
| T-905 | Respaldo cómodo a la nube, sin red | **Hecha** (falta comprobarlo en el celular: T-019) | T-016 |
| T-909 | Color y rótulo propios por rubro | **Hecha** | T-014 |
| T-907 | Decimales sugeridos por moneda (ISO 4217) | Lista | T-008 |
| T-908 | Reescalar los montos al corregir los decimales | Lista | T-008 |
| T-906 | Exportar a `.xlsx` con la forma de la planilla | **Hecha** (falta abrirlo en Excel de verdad: T-019) | T-016, T-018 |
| T-910 | Hoja de análisis mes × rubro dentro del `.xlsx` | **Hecha** | T-906, T-021 |
| **T-950** | **Avisar cuando el navegador no puede guardar** | **Hecha** | T-004 |
| T-911 | La barra del desglose mide el porcentaje real | **Hecha** | T-014 |
| T-912 | Orden de campos y autocompletado del comentario | **Hecha** | T-011 |
| T-913 | "Cargar" es la primera pestaña | **Hecha** | T-010 |
| T-914 | Recordar que compartir no funciona en este teléfono | **Hecha** | T-905 |
| T-915 | Todos los rubros en cada mes del `.xlsx`, aunque estén en cero | **Hecha** | T-906 |
| T-916 | La planilla se parece de verdad a la original | **Hecha** | T-906, T-915 |
| T-917 | ~~Los dos gráficos del `.xlsx`~~ | **Descartada** (usuario, 2026-08-27) | — |
| T-922 | Los colores de rubro, lo más parecidos a la planilla | **Hecha** | T-909 |
| T-918 | Los dos gráficos del mes, en la app | **Hecha** | T-013, T-909, T-922 |
| T-919 | Verificar en el celular lo hecho después de T-019 | **Hecha** (usuario, 2026-08-28) | T-950, T-911…T-916 |
| T-920 | Sugerencias propias, sin depender del navegador | **Hecha** | T-912 |
| T-921 | Sacar el texto de "compartir no funciona" | **Hecha** | T-914 |

**Lo próximo: la etapa 3.** Con la etapa 1 cerrada (2026-08-27), la app hace todo
lo que hacía el Excel — pero **está vacía**, y el historial del usuario sigue
desde octubre de 2025 en la planilla. Traerlo es una tarea de una sola vez, y
hasta que se haga la app no reemplaza a nada: obliga a mirar dos lugares.

Además, **la etapa 2 vale mucho más después**: un promedio de gastos fijos o una
evolución mes a mes sobre tres gastos de prueba no dicen nada; sobre once meses
reales, son la razón por la que existe la app. Se hace la etapa 3 primero.

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
**Estado:** Hecha (2026-08-18) · **Depende de:** T-001
**Toca:** `src/core/dinero.js`, `test/dinero.test.js`, `tools/build.mjs`

Montos como enteros en unidad mínima (`docs/ARQUITECTURA.md` §5.1). Interpretar lo
que escribe el usuario, sumar, convertir con un tipo de cambio, promediar, y
redondear una sola vez al final.

**Cuántos decimales tiene cada moneda no lo decide este módulo:** lo recibe como
parámetro, porque la lista de monedas la maneja el usuario (RN-04b, ADR-011). Una
tabla acá se desactualizaría en cuanto se agregue una moneda nueva.

**Terminada cuando:**
- [x] 35 tests propios, todos pasando. Cubren el redondeo hacia arriba y hacia
      abajo, `0.1 + 0.2`, una moneda sin decimales, y montos negativos rechazados.
- [x] Los cálculos se comprobaron **dentro de `dist/viajecor.html`**, no solo en
      el código fuente: el build quita los `export` y pega todo en un ámbito
      único, y esa transformación podría romper algo que los tests de Node no ven.

**Lo que salió de hacerla:** la regla para interpretar el separador decimal leía
`"12,345"` como 12.345 € en vez de rechazarlo — un error de mil veces, en
silencio. Lo encontró un test escrito para otra cosa. Ver ADR-012 y L-008.

---

### T-003 · Modelo y validación del movimiento
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002
**Toca:** `src/core/modelo.js`, `test/modelo.test.js`, `tools/build.mjs`

Crear un movimiento válido, normalizar textos (RN-03), validar fecha (RN-01) y
la correspondencia tipo↔rubro (RN-02). Las listas de rubros viven acá, tal como
están en `docs/PRODUCTO.md` §4.

**Terminada cuando:**
- [x] Hay tests para `VIAJES`/`viajes`/` Viajes ` como el mismo rubro, para un
      rubro de ingreso rechazado en un gasto, y para monto cero o negativo
      rechazado. Son 43 tests nuevos; los 81 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el código a propósito en tres
      puntos (sin `normalize('NFC')`, sin comprobar que el día exista, con
      identificadores de 4 bytes). Cada rotura hizo fallar tests.
- [x] El modelo se ejercitó **dentro de `dist/viajecor.html`**, no solo en el
      código fuente: el build borra los `import`/`export` y pega todo en un
      ámbito único, y esa transformación podría romper algo que los tests de Node
      no ven.

**Lo que salió de hacerla:**
- Dos textos idénticos en pantalla pueden ser distintos para la máquina, sin
  ningún síntoma visible. Ver L-009.
- El comentario se guarda como se escribió y se agrupa por una clave aparte, para
  que la app pueda mostrar `Roma` y no `roma`. Ver ADR-013.
- Crear un movimiento e interpretar uno ya guardado son dos puertas separadas,
  porque `1250` significa cosas distintas en cada una. Ver ADR-014.
- El identificador usa 16 dígitos hexadecimales y no 8: con 8, la probabilidad de
  que dos movimientos compartan identificador ronda el 10% a los 30.000
  movimientos. Se corrigió el ejemplo de `docs/ARQUITECTURA.md` §5.

---

### T-004 · Almacenamiento local
**Estado:** Hecha (2026-08-19) · **Depende de:** T-003
**Toca:** `src/datos/almacenamiento.js`, `test/almacenamiento.test.js`, `tools/build.mjs`

Leer y escribir el estado completo bajo `viajecor:datos:v1`, con el número de
esquema y un lugar previsto para migrar si cambia.

**Terminada cuando:**
- [x] Hay tests con un `localStorage` simulado que cubren primer arranque sin
      datos, ida y vuelta de guardar y leer, y datos corruptos que no tumban la
      app. Son 25 tests; los 106 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo a propósito en los
      cuatro puntos peligrosos (pisar lo ilegible, descartar registros rotos en
      silencio, no reconocer el almacenamiento lleno, leer datos de una versión
      más nueva). Cada rotura hizo fallar tests.
- [x] El recorrido real —cargar un gasto, guardarlo, volver a leerlo— se ejercitó
      **dentro de `dist/viajecor.html`**, con un `localStorage` simulado.

**Lo que salió de hacerla:** tres decisiones sobre qué hacer cuando los datos no
se entienden, que es donde este módulo se puede llevar puestos meses de registro.
Ver ADR-015 (lo ilegible se aparta, nunca se pisa), ADR-016 (leer se degrada,
guardar grita) y ADR-017 (un registro roto no invalida a los demás).

**Lo que este módulo NO hace, a propósito:** el estado inicial viene con la lista
de monedas **vacía**. Las cuatro precargadas (RN-04b) las define `core/monedas.js`
en T-008; tenerlas también acá serían dos listas que se desincronizan. Quien arme
el estado inicial le pasa la lista.

---

### T-005 · Tipos de cambio y conversión a euros
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002, T-008
**Toca:** `src/core/cambio.js`, `test/cambio.test.js`, `tools/build.mjs`

Guardar y buscar el tipo de cambio por `(moneda, mes)`, convertir un movimiento a
euros (RN-04, RN-05), y responder "¿falta el tipo de cambio para esto?".

**Terminada cuando:**
- [x] Hay tests para euro sin conversión, para una moneda con dos meses de tipos
      distintos, para tipo de cambio faltante, y para el cálculo inverso
      ("cuántos colones es un euro" → guardado como euros por colón). Son 26
      tests; los 156 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo en cuatro puntos
      —contar como cero lo que no se puede convertir, ignorar el mes, no invertir
      el cálculo inverso, duplicar en vez de reemplazar—. Cada rotura hizo fallar
      tests.
- [x] El recorrido de un viaje a Costa Rica —cargar en colones, que la app pida
      el tipo de cambio, escribirlo como "un euro son 630 colones", y ver el
      total en euros— se ejercitó **dentro de `dist/viajecor.html`**.

**Lo que salió de hacerla:** ADR-020, sobre en qué momento se redondea al sumar
monedas distintas. El total es la suma de lo que se ve en pantalla, aunque el
otro camino sea aritméticamente más exacto.

**Decisiones que ya estaban y este módulo hace cumplir:**
- Un movimiento sin tipo de cambio **no se cuenta como cero**: tira. Un
  movimiento que vale cero desaparece de un total sin dejar rastro.
- El importe en euros **no se guarda**, se deriva (RN-05). Por eso corregir un
  tipo de cambio arregla el mes entero, y por eso hay que avisar cuántos
  movimientos toca antes de aplicarlo.

---

### T-006 · Formateo de montos y fechas
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002
**Toca:** `src/core/formato.js`, `test/formato.test.js`, `tools/build.mjs`

Mostrar `1250` como `12,50 €` en formato español, y las fechas de forma legible.
Sin librerías: `Intl` viene en el navegador.

**Terminada cuando:**
- [x] Montos, fechas, meses, días de la semana y tipos de cambio se muestran en
      español. Son 19 tests; los 175 del proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo en tres puntos —no
      cuidar la zona horaria, dejar que `Intl` decida los decimales, mostrar el
      tipo de cambio siempre con dos decimales—. Cada rotura hizo fallar tests.
- [x] Se ejercitó **dentro de `dist/viajecor.html`**: `14/03/2026 · 12.500,00 CRC
      · 19,84 € · 1 EUR = 630,00 CRC`.

**Lo que salió de hacerla:** L-011, la zona horaria corriendo una fecha de día.
En Montevideo, el 14 de marzo se mostraba como 13 de marzo.

**Tres cosas que quedaron decididas y conviene no deshacer:**
- Los decimales de un monto los manda el catálogo del usuario, **no `Intl`**, que
  tiene su propia idea para cada moneda. Si `Intl` decidiera, una moneda que el
  usuario configuró distinto se mostraría con otros decimales de los que se
  guardó: el número correcto por dentro y la pantalla mintiendo.
- Los números de cuatro cifras van **sin** punto de miles (`1234,56 €`) y a partir
  de cinco lo llevan (`12.345,67 €`). Es la norma del español, no un olvido.
- El espacio entre el importe y el símbolo es un **espacio duro** (U+00A0), para
  que no queden en renglones distintos. Se ve igual que un espacio común y no lo
  es — L-009 otra vez, ahora del lado de la presentación.

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
**Estado:** Hecha (2026-08-19) · **Depende de:** T-002
**Toca:** `src/core/monedas.js`, `test/monedas.test.js`, `tools/build.mjs`

La lista de monedas vive en los datos, no en el código (RN-04b, ADR-011). Este
módulo la maneja: las cuatro precargadas (`EUR`, `UYU`, `USD`, `CRC`), agregar una
nueva con código, nombre y decimales, validar, y ocultar en vez de borrar cuando
ya tiene movimientos.

**Terminada cuando:**
- [x] Hay tests para código repetido rechazado, para el euro que no se puede
      borrar ni cambiar de decimales, para una moneda de 0 decimales, y para el
      rechazo de borrar una moneda con movimientos. Son 24 tests; los 130 del
      proyecto pasan.
- [x] Los tests **muerden**: comprobado rompiendo el módulo a propósito en cinco
      puntos. Cada rotura hizo fallar tests.
- [x] El recorrido de un gasto en una moneda nueva se ejercitó **dentro de
      `dist/viajecor.html`**.

**Lo que salió de hacerla:** preguntar los decimales de una moneda que no está en
la lista **tira**, no supone 2. Ver ADR-018.

**Lo que este módulo NO hace:** guardar. Recibe la lista y devuelve una lista
nueva, sin modificar la que recibe; quien persiste es `datos/almacenamiento.js`.

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
**Estado:** Hecha (2026-08-19) · **Depende de:** T-001
**Toca:** `src/ui/app.js`, `src/estilos.css`, `src/core/modelo.js`, `test/app.test.js`

Navegación entre pantallas, encabezado con el mes visible y la versión, y los
estilos base pensados para celular.

**Terminada cuando:**
- [x] Tres pantallas registradas (Mes, Movimientos, Datos) con marcadores que
      dicen qué van a tener y qué tarea las trae, más el botón de cargar. 22
      tests; los 202 del proyecto pasan.
- [x] El mes se cambia con flechas desde el encabezado, y el selector **no** se
      dibuja en las pantallas que no son de un mes.
- [x] Los avisos que produce `almacenamiento.js` al leer se muestran arriba de
      todo. Que ese cuidado llegue a la pantalla era la mitad de su sentido.
- [x] **Comprobado en un navegador real**, no deducido: `dist/viajecor.html`
      abierto desde el disco en Chromium, pantalla de celular (390×844), zona
      horaria de Montevideo. Navegación entre las tres pantallas y cambio de mes
      funcionando, **0 peticiones a internet y 0 errores de consola**.

**Lo que salió de hacerla:**
- ADR-022: la interfaz se parte en funciones puras que devuelven texto y una sola
  función que toca el documento.
- La aritmética de meses (`mesAnterior`/`mesSiguiente`) se hace con números y no
  moviendo un `Date`: a un `Date` del 31 de marzo restarle un mes da el **3 de
  marzo**, porque febrero no tiene 31 días. Comprobado, y hay un test que lo
  documenta.
- El modo oscuro ya funcionaba desde T-001 (`prefers-color-scheme`), así que
  T-904 queda hecha sin trabajo propio.

**Lo que T-011 se va a topar:** el armazón redibuja todo con `innerHTML` en cada
cambio. Para un formulario a medio llenar eso borraría lo escrito, así que la
pantalla de carga va a tener que dibujar solo el trozo que cambia. Está anotado
en ADR-022.

---

### T-011 · Pantalla de carga de movimiento — CU-01, CU-02
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-003, T-004, T-010
**Toca:** `src/ui/pantallas/movimiento.js`, `src/ui/app.js`, `src/estilos.css`, `test/movimiento.test.js`, `tools/build.mjs`

Formulario con fecha (hoy por defecto), tipo, monto, moneda (la última usada),
rubro, comentario y detalle. Guarda y vuelve a la lista.

**Enchufado que le toca a esta tarea:** el estado de un primer arranque sale de
`estadoInicial()` (T-004) con la lista de `monedasIniciales()` (T-008) — el
almacenamiento no la trae solo, a propósito. Y los decimales que necesita
`crearMovimiento()` salen de `decimalesDe(monedas, codigo)`, nunca de un 2
escrito a mano.

**Terminada cuando:**
- [x] Se puede cargar un gasto y un ingreso, quedan guardados **después de
      recargar la página**, y los errores de validación se muestran claros.
      **Comprobado en un navegador real**, no deducido: se cargaron un gasto y un
      ingreso en Chromium desde el disco, se recargó la página y los dos
      seguían ahí, con los montos guardados como enteros (1250 y 210000).
      0 peticiones a internet, 0 errores de consola. 27 tests; 230 en total.
- [x] Un error de validación **no borra lo escrito**. Comprobado en el navegador:
      tras rechazar `"1.234"`, el comentario y el monto seguían en su lugar.
- [x] Un movimiento en moneda extranjera sin tipo de cambio no se guarda, y el
      mensaje dice de qué moneda y de qué mes, en español.

**Lo que salió de hacerla:** L-012 (un formulario que borra lo escrito al fallar
enseña a no usarlo) y ADR-023 (lo escrito vive en el documento, no en el estado).

**Lo que NO hace, y le toca a otra tarea:**
- Cuando falta el tipo de cambio, avisa pero **no lo pide**: eso es T-012.
- Muestra los últimos cinco cargados solo para confirmar que entraron. La lista
  de verdad, con editar y borrar, es T-015.

**Sin comprobar en un dispositivo real:** el campo de fecha usa `input type=date`,
que cada navegador dibuja a su manera. En el Chromium de prueba salió en formato
americano (`08/25/2026`) porque el navegador estaba en inglés; en un celular en
español debería salir `25/08/2026`, pero **eso hay que verlo en el celular**, no
deducirlo. Es parte de T-019.

---

### T-012 · Pedir el tipo de cambio al vuelo — CU-03
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-005, T-011
**Toca:** `src/ui/pantallas/cambio.js`, `src/ui/pantallas/movimiento.js`, `src/ui/app.js`, `src/estilos.css`, `test/pantalla-cambio.test.js`, `tools/build.mjs`

Al guardar un movimiento en una moneda sin tipo de cambio para ese mes, pedirlo
antes de guardar, aceptando el valor en cualquiera de los dos sentidos. Más una
pantalla para ver y corregir tipos de cambio, que avisa cuántos movimientos
afecta una corrección.

**Terminada cuando:**
- [x] Al cargar el primer gasto en una moneda nueva, la app interrumpe, pide el
      tipo de cambio y **el gasto se guarda solo** al cargarlo. 25 tests; 257 en
      total.
- [x] El valor se escribe como se conoce ("1 EUR son 630 CRC") y se guarda
      invertido, con el sentido escrito al lado del campo. Los tests muerden:
      guardarlo sin invertir hace fallar 6 tests.
- [x] Corregir uno ya usado avisa **a cuántos movimientos afecta y en cuánto
      cambia el total del mes**, antes de aplicarlo (RN-05).
- [x] **Recorrido completo en un navegador real**, terminando con una recarga:
      12.500 colones cargados con la app pidiendo el cambio, un segundo gasto que
      ya no interrumpe, y una corrección de 630 a 500 que sobrevivió a recargar.
      0 peticiones a internet, 0 errores de consola.

**Lo que salió de hacerla, y es lo más valioso:** el recorrido en el navegador
encontró **dos errores que los 257 tests no veían**, los dos en el enganche. Ver
L-014. Uno mostraba siempre un aviso pobre sin los números; el otro **perdía en
silencio** la corrección de un tipo de cambio cuando no había ningún gasto
esperando — la pantalla decía que se aplicó y al recargar volvía el valor viejo.

---

### T-013 · Cálculos del mes — CU-04
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-003, T-005
**Toca:** `src/core/calculos.js`, `test/calculos.test.js`, `src/ui/pantallas/movimiento.js`, `tools/build.mjs`

Funciones puras: total de gastos, de ingresos y saldo de un mes; desglose por
rubro; serie por día. Todo en euros.

**Terminada cuando:**
- [x] Hay tests con movimientos en más de una moneda y en más de un mes,
      comprobando que ninguno se cuenta en el mes equivocado — con los bordes,
      que es donde falla: el día 1 y el último día. 29 tests; 286 en total.
- [x] Los tests **muerden**: comprobado rompiendo el módulo en cinco puntos,
      incluido copiarle al Excel su tope de 1027 filas. Cada rotura hizo fallar
      tests.
- [x] Un test suma **2000 movimientos**, a propósito por encima de la fila donde
      la planilla original empieza a dar de menos (L-001).
- [x] Los números **cierran entre sí**: el desglose por rubro suma exactamente el
      total de gastos, y el día por día también. Si no cerraran, el usuario vería
      dos números distintos sin forma de saber cuál creer.
- [x] Comprobado **dentro de `dist/viajecor.html`** y además cargando un mes real
      por la pantalla: 122,24 € de gastos, que da igual hecho a mano, y el gasto
      de abril no se coló en marzo.

**Lo que salió de hacerla:**
- Un movimiento que **no se puede convertir a euros** (falta su tipo de cambio)
  no se cuenta como cero ni se descarta: sale aparte en `sinConvertir`, para que
  la pantalla pueda decir que el total está incompleto. Un total al que le falta
  un gasto y que no lo dice es peor que no mostrar ningún total. **T-014 tiene
  que mostrarlo.**
- El promedio por día divide por los **días transcurridos**, no por los del mes.
  A mitad de mes, dividir por 31 da un promedio artificialmente bajo.
- `movimientosDelMes()` estaba duplicado en la pantalla de carga y se movió acá:
  filtrar por mes es un cálculo, y dos copias de la misma regla terminan diciendo
  cosas distintas (L-005 aplicada al código).

---

### T-014 · Pantalla de resumen del mes — CU-04
**Estado:** Hecha (2026-08-19) · **Depende de:** T-013, T-010, T-006
**Toca:** `src/ui/pantallas/resumen.js`, `src/ui/app.js`, `src/estilos.css`, `test/resumen.test.js`, `test/app.test.js`, `tools/build.mjs`

Gastos, ingresos y saldo del mes; el desglose por rubro de mayor a menor; y el
promedio por día. Todo en euros.

**Terminada cuando:**
- [x] Los tres números, el desglose de gastos y el de ingresos. 21 tests; 307 en
      total.
- [x] **Si falta un tipo de cambio, la pantalla dice que el total está
      incompleto** y ofrece cargarlo. Era la obligación que dejaba T-013: sin
      esto, apartar los movimientos no convertibles no habría servido de nada.
- [x] Los tests **muerden**: comprobado rompiendo la pantalla en cuatro puntos
      —tragarse el aviso de incompleto, pintar más oscuro el rubro más grande,
      mostrar tres ceros en un mes vacío, promediar el mes en curso sobre el mes
      entero—. Cada rotura hizo fallar tests.
- [x] **Recorrido en un navegador real** con un mes cargado por la pantalla:
      323,14 € de gastos, que da igual hecho a mano, y los porcentajes suman 100.
      0 peticiones a internet, 0 errores de consola.

**Decisiones de presentación, con su motivo:**
- Los tres números son **números destacados, no un gráfico**: tres barras para
  tres cifras que ya se leen de un vistazo agregan trabajo visual y ninguna
  información.
- Las barras del desglose son **todas del mismo color**. Pintar más oscuro al
  rubro más grande codifica dos veces lo mismo —el largo ya lo dice— y le pone
  colores distintos a categorías que no significan nada distinto.
- Los importes de la tabla llevan cifras de ancho fijo; **los tres números
  grandes no**, porque en un número grande el ancho fijo abre huecos entre los
  dígitos y se lee peor.
- **Con un solo rubro no se dibuja la barra ni el porcentaje**: serían una barra
  siempre llena y un 100 % siempre igual. Se vio mirando la pantalla, no en un
  test.
- El saldo lleva el signo **en el número**, no solo en el color.

**Lo que salió de mirar la pantalla:** decía "10,42 € por día por día en el
mes" — la palabra repetida. Ningún test lo veía porque ninguno leía la frase
entera.

---

### T-015 · Lista de movimientos, editar y borrar — CU-06
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-011
**Toca:** `src/ui/pantallas/lista.js`, `src/ui/pantallas/movimiento.js`, `src/ui/app.js`, `src/estilos.css`, `test/lista.test.js`, `tools/build.mjs`

Con confirmación y deshacer al borrar. Borrar sin red de contención es la forma
más fácil de perder datos que el usuario no puede recuperar.

**Terminada cuando:**
- [x] La lista del mes, agrupada por día, del más nuevo al más viejo. Corregir y
      borrar en cada movimiento. 24 tests; 336 en total.
- [x] **Dos redes al borrar**, no una: confirmar antes y deshacer después. La
      segunda es la que de verdad sirve — la primera frena los accidentes, la
      segunda frena los arrepentimientos, que son más frecuentes.
- [x] Deshacer devuelve el movimiento a **su lugar exacto**, no al final de la
      lista: quien deshace espera encontrar todo como lo tenía.
- [x] Corregir pasa por la **misma puerta** que crear, conservando identificador
      y día de carga: es el mismo movimiento con otros datos, no uno nuevo.
- [x] Los tests **muerden**: cuatro roturas a propósito, cada una hizo fallar
      tests.
- [x] **Recorrido completo en un navegador real**, terminando con una recarga:
      corregir 999,99 → 99,90 sin duplicar, decir que no a un borrado, borrar,
      deshacer, y comprobar que el orden volvió a ser el original. 0 peticiones a
      internet, 0 errores de consola.

**Decisión que vale anotar:** si el navegador no puede escribir al borrar, **el
movimiento no se saca de la pantalla**. Decir "borrado" sobre un dato que sigue
guardado sería mentir en la dirección más confusa posible: el usuario creería
haberlo perdido y volvería a encontrarlo al recargar.

---

### T-016 · Exportar a JSON — CU-07
**Estado:** En curso (claude, 2026-08-19) · **Depende de:** T-004
**Toca:** `src/datos/exportar.js`, `test/exportar.test.js`, `src/ui/pantallas/datos.js`, `src/ui/app.js`, `src/estilos.css`, `tools/build.mjs`

**Prioridad alta pese al número:** hasta que esto exista, los datos del usuario
solo viven en un navegador y un borrado accidental los pierde para siempre.

**Terminada cuando:**
- [x] El respaldo lleva **todo** —movimientos, tipos de cambio, monedas y
      preferencias—, no lo que se está mirando. 25 tests; 361 en total.
- [x] Lo exportado **se puede volver a leer sin perder nada**: hay un test de ida
      y vuelta que compara el estado entero.
- [x] El archivo **se explica solo**: dice qué aplicación lo escribió, cuándo y
      con qué formato, y va con sangría para poder leerlo con cualquier editor.
- [x] **Comprobado que descarga de verdad desde `file://`**, que era lo que podía
      fallar: el navegador guardó `viajecor-2026-08-27.json` y el archivo en
      disco tenía los 3 movimientos con sus montos correctos.
- [x] La pantalla dice **cuánto hace que no respaldás**, siempre, y lo destaca a
      partir de la semana.

**La decisión que más importa: hay DOS caminos para el mismo respaldo.** Además de
descargar el archivo, se puede ver el texto y copiarlo. No es una curiosidad: la
app se abre desde un archivo del disco, y ahí las descargas dependen del navegador
y del sistema. **Un respaldo que solo funciona si el navegador coopera no es un
respaldo.** Si la descarga falla, la app abre el texto sola.

**Lo que salió de hacerla:** L-015. `ultimo_respaldo` se guardaba bien y
desaparecía al recargar, porque las preferencias se leen de a una y esa no estaba
en la lista. El síntoma era el peor posible: funcionaba con la app abierta. Lo
encontró el recorrido en el navegador terminando con una recarga.

---

### T-017 · Importar un respaldo JSON — CU-08
**Estado:** **Hecha** · **Depende de:** T-016
**Toca:** `src/datos/importar.js`, `test/importar.test.js`, `src/ui/pantallas/datos.js`, `src/ui/app.js`, `src/estilos.css`, `tools/build.mjs`

Con la elección explícita entre *reemplazar todo* y *agregar*, y con exportación
sugerida antes de importar.

**Cómo quedó.** Tres pasos y no uno: elegir el archivo (o pegar el texto), **ver
qué va a pasar con números concretos**, y recién ahí elegir. Es la única
operación de la app que puede destruir datos que el usuario no está mirando, y
la hace alguien convencido de que está recuperando datos.

- `leerRespaldo()` **nunca tira**: devuelve el resultado o el motivo en
  castellano, porque quien recupera datos tiene que poder entender qué falló y
  reintentar. Pasa por `migrarEstado()`, la misma puerta que los datos guardados
  (ADR-017): un archivo editado a mano no puede meter nada que el
  almacenamiento no aceptaría.
- `previsualizar()` no toca nada. Da los números que hacen entendible la
  diferencia entre los dos caminos, incluido **cuántos movimientos se perderían
  al reemplazar** — el número que nadie mira y el que más duele.
- **Agregar no duplica** (por identificador): importar dos veces el mismo
  respaldo deja lo mismo que importarlo una vez.
- Los tipos de cambio y las monedas del respaldo **se suman** a los que hay,
  dando prioridad a lo que el usuario ya tenía (pudo haberlos corregido después
  de exportar). Sin esto, un movimiento en colones entraría sin poder
  convertirse a euros.
- La fecha del último respaldo pasa a ser la más reciente entre la del
  dispositivo y la del archivo (ADR-024).

**Verificado:** 388 tests en verde. Ocho mutaciones deliberadas, ocho detectadas.
Recorrido en un navegador real desde el disco, terminando con una recarga: se
simuló un teléfono nuevo (borrar todo → pegar el respaldo → agregar → recargar),
se pegó el mismo respaldo dos veces sin duplicar nada, se pegó basura y un JSON
que no es un respaldo, se canceló una previa sin que se tocara el estado, y se
reemplazó. El recorrido encontró dos defectos que los tests no veían — un botón
*Agregar* que se ofrecía cuando no entraba ningún movimiento, y "se borrarían 1
movimiento" — arreglados, con tests que los cubren (L-016).

---

### T-018 · Exportar a CSV — CU-07
**Estado:** **Hecha** · **Depende de:** T-005, T-016
**Toca:** `src/datos/csv.js`, `test/csv.test.js`, `src/ui/pantallas/datos.js`, `src/ui/app.js`

Con monto original, moneda, tipo de cambio aplicado e importe en euros. UTF-8 con
BOM (sin BOM, Excel rompe los acentos).

**Cómo quedó.** El `.xlsx` es para **mirar** y el CSV es para **procesar**: una
fila por movimiento, todas las columnas, sin adornos. Por eso el CSV lleva el
monto original con su moneda, **el tipo de cambio que se aplicó** y el importe en
euros, mientras la planilla lleva solo euros. Un CSV que redondea es un CSV que
miente; una planilla con monedas mezcladas en una columna es una planilla que no
se puede sumar. Cada formato pierde lo que al otro le sobra.

**Un CSV mal exportado no falla: se abre y muestra cosas equivocadas.** Es la
forma de fallar más cara que hay, y depende de tres detalles que nadie mira:

1. **El separador es `;`.** En español la coma es el separador decimal: `12,50`
   con separador coma se parte en dos columnas, `12` y `50`.
2. **El archivo lleva BOM.** Sin esos tres bytes, Excel en Windows lo abre con la
   codificación del sistema y `Coruña` se convierte en `CoruÃ±a` — que es un
   comentario **distinto**, así que sin la marca los grupos se parten en dos
   apenas se vuelve a leer el archivo.
3. **Los saltos son `\r\n`.** Con solo `\n`, hay versiones de Excel que meten
   todo en una fila.

Y el entrecomillado, que es lo mismo por otro lado: un comentario con un `;`
adentro corre todas las columnas de esa fila una posición, y el archivo se abre
igual — mal, y sin avisar.

**El tipo de cambio va en su columna** porque es el de **ese mes**, no el de hoy.
Sin ese dato el importe en euros es un número que no se puede volver a
comprobar. En euros la columna va vacía: un `1` repetido en el 90 % de las filas
es ruido que invita a creer que significa algo.

**Verificado:** 557 tests. Nueve mutaciones, nueve detectadas. Y el archivo
**descargado desde el navegador** leído con el módulo `csv` de Python, que no es
código de este proyecto: cuatro filas, el `;` de un comentario sin correr las
columnas, las comillas intactas, los acentos enteros, y los primeros tres bytes
`EF BB BF`.

---

### T-019 · Verificación real sin conexión — CU-09
**Estado:** **Hecha** — la hizo el usuario en su Android el 2026-08-27 ·
**Depende de:** T-011 a T-018
**Toca:** `docs/PRODUCTO.md` (marcar casos de uso hechos), `CHANGELOG.md`, `VERSION`

Recorrido completo con el modo avión activado, sobre `dist/viajecor.html` abierto
desde el disco, en un celular real. Se anota qué se probó y qué falló.

**No se marca `Hecha` por deducción.** Se marca cuando alguien lo hizo.

**Lo que esta tarea tiene que comprobar y nadie más puede:**
- Que el botón *Compartir el respaldo* **aparezca** en el Android del usuario
  (T-905), y que al apretarlo salga el menú del sistema con OneDrive.
- Que el archivo compartido **llegue entero** a OneDrive y se pueda volver a
  importar desde ahí (T-017). Compartir "sin error" no es lo mismo que llegar.
- Que la descarga funcione desde `file://` en ese teléfono, que es la salida
  cuando el compartir no está.
- Que los datos **sobrevivan a cerrar y reabrir** el navegador del teléfono.

**Lo que pasó (usuario, 2026-08-27).** Ocho pasos, en un Android con Chrome:

| Qué | Resultado |
|---|---|
| Bajar la app de GitHub y abrirla | Anda, pero la dirección queda como `content://` |
| Modo avión, recorrido completo | **Todo igual.** La app no necesita conexión |
| Cargar, cerrar Chrome, reabrir | **Se perdió todo.** → T-950 |
| Abrir por `file:///sdcard/Download/viajecor.html` | **Resuelto.** Los datos sobreviven |
| Compartir el respaldo | **Falla** con `Permission denied` → T-914 |
| Descargar el respaldo y subirlo a mano | Anda |
| Borrar los datos del sitio y recuperar del respaldo | **Anda perfecto** |
| Abrir el `.xlsx` | **Abre bien** — lo que no se pudo comprobar en el entorno |
| Bajar una versión nueva del HTML sin perder datos | Anda |

**Las tres cosas que esto enseñó, y que ningún test podía enseñar:**

1. **La app necesita una instrucción de uso, no solo un archivo.** Abrirla mal
   —desde el explorador de archivos— hace que pierda todo. Va a `docs/USO.md`
   (T-900), y la app misma lo avisa desde T-950.
2. **Preguntarle al navegador si puede hacer algo no es lo mismo que poder.**
   `canShare({files})` dijo que sí y `share()` falló. → T-914.
3. **Lo que se ve en una planilla no es lo que se ve en una pantalla.** El
   desglose por rubro quiere filas en cero en el Excel y no las quiere en el
   celular. → T-915.

**Lo que queda abierto de esta verificación:** el usuario pidió que la planilla
se parezca **más** a su Excel actual, sin especificar en qué. Hay que preguntar
antes de tocar nada: adivinar la forma de una planilla que él conoce de memoria
y yo no vi nunca es la manera más rápida de hacer trabajo que no sirve.

---

## Etapa 2 — Análisis

Las cuatro son independientes entre sí: cuatro agentes pueden tomar una cada uno.

### T-020 · ~~Gasto día por día del mes~~ — CU-05 · **descartada**

**Decidido por el usuario (2026-08-28), después de ver la línea de T-918:** *"no
hace falta que sea visible la tabla del gasto acumulado día por día, eso era solo
una herramienta para crear el gráfico"*.

En el Excel el bloque `GASTO POR DÍA` era una tabla porque el Excel no tenía otra
forma de llegar al gráfico: había que escribir los números para poder dibujarlos.
En la app el cálculo (`porDia` en `core/calculos.js`) alimenta la línea
directamente, así que la tabla intermedia no tiene lector. Copiarla igual habría
sido copiar el andamio junto con el edificio.

`porDia` se queda: la usa la línea y la va a usar T-021.

### T-021 · Evolución mes a mes — CU-10 — **Hecha** (2026-08-28)
**Depende de:** T-013 · **Tocó:** `src/ui/pantallas/evolucion.js` (nuevo),
`src/core/calculos.js`, `src/core/formato.js`, `src/ui/app.js`, `estilos.css`

Matriz mes × rubro con fila de total y de promedio, como `Analisis1`.

**Lo que quedó hecho, comprobado:**

- `matrizMesRubro()` en `core/`: una fila por mes —**sin saltear los vacíos**—,
  los **ocho rubros siempre**, y las columnas de gastos, ingresos y saldo.
- **El promedio deja afuera el mes en curso; el total lo incluye**, y la pantalla
  lo escribe abajo de la tabla con el mes que dejó afuera nombrado. Es L-006
  resuelta: en el Excel esa diferencia existía y no estaba explicada en ningún
  lado. Ver ADR-031.
- Un mes al que le falta un tipo de cambio sale marcado y explicado.
- Se llega desde el resumen del mes, no desde una quinta pestaña.
- 25 tests nuevos. Ocho mutaciones a propósito: las ocho fallan.
- Vuelta por el navegador con **once meses** cargados, en claro y en oscuro: 11
  filas, 12 columnas, la página **no** desborda a lo ancho, la tabla sí se
  desliza dentro de su caja, y la columna del mes **se queda en el mismo píxel**
  después de correr 400. 0 peticiones de red, 0 errores de consola.
- Apareció L-025: la pantalla le preguntaba la hora al reloj y por eso su test
  más importante pasaba por el motivo equivocado.

### T-022 · Promedio de gastos fijos — CU-12 — **Hecha** (2026-08-28)
**Depende de:** T-013 · **Tocó:** `src/ui/pantallas/fijos.js` (nuevo),
`src/core/calculos.js`, `evolucion.js`, `resumen.js`, `estilos.css`

Agrupado por comentario: cuántas veces, total y promedio por pago.

**Lo que quedó hecho, comprobado:**

- `gastosFijos()` en `core/`: agrupa **todo el historial** por la clave del
  comentario, solo los gastos del rubro `gastos fijos`.
- Cada uno muestra el **promedio como número grande** —la pregunta es "¿cuánto me
  sale?"— con **"3 pagos · nov 25 → ago 26"** al lado, para que un promedio por
  pago no se lea como si fuera mensual. Ver ADR-032.
- Los pagos **sin comentario** salen contados y sumados, con la frase que dice
  cómo hacer que entren. Sin eso la lista no cerraría con el total del rubro y no
  habría forma de notarlo.
- Vive en la misma pantalla que la evolución: las dos son preguntas sobre el
  historial.
- 19 tests nuevos. Nueve mutaciones a propósito: las nueve fallan.
- Vuelta por el navegador, claro y oscuro: los tres grupos más los dos sueltos
  dan 471,90 €, **el mismo número que la matriz de arriba** en la columna de
  gastos fijos. 0 peticiones de red, 0 errores de consola.

### T-024 · Pantalla de monedas — CU-15 — **Hecha** (2026-08-28)
**Depende de:** T-008, T-010 · **Tocó:** `src/ui/pantallas/monedas.js` (nuevo),
`app.js`, `datos.js`, `movimiento.js`, `estilos.css`

Ver las monedas, agregar una nueva (código, nombre, decimales) y ocultar las que
ya no se usan. Accesible también desde el formulario de carga, para cuando la
moneda que hace falta no está en la lista.

**Lo que quedó hecho, comprobado:**

- Agregar, ocultar, mostrar y borrar. **Borrar solo se ofrece cuando de verdad se
  puede**; el euro no ofrece ninguna de las tres.
- **Cambiar los decimales es un paso aparte**, con el aviso de cuántos
  movimientos reinterpreta y un ejemplo real del usuario, antes y después. El
  aviso se mueve con el número elegido. Ver ADR-033.
- Se llega desde Datos y desde el propio formulario de carga ("¿Falta una
  moneda?"), que es donde aparece el problema.
- 26 tests nuevos. Ocho mutaciones a propósito: las ocho fallan.
- Recorrido de punta a punta en el navegador: agregar el yen → aparece en el
  selector de carga → cargar un gasto en colones → cambiar sus decimales con el
  aviso → **recargar y que el cambio siga** → ocultar y que desaparezca del
  selector → borrar el yen → código repetido con el error a la vista y lo
  escrito conservado. 0 peticiones de red, 0 errores de consola.
- **El recorrido encontró tres defectos que los 740 tests no veían**: el error no
  se mostraba en ninguna pantalla, la clase `apagada` no existía en el CSS, y los
  datos de cada fila se leían corridos. Los tres tienen ahora su test. Ver L-026.

**Y se fue el último marcador.** `marcador()` en `app.js` dibujaba las pantallas
sin construir; con esta tarea dejó de haber ninguna, así que se borró junto con
el "Todavía no" de la pantalla de datos. El test que exigía que las partes sin
construir se nombraran se dio vuelta: ahora exige que **no** haya quedado un
cartel prometiendo una tarea ya hecha, que es la otra forma de mentir.

### T-945 · Dentro de cada día, lo último cargado arriba — **Hecha** (2026-08-29)
**Depende de:** T-015 · **Pedida por el usuario (2026-08-29)** · **Tocó:**
`ui/pantallas/lista.js`

Los días ya iban del más nuevo al más viejo, pero **adentro de cada día** los
movimientos quedaban en el orden en que se habían cargado: lo que acababas de
anotar aparecía abajo de todo. Y la lista se abre casi siempre por lo mismo,
arreglar el dedazo de hace dos minutos.

**Lo interesante fue qué se usa para ordenar, porque lo obvio no funciona:**

- **`creado` no alcanza:** es una **fecha, no un instante** —`2026-08-29`, sin
  hora—, así que todo lo cargado el mismo día empata.
- **El `id` tampoco:** es un número al azar, no uno que crece.
- **Lo único que sabe el orden de carga es la posición en la lista**, que es
  donde se van agregando.

Así que se da vuelta la lista y **después** se ordena por `creado` con un orden
estable: los que empatan se quedan al revés de como se cargaron, que es lo que se
buscaba, y un movimiento cargado hoy con fecha vieja sí sube.

La primera versión usaba `creado` y el `id`, y **los tests la desmintieron**: los
tres movimientos de prueba salían en el orden original porque empataban en todo.

**Comprobado:** 4 tests nuevos, cinco mutaciones a propósito y las cinco fallan.
Recorrido en el navegador cargando por la app: dentro del 10 de agosto salen
`tres · dos · uno`, y sobrevive a recargar. 0 peticiones de red, 0 errores.

---

### T-944 · El eje de importes, con marcas redondas — **Hecha** (2026-08-29)
**Depende de:** T-942 · **Pedida por el usuario (2026-08-29)** · **Tocó:**
`ui/pantallas/series.js`, `core/formato.js`, `estilos.css`

Los dos gráficos del historial tenían **una sola marca** en el eje de importes:
el máximo. Ahora tienen hasta cinco, con su línea de referencia.

**Lo que decide todo es que los pasos sean redondos**, no el rango dividido en
cinco: `1.390,47 €` es exacto y no significa nada. Ver ADR-040.

**Lo que quedó hecho, comprobado:**

- Pasos de la serie 1, 2, 5, 10, 20, 50… en euros; el más chico que no pase de
  cinco marcas.
- Sin decimales cuando el paso es de un euro o más.
- Una línea muy apagada por marca; la del cero, distinta y sin repetirse.
- 11 tests nuevos. Nueve mutaciones a propósito: las nueve fallan.
- Recorrido en el navegador: el gráfico mensual sale con `0 500 1000 1500 2000` y
  el diario con `0 5000 10.000 15.000 20.000`, y al acercarse las marcas se
  recalculan solas. 0 peticiones de red, 0 errores.

**Y las mutaciones encontraron código muerto**: la línea que metía el cero "por
las dudas" era inalcanzable —si el rango cruza el cero, el cero es múltiplo de
cualquier paso— y se fue.

---

### T-943 · Buscar texto en todos los movimientos — **Hecha** (2026-08-29)
**Depende de:** T-015 · **Pedida por el usuario (2026-08-29)** · **Tocó:**
`core/busqueda.js` (nuevo), `lista.js`, `app.js`, `estilos.css`

Una lupa arriba de la pestaña de movimientos que busca en **todo el historial** y
en **todos los campos**: etiqueta, detalle, rubro, importe, moneda, fecha y tipo.

**Lo que quedó hecho, comprobado:**

- Cada campo entra **en las dos formas**, como se guarda y como se muestra: `1250`
  y `12,50` encuentran el mismo gasto. Ver ADR-039.
- Sin tildes ni mayúsculas, **pero la ñ se respeta**: `ano` no encuentra `año`.
- Con varias palabras, tienen que estar todas.
- Cada resultado lleva su fecha completa, y se puede corregir y borrar desde ahí.
- 29 tests nuevos. Trece mutaciones a propósito: las trece fallan.
- Recorrido en el navegador escribiendo **letra por letra**: el foco queda en el
  campo y el cursor no se mueve; borrar desde los resultados **no pierde la
  búsqueda**; cambiar de pestaña sí la limpia. 0 peticiones de red, 0 errores.

---

### T-942 · Los dos gráficos del historial, recorribles — **Hecha** (2026-08-29)
**Depende de:** T-940 · **Pedida por el usuario (2026-08-29)** · **Tocó:**
`ui/pantallas/series.js` (nuevo), `ui/series-interaccion.js` (nuevo),
`graficos.js`, `app.js`, `estilos.css`

Zoom, más marcas en el eje, y tocar un punto para ver el momento y los valores.

**La decisión que lo hace testeable: el dibujo recibe una ventana de índices** y
sigue siendo puro. El zoom es cambiar la ventana. Ver ADR-038.

**Lo que quedó hecho, comprobado:**

- Zoom con `−`, `+`, `Ver todo` **y** pellizco; arrastre para moverse.
- Cinco etiquetas en el eje, siempre la primera y la última, y una marquita por
  punto mientras entren.
- Tocar un punto muestra **cuándo es y cuánto valía cada línea**, debajo del
  gráfico y con el color de cada una al lado.
- 34 tests nuevos. Once mutaciones a propósito: las once fallan.
- Recorrido en el navegador con once meses y 330 días: tocar da
  "marzo de 2026 · Ingresos 2100,00 € · Gastos 360,00 € · Saldo 1740,00 €" con su
  guía y sus tres puntos; acercar mantiene a la vista el punto elegido; arrastrar
  mueve **sin** elegir un punto; el pellizco con dos dedos acerca; en el
  histórico el toque da el **día completo**. 0 peticiones de red, 0 errores.

**Dos cosas que encontró el trabajo y no eran del pedido:**

- **Acercar se atascaba en tres puntos**: el 60 % de un ancho de dos redondea a
  dos, y el botón dejaba de hacer nada sin decir por qué. Ahora cada toque
  angosta al menos un punto.
- **Casi reporto un defecto que era de mi recorrido.** Tocar el gráfico "no
  hacía nada"… porque `mouse.click` usa coordenadas de la pantalla y **no
  desplaza la página**: el gráfico estaba abajo del pliegue (su caja daba
  `y = −130`) y el clic caía en el vacío. Un recorrido que no mira dónde está el
  elemento inventa defectos igual que los esconde.

---

### T-941 · Fechas del viaje, orden por fecha de fin, y «Etiqueta» — **Hecha** (2026-08-28)
**Depende de:** T-023 · **Pedida por el usuario (2026-08-28)** · **Tocó:**
`core/viajes.js`, `ui/pantallas/viajes.js`, `almacenamiento.js`, `app.js`,
`movimiento.js`, `etiquetas.js`, `fijos.js`, `datos.js`

Tres cambios, los tres decisiones suyas. Ver ADR-037.

1. **Se escriben las fechas y los días se calculan.** Reemplaza la mitad de
   ADR-036, que los pedía a mano. `dias_de_viaje` pasó a ser `fechas_de_viaje`
   con `{ clave, desde, hasta }`. Los días se cuentan **con las dos puntas** y la
   cuenta se muestra mientras se escribe, antes de guardar.
2. **Los viajes van por fecha de fin, del más reciente arriba.** Un viaje sin
   fechas se ordena por su último gasto, para que no se amontonen todos juntos.
3. **«Comentario» se llama «Etiqueta (agrupar por)»** en toda la interfaz. El
   campo guardado sigue llamándose `comentario`: renombrarlo dejaría ilegibles
   los respaldos que el usuario ya tiene.

**Comprobado:** 33 tests nuevos, once mutaciones a propósito y las once fallan.
Recorrido en el navegador con recarga: los tres viajes salen ordenados
`Roma → París → Costa Rica` por fecha de fin, la cuenta de días se actualiza
mientras se escriben las fechas, un rango dado vuelta no se guarda, y las fechas
sobreviven a recargar. **Un recorrido aparte recorre las ocho pantallas** y
comprueba que ninguna dice ya "comentario" en su texto visible. 0 peticiones de
red, 0 errores.

**Un error de método mío:** la primera comprobación de que no quedara la palabra
"comentario" leía `textContent` del `body`, que **incluye el `<script>`** — o
sea, la app entera. Dio positivo por el código fuente, no por la pantalla. Se
rehízo con `innerText`, que es lo que se ve. Un test que mide lo que no es se
equivoca en las dos direcciones.

---

### T-940 · Los dos gráficos de `Analisis1`, y la tabla en su orden — **Hecha** (2026-08-28)
**Depende de:** T-021, T-918 · **Pedida por el usuario (2026-08-28)** ·
**Tocó:** `core/calculos.js`, `graficos.js`, `evolucion.js`, `estilos.css`

**1. La tabla estaba en el orden equivocado, y era mi error.** La había puesto del
mes más nuevo al más viejo con este argumento: "lo primero que se mira es el mes
pasado". El usuario pidió lo contrario. El argumento no era malo y estaba mal
igual: **esta tabla no se lee para mirar un mes, se lee para seguir una línea de
tiempo**, y una línea de tiempo va para adelante. Además la hoja del `.xlsx` ya
iba al revés que la pantalla — dos vistas de la misma tabla en órdenes distintos,
que es lo que tendría que haber pesado desde el principio.

**2. Los dos gráficos que faltaban**, los que él tiene en `Analisis1`:

- **Mes a mes** — ingresos, gastos y saldo, tres series en **un solo eje**. Con
  la línea del cero cuando algún saldo es negativo: sin ella, −200 y +200 se ven
  como dos puntos cualesquiera. El saldo va en color de texto y punteado, no en
  un tercer color de serie: es un resultado de los otros dos, no una cosa más.
- **Todo lo que llevás gastado y cobrado** — el acumulado día por día de **todo
  el historial**, no del mes. Contesta lo que ninguna otra pantalla contesta: si
  la distancia entre las dos líneas se abre o se cierra. Reusa el mismo dibujo
  que la línea del mes, a propósito: dos dibujos escritos por separado
  terminarían con escalas distintas y no se podrían comparar.

**Comprobado:** 21 tests nuevos, trece mutaciones a propósito y las trece fallan.
Recorrido en el navegador con once meses, claro y oscuro: la tabla sale
`oct 25 … ago 26` con Total y Promedio abajo, los dos gráficos aparecen con sus
tres y dos líneas. 0 peticiones de red, 0 errores.

**Tres cosas que encontraron los tests y las mutaciones, y ninguna era del
pedido:**

- `acumuladoHistorico()` **no tenía ni un test**: se probaba el dibujo y no el
  cálculo, que es la parte que puede mentir en silencio. Ahora tiene ocho.
- El gráfico histórico se **anunciaba** como "Acumulado del mes": los dos
  comparten el dibujo y compartían también el texto que lee un lector de
  pantalla.
- Un nombre con dos significados: `hasta` era "hasta qué día dibujar" y lo reusé
  para el rótulo del eje. El rótulo salió "10" en vez de "Día 10". Lo agarró un
  test que ya existía.

Y **la guardia de sintaxis de L-028 se ganó el sueldo el mismo día**: volví a
poner acentos graves dentro de una plantilla, en un comentario, y frenó la
construcción en vez de publicar un archivo que abriría en blanco.

---

### T-025 · Ver, renombrar y borrar los comentarios y detalles que ya existen — **Hecha** (2026-08-28)
**Depende de:** T-015 · **Pedida por el usuario (2026-08-28)** · **Tocó:**
`core/etiquetas.js` (nuevo), `ui/pantallas/etiquetas.js` (nuevo), `app.js`,
`datos.js`, `tools/sintaxis.mjs` (nuevo)

**Lo que quedó hecho, comprobado:**

- Las dos secciones, comentarios y detalles, con cuántos movimientos usa cada
  etiqueta y **cuántas formas de escribirla hay** —el dato que delata el typo—.
- **Renombrar une**, con el aviso de "se van a unir" antes de aplicar. Ver
  ADR-035.
- **Borrar saca la etiqueta y no el movimiento**, y la confirmación lo dice con
  todas las letras.
- **Decisión resuelta:** se hicieron los dos campos, no solo el comentario. La
  pantalla explica la diferencia en vez de esconderla.
- 30 tests nuevos. Diez mutaciones a propósito: las diez fallan.
- Recorrido por el navegador terminando con recarga: dos escrituras de
  `Barcelona26` se unieron, el total del viaje pasó de estar partido en 100 y 50
  a **150,00 € en un solo grupo**, y borrar el detalle `cena` dejó **los tres
  movimientos con sus importes intactos**. 0 peticiones de red, 0 errores.

**Dos lecciones que salieron de acá, y ninguna era de la tarea:**

- **L-027** — el script de mutaciones respaldaba por `basename`, y este proyecto
  tiene dos `etiquetas.js` a propósito. El segundo respaldo pisó al primero y
  restaurar **destruyó el archivo del núcleo**. Lo único que avisó fue la corrida
  de control al final. Quedó escrito en `AGENTES.md` §4.
- **L-028** — un error de sintaxis generaba un `dist/viajecor.html` del tamaño
  esperado con la construcción **en verde**, que abriría en blanco en el celular.
  Ahora el constructor comprueba que el guión se pueda leer, con la guardia en
  `tools/sintaxis.mjs` y su test usando la misma función.

Pidió poder "editar las categorías de detalles existentes" y borrar alguna.

**Lo primero que hay que entender, porque cambia la tarea entera: hoy no existe
ningún catálogo de comentarios ni de detalles.** No son categorías: son **texto
libre escrito en cada movimiento**. Los rubros sí son un catálogo cerrado de
ocho; el comentario y el detalle son campos de texto. La app los junta para
sugerirlos (`comentariosUsados()`) y para agrupar (`porComentario()`), pero no
guarda una lista en ningún lado.

Por eso "borrar una categoría" no es borrar un registro: es **vaciar ese texto en
los N movimientos que lo tienen**, y "renombrarla" es **reescribirlo en los N**.
Es una operación en lote sobre datos ya cargados, así que le corresponde la misma
regla de siempre (ADR-019, ADR-033): **decir cuántos movimientos toca antes de
tocarlos**, y no hacerlo en un toque.

**Lo que hay que construir:**
- Una lista de los comentarios y los detalles que existen, con cuántos
  movimientos usa cada uno.
- Renombrar uno: reescribe el texto en todos sus movimientos. Con el aviso.
- Borrarlo: deja ese campo vacío en todos sus movimientos. Con el aviso. **No
  borra ningún movimiento**, y eso hay que decirlo en la pantalla: "borrar la
  etiqueta" y "borrar los gastos" se confunden fácil y uno de los dos no se puede
  deshacer.
- Unir dos: es el caso real. `Barcelona26` y `barcelona 26` son dos grupos
  distintos en los totales (RN-03, L-002), y renombrar uno con el nombre del otro
  los junta. Conviene que la pantalla lo ofrezca en vez de que haya que
  descubrirlo.

**Decisión abierta:** ¿los detalles también, o solo los comentarios? El
comentario **agrupa** —de él dependen los totales por viaje y por gasto fijo—; el
detalle es una nota y no agrupa nada. Limpiar los comentarios arregla totales
equivocados; limpiar los detalles es orden. Se puede hacer solo el comentario
primero.

---

### T-026 · Tocar un grupo y ver los movimientos que contiene — **Hecha** (2026-08-28)
**Depende de:** T-015 · **Pedida por el usuario (2026-08-28)** · **Tocó:**
`core/calculos.js`, `lista.js`, `resumen.js`, `fijos.js`, `evolucion.js`,
`app.js`, `estilos.css`

**Lo que quedó hecho, comprobado:**

- `movimientosFiltrados()` en `core/`, que compara por clave normalizada (RN-03):
  tocar `Luz` trae también los que se escribieron `luz`, porque son los mismos
  que se sumaron.
- Las cuatro puertas: fila del desglose, fila de gasto fijo, celda de la matriz
  y mes de la matriz. Las cuatro llevan a la lista filtrada.
- **La lista dice en qué está filtrada, muestra el total de lo filtrado y trae
  la salida al lado.** Ver ADR-034.
- El filtro se limpia al cambiar de pestaña.
- 17 tests nuevos. Nueve mutaciones a propósito: las nueve fallan.
- Recorrido por el navegador: el desglose decía 61,40 € y la lista filtrada dice
  **61,40 € y cuatro movimientos**; el gasto fijo decía 11,30 € de promedio y la
  lista trae **seis pagos por 67,80 €** en todos los meses; una celda de la
  matriz decía 63,90 y la lista **movió el mes a junio** y dice 63,90 €. 0
  peticiones de red, 0 errores de consola.
- **Una mutación sobrevivió a la primera vuelta**: vaciar el mes de la celda. El
  test buscaba `data-mes` en toda la página y lo encontraba en el botón del mes.
  Es L-024 otra vez; el test ahora mira dentro del botón de la celda.

Hoy los agrupamientos son **callejones sin salida**: el resumen dice
"Supermercado 410,00 €" y no hay forma de ver de qué se compone. Para saberlo hay
que ir a Movimientos y leer el mes entero.

**Dónde tiene que poder tocarse**, que son todos los lugares donde la app agrupa:
- una fila del desglose del mes (rubro), y su porción de la torta;
- una fila de los gastos fijos (comentario);
- una celda de la matriz de evolución (mes × rubro);
- un mes de la matriz.

**Todos llevan al mismo lado:** la lista de movimientos, filtrada. Así que la
tarea es sobre todo **darle un filtro a la lista** (T-015) y que los agrupamientos
lo sepan invocar; no cuatro pantallas nuevas.

**Lo que hay que cuidar:** que la lista filtrada **diga en qué está filtrada** y
cómo salir. Una lista que muestra siete gastos de doscientos, sin decir por qué,
se lee como datos perdidos.

---

### T-023 · Gasto por viaje — CU-11 — **Hecha** (2026-08-28)
**Depende de:** T-013, T-025 · **Tocó:** `core/viajes.js` (nuevo),
`ui/pantallas/viajes.js` (nuevo), `almacenamiento.js`, `app.js`, `datos.js`,
`resumen.js`

**Lo que quedó hecho, comprobado:**

- Un viaje es un comentario con al menos un gasto del rubro `viajes`, y su total
  suma **todos** sus rubros. Ver ADR-036.
- **Sin días escritos no hay gasto por día**: en su lugar va el botón para
  escribirlos.
- Los días viven en `estado.dias_de_viaje`, entran en el respaldo y se validan al
  leer: uno roto se descarta sin llevarse a los demás.
- 36 tests nuevos. Once mutaciones a propósito: las once fallan.
- Recorrido por el navegador con recarga: Roma suma 450,00 € de tres rubros
  distintos, Luz no aparece, el gasto sin comentario tampoco; con 10 días da
  45,00 € por día y **sobrevive a recargar**; tocar el viaje lleva a sus tres
  gastos por 450,00 € —**el mismo número**—; "no sé cuántos días fue" los borra.
  0 peticiones de red, 0 errores de consola.

**Un defecto que encontró el recorrido y que no era de esta tarea:** los botones
a la evolución y a los viajes vivían **solo al final del desglose del mes**, así
que un mes sin movimientos —el 1 de cada mes, o uno que todavía no cargaste— los
hacía desaparecer y esas pantallas quedaban inalcanzables. Ahora también están en
Datos, en una tarjeta que dice que no dependen del mes.

**Las tres preguntas, respondidas por el usuario (2026-08-28):**

1. **El viaje se sigue escribiendo a mano**, pero **tiene que poder editarse en
   un solo lugar y que el cambio llegue a todos los registros**. Eso es
   exactamente T-025, así que T-023 pasa a depender de ella: sin renombrar en
   lote, escribir a mano vuelve a ser lo que parte un total en dos sin avisar.

2. **Los vuelos y el alojamiento pagados aparte NO llevan función propia.** Son
   dos excepciones de cuando el registro recién empezaba (`=96+SUMIFS(...)` en
   París, `=850+...` en Costa Rica) y no va a haber más casos así.

   **Consecuencia que hay que decir en la pantalla, no esconder:** el total de
   París y el de Costa Rica en la app van a ser **96 € y 850 € más bajos** que en
   la planilla vieja. No es un error de la importación: esos importes nunca
   fueron un registro, eran un número escrito adentro de una fórmula.

   Y si el usuario quiere que cierren, **no hace falta código**: alcanza con
   cargar un movimiento de 96 € con comentario `París` y otro de 850 € con
   comentario `Costa Rica`. Son gastos reales que nunca se registraron; cargarlos
   los convierte en un dato como cualquier otro, con su fecha y su rubro.

3. **La duración se escribe**, no se deduce de la primera y la última fecha.

**Lo que 3 obliga a decidir al construir:** si los días se escriben, hay que
guardarlos en algún lado, y hoy un viaje **no es un registro**: es un texto
repetido en varios movimientos. Hay dos salidas —un catálogo chico de viajes
(nombre + días) o los días guardados en las preferencias por clave de
comentario—. Se decide al empezar la tarea, no antes, y conviene mirar primero
cómo quedó T-025: si termina habiendo una lista de comentarios, los días van ahí.

---

## Etapa 3 — Traer el historial del Excel

### T-030 · Definir el mapeo Excel → modelo — CU-13
**Estado:** **Hecha** · **Depende de:** T-003, T-009
**Toca:** `docs/MAPEO-EXCEL.md`

Escribir cómo se traduce cada columna de la planilla al modelo de la app, y qué se
hace con cada caso raro. Se trabaja contra `test/ejemplo/planilla-ejemplo.xlsx`,
que tiene la estructura real con montos inventados (T-009).

**Decidido con el usuario (2026-08-28):**
- **Todos los montos están en euros**, convertidos a mano por él. No hace falta
  ningún tipo de cambio histórico para importar: cada fila entra tal cual, en
  euros. Es la respuesta que más simplifica la etapa 3.
- **Las filas sin monto se descartan, pero se listan** en el informe de
  importación, con lo que decían. Nada desaparece en silencio: si alguna era un
  gasto real al que le faltaba el importe, tiene que poder verlo.

**Casos que el mapeo tiene que resolver, ya identificados:**
- Hay **celdas sueltas de referencia** fuera de las tablas: el usuario tenía un
  `49,5` al costado de los gráficos, que era el tipo de cambio del peso uruguayo
  anotado a mano (confirmado por él, 2026-08-27). No son datos y no se importan,
  pero **confirman que llevaba los tipos de cambio a mano**, que es justo lo que
  la app resuelve con CU-03.
- Día (`C`) y mes (`D`) en columnas separadas → una sola fecha (RN-01).
- Rubro y tipo con mayúsculas inconsistentes → normalizar (RN-03).
- Filas sin monto: ¿se descartan o se importan en cero? Hay muchas en el original.
- Los bloques mensuales se repiten con encabezados en el medio: hay que saltearlos
  sin confundirlos con datos.
- Fechas como número de serie de Excel (`45931` = 2025-10-01), incluido el error
  histórico de que Excel considera 1900 bisiesto.
- El comentario (`B`) mezcla nombres de viaje y de gastos fijos recurrentes.

**Resuelto en `docs/MAPEO-EXCEL.md`.** Las decisiones que más cambian el
resultado:

- **Una fila es de datos si tiene día y rubro.** Se pregunta qué *sí* es un dato
  en vez de qué hay que saltear: reconocer los títulos por su texto obliga a
  acertar la lista completa de lo que se ignora, y basta con que un mes esté
  escrito distinto para que un encabezado entre como gasto. Es una lista blanca
  que hay que mantener, y este proyecto ya se quemó dos veces con eso.
- **Un rubro desconocido no se manda a `otros`**: ahí desaparecería dentro de un
  total que ya existe — se ve bien y está mal.
- **El tipo vacío no se supone «gasto»** por ser lo más frecuente: un ingreso
  importado como gasto mueve el saldo del mes por el doble del importe.
- **Importar dos veces no puede duplicar.** El identificador se deriva de la
  propia fila, así que alcanza el mecanismo que ya tiene T-017.
- **Todo lo descartado se informa con su número de fila**, para poder ir a
  mirarlo en la planilla.
- Y una comprobación que sale de la planilla misma: su columna de acumulado la
  calculó otra herramienta, así que al terminar cada mes se puede contrastar
  contra la suma importada. Es el único momento en que hay con qué comparar.

**Verificado antes de programar nada:** las reglas se aplicaron a la copia de
estructura —separan las 288 filas de datos de los títulos, encabezados y filas
vacías, sin que se cuele ninguna— y a **22 filas raras construidas a propósito**,
que es lo que importa: una regla probada solo contra datos limpios no se
distingue de una que acepta todo.

**Encontró dos defectos del mapeo, ya corregidos:** una fila con el tipo ilegible
daba *dos* motivos —el segundo inventado a partir del primero, porque sin saber
el tipo no se puede juzgar el rubro—, y un rubro que existe pero en la otra lista
(`supermercado` como ingreso) decía «rubro desconocido», que manda a buscar un
error de escritura que no está.

### T-031 · Lector de `.xlsx` sin librerías — CU-13
**Estado:** En curso (claude, 2026-08-28) · **Depende de:** T-009
**Toca:** `src/datos/xlsx.js`, `test/xlsx.test.js`

Leer un `.xlsx` en el navegador sin ninguna librería: abrir el ZIP a mano y
parsear el XML con `DOMParser`. Ver ADR-010 — está comprobado que se puede, sobre
la planilla real del usuario.

**Terminada cuando:** lee `test/ejemplo/planilla-ejemplo.xlsx` y devuelve las
celdas con su valor, distinguiendo texto, número y fecha.

**Cómo quedó (Hecha, 2026-08-28).** Tres piezas: `leerZip()` en `datos/zip.js`,
un lector de XML propio en `datos/xml.js` (ADR-028) y `datos/planilla.js`, que
devuelve las celdas de la primera hoja con su valor ya interpretado. El lector no
sabe nada de gastos: ahí termina el formato y empieza el significado.

**Las tres cosas que un `.xlsx` esconde**, y que un lector ingenuo lee mal sin
dar ningún error:

1. **El texto no está en la hoja.** Excel lo guarda una sola vez en
   `sharedStrings.xml` y en la celda pone un número que es su posición. Sin
   resolver eso, todos los rubros de la planilla se leen como números.
2. **Las fechas son números.** `46082` es el 1 de marzo de 2026, y lo único que
   lo distingue de un importe de 46 082 € es el formato de la celda, que vive en
   otra parte del archivo. Hay que cruzar `cellXfs` con `numFmts`.
3. **Las celdas vacías no existen.** Si una fila no tiene nada en B, no hay
   ninguna celda B: hay un hueco. Recorrer las celdas que hay y asumir que están
   todas **corre todas las columnas siguientes** — el rubro se leería del monto y
   el monto del tipo, sin un solo error.

**Verificado contra otro programa.** Las **1.614 celdas** de la copia de
estructura, leídas con este lector y con openpyxl y comparadas una por una: cero
diferencias. Un lector de formatos probado solo contra sus propios archivos lee
bien exactamente lo que él mismo escribe.

**604 tests. Diez mutaciones, diez detectadas**, y dos destaparon cosas reales:

- Una línea que no hacía nada —descartar la celda vacía al abrirla, cuando ya se
  descartaba al cerrarla—. Código muerto que hacía creer que algo lo protegía.
- **Los desplazamientos de un ZIP son desde el principio del ZIP, no del
  archivo.** Si hay algo pegado adelante quedan todos corridos. Lo encontró un
  test que le pegó una firma de cierre falsa al principio para comprobar otra
  cosa: que el índice se busca desde el final. Se arregló calculando el
  corrimiento y sumándolo.

### T-032 · Importador con informe de filas no interpretadas — CU-13
**Depende de:** T-030, T-031, T-017 · **Toca:** `src/datos/importar.js`

Fila por fila, qué no se pudo leer y por qué. Importar mal en silencio es peor
que no importar.

**Cómo quedó (Hecha, 2026-08-28).** En *Datos* → «Traer tu planilla de Excel» se
elige el `.xlsx` y la app **muestra qué leyó antes de tocar nada**: cuántos
movimientos, cuántos ya están, qué filas quedaron afuera con su número y su
motivo, y si los totales de cada mes coinciden con el acumulado que traía la
planilla.

**Solo agrega; no ofrece reemplazar.** Quien trae su historial quiere sumarlo a
lo que tiene, y un botón de «reemplazar todo» al lado de uno que trae once meses
es un accidente esperando. Los que ya están no entran dos veces porque el
identificador sale de la propia fila.

**Verificado:** 642 tests. Nueve mutaciones, nueve detectadas —tres necesitaron
tests nuevos: el mensaje del monto negativo, la fila con día pero sin rubro, y
que el identificador use sus 64 bits y no 32 repetidos—.

Y el recorrido en un navegador real, que es como lo va a hacer el usuario: cargar
un gasto a mano, elegir la planilla, ver la previa **sin que cambie nada de lo
guardado**, traer los 288 movimientos, recargar y encontrarlos, **ver octubre de
2025 con sus totales y su desglose en la pantalla del mes**, importar la misma
planilla otra vez y que el botón quede deshabilitado con «entrarían 0», y elegir
un archivo que no es una planilla y recibir una explicación.

**Un hallazgo que valió la tarea:** el mapeo decía que un monto de 0 se importa
—«un 0 escrito es un dato, una celda vacía es su ausencia»— y **el modelo lo
rechaza desde T-003**: *«si no hubo dinero de por medio, no hay nada que
registrar»*. El documento se había escrito sin cotejarlo con esa regla. Lo
destapó el primer test que lo probó. Gana la regla anterior; lo que quedó del
mapeo es **distinguir los dos casos en el informe**, porque un 0 escrito a mano
casi siempre es una fila a medio cargar.

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

- **T-900 · README de uso** — **Hecha (2026-08-28).** `docs/USO.md`, escrito para
  quien usa la app, más el `README.md` puesto al día: decía "esqueleto, todavía
  no se pueden cargar gastos" cuando ya había once meses de datos adentro.

  **La guía empieza por cómo conseguir la versión que se va a usar**, y no es un
  trámite: es la lección de T-919, donde una ronda entera de pruebas se hizo
  sobre el archivo viejo y los tres "no funciona" eran tres cosas que no existían
  en esa copia.

  **Comprobado abriendo la app, no leyendo el código:** un recorrido lee
  `docs/USO.md`, abre la app en un navegador y verifica que **las once cosas que
  la guía nombra estén de verdad en la pantalla**, con el mismo texto. La primera
  versión de la guía nombraba tres botones que no existían con ese nombre
  ("Exportar respaldo", "Traer mi planilla vieja"); el recorrido los encontró.
  Un manual de algo que no existe es la misma falla que un test que pasa por el
  motivo equivocado.

  Queda pendiente de la verificación del usuario **cuál de las tres formas de
  poner el ícono en la pantalla de inicio funciona en su Android**: están las
  tres escritas, en orden de menos a más trabajo, y él va a probar.
- **T-901 · Versionado y CHANGELOG** — el archivo `VERSION`, el `CHANGELOG.md` y
  la regla de `docs/PRODUCTO.md` §9 aplicada de verdad en cada publicación.
- **T-902 · Uso cómodo en celular** — botones grandes, teclado numérico al cargar
  montos, nada de texto de 11 píxeles. *(Depende de T-010.)*
- **T-903 · Recordatorio semanal de respaldo** — **Hecha (2026-08-27).** La app
  avisa si hace **más de una semana** que no se exporta (plazo decidido por el
  usuario, 2026-08-19). Es la contramedida al riesgo más grave de la
  arquitectura: los datos viven en un solo navegador. El aviso se muestra dentro
  de la app, no como notificación del sistema — una notificación exigiría
  permisos y un servicio, y la app no tiene ni puede tener servidor.

  **Aparece en la pantalla donde el usuario está**, no solo en *Datos*, donde
  entra el que ya se acordó. En *Datos* no se repite: ahí ya está la información
  completa y los botones de verdad.

  **Cuenta movimientos sin respaldar, no solo días** (ADR-026): sin movimientos
  nuevos no aparece por más que pase un año, porque no hay nada que perder. Y si
  nunca hubo un respaldo, el plazo corre desde el movimiento más viejo, no desde
  siempre: reclamarle un respaldo a quien cargó su primer gasto hace diez
  minutos es la forma más rápida de que el aviso deje de leerse.

  **Se pospone por el día, no se apaga.** Un aviso que no se puede sacar se
  vuelve decorado; uno que se apaga para siempre no sirve. "Ahora no" lo calla
  hasta mañana, y eso se guarda —si no, volvería en cada recarga—.

  **Verificado:** 427 tests, 25 nuevos. Nueve mutaciones: siete detectadas y dos
  equivalentes. Dos de las mutaciones destaparon huecos reales —no había ningún
  test de la pantalla, y quitar la llamada de `dibujarApp` no rompía nada
  (L-014)—; los dos están cubiertos ahora. Recorrido en un navegador real desde
  el disco: sembrando diez días de uso, comprobando que el aviso sigue por las
  pantallas menos *Datos*, que "Ahora no" sobrevive a recargar, que **mañana
  vuelve**, que respaldar lo apaga de verdad, y que cargar un gasto nuevo el
  mismo día no lo hace gritar otra vez.
- **T-904 · Modo oscuro** — *(Depende de T-010.)*
- **T-905 · Respaldo cómodo a la nube, sin red** — **Hecha (2026-08-27).**
  Exportar termina en un botón *Compartir el respaldo* que abre el menú del
  sistema: OneDrive, Drive, correo, lo que haya. La app no hace ninguna
  petición; le entrega el archivo al teléfono y ahí termina su parte, así que
  RN-06 queda intacta. Ver ADR-025.

  **El botón solo aparece si el teléfono sabe compartir archivos**, y se
  pregunta con `canShare({files})`, no con la mera existencia de `share`: hay
  navegadores que comparten texto pero no archivos, y ahí el botón fallaría
  recién al apretarlo, dejando al usuario creyendo que respaldó (L-016). Cuando
  no aparece, *Descargar* sigue siendo el camino principal, intacto.

  **Cancelar no es fallar:** si el usuario abre el menú y se arrepiente, no se
  muestra ningún error **y no se anota la fecha del respaldo**. Anotarla al
  apretar el botón apagaría el aviso de "hace tantos días que no respaldás" sin
  que hubiera salido ningún archivo.

  **Verificado:** 13 tests del módulo, contra navegadores falsos que cubren lo
  que puede salir mal (comparte texto pero no archivos, `canShare` que tira, el
  usuario cancela, el destino falla). Cinco mutaciones: cuatro detectadas y una
  equivalente —el `try/catch` absorbe la comprobación explícita de `canShare`—.
  Recorrido en un navegador real desde el disco, en los cuatro caminos.

  **Lo que NO se pudo comprobar acá, y hay que comprobar en el celular:** que el
  compartir del sistema funcione de verdad en Android con la app abierta desde
  `file://`. Chromium de escritorio en Linux no trae Web Share, así que el
  camino feliz se recorrió con un compartir falso inyectado. Lo que sí se
  comprobó es que `file://` **es** contexto seguro (`isSecureContext === true`),
  que era el motivo más probable de que no anduviera. Si en el celular no
  aparece el botón, la app no se rompe: queda la descarga de siempre. → T-019.
  *(Depende de T-016. Cierra la pregunta abierta 4.)*
- **T-909 · Color y rótulo propios por rubro** — pedido por el usuario el
  2026-08-19. Cada rubro se muestra con la primera letra en mayúscula
  (`Gastos fijos`) y con **un color propio, el mismo en todas las pantallas**:
  en la barra del desglose, en el punto de la lista, y en el campo del formulario
  cuando se elige ese rubro.

  **El color se asigna por la posición del rubro en su lista, nunca por su
  tamaño.** Si dependiera del tamaño, cargar un gasto nuevo repintaría media
  pantalla y el color dejaría de significar "supermercado" para significar "el
  más grande de este mes".

  **Paleta comprobada, no elegida a ojo:** ocho tonos validados con el
  comprobador de la guía de visualización, contra las dos superficies de la app.
  Pasan las seis comprobaciones —banda de luminosidad, croma mínimo, separación
  para daltonismo, separación en visión normal y contraste— en claro y en oscuro.
  La única advertencia (tres tonos por debajo de 3:1 sobre fondo claro) está
  cubierta: cada barra lleva su nombre y su importe escritos al lado, así que el
  color nunca es la única forma de saber qué es.

- **T-907 · Decimales sugeridos por moneda** — al agregar una moneda, que la app
  proponga sola los decimales correctos según el estándar ISO 4217 (`JPY` → 0,
  `CLP` → 0, `KRW` → 0, `EUR` → 2…), con las veinte o treinta más usadas. Sigue
  siendo una **sugerencia**: el usuario la puede cambiar, y la lista de monedas la
  sigue manejando él (ADR-011). Pedido por el usuario el 2026-08-19.
  *(Depende de T-008. Se muestra en T-024.)*
- **T-908 · Reescalar los montos al corregir los decimales de una moneda** —
  decidido por el usuario el 2026-08-19. Hoy `cambiarDecimalesDe()` deja los
  montos como están y por lo tanto los **reinterpreta**: 1500 yenes cargados con
  2 decimales pasan a ser 150.000 yenes si se corrige a 0 (ADR-019). Tiene que
  ajustarlos para que sigan valiendo lo mismo.

  **El caso feo que hay que resolver, no esquivar:** bajar de 2 decimales a 0
  puede **perder información**. Un monto de 1500,50 no tiene forma de existir en
  una moneda sin decimales: hay que redondear, y eso cambia el importe. La app
  tiene que decir **cuántos movimientos pierden decimales y cuánto** antes de
  aplicar el cambio, no después. Subir de 0 a 2 decimales, en cambio, es exacto y
  no pierde nada.
  *(Depende de T-008. Se muestra en T-024.)*
- **T-906 · Exportar a `.xlsx` con la forma de la planilla** — una planilla de
  verdad, con fechas como fechas, además del CSV de T-018.
  *(Depende de T-016, T-018.)*

  **Qué reproduce de la planilla actual**, decidido con el usuario (2026-08-19):
  los bloques mensuales con su título (`OCTUBRE 2025`), los mismos encabezados de
  columna (`Comentarios`, `DÍA`, `MES`, `DETALLES`, `RUBRO`, `MONTO`, `I/G`), los
  bloques `GASTOS POR TIPO`, `INGRESOS POR TIPO`, `TOTALES` y `GASTO POR DÍA`, y
  una hoja de análisis con la matriz mes × rubro.

  **Qué NO reproduce, a propósito:** las fórmulas con rangos escritos a mano
  (`SUMIFS($G$8:$G$1027, …)`). Son exactamente el error que esta app existe para
  eliminar: el día que el registro pase esa fila, los totales dan de menos sin
  ningún aviso (L-001). El `.xlsx` exportado lleva **los números ya calculados**,
  no fórmulas. Si alguna vez se quieren fórmulas vivas para seguir trabajando en
  Excel, tienen que cubrir la columna entera (`G:G`) y no un rango con final
  escrito a mano — y eso es una decisión aparte, no un detalle de implementación.

  **El obstáculo de la guardia, resuelto (ADR-027).** El formato obliga a
  escribir espacios de nombres XML con forma de dirección, y la guardia de
  privacidad (T-007) rechaza cualquier `http://`. No se debilitó la guardia ni
  se partieron las cadenas para esconderlas —eso la habría dejado en pie pero
  ciega—: se declaran en un solo lugar, en una lista **cerrada y acotada por
  dominio**, con tres condiciones comprobadas en cada construcción. Y se midió:
  la app abierta en un navegador con la red bloqueada e instrumentada hace
  **cero** peticiones.

  **Decisiones del usuario (2026-08-27):** la columna `G/Acum./Mes` y los
  bloques de la derecha se **rellenan con los números calculados**; la columna
  `MONTO` lleva **el equivalente en euros**, una sola moneda, para que sumar la
  columna dé un número con sentido.

  **Un movimiento sin tipo de cambio entra igual**, con el monto vacío y el
  motivo escrito en `DETALLES`, y la pantalla dice cuántos son. No se descarta
  ni se pone en cero: una fila que desaparece en silencio es la falla que esta
  app existe para eliminar.

  **La planilla NO es un respaldo, y la pantalla lo dice.** Un `.xlsx` no lleva
  los identificadores de los movimientos, ni los tipos de cambio, ni las
  monedas: se puede leer, pero no se puede volver a cargar. Por eso descargarla
  **no anota la fecha del respaldo** y no apaga el aviso de T-903. Dejar que lo
  apagara sería lo peor que puede hacer esa pantalla: el usuario tranquilo con
  un archivo que no lo puede salvar.

  **Verificado, no supuesto.** 474 tests. Doce mutaciones, doce detectadas —dos
  destaparon huecos: un test circular que no podía fallar, y un choque de filas
  que la rejilla hacía en silencio—. El `.xlsx` **descargado desde el navegador**
  se abrió con **dos lectores independientes**, openpyxl (Python) y exceljs
  (Node), que devolvieron los mismos valores, las fechas como fechas, los
  formatos de moneda y la negrita de los títulos.

  **Lo que NO se pudo comprobar acá:** que Excel de verdad lo abra. LibreOffice
  está instalado en el entorno pero **sin el filtro de Calc**, y no carga ningún
  `.xlsx`, ni siquiera uno hecho por openpyxl. Abrirlo en Excel es parte de
  T-019.

  **Lo que queda para otra tarea:** la hoja de análisis con la matriz mes ×
  rubro. Los bloques por mes —`GASTOS POR TIPO`, `INGRESOS POR TIPO`, `TOTALES`
  y `GASTO POR DÍA`— están hechos. → T-910.
- **T-910 · Hoja de análisis mes × rubro dentro del `.xlsx`** — **Hecha**
  (2026-08-28). Una segunda hoja
  en el archivo exportado, con la matriz mes × rubro y sus filas de total y de
  promedio, como la hoja `Analisis1` de la planilla original.

  Estaba mencionada dentro de T-906 y se quedó afuera. Se le hace una tarea
  propia en vez de dejarla en una frase: **lo que no tiene tarea se pierde**, y
  este plan es el único lugar donde el proyecto se acuerda de las cosas.

  Dependía de T-021 no por el código sino por la decisión: la matriz en pantalla
  y la matriz en el Excel tienen que contar lo mismo. Se resolvió de la única
  forma que no se puede separar sola: **las dos leen `matrizMesRubro()`**. Dos
  cálculos para la misma tabla terminan diciendo cosas distintas, y el usuario no
  tendría a cuál creerle.

  **Lo que quedó hecho, comprobado:**

  - Segunda hoja `Evolución` en el `.xlsx`, con la matriz, el total y el
    promedio. Los meses van del más viejo al más nuevo, como `Analisis1`; en la
    pantalla van al revés, y a propósito.
  - **La regla del promedio va escrita en la propia hoja**, debajo de la tabla.
    Es toda la diferencia con `Analisis1` (L-006, ADR-031): una planilla que se
    abre dentro de un año tiene que poder explicarse sola.
  - Los encabezados llevan el color de cada rubro, el mismo de la app.
  - 13 tests nuevos. Ocho mutaciones a propósito: las ocho fallan.
  - **Comprobado con openpyxl**, que es otro programa: 138 celdas leídas del
    archivo coinciden una por una con lo que la app calcula, incluida la
    comprobación de que los ocho rubros de cada fila sumen su columna de gastos.
  - Y **bajado desde la app en un navegador real** con once meses adentro: el
    archivo trae las dos hojas y cierra. 0 peticiones de red, 0 errores.

---

### T-950 · Avisar cuando el navegador no puede guardar — **urgente**
**Estado:** En curso (claude, 2026-08-27) · **Depende de:** T-004

**Lo que pasó (2026-08-27, verificación del usuario en su Android).** Abrió
`dist/viajecor.html` desde la app *Archivos*, cargó cuatro movimientos, cerró
Chrome y **perdió todo**.

**Por qué.** Android no le pasa al navegador la ubicación del archivo sino un
permiso temporal de lectura, y la dirección queda como `content://…`. Para Chrome
eso no es un sitio: es contenido anónimo, sin identidad estable. Como el
almacenamiento se guarda **por sitio**, no hay dónde guardar. Chrome deja
escribir mientras la pestaña vive y lo tira al cerrar.

**Lo grave no es que no se pueda guardar: es que la app no lo dijo.** Aceptó
cuatro movimientos, los mostró, dijo "guardado", y los perdió. Toda la app se
apoya en la promesa de que los datos son del usuario y están en su dispositivo;
aceptar datos que no se van a guardar la rompe en el peor momento posible, que es
cuando el usuario ya confió.

**Qué hay que hacer:** detectar que el almacenamiento no persiste y **decirlo
antes de aceptar el primer dato**, con la instrucción concreta para arreglarlo.
No se pospone y no se puede cerrar: un aviso que se puede sacar cuando lo que
avisa es "vas a perder todo" no sirve.

**Lo que NO alcanza:** probar que `localStorage` acepta una escritura. Acepta:
el problema aparece al cerrar. Hay que mirar el **esquema de la dirección**, que
es lo que determina si hay identidad, y no el resultado de escribir.

**Cómo quedó (Hecha, 2026-08-27).** Un aviso arriba de todo, en todas las
pantallas, **que no se puede cerrar ni posponer** — es el único de la app, y lo
es porque lo que anuncia es que todo lo que se escriba se va a perder. Dice qué
pasa, por qué, y **qué hacer**: abrir la app escribiendo su dirección `file:///`
a mano. El usuario lo probó y **resolvió el problema**.

**El recorrido en el navegador encontró dos errores míos, y uno era peor que el
que iba a probar:**

1. **El aviso salía siempre**, también con `file://`. `iniciar(document)` no pasa
   almacén, y yo se lo pasaba tal cual: llegaba `undefined` y la detección
   concluía "no hay dónde guardar". Un aviso que grita en falso enseña a
   ignorarlo, y el día que sea cierto nadie lo lee. Ningún test lo vio porque
   todos le pasaban un almacén.
2. **Con el almacenamiento bloqueado, la app no abría**: pantalla en blanco. El
   código hacía `typeof localStorage === 'undefined'`, que parece defensivo y no
   lo es — hay navegadores donde `localStorage` **tira con solo nombrarlo**, y
   ahí `typeof` tira también. Era exactamente el escenario que ese código decía
   manejar. Ver L-019.

**Verificado:** 507 tests. Cinco mutaciones, cinco detectadas. Y en el navegador,
con `localStorage` bloqueado de verdad: la app abre, avisa, se puede navegar,
**no acepta el dato que no puede guardar** (ADR-016), conserva lo escrito y no
deja movimientos fantasma en la lista.

**Lo que el usuario verificó en su Android (2026-08-27), y que cierra T-019 en
parte:** abrir por `file:///sdcard/Download/viajecor.html` **resuelve la pérdida
de datos**. Cargar, cerrar Chrome, reabrir: los movimientos siguen. Recuperar un
respaldo tras borrar los datos del sitio: funciona. Actualizar el archivo sin
perder nada: funciona. Descargar el respaldo y el `.xlsx`: funcionan.

---

### T-911 · La barra del desglose mide el porcentaje real
**Estado:** En curso (claude, 2026-08-27) · **Depende de:** T-014

Pedido del usuario (2026-08-27): *"tengo dos que dicen 50 % pero las barras están
completas"*. La barra se dibujaba relativa **al rubro más grande**, así que con
dos rubros iguales los dos quedaban llenos. Es una forma legítima de dibujar
barras —aprovecha todo el ancho— pero **contradice el número escrito al lado**, y
entre el dibujo y el número gana siempre el número: el dibujo pasa a ser ruido.

---

### T-912 · Orden de campos y autocompletado del comentario
**Estado:** En curso (claude, 2026-08-27) · **Depende de:** T-011

Pedido del usuario (2026-08-27): que **Detalle** quede penúltimo y **Comentario**
último, y que el comentario **autocomplete** con los que ya se usaron —escribir
`Barce` tiene que ofrecer `Barcelona26`.

El autocompletado no es comodidad: el comentario es lo que agrupa los gastos de
un viaje (RN-03), y dos escrituras distintas del mismo viaje son dos viajes
distintos en los totales. Ofrecer lo que ya existe es la forma más barata de que
eso no pase.

---

### T-913 · "Cargar" es la primera pestaña
**Estado:** En curso (claude, 2026-08-27) · **Depende de:** T-010

Pedido del usuario (2026-08-27). Es lo que más se hace y lo que se hace apurado,
parado en la caja de un supermercado.

---

### T-914 · Recordar que compartir no funciona en este teléfono
**Estado:** En curso (claude, 2026-08-27) · **Depende de:** T-905

**Lo que pasó.** En el Android del usuario, abierto por `file:///`, el botón
*Compartir el respaldo* **aparece** —`canShare({files})` dice que sí— y al
tocarlo falla con `Permission denied`.

Es el caso que T-905 quiso evitar preguntando antes, y preguntar no alcanzó: el
navegador dice que puede y después no puede. Un botón que falla al apretarlo es
peor que un botón que no está (L-016), y en esta pantalla es más caro todavía
porque el usuario puede quedarse creyendo que respaldó.

**Qué hay que hacer:**
- Traducir el error. `Permission denied` no le dice nada a nadie.
- **Recordar el fallo** y dejar de ofrecer el botón en ese dispositivo, en vez de
  repetir el mismo error cada semana.
- Que se pueda volver a intentar: puede ser un permiso que el usuario cambie.
- Que la descarga —que **sí funciona**, lo verificó el usuario— quede como el
  camino principal apenas se sabe que compartir no anda.

**Cómo quedó (Hecha, 2026-08-27).** El error se traduce —*"Tu navegador no deja
compartir archivos cuando la app está abierta desde el disco… usá el botón de
descargar"*—, se **anota en las preferencias**, el botón deja de ofrecerse, la
descarga vuelve a ser el botón principal, y la pantalla explica por qué no está
con un *Probar de nuevo* al lado. Se anota también para la planilla.

**La lección de fondo:** preguntar antes no alcanzó. `canShare({files})` es una
promesa del navegador, no una garantía, y la única fuente confiable sobre si algo
funciona en un dispositivo es **haberlo intentado ahí**. Por eso lo que se guarda
no es lo que el navegador dice, sino lo que pasó.

**Verificado:** 518 tests. Seis mutaciones, seis detectadas —una destapó que
`aDosDecimales('')` devolvía **0 en silencio**, un importe inventado con aspecto
de dato; ahora rechaza lo que no es un número—. Recorrido en el navegador
reproduciendo el fallo exacto del Android del usuario (`canShare` dice que sí,
`share` tira `NotAllowedError: Permission denied`): el botón se ofrece, falla con
el mensaje traducido, desaparece, sobrevive a recargar, la descarga funciona, y
*Probar de nuevo* lo devuelve.

---

### T-915 · Todos los rubros en cada mes del `.xlsx`, aunque estén en cero
**Estado:** En curso (claude, 2026-08-27) · **Depende de:** T-906

Pedido del usuario (2026-08-27): que en los bloques `GASTOS POR TIPO` e
`INGRESOS POR TIPO` **aparezcan todos los rubros todos los meses**, con 0 cuando
no hubo movimientos.

**Va contra lo que hace la app en pantalla, y está bien que así sea.** En el
celular, `porRubro()` devuelve solo los rubros usados a propósito: una fila en
cero por cada rubro que no usaste llena una pantalla chica de nada. En una
planilla es al revés — las filas están siempre en el mismo lugar, se pueden
comparar entre meses de un vistazo y se pueden arrastrar fórmulas. **El mismo
dato quiere formas distintas según dónde se mire**, y la planilla es para mirar
meses uno al lado del otro.

**Cómo quedó (Hecha, 2026-08-27).** Los ocho rubros de gasto y los cuatro de
ingreso aparecen en todos los meses, en el **orden fijo de la lista** y no por
tamaño: si fuera por tamaño, cada mes tendría las filas en otro lugar y se
perdería justamente lo que hace útil tenerlas todas. El bloque de ingresos está
siempre, aunque el mes no haya tenido ninguno — un mes sin ingresos y un mes con
la fila faltante se ven distinto en una planilla, y solo uno de los dos dice la
verdad.

---

### T-916 · La planilla se parece de verdad a la original
**Estado:** En curso (claude, 2026-08-27) · **Depende de:** T-906, T-915

El usuario mandó **capturas de su planilla real** (2026-08-27), y con eso las
diferencias dejaron de ser una descripción vaga. Lo que hay que cambiar:

| Qué | Cómo está en la app | Cómo está en la planilla real |
|---|---|---|
| Los rubros del resumen | En **filas** (rubro, monto) | En **columnas**: una fila de encabezados con los ocho rubros y una fila de valores debajo |
| El total del bloque | No está | Una columna `TOTAL` al final de cada bloque |
| La columna `MES` | `agosto 2026` | `08/26` |
| El rubro de cada movimiento | Texto sin más | **Fondo de color propio por rubro** |
| Los encabezados del resumen | Texto sin más | El **mismo color** que ese rubro tiene en la columna |
| El título del mes | Negrita | Banda **amarilla** que cruza el ancho |
| Los títulos de bloque | Texto sin más | Banda **rosa** sobre el bloque |
| El saldo | `Saldo` | `SALDO MENSUAL` |
| Las celdas | Sin bordes | Con bordes |

**Los colores van a ser los de la app, no los de la planilla.** Es una decisión
y va con motivo: el usuario pidió (2026-08-27, T-909) que cada rubro tenga un
color propio **ligado a él en todas las visualizaciones**. Si la planilla usara
otros tonos, habría dos idiomas de color para el mismo dato y ninguno de los dos
se podría aprender. Se usan versiones claras de la paleta de T-909, porque en una
celda el color es fondo de un texto negro y no una barra.

**Para que no haya dos paletas que se separen**, los ocho tonos pasan a vivir en
`core/paleta.js`, y un test comprueba que los del CSS sigan siendo los mismos.
`franjaDeRubro()` se muda con ellos: la usaban la pantalla y ahora también la
planilla, y `datos/` no puede importar de `ui/` (ARQUITECTURA).

**Cómo quedó (Hecha, 2026-08-27).** Todo lo de la tabla de arriba. Además:

- Los colores de celda son **versiones claras** de la paleta: en la app el color
  es una barra sin texto encima y necesita saturación; en una celda es el fondo
  de un texto negro, y el mismo tono lo dejaría ilegible. Un test exige que los
  ocho tonos claros pasen un umbral de luminancia.
- La `I/G` va en rojo, como en la original.
- Las celdas vacías se escriben **vacías con formato**, no con un espacio. La
  primera versión ponía un espacio para que se vieran los bordes: andaba, y
  dejaba la planilla llena de celdas que *parecen* vacías y no lo son — filtrar,
  ordenar o contar en Excel las trata como texto.

**Verificado:** 529 tests. Once mutaciones, once detectadas; dos destaparon
huecos —el formato del mes se comprobaba por el **número** de estilo y no por lo
que ese estilo dice, y las bandas combinadas se comprobaban solo en una de las
seis—. Ahora los tests **abren el `.xlsx` y leen `xl/styles.xml`**, que es lo que
Excel lee. El archivo descargado desde el navegador, leído con openpyxl y
exceljs: seis celdas combinadas, `mm/yy` en la columna MES, los fondos de color
por rubro (`Supermercado` naranja claro, `Comida hecha` aguamarina), el mismo
tono en el encabezado del resumen, y la `I/G` en rojo.

---

### T-917 · ~~Los dos gráficos del `.xlsx`~~ — **descartada**
**Respondida por el usuario (2026-08-27):** en el Excel no los quiere; **los
quiere en la app**. → T-918.

Queda anotado por qué se preguntó en vez de hacerlo: generar gráficos de Excel
exige escribir el XML de cada uno como una parte más del ZIP, con su relación y
sus referencias a rangos. Era caro, y resultó ser trabajo que no se iba a usar.
Preguntar costó un párrafo.

---

### T-918 · Los dos gráficos del mes, en la app — **Hecha** (2026-08-28)
**Depende de:** T-013, T-909, T-922 · **Tocó:** `src/ui/pantallas/graficos.js` (nuevo), `resumen.js`, `estilos.css`

Pedido del usuario (2026-08-27), a partir de los que tiene en su planilla:

1. Una **torta de gastos por rubro** con su porcentaje.
2. Una **línea de gasto acumulado día a día** del mes.

**Decidido por el usuario (2026-08-27): la torta REEMPLAZA a las barras.** No se
ponen las dos.

**Lo que hay que cuidar al hacerla, porque la decisión tiene un costo real.** Una
torta se compara peor que una barra: dos porciones de 23 % y 20 % se distinguen
mucho menos que dos barras de esos largos, y el ojo humano compara ángulos peor
que longitudes. La contrapartida es que la torta muestra **el reparto del todo**
de un vistazo, que es exactamente lo que el usuario mira, y es la forma que ya
tiene en su planilla y reconoce.

Como el costo es la comparación entre rubros parecidos, **la tabla de al lado
tiene que seguir estando y ordenada de mayor a menor**: el nombre, el importe y
el porcentaje de cada rubro, que es donde se compara con precisión. La torta da
la forma; la lista da los números. Sin la lista, la decisión sí sería una
pérdida.

Los colores salen de `core/paleta.js`, los mismos que ya tiene cada rubro.

**Lo que quedó hecho, comprobado:**

- La torta reemplazó a las barras en los dos desgloses, y la lista de mayor a
  menor se quedó al lado. Las decisiones y sus motivos, en ADR-030.
- La línea del acumulado lleva gasto e ingreso en un solo eje, y en el mes en
  curso se corta en el día de hoy en vez de quedar plana hasta fin de mes.
- 24 tests nuevos que miden la **geometría** del dibujo, no el texto: el ángulo
  de cada porción, que cierren el círculo, la bandera de arco largo, que la
  torta arranque a las 12, que el acumulado nunca baje, que las dos líneas
  compartan escala.
- Once mutaciones a propósito: las once fallan. La que sobrevivió a la primera
  vuelta —girar la torta un cuarto de vuelta— tiene ahora su test.
- Vuelta por el navegador con los ocho rubros cargados, en claro y en oscuro,
  terminando con una recarga: 0 peticiones de red, 0 errores de consola.

**Y cerró T-020 (CU-05).** Se había dejado abierta pensando que faltaba la tabla
día por día. El usuario la descartó al ver la línea: en el Excel esa tabla existía
solo para poder dibujar el gráfico, y acá el cálculo alimenta la línea directo.

---

### T-919 · Verificar en el celular lo hecho después de T-019
**Estado:** Pendiente · **Depende de:** T-950, T-911 a T-916

El usuario avisó (2026-08-27) que **no pudo probar** en su celular lo que se hizo
después de su verificación: el aviso de almacenamiento, las barras arregladas, el
orden de los campos, el autocompletado, "Cargar" como primera pestaña, que
compartir se deje de ofrecer, y la planilla con la forma nueva.

**Pidió que se le recuerde.** Queda acá para que no dependa de la memoria de
nadie, y hay que mencionárselo al entregar lo siguiente.

**Lo que pasó (usuario, 2026-08-28).**

| Qué | Resultado |
|---|---|
| El aviso de "no puedo guardar" abriendo por `file:///` | **No aparece** — correcto |
| Que compartir se deje de ofrecer tras fallar | **Funciona**: ve la explicación en vez del botón |
| El autocompletado del comentario | **No funciona** → T-920 |
| La planilla en Excel: abre, con colores, con `08/26` | **Todo bien** — lo que no se podía comprobar acá |

**Un error de método, y es mío.** La primera ronda de esta verificación se hizo
sobre el **archivo viejo**: el usuario no había vuelto a bajar el HTML. Los tres
"no funciona" que reportó eran las tres cosas que todavía no existían en su
copia. Se detectó porque los tres fallos encajaban demasiado bien con una sola
causa —y porque el cuarto resultado era la firma exacta de la versión anterior—,
no porque nadie lo hubiera previsto.

**Lo que deja:** cuando se le pide a alguien que verifique algo, la primera
instrucción tiene que ser **cómo obtener la versión que se va a verificar**, y la
primera comprobación tiene que ser **que la tenga**. Sin eso, un informe de
pruebas puede describir un programa que no existe. → va a `docs/USO.md` (T-900).

**Y otro error mío, más chico:** le pedí comprobar que el comentario `Barcelona26`
se autocompletara **sin haberle dicho que primero cargara un gasto con ese
comentario**. El autocompletado ofrece lo ya usado; no puede inventar. Una
instrucción de prueba que pide algo imposible produce un "no funciona" que no
dice nada.

---

### T-920 · Sugerencias propias, sin depender del navegador
**Estado:** En curso (claude, 2026-08-28) · **Depende de:** T-912

T-912 usó `<datalist>`, que dibuja el navegador. En el Android del usuario **no
aparece nada** (verificado por él, 2026-08-28), ni en el comentario ni con un
texto ya cargado. Es L-013 otra vez: un control que dibuja el sistema hace lo que
el sistema quiere, y acá directamente no hace nada.

**Se reemplaza por una lista propia** —unos botones debajo del campo—, que no
depende de que el navegador coopere. Cuesta más código y hay que mantenerla, pero
es la única forma de que se pueda comprobar que funciona.

**Va también en el campo Detalle**, que es donde el usuario lo probó y donde
tiene el mismo sentido: `alquiler`, `luz`, `psicóloga` se repiten todos los meses.

**Lo que hay que cuidar:** la lista aparece mientras se escribe, y ADR-023 dice
que lo escrito vive en el documento y **no se redibuja por tecla**. Se actualiza
solo el trozo de las sugerencias, con la misma técnica que ya usa la fecha en
palabras. Y tocar una sugerencia no puede perder lo demás escrito.

**Cómo quedó (Hecha, 2026-08-28).** Botones debajo del campo, que aparecen al
escribir y desaparecen al elegir uno. Con el campo vacío no se ofrece nada: una
lista de veinte sugerencias apenas se toca el campo tapa el formulario en un
celular.

**Se sugiere sin importar mayúsculas ni espacios de más, pero se muestra la
escritura que ya existe.** Escribir `barcelona` ofrece `Barcelona26`. Y algo que
destapó un test propio: la primera versión salteaba lo que coincidía en clave,
así que escribir `roma` con `Roma` ya cargado **no ofrecía nada** — se saltaba
justo el caso que más importa, que es el que evita crear un segundo grupo con la
misma palabra (RN-03). Ahora solo se saltea lo escrito **igual**.

**Lo que empieza con lo escrito va antes que lo que lo contiene:** escribir
`Roma` y ver `Aeropuerto de Roma` arriba sería contraintuitivo.

**Verificado:** 569 tests. Siete mutaciones, seis detectadas y una equivalente.
Recorrido en un navegador real: con el campo vacío no ofrece nada, `Barce` ofrece
`Barcelona26`, `barcelona` también, tocarla completa el campo **sin perder el
monto ya escrito**, el detalle sugiere lo suyo sin tocar el comentario, lo
guardado coincide con lo que se ve, y **no queda ningún `<datalist>` en la
página**.

**Cambio posterior (usuario, 2026-08-28): el detalle ya no sugiere.** Sugerían
los dos campos. El usuario pidió que solo sugiera el **comentario**, y la razón
es buena: el comentario es lo que **agrupa** —dos escrituras distintas del mismo
viaje son dos totales distintos (RN-03)—, así que ofrecer la escritura que ya
existe evita partir un total en dos. El detalle es una nota para acordarse: no
agrupa nada, y una lista debajo mientras se escribe es ruido.

Se sacó también `detallesUsados()` de `core/calculos.js`, que quedaba sin ningún
llamador. `textosUsados()` sigue parametrizada por campo: si vuelve a hacer
falta, es una línea.

---

### T-921 · Sacar el texto de "compartir no funciona"
**Estado:** En curso (claude, 2026-08-28) · **Depende de:** T-914

Pedido del usuario (2026-08-28): *"si no funciona, ¿no es mejor eliminarlo?"*.

T-914 ya sacó el botón, pero dejó un párrafo permanente explicando por qué no
está. Explicar una vez está bien; explicarlo **cada vez que se entra a la
pantalla** es dejar en la cara un cartel sobre algo que no se puede hacer. Queda
solo la forma de volver a intentarlo, discreta.

**Por qué falla, para que quede escrito.** Compartir un archivo exige un origen
de verdad —un `https://`—, y la app abierta desde el disco no tiene ninguno: es
la misma falta de identidad que hacía perder los datos (T-950). Ahí la ruta del
archivo alcanzó como identidad para el almacenamiento; para compartir, no. **Es
un límite del navegador, no algo que la app pueda resolver**, y por eso la
salida es la descarga y no un arreglo.

*(Sin comprobar: no hay ningún Android en el entorno donde reproducirlo. Es la
explicación más probable de un `Permission denied` desde `file://`.)*

---

## Preguntas abiertas para el usuario

Se responden cuando el usuario quiera; hasta entonces las tareas que dependen de
ellas quedan `Necesita decisión`.

1. **Tipos de cambio históricos (RN-05).** Cambiar un tipo de cambio recalcula
   totales de meses ya cerrados. ¿Está bien así, o preferís que un movimiento
   quede congelado al tipo de cambio del momento en que lo cargaste?
2. **Viajes (T-023).** Las tres preguntas de esa tarea.
3. **Tildes al agrupar (ADR-013).** Hoy `Perú` y `Peru` son dos comentarios
   distintos, así que dos gastos del mismo viaje escritos con y sin tilde no se
   suman juntos. Ignorar las tildes lo arreglaría, pero también juntaría palabras
   que quizá quieras separadas. ¿Cómo lo preferís?

4. ~~**Respaldo periódico a GitHub o a OneDrive.**~~ **Respondida (2026-08-19):**
   se hace **sin red** — la app entrega el archivo al sistema operativo y el
   usuario elige dónde va (T-905) — **más un recordatorio semanal** de que hay
   que respaldar (T-903). La app no habla con ninguna nube: RN-06 queda intacta.
   Lo que sigue abajo es el razonamiento que llevó a esa decisión.

   **Contexto original.** El usuario quiere
   subir sus datos a la nube cada semana o cada quince días, de forma cómoda.
   Hay dos formas y **no son equivalentes**:

   - **Compartir el archivo exportado** desde el propio celular: la app genera el
     respaldo y lo entrega al sistema operativo, que muestra OneDrive, Drive,
     correo, lo que haya. **La app no hace ninguna petición de red**, así que
     RN-06 queda intacta. Requiere que el usuario toque "compartir" cada vez.
   - **Subir sola a una nube**: la app tendría que hablar con la API de OneDrive
     o de GitHub. Eso es **una petición de red**, rompe RN-06, rompe la guardia
     de privacidad de T-007, y obliga a guardar una credencial dentro del
     archivo. Deja de ser cierto que "abrís el HTML y ves que no le habla a
     nadie".

   Hasta que se decida, se construye la primera. Ver T-905.

6. ~~**Corregir los decimales de una moneda: ¿reinterpreta o reescala?**~~
   **Respondida (2026-08-19): reescalar.** Al corregir los decimales de una
   moneda, los montos ya cargados se ajustan para que sigan valiendo lo mismo:
   tus 1500 yenes siguen siendo 1500 yenes. Corregir un dato de la moneda no
   cambia el valor de ningún gasto. → T-908.

   El usuario planteó también la alternativa de **no dejar cambiar los decimales
   nunca** una vez elegidos. Es más simple y más segura, pero deja sin salida a
   quien se equivoca al agregar una moneda, así que se prefiere reescalar. Si
   T-908 resultara más frágil de lo previsto, prohibir el cambio es el plan B —
   y con T-907 (decimales sugeridos) el error se vuelve raro de entrada.

   Contexto original:
   Hoy, si cargaste 1500 yenes con la moneda configurada en 2 decimales y después
   la corregís a 0, esos movimientos pasan a valer 150.000 yenes — el número
   guardado se lee con otra escala (ADR-019). La app avisa cuántos movimientos
   afecta, pero no los toca.
   La alternativa es **reescalar**: al corregir los decimales, ajustar los montos
   guardados para que sigan valiendo lo mismo, y que tus 1500 yenes sigan siendo
   1500 yenes.
   *Lo que yo recomendaría:* reescalar, porque corregir un dato de la moneda no
   debería cambiar el valor de ningún gasto. Pero cambia lo que pasa con datos ya
   cargados, así que lo decidís vos.

5. ~~**Exportar a un Excel de verdad.**~~ **Respondida (2026-08-19):** sí, un
   `.xlsx` que además **reproduzca la forma de la planilla actual** (T-906).
   Lo que sigue abajo es el contexto.

   **Contexto original.** El usuario
   quiere abrir sus datos en una planilla parecida a la que usa hoy. T-018 solo
   prevé CSV, que Excel abre pero sin fechas ni formato.

   **Comprobado, no supuesto:** se puede generar un `.xlsx` de verdad sin ninguna
   librería. Un `.xlsx` es un ZIP con XML adentro, y el formato ZIP admite
   entradas **sin comprimir**, así que ni siquiera hace falta comprimir: alcanza
   con armar el ZIP a mano y calcular un CRC-32 (unas veinte líneas). Se probó
   generando una planilla con encabezados en negrita, fechas, textos y números, y
   abriéndola con un lector de Excel real (openpyxl), que devolvió **las fechas
   como fechas**. Ver T-906.

   **Lo que hay que resolver antes:** el formato obliga a escribir espacios de
   nombres XML que son direcciones `http://…`, y la guardia de privacidad (T-007)
   rechaza cualquier `http://` en el archivo construido. No es una petición de
   red —es un identificador—, pero la guardia no puede distinguirlos hoy.

### Respondidas

- ~~**Monedas.**~~ (2026-08-18) Euro, peso uruguayo, dólar y colón costarricense,
  **y la lista tiene que poder ampliarse desde la app en cualquier momento**.
  → RN-04b, ADR-011, T-008, T-024.
- ~~**Historial.**~~ (2026-08-18) Los montos reales son confidenciales y no van al
  repositorio. Se trabaja contra una planilla de ejemplo con la misma estructura y
  montos inventados. → T-009.
- ~~**Formato de importación.**~~ (2026-08-18) Se lee el `.xlsx` directo, sin
  convertir a CSV. → ADR-010.

### T-946 · Otros grupos de gastos — **Hecha** (2026-08-29)
**Depende de:** T-022, T-023 · **Pedida por el usuario (2026-08-29)** · **Tocó:**
`core/agrupamientos.js` (nuevo), `core/calculos.js`, `ui/pantallas/grupos.js`
(nuevo), `ui/pantallas/fijos.js`, `ui/pantallas/datos.js`,
`ui/pantallas/resumen.js`, `ui/app.js`

La etiqueta agrupa cualquier cosa, no solo viajes y gastos fijos. Una mudanza o
el arreglo del auto **existían en los datos y no se veían en ninguna pantalla**.
Ahora hay una tercera, al lado de las otras dos, en Datos y al final del resumen.

**Lo difícil no fue sumar, fue repartir.** Con tres pantallas mirando las mismas
etiquetas, el error caro es la misma etiqueta en dos listas con dos totales
distintos. Se resolvió con una sola función en cascada —ADR-041— a la que
preguntan las tres, y con `porEtiquetaDeGasto()` compartida para que no puedan
agrupar distinto.

**El 75 % que pidió el usuario no se aplicó, y el número lo explica solo:** su
viaje de prueba es 300 € de rubro `viajes` contra 150 € de comida y transporte,
o sea **66 %**, así que con ese umbral se caería de la pantalla de viajes. Quedó
como la constante `PARTE_DE_VIAJE = 0`; cambiarla es una línea. Está avisado.

**Y una corrección del usuario, el mismo día, que mejoró el diseño.** La
primera versión sacaba de la tarjeta de gastos fijos las etiquetas mixtas, para
que ningún nombre apareciera dos veces. Él lo objetó: *"cómo yo etiquete algo no
debería alterar en nada los totales de rubro, son cosas independientes"*. Tenía
razón —esa tarjeta agrupa por etiqueta los gastos de **un rubro**—, así que la
cascada pasó a decidir **dónde tiene su grupo propio** cada etiqueta, no qué
pantalla puede nombrarla. "Casa" vuelve a gastos fijos con sus 60 € y está
también en otros grupos con sus 70 €, y la fila explica la diferencia:
`conGrupoPropio` es un rótulo, no un descuento.

**Mutaciones:** 20 sembradas, 20 muertas, control final en 0. Dos sobrevivieron
en la primera vuelta: una era real —no filtrar por gastos no rompía ningún
test— y se cubrió con el caso del ingreso adentro de un gasto fijo; la otra es
equivalente (`normalizarClave` sobre un rubro que `crearMovimiento` ya guarda
normalizado) y se dejó por simetría con `viajes.js`.

**Recorrido en el navegador:** cargados una mudanza, un viaje, un gasto fijo
puro y uno mezclado; la pantalla lista los dos grupos con sus totales completos,
tocar uno abre sus gastos filtrados, Roma sigue en viajes, la tarjeta de fijos
anuncia los 60 € que se fueron, y todo sobrevive a la recarga. Cero pedidos de
red, cero errores de consola.

### T-947 · Los rubros de ingreso en la tabla mes a mes — **Hecha** (2026-08-29)
**Depende de:** T-021 · **Pedida por el usuario (2026-08-29)** · **Tocó:**
`core/calculos.js`, `ui/pantallas/evolucion.js`, `ui/pantallas/lista.js`,
`ui/app.js`, `datos/xlsx.js`, `estilos.css`

La tabla decía cuánto entró cada mes, pero no **de dónde**: la columna
`Ingresos` era un total sin desglose, mientras los gastos tenían sus ocho
columnas. El Excel tampoco lo desglosaba.

Ahora hay cuatro columnas más —trabajo, inversiones, regalos, otros—, con el
color que cada rubro de ingreso tiene en el resto de la app, y el total y el
promedio también las desglosan. **Lo mismo en la hoja `Evolución` del .xlsx**:
las dos leen `matrizMesRubro()`, y si la pantalla creciera sola la planilla
pasaría a contar otra cosa.

**El problema del que salió casi todo lo demás: `otros` está en las dos listas
de rubros y son cosas distintas** (RN-02). Dos columnas llamadas "Otros" en la
misma tabla, y encima del mismo gris —la paleta viene de la planilla del
usuario, donde los dos son grises—, es un número leído en la columna
equivocada. Tres consecuencias:

1. **Una banda arriba** que dice "Rubros de gasto" / "Rubros de ingreso", en la
   pantalla y en la hoja del .xlsx.
2. **La celda lleva su tipo**: `data-tipo` además de `data-rubro`. Sin eso,
   tocar "Otros" de ingreso mostraba los otros **gastos** — la peor forma de
   fallar, con datos que parecen bien.
3. **El cartel del filtro dice cuál es**: "Mostrando solo Otros (ingresos)".

**Dos arreglos de la tabla que aparecieron al mirarla en el teléfono**, no en
los tests:

- La banda estaba **centrada** sobre su bloque, así que el rótulo de ocho
  columnas caía en el medio de algo que no entra en la pantalla: estaba y no se
  veía nunca. Va alineada a la izquierda.
- `.tabla-ancha` separaba con `padding`, y **`overflow` recorta en el borde
  interno de la caja**: las columnas que ya habían pasado se seguían dibujando
  en ese centímetro y asomaban por detrás de la columna del mes. Ahora el aire
  va como borde transparente. Es un defecto viejo que la tabla más ancha volvió
  imposible de no ver.

**Mutaciones:** 20 sembradas, 19 muertas. La que sobrevive es el `data-tipo` del
manejador de `ver-celda`, que vive dentro de `iniciar()` y por eso no lo alcanza
`node --test`; se mata en el recorrido del navegador, que toca las dos celdas
"Otros" y comprueba que cada una trae lo suyo.

**Verificación independiente:** el .xlsx exportado, abierto con `openpyxl`. La
banda combinada está donde tiene que estar (C2:J2 y L2:O2) y cada fila cierra:
900 + 0 + 50 + 25 = 975, que es la columna de ingresos.

### T-948 · Publicar la app para poder usarla en un iPhone — **Hecha** (2026-08-30)
**Pedida por el usuario (2026-08-30)** · **Tocó:** `tools/build.mjs`,
`tools/icono.mjs` (nuevo), `tools/privacidad.mjs`, `src/plantilla.html`,
`index.html` (generado)

En un iPhone el archivo bajado **no se puede abrir**: Chrome en iOS no abre
archivos locales y la vista previa de *Archivos* no guarda nada. No era un
problema de instrucciones, era que no existía ningún camino.

Ahora el build escribe la misma app dos veces: `dist/viajecor.html` para bajar e
`index.html` en la raíz, que es lo que GitHub Pages sirve. La dirección queda
`https://agonzalezorge.github.io/viajecor/`, corta y escribible en un teléfono.
Un test compara los dos archivos byte a byte: **dos copias editables por
separado serían dos apps con el mismo nombre** (ADR-043).

**El ícono, que venía fallando desde T-9xx, se resolvió acá y por otro lado.**
No era un problema de cómo crear el acceso directo: en iOS el ícono de "Añadir a
pantalla de inicio" sale de `apple-touch-icon`, y la app no declaraba ninguno.
Ahora lo lleva adentro, como `data:`, dibujado por `tools/icono.mjs` —el PNG se
arma a mano porque no hay dependencias—. De paso desapareció el 404 de
`/favicon.ico`, que se vio sirviendo la app por HTTP.

**La guardia de privacidad creció con la puerta nueva:** un `<link rel="icon">`
que no sea `data:` rompe la construcción, con su test.

**Probado sirviendo la app por HTTP**, que es como va a estar en Pages y no es
lo mismo que `file://`: se carga desde la dirección corta sin nombre de archivo,
guarda un movimiento, sobrevive a la recarga, y una segunda pestaña del mismo
origen ve los mismos datos. **Un solo pedido a la red —la propia página— y cero
errores de consola.**

**Lo que queda en manos del usuario:** prender Pages en Settings. Los pasos
están en `USO.md §1b`, junto con las dos advertencias que importan: iOS borra lo
guardado si el sitio no se abre en 7 días, y los datos de la app abierta como
archivo no se mudan solos —hay que exportar el `.json` e importarlo—.

### T-949 · Publicar en Vercel, con la CSP que hace cumplir el cero red — **Hecha** (2026-08-30)
**Depende de:** T-948 · **Decidida por el usuario (2026-08-30)** · **Tocó:**
`vercel.json` (nuevo), `docs/USO.md`, `README.md`

El usuario eligió Vercel sobre GitHub Pages por dos razones reales: un **origen
propio** —el navegador guarda los datos por origen, y `github.io` está
compartido con todo lo que publique ese usuario— y una dirección más corta.

**Lo mejor apareció después de elegir.** Vercel deja mandar cabeceras propias y
Pages no, así que el sitio va con una **CSP** que le prohíbe al navegador
conectarse a internet, enviar formularios y traer nada de afuera. La app ya
prometía eso y la construcción lo verificaba; ahora **el navegador lo hace
cumplir**, incluso si algún día alguien agregara una llamada sin darse cuenta.
Con test: aflojar la política pone algo en rojo.

**Probado con esas cabeceras puestas, no con la app suelta:** carga, guarda,
sobrevive a la recarga, dibuja la tabla con sus bandas y los dos gráficos, y
—lo que más riesgo corría— **baja el `.json` y el `.xlsx`**, que salen de un
`blob:` que una política mal escrita bloquea sin dar error. Un `fetch` a
internet, probado a propósito, queda bloqueado. Cero errores de consola.

**El primer despliegue falló, y valió la pena.** Vercel corrió el build —bien— y
después buscó una carpeta `public` que no existía: `index.html` estaba en la
raíz porque el plan anterior era GitHub Pages, que sirve desde ahí. Todo lo que
se había probado era sobre **la app**; nada tocaba el **despliegue**, que es otro
sistema con sus propias convenciones (L-030). Ahora el build escribe
`public/index.html`, `vercel.json` lo dice explícito, hay un test que comprueba
que la configuración apunte a donde el build escribe, y el despliegue se
reprodujo en un clon limpio con `npm install` y `npm run build` antes de decir
que andaba.

**Lo que queda en manos del usuario:** importar el proyecto en Vercel. Los pasos
están en `USO.md §1b`, con la advertencia que importa: **los datos no se mudan
solos** entre el archivo y el sitio web, hay que exportar el `.json` e
importarlo.

### T-950 · Que la app publicada abra sin conexión — **Hecha** (2026-08-31)
**Depende de:** T-949 · **Pedida por el usuario (2026-08-31)** · **Tocó:**
`src/servicio.js` (nuevo), `src/datos/instalacion.js` (nuevo),
`tools/manifiesto.mjs` (nuevo), `tools/build.mjs`, `tools/privacidad.mjs`,
`tools/icono.mjs`, `src/ui/app.js`, `src/ui/pantallas/datos.js`, `vercel.json`

Lo que se había perdido al pasar del archivo a la web: abrir con el modo avión
puesto. Vuelve, y con dos cosas más que van en el mismo viaje —el ícono de
Android con nombre y color propios, y el pedido de que el navegador no borre los
datos por falta de espacio—. Todo el porqué está en ADR-045.

**Lo que más me enseñó esta tarea fue cómo probarlo.** El recorrido en el
navegador corta la red de verdad —y eso hay que hacerlo—, pero solo cubre el
camino feliz y el camino sin red. Los casos que hacen daño son otros: guardar un
error 500 como si fuera la app, no tirar nunca la copia vieja, interceptar
pedidos ajenos. El trabajador de servicio es **JavaScript común que recibe su
mundo del entorno**, así que se lo puede ejecutar en `node --test` con un `self`,
un `caches` y un `fetch` de mentira y mirar qué hace. Siete tests que de otra
forma habrían sido siete suposiciones.

**Mutaciones:** 20 sembradas, 18 muertas. Las dos que sobreviven son
equivalentes y quedan anotadas: sacar `if (!almacen?.persist)` cae igual en el
`try/catch` que devuelve `'no se sabe'`, y sacar `if (persistencia ===
undefined)` cae igual en el `texto ? … : ''` de la línea siguiente. Las dos son
guardas explícitas cuyo efecto ya está cubierto una línea más abajo; se dejan
porque dicen lo que se está protegiendo.

**Recorridos en el navegador, los dos:** publicada —el trabajador queda activo,
el manifiesto colgado, la red cortada de verdad, gastos cargados sin conexión y
todo intacto al volver la red— y **el archivo desde el disco**, donde lo
importante es lo que NO pasa: no cuelga el manifiesto, no registra nada, cero
pedidos fuera del archivo y cero errores de consola.

### T-951 · El respaldo perdía las fechas de los viajes — **Hecha** (2026-08-31)
**Depende de:** T-941 · **Encontrada leyendo el código, no por un síntoma** ·
**Tocó:** `src/datos/exportar.js`, `src/datos/importar.js`

`contenidoDelRespaldo()` guardaba movimientos, tipos de cambio, monedas y
preferencias, y **no `fechas_de_viaje`**. Es el único dato del estado que no se
puede recalcular mirando los movimientos —un viaje empieza antes del primer
gasto anotado— y era el único que no se respaldaba. Al restaurar, la app volvía
a preguntar "¿Cuándo fue?" por viajes ya contestados, **sin avisar nada**
(L-031).

Al **reemplazar**, las fechas del respaldo entran tal cual. Al **agregar**, las
que ya están en el dispositivo mandan: lo de acá es lo más nuevo que se sabe, y
las del respaldo que no tienen par entran igual.

**Mutaciones:** 5 sembradas, 5 muertas.

**Recorrido en el navegador**, el circuito completo y en un perfil limpio:
cargar un viaje con sus fechas, respaldar, empezar de cero, pegar el respaldo e
importar. El viaje vuelve con "42,00 € por día en 10 días · 01/07/2026 →
10/07/2026". Antes volvía sin nada de eso.

**Aviso para el usuario:** un respaldo hecho con una versión anterior **no
tiene** esas fechas adentro. Hay que volver a bajarlo.

### T-040 · Modelo de ahorros · T-041 · Pantalla · T-042 · Importar la hoja — **Hechas** (2026-08-31)
**Cierran la etapa 4 y CU-14** · **Tocó:** `core/ahorros.js`,
`datos/importar-ahorros.js`, `ui/pantallas/ahorros.js` (nuevos),
`datos/planilla.js`, `datos/almacenamiento.js`, `datos/exportar.js`,
`datos/importar.js`, `ui/app.js`, `ui/pantallas/datos.js`

**Se empezó abriendo la planilla del usuario, no imaginándola.** Mandó su hoja el
2026-08-31 y se leyó con `openpyxl` antes de escribir una línea: encabezados en
la fila 3, `Comentarios | DÍA | DETALLES | MONEDA | MONTO | ALE/IRE | I/G`. Está
documentada en `MAPEO-EXCEL.md` §12.

**Lo que la hoja enseñó sin querer:** sus tres cuadros de totales suman **tres
rangos distintos** de la misma tabla (`$E4:$E89`, `$E4:$E93`, `$E4:$E97`). Con
once filas no muerde; pasadas las 89, los cuadros dejan de cerrar entre sí sin
decir nada. Es L-001 otra vez, en la hoja que estamos reemplazando.

**La decisión que ordena todo el módulo: no se convierte nada a euros.** Un plazo
fijo en pesos uruguayos es un plazo fijo en pesos uruguayos. **No existe ningún
total que junte las monedas**, y hay un test cuyo trabajo es que ese número no
aparezca nunca. La pantalla lo dice con todas las letras para que no se lea como
algo que falta.

**Tres cosas que decidió el usuario y cambiaron el diseño:**
- **Historial, no foto**: se anotan movimientos (`I`/`G`) y la app suma.
- **ALE / IRE** fijos: una lista editable sería una pantalla más para mantener
  algo que nadie va a tocar.
- **El detalle no agrupa**: "plazo fijo" es información suya para leer. Se cayó
  el bloque "por etiqueta" que yo había propuesto.

**Se lee en la misma importación que los gastos**, porque el usuario elige un
archivo y no una hoja. Para eso hubo que hacer bien algo que estaba a medias:
`leerPlanilla` agarraba `sheet1.xml` por su nombre de archivo y lo decía —"si
algún día hace falta la segunda hoja, hay que hacerlo bien"—. Hizo falta: los
ahorros son la tercera. Ahora se cruzan `workbook.xml` y sus relaciones, que es
lo que da el nombre visible de cada pestaña.

**La copia que mandó vino con la columna MONTO vacía**, y el importador lo dice
fila por fila —"la fila no tiene monto"— en vez de traer once movimientos en
cero, que es la forma silenciosa de arruinar un historial.

**Verificación independiente:** como no había montos con qué probar, se fabricó
una planilla con la misma estructura y montos conocidos, y se comparó lo que
suma la app contra lo calculado aparte con `openpyxl`. **La comprobación
encontró una diferencia real**: una fila sin persona que la planilla suma y la
app no. Es exactamente para lo que existe ese cuadro.

**Recorrido en el navegador:** importar la planilla, ver la previa —cuántos
ahorros entran, qué filas no y por qué, y en qué moneda no cuadra el total—,
traerlos, recargar y mirar la pantalla. Cero pedidos de red, cero errores de
consola.

### T-043 · El signo de las salidas del ahorro — **Hecha** (2026-08-31)
**Encontrada por el usuario importando su planilla de verdad** · **Tocó:**
`datos/importar-ahorros.js`, `ui/pantallas/datos.js`

Las cuatro filas `G` de su hoja no entraron: llevan el monto en negativo y el
importador las rechazaba con el mensaje del modelo, pensado para los gastos.
Eran justo los movimientos de plata que salió del ahorro.

**El signo viene dos veces —en la columna I/G y en el número— y dicen lo mismo**,
así que se usa el valor absoluto. Cuando se contradicen (negativo marcado `I`),
la fila se informa: adivinar el signo de una operación de dinero es exactamente
lo que este proyecto no hace.

**Y el informe no servía:** decía "Decía: ." porque los problemas de ahorros
traían `crudo` y la pantalla escribe `decia`. Un número de fila sin contenido
obliga a abrir la planilla para saber de qué fila están hablando. Ahora muestra
comentario, persona, moneda y monto, y se fueron los dos puntos seguidos.

**Por qué no lo vieron las pruebas:** la copia que el usuario había mandado venía
con la columna MONTO **vacía**, así que ninguna fila llegaba a la parte del
signo. Se probó todo lo que se podía probar con lo que había, y no alcanzaba —
la única prueba real era su planilla con datos.

**Verificación:** se rehízo la planilla de prueba con negativos en las salidas y
se comparó contra `openpyxl`. Las ocho filas entran, cero problemas, y los tres
totales por moneda **cuadran al céntimo** con los que calcula Excel.

**Mutaciones:** 19 sembradas, 19 muertas.

### T-044 · Ver qué va a entrar al importar, no solo cuántos — **Hecha** (2026-08-31)
**Pedida por el usuario (2026-08-31)** · **Tocó:** `ui/pantallas/datos.js`,
`ui/app.js`, `core/formato.js`, `estilos.css`

Reimportó su planilla después de haber borrado un movimiento a mano, la app le
dijo *"voy a traer 11 ahorros y 1 movimiento"* y **no tenía forma de saber cuál
era ese movimiento**. El número solo sirve en la primera importación; en la
segunda, el que aparece es casi siempre uno que él había sacado a propósito, y
sin verlo hay que aceptar a ciegas y salir a buscarlo después.

Ahora la previa lista lo que va a entrar —gastos y ahorros juntos, del más nuevo
al más viejo—, cada uno con su fecha, su rubro o de quién es, su importe y su
etiqueta. **Con pocos viene abierta; con muchos, plegada** y con los primeros 25:
en la primera importación son cientos y abrirlos haría una pantalla inmanejable,
justo cuando la lista no aporta nada.

**De paso se arregló algo que estaba mal en silencio:** los importes se
formateaban con decimales de euro para cualquier moneda. Para las cuatro que usa
hoy da igual —todas usan dos— pero para el yen habría mostrado `¥1.500,00`, un
número que no existe. Ahora hay `formatearEnSuMoneda()`, que saca los decimales
del catálogo del usuario, y la pantalla de ahorros la usa también.

**Mutaciones:** 10 sembradas, 8 muertas. Las dos que sobreviven son los filtros
`!yaEstan.has(...)` de `iniciar()`, que no alcanza `node --test` porque viven
dentro de la función que toca el documento. **Las mata el recorrido**: si no
filtraran, al reimportar diría "los 8 que van a entrar" en vez de "el que va a
entrar".

**Recorrido en el navegador, el caso exacto del usuario:** importar, borrar un
movimiento a mano, reimportar. La app dice *"Ver el que va a entrar"* y lista
"Ahorro · IRE · −180,00 € · 29/04/2026 · Cacerola Le Creuset". Cero pedidos de
red, cero errores de consola.

### T-045 · Cargar, corregir y borrar ahorros desde la app — **Hecha** (2026-08-31)
**Pedida por el usuario (2026-08-31)** · **Tocó:** `ui/pantallas/ahorro.js`
(nuevo), `ui/pantallas/ahorros.js`, `ui/pantallas/resumen.js`,
`ui/pantallas/movimiento.js`, `ui/app.js`

La pantalla de ahorros era de **solo lectura**: se llenaba importando la
planilla y nada más. Para anotar un ahorro nuevo había que escribirlo en el
Excel y reimportar — o sea, seguir usando la planilla que la app vino a
reemplazar. Era un hueco, no una decisión.

**Formulario aparte del de gastos, y el usuario lo dijo antes que yo:** "no son
gastos e ingresos normales, son una cosa aparte". Un ahorro no tiene rubro y sí
tiene persona; no entra en el saldo ni en la evolución. Meter una tercera opción
en el formulario que se usa todos los días haría más lenta la carga diaria para
servir a la mensual.

**Pero funciona exactamente igual**: mismo borrador, misma función pura que
devuelve estado nuevo, mismos avisos, pregunta antes de borrar y deja deshacer.
Que dos pantallas parecidas tengan mecánicas distintas obliga a aprender la app
dos veces.

**Dos diferencias que sí importan:**
- Dice **"Entró al ahorro" / "Salió del ahorro"** en vez de Ingreso / Gasto: un
  ahorro usado para pagar un vuelo no es un ingreso de nada.
- **No pide tipo de cambio**, a diferencia de los gastos (RN-04). Es la misma
  regla vista del otro lado: los ahorros no se convierten a euros nunca, así que
  no hay ningún total del que puedan quedar afuera. Pedir un dato que no se va a
  usar es pedirlo porque sí.

**El botón va al final del mes**, con los otros historiales, y **también en el
mes vacío**: sin eso, un mes sin gastos dejaba los ahorros inalcanzables desde
ahí — el mismo defecto que ya había tenido la evolución.

**Un defecto encontrado por el recorrido, no por los tests:** la vista inicial no
trae el borrador del formulario de ahorros —se abre desde su pantalla, no al
arrancar—, así que la primera carga salía con `tipo: undefined` y el modelo la
rechazaba con un mensaje que hablaba de "undefined". Los tests no podían verlo
porque siempre le pasan un borrador.

**Mutaciones:** 12 sembradas, 12 muertas.

**Recorrido en el navegador:** cargar dos movimientos en monedas distintas,
corregir uno —cambiándole el monto y la persona—, borrar otro y ver que pregunta,
deshacer, recargar y comprobar que quedó como debía. Más el caso de un monto
cero, que no se guarda y no borra lo escrito. Cero pedidos de red, cero errores
de consola.
