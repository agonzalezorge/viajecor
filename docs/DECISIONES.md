# Decisiones

> Cada decisión que no es obvia, con su porqué. Sirve para que dentro de tres
> meses nadie —persona o IA— la deshaga sin querer creyendo que fue un descuido.
>
> **Solo se agrega al final.** Si una decisión se revierte, no se borra: se anota
> una nueva que la reemplace y se marca la vieja como *Reemplazada*.

---

## ADR-001 · Una aplicación web en un solo archivo HTML, no una app nativa
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Contexto:** hay que registrar gastos desde el celular, sin conexión y sin que
los datos salgan del dispositivo.

**Decisión:** una página web autocontenida en un archivo `.html` que se guarda en
el dispositivo y se abre desde ahí.

**Por qué esta y no otra:**
- *App nativa (iOS/Android):* obligaría a publicar en una tienda, con cuenta de
  desarrollador y revisiones, para una app de un solo usuario. Desproporcionado.
- *App web con servidor:* los datos pasarían por un servidor. Contradice
  directamente el requisito de privacidad.
- *Un archivo HTML:* se guarda, se copia, se respalda como cualquier archivo. Sin
  instalación, sin cuenta, sin tienda, sin servidor.

**Lo que cuesta:** no hay ícono en la pantalla de inicio por defecto (se puede
agregar a mano desde el navegador), no hay notificaciones, y la sincronización
entre dispositivos hay que hacerla exportando e importando.

---

## ADR-002 · Código fuente partido en módulos, entregable en un archivo
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** el código vive en `src/` en muchos archivos; `tools/build.mjs`
genera un `dist/viajecor.html` único.

**Por qué:** los módulos de JavaScript no se pueden cargar desde `file://` (el
navegador lo bloquea), así que el entregable **tiene** que ser un solo archivo.
Pero programar y testear en un solo archivo gigante es peor en todos los sentidos,
y con varios agentes trabajando en paralelo, garantiza conflictos.

**Lo que cuesta:** hay un paso de construcción, y `dist/viajecor.html` se versiona
en git aunque sea generado. Se acepta: el usuario tiene que poder bajar el archivo
sin construir nada.

---

## ADR-003 · Cero dependencias externas
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** ninguna librería. Ni de interfaz, ni de fechas, ni de tests, ni de
construcción.

**Por qué:** cualquier librería habría que meterla dentro del HTML (lo agranda) o
traerla de internet (viola la regla de cero red). Además, la app tiene que seguir
funcionando dentro de cinco años desde un archivo guardado: cero dependencias es
cero cosas que se pudran. Para tests alcanza el ejecutor que ya trae Node.

**Lo que cuesta:** hay que escribir a mano cosas que una librería resolvería. Es
poco: el alcance es chico y el navegador moderno ya trae casi todo.

---

## ADR-004 · El importe en euros se calcula, no se guarda
**Fecha:** 2026-08-18 · **Estado:** Vigente, **a confirmar con el usuario**

**Contexto:** RN-04 define un tipo de cambio por moneda y por mes. Un movimiento
en moneda extranjera tiene un monto original y un equivalente en euros.

**Decisión:** se guarda el monto original y su moneda. El importe en euros se
recalcula siempre a partir del tipo de cambio vigente para (moneda, mes).

**Por qué:** si el tipo de cambio cargado estaba mal, corregirlo una vez arregla
el mes entero. Congelarlo obligaría a corregir movimiento por movimiento.

**Lo que cuesta:** cambiar un tipo de cambio **modifica totales de meses ya
vistos**. La app lo avisa antes de aplicarlo. Es un comportamiento que puede
resultar incómodo, así que **está anotado como pregunta abierta en
`docs/PLAN.md`**: si el usuario prefiere congelar, se cambia — es barato ahora y
caro más adelante.

---

## ADR-005 · El dinero se guarda en unidades enteras
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** `12,50 €` se guarda como el entero `1250`.

**Por qué:** en JavaScript `0.1 + 0.2` no da `0.3`. Sumar cientos de montos con
decimales acumula error, y un total que no cierra por un céntimo destruye la
confianza en todos los demás números de la app. Con enteros la suma es exacta.

**Lo que cuesta:** las conversiones de moneda y los promedios sí dan decimales, y
hay que redondear **una sola vez, al final** de cada cálculo. Está encapsulado en
`src/core/dinero.js` para que no se decida de nuevo en cada lugar.

---

## ADR-006 · `localStorage`, no IndexedDB
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** todo el estado bajo una sola clave de `localStorage`.

**Por qué:** es síncrono y directo. El límite de ~5 MB da para unos 30.000
movimientos; el Excel actual tiene alrededor de 1.000 en un año. IndexedDB sería
complejidad comprada para un problema que no existe.

**Cuándo revisarla:** si se agregan fotos de tickets, o si el volumen se acerca a
los 20.000 movimientos. `src/datos/almacenamiento.js` es la única puerta a la
persistencia, así que el cambio sería de un archivo.

---

## ADR-007 · Importar desde CSV, no leer `.xlsx` directamente
**Fecha:** 2026-08-18 · **Estado:** ❌ **Reemplazada por ADR-010** (2026-08-18)

**Decisión:** el importador del historial lee CSV. Para traer el Excel, se exporta
a CSV desde Excel primero.

**Por qué:** un `.xlsx` es un ZIP con XML adentro. Leerlo en el navegador
requeriría una librería de descompresión y otra de XML, que habría que meter
dentro del archivo entregable y mantener para siempre. Exportar a CSV es un paso
que el usuario hace una vez.

**Por qué se reemplazó:** la premisa era falsa y no la comprobé antes de decidir.
Ver ADR-010 y L-007.

---

## ADR-008 · Los nombres del Excel se respetan tal cual
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** `rubro`, `comida hecha`, `gastos fijos`, `I/G`, `comentario` — los
nombres de la app son los de la planilla, aunque algunos no sean los que elegiría
alguien de cero.

**Por qué:** el usuario ya piensa en esos términos después de meses de uso.
Renombrarlos lo obligaría a traducir mentalmente cada vez, y al importar el
historial habría que mapear nombres viejos a nuevos: dos fuentes de error a cambio
de nada.

---

## ADR-009 · La privacidad se verifica con un test, no con buena voluntad
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Decisión:** un test automático (T-007) falla si el HTML generado contiene
cualquier referencia a una URL externa o a una función de red.

**Por qué:** "no hacemos peticiones a internet" es la promesa central del
producto. Una promesa que depende de que ningún agente se olvide nunca no es una
promesa. Con el test, agregar accidentalmente una fuente de Google rompe la
construcción en vez de romper la privacidad en silencio.

---

## ADR-010 · Leer el `.xlsx` directamente en el navegador, sin librerías
**Fecha:** 2026-08-18 · **Estado:** Vigente · **Reemplaza a:** ADR-007

**Contexto:** ADR-007 decía que leer un `.xlsx` exigiría meter librerías dentro
del archivo entregable, y mandaba al usuario a exportar a CSV desde Excel. El
usuario preguntó qué implicaba eso, y al ir a comprobarlo resultó que la premisa
era falsa.

**Decisión:** el importador lee el `.xlsx` tal cual, sin conversión previa. El
usuario elige su planilla y la app la abre.

**Por qué:** un `.xlsx` es un ZIP con XML adentro, y el navegador moderno trae de
fábrica las dos piezas que hacen falta:

- `DecompressionStream('deflate-raw')` descomprime las entradas del ZIP.
- `DOMParser` parsea el XML.

Lo único que hay que escribir a mano es la lectura del directorio del ZIP, que
son unas cien líneas y no cambia nunca (el formato está congelado desde 1989).

**Comprobado, no supuesto:** se leyó la planilla real del usuario dentro de
Chromium con cero librerías, y devolvió sus encabezados correctos
(`OCTUBRE 2025`, `G/Acum./Mes`, `RUBRO`, `MONTO`, `I/G`) sobre 23.296 celdas.

**Lo que cuesta:** unas 150 líneas más de código propio en `datos/importar.js`, y
depender de una API que no existe en navegadores muy viejos. A cambio, el usuario
no tiene que convertir nada, y se evita el paso donde un CSV mal exportado
(separador, codificación, comas decimales) rompe la importación en silencio.

**Se sigue aceptando CSV además**, porque es el formato de exportación y sirve
para importar datos de otras fuentes.

---

## ADR-011 · La lista de monedas es un dato, no código
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Contexto:** el usuario usa euro, peso uruguayo, dólar y colón costarricense, y
pidió explícitamente poder agregar monedas nuevas desde la app en cualquier
momento.

**Decisión:** las monedas viven en los datos guardados, no en el código. La app
arranca con cuatro precargadas y el usuario agrega las que quiera desde una
pantalla, indicando código, nombre y cuántos decimales usa.

**Por qué:** si la lista estuviera en el código, agregar una moneda para un viaje
imprevisto exigiría una versión nueva de la app. La persona estaría en otro país,
sin poder registrar sus gastos, esperando que alguien publique un archivo nuevo.

**Por qué el usuario elige los decimales:** el peso uruguayo y el dólar usan dos;
el yen y el peso chileno, ninguno. De ese número depende cómo se guarda el monto
en entero (ADR-005), así que equivocarlo desplaza todos los importes de esa moneda
por un factor de cien. La app propone 2 por defecto y explica qué significa.

**El euro es distinto:** es la moneda base (RN-04), viene fija y no se puede
borrar ni cambiar de decimales, porque todos los totales se expresan en euros.

---

## ADR-012 · Un monto ambiguo se rechaza, no se adivina
**Fecha:** 2026-08-18 · **Estado:** Vigente

**Contexto:** al interpretar lo que el usuario escribe, `"1.234"` y `"12,345"`
tienen exactamente la misma forma —un separador con tres dígitos detrás— y dos
lecturas posibles: mil doscientos treinta y cuatro, o doce coma treinta y cuatro
con un dígito de más.

**Decisión:** ese caso **no se interpreta**. La app rechaza el monto y pide que
se escriba sin separador de miles o con dos decimales, ofreciendo las dos
lecturas en el mensaje.

**Por qué:** las dos lecturas difieren por un factor de **mil**. Elegir una en
silencio significa que, cada tanto, un gasto entra mil veces más grande o más
chico de lo que fue, sin que nada lo delate — y una vez guardado, contamina el
total del mes, el del año y el del viaje. Preguntar molesta una vez; equivocarse
acá corrompe un número para siempre.

**Lo que cuesta:** alguien que pegue `"1.234"` desde su banco tiene que
reescribirlo. Es una molestia real, y la aceptamos: es el precio de que ningún
monto entre mal en silencio.

**Alternativa descartada:** deducir la convención por el resto de los datos ya
cargados. Suena más inteligente, pero convierte un error visible en uno que
depende del historial y aparece de forma intermitente — mucho más difícil de
notar y de explicar.

---

## ADR-013 · El comentario se guarda como se escribió y se agrupa por una clave
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** RN-03 dice que todo texto que agrupe se compara normalizado. El
rubro y el tipo salen de listas cerradas, así que guardarlos normalizados no
pierde nada: `supermercado` ya es su forma canónica. El **comentario** no: es lo
que el usuario escribe para nombrar un viaje, y si se guardara en minúsculas la
app mostraría `roma` para siempre.

**Decisión:**
- `rubro`, `tipo` y `moneda` se **guardan ya normalizados** (minúsculas el rubro,
  mayúsculas el código de moneda).
- `comentario` se **guarda tal como se escribió**, sin espacios de sobra, y todo
  cálculo que agrupe por comentario usa `claveDeComentario()`, que es la única
  función que decide cuándo dos comentarios son el mismo.

**Por qué:** separar "lo que se muestra" de "lo que agrupa" permite tener las dos
cosas. La alternativa —guardar minúsculas— cambia lo que el usuario ve por una
razón interna, y la otra —comparar exacto— es la trampa de L-002 y L-003.

