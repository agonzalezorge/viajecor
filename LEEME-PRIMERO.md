# Cómo arrancar Viajecor en un chat nuevo

Este paquete tiene todo lo necesario. No hace falta nada de la conversación
anterior.

## Qué hay acá

```
LEEME-PRIMERO.md        ← este archivo
PUNTO-DE-PARTIDA.md     ← el texto para pegar como primer mensaje
viajecor/               ← el proyecto entero, listo para usar
viajecor.bundle         ← los 6 commits con su historial, por si querés conservarlo
```

## Camino recomendado (2 pasos)

### Paso 1 — Subir el proyecto a GitHub

Sin esto, un chat nuevo clona el repositorio y encuentra solo el commit inicial:
no vería nada del trabajo hecho.

1. Entrá a `github.com/agonzalezorge/viajecor`.
2. **Add file → Upload files**.
3. Arrastrá **todo lo que está dentro de la carpeta `viajecor/`** — las carpetas
   `docs`, `src`, `tools`, `test`, `dist`, y los archivos sueltos: `README.md`,
   `CLAUDE.md`, `CHANGELOG.md`, `VERSION`, `package.json`, `.gitignore`.
4. Escribí un mensaje de commit y confirmá.

> `.gitignore` empieza con punto y puede estar oculto.
> En Mac se muestran los ocultos con `Cmd + Shift + .`; en Windows, desde
> *Ver → Archivos ocultos*.

**Qué se pierde:** los 6 commits se juntan en uno solo, así que se pierden los
mensajes que explican el porqué de cada cambio. Si eso te importa, usá
`viajecor.bundle` con git desde tu computadora en vez de este paso (las
instrucciones están más abajo).

### Paso 2 — Abrir el chat nuevo

1. Entrá a **claude.ai/code** y empezá una sesión sobre el repositorio
   **`viajecor`**.
2. Pegá como primer mensaje el contenido de **`PUNTO-DE-PARTIDA.md`**.

Listo. El chat nuevo lee la documentación del repositorio y sabe qué se hizo, por
qué, y qué sigue.

---

## Alternativa: conservar el historial de commits

Necesitás git instalado. Abrí una terminal en la carpeta de este paquete:

```bash
git clone viajecor.bundle viajecor-git
cd viajecor-git
git remote set-url origin https://github.com/agonzalezorge/viajecor
git push -u origin claude/expense-tracker-offline-app-u7hgpl
```

Al empujar te va a pedir usuario y contraseña: **la contraseña de GitHub no
sirve**, hay que usar un *personal access token* (GitHub → Settings → Developer
settings → Personal access tokens). Es el paso que más frena a todo el mundo la
primera vez.

---

## Probar la app ahora mismo

`viajecor/dist/viajecor.html` se abre con doble clic, funciona sin conexión y no
le pide nada a internet. Todavía no carga gastos: muestra la pantalla inicial, que
es la prueba de que la base funciona.

---

## Por qué el push falló en la conversación anterior

Ni git, ni la API de GitHub podían escribir en el repositorio: las cuatro vías
devolvían error 403. La causa está confirmada: la **GitHub App de Claude no está
instalada** en la cuenta. Está autorizada la *OAuth App* (que sirve para
identificarse y leer) pero no instalada la *GitHub App* (que es la que da permiso
de escritura sobre repositorios). Son dos cosas distintas en GitHub.

Se arregla desde **claude.ai → Configuración → Conectores → GitHub**, buscando la
opción de *instalar* o de *elegir repositorios* — no solo "conectar". Cuando esté
hecho, Claude aparece en GitHub bajo *Settings → Applications → Installed GitHub
Apps*, ahí sí con su botón *Configure*.

Mientras eso no esté, cualquier chat va a poder leer el repositorio pero no
escribir en él.
