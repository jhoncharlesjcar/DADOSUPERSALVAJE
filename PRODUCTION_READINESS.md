# Estado de Preparación para Producción — Dado Salvaje

**Fecha de revisión:** Octubre 2026  
**Versión de plataforma:** 4.0.0 (Auditoría Técnica y Financiera AAA Superada)

---

## 1. Veredicto Actual

La plataforma cuenta con **arquitectura técnica de grado producción para despliegue en servidor dedicado/instancia única**. La experiencia con saldo expresado en soles (**S/**) incorpora:
- Autenticación criptográfica de jugadores con DNI y PIN hasheado con `scrypt`.
- Billetera virtual unificada con distribución matemática exacta en centavos (80% ganador, 16% casa, 4% ranking).
- **Tiradas resueltas en servidor** (`crypto.randomInt`) y rondas persistidas; la liquidación manual consulta el registro y los cobros guardados.
- Prevención de doble cobro y condiciones de carrera mediante transacciones inmediatas (`BEGIN IMMEDIATE`) en SQLite.
- Rate limiting persistente en base de datos.
- Arena compartida Three.js/Cannon ES con calidad configurable, liberación de recursos y alternativa de resultados cuando WebGL falla. El rendimiento en dispositivos físicos de gama baja sigue pendiente de medición.
- Suite de pruebas automatizadas con Vitest.

> [!WARNING]
> **Aviso Regulatorio:** La robustez técnica lograda no sustituye los requerimientos normativos. Antes de abrir la plataforma a depósitos directos y retiros con dinero bancarizado real en Perú, se deben completar las revisiones legales de juego y apuestas ante MINCETUR / autoridades pertinentes, políticas de juego responsable y pasarelas de pago auditadas.

---

## 2. Controles Técnicos Implementados

| Control | Estado | Implementación |
|---|---|---|
| **Tiradas Autoritativas** | ✅ Implementado | `lib/resolveArena.ts`, `lib/manualArena.ts`, `manual_rolls` y `online_partidas.replay_json` |
| **Atomicidad Financiera** | ✅ Implementado | Transacciones `.immediate()` en SQLite |
| **Sincronización de Saldo** | ✅ Implementado | `wallet.saldo_real` como fuente de verdad única |
| **Rate Limiter Persistente** | ✅ Implementado | Tabla `rate_limit` en SQLite con auto-purga |
| **Liberación de Recursos 3D** | ✅ Implementado | Limpieza de geometrías, materiales, texturas, sombras y renderer; medición prolongada en dispositivos pendiente |
| **Rendimiento DOM** | ✅ Implementado | `DOMParticlePool` (máximo 35 divs reciclables) |
| **Audio Buffer Leak** | ✅ Implementado | Buffer de ruido blanco compartido pre-generado |
| **Curva de Progresión XP** | ✅ Implementado | Base 10 + bonus rivales + amortiguador logarítmico |
| **Desempate por Rondas** | ✅ Implementado | Historial del servidor; solo los líderes empatados siguen participando |
| **Seguridad de Sesiones** | ✅ Implementado | Cookies `HttpOnly`, `SameSite=Strict` y HMAC de 256 bits |

---

## 3. Configuración Obligatoria de Entorno

Copiar `.env.example` a `.env.local` o al gestor de secretos del servidor:

- `ADMIN_PASSWORD`: Clave robusta de al menos 16 caracteres para `/admin`.
- `ADMIN_SESSION_SECRET`: Secreto aleatorio de al menos 32 caracteres para sesiones administrativas.
- `PLAYER_SESSION_SECRET`: Secreto aleatorio de al menos 32 caracteres para sesiones de jugadores.
- `ROLL_SECRET`: Solo para el módulo heredado `rollSigner`; el flujo actual de arena y liquidación usa resultados persistidos y no depende de esa firma.
- `DATABASE_PATH`: Ruta absoluta a almacenamiento persistente en disco rápido (SSD con soporte WAL).
- `SITE_URL`: Origen HTTPS oficial de la aplicación.

*Nunca incluir `database.db`, sus archivos `-wal`/`-shm` ni archivos `.env` en repositorios públicos.*

---

## 4. Pendientes Previos a Operación Comercial Bancaria

1. **Pasarela de Pago y Retiros:** Integrar pasarela de pago autorizada (Yape / Niubiz / Izipay / Culqi) con webhooks firmados, conciliación asíncrona y verificación de depósitos.
2. **Cumplimiento Legal en Perú:** Revisión de la ley de juegos a distancia y apuestas deportivas con asesoría legal especializada (prevención de lavado de activos, tributación).
3. **Juego Responsable:** Formulario de verificación de mayoría de edad (18+), límites voluntarios de recarga/pérdida y opción de autoexclusión temporal.
4. **Respaldo y Monitoreo:** Configurar copias de seguridad continuas de SQLite (`.backup`) hacia almacenamiento externo seguro y alertas de disponibilidad.

---

## 5. Comandos de Verificación Continua

El alcance y las comprobaciones actuales están en [ARENA_3D.md](ARENA_3D.md). El lanzamiento de 12 segundos pasó las cinco pruebas de arena, incluyendo 24 escenas de dos y diez dados. La suite completa (39 pruebas), tipos y compilación se confirmaron para esa etapa y el primer modelo.

La ampliación actual incluye diez modelos estilizados iniciales, selector en `/mascotas` y celebración del ganador en resultados manuales y online, con pausa y alternativa ilustrada ante errores o movimiento reducido. Sus validaciones están en curso; los resultados de la etapa anterior no certifican esta ampliación. Quedan pendientes pulido artístico, mediciones en dispositivos físicos y el lint global. La presencia de clips de impacto o KO no implica que haya combate integrado.

```bash
# Validar tipado estricto
pnpm typecheck

# Ejecutar suite de pruebas unitarias y de integración
pnpm test

# Ejecutar auditoría de linter
pnpm lint

# Construir artefacto de producción
pnpm build
```