**Lo que cuesta:** hay una regla que recordar: agrupar por comentario es agrupar
por su clave, nunca por el texto. Está en una sola función, con tests, y las
tareas que agrupan (T-013, T-021, T-022, T-023) tienen que usarla.

**Lo que esta clave NO hace: sacar las tildes.** `Perú` y `Peru` quedan como dos
grupos distintos. Sacarlas juntaría también palabras que el usuario quiso separar
y es una decisión de producto, no técnica: **queda como pregunta abierta** en
`docs/PLAN.md`. Se anota acá para que el que venga sepa que fue a propósito y no
un olvido (L-006).

---

## ADR-014 · Crear un movimiento y validar uno guardado son dos puertas distintas
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** un movimiento entra a la app por dos caminos: alguien lo escribe en
un formulario, o se lee de `localStorage` o de un respaldo. En el primer caso el
monto viene como lo tipeó una persona (`"12,50"`); en el segundo ya es un entero
de unidades mínimas (`1250`).

**Decisión:** dos funciones separadas. `crearMovimiento()` interpreta lo escrito y
necesita saber cuántos decimales usa la moneda; `validarMovimiento()` comprueba un
movimiento ya guardado y **no reinterpreta el monto**.

**Por qué:** una sola función tendría que adivinar qué significa `1250`, y las dos
lecturas —1250 € o 12,50 €— difieren por un factor de cien. Es exactamente la
clase de error que ADR-005 vino a evitar, y sería peor: aparecería solo al
reimportar un respaldo, meses después, sobre datos que ya se creían correctos.

**Lo que cuesta:** quien llama tiene que saber cuál usar. A cambio, la unidad del
monto nunca depende de una adivinanza: cada puerta la sabe por definición.

---

## ADR-015 · Un dato que no se entiende se aparta, nunca se pisa
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** `datos/almacenamiento.js` puede encontrarse con contenido que no
sabe leer: JSON cortado por una pestaña que se cerró a mitad de escritura, datos
de otra app bajo la misma clave, o un respaldo editado a mano. Hay que decidir
qué hace la app en ese momento.

**Decisión:** leer **nunca falla y nunca escribe encima**. Ante contenido
ilegible, la app arranca vacía para que se pueda usar, avisa con todas las
letras, y **copia lo ilegible a una clave aparte** (`viajecor:rescate:<fecha>`)
antes de seguir. La clave original tampoco se toca.

**Por qué:** acá vive la única copia de los gastos del usuario — no hay servidor,
ni papelera, ni historial (ARQUITECTURA §11). Las tres alternativas son peores:

- *Tirar un error y no abrir:* el usuario se queda sin ver ni lo que sí está bien,
  y sin ninguna forma de exportar lo que quedaba.
- *Arrancar vacío y guardar encima al primer cambio:* destruye para siempre un
  dato que quizá se podía rescatar a mano. Es el peor resultado posible y el más
  fácil de programar sin darse cuenta.
- *Arrancar vacío en silencio:* el usuario cree que perdió todo y no sabe que hay
  algo recuperable.

Un dato ilegible todavía se puede rescatar; uno sobrescrito, no. Esa asimetría es
la que manda.

**Lo que cuesta:** quedan claves de rescate ocupando lugar en el navegador hasta
que alguien las borre a mano, y `borrarEstado()` no las toca a propósito. Es
espacio a cambio de una segunda oportunidad.

---

## ADR-016 · Guardar mal tiene que doler; leer mal, no
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Decisión:** `leerEstado()` **nunca tira**: siempre devuelve algo usable más un
parte de incidencias. `guardarEstado()` **sí tira** cuando no pudo guardar.

**Por qué son opuestos:** son dos fallas con consecuencias distintas.

Si leer falla y la app no abre, el usuario pierde el acceso a todo, incluida la
posibilidad de exportar. Abrir con lo que se pudo rescatar siempre es mejor.

Si guardar falla —el almacenamiento del navegador está lleno, o el navegador está
en un modo que no deja escribir— y la app se lo traga para "no molestar", el
usuario sigue cargando gastos toda una tarde: los ve aparecer en pantalla, y
ninguno sobrevive a cerrar la app. Un error visible en el momento es
incomparablemente menos grave.

**La regla general:** una falla al leer se degrada; una falla al escribir se
grita. Vale para cualquier módulo que persista datos.

---

## ADR-017 · Un registro roto no se lleva puestos a los que están bien
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Decisión:** al leer los datos guardados, cada movimiento y cada tipo de cambio
se valida por separado. Los que no se entienden quedan afuera y se informan **uno
por uno, con su número y su motivo**; los demás se cargan normalmente.

**Por qué:** con 500 movimientos guardados y 3 rotos, descartar los 500 pierde
497 registros buenos, y aceptar los 3 en silencio cambia el total del mes sin que
nadie se entere — que es la falla que este proyecto entero trata de evitar
(L-001, L-008). Informar fila por fila es la misma regla que ya estaba escrita
para el importador de Excel (T-032): importar mal en silencio es peor que no
importar.

**Lo que cuesta:** la app tiene que mostrar esas incidencias en algún lado, y no
alcanza con un mensaje genérico. Un aviso que dice "algunos datos no se pudieron
leer" sin decir cuáles no sirve para nada.

---

## ADR-018 · Preguntar los decimales de una moneda que no está en la lista tira
**Fecha:** 2026-08-19 · **Estado:** Vigente · **Porqué corregido por:** ADR-019

> ⚠️ La decisión de abajo sigue en pie, pero **su justificación era falsa** y está
> corregida en ADR-019. No es cierto que elegir 2 decimales para el yen deje los
> importes cien veces más chicos: si la escala es consistente, los números salen
> bien. Leer ADR-019 antes que esto.

**Lo primero, porque se presta a confusión:** `decimales` **no dice cómo hay que
escribir un monto.** En euros podés escribir `15`, `15,0` o `15,00` y las tres
cosas se guardan igual, como 1500. `decimales` dice **cuántas subunidades tiene
la moneda**: el euro tiene céntimos, el yen no tiene nada más chico que el yen.
Es una propiedad de la moneda, no del movimiento.

**Y por eso tiene que ser una sola para toda la moneda:** el monto se guarda como
entero, y ese entero solo significa algo en relación a la escala de su moneda. Si
cada movimiento trajera su propia escala —uno guardado como `15` porque escribiste
"15", y otro como `1500` porque escribiste "15,00"— sumarlos daría 1515 en vez de
30,00 €. La escala uniforme es lo que permite que sumar sea sumar.

**Contexto:** `decimalesDe(monedas, codigo)` es lo que le dice al resto de la app
cómo interpretar un monto en una moneda. Si el código no está en la lista del
usuario, hay dos salidas: devolver 2 —que es lo que usan casi todas las monedas—
o negarse.

**Decisión:** se niega. Tira un error que nombra la moneda y dice qué hacer
("agregala antes de cargar el movimiento").

**Por qué:** el valor por omisión sería correcto casi siempre, y ese *casi* es el
problema. Cuando esté mal —el yen, el peso chileno, el guaraní: monedas sin
decimales— todos los importes de esa moneda quedan **cien veces más grandes o más
chicos**, sin ningún error, sin ninguna pantalla roja. Y no se nota en el momento:
se nota meses después, en un total del año que no cierra y que nadie sabe
explicar.

Es el mismo razonamiento de ADR-012 con los montos ambiguos: **un caso raro que
molesta hoy es preferible a un número mal que nadie ve nunca.** Un error visible
se arregla en diez segundos agregando la moneda; una suposición silenciosa
contamina un histórico entero.

**Lo que cuesta:** cada pantalla que cargue un movimiento tiene que tener el
catálogo a mano, y no puede improvisar. Es exactamente la disciplina que se
quiere.

---

## ADR-019 · Lo peligroso no es el valor de `decimales`, es que cambie
**Fecha:** 2026-08-19 · **Estado:** Vigente · **Corrige el porqué de:** ADR-018

**De dónde salió:** el usuario leyó ADR-018, no le cerró la justificación y
preguntó: *"si pongo 2 decimales al yen y después siempre escribo 1500 sin
decimales, ¿no se guarda igual 1500?"*. Tenía razón. La justificación que yo
había escrito era falsa.

**Lo que decía ADR-018 y es falso:** que elegir 2 decimales para el yen deja
"todos los importes de esa moneda cien veces más chicos".

**Lo comprobado, corriendo el código:**

| JPY configurado con | Escribís | Se guarda | Se muestra | En euros |
|---|---|---|---|---|
| 0 decimales | `1500` | `1500` | 1500 yenes | 9,30 € |
| 2 decimales | `1500` | `150000` | 1500 yenes | 9,30 € |

Nada se rompe. El entero guardado es distinto, pero **el valor es el mismo**,
porque la app siempre entra y sale por la misma escala. Una escala "equivocada"
pero **consistente** no produce ningún error.

**Dónde está el peligro de verdad, entonces:** en que la escala usada al
**escribir** y la usada al **leer** no coincidan. Eso pasa en dos situaciones:

1. **Cambiar los decimales de una moneda que ya tiene movimientos.** Un `150000`
   guardado con escala 2 (1500 yenes) leído con escala 0 son 150.000 yenes: cien
   veces más. Esto ya está previsto —`cambiarDecimalesDe()` obliga a avisar
   cuántos movimientos se reinterpretan— pero ahora se entiende que **es el único
   momento en que el número se corrompe**, no un riesgo difuso.
2. **Inventar una escala que no queda registrada en ningún lado.** Si el código
   supusiera 2 para una moneda que no está en la lista, esa suposición no se
   escribe en ninguna parte; el día que el usuario agregue esa moneda con 0
   decimales, todos esos movimientos cambian de significado. Es el caso 1
   disfrazado, y sin nadie que avise.

**La decisión de ADR-018 sigue en pie** —preguntar los decimales de una moneda
que no está en la lista tira, no supone 2— pero por este motivo, que es más
preciso: **no porque adivinar dé un número mal, sino porque adivinar deja una
escala sin registrar que después no coincide con la real.**

**Consecuencia práctica para el usuario:** elegir mal los decimales al agregar
una moneda es **mucho menos grave** de lo que decían PRODUCTO §RN-04b y CU-15.
Si te queda mal y lo dejás así, tus números están bien. Lo que hay que mirar con
cuidado es el momento de **corregirlos**.

---

## ADR-020 · El total es la suma de lo que se ve, no un número más exacto
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** al sumar en euros movimientos cargados en otra moneda hay dos
caminos, y dan resultados distintos:

1. Convertir cada movimiento, **redondear al céntimo**, y sumar los redondeados.
2. Convertir sin redondear, sumar, y redondear **una sola vez al final**.

El camino 2 es aritméticamente más exacto: arrastra menos error acumulado.

**Decisión:** el camino 1. Cada movimiento se redondea al céntimo antes de
sumarse.

**Por qué el menos exacto:** el céntimo es la unidad en que la app **muestra y
exporta** cada importe. Con el camino 2, alguien que sume a mano las filas de la
pantalla puede obtener un céntimo distinto del total que la app muestra abajo. Es
un error de un céntimo y no le cambia la vida a nadie — pero un total que no
coincide con la suma de lo que está en pantalla es un total que el usuario deja
de creer, y a partir de ahí deja de creer todos los demás números.

**No contradice ADR-005.** Ahí la regla es redondear una sola vez *por cálculo*,
para no acumular error dentro de una misma conversión: eso se sigue cumpliendo,
`convertirAEuros()` redondea una única vez. Lo de acá es otra cosa: cuál es el
valor de un movimiento **una vez expresado en euros**, y la respuesta es el que se
muestra.

**Lo que cuesta:** un total de mil movimientos convertidos puede diferir en unos
pocos céntimos del cálculo teóricamente perfecto. A cambio, todo lo que la app
muestra cierra consigo mismo.

---

