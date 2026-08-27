# Producto — Viajecor

> Documento vivo. Se actualiza **en el mismo cambio** que agrega o modifica una
> función, nunca "después". Si cambiás una regla de negocio en el código y no la
> cambiás acá, el cambio está incompleto.
>
> Última actualización: 2026-08-19 · Versión del documento: v0.1

---

## 1. El problema

Hoy los gastos personales se llevan en una planilla de Excel (`Viaje Coruña 2`)
con tres hojas. Funciona, pero tiene cuatro problemas concretos:

1. **No se puede cargar un gasto en el momento.** Anotar desde el celular en una
   planilla con bloques mensuales y fórmulas es incómodo, así que los gastos se
   acumulan y se cargan de memoria más tarde — que es cuando se pierden.
2. **Los totales pueden mentir en silencio.** Las fórmulas de la hoja `Analisis1`
   suman rangos fijos (`$G$8:$G$1027`). Cuando el registro pase de esa fila, los
   totales van a dar mal **sin ningún aviso**. Ver `docs/LECCIONES.md`.
3. **Agrupar por viaje depende de escribir el texto exacto.** El nombre del viaje
   vive en un campo libre. Un `Roma ` con espacio de más no entra en el total de
   Roma y nadie se entera.
4. **Agregar un mes es trabajo manual.** Cada bloque mensual se copia y se ajustan
   las fórmulas a mano.

## 2. Qué es Viajecor

Una aplicación de registro de gastos personales que:

- Se abre **desde un solo archivo HTML**, sin instalar nada y **sin conexión**.
- Guarda **todos los datos en el dispositivo**. No hay servidor, no hay cuenta, no
  hay ninguna petición de red. Ver la sección 6, Privacidad.
- Permite **exportar los datos en cualquier momento** en un formato abierto.
- Reproduce los cálculos que ya se usan en el Excel, sin los rangos fijos que se
  rompen.

## 3. Usuario

Una sola persona, en su propio dispositivo (celular como uso principal,
computadora para revisar y exportar). No hay usuarios múltiples, no hay roles, no
hay compartición. Si eso cambia, cambia este documento primero.

**El celular es Android** (dicho por el usuario, 2026-08-19). Eso fija en qué hay
que probar de verdad y qué deja de importar:

- La prueba que cuenta es **Chrome en Android**, con el archivo abierto desde el
  almacenamiento del teléfono. Es lo que hay que verificar en T-019.
- Los riesgos específicos de **Safari en iOS** —que puede borrar el
  almacenamiento tras semanas sin uso— dejan de aplicar mientras el uso sea
  Android. Quedan anotados igual en `ARQUITECTURA.md` §12 por si algún día se
  abre en un iPhone.
- Lo que **no** cambia: la app se sigue escribiendo sin nada específico de un
  navegador. Está hecha con lo que traen todos, y probarla en Android no es lo
  mismo que atarla a Android.

## 4. Vocabulario del dominio

Los nombres vienen del Excel y **se respetan tal cual** — cambiarlos obligaría a
retraducir mentalmente todo lo que ya está en la cabeza del usuario.

| Término | Qué es |
|---|---|
| **Movimiento** | Una línea del registro: un gasto o un ingreso. |
| **Tipo** | `G` (gasto) o `I` (ingreso). En el Excel es la columna `I/G`. |
| **Rubro** | La categoría del movimiento. Listas distintas para gasto y para ingreso. |
| **Comentario** | Etiqueta corta y reutilizable: el nombre de un viaje (`Roma`) o de un gasto fijo recurrente (`Luz`). Es lo que permite agrupar. |
| **Detalle** | Texto libre, para acordarse de qué fue. No se usa para agrupar. |
| **Tipo de cambio (TC)** | Cuánto vale una moneda en euros, para un mes dado. |
| **Moneda base** | El euro. Todo total se expresa en euros. |

### Rubros de gasto
`gastos fijos` · `supermercado` · `comida hecha` · `viajes` · `entretenimiento` ·
`transporte` · `salud` · `otros`

