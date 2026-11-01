# SUPERPROMPT · Dado Salvaje · Migración del backend a Supabase (PostgreSQL)

> Para: Codex (agente de código)
> Proyecto: `C:\Users\Usuario\Desktop\SENATI\Proyectos\DADOSUPERSALVAJE`
> Metodología: **Spec Driven Development**. Este documento es el contrato. No inventes requisitos fuera de él; si algo no está definido, déjalo marcado como `TODO(DECISIÓN)` y repórtalo, no lo supongas.

---

## 0. Contexto actual (lo que YA existe, verificado en el repo)

- **Stack:** Next.js 16 (App Router) + React 19 + TypeScript 6, Three.js r183 + Cannon ES 0.20 (arena 3D), Framer Motion, Tailwind 4, Vitest + Testing Library.
- **Antes de tocar Next.js:** lee `AGENTS.md` y la guía en `node_modules/next/dist/docs/` (esta versión tiene cambios de API).
- **Base de datos actual:** SQLite con `better-sqlite3` (WAL), definida en `lib/db.ts`. Tablas: `jugadores` (PK `dni`), `wallet` (`saldo_real`, `saldo_bono`, `moneda_ingame` en REAL), `transacciones` (REAL), `partidas` (con `jugadores_json`, `resultados_json`), `estado_live`, `matchmaking_queue` (modos `duelo|batalla`, montos 2/5/10/20/30/40/50/100), `salas`, `online_partidas`, `online_room_views`, `teams` (`miembros_json`), `rate_limit`, `manual_rolls`.
- **Lógica existente a reutilizar:** `lib/resolveArena.ts` (tiradas en servidor con `crypto.randomInt(1,7)` y desempates), `lib/gameEngine.ts`, `lib/wallet.ts` (reparto 80/16/4), `lib/matchmaking.ts`, `lib/teamMode.ts`, `lib/playerAuth.ts`, `lib/adminAuth.ts`, `lib/rateLimit.ts`, `lib/cofres.ts`, `lib/dados.ts`, `lib/mascots.ts`.
- **Rutas API:** `app/api/**` (auth player, game/roll, game/room, matchmaking/join|status, partida, partida/cobro, wallet, ranking, player/me|history, estadisticas, registrar, jugador).

## 1. Qué NO se toca (intocable)

- Arena 3D: `lib/arena/*`, `app/_components/ArenaReplay.tsx`, `ThreeJsDiceEmbed.tsx`, `DiceRoller.tsx`, `CinematicIntro.tsx`, `WinnerReveal.tsx`.
- Mascotas de Blender: `lib/mascots.ts`, `MascotCelebration.tsx`, `MascotPreview.tsx`, `/mascotas`, assets en `public/`.
- **Lógica de desempate:** solo los líderes empatados vuelven a lanzar, ronda por ronda, hasta un único ganador. Se conserva el comportamiento; solo cambia dónde se persiste.
- Audio, partículas, cofres/XP y diseño visual.
- Si un cambio de backend obliga a tocar una de estas piezas, limita el cambio a la capa de datos (tipos/fetch) y documéntalo.

## 2. Reglas de negocio (fijas)

| Regla | Valor |
|---|---|
| Moneda | Soles (PEN). **Todo dinero en céntimos enteros (`bigint`)**, nunca decimales/REAL/float. |
| Montos de apuesta permitidos | S/ 2, 5, 10, 20, 30, 40, 50, 100 (200, 500, 1000, 2000, 3000, 4000, 5000, 10000 céntimos) |
| Reparto del pozo | **80 % ganador · 16 % casa · 4 % fondo de ranking** (valores actuales de `lib/wallet.ts`; NO 15 %). Redondeo: calcula casa y ranking con división entera hacia abajo y el ganador recibe el resto, para que la suma sea exacta. En equipos, el 80 % se reparte entre los miembros del equipo ganador; el residuo de céntimos va a la casa. |
| Modos | `duelo` (1v1), `batalla` (hasta 10 jugadores), **nuevos:** `equipos_3v3`, `equipos_4v4`, `equipos_5v5`. |
| Dados | 10 por color: rojo, rosado, amarillo, celeste, blanco, negro, verde, guinda, naranja, azul. **Solo apariencia; ningún dado da ventaja.** |
| Identificador del jugador | DNI (único). Internamente usa `uuid` como PK y `dni` como UNIQUE. |
| Tiradas | Siempre en el servidor con aleatoriedad criptográfica. El cliente solo reproduce. |