## ADR-021 · La app no registra horas, solo días
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** al contarle al usuario el cuidado de zonas horarias del formateo de
fechas (L-011), su respuesta fue directa: *"no quiero que registremos el dato de
la hora del registro. Solo el día y chau, se acabó el problema."*

**Decisión:** ningún dato guardado lleva hora. La fecha de un movimiento ya era
un día (RN-01); `creado`, que era un instante completo
(`2026-03-14T20:11:03.000Z`), pasa a ser el día (`2026-03-14`). Lo mismo para los
tipos de cambio.

**Por qué es la decisión correcta y no solo una preferencia:** una hora obliga a
elegir una zona horaria para interpretarla, y esa elección es la que corre las
fechas de día (L-011). Sacar el dato saca la clase entera de errores, en vez de
defenderse de ellos caso por caso. La app no necesita la hora para nada: ningún
caso de uso de `PRODUCTO.md` la pide.

Además es un dato personal que deja de existir: sin horas, un respaldo exportado
no cuenta a qué hora de la noche alguien cargó sus gastos.

**Lo que cuesta:** dos movimientos cargados el mismo día no se pueden ordenar
entre sí por `creado`. No importa: la lista se ordena por la fecha del gasto, y
para desempatar está el orden en que están guardados.

**Se hace ahora porque es gratis ahora.** No hay ni un dato real cargado. El
mismo cambio con un año de historial encima obligaría a migrar el esquema.

**El cuidado de L-011 sigue siendo necesario**, aunque ya no haya horas guardadas:
mostrar `2026-03-14` sigue exigiendo construir un `Date`, y ahí la zona horaria
vuelve a aparecer. La diferencia es que ahora es un problema de una sola función
de presentación, con sus tests, y no algo que pueda contaminar un dato guardado.

---

## ADR-022 · La interfaz se parte en "qué se muestra" y "cómo se engancha"
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** `src/ui/` es la parte que toca el navegador, así que por definición
no se puede testear con `node --test`. Si toda la interfaz fuera código que
manipula el DOM, cada error de "el mes sale mal", "la pestaña marcada es la que no
es" o "el comentario del usuario rompe la página" solo aparecería abriendo la app
y mirando.

**Decisión:** cada pantalla se escribe como **funciones puras que reciben datos y
devuelven texto HTML**, más una única función (`iniciar()`) que las mete en el
documento y engancha los clics. La segunda capa se mantiene lo más chica posible.

**Por qué:** casi todos los errores de una interfaz son de la primera clase —qué
texto, qué número, qué está marcado— y esa clase entera se vuelve testeable sin
inventar un DOM falso ni arrancar un navegador. Queda del otro lado solo lo que
de verdad necesita un navegador para comprobarse.

Los 22 tests del armazón (T-010) son todos de la primera capa. Lo de la segunda
—que un clic en la flecha cambie el mes— se comprobó abriendo
`dist/viajecor.html` en un Chromium real, con pantalla de celular y zona horaria
de Montevideo: 0 peticiones de red, 0 errores de consola.

**Lo que cuesta:** armar HTML como texto obliga a escapar a mano todo lo que
venga de los datos (`escapar()`), y olvidarse una vez rompe la página con un `<`
en un comentario. A cambio, no entra ninguna librería de interfaz —que habría
que empaquetar dentro del entregable (ADR-003)— y el HTML resultante se puede
leer, que es parte de la garantía de privacidad.

**Cuándo revisar esto:** si una pantalla necesita conservar estado mientras se
edita (un formulario largo a medio llenar), redibujar todo con `innerHTML`
borraría lo escrito. Ahí habrá que dibujar solo el trozo que cambia — T-011 es la
primera que se va a topar con esto.

---

## ADR-023 · Lo escrito en el formulario vive en el documento, no en el estado
**Fecha:** 2026-08-19 · **Estado:** Vigente

**Contexto:** el armazón (T-010) redibuja la pantalla entera con `innerHTML` en
cada cambio. Un formulario a medio llenar se borraría. Había dos salidas:
redibujar solo el trozo que cambia, o guardar cada tecla en el estado de la app.

**Decisión:** ninguna de las dos. Lo escrito **se lee del documento en el momento
en que hace falta** —al guardar, o al cambiar de gasto a ingreso— y recién ahí
pasa al estado.

**Por qué no guardar cada tecla:** serían dos versiones del mismo dato, el
`<input>` y el estado, que hay que mantener en sincronía. Es la trampa de L-005
aplicada a un formulario: un dato, dos lugares, y tarde o temprano dicen cosas
distintas. Además obliga a redibujar en cada tecla, que en un celular viejo se
nota.

**Por qué no redibujar solo un trozo:** habría que decidir, para cada cambio, qué
parte de la pantalla se ve afectada. Esa decisión es donde aparecen los errores
de "cambié el tipo pero el rubro quedó del anterior".

**Cómo funciona:** hay un solo momento en que la pantalla se redibuja con datos
escritos —al pasar de gasto a ingreso, porque cambia la lista de rubros (RN-02)—
y ahí se lee el formulario primero y se vuelve a dibujar con esos valores. El
rubro sí se vacía, y tiene que vaciarse: el de antes ya no es válido.

**Lo que cuesta:** `ui/app.js` tiene una función que lee campos por nombre, y si
se agrega un campo al formulario hay que agregarlo también ahí. Es un punto de
olvido real. A cambio, no hay estado duplicado ni redibujado por tecla.

---

## ADR-024 · Importar un respaldo actualiza la fecha del último respaldo

**Contexto.** La pantalla de Datos avisa cuánto hace que no se respalda, leyendo
`preferencias.ultimo_respaldo`, que se anota al descargar. Al importar, ese dato
no existía en el dispositivo nuevo: el recorrido en el navegador mostró un
teléfono recién recuperado con un archivo **de hoy** diciendo *"Nunca
respaldaste"*.

**Decisión.** Después de importar, el último respaldo es **la fecha más reciente
entre la del dispositivo y la del archivo** (`exportado`), en los dos modos.

**Por qué.** El archivo *es* la prueba de que ese día hubo un respaldo: decir lo
contrario es falso y empuja a respaldar de nuevo algo que ya está a salvo. Y al
revés, un archivo viejo no puede atrasar la fecha: decir que el último respaldo
es más antiguo de lo que fue también es mentir. Se toma el máximo, que es la
única respuesta que no miente en ninguna de las dos direcciones.

**Lo que cuesta.** La fecha del archivo la escribe quien exportó, y un archivo
editado a mano podría traer cualquier cosa. Por eso pasa por `validarFecha()`, y
si no es una fecha del calendario se ignora en vez de romper la importación:
recuperar los gastos importa más que el aviso de respaldo.

**Alternativa descartada.** Anotar el día de la importación. Sería más simple,
pero diría que respaldaste hoy cuando lo que hiciste fue *restaurar* — y si el
archivo era de hace un mes, oculta que hace un mes que no respaldás, que es
exactamente lo que el aviso existe para no dejar pasar.

---

## ADR-025 · El respaldo llega a la nube por el sistema operativo, no por la app
**Fecha:** 2026-08-27 · **Estado:** Vigente · **Cierra:** pregunta abierta 4

**Contexto.** El usuario quiere subir sus datos a OneDrive cada semana o cada
quince días, cómodamente. Descargar el archivo y después buscarlo con un
explorador para subirlo son cuatro pasos, y **el respaldo que exige cuatro pasos
cada semana es el que no se hace**.

**Decisión.** La app le entrega el archivo al sistema operativo con el botón de
compartir del teléfono. El sistema muestra OneDrive, Drive, el correo, lo que
haya instalado, y el usuario elige. Cuando el teléfono sabe hacerlo, *Compartir*
es el botón principal y *Descargar* pasa a secundario.

**Por qué esto no rompe RN-06.** La app no hace ninguna petición de red: pasa un
archivo y termina su participación. Quien sube es OneDrive, con la sesión del
usuario, fuera de la app. Es lo mismo que descargar el archivo y arrastrarlo a
una carpeta sincronizada, sin los pasos del medio. La guardia de privacidad de
`tools/build.mjs` sigue en verde, y sigue siendo cierto que se puede abrir el
HTML y comprobar que no le habla a nadie.

**La alternativa que se rechazó** —que la app suba sola a la API de OneDrive o de
GitHub— es una petición de red: rompe RN-06, rompe la guardia de privacidad, y
obliga a guardar una credencial dentro del archivo que el usuario copia entre
teléfonos. Deja de ser verdad la única promesa que la app hace.

**Se pregunta con `canShare({files})`, no con `share`.** Hay navegadores que
comparten texto y direcciones pero no archivos; ahí `share({files})` falla
*después* de que el usuario apretó. En esta pantalla eso es especialmente caro:
el usuario se queda creyendo que respaldó. Si no se puede, el botón no está.

**No se manda `text` ni `url` junto al archivo.** Hay destinos que, si viene
texto, mandan el texto y se olvidan del archivo — se compartiría "algo" y el
respaldo no existiría.

**La fecha del respaldo se anota al volver, no al apretar.** Compartir es
asíncrono y el usuario puede cancelar. Anotar antes apagaría el aviso de "hace
tantos días que no respaldás" sin que hubiera salido ningún archivo, que es
exactamente el aviso que existe para que eso no pase.

**Lo que cuesta.** Depende de una API que no está en todos lados —y que no se
pudo probar en este entorno, porque Chromium de escritorio en Linux no la trae—.
Por eso el camino de descarga queda intacto y la comprobación en el celular real
del usuario es parte de T-019. Lo que sí se comprobó es que `file://` es
contexto seguro, que era el motivo más probable de que no funcionara.

---

## ADR-026 · El recordatorio cuenta movimientos sin respaldar, no días sin respaldar
**Fecha:** 2026-08-27 · **Estado:** Vigente

**Contexto.** El usuario pidió un recordatorio semanal de respaldo. La versión
obvia es "hace N días que no respaldás", que es lo que ya decía la pantalla de
Datos desde T-016.

**Decisión.** El aviso aparece cuando hay **movimientos sin respaldar** *y* pasó
el plazo. Las dos cosas: sin movimientos nuevos no aparece por más tiempo que
pase.

**Por qué.** Un año sin respaldar es irrelevante si no cargaste nada en ese año:
no hay nada que perder, y avisar igual es el aviso que enseña a ignorar avisos.
La falla cara de un recordatorio no es que no aparezca: es que aparezca cuando no
corresponde, porque el día que sí importa ya nadie lo lee.

Y por lo que dice: *"3 movimientos tuyos existen en un solo lugar"* es lo que
efectivamente se pierde. *"Hace 9 días que no respaldás"* es un reproche. Se
dicen los dos, pero el número que manda es el de los movimientos.

**Cómo se cuentan.** Por el día en que se cargaron (`creado`), no por la fecha
del gasto: cargar hoy un gasto de la semana pasada lo deja sin respaldar, por más
vieja que sea su fecha. Un movimiento creado **el mismo día** del último respaldo
cuenta como sin respaldar: la app no guarda horas (ADR-021), así que no se puede
saber si se cargó antes o después de exportar, y equivocarse hacia "ya está
respaldado" es equivocarse hacia perder datos.

**El aviso habla siempre en días**, también cuando nunca hubo un respaldo
(pedido del usuario, 2026-08-27). *"Nunca respaldaste"* es una etiqueta sobre la
persona; *"hace 12 días"* es un dato que se puede comparar con el de mañana. El
número significa lo mismo en los dos casos, porque **si nunca hubo un respaldo**
el plazo corre desde el movimiento más viejo, no desde siempre. Reclamarle un respaldo a quien cargó su primer gasto hace diez
minutos es la forma más rápida de que el aviso pierda todo su valor.

**Se pospone por el día, y eso se guarda.** Un aviso que no se puede sacar de la
pantalla se vuelve parte del decorado; uno que se apaga para siempre no sirve
para nada. "Ahora no" lo calla hasta mañana. Guardarlo es obligatorio: si no,
volvería en cada recarga, que es lo mismo que no poder sacarlo.

