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
