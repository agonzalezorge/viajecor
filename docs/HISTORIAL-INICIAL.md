# Historial inicial — los seis commits que la subida por la web aplastó

> Este documento **no describe lo que la app hace**: para eso están
> `docs/PRODUCTO.md` y `docs/ARQUITECTURA.md`. Lo que guarda acá es el *porqué*
> de los primeros seis cambios, que estuvo a punto de perderse.
>
> **Qué pasó:** el proyecto se armó en una conversación anterior en seis commits,
> pero el push a GitHub estaba bloqueado por un permiso que faltaba. Se subió por
> la web (*Add file → Upload files*), y esa vía manda todos los archivos juntos:
> los seis commits quedaron aplastados en uno solo, `13c341b · Add files via
> upload`. El contenido llegó entero; los mensajes que explicaban cada decisión,
> no.
>
> Los mensajes se recuperaron de un respaldo `.bundle` y quedan acá, tal cual se
> escribieron, sin los pies de firma. **Es un documento cerrado: no se agrega
> nada.** Lo que venga después se cuenta en los commits de verdad.
>
> Comprobado antes de escribir esto: el contenido del último de esos seis commits
> es idéntico al que se subió por la web, salvo el `.gitignore` —que no viajó por
> ser un archivo oculto, y que se restauró desde acá—. O sea que este es,
> literalmente, el historial de lo que hay en el repositorio.

---

## `505ec9e` · 2026-08-18 · Documentar producto, arquitectura y plan antes de escribir código

Arranca el proyecto por la documentación, no por el código, porque las
decisiones que definen la app son de producto y no técnicas: qué datos se
guardan, qué nunca sale del dispositivo y en qué orden se construye.

- PRODUCTO.md: 14 casos de uso y las reglas de negocio derivadas del Excel
  original, incluida la multimoneda con tipo de cambio por moneda y por mes.
- ARQUITECTURA.md: la app es un archivo HTML autocontenido; el código fuente va
  partido en módulos porque el navegador no los carga desde file://, así que el
  entregable tiene que armarse al construir.
- PLAN.md: fuente de verdad del trabajo. Tareas con dependencias explícitas y
  cuáles se pueden hacer en paralelo. Es lo que se consulta cuando no hay una
  instrucción específica.
- DECISIONES.md: nueve decisiones con su porqué, para que dentro de tres meses
  nadie las deshaga creyendo que fueron un descuido.
- LECCIONES.md: seis trampas encontradas en el Excel original. La más seria es
  que sus fórmulas suman rangos escritos a mano ($G$8:$G$1027) y van a dar
  totales de menos, sin ningún aviso, cuando el registro pase esa fila.
- AGENTES.md: cómo varios agentes toman tareas sin pisarse, con propiedad de
  archivos declarada por tarea.

---

## `02f9a6b` · 2026-08-18 · T-001, T-007: esqueleto que abre offline y guardia de privacidad

Prueba de punta a punta la premisa técnica del proyecto antes de construir
nada encima: un archivo HTML que se abre desde el disco, sin conexión y sin
pedirle nada a internet.

tools/build.mjs pega src/ en un dist/viajecor.html único. El paso existe
porque el navegador bloquea los módulos de JavaScript desde file://: es la
única forma de tener código modular (testeable, y trabajable por varios
agentes) y a la vez un entregable de un archivo.

La guardia de privacidad está en dos lugares a propósito: en la construcción,
que falla antes de escribir el archivo, y en los tests. RN-06 es la razón de
ser de la app, y una promesa que depende de que nadie se olvide no es una
promesa.

Verificado, no supuesto:
- El archivo abre desde file:// con toda la red bloqueada: 0 intentos de red,
  0 errores de consola (navegador real controlado por Playwright).
- La guardia se probó rompiéndola: agregar una fuente de Google tira la
  construcción con el mensaje correcto y no genera el archivo.

Falta el recorrido en un celular real con modo avión, que es parte de T-019.

---

## `330c5f4` · 2026-08-18 · Leer el xlsx directo, monedas configurables y planilla de ejemplo

Tres cambios que vienen de preguntas del usuario, y una lección de las que
duelen.