**Lo que cuesta.** Una preferencia más que persistir —`recordatorio_pospuesto`—,
con el riesgo de L-015 encima. Se agregó a la lista de `migrarEstado` en el mismo
commit, y el test que compara el objeto entero de preferencias la cubre.

---

## ADR-027 · Los espacios de nombres de XML son la única excepción de la guardia, y está acotada
**Fecha:** 2026-08-27 · **Estado:** Vigente

**Contexto.** Para exportar a `.xlsx` (T-906) hay que escribir XML, y el XML
identifica sus vocabularios con **espacios de nombres**: una etiqueta única que,
por una convención de los años 90, tiene forma de URL. Nadie se conecta ahí:
Excel abre un `.xlsx` sin conexión, y estas cadenas cumplen el mismo papel que el
número de serie de un electrodoméstico. Pero la guardia de privacidad rechaza
cualquier `http://`, así que la construcción fallaría.

**Decisión.** Se permite una lista **cerrada, explícita y acotada por dominio**
de espacios de nombres, y nada más. Tres condiciones se comprueban en cada
construcción:

1. Cada excepción tiene que estar bajo un dominio de esquemas conocido
   (`schemas.openxmlformats.org`, `schemas.microsoft.com`). Agregar
   `http://loquesea.com` a la lista **rompe la construcción**.
2. Cada excepción tiene que aparecer en el archivo **entre comillas**, como una
   cadena de texto. Una URL suelta en el código no pasa.
3. Sacando las excepciones, no puede quedar ninguna otra dirección.

**Lo que se rechazó, y por qué importa más que lo que se hizo.** La salida fácil
era partir la cadena en pedazos y volver a unirla en tiempo de ejecución. La
guardia no la vería y todo seguiría en verde — pero quedaría **en pie y ciega**,
y la próxima URL, una de verdad armada del mismo modo, pasaría igual. Una
comprobación que se puede esquivar es peor que ninguna, porque da confianza sin
darla. La otra salida fácil, apagar la guardia, al menos es honesta; esta no.

**Por qué la excepción no es una puerta.** Aunque estas cadenas estén en el
archivo, **no hay en todo el archivo una sola función capaz de usarlas**: los
otros patrones prohíben `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` y
`sendBeacon`. Una dirección sin nada que la marque es texto.

**Comprobado, no argumentado.** Se abrió `dist/viajecor.html` en Chromium con
**toda la red bloqueada e instrumentada**, y se recorrió la app entera —cargar,
corregir, cambiar de pantalla, exportar, descargar, importar, recargar—. Intentos
de salir a la red: **cero**. Es la diferencia entre "no debería hacer peticiones"
y "no hizo ninguna".

**De paso.** La lista de la guardia estaba escrita **dos veces**: una en
`tools/build.mjs` y otra en `test/privacidad.test.js`. Ahora vive una sola vez en
`tools/privacidad.mjs` y las dos la usan. Dos copias de una regla son dos reglas
que se separan, y la que se queda atrás es siempre la del test — que es la que se
mira para creer que todo está bien.

---

## ADR-028 · El XML del `.xlsx` se lee a mano, no con `DOMParser`
**Fecha:** 2026-08-28 · **Estado:** Vigente · **Corrige a:** ADR-010

**Contexto.** ADR-010 estableció que el `.xlsx` se lee directo en el navegador
—sin librerías, sin pedirle al usuario que convierta nada— usando
`DecompressionStream` para el ZIP y **`DOMParser` para el XML**. Al ir a
escribirlo, la segunda mitad de esa decisión no se sostuvo.

**El problema.** `DOMParser` es del navegador, y `datos/` no puede tocar el
navegador (ARQUITECTURA, regla 2 de `CLAUDE.md`). No es formalismo: significa que
**el importador no se podría probar con `node --test`**. Y el importador es lo
que va a tocar once meses de datos que no están en ningún otro lado — es
justamente el módulo que más falta que se pruebe hasta el último rincón.

Un módulo que solo se puede probar abriendo un navegador se prueba menos. Se
prueba a mano, se prueba una vez, y se deja de probar cuando cambia.

**Decisión.** Se escribe un lector de XML propio (`src/datos/xml.js`): unas 130
líneas que entienden **exactamente lo que un `.xlsx` usa** —etiquetas, atributos,
texto y las cinco entidades— y nada más. Sin espacios de nombres, sin DTD, sin
entidades definidas por el documento: un `.xlsx` no los tiene.

**Lo que se gana, además de poder probarlo.** No se construye un árbol: se
recorre el XML avisando de cada etiqueta. Una hoja de Excel con 30 000 celdas no
tiene por qué entrar entera en memoria dos veces —una como texto y otra como
árbol— para leer sus filas, y menos en un teléfono.

**Lo que cuesta.** Es código propio de un formato que no se inventó acá, y hay
que mantenerlo. Se acota escribiéndolo para lo que existe y no para lo que podría
existir, y probándolo contra los casos donde un lector ingenuo se rompe **en
silencio**: un `>` adentro de un valor de atributo, un texto partido en varios
trozos, un comentario con un `>` adentro, un archivo cortado a la mitad.

**Comprobado contra otro programa, no contra sí mismo.** Se leyó la copia de
estructura de la planilla del usuario con este lector y con **openpyxl**, y se
compararon las **1.614 celdas** una por una: cero diferencias, ni de valor ni de
posición ni de qué celdas existen. Un lector de formatos probado solo contra sus
propios archivos lee bien exactamente lo que él mismo escribe.

**Lo que sigue en pie de ADR-010:** el ZIP se abre con `DecompressionStream`, que
sí está en Node y en el navegador, y el usuario sigue sin tener que convertir su
planilla a nada.

---

## ADR-029 · Los colores de los rubros salen de la planilla del usuario, con el matiz conservado y la luz corregida

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-922

**El problema.** La app tenía una paleta categórica elegida por su legibilidad,
sin ninguna relación con la planilla que el usuario viene mirando desde octubre
de 2025. Ahí supermercado es naranja y viajes es verde desde hace once meses. Un
color es una etiqueta que se aprende una sola vez: cambiarla sin motivo obliga a
volver a leer los nombres, que es justo lo que el color evita.

**Lo que se descartó: copiar los pasteles tal cual.** Se midieron los ocho
colores de la planilla con el validador de la guía de visualización y dieron
**cuatro fallas**: quedan fuera de la banda de luz, seis de los ocho se leen como
gris por tener muy poco croma, `#FFCCCC` y `#FFCC99` se diferencian en **ΔE 6,6
con visión normal** —abajo del piso de 15— y el lila de salud está en el **mismo
matiz** que el violeta de entretenimiento (−53° contra −54°). Son colores
pensados para ser **fondo de celda con texto negro encima**, no para ser un punto
de 8 px o un pedazo de torta. Copiarlos habría sido fiel a la planilla y peor de
leer que lo que ya había.

**Lo que se hizo.** Se le sacó a cada color de la planilla su **matiz** —lo que
uno reconoce: "el rosa", "el naranja"— y se le asignó a ese rubro el paso ya
validado más cercano. Seis de los ocho se movieron **23° o menos**: siguen siendo
el mismo color con otro nombre técnico. Los dos que se movieron más son los dos
que estaban rotos: salud, porque su lila era indistinguible del violeta de
entretenimiento, y otros, porque su gris clarito no contrasta contra un fondo
blanco.

**Dónde sí van los pasteles, tal cual.** En los fondos de celda del `.xlsx`
(`FONDOS_RUBRO`), que es para lo que fueron elegidos y donde funcionan: ahí el
color es fondo de un texto negro, y se comprueba con la fórmula de contraste de
WCAG que ese texto se lea.

**Los ingresos también.** En la planilla trabajo es verde, inversiones celeste,
regalos rosa y otros gris. Antes la app los repartía por su posición en la lista.
Ahora `FRANJA_DE_INGRESO` los ata a los colores de la planilla, aunque eso
implique que un ingreso comparta color con un gasto: nunca aparecen en la misma
tabla, porque el desglose se dibuja por tipo. Los dos "otros" —gasto e ingreso—
comparten el gris por el mismo motivo, y eso da vuelta a propósito la decisión
que había tomado T-909.

**El límite que apareció.** Con ocho colores **ninguna** paleta pasa el validador
en `--pairs all` —todos contra todos—, ni la anterior. Se comprobó, no se
supuso. Por eso la torta de T-918 va a dibujar los rubros en **orden fijo**, no
por tamaño: así los pares que quedan pegados son siempre los mismos y se pueden
validar. Es la misma regla de siempre —el color sigue a la cosa, nunca a su
puesto en el ranking.

**Lo que quedó con aviso y no con falla.** Con fondo claro, dos pares dan ΔE 7,2
en visión con daltonismo y uno queda corto de contraste. La guía lo permite
cuando hay **rótulo directo**, y lo hay: cada fila dice su nombre y su importe, y
la torta va a llevar los nombres al lado. Con fondo oscuro la paleta pasa las
seis comprobaciones.

---

## ADR-030 · La torta reemplaza a las barras, y por eso la lista se queda

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-918

**Quién decidió qué.** El usuario pidió los dos gráficos que tiene en su
planilla —una torta por rubro y una línea de gasto acumulado— y decidió que la
torta **reemplace** a las barras de proporción, no que convivan.

**El costo, dicho antes de pagarlo.** Una torta se compara peor que una barra:
el ojo compara ángulos bastante peor que longitudes, y dos porciones de 23 % y
20 % se distinguen mucho menos que dos barras de esos largos. Lo que se gana es
el reparto **del todo** de un vistazo, y una forma que él ya reconoce.

**Cómo se paga el costo:** la lista de rubros ordenada de mayor a menor **no se
saca**. Ahí están el nombre, el importe y el porcentaje de cada uno, que es donde
se compara con precisión. La torta da la forma; la lista da los números. Sin la
lista, el cambio sí sería una pérdida neta, y esto deja de ser una decisión de
gusto.

**Las porciones se dibujan en el orden fijo de la paleta, no de mayor a menor.**
Con ocho colores ninguna paleta pasa el validador comparando todos contra todos
(ADR-029); sí pasan los pares que quedan **pegados**, siempre que sean siempre
los mismos. Dibujar por tamaño haría que cargar un gasto cambiara qué color toca
a qué color, y un par que hoy se distingue mañana no. Es la misma regla de
siempre: el color sigue a la cosa, nunca a su puesto en el ranking.

**El ángulo sale del importe, no del porcentaje redondeado.** Ocho números
redondeados no suman 360: la última porción quedaría con un hueco o pisando a la
primera.

**Solo las porciones grandes llevan su número adentro** (desde 8 %). Ocho
números en una torta de teléfono se pisan entre sí, y todos los porcentajes están
en la lista de abajo. Ese número es **el único texto de la app que no usa un
color de texto**: va encima de un color de rubro, así que se elige contra ese
fondo. El negro es el único que se lee sobre los ocho tonos en los dos modos —lo
peor es 4,2:1 sobre el verde—, y un test lo comprueba contra la paleta, para que
un cambio futuro de colores falle ahí y no lo descubra el usuario mirando un
"32 %" ilegible.

**La línea lleva las dos series, gasto e ingreso, en un solo eje.** El dato que
se busca ahí no es cuánto se gastó —eso ya está arriba en número grande— sino
**cuándo una cruza a la otra**. Son la misma unidad, así que comparten escala:
dos escalas en un mismo dibujo es la forma más común de mentir con un gráfico,
porque hace que la línea de abajo parezca alcanzar a la de arriba. Cada línea
dice cuál es **donde termina**, no en una referencia aparte.

**En el mes en curso la línea se corta en el día de hoy.** Si siguiera hasta el
31, quedaría plana desde hoy hasta fin de mes, y una meseta en un acumulado se
lee como "dejó de gastar". Esos días no pasaron todavía.

