# Migración a Supabase — esquema e importación demo aplicados
Actualizado: 31 de octubre de 2026. Contrato: `SUPERPROMPT-DADO-SALVAJE.md`.
Alcance confirmado por el usuario: implementar PostgreSQL y migrar el proyecto `dkhqkvbxnlklzaskfzsq` (DADOSUPERSALVAJE). El usuario confirmó que los saldos antiguos son de prueba/demo. La ejecución remota se hizo desde el editor SQL del navegador; la integración MCP se desvinculó a petición del usuario.

## Estado
El servidor usa la interfaz asíncrona PostgreSQL en `lib/data/database.ts`. No hay consultas SQLite en las rutas ni en el dominio. Se aplicaron cinco migraciones y se importó una copia de la base SQLite en Supabase como demo. El archivo SQLite original conserva su SHA-256. El dinero real permanece deshabilitado.

La conexión del servidor Next.js con Supabase todavía no se ha verificado: las comprobaciones remotas de esta ejecución se realizaron mediante el navegador. No se debe interpretar la importación completada como una prueba de conectividad del juego.

SQLite y sus tipos ya se retiraron de las dependencias tras pasar las pruebas locales. Se conservó la base original. Los resultados de validación y las limitaciones del entorno se registran al final de este documento.

## Implementado
- Cinco migraciones versionadas: cinco bloques de negocio; cola durable y confirmaciones; archivo privado de importación; vista de compatibilidad del historial; compatibilidad con duraciones antiguas fraccionarias. UUID internos, DNI único, diez dados cosméticos, índices, restricciones, RLS y billeteras CASA/FONDO_RANKING separadas por demo/real.
- Dinero en céntimos `bigint`; JSON de dominio con cadenas. Las proyecciones antiguas en soles son exclusivamente de presentación. Reparto: casa = floor(16 %), ranking = floor(4 %), ganador = resto. Equipos reparten por igual y envían residuos a CASA.
- Bloqueo de todas las entradas tras confirmar todos, liquidación idempotente con ganador guardado por el servidor, anulación con liberación, disputa con fondos congelados y auditoría. Transacciones sobre una misma conexión, bloqueos en orden y libro inmutable, incluso frente a TRUNCATE.
- Sesiones DNI/PIN y permisos de jugador/admin conservados; registro, perfiles, historial, ranking, estadísticas, billetera y acciones de administración usan PostgreSQL. No se acepta una confirmación del cliente como crédito real. Ajustes manuales y bienvenida son exclusivamente demo.
- Rate limiting persistente y atómico en PostgreSQL, sin fallback que permita eludir el límite cuando falla la base.
- Semilla aleatoria de 256 bits, compromiso SHA-256 antes de jugar, HMAC-SHA256 por partida/participante/ronda con muestreo por rechazo y revelación solo después de liquidar. Solo los líderes empatados repiten en modos individuales.
- Equipos 3v3/4v4/5v5: grupos indivisibles, suma de tiradas por equipo, desempate colectivo y reparto a todos los ganadores. Se reutiliza la regla de suma existente. ELO por modo, inicial 1200, K explícito; los perdedores individuales empatan entre sí en el cálculo ELO por pares.
- Cola persistente en PostgreSQL y sorted sets reconstruibles en Redis REST. Rango ±50, +25/10 segundos, tope configurable; confirmación, prioridad/penalización al vencer y reconexión de 60 segundos. Una desconexión vencida congela la partida mientras la regla de abandono siga pendiente.
- Interfaces `PasarelaPago` y `VerificadorIdentidad`. Recarga pendiente, webhook autenticado por el adaptador antes de procesar, idempotencia vinculada a importe/referencia, conciliación por reporte y retiros con prueba de titularidad y revisión manual. Los adaptadores productivos están deliberadamente sin configurar: sus endpoints fallan cerrados.
- Exportador SQLite de solo lectura, conversión Decimal con redondeo al céntimo, importación transaccional solo a destino inicialmente sin usuarios, movimientos de apertura y conciliación de disponible/bonos/libro. Reintento del mismo snapshot no duplica saldos. Estadísticas y PIN se preservan; registros originales de todas las tablas permanecen en un archivo privado inmutable.