## 3. Arquitectura objetivo

- **Supabase PostgreSQL** como única fuente de verdad (región São Paulo recomendada). Migraciones SQL versionadas en `supabase/migrations/`.
- **Toda la lógica de dinero corre en el servidor propio** (route handlers / server actions de Next.js con la `service_role` key solo en servidor, o funciones SQL `SECURITY DEFINER`). **El cliente nunca escribe en tablas de dinero.** Activa RLS en todas las tablas; las de dinero quedan sin políticas de escritura para `anon`/`authenticated`.
- **Redis** (p. ej. Upstash) solo para colas de emparejamiento y estado efímero. Nada de dinero en Redis; todo debe poder reconstruirse desde Postgres.
- Capa de acceso a datos detrás de una interfaz (`lib/data/*`) para que la UI no dependa del motor. Elimina `better-sqlite3` al final, cuando todas las pruebas pasen.

## 4. Esquema PostgreSQL (cinco bloques)

### Bloque 1 · Jugadores
- **usuarios**: `id uuid PK`, `dni text UNIQUE NOT NULL`, `nombres`, `celular`, `fecha_nacimiento date`, `estado_identidad` (`pendiente|verificado|rechazado`), `estado` (`activo|bloqueado|autoexcluido`), `autoexcluido_hasta timestamptz`, `pin_hash`, `rating int DEFAULT 1200` (o por modo en `ratings`), estadísticas actuales (`puntos`, `partidas_jugadas`, `partidas_ganadas`, `racha_actual`, `mejor_racha`, `titulo`), `creado_en`.
- **ratings**: `usuario_id`, `modo`, `rating int DEFAULT 1200`, PK (`usuario_id`,`modo`).
- **billeteras**: `usuario_id PK/FK`, `disponible_centimos bigint ≥ 0`, `bloqueado_centimos bigint ≥ 0`, `bono_centimos bigint ≥ 0`, `moneda_ingame int ≥ 0`, `version int` (control optimista), `actualizado_en`. Más una billetera de sistema para **CASA** y otra para **FONDO_RANKING**.
- **equipos** y **equipo_miembros** (reemplazan `teams.miembros_json`).

### Bloque 2 · Catálogo de dados
- **dados**: `id text PK` (`rojo`, `negro`, …), `nombre`, `color_hex`, `rareza`, `modelo_3d`, `imagen`, `activo`. Semilla con los 10 actuales de `lib/dados.ts` / `lib/mascots.ts`.
- **caras_dado**: `dado_id`, `cara`, `valor` (1–6 por defecto; preparado para dados especiales futuros, siempre sin ventaja en dinero real).

### Bloque 3 · Partidas
- **partidas**: `id uuid PK`, `modo`, `monto_entrada_centimos` (CHECK en la lista permitida), `min_jugadores`, `max_jugadores`, `estado` (`esperando|confirmando|en_curso|en_desempate|finalizada|anulada|en_disputa`), `pozo_centimos`, `comision_casa_centimos`, `fondo_ranking_centimos`, `premio_centimos`, `ganador_usuario_id` / `ganador_equipo`, `hash_semilla`, `semilla_revelada`, `creada_en`, `iniciada_en`, `finalizada_en`, `duracion_ms`.
- **participantes**: `partida_id`, `usuario_id`, `equipo` (null en duelo/batalla), `dado_id`, `apuesta_centimos`, `confirmado bool`, `posicion`, `premio_centimos`, `estado` (`activo|desconectado|abandono`). UNIQUE (`partida_id`,`usuario_id`).
- **tiradas**: `id`, `partida_id`, `participante_id`, `ronda int` (1 = normal, ≥2 = desempate), `valor smallint CHECK 1..6`, `creada_en`. UNIQUE (`participante_id`,`ronda`).
- **semillas_partida** (o columnas en `partidas`): antes de jugar se publica `sha256(semilla_servidor)`; al finalizar se revela la semilla para que cualquiera verifique las tiradas. Deriva cada tirada de forma determinista (HMAC-SHA256 de semilla + partida + participante + ronda) para que sea auditable.
- Migra `salas`, `online_partidas`, `estado_live`, `manual_rolls` al nuevo modelo o mantenlas como vistas de compatibilidad mientras se migra la UI.