**Se dibuja en SVG escrito a mano.** No es purismo: una biblioteca de gráficos se
trae de un CDN y eso está prohibido (RN-06). Un sector de círculo y una polilínea
son dos fórmulas de trigonometría.

---

## ADR-031 · El promedio deja afuera el mes en curso, y la pantalla lo dice

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-021

**De dónde sale.** La hoja `Analisis1` del Excel suma el total sobre `D4:D14` y
promedia sobre `D4:D13`: once meses en una fila y diez en la otra. Puede ser
deliberado —tiene sentido no promediar un mes empezado— pero **no está escrito en
ningún lado** (L-006), así que es imposible saber si fue a propósito o un
descuido, y el próximo que lo lea lo va a "arreglar".

**La decisión.** El **total incluye** el mes en curso; el **promedio, no**. Un mes
empezado tiene menos días que los demás y arrastra el promedio para abajo, pero
sacarlo del total escondería plata gastada de verdad.

**Lo que la hace distinta del Excel** no es el número: es que la pantalla escribe
la regla abajo de la tabla, con el mes que dejó afuera nombrado. Una decisión sin
explicación es indistinguible de un error.

**Casos que había que resolver, y no eran obvios:**

- Si el único mes cargado es el que está en curso, el promedio lo usa igual. Lo
  otro es dividir por cero, y un "—" en el promedio del primer mes de uso se lee
  como una app rota.
- El mes en curso sale del promedio **solo si de verdad está en la tabla**. Mirar
  una matriz de meses viejos no tiene por qué dar un promedio sobre uno menos.

**Los ocho rubros están siempre, aunque un mes no tenga ninguno.** Es una matriz:
una columna que aparece y desaparece según el mes deja de ser una columna. Es lo
mismo que el usuario pidió para la planilla exportada.

**Los meses van seguidos, sin saltear los vacíos.** Un mes sin nada se muestra en
cero. Saltearlo haría que dos filas pegadas fueran enero y marzo, y comparar la
columna de al lado pasaría a depender de leer la etiqueta de cada fila en vez de
mirar hacia abajo.

**Es una tabla y no un gráfico**, a diferencia del resumen del mes. Acá la
pregunta no es "cómo se reparte" —eso lo contesta la torta— sino "cuánto gasté en
supermercado en enero, y en febrero": leer un valor exacto en el cruce de dos
cosas. Para eso la tabla es la forma. Once meses por ocho rubros en la pantalla
de un teléfono son 88 marcas de dos milímetros.

**Tres cosas para que una tabla ancha funcione en un celular**, comprobadas en el
navegador y no supuestas: la tabla se desliza **dentro de su caja** y la página
no se mueve; la columna del mes queda **fija** al deslizar —se midió: se queda en
el mismo píxel después de correr 400—; y los importes van **sin el símbolo del
euro**, que repetido en noventa y nueve celdas se come una columna entera de
rubro. Que todo está en euros lo dice el pie, una vez.

**No es una quinta pestaña.** Se llega desde el resumen del mes, que es donde
nace la pregunta ("gasté 620 en gastos fijos… ¿es mucho?"). Una quinta pestaña
dejaría a "Movimientos" sin lugar para su etiqueta en un teléfono de 390 px, y la
evolución no es algo que se mire todos los días.

---

## ADR-032 · El promedio de un gasto fijo dice cuántos pagos y entre qué meses

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-022

**El número del Excel.** El bloque `GASTOS FIJOS PROMEDIO` muestra, por cada
gasto fijo, cuántas veces se pagó, el total y el promedio por pago.

**El problema de mostrar solo el promedio.** "Internet: 48,63 €" se lee como
*"me sale 48,63 por mes"*. Puede no serlo: si son tres pagos repartidos en diez
meses, el promedio por pago no es un costo mensual, y la diferencia entre las dos
lecturas es de tres veces. El número no está mal; la lectura obvia sí.

**La decisión:** al lado de cada promedio va **"3 pagos · nov 25 → ago 26"**. Con
eso, el mismo número dice lo que de verdad dice, y no hace falta inventar un
segundo promedio "por mes" que tendría sus propios supuestos (¿desde el primer
pago o desde el primer mes cargado? ¿cuentan los meses sin pagar?).

**El promedio es el número grande, no el total.** La pregunta es "¿cuánto me
sale?", no "¿cuánto llevo gastado?". El total va al lado en chico porque es lo
que permite comprobar el promedio a mano.

**Mira todo el historial, no un mes.** Un promedio sobre un mes es el gasto de
ese mes con otro nombre. Por eso la pantalla no tiene selector de mes.

**Agrupa por el comentario**, que es la columna B de la planilla y lo que el
usuario ya viene usando como etiqueta (MAPEO-EXCEL §3). Por la clave normalizada,
no por el texto: `Luz` y `luz` son la misma factura (RN-03).

**Los pagos sin comentario se cuentan aparte y se dicen.** En la planilla real
hay filas de gastos fijos sin comentario. Sin comentario no hay nada que
promediar —no se sabe si son tres facturas de luz o tres cosas distintas—, pero
descartarlas en silencio haría que **la lista no cerrara con el total del rubro**
y el usuario no tendría cómo darse cuenta. Se muestran contadas y sumadas, con la
frase que dice cómo hacer que entren. Se comprobó en el navegador: los tres
grupos más los dos sueltos dan 471,90 €, que es exactamente lo que la matriz de
al lado muestra en la columna de gastos fijos.

**Vive en la misma pantalla que la evolución.** Las dos contestan preguntas sobre
el historial y ninguna se mira todos los días; separarlas en dos pantallas sería
dos puertas para el mismo cuarto.

---

## ADR-033 · Cambiar los decimales de una moneda es un paso aparte, con su aviso

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-024

**Por qué no es un `<select>` en la fila.** Un monto se guarda en unidades
mínimas: `150000` son 1.500,00 con dos decimales y 150.000 con cero. Cambiarle
los decimales a una moneda **no reescribe ningún monto: los lee distinto**. Todos
los gastos ya cargados en esa moneda pasan a valer cien veces más o cien veces
menos, y nada parpadea.

Un desplegable en la fila aplicaría eso con un toque. Así que el cambio es un
paso aparte que, **antes de aplicarse, dice cuántos movimientos reinterpreta y
muestra uno de ejemplo con el antes y el después**. Es la misma regla que la
corrección de un tipo de cambio (ADR-019): cuando un número puede cambiar el
significado de datos que ya existen, el aviso es parte de la funcionalidad.

**El ejemplo sale de un movimiento real del usuario**, no de uno inventado. "Esto
afecta a 47 movimientos" es abstracto; ver que *tu* gasto de `15.000,00 CRC` pasa
a leerse `1.500.000 CRC` no lo es.

**El aviso se mueve con el número elegido**, sin redibujar el formulario
(ADR-023). Decir "reinterpreta 47 movimientos" con el valor viejo sería peor que
no decir nada.

**Los decimales del formulario de agregar se explican con un ejemplo**, no con
una definición: "0 — se escribe 1.500" se entiende sin traducir; "cuántos dígitos
van después de la coma" hay que traducirlo.

**El botón de borrar solo aparece cuando de verdad se puede** —es decir, cuando
esa moneda no tiene ningún movimiento—. Un botón que siempre contesta "no"
enseña a no tocarlo, y de paso esconde que existe "ocultar", que es lo que el
usuario quería hacer. El euro no ofrece ninguna de las tres acciones: es la
moneda en la que se expresan todos los totales.

**Lo que encontró el recorrido en el navegador y ningún test veía:**

1. **El error no se mostraba en ninguna parte.** `vista.error` se dibujaba solo
   dentro del formulario de carga, así que "ya tenés una moneda con ese código" y
   "no se puede borrar, tiene movimientos" se guardaban en el estado y no
   aparecían: el usuario tocaba el botón y no pasaba nada. Ahora `dibujarError()`
   se exporta y se usa en las dos pantallas — dos formas distintas de mostrar un
   error son dos lugares donde arreglar el mismo problema.
2. **Las monedas ocultas no se veían ocultas.** La clase `apagada` estaba en el
   HTML y no tenía ninguna regla en el CSS. Los tests pasaban porque buscaban la
   clase, no su efecto; ahora hay uno que exige que la regla exista.
3. **Los datos de cada fila se leían corridos**: "Euro sin movimientos" parecía
   el nombre de la moneda. Iban en tres trozos pegados, y los tests los buscaban
   por separado y los encontraban a los tres.

Las tres son la misma lección de siempre en tres formas distintas: **un test que
busca un pedazo no ve el conjunto**, y por eso el recorrido por el navegador es
obligatorio y no opcional.

---

## ADR-034 · Un total que no se puede desarmar es un callejón sin salida

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-026

**El problema, dicho por el usuario:** *"quisiera poder hacerles click y ver
todos los items que contiene cada una"*. Hasta ahora el resumen decía
"Supermercado 410,00 €" y para saber de qué se componía había que ir a
Movimientos y leer el mes entero. Cada agrupamiento de la app era un número que
no se podía abrir.

**Una sola solución para los cuatro lugares donde la app agrupa** —una fila del
desglose, una fila de gastos fijos, una celda de la matriz y un mes de la
matriz—: todos llevan a **la lista de movimientos, filtrada**. No son cuatro
pantallas nuevas; es un filtro en la lista y cuatro puertas hacia él.

**La lista filtrada TIENE que decir que lo está.** Es la parte obligatoria y no
la decorativa: siete movimientos de doscientos, sin decir por qué, no se leen
como "filtrado" sino como **datos perdidos**. Así que hay un cartel arriba de
todo que dice en qué está filtrada y trae la salida al lado.

**Y muestra el total de lo filtrado**, que es el número que se venía a desarmar.
Verlo repetido arriba de la lista es la confirmación de que lo de abajo es de
verdad lo que lo compone. Se comprobó en el navegador: el desglose decía
61,40 €, la lista filtrada dice 61,40 € y cuatro movimientos.

**El filtro es de un momento, no del estado**, y se limpia al cambiar de
pestaña. Es el mismo razonamiento que ya estaba escrito para el aviso de
"guardado" y el error de validación: una lista filtrada a la que se vuelve media
hora después no se lee como filtrada. **Se llega filtrado tocando un total; se
llega entero tocando la pestaña.**

**El comentario mira todos los meses; el rubro, no.** La tarjeta de gastos fijos
habla de todo el historial, así que tocarla y ver solo el mes en curso mostraría
una parte del número que se acaba de tocar. El desglose del mes habla de un mes.
Cada puerta hereda el alcance de lo que se tocó.

**Se toca la fila, no la porción de la torta.** Una porción del 1 % en un
teléfono son dos milímetros; la fila está siempre y tiene el mismo tamaño para
todos los rubros. Por el mismo motivo, **una celda de la matriz en cero no lleva
a ningún lado**: un botón que abre una lista vacía es peor que una celda quieta.

**Un filtro sin resultados no dice "no hay movimientos en este mes"**, que sería
mentira —los hay, ninguno entra en el filtro—, ni ofrece cargar uno nuevo, que
sería el consejo equivocado. Dice lo que pasa y deja la salida a la vista.

---

## ADR-035 · Renombrar une, y borrar una etiqueta no borra ningún movimiento

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-025

**Lo que el usuario pidió:** *"dónde puedo editar las categorías de detalles
existentes? puede que quiera borrar alguna"*.

**Lo primero es que no son categorías.** Los rubros sí son un catálogo cerrado de
ocho; el comentario y el detalle son **texto libre escrito en cada movimiento**.
No hay ninguna lista guardada: `etiquetasUsadas()` la deduce recorriendo los
movimientos. Eso cambia la tarea entera:

- **Borrar una etiqueta no es borrar un registro**: es vaciar ese texto en los N
  movimientos que lo tienen.
- **Renombrarla es reescribirlo en los N.**

Son operaciones en lote sobre datos ya cargados, así que les toca la regla de
ADR-019 y ADR-033: **decir cuántos movimientos tocan antes de tocarlos**.