## Cambios mínimos de integración visual
No se ha modificado el código de arena, los modelos/animaciones de mascotas, audio, partículas ni el cálculo de XP durante esta migración. Sus cambios anteriores ya estaban en el árbol de trabajo y se conservaron.
- `resolveArena` recibe opcionalmente participante/ronda en su fuente de tiradas; conserva el mismo algoritmo.
- La sala online usa UUID, consulta el estado y presenta la confirmación requerida antes de apostar.
- El lobby ofrece seguir esperando o cancelar al alcanzar el rango máximo.
- El formulario admin reutiliza una clave de idempotencia al reintentar un ajuste.
- La arena manual del operador es demo; no sustituye el consentimiento individual para dinero real.
- El backend de equipos está disponible por API. Su resultado colectivo no se introduce como un falso ganador individual en ArenaReplay; la sala muestra el resultado colectivo sin cambiar el motor 3D. El lobby conserva sus dos tarjetas actuales.

## Configuración local
1. Copiar los nombres de `.env.example` a `.env.local` y configurar secretos únicamente ahí. Mantener `DINERO_REAL_HABILITADO=false`.
2. Configurar `DATABASE_URL` a PostgreSQL local o al destino Supabase previsto, con TLS para conexiones remotas. Es una credencial privada del servidor, jamás NEXT_PUBLIC. El rol de ejecución necesita los permisos de servidor de las migraciones; los roles de navegador no pueden escribir dinero.
3. Ejecutar `pnpm db:migrate` para listar migraciones (dry run). Con destino revisado: `pnpm db:migrate --apply`. El runner comprueba hashes de migraciones ya aplicadas, serializa su ejecución y revierte el conjunto si falla.
4. Configurar K de ELO y parámetros de matchmaking antes de habilitar esos flujos. Los valores de los tests son fixtures, no valores aprobados del producto.
5. Redis es opcional para desarrollar localmente: si no está configurado, la cola durable funciona en PostgreSQL. Con Upstash, indicar URL HTTPS y token privados. `rebuildQueueIndex` reconstruye IDs/ratings; nunca contiene dinero.
6. Ejecutar `pnpm dev`. Sin DATABASE_URL, los endpoints de datos fallan de forma explícita; no se reutiliza silenciosamente la base SQLite.

No mezclar el runner de migraciones de este proyecto y Supabase CLI sobre un mismo destino ya migrado sin alinear sus historiales. No se deben volver a ejecutar a ciegas los SQL iniciales sobre tablas existentes.

El editor SQL registró los archivos y sus hashes en `dado_migrations.versiones`, el mismo registro que usa el runner local. El historial de Supabase CLI no se utilizó. Los comandos CLI necesitan las variables en el entorno del proceso; para cargar el archivo privado con Node 22: `node --env-file=.env.local tools/migrate-postgres.mjs --apply`.

## Migrar el origen SQLite
Detener escrituras y resolver/conciliar partidas antiguas en curso antes del corte. No se inventan semillas ni resultados verificables para registros históricos.
```text
python tools/export-sqlite.py database.db .local-migration/snapshot.json
pnpm db:import .local-migration/snapshot.json
pnpm db:import .local-migration/snapshot.json --apply --demo
```
El segundo comando valida sin escribir. La aplicación requiere elegir explícitamente `--demo` o `--real`; nunca infiere la naturaleza de los saldos. Importar saldos reales no habilita apuestas reales ni verifica identidad. Conservar el origen hasta conciliar y validar el destino. El snapshot contiene datos privados y hashes del PIN y se guarda en una carpeta ignorada por Git.

Las partidas históricas se proyectan desde el archivo privado mediante `historial_partidas_legacy`, conservando el historial del jugador y los totales del dashboard. Esta vista no crea movimientos ni semillas criptográficas para partidas antiguas. La importación valida la proyección dentro de su transacción para rechazar históricos incompatibles antes del corte.

