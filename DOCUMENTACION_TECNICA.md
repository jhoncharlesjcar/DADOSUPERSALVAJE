# 🏗️ Documentación Técnica: Dado Salvaje v4.0 (Arquitectura Elite AAA)

**Versión:** 4.0.0 (Auditoría Técnica y Financiera Completada)  
**Tecnologías:** Next.js 16 (App Router), React 19, Three.js r183, Cannon ES 0.20.0, Web Audio API, SQLite (better-sqlite3 con WAL), TypeScript, Tailwind CSS 4, Vitest.  
**Ubicación del Proyecto:** `c:\Users\Usuario\Desktop\SENATI\Proyectos\DADOSUPERSALVAJE`

---

## 1. Visión y Principios de Diseño

**Dado Salvaje** es una plataforma de dados competitivos con apuestas en soles (**S/**). Combina una arena 3D con contactos físicos, audio sintético y resultados resueltos en el servidor.

### Principios Fundamentales:
1. **Resultados del Servidor:** `resolveArena` obtiene las tiradas con `crypto.randomInt` y guarda todas las rondas y el ganador explícito. La liquidación manual consulta ese registro; la presentación no decide el premio.
2. **Consistencia Contable Inmutable:** El saldo del jugador reside en `wallet.saldo_real`. Las transacciones usan `BEGIN IMMEDIATE` en SQLite para garantizar mutual exclusion y eliminar condiciones de carrera (*race conditions*).
3. **Reproducción Física Precalculada:** Cannon ES calcula contactos a paso fijo y Three.js interpola los fotogramas. La calidad es configurable; el rendimiento en móviles físicos todavía requiere medición.
4. **Ciclo de Vida 3D:** La escena libera geometrías, materiales, texturas, sombras y renderer al desmontar. Los errores de WebGL permiten acceder al resultado guardado.

---

## 2. Mapa de Módulos y Responsabilidades

```
lib/
├── db.ts               # Singleton de SQLite, pragmas WAL, esquema DDL, migraciones y validadores.
├── resolveArena.ts     # Resolución servidor y rondas exclusivas entre líderes empatados.
├── manualArena.ts      # Preparación idempotente a partir de participantes cobrados.
├── arena/types.ts      # Contrato ArenaMatch, validación de rondas y últimas tiradas.
├── arena/physics.ts    # Precalcula contactos, reposo y orientación constante de las caras.
├── arena/scene.ts      # Escena Three.js, materiales, cubilete, cámara y limpieza.
├── mascots.ts          # Catálogo de diez modelos, nombres, colores e ilustraciones por dado.
├── rollSigner.ts       # Módulo heredado de firmas; no participa en el flujo actual de arena.
├── wallet.ts           # Distribución matemática de pozos (80% Ganador, 16% Casa, 4% Ranking).
├── gameEngine.ts       # Máquina de estados, lógica de desempate, curva de XP balanceada y Near-Miss.
├── matchmaking.ts      # Colas de emparejamiento atómicas, salas de juego y auto-partidas online.
├── rateLimit.ts        # Limitador de peticiones persistente respaldado en tabla SQLite rate_limit.
├── particleSystem.ts   # Sistema de partículas DOM con DOMParticlePool de 35 nodos reutilizables.
├── soundEngine.ts      # Motor de audio sintético Web Audio API con buffer de ruido pre-generado.
├── cofres.ts           # Sistema de progresión, rangos, emojis y recompensas por nivel.
├── dados.ts            # Metadatos, colores y skins cosméticos para los dados.
└── adminAuth.ts        # Autenticación de operadores mediante cookies HTTPOnly y firma de tokens.

app/
├── api/game/roll/      # Prepara o recupera ArenaMatch desde manual_rolls; requiere operador.
├── api/game/room/      # Devuelve la sala y replay; sustituye DNI por asientos públicos.
├── api/partida/        # Liquida y registra desde la resolución y cobros guardados.
├── api/partida/cobro/  # Endpoint POST para cobro atómico idempotente previo al lanzamiento manual.
├── api/ranking/        # Endpoint GET para clasificación pública en tiempo real.
├── api/estadisticas/   # Endpoint GET para métricas globales de la plataforma.
├── _components/
│   ├── PanelPrincipal.tsx     # Cobro y confirmación del premio antes de mostrar resultados manuales.
│   ├── ArenaReplay.tsx        # Rondas compartidas, controles, historial y alternativa sin WebGL.
│   ├── MascotCelebration.tsx  # Celebración del ganador, movimiento reducido y alternativa ilustrada.
│   ├── MascotPreview.tsx      # Carga GLB, cámara, clips, pausa y modo celebración con duración limitada.
│   ├── ThreeJsDiceEmbed.tsx   # Integra simulación, escena y ciclo de reproducción con React.
│   ├── DiceRoller.tsx         # Carga ArenaMatch y reintenta preparación o confirmación sin cambiarlo.
│   ├── GameRoom.tsx           # Vista previa de jugadores en la mesa y selección de dados.
│   └── GameResults.tsx        # Pantalla cinematográfica de victoria, celebraciones y level up.
├── arena/                     # Demostraciones fijas, sin cobros ni modificación de saldos.
├── mascotas/                  # Selector de diez modelos, exploración de clips y prueba de celebración.
└── admin/                     # Panel de administración, auditoría de transacciones y conciliación.
```

---

## 3. Esquema de Base de Datos SQLite (DDL)

La base de datos opera bajo modo WAL (`PRAGMA journal_mode = WAL`), con `synchronous = NORMAL` y `wal_autocheckpoint = 100` para alta concurrencia:

```sql
-- Jugadores y estadísticas históricas
CREATE TABLE IF NOT EXISTS jugadores (
  dni TEXT PRIMARY KEY,
  nombres TEXT NOT NULL,
  celular TEXT,
  codigo_yapeo TEXT,
  monto_yapeo REAL DEFAULT 0,  -- Sincronizado estrictamente desde wallet.saldo_real
  puntos INTEGER DEFAULT 0,
  partidas_jugadas INTEGER DEFAULT 0,
  partidas_ganadas INTEGER DEFAULT 0,
  total_ganado REAL DEFAULT 0,
  racha_actual INTEGER DEFAULT 0,
  mejor_racha INTEGER DEFAULT 0,
  titulo TEXT DEFAULT '',
  pin_hash TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Billetera del jugador (Única Fuente de Verdad Contable)
CREATE TABLE IF NOT EXISTS wallet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dni TEXT NOT NULL UNIQUE,
  saldo_real REAL NOT NULL DEFAULT 0 CHECK (saldo_real >= 0),
  saldo_bono REAL NOT NULL DEFAULT 0 CHECK (saldo_bono >= 0),
  moneda_ingame INTEGER NOT NULL DEFAULT 0 CHECK (moneda_ingame >= 0),
  FOREIGN KEY (dni) REFERENCES jugadores(dni) ON DELETE CASCADE
);

-- Libro mayor inmutable de movimientos
CREATE TABLE IF NOT EXISTS transacciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dni TEXT NOT NULL,
  operacion TEXT,
  tipo TEXT,                  -- 'ingreso' | 'egreso'
  monto REAL DEFAULT 0,
  referencia TEXT UNIQUE,     -- manual:KEY:stake:DNI | online:ROOM:payout
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Historial detallado de partidas
CREATE TABLE IF NOT EXISTS partidas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  modo TEXT DEFAULT 'normal',
  monto INTEGER DEFAULT 10,
  pozo INTEGER DEFAULT 0,
  ganador_dni TEXT,
  ganador_nombre TEXT,
  premio REAL DEFAULT 0,
  jugadores_json TEXT,
  resultados_json TEXT,
  duracion_ms INTEGER DEFAULT 0,
  hubo_empate INTEGER DEFAULT 0,
  rondas_empate INTEGER DEFAULT 0,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiter persistente (R-09)
CREATE TABLE IF NOT EXISTS rate_limit (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit(reset_at);

-- Resolución manual inmutable por identificador de partida
CREATE TABLE IF NOT EXISTS manual_rolls (
  match_id TEXT PRIMARY KEY,
  match_json TEXT NOT NULL,
  creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- La migración aditiva también incorpora replay_json TEXT a online_partidas.
-- Guarda ArenaMatch completo; NULL identifica partidas antiguas sin reproducción.

-- Cola y emparejamiento online
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dni TEXT NOT NULL UNIQUE,
  modo TEXT NOT NULL CHECK (modo IN ('duelo', 'batalla')),
  monto INTEGER NOT NULL CHECK (monto IN (2, 5, 10, 20, 30, 40, 50, 100)),
  estado TEXT NOT NULL DEFAULT 'esperando',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dni) REFERENCES jugadores(dni) ON DELETE CASCADE
);
```

---

## 4. Ciclo de Vida de una Partida (State Machine)

```mermaid
sequenceDiagram
    autonumber
    actor Player as Jugadores / Operador
    participant UI as PanelPrincipal / UI
    participant Server as Next.js API (/api)
    participant Three as Motor 3D (ThreeJS)
    participant DB as SQLite (WAL)

    Player->>UI: Clic "Lanzar Dados"
    UI->>Server: POST /api/partida/cobro { idempotencyKey, dnis, monto }
    Server->>DB: Cobro atómico e idempotente; valida participantes y monto
    UI->>Server: POST /api/game/roll { matchId, cosmetics }
    Server->>DB: Recupera o guarda ArenaMatch en manual_rolls
    Server-->>UI: { id, players, rounds, winnerId }
    loop Cada ronda guardada
        UI->>Three: Reproduce solo los participantes de la ronda
        Note over Three: Contactos precalculados; el resultado ya está resuelto
        Three-->>UI: Dados en reposo
    end
    UI->>Server: POST /api/partida { idempotencyKey, modo, duracion_ms }
    Server->>DB: Lee resolución y cobros guardados
    Server->>DB: Liquidación idempotente; premio, XP y transacciones
    Server-->>UI: Confirmación y saldos actualizados
    UI->>Player: Muestra premio confirmado
```

---

## 5. Optimizaciones Críticas Implementadas

### A. Resultado persistido y liquidación
- `lib/resolveArena.ts` resuelve valores entre 1 y 6 con `crypto.randomInt`. Solo los líderes empatados continúan; `ArenaMatch` conserva todas las rondas y `winnerId`.
- `lib/manualArena.ts` identifica los participantes desde sus cobros y guarda una resolución por `matchId` en `manual_rolls`. Repetir la solicitud recupera la misma resolución.
- `/api/partida` deriva ganador, participantes y monto de registros del servidor. La interfaz confirma el premio después de una respuesta satisfactoria; un fallo permite reintentar con el mismo identificador.
- Las partidas online guardan `replay_json`. La API sustituye identificadores personales por asientos de la sala. Las partidas antiguas sin historial muestran el resultado guardado.
- `rollSigner.ts` sigue en el repositorio como módulo heredado, pero sus firmas no son el mecanismo del flujo actual de arena.

### B. Simulación y reproducción compartidas
- `lib/arena/physics.ts` precalcula contactos entre cajas, mesa y borde con Cannon ES a paso fijo. Descarta tomas fuera de la mesa, apiladas, inestables, sin choques entre dados o con menos de 2,5 vueltas acumuladas por dado; permite hasta ocho intentos antes de activar la alternativa de resultados.
- El movimiento se remapea a 12 segundos de presentación desde la primera salida al reposo, con una cola de 0,6 segundos. `frameStep`, salidas, audio de contactos y cámara utilizan el reloj de presentación. No son 12 segundos de física en tiempo real ni una espera estática añadida.
- Una simetría constante del cubo asigna las caras al resultado durante toda la trayectoria; no se corrige la orientación al final. La semilla estable permite repetir la misma escena.
- `ArenaReplay` se utiliza en modo manual y online. Incluye pausa, omisión, repetición, sonido opcional, niveles de calidad, historial y alternativa de resultados sin WebGL.
- La entrada, agitación y vuelco del cubilete son coreografiados; no se simulan los contactos en su interior.

### C. Escena y recursos
- `lib/arena/scene.ts` construye mesa, cubilete hueco y dados biselados con materiales procedurales, iluminación y sombras configurables por calidad.
- Al desmontar se liberan geometrías, materiales, texturas, sombras y renderer.
- No se afirma rendimiento constante ni ausencia total de asignaciones por fotograma. Las mediciones de FPS y memoria en dispositivos físicos de gama baja están pendientes.
- [ARENA_3D.md](ARENA_3D.md) reúne las comprobaciones del lanzamiento de 12 segundos y las instrucciones de Blender para los diez modelos. `build_roster.py` genera las nueve mascotas adicionales preservando Demonio. Todos los GLB contienen 18 huesos y cinco clips.
- `MascotCelebration` se integra en `GameResults`, `WinnerReveal` y `/play/[salaId]` después del resultado o su reproducción. Selecciona el modelo por `dadoId`, reproduce `Celebrate`, pasa a `Idle` y detiene la actualización al acumular 12 segundos. La pausa no suma tiempo de animación.
- Movimiento reducido, fallo de WebGL o error de carga mantienen la ilustración. La integración actual abarca la celebración: `Throw`, `Hit` y `Knockout` están disponibles para revisión, sin secuencias de combate conectadas a las partidas.

### D. Object Pool de Partículas DOM (`DOMParticlePool`)
- Para compatibilidad con OBS y navegadores sin canvas de partículas secundario, `lib/particleSystem.ts` utiliza un Object Pool con capacidad máxima de 35 nodos `HTMLDivElement`.
- Al expirar una partícula, se remueve su animación y se devuelve a la piscina para el siguiente ciclo en lugar de destruirla y forzar recolección de basura.

### E. Curva de Progresión XP Re-balanceada (R-07)
Fórmula implementada en [lib/gameEngine.ts](file:///c:/Users/Usuario/Desktop/SENATI/Proyectos/DADOSUPERSALVAJE/lib/gameEngine.ts):
$$\text{puntosGanados} = \max\left(5, \text{round}\left(\text{BASE} \times (1 + \text{rivales} \times 0.15) \times \text{stakeModifier}\right)\right)$$
- $\text{BASE} = 10$ puntos fijos por victoria.
- $\text{rivales} = \min(\max(\text{numPlayers} - 1, 1), 5)$: Más mérito por enfrentar más oponentes.
- $\text{stakeModifier} = \max(0.65, 1 - \log_{10}(\text{pozo} / 20) \times 0.12)$: Amortigua pozos elevados (S/ 1000) para evitar que la barra de niveles colapse en pocas partidas.

---

## 6. Pruebas Automatizadas

El proyecto cuenta con suites de pruebas unitarias y de integración construidas con **Vitest**:

* [tests/financialFlow.test.ts](file:///c:/Users/Usuario/Desktop/SENATI/Proyectos/DADOSUPERSALVAJE/tests/financialFlow.test.ts): Valida la precisión de centavos en premios, sincronización estricta de `monto_yapeo` con `wallet.saldo_real`, generación/verificación de firmas HMAC de dados y limitación de tasa persistente en SQLite.
* [tests/gameEngine.test.ts](file:///c:/Users/Usuario/Desktop/SENATI/Proyectos/DADOSUPERSALVAJE/tests/gameEngine.test.ts): Valida procesamiento de ganadores, desempates automáticos, estabilidad de la curva de XP y detección psicológica de *Near-Misses*.
* [tests/matchmaking.test.ts](file:///c:/Users/Usuario/Desktop/SENATI/Proyectos/DADOSUPERSALVAJE/tests/matchmaking.test.ts): Valida emparejamiento concurrente, creación de salas y cobro atómico.

* `tests/arena.test.ts`: Resolución de rondas, exclusión de eliminados, duración, movimiento hasta cerca del final, contactos, varias vueltas, determinismo, reposo y caras superiores. Se verifican doce semillas para dos dados y doce para diez dados.
* `tests/manualArena.test.ts`: Preparación, cobros y liquidación idempotentes con bases temporales; rechazo de cambios de participantes/monto y de resultados adulterados.
* `tools/check-mascot.mjs --all`: Exige diez GLB y los cinco clips por modelo; carga geometría sin texturas en Three.js y comprueba poses finitas y contacto con el suelo en cinco instantes por clip. También verifica los accesorios de Demonio. No evalúa el acabado artístico ni la decodificación de texturas.

En esta continuación pasaron las cinco pruebas de arena. También se confirmaron la suite completa (39 pruebas), la comprobación de tipos y la compilación de producción.

Ejecutar pruebas con:
```bash
pnpm test
```

---

## 7. Catálogo de Assets Cosméticos de Dados (10 Temáticas)

Ubicación de texturas: `public/dados/` | Configuración técnica: [lib/dados.ts](file:///c:/Users/Usuario/Desktop/SENATI/Proyectos/DADOSUPERSALVAJE/lib/dados.ts)

| # | Nombre Temático | Color | Archivo PNG | Tema Visual y Efecto de Aura |
|---|-----------------|-------|-------------|------------------------------|
| 1 | **Demonio de Lava** | Rojo | `rojo.png` | Piedra volcánica con grietas de lava incandescente. |
| 2 | **Pantera de Neón** | Rosa | `rosado.png` | Metal oscuro pulido con patrones neón rosa brillante. |
| 3 | **Mago Eléctrico** | Amarillo | `amarillo.png` | Bronce arcano con relámpagos dorados y runas eléctricas. |
| 4 | **Océano** | Celeste | `celeste.png` | Cristal oceánico con corrientes de agua y brillo celeste. |
| 5 | **Fantasma** | Blanco | `blanco.png` | Piedra espectral etérea con aura fantasmal blanca. |
| 6 | **Sombra / Obsidiana** | Negro | `negro.png` | Obsidiana pulida con grietas de energía oscura. |
| 7 | **Esmeralda** | Verde | `verde.png` | Jade oscuro pulido con venas de cristal esmeralda brillante. |
| 8 | **Viento Carmesí** | Guinda | `guinda.png` | Piedra carmesí con patrones de viento y runas de tornado. |
| 9 | **Fuego Naranja** | Naranja | `naranja.png` | Metal volcánico carbonizado con llamas y brasas naranjas. |
| 10 | **Relámpago Azul Marino** | Azul | `azul.png` | Aleación metálica azul marino con arcos de plasma. |