**Renombrar con el nombre de otra etiqueta LAS UNE, y esa es la función.** Un
typo parte un total en dos sin avisar (L-002): `Barcelona26` y `barcelona 26` son
dos viajes distintos en las cuentas. Renombrar uno con el nombre del otro los
junta. Por eso el aviso previo no dice solo "se reescribe en N": cuando el nombre
nuevo ya existe, dice **"se van a unir"**, con cuántos quedan.

Es también la salida a la pregunta que ADR-013 dejó abierta: `Perú` y `Peru` son
dos claves distintas **a propósito** —sacar tildes automáticamente juntaría
palabras que el usuario quiso separar—, y ahora se pueden juntar a mano las que
él decida que son la misma. La decisión sigue siendo suya; lo que cambió es que
tiene con qué ejecutarla.

**Cada etiqueta muestra cuántas escrituras distintas tiene.** Es el dato que
delata el typo: sin él, `Luz` y `luz` se ven como dos filas cualesquiera y nadie
va a ir a arreglarlas. "Barcelona26 · 2 formas de escribirlo" es exactamente lo
que hay que abrir.

**Borrar dice con todas las letras que los movimientos no se borran.** "Borrar
Luz" y "borrar los gastos de luz" se confunden con una lectura rápida, y una de
las dos no se puede deshacer. La confirmación lo dice, y para un comentario
agrega que esos movimientos van a dejar de contarse en los totales agrupados.

**El texto nuevo se guarda normalizado**, igual que al cargarlo a mano. Si acá se
guardara crudo, esta pantalla sería la única forma de meter en los datos un texto
con dos espacios o sin normalizar en NFC — justo lo que esa normalización existe
para impedir (L-003).

**Se ofrece también para el detalle**, porque el usuario lo pidió, pero la
pantalla aclara la diferencia: el comentario **agrupa** y limpiarlo arregla
números; el detalle es una nota y limpiarlo es orden.

**Un paso a la vez.** Renombrar y borrar no se muestran juntos, ni con la lista
de acciones detrás: dos cosas delicadas a la vez son dos decisiones simultáneas.

---

## ADR-036 · Un viaje no es un registro, y sus días no se deducen

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-023

**Qué es un viaje.** Un comentario con **al menos un gasto del rubro `viajes`**.
La regla sale de los datos, no de una lista aparte: dos lugares que digan cuáles
son los viajes son dos lugares que se desincronizan. `Luz` nunca va a tener un
gasto de rubro `viajes`, así que nunca va a aparecer en esta pantalla.

**Pero el total suma todos los rubros del viaje**, no solo `viajes`: en un viaje
se come, se toma transporte y se compra en el supermercado, y todo eso es plata
del viaje. Es lo mismo que hace la planilla, que suma por comentario sin mirar
el rubro.

**El viaje se sigue escribiendo a mano** (decisión del usuario, 2026-08-28), con
la condición de poder corregirlo en un solo lugar y que el cambio llegue a todos
sus movimientos — eso es T-025, y por eso T-023 dependía de ella. Sin renombrar
en lote, escribir a mano vuelve a ser lo que parte un total en dos sin avisar.

**Los días se escriben, no se deducen** (decisión del usuario). Un viaje puede
empezar antes del primer gasto registrado o terminar después del último:
deducirlos de la primera y la última fecha daría un gasto por día **más alto de
lo real**, con cara de exacto y sin avisar.

**La consecuencia importante: sin días escritos NO hay gasto por día.** No se
muestra un número aproximado ni un "≈": en su lugar va el botón para escribirlos.
Un promedio calculado sobre un supuesto que nadie confirmó es exactamente el
número que el usuario vino a buscar, y estaría mal.

**Dónde viven los días.** En `estado.dias_de_viaje`, una lista de
`{ clave, dias }`. **Se llama así y no `viajes` a propósito**: no es un catálogo
de viajes —la lista de viajes sigue saliendo de los comentarios— sino un dato
suelto sobre uno de ellos. Es el único dato de un viaje que hay que guardar,
justamente porque es el único que no se puede deducir de los movimientos.

Entra en el respaldo como todo lo demás, y un registro roto se descarta solo sin
llevarse a los otros: perder cuántos días duró un viaje es molesto; perder los
otros veinte por culpa de ese, no.

**"No sé cuántos días fue" es una respuesta válida** y borra los días. Es
distinta de "cero días", que no significa nada y haría que el gasto por día
fuera infinito.

**Los vuelos y el alojamiento pagados aparte no tienen función propia**, por
decisión del usuario: eran dos excepciones del comienzo del registro
(`=96+SUMIFS(...)` en París, `=850+...` en Costa Rica) y no va a haber más. Si se
los quiere incluir, se cargan como lo que son: un gasto con su fecha, su rubro y
el comentario del viaje.

---

## ADR-037 · Se escriben las fechas del viaje, no los días; y «Comentario» pasa a llamarse «Etiqueta»

**Fecha:** 2026-08-28 · **Estado:** aceptada · **Tarea:** T-941 ·
**Reemplaza parte de ADR-036**

**Los días pasan a calcularse.** ADR-036 decía que la duración se escribía a
mano. El usuario pidió otra cosa y es mejor: **se escriben la fecha de inicio y
la de fin, y los días salen de restarlas.** Dos motivos:

1. **Una fecha es un dato que uno recuerda** —"salí el 3 y volví el 12"—; un
   número de días es una cuenta que hay que hacer, y hacerla mal es fácil.
2. **Con las fechas guardadas, los viajes se pueden ordenar por cuándo
   terminaron**, que es como uno los piensa. Con solo un número de días, no.

**Lo que NO cambia de ADR-036:** la duración sigue sin deducirse de los
movimientos. Un viaje puede empezar antes del primer gasto anotado o terminar
después del último, y deducirlo daría un gasto por día más alto de lo real con
cara de exacto. Y sin fechas escritas **sigue sin haber gasto por día**.

**Los días se cuentan con las dos puntas.** Del 3 al 12 son diez días, no nueve:
el 3 se viajó y el 12 también. Es la cuenta que hace una persona y la que no hace
una resta de fechas a secas. La aritmética va en UTC al mediodía, que es lo único
que no se corre en marzo y en octubre por el horario de verano.

**La cuenta se muestra mientras se escribe**, antes de guardar: "Son 12 días,
contando el primero y el último". Convierte dos fechas en el dato que interesa
sin pedirle al usuario que confíe.

**El orden es por fecha de fin, del más reciente arriba** (pedido del usuario).
Antes iban de más caro a más barato: es un orden útil para *otra* pregunta, no
para "¿cuándo fui a dónde?".

**Un viaje sin fechas se ordena por su último gasto.** Sin esa regla, todos los
viajes sin fechas se amontonarían en una punta de la lista, lejos de cuando de
verdad pasaron. Y **las fechas escritas mandan sobre las de los gastos**: un
viaje cuyo hotel se pagó a la vuelta no tiene por qué aparecer como el más
reciente.

**Media fecha no se guarda.** Con solo la de inicio no hay duración, y guardarla
a medias dejaría un dato que ninguna pantalla puede usar y que el usuario cree
haber cargado.

---

**«Comentario» pasa a llamarse «Etiqueta (agrupar por)»** (pedido del usuario).
El nombre viejo venía de la columna `Comentarios` de la planilla y sonaba a nota
suelta, cuando es **de lo que dependen los totales por viaje y por gasto fijo**.
El nombre nuevo dice para qué sirve.

**Lo que cambia es lo que se lee, no lo que se guarda.** Adentro el campo se
sigue llamando `comentario`: renombrarlo dejaría ilegibles los respaldos que el
usuario ya tiene, y el nombre de un campo guardado no es algo que él vea nunca.
Hay un test que recorre **todas** las pantallas y falla si alguna vuelve a decir
"comentario" en su texto.

**La única excepción es el `.xlsx` exportado**, donde la columna sigue diciendo
`Comentarios`: esa hoja existe para parecerse a la planilla de siempre, y esa es
la palabra que su planilla usa.

---

## ADR-038 · El zoom es una ventana de índices, y el dibujo sigue siendo puro

**Fecha:** 2026-08-29 · **Estado:** aceptada · **Tarea:** T-942

**Lo que pidió el usuario:** que los dos gráficos del historial se puedan
acercar, que tengan más marcas en el eje de las x, y que tocando un punto diga en
qué momento está y cuánto valía cada línea ahí.

**El problema de diseño:** un gráfico interactivo parece incompatible con
ADR-022 —el dibujo es una función pura que devuelve texto HTML—. No lo es, si se
elige bien qué es el estado.

**La decisión: el dibujo recibe una VENTANA.**

    interiorDeSerie(serie, ventana, seleccion) → el SVG de esa parte

El zoom, el desplazamiento y el punto elegido no son más que **cambiar la ventana
y volver a llamar a esa función**. Así lo que decide qué se ve —que es donde
puede mentir— se prueba con `node --test`, y lo único que toca el navegador es
traducir un dedo en una ventana (`ui/series-interaccion.js`).

**La ventana son índices, no fechas.** Los datos vienen ordenados y sin huecos
—`acumuladoHistorico()` devuelve todos los días, también los vacíos—, así que el
índice *es* el tiempo, y el zoom no depende de que los puntos estén parejos.

**Todo lo que la mueve pasa por `acomodarVentana()`**, que la mete adentro de la
serie, le garantiza dos puntos y la endereza si viene dada vuelta. Repartir esa
comprobación entre el zoom, el arrastre y el dibujo serían tres reglas que se
separan, y la primera que se olvide deja **el gráfico vacío, sin error y sin
aviso**, justo mientras el usuario mueve el dedo.

**La escala vertical se calcula sobre lo que se ve.** Es lo que hace que el zoom
sirva de algo: acercarse a tres meses de un año y seguir viendo la escala del año
deja las tres líneas pegadas y planas.

**Cinco etiquetas en el eje, siempre la primera y la última.** El pedido era "más
coordenadas", pero once fechas en 300 píxeles se pisan y no se lee ninguna. Cinco
repartidas parejo, y una marquita por punto mientras entren. Sin la primera y la
última no se sabe **entre qué momentos** se está mirando, que es lo primero que
hace falta después de acercar.

**Lo que se lee al tocar va DEBAJO del gráfico, no flotando encima.** En un
teléfono, un cartel flotante queda tapado por el dedo que lo pidió. Y lleva el
color de cada línea al lado del nombre, para que se ate al dibujo sin depender
solo del color.

**Hay botones además del gesto.** El pellizco está y funciona, pero un gesto que
el teléfono del usuario no interprete deja el gráfico sin salida — este proyecto
ya pagó esa lección con el `<datalist>` que su Android no dibujaba (L-021). Los
botones `−`, `+` y `Ver todo` siempre están, y se pueden probar.

**Acercar angosta al menos un punto por toque.** Sin eso, con tres puntos a la
vista el 60 % vuelve a redondear a tres y **el botón deja de hacer nada** sin
decir por qué. Lo encontró un test que esperaba llegar al mínimo de dos.

**El zoom se pierde al cambiar de pantalla, y está bien:** es cómo estás mirando,
no un dato tuyo. Por eso vive en el elemento y no en el estado de la app
(ADR-023), y no se guarda en ningún lado.

**`touch-action: none` en el SVG** es la línea que hace que el zoom exista: sin
ella, arrastrar el dedo adentro del gráfico desplaza la **página** y el gesto
nunca llega.

---

## ADR-039 · Buscar saca las tildes; agrupar no. Y la ñ no se toca

**Fecha:** 2026-08-29 · **Estado:** aceptada · **Tarea:** T-943

**Lo que pidió el usuario:** una lupa en la pestaña de movimientos que busque en
**todos los movimientos cargados** y **en todos sus campos**.

