# Cambios

Formato de versión: `MAYOR.MENOR.PARCHE`, según `docs/PRODUCTO.md` §9.
La versión publicada vive en el archivo `VERSION`.

## Sin publicar

### Cambiado
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

### Agregado
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
