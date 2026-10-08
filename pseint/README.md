# PSeInt dentro del campus

La interfaz procede de la carpeta original PSeInt-web, que se conserva sin cambios.
El campus compila esta copia con React y Vite y la sirve en `/pseint/index.html`.
La ventana interna separa sus estilos de los del campus; todos los archivos y el
motor se sirven desde el mismo sitio. No se usa localhost, una API ni WebSocket.

El intérprete oficial PSeInt 20250314 (Pablo Novara, GPL-2.0) se compila a
WebAssembly con Emscripten 4.0.23. Se conservan sus reglas, análisis y formato
de diagramas. Las adaptaciones en engine-source son la entrada asíncrona de
líneas/teclas, las pausas y la notificación del fin de ejecución. Cada análisis
y ejecución tiene un Worker y sistema de archivos virtual independientes.
Detener termina el Worker. Límite: 200 KB de código, 2 MB de salida y 10 minutos.

`npm run build` desde login compila el campus y PSeInt. El motor compilado ya
está incluido; no hace falta Emscripten para los despliegues habituales.
`node --test pseint/engine.test.mjs` verifica el motor WebAssembly y los diagramas.
Para recompilar el motor, instala/activa Emscripten 4.0.23 en `../.tools/emsdk`
y ejecuta `node pseint/build-engine.mjs` desde login. El script actual usa el
Python incluido en el SDK para Windows; ajusta esa ruta para otro sistema.

Guardar utiliza el selector del navegador cuando está disponible y descarga
el archivo .psc en los demás navegadores. Las hojas permanecen en memoria;
guardar antes de cerrar o recargar. Cambiar de sección del campus conserva
la ventana abierta de PSeInt durante la sesión.

Licencia: LICENSE. Fuentes originales: public/engine/pseint-original-source.tgz.
Fuentes del motor adaptado y script de compilación: public/engine/campus-engine-source.tgz.
Origen: https://sourceforge.net/projects/pseint/files/20250314/