1. El importador va a leer el .xlsx tal cual, sin pedir una conversión a CSV.
   ADR-007 había decidido lo contrario razonando que haría falta una librería
   de descompresión y otra de XML. Era falso: el navegador trae
   DecompressionStream y DOMParser de fábrica. Comprobado leyendo la planilla
   real del usuario dentro de Chromium, sin una sola librería, sobre 23.296
   celdas. ADR-007 queda reemplazada por ADR-010.

   La lección general quedó como L-007: una decisión bien argumentada sobre una
   premisa no comprobada se ve igual que una decisión correcta, y el formato de
   ADR la hace sonar más sólida todavía. Si un ADR se apoya en "esto no se
   puede", hay que comprobarlo y decir cómo.

2. La lista de monedas pasa a ser un dato editable, no una constante del código.
   Arranca con euro, peso uruguayo, dólar y colón costarricense. Si estuviera en
   el código, agregar una moneda para un viaje imprevisto exigiría publicar una
   versión nueva: la persona estaría en otro país sin poder registrar nada.
   RN-04b, ADR-011, CU-15, tareas T-008 y T-024.

3. Los montos reales del usuario son confidenciales y no van al repositorio, así
   que el importador se construye contra una planilla generada con la misma
   estructura y montos inventados. Es un generador y no un binario commiteado
   porque un .xlsx en el repositorio no se puede leer ni revisar, y el script
   además documenta en código cómo está armada la planilla original.

Verificado, no supuesto: la planilla generada la abre openpyxl (un lector de
Excel real) devolviendo las fechas como fechas, y la lee el navegador con el
método de ADR-010.

---

## `76c15d2` · 2026-08-18 · Ignorar los respaldos .bundle del propio repositorio

Un bundle es una copia binaria de este mismo historial: guardarlo adentro del
repositorio que copia lo duplica en cada commit y no aporta nada. Se me escapó
uno en la raíz al generar un respaldo mientras el push estaba bloqueado.

---

## `e6b2af4` · 2026-08-18 · T-002: reservar la tarea y corregir su alcance

Marca T-002 En curso antes de escribir código, como pide docs/AGENTES.md: el
commit que reserva la tarea es lo que evita que otro agente la tome en paralelo.

Corrige además el enunciado, que había quedado desactualizado: decía que el
módulo tendría una "tabla de monedas sin decimales". Desde ADR-011 la lista de
monedas la maneja el usuario, así que una tabla en el código se desactualizaría
en cuanto agregue una moneda. Los decimales entran por parámetro.

---

## `2abaf7c` · 2026-08-18 · T-002: dinero en enteros para que los totales cierren al céntimo

Todos los números de la app pasan por acá, así que un error de redondeo en
este archivo se multiplica en cada total. Por eso los montos se guardan como
enteros de la unidad mínima (1250 = 12,50 €): en coma flotante 0.1 + 0.2 no
da 0.3, y un total que no cierra por un céntimo destruye la confianza en todo
lo demás.

Decisiones que vale la pena señalar:

- Los decimales de cada moneda entran por parámetro, no de una tabla interna.
  La lista de monedas la maneja el usuario (ADR-011), así que una tabla acá
  quedaría vieja apenas agregue una moneda.
- El redondeo del medio va siempre hacia afuera: 2,5 → 3 y -2,5 → -3.
  Math.round(-2.5) da -2, y una regla que depende del signo es una trampa
  esperando a que un saldo mensual dé negativo.
- Al convertir de moneda se redondea UNA sola vez, al final. Convertir cada
  movimiento por separado y sumar después acumula error: hay un test que
  muestra los dos caminos dando 9 y 10 céntimos.

Y el hallazgo de la tarea: la primera regla para leer el separador decimal
interpretaba "12,345" como 12.345 € en lugar de rechazarlo. Alguien que quiso
escribir 12,34 y se le escapó un dígito habría cargado un gasto mil veces más
grande, sin ningún aviso. "1.234" y "12,345" tienen la misma forma y no se
pueden distinguir, así que ese caso ahora se rechaza pidiendo aclaración
(ADR-012). La lección general quedó como L-008: una regla que siempre devuelve
un resultado ante un dato ambiguo no resuelve la ambigüedad, la esconde — y la
esconde en el camino feliz, sin error y sin aviso.

Verificado, no supuesto: 35 tests propios pasando, y los cálculos comprobados
además DENTRO de dist/viajecor.html ejecutándolo en un navegador real. El build
quita los export y pega todo en un ámbito único, y esa transformación podría
romper algo que los tests de Node no ven.