### Rubros de ingreso
`trabajo` · `inversiones` · `regalos` · `otros`

> El rubro `otros` existe en las dos listas y son cosas distintas: "otros gastos"
> y "otros ingresos" no se mezclan nunca en un mismo total — y por eso tampoco se
> muestran del mismo color.

**Cada rubro tiene su color, y es siempre el mismo.** `supermercado` se ve igual
en el resumen del mes, en la lista y en el formulario, así que la barra más larga
se reconoce sin leer su nombre. **El color depende del rubro, nunca de cuánto
gastaste en él:** si dependiera del tamaño, cargar un gasto repintaría media
pantalla y el color pasaría a significar "el más grande de este mes" en vez de
"supermercado".

Los rubros se **muestran** con mayúscula inicial (`Gastos fijos`) y se **guardan**
en minúscula, que es la forma que hace que `VIAJES` y `viajes` sean el mismo
rubro (RN-03).

## 5. Reglas de negocio

### RN-01 — Un movimiento siempre tiene fecha completa
En el Excel el día y el mes viven en columnas separadas, lo que permite que se
desincronicen. Acá un movimiento tiene **una fecha**, y el día y el mes se derivan
de ella. No se puede guardar un movimiento con día 1 en un mes que dice noviembre
si la fecha real es otra.

### RN-01b — La app no registra horas
Un movimiento tiene el día en que se gastó y el día en que se cargó. **Nada más.**
No se guarda a qué hora hiciste ninguna de las dos cosas, ni hace falta.

*Por qué es una regla y no un detalle:* un dato con hora hay que interpretarlo en
alguna zona horaria, y ahí es donde una fecha se corre de día — el gasto del 14 se
muestra el 13 (L-011). Sin horas, ese problema no existe.

### RN-02 — El rubro tiene que pertenecer a la lista del tipo
Un movimiento de tipo `G` solo acepta rubros de gasto; uno de tipo `I`, solo
rubros de ingreso. La app no deja elegir mal.

### RN-03 — Comparaciones sin distinguir mayúsculas ni espacios
Todo texto que sirva para agrupar (rubro, comentario, moneda) se compara
**normalizado**: sin espacios al principio ni al final, sin distinguir mayúsculas
de minúsculas. `VIAJES`, `viajes` y ` Viajes ` son el mismo rubro. Esta regla
existe porque el Excel ya tiene esa inconsistencia y ahí no molesta (Excel compara
así por defecto); una app que compare exacto rompería los totales en silencio.

**El comentario se muestra tal como lo escribiste.** Si escribís `Roma`, la app
dice `Roma`, no `roma`: la normalización decide cuándo dos comentarios son el
mismo, no cómo se ven (ADR-013).

**Las tildes sí cuentan:** hoy `Perú` y `Peru` son dos comentarios distintos. Es
una decisión pendiente, anotada en `docs/PLAN.md`.

### RN-04 — Multimoneda con tipo de cambio mensual
- Cada movimiento se carga **en la moneda en que se gastó**, con su monto original.
- El tipo de cambio se define **por moneda y por mes**: un valor de "cuántos euros
  es una unidad de esa moneda", que rige para **todos los movimientos de ese mes**
  en esa moneda.
- **Al cargar el primer movimiento de una moneda en un mes que todavía no tiene
  tipo de cambio, la app lo pide** antes de guardar. No se guarda un movimiento en
  moneda extranjera sin tipo de cambio.
- Los movimientos en euros no necesitan tipo de cambio (es 1 por definición).
- **Todos los totales se expresan en euros**, convertidos con el tipo de cambio
  del mes correspondiente.
- La moneda elegida en una carga queda como **predeterminada para la siguiente**,
  hasta que se cambie. Esto evita reelegir "colón" treinta veces en un viaje a
  Costa Rica.

### RN-04b — La lista de monedas la maneja el usuario
La app arranca con cuatro monedas cargadas, que son las que el usuario usa hoy:

