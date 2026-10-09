# Java Noir

Un entorno personal de Java en el navegador, con React + Vite, editor Monaco y un servidor Node que ejecuta `javac` y `java`. No utiliza ni necesita descomprimir `netbeans-master.zip`.

## Empezar en tu ordenador

Necesitas Node.js 22 o posterior y un JDK 17 o posterior (`java` y `javac` en PATH).

```powershell
npm install
npm run dev
```

Abre http://localhost:5178. «Crear carpeta» abre el selector para elegir dónde crearla; «Abrir carpeta existente» abre una carpeta real con archivos `.java`. Ctrl+S y el icono Guardar actualizan los archivos de esa carpeta; los cambios también se guardan automáticamente. Una nueva hoja se escribe en disco al crearla.

En la versión local de Windows se usa el selector nativo de Windows, que permite elegir el Escritorio como ubicación. Cuando la web se ejecuta en un servidor remoto, se usa la API de acceso a archivos del navegador: necesita HTTPS y un navegador de escritorio compatible, como Chrome o Edge. Si el navegador no ofrece escritura de carpetas, la aplicación avisa y no simula un guardado mediante una descarga o una copia en el servidor. El permiso del navegador se solicita al abrir la carpeta. Algunas carpetas protegidas no se pueden seleccionar desde el navegador.

La carpeta se elige al entrar. No se conserva su permiso entre reinicios de la web o del servidor: vuelve a abrirla para continuar. Los proyectos creados con la primera versión siguen disponibles en «Proyectos anteriores del servidor», claramente indicados como copias en el servidor.

Para usar la versión compilada:

```powershell
npm run build
npm start
```

Abre http://localhost:4318. En este ordenador la versión de Java comprobada es 17.

En Windows también puedes hacer doble clic en `INICIAR.cmd`: arranca la versión compilada. Mantén su ventana abierta mientras usas la web.

## Uso

- `sout` o `System` + Tab: `System.out.println(...)`. Ctrl+Espacio abre las sugerencias.
- `main`, `fori`, `if`, `while`, `Scanner`, `importScanner`: plantillas para escribir más rápido.
- Arriba tienes Nueva hoja, Abrir/crear carpeta y Guardar. El explorador muestra las carpetas y archivos reales y puede plegarse con su icono.
- Junto a la papelera de la consola, el selector elige el archivo que contiene `public static void main(String[] args)`.
- F5 compila todo el proyecto y ejecuta la clase seleccionada.
- El icono de verificación en la consola compila sin ejecutar. El triángulo ejecuta; la flecha pliega la consola hacia abajo. También se comprueba tras una pausa al escribir; los errores reales de javac aparecen en el editor y en «Problemas».
- «Entrada · Scanner» permite escribir las entradas **antes** de ejecutar, una por línea. Esta versión no tiene una terminal interactiva durante la ejecución.
- Ctrl+S guarda los `.java` en la carpeta abierta. Si se detectan cambios externos, el guardado se detiene para no sobrescribirlos. Puedes conservar una copia de tus cambios desde Ajustes antes de volver a abrir la carpeta.
- Crear una hoja pide nombre de clase y `package`. El package define las subcarpetas y la declaración dentro del código. Por ejemplo `com.fabrizio` genera `src/com/fabrizio/Ejercicio.java` con `package com.fabrizio;`. En proyectos existentes se respeta la raíz de fuentes (por ejemplo `src` o `src/main/java`) y no se convierte el nombre de la carpeta del proyecto en parte del package. Los nombres de clase pública deben coincidir con el archivo.

El autocompletado ofrece plantillas y palabras del archivo, no análisis semántico completo de Java como NetBeans. Esta versión trabaja con Java estándar y proyectos de hasta 100 archivos / 1 MB de código; no integra Maven, dependencias externas, depurador ni Swing en el navegador. Haz copias de tus carpetas reales. `data/` conserva únicamente los proyectos anteriores del servidor.

## Subirlo a tu dominio

**Subir solamente `dist/` a un hosting estático no permite compilar o ejecutar Java.** Necesitas un VPS o servidor Linux con Node.js y Docker, además del dominio y HTTPS. El servidor Node sirve tanto la web compilada como `/api`.

