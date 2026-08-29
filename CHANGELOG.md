# Cambios

Formato de versión: `MAYOR.MENOR.PARCHE`, según `docs/PRODUCTO.md` §9.
La versión publicada vive en el archivo `VERSION`.

## Sin publicar

### Agregado
- **`docs/USO.md`: la guía de uso**, escrita para quien usa la app y no para
  quien la programa. Empieza por cómo conseguir la versión correcta —la lección
  más cara de este proyecto—, sigue por dónde guardar el archivo en Android para
  que los datos no se pierdan, y explica los respaldos, la importación de la
  planilla vieja, el día a día y las monedas. El `README.md` quedó al día: decía
  que la app era un esqueleto donde todavía no se podían cargar gastos.
- **La planilla exportada trae una segunda hoja, `Evolución`**: la matriz mes ×
  rubro con su total y su promedio, que es la hoja `Analisis1` de la planilla
  original. Cuenta exactamente lo mismo que la pantalla porque las dos leen el
  mismo cálculo. Y **la regla del promedio va escrita en la propia hoja** —sobre
  cuántos meses es y cuál dejó afuera—, que es lo único que la planilla vieja no
  hacía y por lo que su total y su promedio parecían no cuadrar.
- **La pantalla de monedas**: ver las que hay, agregar una nueva, ocultar las que
  ya no usás y borrar las que nunca usaste. Se llega desde Datos y desde el
  propio formulario de carga, con "¿Falta una moneda?" — que es donde aparece el
  problema, parado en un país cuya moneda no está en la lista.

  **Cambiar los decimales de una moneda es un paso aparte y avisa antes**: no
  reescribe ningún monto, los lee distinto, así que todos los gastos ya cargados
  en esa moneda pasan a valer cien veces más o cien veces menos. La app dice
  cuántos son y muestra uno tuyo, antes y después. Ver ADR-033.

### Cambiado
- **El detalle ya no muestra una lista de sugerencias**, por pedido del usuario.
  Solo sugiere el **comentario**, y la diferencia tiene motivo: el comentario es
  lo que agrupa —"Barcelona26" y "barcelona 26" son dos viajes distintos en los
  totales—, así que ofrecer la escritura que ya existe evita partir un total en
  dos. El detalle es una nota para acordarse: no agrupa nada, y la lista debajo
  estorbaba mientras se escribe.

### Agregado
- **Cuánto sale cada gasto fijo**, abajo de la evolución: el promedio por pago de
  la luz, el gas, internet. La diferencia con la planilla es que al lado del
  promedio dice **cuántos pagos y entre qué meses** — "3 pagos · nov 25 → ago 26"
  —, porque un promedio por pago solo se lee como si fuera mensual y no siempre
  lo es. Y los pagos sin comentario, que no se pueden agrupar, aparecen contados
  y sumados en vez de desaparecer sin dejar rastro. Ver ADR-032.
- **La evolución mes a mes**, que reemplaza la hoja `Analisis1` del Excel: una
  fila por mes, una columna por rubro, y abajo el total y el promedio. Se llega
  desde el resumen del mes. Con once meses adentro es la pantalla que responde
  "¿esto es mucho?", que era imposible de contestar mirando un mes solo.

  La diferencia con la planilla no es el cálculo: es que **el promedio deja
  afuera el mes en curso y la pantalla lo dice**, con el mes nombrado. En el
  Excel esa misma diferencia existía —el total sumaba once meses y el promedio
  promediaba diez— y no estaba explicada en ningún lado, así que era
  indistinguible de un descuido. Ver ADR-031.
- **Los dos gráficos del mes**, los que el usuario tiene en su planilla: una
  **torta** del reparto por rubro y una **línea del acumulado** día a día. La
  torta reemplaza a las barras de proporción, por decisión suya. La lista de
  rubros ordenada de mayor a menor se queda al lado: la torta muestra la forma,
  la lista muestra los números, y una torta compara peor que una barra. En el
  mes en curso la línea se corta en el día de hoy, porque una línea plana en un
  acumulado se lee como "dejó de gastar". Ver ADR-030.

