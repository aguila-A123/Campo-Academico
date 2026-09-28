# Campus · React + Vite + Supabase

Inicio de sesión y campus del ZIP unidos en una aplicación React.

- Usuario/correo + contraseña mediante Supabase Auth.
- Error: partículas rojas y mensaje durante 4,2 segundos.
- Éxito: partículas que convergen al centro, explosión y entrada a los 3,2 segundos.
- Sesión persistente, restauración validada y cierre de sesión.
- Moodle, horario y navegación originales; estilos del campus aislados del login.
- Acceso por usuario mediante la Edge Function login-usuario. Ver SUPABASE-PASOS.md.
- No se guardan contraseñas en tablas, registros o almacenamiento del navegador.
- Los datos requieren políticas de Supabase; ver la migración SQL incluida.

## Desarrollo
npm install
npm run dev
npm run build
npm test

La clave publishable incluida está diseñada para uso en el navegador; las claves de servidor solo se utilizan dentro de Supabase Edge Functions.

Animaciones adaptadas de Uiverse.io: botón de catraco y bordes de Lakshay-art.