1. Copia esta carpeta, excluyendo `node_modules`, `.env` y los proyectos privados que no quieras migrar. Ejecuta `npm ci` y `npm run build` en el servidor.
2. Instala Docker y prepara la imagen: `docker pull eclipse-temurin:17-jdk`. La cuenta del servicio debe poder usar Docker; el daemon Docker es una capacidad privilegiada y el servicio debe ser personal, no un compilador público multiusuario.
3. Copia `.env.example` a `.env`, configura `RUNNER=docker`, `HOST=127.0.0.1` y una `ACCESS_TOKEN` aleatoria de al menos 24 caracteres. Puedes generar una clave con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Conserva la clave fuera del código.
4. Arranca con `node --env-file=.env server/index.mjs`, idealmente mediante systemd. Las variables `.env` **no** se cargan con `npm start` automáticamente; también puedes exportarlas en el entorno del servicio.
5. Configura Nginx para tu dominio usando el ejemplo de abajo, y un certificado HTTPS. No expongas directamente el puerto Node.
6. Abre tu dominio e introduce la clave. Se guarda únicamente en la sesión de esa pestaña. El navegador selecciona una carpeta del dispositivo desde el que entras; el servidor se encarga de compilar y ejecutar su código. Una carpeta guardada en el Escritorio de un PC no aparece automáticamente en otro dispositivo: copia o sincroniza esa carpeta para abrirla allí. Los proyectos anteriores del servidor conservan su almacenamiento remoto.

```nginx
server {
    listen 443 ssl;
    server_name java.tudominio.com;
    # Añade ssl_certificate y ssl_certificate_key de tu certificado.
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:4318;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 40s;
    }
}
```

El modo remoto obliga a usar Docker y clave cuando HOST no es loopback. Para un proxy en loopback, configura igualmente ambos: el servidor no puede detectar por sí solo si has publicado un proxy. El modo local ejecuta código con los permisos de tu usuario y está pensado solo para tus propios ejercicios.

Docker ejecuta cada tarea en un contenedor sin red, sin capacidades Linux, con raíz y fuentes de solo lectura, usuario sin privilegios, almacenamiento temporal y límites de memoria, procesos, CPU, tiempo y salida. No montes el socket Docker dentro de un contenedor que ejecute los ejercicios. No se ha comprobado Docker en este equipo porque no está instalado; verifica el modo aislado en el servidor antes de publicar. No uses esta primera versión como servicio público para ejecutar código de desconocidos.

## Validación

```powershell
npm test
npm run build
```

Las quince pruebas usan un JDK local y verifican compilación, múltiples archivos, diagnósticos, Scanner, paquetes, excepciones, detención de bucles infinitos, creación y actualización de archivos reales, raíces de fuentes y protección ante cambios externos. En Windows deben ejecutarse con los permisos normales de tu usuario: algunos entornos aislados impiden reemplazar archivos al guardarlos.

Referencias de las APIs usadas: [acceso a archivos del navegador](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) y [paquetes de Java](https://docs.oracle.com/javase/specs/jls/se17/html/jls-7.html).

## Organizar hojas y carpetas

Clic derecho sobre una hoja, una carpeta o la raíz del proyecto abre Cambiar nombre y Eliminar. La eliminación pide confirmación; en carpetas reales incluye todo su contenido, también archivos que no sean Java. Mantén pulsado el botón izquierdo y arrastra una hoja o carpeta sobre la carpeta de destino. Los cambios se aplican inmediatamente al disco después de guardar las ediciones pendientes. Un nombre ya existente impide el movimiento.

Renombrar una hoja actualiza los identificadores de clase y constructores; moverla o renombrar su carpeta actualiza la declaración package y referencias habituales/imports. Se conservan los textos de comentarios y cadenas. Esta transformación es léxica: revisa los diagnósticos si tu proyecto tiene tipos homónimos o referencias complejas.

En modo local Windows se utiliza IFileDialog, el selector moderno del Explorador, con navegación, barra de ruta y selección de carpetas. Crear pide elegir la carpeta contenedora y crea dentro el nombre indicado. Al publicar en un dominio se utiliza el selector que proporciona el navegador del visitante. Para renombrar o eliminar la raíz de una carpeta abierta desde el navegador puede solicitarse también la carpeta contenedora.