### Cambiado
- **Los colores de los rubros ahora son los de la planilla del usuario.** El rosa
  de gastos fijos, el naranja de supermercado, el verde de viajes y el celeste de
  transporte son los que viene mirando desde octubre de 2025: se conservó el
  matiz de cada uno y se corrigieron la luz y el croma, porque los pasteles de la
  planilla están pensados para ser fondo de celda y como punto de color seis de
  los ocho se leen como gris. Solo dos rubros se corrieron de verdad, y son los
  dos que estaban mal: el lila de salud era el mismo matiz que el violeta de
  entretenimiento, y el gris de otros no contrastaba contra el fondo blanco. En
  el `.xlsx` los pasteles siguen tal cual, que es donde funcionan. Ver ADR-029.
- **La guardia de privacidad se volvió más estricta y más honesta.** Estaba
  escrita dos veces —en el constructor y en su test—, que es la forma más común
  de que una regla y su comprobación se separen; ahora vive en un solo lugar que
  los dos usan. Además ahora los tests le dan de comer archivos sucios y exigen
  que los rechace: antes solo comprobaban que el archivo limpio pasara, que es
  lo que una guardia rota también haría. Y se comprobó **midiendo**, no
  argumentando: la app abierta en un navegador con toda la red bloqueada e
  instrumentada, recorrida entera, hizo **cero** peticiones. Ver ADR-027.
- **El constructor ahora comprueba su propia lista de módulos.** Antes, importar
  un archivo nuevo y olvidarse de agregarlo a la lista construía un
  `dist/viajecor.html` sin ese archivo adentro: todo en verde, y la app rota
  recién al abrirla en el celular. Ahora la construcción falla y dice cuál
  falta. Ver L-017.
- **Arreglado `npm test`**, que no corría ningún test: el script le pasaba una
  ruta al ejecutor de Node y fallaba antes de empezar. Salía en rojo, pero por el
  motivo equivocado.
- **El proyecto se movió a la raíz del repositorio**, para que `CLAUDE.md` esté
  donde un agente nuevo lo carga solo y los comandos de la documentación
  funcionen tal como están escritos.
- **El importador va a leer el `.xlsx` directamente**, sin pedirle al usuario que
  lo convierta a CSV. La decisión anterior (ADR-007) se apoyaba en una premisa
  falsa que nadie había comprobado: el navegador trae `DecompressionStream` y
  `DOMParser` de fábrica, así que alcanza con código propio. Ver ADR-010 y L-007.
- **La lista de monedas pasa a ser un dato editable desde la app**, no una
  constante del código. Arranca con euro, peso uruguayo, dólar y colón
  costarricense, y se pueden agregar más en cualquier momento (RN-04b, ADR-011,
  CU-15).

### Arreglado
- **El autocompletado de Comentario ahora funciona de verdad** (T-920). Antes se
  lo pedía al navegador, y en Android no dibujaba nada — sin error, sin aviso:
  la función simplemente no existía. Ahora las sugerencias son botones propios,
  que se ven y se tocan. **También en el campo Detalle.** Escribís `barce` y te
  ofrece `Barcelona26`, sin tener que acertar las mayúsculas.
- **Si compartir no funciona en tu teléfono, la app deja de ofrecerlo** (T-914).
  Ya no explica cada vez por qué no está: queda solo la forma de volver a
  intentarlo (T-921).
  Pasó de verdad: el navegador decía que podía compartir archivos y fallaba con
  «Permission denied» al tocar el botón. Ahora el error se explica en castellano,
  se recuerda, la descarga vuelve a ser el botón principal, y queda un *Probar de
  nuevo* por si cambiás un permiso.
- **Ya podés traer tu planilla de Excel entera** (T-032, CU-13). Elegís el
  `.xlsx` —la app lo lee sin que tengas que convertirlo y **no lo modifica**— y
  antes de tocar nada te muestra qué leyó: cuántos movimientos, cuántos ya
  estaban, **qué filas quedaron afuera con su número de fila y su motivo**, y si
  los totales de cada mes coinciden con el acumulado que traía tu planilla.
  Importar dos veces no duplica. Es la tarea que hace que la app deje de estar
  vacía.
- **La app ya sabe leer un archivo `.xlsx`** (T-031), sin librerías y sin que
  tengas que convertirlo a nada: abre el ZIP y lee el XML de adentro. Es el paso
  previo a importar tu planilla. Comprobado contra otro lector de Excel sobre
  1.614 celdas, con cero diferencias.
