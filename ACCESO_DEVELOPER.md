# Acceso developer al videojuego

El acceso administrativo predeterminado usa la cuenta existente de Supabase Auth
(correo y contraseña). El rol `developer` permite usar todas las operaciones
actuales protegidas por `requireAdmin`, el panel `/admin` y el modo `/manual`.
No cambia las reglas de dinero real ni otorga membresías de GitHub, Vercel o la
organización de Supabase; esos servicios gestionan sus permisos por separado.

## Configuración del servidor

En `.env.local` y en el entorno correspondiente del hosting:

```dotenv
ADMIN_AUTH_PROVIDER=supabase
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLISHABLE_O_ANON_DEL_PROYECTO
```

La clave debe pertenecer al mismo proyecto que la cuenta. No usar `service_role`
ni una clave secreta administrativa para iniciar sesión. `DATABASE_URL` y
`PLAYER_SESSION_SECRET` siguen siendo necesarios para las funciones del juego.
Después de cambiar variables en Vercel, realizar un nuevo despliegue.

## Alta y autorización

1. Crear o localizar la cuenta en Supabase Auth y verificar su UUID y correo.
   La contraseña se configura en Supabase y no se copia al repositorio.
2. Mediante una operación administrativa autorizada, establecer
   `app_metadata.role = "developer"` y `user_metadata.full_name` con el nombre.
   Conservar los demás metadatos; no modificar `auth.users.role`, contraseñas,
   identidades, políticas RLS ni permisos de los roles de PostgreSQL.
3. Iniciar sesión en `/admin/login` con el correo y la contraseña existentes.
4. Comprobar el nombre y la indicación `Developer · Acceso completo` en `/admin`.

El SQL de asignación de una cuenta concreta es una operación por entorno, no una
migración automática que otorgue permisos en cada instalación. Comprobar el UUID
y correo exactos antes de ejecutarlo; la asignación debe fallar si no coincide
exactamente una cuenta confirmada.

## Sesión y revocación

El servidor obtiene un token con `/auth/v1/token?grant_type=password` y comprueba
la identidad consultando `/auth/v1/user`. En cada acceso administrativo vuelve a
consultar ese usuario con `cache: no-store`: no confía en roles enviados por el
formulario, `user_metadata` ni un JWT decodificado sin validar. Retirar el rol en
`app_metadata` bloquea la próxima petición, incluso si ya existía una sesión.

El token se conserva exclusivamente en una cookie HttpOnly, Secure en producción
y SameSite Strict, por un máximo de una hora o su vencimiento anterior. No se
guarda un refresh token: al vencer, el usuario vuelve a iniciar sesión. Cerrar
sesión elimina ambas cookies administrativas e intenta revocar la sesión local
en Supabase; un token de acceso copiado podría seguir vigente hasta su expiración.

Las fallas de conexión o configuración deniegan el acceso. La pantalla distingue
credenciales incorrectas, falta de rol, configuración, indisponibilidad y exceso
de intentos. Supabase aplica sus límites de autenticación.

El modo anterior de clave compartida solo se habilita expresamente con
`ADMIN_AUTH_PROVIDER=legacy`, `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` (32 o más
caracteres). Sus cookies no permiten entrar cuando el proveedor es Supabase.

## Validación

`tests/admin-auth.test.ts` cubre metadatos manipulables, cuentas sin confirmar,
rol retirado, token inválido, caída del servicio, aislamiento del acceso anterior,
errores de inicio de sesión, cookies, redirecciones y cierre de sesión.
Las pruebas locales no demuestran que las variables, el rol o el despliegue estén
ya configurados en producción: verificar esos pasos en el entorno real.

Referencias: [API de Supabase Auth](https://supabase.github.io/auth/) y
[autorización y metadatos](https://supabase.com/docs/guides/database/postgres/row-level-security).
