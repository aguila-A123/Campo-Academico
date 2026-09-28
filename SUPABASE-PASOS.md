# Activar el acceso con Fabrizio

El acceso con correo utiliza Supabase Auth directamente. Para aceptar también el nombre de usuario (sin importar mayúsculas), instala esta función:

1. En tu proyecto de Supabase, abre Edge Functions.
2. Pulsa Deploy a new function > Via Editor (o el editor equivalente).
3. Nombra la función exactamente: login-usuario
4. Sustituye el contenido de index.ts por el archivo supabase/functions/login-usuario/index.ts de este proyecto.
5. Publica la función con Deploy.
6. En la configuración de esa función, desactiva Verify JWT / Enforce JWT verification. Es un endpoint previo al inicio de sesión: valida la contraseña usando Supabase Auth y solo devuelve una sesión si es correcta.

No pegues este código en SQL Editor: es TypeScript para Edge Functions.
No copies claves privadas a la web. Supabase proporciona SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY dentro de la función.

La tabla credenciales debe contener el UID de Authentication y usuario=Fabrizio (como ya has configurado).

Después prueba Fabrizio y tu contraseña en la web. Con correo ya se puede acceder sin esta función.

## Protección de los datos del campus
La interfaz exige una sesión y envía su token a Supabase para leer los cursos. Las políticas RLS de cursos, secciones y actividades deben restringir los datos a los usuarios autorizados: ocultar una pantalla no sustituye los permisos de la base de datos. El proyecto previo consultaba esas tablas sin sesión. El archivo supabase/migrations/20260928_campus_access.sql permite cerrar la lectura anónima y conceder lectura a las cuentas registradas; revísalo según quién deba acceder al campus. No se ha ejecutado desde esta sesión.