- **Ya podés bajarte los datos en CSV** (T-018), para hacer cuentas en otro lado:
  una fila por movimiento con todas las columnas, el monto original con su
  moneda, **el tipo de cambio que se aplicó** y el importe en euros. Se abre bien
  en Excel en español: separador `;`, acentos que no se rompen y coma decimal.
- **La planilla se parece de verdad a la tuya** (T-916): los rubros van en
  columnas con su `TOTAL` al final, el mes se escribe `08/26`, cada rubro lleva
  **su color** —el mismo que tiene en la app—, el título del mes es una banda
  amarilla, los de bloque son bandas rosas, la `I/G` va en rojo y el saldo se
  llama `SALDO MENSUAL`.
- **En la planilla aparecen todos los rubros todos los meses**, con 0 cuando no
  hubo movimientos (T-915), para poder comparar meses de un vistazo y arrastrar
  fórmulas.
- **La app te avisa cuando el navegador no puede guardar tus datos** (T-950), en
  vez de aceptarlos y perderlos. Pasó de verdad: abrir el archivo desde el
  explorador de Android hace que el navegador no tenga dónde guardar, y todo
  desaparecía al cerrar. El aviso dice qué pasa y **cómo arreglarlo** — abrir la
  app escribiendo su dirección `file:///…` a mano —, no se puede cerrar, y no
  aparece cuando no corresponde.
- **La app abre aunque el navegador tenga el almacenamiento bloqueado.** Antes
  quedaba en blanco, sin explicación, en ventanas privadas. Ver L-019.
- **Las barras del desglose miden el porcentaje real** (T-911). Antes se dibujaban
  contra el rubro más grande, así que dos rubros de 50 % salían los dos llenos y
  el dibujo contradecía al número escrito al lado.

### Agregado
- **El comentario ahora te sugiere los que ya usaste** (T-912): escribís `Barce` y
  te ofrece `Barcelona26`. No es comodidad — el comentario es lo que agrupa los
  gastos de un viaje, y dos escrituras distintas son dos viajes distintos en los
  totales.
- **El campo de detalle va penúltimo y el de comentario último** (T-912), y
  **«Cargar» pasó a ser la primera pestaña** (T-913).
- **Ya podés bajarte tu planilla de Excel** (T-906), con la forma de la de
  siempre: un bloque por mes, los mismos encabezados, el acumulado y los bloques
  de totales por rubro, de ingresos, de saldo y de gasto por día. **Con una
  diferencia**: los totales están calculados sobre todas las filas, no con
  fórmulas de rango escritas a mano — que es el error por el que existe esta app
  (L-001). Los importes van en euros; lo que no se puede convertir entra igual,
  con el monto vacío y el motivo escrito al lado, en vez de desaparecer. **No es
  un respaldo** y la pantalla lo dice: no se puede volver a cargar, y bajarla no
  apaga el aviso de respaldo. Escrito sin librerías: el ZIP y el XML se arman a
  mano. 25 tests, y el archivo comprobado con dos lectores de Excel
  independientes.
- **La app te avisa cuando hace más de una semana que no respaldás** (T-903), en
  la pantalla donde estés y no solo si entrás a *Datos*. Dice hace cuántos días
  y, sobre todo, **cuántos movimientos existen en un solo lugar**, que es lo que
  se pierde. **No aparece si no hay nada nuevo que perder**: un año
  sin respaldar da igual si no cargaste nada en ese año. "Ahora no" lo calla
  hasta mañana —no para siempre—, y respaldar lo apaga de verdad. 25 tests.
- **El respaldo ahora sale por el botón de compartir del teléfono** (T-905). En
  vez de descargar el archivo y después ir a buscarlo con un explorador para
  subirlo, tocás *Compartir el respaldo* y elegís OneDrive, Drive o un correo a
  vos mismo. **La app no sube nada**: le pasa el archivo al teléfono y ahí
  termina su parte, así que sigue sin hacer una sola petición de red (RN-06,
  ADR-025). Si el teléfono no sabe compartir archivos, el botón no aparece y la
  descarga de siempre queda igual. Cancelar el menú no cuenta como respaldo.
  13 tests. **Falta probarlo en un celular de verdad** (T-019).