**Buscar es generoso donde agrupar es estricto.** Parece contradecir ADR-013, que
decidió a propósito que `Perú` y `Peru` fueran dos etiquetas distintas. No lo es,
y la diferencia es la que importa:

- **Agrupar junta plata.** Sacar tildes automáticamente uniría totales que el
  usuario quiso separar, y eso **no se ve**: el número sale mal y listo.
- **Buscar solo muestra.** Si encuentra de más, se ve y se descarta. Si encuentra
  de menos, el usuario cree que el gasto no existe **y lo vuelve a cargar**.

Equivocarse siendo generoso es barato y visible; equivocarse siendo estricto
esconde datos. Por eso `peru` encuentra `Perú`, y en los totales siguen siendo
dos etiquetas.

**La ñ se salva a mano.** Para Unicode es una `n` con tilde y `NFD` la parte
igual que a la `á`; para el español es **otra letra**. Sin cuidarla, buscar `ano`
encontraría todos los `año`. La `ü` sí se saca: `pinguino` tiene que encontrar
`pingüino`.

**Cada campo entra en las dos formas: como se guarda y como se muestra.** El
usuario busca por lo que ve en la pantalla, no por lo que hay en el archivo, así
que `12,50` y `1250` encuentran el mismo gasto, y `14/03/2026` y `2026-03-14`
también.

**Varias palabras: tienen que estar todas.** `roma cena` trae los movimientos que
dicen las dos cosas. Buscar dos palabras es acordarse de dos cosas del **mismo**
gasto, no de dos gastos distintos.

**Busca en todo el historial, no en el mes que se está viendo.** Quien busca
"psicóloga" no sabe en qué mes fue —si lo supiera no buscaría—, y limitarlo al
mes en curso daría "no hay nada" sobre datos que sí están. Por eso cada resultado
lleva **su fecha completa**: una lista de gastos de once meses distintos sin fecha
no se puede leer.

**Sin resultados se explica dónde se buscó.** "No hay nada" sobre datos que sí
están se lee como que la app perdió algo.

**Lo buscado se guarda en la vista, pero solo se redibuja el trozo de los
resultados.** Es la parte fina: repintar la pantalla entera en cada tecla le
sacaría el foco al campo y movería el cursor (ADR-023). Guardarlo hace falta
igual, porque borrar un movimiento desde los resultados sí repinta todo, y sin
eso la búsqueda se perdería justo al usarla. Se comprobó en el navegador
escribiendo letra por letra: el foco queda y el cursor no se mueve.

**La búsqueda no sobrevive a cambiar de pestaña**, igual que el filtro
(ADR-034): una lista incompleta a la que se vuelve media hora después se lee
como datos que faltan.

---

## ADR-040 · El eje de importes se marca con números redondos, no dividiendo el rango

**Fecha:** 2026-08-29 · **Estado:** aceptada · **Tarea:** T-944

**Lo que pidió el usuario:** que el eje de las Y tenga más etiquetas, no solo el
valor máximo — *"por ejemplo etiquetas de 1000 en 1000, más referencias"*.

**La parte que importa es "de 1000 en 1000", no "más".** Lo fácil sería dividir
el rango en cinco: con un techo de 2.317,45 € daría marcas en 463,49 · 926,98 ·
1.390,47… Números exactos que **no significan nada** y que además cambian en
cuanto se hace zoom. Un eje así es peor que uno con una sola marca, porque
invita a leer con precisión una escala que no la tiene.

**Los pasos salen de una serie de números redondos** —1, 2, 5, 10, 20, 50, 100…
en euros— y se elige el más chico que no pase de cinco marcas. Con un rango de
0 a 2.300 € da **500 €**; de 0 a 45 €, **10 €**; de 0 a 1 €, **50 céntimos**. Son
números que uno diría en voz alta.

**Las etiquetas van sin decimales cuando el paso es de un euro o más.**
`2.100,00` ocupa el doble que `2100` en el margen de un teléfono y no dice nada
más. Los céntimos se ven al tocar el punto, que es donde importan.

**Cada marca lleva su línea, muy apagada.** Es una referencia para leer una
altura, no un dato: si compitiera con las series, el gráfico pasaría a ser una
grilla con líneas encima. La del cero se dibuja distinta —cruzarla significa
algo— y no se repite como una raya más.

**Ninguna marca se sale del dibujo.** Se generan solo los múltiplos que caen
adentro del rango visible; una marca de más se dibujaría arriba del borde o
abajo del eje.

**El cero sale gratis y no hay que forzarlo.** La primera versión lo agregaba a
mano "por las dudas": si el rango cruza el cero, el cero es múltiplo de cualquier
paso, así que ya estaba. **Una mutación demostró que esa línea era inalcanzable**
—borrarla no ponía ningún test en rojo porque no hacía nada— y se fue. Lo que sí
hace falta es el `+ 0` del arranque: `Math.ceil(-0.4) * 100000` da **−0**, que se
formatea como `-0` y se lee como un error de la app.


## ADR-041 · Una etiqueta va a una sola pantalla, y se decide en cascada

**Contexto.** La etiqueta ya agrupaba dos cosas: los viajes (al menos un gasto
del rubro `viajes`, ADR-036) y los gastos fijos (los del rubro `gastos fijos`
con etiqueta). El usuario pidió poder agrupar **cualquier otra cosa** —una
mudanza, unos regalos, el arreglo del auto— en una tercera pantalla.

Con tres pantallas mirando las mismas etiquetas, el riesgo deja de ser un total
mal sumado y pasa a ser un **reparto**: la misma etiqueta apareciendo en dos
listas con dos totales distintos, o cayéndose de las tres.

**Decisión.** Una sola función pura, `categoriaDeEtiqueta()`, decide en cascada
mirando **los gastos** de esa etiqueta:

1. Si **todos** son del rubro `gastos fijos` → `'fijo'`.
2. Si **alguno** es del rubro `viajes` → `'viaje'`.
3. Si no → `'otro'`.

Las tres pantallas preguntan a esa misma función. `gastosFijos()` y
`otrosGrupos()` además parten de la misma `porEtiquetaDeGasto()`, para que no
puedan clasificar distinto.

**Se decide con los gastos, no con los ingresos.** Una devolución con la misma
etiqueta no cambia de qué es el grupo. Y hay un motivo más fuerte: el rubro de
un ingreso **nunca** puede ser `gastos fijos` —esa lista es de gastos—, así que
si los ingresos contaran, una factura con una devolución dejaría de ser un gasto
fijo por tener adentro un movimiento que jamás podría cumplir la condición.

**Por qué el paso 2 no usa el 75 % que propuso el usuario.** Su idea era "si más
del 75 % de la etiqueta es del rubro viajes, es un viaje". **Con esa regla sus
propios viajes dejarían de serlo:** en un viaje se paga el pasaje y el hotel con
rubro `viajes`, pero también se come, se toma transporte y se compra en el
supermercado. El viaje de prueba de T-023 —300 € de `viajes` contra 150 € de
comida y transporte— es **66 %**, y se caería de la pantalla de viajes justo el
caso que esa pantalla existe para mostrar. El umbral quedó igual como la
constante `PARTE_DE_VIAJE = 0`: cambiarlo a `0.75` es una línea, y la decisión
es del usuario.

**Las tres pantallas no se reparten la plata, se reparten las preguntas.** Lo
que decide la cascada es **dónde tiene su grupo propio cada etiqueta**, no qué
pantalla puede nombrarla. La tarjeta de gastos fijos responde "¿cuánto me sale
la luz?" mirando el **rubro** —y suma **solo la parte de ese rubro**—; la de
otros grupos responde "¿cuánto me salió la mudanza?" mirando la **etiqueta**,
con todos sus rubros adentro.

**Corrección del mismo día, pedida por el usuario.** La primera versión sacaba
de la tarjeta de gastos fijos las etiquetas mixtas, para que ningún nombre
apareciera dos veces. Él lo objetó: *"cómo yo etiquete algo no debería alterar
en nada los totales de rubro, son cosas independientes"*. Tiene razón, y el
argumento es más fuerte que el mío: esa tarjeta **agrupa por etiqueta los gastos
de un rubro**, así que etiquetar no puede cambiar lo que se ve de ese rubro. Se
revirtió: "Casa" vuelve a aparecer en gastos fijos con sus 60 € de alquiler, y
también en otros grupos con sus 70 € completos.

**Y como son dos números distintos con el mismo nombre, la fila lo explica.** El
grupo de gastos fijos trae un `conGrupoPropio`, y cuando está encendido la
tarjeta escribe que ahí se suma solo la parte de ese rubro y que el total
completo está en la otra pantalla. **No cambia ningún total**: un mismo nombre
con dos importes y sin explicación es la forma más rápida de que el usuario deje
de creerle a los dos.

**Alternativa descartada:** una lista aparte donde el usuario marque qué
etiqueta es qué. Dos lugares que digan lo mismo son dos lugares que se
desincronizan, y además obliga a mantener a mano algo que los datos ya saben.


## ADR-042 · Los rubros de ingreso van en la misma tabla, con el bloque rotulado

**Contexto.** La tabla mes a mes desglosaba los gastos en ocho columnas y
resumía los ingresos en una sola: decía cuánto entró, no de dónde. El usuario
pidió los rubros de ingreso (2026-08-29). El Excel tampoco los desglosaba, así
que no había un formato previo que copiar.

**Decisión.** Cuatro columnas más, en la misma tabla, después del total de
gastos: `Mes | 8 rubros de gasto | Gastos | 4 rubros de ingreso | Ingresos |
Saldo`. Cada bloque termina en su propio total, que es lo que deja verificar de
un vistazo que la fila cierra.

**Alternativa descartada:** una segunda tabla para los ingresos. Se pierde
justamente lo que el usuario quiere ver: el mes como una fila, con lo que entró
y lo que salió al lado. Dos tablas obligan a leer un mes en dos lugares.

**El problema real no fue el ancho, fue que `otros` está en las dos listas.**
Son cosas distintas (RN-02) y encima comparten el gris —la paleta viene de la
planilla del usuario, donde los dos son grises—, así que ni el nombre ni el
color los distinguen. Tres consecuencias, y las tres importan:

1. **Un rótulo arriba de cada bloque** —"Rubros de gasto" / "Rubros de
   ingreso"—, en la pantalla y en la hoja del `.xlsx`. Va **alineado a la
   izquierda**: centrado sobre ocho columnas, cae en el medio de un bloque que
   no entra en la pantalla de un teléfono y no se ve nunca.
2. **La celda lleva su tipo**, no solo su rubro. Sin eso, tocar "Otros" de
   ingreso mostraba los otros **gastos**: la peor forma de fallar, porque el
   resultado parece correcto.
3. **El cartel del filtro lo dice**: "Mostrando solo Otros (ingresos)".

**Darles dos grises distintos** hubiera sido peor: rompe la correspondencia
entre el color y el rubro en todas las demás pantallas, que es para lo que la
paleta existe (ADR-029).

**La hoja del `.xlsx` cambia igual, y no es opcional.** Las dos leen
`matrizMesRubro()` precisamente para no poder contar cosas distintas; si la
pantalla creciera sola, la planilla pasaría a ser otra tabla con el mismo
nombre.


## ADR-043 · La app también se publica, y el archivo suelto deja de ser el único camino

**Contexto.** Viajecor es un archivo que se baja y se abre. En Android eso
funciona escribiendo `file:///sdcard/Download/viajecor.html`. **En un iPhone no
funciona de ninguna manera:** Chrome en iOS no abre archivos locales —no hay
dirección que escribir— y la vista previa de *Archivos* no guarda nada. El
usuario lo pidió porque quiere usarla en su teléfono (2026-08-29).

**Decisión.** El build escribe la misma app **dos veces**: `dist/viajecor.html`,
que es el archivo que se baja, y `public/index.html`, que es lo que se publica.
La dirección queda corta, escribible en un teclado de teléfono y sin nombre de
archivo que recordar. Qué servicio la sirve se decidió aparte, en ADR-044.