### Bloque 4 · Dinero
- **movimientos** (libro **inmutable**): `id bigserial`, `billetera_id`, `tipo` (`recarga|apuesta_bloqueo|apuesta_liberacion|apuesta_cobro|premio|comision_casa|fondo_ranking|devolucion|retiro|ajuste_admin`), `monto_centimos bigint` (con signo), `saldo_disponible_despues`, `saldo_bloqueado_despues`, `referencia_tipo`, `referencia_id`, `clave_idempotencia text UNIQUE`, `creado_en`. **Trigger que impide UPDATE y DELETE.**
- **recargas**: `id`, `usuario_id`, `monto_centimos`, `pasarela` (`niubiz|izipay|culqi|mercadopago`), `metodo` (`yape|tarjeta|…`), `id_externo text UNIQUE`, `estado` (`pendiente|confirmada|fallida|revision`), `payload_webhook jsonb`, `creada_en`, `confirmada_en`.
- **retiros**: `id`, `usuario_id`, `monto_centimos`, `cuenta_destino` (a nombre del mismo titular), `estado` (`solicitado|aprobado|pagado|rechazado`), `revisado_por`, fechas. Revisión manual al inicio.
- **comisiones_casa**: `partida_id`, `pozo`, `porcentaje_casa`, `monto_casa`, `monto_ranking`.
- **conciliaciones**: fecha, pasarela, totales esperados vs. recibidos, diferencias.
- Migra `wallet` y `transacciones` actuales: convierte REAL a céntimos (`round(x*100)`), crea un movimiento de `ajuste_admin` "saldo inicial migrado" por jugador y verifica que la suma cuadre al céntimo.

### Bloque 5 · Cosméticos (futuro)
- **items**: `id`, `tipo` (`mascota|skin_dado|avatar|efecto`), `nombre`, `rareza`, `precio_centimos` o `precio_moneda_ingame`, `archivo_modelo`, `miniatura`, `activo`.
- **inventario_usuario**: `usuario_id`, `item_id`, `origen` (`compra|premio|evento`), `obtenido_en`.
- **equipamiento**: `usuario_id`, `slot` (`mascota|skin_dado|avatar|efecto`), `item_id`.
- **compras_items**: historial enlazado a `movimientos`.
- Un nuevo cosmético = nuevas filas, no nuevas tablas.

**Índices mínimos:** `movimientos(billetera_id, creado_en)`, `recargas(id_externo)`, `partidas(estado)`, `participantes(usuario_id)`, `tiradas(partida_id, ronda)`.

## 5. Operaciones de dinero (cada una en UNA transacción con `SELECT … FOR UPDATE`)

1. **Apostar / confirmar entrada:** verifica estado del jugador (no bloqueado, no autoexcluido, identidad verificada cuando aplique), saldo suficiente; mueve `apuesta` de disponible → bloqueado; registra movimiento `apuesta_bloqueo` con clave de idempotencia (`partida:usuario:bloqueo`).
2. **Liquidar partida:** solo cuando el servidor tiene ganador explícito. Descuenta lo bloqueado de todos (`apuesta_cobro`), calcula pozo, acredita 16 % a CASA, 4 % a FONDO_RANKING y el resto al ganador (o repartido en su equipo). **La suma de movimientos de la partida debe ser 0.** Idempotente: reintentos no duplican pagos.
3. **Anular (no arrancó / caída del servidor):** devuelve todo lo bloqueado (`apuesta_liberacion`).
4. **Abandono ya iniciada:** el jugador que abandona pierde su apuesta y la partida sigue. `TODO(DECISIÓN)`: confirmar regla final con el dueño.
5. **Disputa:** estado `en_disputa`, dinero congelado en bloqueado hasta resolución manual por admin (con registro de auditoría).
6. Prueba de concurrencia: 100 apuestas simultáneas del mismo jugador nunca dejan saldo negativo ni duplican movimientos.

## 6. Recargas por webhook

