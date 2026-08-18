# Cambios

Formato de versión: `MAYOR.MENOR.PARCHE`, según `docs/PRODUCTO.md` §9.
La versión publicada vive en el archivo `VERSION`.

## Sin publicar

_(nada todavía)_

## 0.1.0 — 2026-08-18

Primera versión. Todavía **no se pueden cargar gastos**: lo que existe es la base
sobre la que se construye el resto, y la prueba de que la premisa técnica del
proyecto se sostiene.

### Agregado
- Documentación de producto con 14 casos de uso y las reglas de negocio derivadas
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
