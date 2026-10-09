# Java Noir integrado en el campus

Acceso: Programas > Programación > NetBeans. La carpeta original y el ZIP entregado no se modifican.

La interfaz, Monaco, explorador, carpetas, guardado y atajos proceden del ZIP entregado. Esta copia adapta la compilación para ejecutarla dentro del navegador con OpenJDK javac 17 y CheerpJ 4.3 (Java 17). No utiliza localhost ni un servidor Node/Docker para los ejercicios. El runtime CheerpJ se descarga de su CDN oficial; los JAR del compilador y el adaptador se sirven desde el campus. No se envían los archivos Java a una API de compilación.

El primer arranque de Java requiere conexión y puede tardar más que las compilaciones siguientes. La aplicación limita las tareas a 100 archivos/1 MB, 64 KB de entrada, 128 KB por salida y 45 segundos por compilación/ejecución después de cargar Java. El runtime dispone de 120 segundos para inicializar. Cada tarea usa un directorio virtual y un cargador de clases nuevo; los ejercicios permanecen dentro del entorno Java del navegador. No se habilita red Tailscale ni programas nativos. El proyecto sigue orientado a consola Java estándar, sin Maven, dependencias externas ni depurador.

Las carpetas reales utilizan showDirectoryPicker: requiere Chrome/Edge de escritorio y permiso explícito del usuario. No hay diálogo nativo de Windows desde el sitio publicado. Los respaldos importados son copias en memoria de esta pestaña; usa Guardar copia para conservarlos. No se trasladan los proyectos privados de data/.

## Compilar y publicar

Desde login: npm ci y npm run build. El resultado dist incluye campus, PSeInt y NetBeans. Sube la carpeta netbeans completa, además de pseint y el resto del código. Vercel utiliza la configuración existente. No se requiere JDK en Vercel: los dos JAR ya están incluidos.

Para actualizar el adaptador: javac -encoding UTF-8 -d netbeans/java netbeans/java/CampusJava.java; empaqueta CampusJava.class y CampusJava$LimitedOutput.class en netbeans/public/campus-java.jar.

## Procedencia

- CheerpJ 4.3: https://cheerpj.com/docs/licensing . Community License para este proyecto personal; créditos visibles en la interfaz. Su uso empresarial/redistribución tiene condiciones distintas. El runtime se carga de https://cjrtnc.leaningtech.com/4.3/loader.js y no se redistribuye aquí.
- OpenJDK javac 17.0.20, extraído del módulo jdk.compiler del JDK Eclipse Adoptium instalado. Avisos GPLv2 con Classpath Exception en public/licenses. Fuentes correspondientes en public/licenses/javac-sources.zip.
- El diseño y las funciones originales están documentados en README-original.md. Los servidores originales se conservan como referencia, pero no forman parte de la ejecución publicada.