| Código | Moneda | Decimales |
|---|---|---|
| `EUR` | Euro — **moneda base** | 2 |
| `UYU` | Peso uruguayo | 2 |
| `USD` | Dólar estadounidense | 2 |
| `CRC` | Colón costarricense | 2 |

**Se pueden agregar monedas nuevas desde la app, en cualquier momento** (CU-15),
indicando código, nombre y cuántos decimales usa. Las monedas viven en los datos,
no en el código: agregar una para un viaje imprevisto no puede depender de que
alguien publique una versión nueva de la app.

El **euro es distinto**: es la moneda base, viene fija, y no se puede borrar ni
cambiarle los decimales, porque todos los totales se expresan en euros.

**Qué son los decimales, y qué NO son:** no dicen cómo tenés que escribir un
monto. En euros podés escribir `15` o `15,00` y es lo mismo. Dicen cuántas
subunidades tiene la moneda: el euro tiene céntimos, el yen no tiene nada más
chico que el yen. La app propone 2 y explica qué significa.

**Si te equivocás al elegirlos, no pasa nada grave** — mientras no los cambies
después. Un yen configurado con 2 decimales guarda tus 1500 yenes de una forma un
poco rara por dentro, pero los muestra y los convierte a euros perfectamente.
**Y si los corregís más adelante, la app ajusta tus gastos** para que sigan
valiendo lo mismo: 1500 yenes siguen siendo 1500 yenes (decidido el 2026-08-19,
ver T-908). El único caso en que se pierde algo es al **bajar** los decimales —
1500,50 no puede existir en una moneda sin decimales—, y ahí la app dice cuántos
movimientos se redondean **antes** de aplicar el cambio. Ver ADR-019.

Una moneda **que ya tiene movimientos cargados no se puede borrar** — dejaría
movimientos huérfanos sin forma de convertirlos. Se puede ocultar de la lista.

### RN-05 — El importe en euros se deriva, no se congela
Se guarda el **monto original y su moneda**. El importe en euros se **recalcula**
siempre a partir del tipo de cambio vigente para (moneda, mes).

*Por qué:* si al volver de un viaje se descubre que el tipo de cambio cargado
estaba mal, corregirlo una vez arregla el mes entero. Si se congelara el importe
convertido en cada movimiento, habría que corregir uno por uno.

*Contrapartida:* cambiar un tipo de cambio **cambia totales históricos ya vistos**.
La app avisa cuántos movimientos se ven afectados antes de aplicar el cambio.

> ⚠️ Decisión reversible, anotada en `docs/DECISIONES.md` (ADR-004). Si preferís
> que un movimiento quede congelado al tipo de cambio del día en que se cargó,
> decilo y se cambia — es un cambio chico ahora y caro más adelante.

### RN-06 — Nada sale del dispositivo
La app no hace ninguna petición de red, nunca. No carga fuentes, íconos, ni
librerías desde internet. Ver sección 6.

### RN-07b — El respaldo se comparte, la app no lo sube
Se puede guardar el respaldo en OneDrive, en Drive o donde sea, **pero lo sube el
usuario, no la app**: la app arma el archivo y se lo entrega al sistema operativo,
que abre el menú de compartir de siempre. Así se puede tener el respaldo en la
nube **sin que la app haga una sola petición de red** (RN-06 intacta).

La app **avisa una vez por semana** si hace más de siete días que no se respalda.
No es una notificación del sistema —eso exigiría permisos y un servidor, que la
app no tiene—: es un aviso dentro de la app, cuando se abre.

> Decidido el 2026-08-19. La alternativa era que la app subiera sola a la API de
> OneDrive o de GitHub: más cómodo, pero obliga a guardar una credencial dentro
> del archivo HTML y hace que "abrís el HTML y ves que no le habla a nadie" deje
> de ser comprobable. Ver `docs/PLAN.md`, pregunta 4.