- **Y ya podés volver a meterlos** (T-017, CU-08). Desde *Datos*, en «Traer un
  respaldo», elegís el archivo o pegás el texto. Antes de tocar nada la app te
  muestra **qué va a pasar con números**: cuántos trae el archivo, cuántos
  tenés, cuántos entrarían, y **cuántos se borrarían** si reemplazás. Recién ahí
  elegís entre *agregar* —que no duplica: el mismo respaldo dos veces deja lo
  mismo que una— y *reemplazar todo*. Los tipos de cambio y las monedas del
  archivo se suman a los tuyos, así que un gasto en colones no entra sin poder
  convertirse a euros. Es lo que necesitás al cambiar de teléfono. 27 tests.
- **Ya podés sacar tus datos** (T-016, CU-07). Desde *Datos* descargás un archivo
  con **todo** —movimientos, tipos de cambio y monedas—, que se abre con
  cualquier editor de texto y no necesita esta app para entenderse. Hay **dos
  caminos**: descargar el archivo, o ver el texto y copiarlo, porque una app que
  se abre desde un archivo del disco no puede confiar en que la descarga
  funcione siempre. La pantalla dice cuánto hace que no respaldás. 25 tests.
- **Ya se puede corregir y borrar** (T-015, CU-06). La pantalla *Movimientos*
  muestra lo del mes agrupado por día, del más nuevo al más viejo. Borrar tiene
  **dos redes**: pregunta antes, y después ofrece **deshacer** —que devuelve el
  movimiento a su lugar exacto, no al final de la lista—. Corregir conserva el
  movimiento: cambia sus datos sin crear uno nuevo. 24 tests.
- **Cada rubro tiene su color**, el mismo en todas las pantallas: en la barra del
  resumen, en el punto de la lista y en el borde del campo al elegirlo. El color
  depende del rubro y **nunca de cuánto gastaste en él**, así que no se repinta al
  cargar un gasto nuevo. Los ocho tonos están comprobados con un validador contra
  las dos superficies de la app, incluida la separación para daltonismo (T-909).
  Y los rubros ahora se muestran con mayúscula inicial.
- **La pantalla del mes ya muestra cómo venís** (T-014, CU-04): gastos, ingresos
  y saldo, el promedio por día, y en qué se fue la plata —por rubro, de mayor a
  menor, con su porcentaje—. Si falta un tipo de cambio, **la pantalla avisa que
  el total está incompleto** en vez de mostrar un número que parece completo.
  21 tests.
- Los cálculos del mes (T-013): total de gastos, de ingresos y saldo; el desglose
  por rubro de mayor a menor; el gasto día por día con su acumulado; y el total
  por comentario, que es la base de "cuánto costó un viaje". Todo en euros,
  mezclando monedas. **Ningún cálculo tiene un tope de filas escrito a mano**,
  que es como la planilla original empieza a dar totales de menos sin avisar
  (L-001). 29 tests.
- **Ya se pueden cargar gastos en otra moneda** (T-012, CU-03). La primera vez
  que cargás un gasto en colones de un mes, la app se detiene y te pregunta
  *"1 EUR son… CRC"* — como viene el dato en la calle— y **guarda el gasto sola**
  en cuanto lo escribís. Los siguientes ya no preguntan. Desde *Datos → Tipos de
  cambio* podés ver y corregir cualquiera, y antes de aplicar una corrección la
  app te dice **a cuántos movimientos afecta y cómo queda el total del mes**.
  25 tests.
- **Ya se pueden cargar gastos e ingresos** (T-011, CU-01 y CU-02). El formulario
  viene con la fecha de hoy, el tipo en gasto y la última moneda que usaste, y el
  monto abre el teclado numérico. Los movimientos **sobreviven a cerrar la app**.
  Si algo está mal, el error se muestra arriba y **no se pierde lo escrito**
  (L-012). Un gasto en otra moneda sin tipo de cambio todavía no se guarda: avisa
  de cuál falta, y pedirlo llega con T-012. 27 tests.
- **La app ya se puede recorrer** (T-010): encabezado con el mes que se está
  mirando y flechas para moverse, y una barra abajo con las tres secciones —Mes,
  Movimientos y Datos— más el botón de cargar. Las pantallas todavía son
  marcadores que dicen qué va a haber en cada una. Comprobado en un navegador
  real, abierto desde el disco: 0 peticiones a internet y 0 errores. 22 tests.
- La app no registra horas, solo días (ADR-021): ni la fecha del gasto ni la de
  carga guardan a qué hora pasó nada.
