# Cambios

Formato de versión: `MAYOR.MENOR.PARCHE`, según `docs/PRODUCTO.md` §9.
La versión publicada vive en el archivo `VERSION`.

## Sin publicar

### Cambiado
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