- `POST /api/pagos/recarga` crea la recarga `pendiente` con ID propio y devuelve los datos de la pasarela (Yape vía Niubiz/Izipay/Culqi/Mercado Pago; adaptador por pasarela detrás de una interfaz `PasarelaPago`). La pasarela concreta es `TODO(DECISIÓN)`.
- `POST /api/webhooks/{pasarela}`: verifica la **firma** del webhook; si `id_externo` ya fue procesado, responde 200 sin hacer nada; si es válido, en una transacción marca `confirmada` y acredita con movimiento `recarga`.
- **Nunca** se acredita saldo por una confirmación del cliente.
- Tarea diaria de **conciliación** contra el reporte de la pasarela; las diferencias pasan a `revision`.
- Retiros: solo a cuenta a nombre del mismo usuario, límites diarios, revisión manual inicial.

## 7. Emparejamiento (Redis)

- Una cola (sorted set por rating) por **modo + monto**.
- Rating tipo **ELO**, inicial **1200**; se actualiza al liquidar.
- Rango de búsqueda: empieza en **±50** y crece **+25 cada 10 s** hasta un tope configurable; al tope, se ofrece seguir esperando o salir.
- **Duelo:** los dos más cercanos dentro del rango.
- **Batalla:** sala de hasta 10; arranca al llenarse o al vencer el tiempo con el mínimo (`TODO(DECISIÓN)` mínimo exacto).
- **Equipos 3v3 / 4v4 / 5v5:** los grupos de amigos entran como **una sola unidad** (rating promedio); se arman equipos combinando grupos hasta el tamaño y se enfrentan equipos con suma de rating similar (diferencia máxima configurable).
- **Confirmación:** todos aceptan en una ventana corta **antes** de bloquear dinero; quien no acepta vuelve con penalización y los demás regresan a la cola con prioridad.
- **Desconexión:** ventana de **60 s** para reconectar; si no vuelve, se aplica la regla de abandono (en equipos, su equipo sigue con uno menos). Caída del servidor → anular y devolver.
- Postgres guarda el respaldo de la cola; Redis es reconstruible.

## 8. Cumplimiento (bloqueantes antes de dinero real)

- **Licencia MINCETUR (Ley 31557, juegos a distancia):** necesaria antes de operar con dinero real. Mientras no exista, implementa un **feature flag `DINERO_REAL_HABILITADO=false`** que deja todo en modo demo/saldo ficticio.
- **Verificación de edad 18+ (DNI + selfie / proveedor autorizado o convenio RENIEC):** pendiente. Deja la interfaz `VerificadorIdentidad` y el campo `estado_identidad`; sin `verificado` no se puede apostar con dinero real.
- **Autoexclusión y límites de recarga/pérdida:** pendientes; implementa estructura de datos y bloqueo en la operación de apostar.
- Registro de auditoría de acciones admin y alertas para reportes a la UIF.

## 9. Seguridad y respaldos

- Secretos solo en variables de entorno del servidor; nunca la `service_role` key en el cliente. No subir `.env*` ni `database.db*`.
- RLS activo; el cliente lee solo sus propios datos.
- Mantén rate limiting (puede moverse a Redis).
- Supabase con recuperación a un punto en el tiempo (PITR) y copia diaria fuera de la región.

## 10. Plan de trabajo y criterios de aceptación

1. Migraciones SQL + semillas (dados, billeteras CASA/RANKING).
2. Capa de datos `lib/data/*` y adaptación de rutas API, una por una, con pruebas.
3. Script de migración SQLite → Postgres con verificación de sumas al céntimo.
4. Webhooks de recarga + conciliación.
5. Redis matchmaking + modos de equipo.
6. Retirar `better-sqlite3`.

**Hecho cuando:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build` pasan.
- Pruebas nuevas: reparto 80/16/4 exacto al céntimo (incluye montos impares y equipos), idempotencia de webhooks, liquidación idempotente, concurrencia sin saldo negativo, desempates multironda, verificación de semilla, emparejamiento por rango y grupos.
- La arena 3D, las mascotas y los desempates se ven y funcionan igual que antes.
- Ninguna tabla de dinero es escribible desde el cliente.
- Entregas un informe con lo hecho, lo pendiente y cada `TODO(DECISIÓN)`.

## 11. Decisiones abiertas (no inventar; marcar `TODO(DECISIÓN)`)

- Pasarela de pago concreta.
- Regla exacta de abandono y mínimo de jugadores en batalla.
- Uso y reparto del fondo de ranking (4 %).
- Proveedor de verificación de identidad.