El registro original se consulta, con sesión admin, en `GET /api/admin/legacy?table=partidas&offset=0` (también transacciones y online_partidas). Los registros históricos de equipos y estado efímero se conservan en el archivo; no se reanudan colas o partidas antiguas.

## Ejecución remota del 31 de octubre de 2026
Antes de aplicar cambios, `public` estaba vacío y no existían registros de migraciones. Las cuatro migraciones iniciales se aplicaron juntas con comprobación SHA-256 y registro de versiones. Después se aplicó `202610310005_legacy_duration.sql`: trece partidas antiguas tenían milisegundos fraccionarios. La vista redondea su presentación; los valores originales permanecen intactos en `archivo_legacy`.

La importación demo se validó primero en PostgreSQL embebido y se ejecutó en una transacción remota con bloqueos, destino vacío, conciliación y protección contra reintentos. Se conservaron también los registros de una billetera sin jugador con disponible, bono y monedas iguales a cero, sin inventar un propietario. El exportador sigue rechazando una billetera huérfana que contenga cualquier saldo.

| Verificación remota | Resultado |
|---|---:|
| Migraciones registradas | 5 |
| Tablas en public con RLS | 31 de 31 |
| Permisos de escritura de anon/authenticated en tablas | 0 |
| Acceso cliente a semillas, archivo y vista privada | 0 |
| Dados / caras | 10 / 60 |
| Triggers de inmutabilidad habilitados | 6 |
| Jugadores importados | 5 |
| Partidas históricas | 67 |
| Registros originales archivados de 12 tablas | 410 |
| Saldo disponible demo total | 13 600 céntimos (S/ 136,00) |
| Bonos importados / saldo real | 0 / 0 |
| Movimientos de apertura | 5, por 13 600 céntimos en total |

Snapshot privado: `.local-migration/supabase-20261031-snapshot.json`. SHA-256 de importación: `e1718b99bbd1aa7c121d4a2acfa2354ad9a48d4f1b0b88d782a553ed76c6acd0`. El snapshot y el SQL de datos se excluyen de Git; no contienen credenciales nuevas ni se publica su contenido en el informe. Se conservan los hashes de PIN originales dentro de los datos privados de la importación.