### RN-07 — Los datos se pueden sacar siempre
En cualquier momento, con la app abierta y sin conexión, se puede exportar el
total de los datos a un archivo que el usuario guarda donde quiera. El formato es
abierto y legible sin la app.

---

## 6. Privacidad — el requisito no negociable

Esto no es una característica más: es la razón por la que la app se construye así.

- **Todo se guarda en el navegador del dispositivo.** Ningún dato viaja a ningún
  lado.
- **La app no tiene servidor.** No hay a dónde mandar nada aunque se quisiera.
- **Sin recursos externos.** Cero peticiones a internet: si la app pidiera una
  fuente a un CDN, ese CDN vería la IP y la hora en que se usa la app.
- **Sin analítica, sin telemetría, sin reporte de errores remoto.**

**Riesgos reales que el usuario debe conocer** (en lenguaje llano):

1. **Borrar los datos del navegador borra la app entera.** "Limpiar datos de
   navegación" en el celular puede borrar todo el historial de gastos. Por eso el
   respaldo por exportación no es opcional: es la única copia de seguridad.
2. **No hay sincronización entre dispositivos.** Lo cargado en el celular no
   aparece en la computadora salvo que se exporte y se importe a mano.
3. **Los datos no están cifrados.** Quien tenga el dispositivo desbloqueado puede
   abrir la app y ver los gastos. La protección es la del dispositivo, no la de la
   app.
4. **Un archivo exportado es un archivo común.** Si se manda por mail o se sube a
   una nube, deja de ser privado. La privacidad la garantiza la app hasta el
   momento de exportar; de ahí en adelante, la garantiza el usuario.

---

## 7. Casos de uso

Cada caso de uso es una cosa que el usuario puede hacer, escrita paso a paso. La
columna *Estado* dice si ya está construido. **El plan de implementación
(`docs/PLAN.md`) es el que dice qué se construye después**; acá solo se registra
qué existe.

| ID | Caso de uso | Estado |
|---|---|---|
| CU-01 | Registrar un gasto | **Hecho** (T-011) |
| CU-02 | Registrar un ingreso | **Hecho** (T-011) |
| CU-03 | Definir el tipo de cambio de una moneda para un mes | **Hecho** (T-005, T-012) |
| CU-04 | Ver el resumen del mes | **Hecho** (T-013, T-014) |
| CU-05 | Ver el gasto día por día del mes | Pendiente |
| CU-06 | Corregir o borrar un movimiento | **Hecho** (T-015) |
| CU-07 | Exportar todos los datos | **Hecho** en JSON (T-016); el CSV es T-018 |
| CU-08 | Importar un respaldo | **Hecho** (T-017) |
| CU-09 | Usar la app sin conexión | Pendiente |
| CU-10 | Ver la evolución mes a mes | Pendiente |
| CU-11 | Ver cuánto costó un viaje | Pendiente |
| CU-12 | Ver el promedio de un gasto fijo | Pendiente |
| CU-13 | Importar el historial del Excel | Pendiente |
| CU-14 | Llevar los ahorros conjuntos | Pendiente |
| CU-15 | Agregar una moneda | Lógica hecha (T-008); falta la pantalla (T-024) |

---

### CU-01 — Registrar un gasto

**Para qué:** anotar un gasto en el momento en que ocurre, en menos de quince
segundos y sin conexión.

**Pasos:**
1. El usuario abre la app y toca "Nuevo movimiento".
2. La app propone: fecha = hoy, tipo = gasto, moneda = la última que usó.
3. El usuario escribe el monto y elige el rubro.
4. Opcionalmente escribe un comentario (`Roma`, `Luz`) y un detalle.
5. Si la moneda elegida no tiene tipo de cambio para ese mes, la app lo pide
   (ver CU-03) y no guarda hasta tenerlo.
6. El usuario guarda. El movimiento aparece en la lista del mes y los totales se
   actualizan.

**Reglas que aplican:** RN-01, RN-02, RN-03, RN-04.