- Formateo en español de montos, fechas y tipos de cambio (T-006): `1250` se ve
  como `12,50 €`, y el tipo de cambio se muestra como lo conoce el usuario
  (`1 EUR = 630,00 CRC`) aunque por dentro se guarde al revés. Las fechas **no se
  corren de día** según la zona horaria del dispositivo, que es un error real que
  aparecía en Montevideo (L-011). 19 tests.
- Tipos de cambio y conversión a euros (T-005): el tipo de cambio se guarda por
  moneda y por mes, se puede escribir en cualquiera de los dos sentidos ("un euro
  son 630 colones"), y el importe en euros se recalcula siempre — así, corregir un
  tipo de cambio mal cargado arregla el mes entero en vez de obligar a editar
  gasto por gasto. Un movimiento sin tipo de cambio **no se cuenta como cero**: la
  app avisa antes de guardar. 26 tests.
- Catálogo de monedas (T-008, CU-15): arranca con euro, peso uruguayo, dólar y
  colón, y se le pueden agregar las que hagan falta indicando código, nombre y
  cuántos decimales usa. El euro es intocable —es la moneda base—, un código
  repetido se rechaza aunque venga en otra caja, y una moneda con movimientos
  cargados no se borra: se oculta, así sus gastos siguen contando. Preguntar los
  decimales de una moneda que no está en la lista falla en vez de suponer 2
  (ADR-018). 24 tests.
- Almacenamiento local: los movimientos sobreviven a cerrar la app (T-004). Si lo
  guardado no se entiende, la app **abre igual, avisa, y no pisa nada**: aparta lo
  ilegible bajo una clave de rescate para que se pueda recuperar a mano. Un
  registro roto no invalida a los demás; se informa cuál y por qué. Si el
  almacenamiento está lleno, guardar falla con un mensaje claro en vez de fingir
  que guardó (ADR-015, ADR-016, ADR-017). 25 tests.
- Modelo del movimiento: la única puerta por la que entra un gasto o un ingreso.
  Valida que la fecha exista de verdad (`2026-02-30` se rechaza en vez de
  convertirse en marzo), que el rubro pertenezca a la lista de su tipo, y que el
  monto no sea cero ni negativo. Normaliza los textos que agrupan, incluidas las
  dos formas Unicode de una misma palabra acentuada (T-003, ADR-013, ADR-014,
  L-009). 43 tests.
- Generador de una planilla de ejemplo con la estructura real y montos inventados,
  para construir y probar el importador sin usar datos confidenciales (T-009).
- Aritmética de dinero en enteros: interpreta lo que escribe el usuario, suma sin
  error de redondeo, convierte con el tipo de cambio del mes y promedia,
  redondeando una sola vez al final (T-002). 35 tests.
- Un monto escrito de forma ambigua (`"1.234"`, `"12,345"`) se rechaza pidiendo
  aclaración en vez de adivinar, porque las dos lecturas posibles se diferencian
  por un factor de mil (ADR-012, L-008).

## 0.1.0 — 2026-08-18

Primera versión. Todavía **no se pueden cargar gastos**: lo que existe es la base
sobre la que se construye el resto, y la prueba de que la premisa técnica del
proyecto se sostiene.

### Agregado
- Documentación de producto con 15 casos de uso y las reglas de negocio derivadas
  del Excel original (`docs/PRODUCTO.md`).
- Documentación de arquitectura y modelo de datos (`docs/ARQUITECTURA.md`).
- Plan de implementación con tareas, dependencias y estado (`docs/PLAN.md`).
- Registro de decisiones con su justificación (`docs/DECISIONES.md`).
- Lecciones aprendidas del Excel original (`docs/LECCIONES.md`).
- Protocolo de trabajo para varios agentes de IA en paralelo (`docs/AGENTES.md`).
- Esqueleto de la app y script de construcción que genera un `dist/viajecor.html`
  autocontenido (T-001).
- Guardia automática de privacidad: la construcción falla y los tests fallan si
  aparece cualquier forma de contactar a internet (T-007).

### Verificado
- El archivo construido abre desde el disco con toda la red bloqueada: 0 intentos
  de red, 0 errores de consola.
- La guardia de privacidad se probó rompiéndola a propósito: la construcción se
  cae antes de generar el archivo.