La consulta de verificación sin datos personales quedó guardada en [SQL Editor](https://supabase.com/dashboard/project/dkhqkvbxnlklzaskfzsq/sql/c9e43cee-b8f4-4b04-9a68-8f78a5f53508). Evidencia local: `.tools/supabase-migracion-verificada.jpg`.

## Endpoints y operación
- `GET /api/game/fairness?id=<uuid>`: compromiso antes del cierre; semilla y replay anónimo al finalizar.
- `POST /api/game/room`: `{id,action:"confirm"}`, `view`, `disconnect`, `reconnect`, siempre autorizado por participante.
- `/api/teams`: crear grupo, unirse por ID, consultar grupos propios y abandonar. Solo el líder inscribe el grupo en matchmaking; cada integrante confirma la apuesta.
- `POST /api/admin/matches`: disputa, cancelación, resolución de disputa con motivo, expiración y recuperación tras caída con fecha UTC de corte. No recibe ganadores inventados por el administrador.
- `POST /api/pagos/recarga`, `POST /api/webhooks/[pasarela]`, `/api/pagos/retiros` y revisión admin `/api/pagos/retiros/[id]`.
- `pnpm payments:reconcile [YYYY-MM-DD]`: invoca conciliación del día anterior en America/Lima si se omite la fecha. Requiere APP_SERVER_URL, PAYMENT_PROVIDER y secreto cron de al menos 32 caracteres. Un scheduler externo debe ejecutarlo diariamente; aún no se ha aprovisionado.
- Configurar PITR y copia diaria cifrada fuera de región en el proveedor y ensayar restauración antes de producción. Esa infraestructura no existe todavía y no se declara configurada.

## Protocolo verificable v1
Semilla: 32 bytes aleatorios codificados en hexadecimal minúsculo. El compromiso es SHA-256 del texto UTF-8 de esa semilla. La clave HMAC es el mismo texto. Mensaje: JSON compacto de `["dado-salvaje-v1",partidaId,participanteId,ronda,contador]`, empezando ronda en 1 y contador en 0. Leer palabras uint32 big-endian del digest; aceptar la primera menor que 4294967292, calcular módulo 6 + 1. Si todas se rechazan, incrementar contador. Los cosméticos no intervienen. PostgreSQL jsonb reordena claves; la verificación compara valores y orden de los arrays, no el orden de las propiedades de objetos.

## TODO(DECISIÓN) y activación externa
- Pasarela concreta, contrato de firma, ventana de replay y credenciales. La firma usada en tests solo prueba la interfaz; no pretende implementar el protocolo real de Culqi.
- Proveedor autorizado de identidad y evidencias; validación de titularidad de cuentas.
- Regla final de abandono; hasta decidirla no se aplica pérdida automática.
- Mínimo y espera de batalla para iniciar antes de diez participantes.
- Uso/reparto del fondo de ranking; el 4 % permanece en su billetera.
- K de ELO, tope de búsqueda, ventana y penalización de confirmación, diferencia máxima de equipos.
- Límites diarios de recarga, retiro y pérdida por usuario. Cuando se requieren para dinero real y faltan, el flujo se bloquea.
- Habilitación legal y operativa previa a dinero real, Redis, scheduler, PITR y copia externa. Supabase ya tiene el esquema y los datos demo; falta validar la conexión del servidor del juego.

## Verificación
Las pruebas locales de dominio usan PostgreSQL embebido (PGlite), SQL real, restricciones y RLS. PGlite serializa transacciones: sus 100 solicitudes concurrentes no demuestran bloqueo entre conexiones de un servidor PostgreSQL.
La prueba adicional `tests/postgres-concurrency.test.ts` usa 100 conexiones con `PGTEST_ADMIN_URL` local, permiso CREATEDB y capacidad para más de 100 conexiones: crea/elimina únicamente una base aleatoria propia. Se omite si esa variable no existe. No se ha ejecutado contra infraestructura externa.
El exportador Python tiene pruebas de redondeo, lectura sin cambios y rechazo de saldos inválidos.
Resultados del 31 de octubre de 2026:
- `pnpm typecheck`: aprobado.
- `pnpm lint`: aprobado.
- `pnpm test --maxWorkers=1`: 111 pruebas aprobadas; una omitida por ausencia de `PGTEST_ADMIN_URL`. Ejecución previa a la quinta migración: incluye las cuatro iniciales, historial importado, confirmación y pago por rutas online, equipos, idempotencia, RLS y reglas financieras.
- Después de la quinta migración: `pnpm test tests/legacy-import.test.mjs --maxWorkers=1`, tres pruebas aprobadas, incluida la duración fraccionaria y la preservación del dato original.
- `python tools/test_export_sqlite.py`: cuatro pruebas aprobadas, incluida la conservación de huérfanas vacías y el rechazo de huérfanas con saldo.
- El SQL de migraciones y el SQL generado para los datos del origen se probaron con reintento idempotente en PGlite antes de ejecutarlos en el navegador.
- `pnpm db:migrate`: dry run aprobado; reconoce las cuatro migraciones sin escribir en un destino.
- `pnpm build`: aprobado, incluidas comprobación de tipos y generación de 29 páginas estáticas. Se ejecutó fuera del aislamiento tras un error EPERM al crear una carpeta de salida en `.next`.

Una ejecución previa de la suite junto con lint/typecheck agotó los 30 segundos de la prueba gráfica de diez dados. La repetición completa, sin esas tareas paralelas, pasó sin ampliar tiempos ni modificar la arena. Vite avisa que el formato CommonJS de `vitest.config.ts` requerirá adaptación a su futuro cargador nativo; el aviso no afecta esta ejecución.

Las pruebas no sustituyen la validación de conexiones concurrentes en PostgreSQL desplegado, los adaptadores de proveedores ni una restauración de respaldos. Ya se importó una copia del origen como demo; no se ha ejecutado una prueba visual del juego conectado a Supabase.