**Qué puede salir mal:**
- Monto vacío o cero → la app no guarda y lo dice.
- Monto negativo → no se acepta; un gasto se registra como gasto, no como número
  negativo. (El signo lo da el campo *tipo*.)
- Fecha futura → se permite, pero la app avisa. Se puede querer anotar algo ya
  pagado que corresponde a otro día.

---

### CU-02 — Registrar un ingreso

Igual que CU-01, con tipo = ingreso y la lista de rubros de ingreso.

**Reglas que aplican:** RN-01, RN-02, RN-03, RN-04.

---

### CU-03 — Definir el tipo de cambio de una moneda para un mes

**Para qué:** poder registrar gastos de un viaje en la moneda local y que los
totales sigan siendo comparables en euros.

**Pasos:**
1. El usuario carga el primer movimiento en, por ejemplo, colones, en marzo.
2. La app detecta que no hay tipo de cambio para (colón, marzo) y lo pide:
   *"¿Cuántos euros es 1 colón?"* — con la opción de escribirlo al revés
   (*"¿Cuántos colones es 1 euro?"*), que es como suele venir la información.
3. El usuario lo escribe y confirma.
4. El movimiento se guarda. Todos los movimientos en colones de marzo usan ese
   valor.

**También:** desde la pantalla de tipos de cambio, el usuario puede ver, agregar
o corregir cualquier tipo de cambio de cualquier mes.

**Reglas que aplican:** RN-04, RN-05.

**Qué puede salir mal:**
- Corregir un tipo de cambio ya usado cambia totales pasados. La app dice
  cuántos movimientos se ven afectados **antes** de aplicar el cambio.
- Tipo de cambio cero o negativo → no se acepta.

---

### CU-04 — Ver el resumen del mes

**Para qué:** responder "¿cómo vengo este mes?" de un vistazo. Reemplaza los
bloques `GASTOS POR TIPO`, `INGRESOS POR TIPO` y `TOTALES` del Excel.

**Muestra:**
- Total de gastos, total de ingresos y **saldo** (ingresos − gastos) del mes.
- Gastos desagregados por rubro, de mayor a menor.
- Ingresos desagregados por rubro.
- Todo en euros, convertido según RN-04.

---

### CU-05 — Ver el gasto día por día del mes

**Para qué:** reemplaza el bloque `GASTO POR DÍA` del Excel.

**Muestra**, para cada día del mes: gasto del día, gasto acumulado, ingreso del
día, ingreso acumulado.

---

### CU-06 — Corregir o borrar un movimiento

**Para qué:** un monto mal tipeado no puede quedar para siempre.

**Pasos:** el usuario toca un movimiento de la lista, lo edita y guarda; o lo
borra.

**Qué puede salir mal:** borrar es destructivo. La app **pide confirmación** y
ofrece **deshacer** inmediatamente después.

---

### CU-07 — Exportar todos los datos

**Para qué:** es el respaldo del usuario y su garantía de que los datos son
suyos. Sin esto, un borrado de datos del navegador pierde todo.

**Pasos:**
1. El usuario toca "Exportar".
2. La app genera un archivo con **todos** los movimientos, tipos de cambio y
   configuración, y el navegador lo descarga.
3. Funciona sin conexión.

**Cómo llega a la nube (T-905).** En el teléfono, el botón principal es
**Compartir el respaldo**: abre el menú del sistema y el usuario elige OneDrive,
Drive o un correo a sí mismo. **La app no sube nada** — le pasa el archivo al
teléfono y ahí termina su parte, así que RN-06 queda intacta. Es la diferencia
entre un paso y cuatro, y el respaldo que exige cuatro pasos cada semana es el
que no se hace.

- El botón **solo aparece si el teléfono sabe compartir archivos**. Si no,
  *Descargar* sigue siendo el camino principal y no cambia nada.
- **Cancelar no cuenta como respaldo**: si el usuario abre el menú y se
  arrepiente, la app no dice nada y no anota la fecha.
