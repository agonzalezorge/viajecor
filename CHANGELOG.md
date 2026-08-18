# Cambios

Formato de versión: `MAYOR.MENOR.PARCHE`, según `docs/PRODUCTO.md` §9.
La versión publicada vive en el archivo `VERSION`.

## Sin publicar

### Cambiado
- **El importador va a leer el `.xlsx` directamente**, sin pedirle al usuario que
  lo convierta a CSV. La decisión anterior (ADR-007) se apoyaba en una premisa
  falsa que nadie había comprobado: el navegador trae `DecompressionStream` y
  `DOMParser` de fábrica, así que alcanza con código propio. Ver ADR-010 y L-007.
- **La lista de monedas pasa a ser un dato editable desde la app**, no una
  constante del código. Arranca con euro, peso uruguayo, dólar y colón
  costarricense, y se pueden agregar más en cualquier momento (RN-04b, ADR-011,
  CU-15).

### Agregado
- Generador de una planilla de ejemplo con la estructura real y montos inventados,
  para construir y probar el importador sin usar datos confidenciales (T-009).

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