`public/` **no va al repositorio**: la genera el mismo build que corre al
publicar. Guardar en el historial una copia byte a byte de `dist/viajecor.html`
sería medio megabyte por commit para no decir nada nuevo.

**Es una copia byte a byte hecha por el build, nunca a mano**, y hay un test que
compara el contenido de los dos archivos. Dos copias que se editan por separado
son dos apps distintas con el mismo nombre, y el usuario no tendría forma de
saber cuál está usando.

**Publicar no contradice la regla de cero red (RN-06).** Lo que la regla prohíbe
es que **la app** pida algo a internet mientras se usa; eso no cambia. Servir el
programa desde algún lado es inevitable en un teléfono —el archivo también se
baja de GitHub—, y los datos siguen sin salir del dispositivo. Lo que se publica
es el programa, que además ya era público.

**Lo que sí cambia y hay que decirlo:** en la web los datos quedan atados al
**origen** (`agonzalezorge.github.io`), no a un archivo. Dos consecuencias
reales, las dos escritas en `USO.md`:

  - **iOS borra lo guardado si el sitio no se abre en 7 días.** Es política de
    Apple y la app no puede evitarla, así que el respaldo pasa de recomendable a
    necesario.
  - Los datos de la app vieja —abierta como archivo— **no se mudan solos**: hay
    que exportar el `.json` y volver a importarlo. Es el mismo camino que ya
    existe (CU-08), no hace falta nada nuevo.

**El ícono va adentro del archivo, como `data:`.** Dos motivos: sin él, el
navegador pide `/favicon.ico` y cobra un 404 en cada visita —se vio sirviendo la
app por HTTP—, y sobre todo, **"Añadir a pantalla de inicio" en iOS usa
`apple-touch-icon`**: sin eso iOS pone una captura de la pantalla, que en una app
de gastos es una miniatura ilegible de una tabla de números. Lo dibuja
`tools/icono.mjs` armando el PNG a mano, porque no hay dependencias (ADR-003) y
porque un bloque de base64 pegado en la plantilla es algo que después nadie
puede volver a tocar.

**Y la guardia de privacidad creció con la puerta que eso abre:** un
`<link rel="icon" href="…">` que no sea `data:` ahora rompe la construcción. Un
ícono traído de un servidor le cuenta a ese servidor cada vez que abrís la app,
que es exactamente lo que esta app promete que no pasa.


## ADR-044 · Se publica en Vercel, y la promesa de "cero red" pasa a ser una cabecera

**Contexto.** ADR-043 dejó la app lista para publicarse; faltaba dónde. Los dos
candidatos servían igual de bien un archivo estático: GitHub Pages, donde ya
vive el código, y Vercel.

**Decisión: Vercel**, elegido por el usuario (2026-08-30) sobre dos diferencias
reales:

  - **Un origen propio.** El navegador guarda los datos **por origen**, y en
    GitHub Pages el origen es `agonzalezorge.github.io`, compartido con todo lo
    que ese usuario publique. Hoy no hay nada más; el día que lo haya, comparten
    el mismo cajón.
  - **Una dirección más corta**, que en el teclado de un teléfono no es un
    detalle estético.

**Lo que apareció al elegirlo, y terminó siendo lo más valioso: `vercel.json`.**
Vercel deja mandar cabeceras propias; GitHub Pages no. Así que el sitio va con
una **política de seguridad de contenido** que le prohíbe al navegador
conectarse a internet (`connect-src 'none'`), enviar formularios
(`form-action 'none'`) y traer imágenes, fuentes o scripts de afuera
(`default-src 'none'`, con `'unsafe-inline'` para el guión y los estilos, que
van escritos adentro del archivo, y `data:` para el ícono).

Es la diferencia entre *"la app promete que no manda nada"* y **"el navegador no
la deja aunque quisiera"**. La guardia de la construcción (RN-06) mira el
código; esta cabecera lo hace cumplir del otro lado, y cubre incluso el caso de
que algún día alguien agregue una llamada sin darse cuenta. Tiene su test: si
alguien aflojara la política para arreglar algo, se pone en rojo.

**Lo que se comprobó antes de decir que anda**, sirviendo la app con exactamente
esas cabeceras: carga, guarda un movimiento, sobrevive a la recarga, dibuja la
tabla y los dos gráficos, y **baja el respaldo `.json` y la planilla `.xlsx`** —
que era el riesgo concreto, porque las descargas salen de un `blob:` que una
política mal escrita bloquea en silencio y sin error visible—. Y un `fetch` a
internet, probado a propósito, **queda bloqueado por el navegador**.

**El despliegue construye la app, no la copia.** `vercel.json` fija
`buildCommand` y `outputDirectory` en vez de confiar en la convención de cada
servicio —que es justo lo que hizo fallar el primer intento, L-030— y de paso
gana algo: ese build revisa la sintaxis y la ausencia de direcciones de
internet, así que **un error no llega a publicarse**; el despliegue falla y
queda en pie la versión anterior.

**Costo asumido:** un servicio más, con acceso de lectura al repositorio. Y que
mudarse de origen es una mudanza de datos: hay que exportar el `.json` e
importarlo. Escrito en `USO.md`, porque es lo que hace que alguien vea la app
vacía y crea que perdió todo.


## ADR-045 · La app publicada abre sin conexión, y eso cuesta un archivo más

**Contexto.** Como archivo en el disco, Viajecor abría con el modo avión puesto.
Publicada, la primera carga necesita red — y una app de gastos que no abre en un
avión, justo cuando estás gastando en otro país, es un chiste malo. Lo señalé al
publicar (T-949) y el usuario pidió resolverlo (2026-08-30).

**Decisión.** Un **trabajador de servicio** (`src/servicio.js` → `public/sw.js`)
que guarda una copia de la página y la sirve cuando no hay red, más un
**manifiesto** para que el ícono en Android tenga nombre y color propios, y un
pedido de **almacenamiento permanente** para que el navegador no borre los datos
cuando falte espacio.

**Rompe "un solo archivo", y no había forma de evitarlo:** el navegador exige que
un trabajador de servicio venga de su propia dirección. La regla se mantiene
donde importa — **el archivo que se baja sigue siendo uno solo** y no los
necesita, porque desde el disco ya abre sin conexión—. Lo que se agrega existe
únicamente en lo publicado.

**El HTML no menciona ni al trabajador ni al manifiesto.** El enlace al
manifiesto lo cuelga la app al arrancar, y solo si el protocolo es `http:` o
`https:`. Así el archivo bajado y el publicado siguen siendo **el mismo archivo,
byte a byte**: lo que cambia es lo que la app hace según dónde esté, no lo que
es. Pedir un manifiesto desde `file://` sería un error en la consola en el caso
que más se usa hoy.

**Primero la red, la copia como respaldo.** La alternativa —servir la copia y
actualizar por atrás— arranca más rápido y a cambio deja **una versión vieja
pegada**: cargar gastos en una app que ya no es la publicada, sin forma de
enterarse. En una app que se abre dos veces por día, medio segundo de arranque
no vale ese riesgo.

**La política de seguridad se abrió lo mínimo, y del lado correcto.** El
documento sumó `worker-src 'self'` y `manifest-src 'self'`, pero **mantiene
`connect-src 'none'`**: la página sigue sin poder conectarse a ningún lado. El
único que puede hablar con el origen es el trabajador, que tiene su propia
política en su propia ruta (`connect-src 'self'`), porque pedir esta misma
página es literalmente su trabajo. Separar las dos políticas es lo que evita
tener que aflojar la de la app.

**Y el trabajador tiene su propia guardia.** `buscarFugasDelServicio()` es una
lista aparte: puede usar `fetch` y `caches` —sin eso no existiría— pero no puede
tener una dirección de internet, ni `XMLHttpRequest`, ni `WebSocket`, ni
`importScripts`. Dos reglas distintas escritas aparte se pueden leer; una regla
con un agujero adentro, no.

**Se probó ejecutándolo, no solo mirándolo.** El recorrido en el navegador corta
la red de verdad y comprueba que la app abre, que se pueden cargar gastos sin
conexión y que al volver la red sigue todo. Pero eso solo cubre el camino feliz
y el camino sin red; los casos que hacen daño —una respuesta 500 guardada como
si fuera la app, una copia vieja que nunca se tira, un pedido ajeno
interceptado— se prueban en `test/servicio.test.js`, **ejecutando el trabajador
con un mundo de mentira**. Es JavaScript común: recibe `self`, `caches` y
`fetch` del entorno, así que dándole otro entorno se lo puede mirar por dentro.

**El estado del almacenamiento permanente se muestra, incluso cuando es malo.**
La pantalla de Datos dice si el navegador se comprometió a no borrar los datos,
si no lo hizo, o si no se pudo averiguar. Los tres textos llevan al respaldo;
inventar un "estás protegido" sería peor que no decir nada, porque alguien
dejaría de respaldar por eso.


## ADR-049 · Veinte colores, y el orden es la información

**Contexto.** ADR-029 fijó ocho colores —los de la planilla del usuario— y dijo
que ocho era el techo: un noveno tono generado sería indistinguible de alguno
bajo daltonismo. Con los rubros editables (T-048) ese techo pasó a ser un tope
de ocho rubros. El usuario pidió sacarlo y tener **veinte** (2026-08-31).

**Decisión.** Veinte colores por tipo, definidos a mano. **Los ocho primeros no
se tocan** —son los rubros que ya tiene cargados, y moverlos le cambiaría el
color a un rubro con historial— y los doce nuevos se eligieron **uno por uno con
el validador de la guía de visualización**: en cada paso, el color que más lejos
estaba de todos los anteriores, mirando también cómo se ve con protanopia y
deuteranopia.

**Por eso el orden de la lista no es alfabético ni bonito: es la información.**
Cada color entra en la posición que le corresponde por lo distinto que es, así
que el rubro 9 se distingue mucho mejor que el 20. Los números, medidos:

| Posición | 9 | 12 | 15 | 18 | 20 |
|---|---|---|---|---|---|
| Separación mínima (ΔE) | 14,6 | 9,6 | 8,2 | 7,2 | 6,7 |

**Lo que esto significa, dicho sin maquillaje.** La guía pide ΔE ≥ 8 y marca 6–8
como un piso que **solo es legal con codificación secundaria**. A partir del
rubro 15 la paleta entra en esa banda. La codificación secundaria existe y
siempre estuvo: **el nombre del rubro va escrito al lado del color en todas las
pantallas** —la lista del mes, la tabla mes a mes, la leyenda de la torta—, así
que ningún dato se identifica por color solo. Con veinte rubros, el color deja
de ser un identificador y pasa a ser una ayuda para agrupar de un vistazo; eso
es un intercambio real, y es el que el usuario eligió a sabiendas.

**El modo oscuro conserva el TONO de cada color, no se elige aparte.** La
primera versión los eligió por separado y dio la franja 10 morada en claro y
ámbar en oscuro: el mismo rubro cambiando de color al cambiar de tema, que es
justo lo que la paleta existe para evitar. Cuando la banda de luz del fondo
oscuro aplasta dos tonos contra el mismo azul, **se afloja la fidelidad del tono
antes que la distinguibilidad**: que un rubro cambie un poco de matiz entre
temas es mejor que dos rubros que se confunden.

**Lo que el validador sigue marcando, y por qué se acepta.** El gris de "otros"
tiene croma 0 —viene de la planilla del usuario y ya estaba así (ADR-029)—, y
varios tonos quedan por debajo de 3:1 contra el fondo. Las dos cosas están
cubiertas por el rótulo directo. Lo que **no** se acepta y se arregló es el
número escrito dentro de las porciones de la torta: era negro fijo, y entre los
veinte hay tonos oscuros donde el negro no se lee. Ahora la tinta se elige por
color (`tintaSobreRubro`), y un test comprueba que la lista del CSS coincida con
lo que calcula la paleta — dos listas escritas a mano se separan el día que se
toca un color.