- Sigue valiendo la advertencia: **un respaldo guardado en la nube deja de ser
  privado.** La app garantiza la privacidad hasta que el archivo sale.
- Falta comprobarlo en el Android del usuario — es parte de T-019.

**Formatos:** JSON (completo, sirve para reimportar), CSV, y `.xlsx` con la
forma de la planilla actual — bloques mensuales, los mismos encabezados y los
mismos cuadros de totales, pero **con los números ya calculados en vez de
fórmulas con rangos escritos a mano**, que es el error que esta app viene a
eliminar (L-001). Ver T-906.

---

### CU-08 — Importar un respaldo

**Para qué:** recuperar los datos en un teléfono nuevo, o después de un borrado.

**Qué puede salir mal:** importar sobre datos existentes puede duplicar o pisar.
La app **siempre** ofrece exportar antes de importar, y pregunta explícitamente
si se quiere *reemplazar todo* o *agregar a lo que hay*.

**Cómo funciona (T-017).** Desde *Datos*, en «Traer un respaldo», se elige el
archivo o se pega el texto. Antes de tocar nada la app muestra **qué va a pasar
con números**: cuántos movimientos trae el archivo, cuántos hay ahora, cuántos
entrarían, cuántos quedarían con cada camino y —lo más importante— **cuántos se
borrarían al reemplazar**. Recién ahí aparecen los dos botones.

- *Agregar* **no duplica**: un movimiento que ya está no entra de nuevo, así que
  importar dos veces el mismo respaldo deja lo mismo que importarlo una vez. Si
  no entra ninguno, la app lo dice y no ofrece el botón.
- *Reemplazar todo* deja solo lo del archivo, y avisa por adelantado cuántos
  movimientos propios se pierden.
- En los dos casos los **tipos de cambio y las monedas se suman** a los que hay,
  con prioridad para los del dispositivo: sin ellos, un gasto en una moneda
  extranjera entraría sin poder convertirse a euros.
- Lo que no se pudo leer se lista con nombre y motivo, y el resto entra igual: un
  registro roto no puede impedir recuperar los otros.
- Si el archivo es más nuevo que el último respaldo anotado, la app toma esa
  fecha: el archivo es la prueba de que ese día hubo un respaldo (ADR-024).

---

### CU-09 — Usar la app sin conexión

**Para qué:** es la situación normal, no la excepción: se gasta en el subte, en
otro país, sin datos.

**Criterio de aceptación:** con el modo avión activado y el archivo HTML abierto
desde el almacenamiento del dispositivo, todos los casos de uso funcionan igual.

---

### CU-10 — Ver la evolución mes a mes

**Para qué:** reemplaza la matriz mes × rubro de `Analisis1`.

**Muestra:** una fila por mes con el gasto de cada rubro, el total de gastos, el
total de ingresos y el saldo; más una fila de **total** y una de **promedio**.

---

### CU-11 — Ver cuánto costó un viaje

**Para qué:** reemplaza el bloque `GASTOS POR VIAJE`, que es el motivo por el que
la planilla se llama "Viaje Coruña".

**Muestra:** por cada viaje, el gasto total y el gasto por día.

**Decisiones que trae este caso de uso** (a resolver cuando se construya, no
antes):
- En el Excel, el viaje se identifica por el texto del comentario. Hay que decidir
  si la app mantiene una lista de viajes elegible (evita los typos) o sigue con
  texto libre.
- En el Excel, la duración en días está escrita a mano y algunos viajes suman un
  monto fijo dentro de la fórmula (`=96+SUMIFS(...)` en París, `=850+...` en Costa
  Rica) para incluir vuelos y alojamiento pagados fuera del registro. Esos montos
  no tienen ninguna explicación en la planilla. La app necesita una forma
  explícita de registrarlos.

---

### CU-12 — Ver el promedio de un gasto fijo

**Para qué:** reemplaza el bloque `GASTOS FIJOS PROMEDIO`. Responde "¿cuánto me
sale la luz por mes, en promedio?".

**Muestra:** por cada gasto fijo recurrente (identificado por el comentario:
`Luz`, `Gas`, `Internet+celular`, `Psicóloga`), cuántas veces se pagó, el total y
el promedio por pago.

---

### CU-13 — Importar el historial del Excel

**Para qué:** no empezar de cero. El Excel tiene desde octubre de 2025.

**Pasos:** el usuario elige su archivo `.xlsx` directamente — sin convertirlo a
nada. La app lo lee, muestra qué encontró, y recién ahí el usuario confirma.

**Cómo puede la app leer un `.xlsx` sin librerías:** un `.xlsx` es un archivo ZIP
con XML adentro, y el navegador trae de fábrica lo necesario para abrir las dos
cosas. Comprobado sobre la planilla real. Ver ADR-010.

**Qué puede salir mal:** el Excel tiene inconsistencias reales de mayúsculas y de
datos (ver `docs/LECCIONES.md`). El importador tiene que **informar qué no pudo
interpretar**, fila por fila, en vez de importar mal en silencio.

---

### CU-14 — Llevar los ahorros conjuntos

**Para qué:** reemplaza la hoja `Ahorros conjuntos`, que registra ahorros de dos
personas (ALE / IRE) en tres monedas sin convertir entre sí.

**Muestra:** total por moneda, y total por persona y moneda.

**Nota:** esta hoja tiene una lógica distinta al registro de gastos — no convierte
a euros, porque un plazo fijo en pesos uruguayos es un plazo fijo en pesos
uruguayos. Se construye como módulo aparte, no metiendo los ahorros en el
registro de gastos.

---

### CU-15 — Agregar una moneda

**Para qué:** poder registrar gastos en un país nuevo sin esperar a que alguien
publique una versión nueva de la app. Es la diferencia entre anotar los gastos del
viaje y perderlos.

**Pasos:**
1. Desde la pantalla de monedas, o desde el propio formulario de carga si la
   moneda que busca no está, el usuario toca "Agregar moneda".
2. Escribe el código (`JPY`), el nombre (`Yen japonés`) y cuántos decimales usa.
   La app propone 2 y explica en una línea qué significa.
3. La moneda queda disponible al instante, y se le pedirá el tipo de cambio al
   cargar el primer movimiento (CU-03).

**Reglas que aplican:** RN-04b.

**Qué puede salir mal:**
- Código repetido → no se acepta.
- Decimales mal elegidos → **no rompe nada mientras no los cambies**: los montos
  se guardan y se muestran bien igual. Lo delicado es **corregirlos más
  adelante**, cuando ya hay movimientos cargados: ahí los importes se
  reinterpretan y quedan cien veces más grandes o más chicos, así que la app
  avisa cuántos movimientos afecta antes de aplicar el cambio. Ver ADR-019.
- Borrar una moneda con movimientos cargados → no se permite; se puede ocultar.

---

## 8. Fuera de alcance (por ahora, y a propósito)

- Sincronización entre dispositivos, cuentas de usuario, nube.
- Conexión con bancos o tarjetas.
- Presupuestos, alertas, metas de ahorro.
- Tipos de cambio automáticos desde internet — **violaría RN-06**.
- Compartir datos con otra persona.

Si algo de esto se vuelve necesario, se discute y se documenta antes de
construirlo.

---

## 9. Versionado

`MAYOR.MENOR.PARCHE`, y mientras la app esté en `0.x` significa que todavía puede
cambiar de forma:

- **MENOR** sube cuando se agrega una función nueva (un caso de uso pasa a
  "Hecho").
- **PARCHE** sube cuando se corrige algo que ya estaba.
- **MAYOR** sube cuando cambia el formato de datos guardados de una forma que
  obliga a migrar.

La versión vive en `VERSION` (un archivo con una sola línea), se muestra dentro de
la app y se escribe en cada archivo exportado. **Se consulta ese archivo antes de
publicar; no se decide de memoria.** Cada cambio de versión se anota en
`CHANGELOG.md`.
