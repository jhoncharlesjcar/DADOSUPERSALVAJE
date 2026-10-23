# 🎲 Dado Salvaje — Documentación General

**Dado Salvaje** es una plataforma de juego competitivo de dados en tiempo real con economía expresada en soles peruanos (**S/**), gráficos 3D de alta fidelidad desarrollados en Three.js, audio posicional sintético (Web Audio API) y arquitectura de servidor autoritativo sobre Next.js y SQLite en modo WAL.

---

## 🌟 Experiencia del Jugador y Core Loop

1. **Acceso Seguro:** Autenticación por DNI peruano (8 dígitos) y PIN criptográfico de 6 dígitos con sal y `scrypt`.
2. **Saldo y Bienvenida:** Saldo promocional configurable (`WELCOME_CREDITS`) acreditado de forma idempotente.
3. **Modos de Juego:**
   - **Duelo:** 2 participantes cara a cara.
   - **Batalla:** 10 jugadores simultáneos en mesa redonda.
   - **Modo Manual / Streamer (`/manual`):** Mesa para operadores presenciales, eventos en vivo o transmisiones OBS.
4. **Reglas de Partida:**
   - Cada jugador tiene un dado de seis caras con color asociado, lanzado desde un cubilete animado.
   - El puntaje más alto gana el 80% del pozo acumulado.
   - Si los valores máximos empatan, únicamente esos líderes vuelven a lanzar. Se conservan todas las rondas y el ganador confirmado; no se comparan tiradas de rondas distintas para decidirlo.
5. **Progreso y Psicología de Juego:**
   - Sistema de niveles y cofres con curva de XP balanceada (base fija + bonus por rivales enfrentados + amortiguación para high stakes).
   - Detección de *Near-Miss* ("¡Por poco!") para rivales a 1 punto del ganador, estimulando la revancha.
   - Rachas de victorias consecutivas con multiplicadores de estatus.

---

## 🏛️ Arquitectura y Seguridad (v4.0 Elite)

* **Tiradas Autoritativas de Servidor:** El servidor resuelve las rondas mediante `node:crypto` (`randomInt(1, 7)`) y guarda el resultado. La liquidación manual consulta ese registro y los cobros previos, sin aceptar un ganador o monto elegido por el cliente. Reintentar la carga o la confirmación conserva el identificador y el resultado.
* **Transacciones Financieras Inmediatas:** Cobros y pagos operan bajo transacciones `BEGIN IMMEDIATE` en SQLite, bloqueando lecturas/escrituras concurrentes y evitando duplicidad de descuentos o race conditions.
* **Fuente Única de Verdad Financiera:** Todo movimiento opera sobre `wallet.saldo_real`. Los campos heredados como `monto_yapeo` se sincronizan estrictamente desde la billetera.
* **Presentación 3D:** Three.js reproduce trayectorias precalculadas con Cannon ES. Incluye niveles de calidad y liberación de recursos al desmontar. Las mediciones de FPS y memoria en teléfonos físicos siguen pendientes.
* **Object Pool DOM:** Efectos de partículas ambientales gestionados por un pool estático de 35 divs, eliminando layout thrashing y fugas de memoria.
* **Rate Limiting Persistente:** Límites de peticiones almacenados en tabla SQLite `rate_limit` con purga automática de ventanas expiradas.

---

## 📂 Estructura de Rutas y Navegación

| Ruta | Propósito |
|---|---|
| `/` | Página de acceso e introducción al juego. |
| `/manual` | Mesa manual con selección de jugadores y arena 3D. |
| `/arena` | Demostración de la arena con resultados fijos, sin cobros ni cambios de saldo. |
| `/mascotas` | Selector de diez mascotas, exploración de clips con giro y zoom, pausa, restablecimiento de vista y modo celebración. |
| `/lobby` | Sala de espera pública y emparejamiento automático online (matchmaking). |
| `/play/[salaId]` | Sala online con la misma arena y reproducción de rondas guardadas. |
| `/admin` | Panel de control de operador: gestión de saldos, PINs, historial y auditoría contable. |
| `/api/game/roll` | Prepara o recupera la resolución manual guardada para un identificador ya cobrado; requiere operador. |
| `/api/partida` | Liquida la partida manual desde su resultado y cobros guardados; los reintentos son idempotentes. |
| `/api/partida/cobro` | Cobro idempotente de apuestas para salas manuales. |
| `/api/wallet` | Consulta y transacciones seguras de billetera. |

---

## 🛠️ Comandos de Desarrollo y Operación

La arena permite pausar, omitir, repetir y activar sonido, además de ajustar la calidad. Si WebGL falla, ofrece los resultados guardados. Las salas online antiguas sin historial muestran su resultado sin reconstruir rondas ficticias. El lanzamiento se reproduce durante 12 segundos desde la primera salida hasta el reposo mediante remapeo cinematográfico de una trayectoria física, con varias rotaciones y contactos. Véase [ARENA_3D.md](ARENA_3D.md) para las comprobaciones y los límites de la simulación.

El catálogo dispone de diez modelos 3D iniciales, con cinco clips por mascota. Demonio conserva un acabado más detallado y texturas; las otras nueve mascotas requieren pulido artístico para igualar ese nivel. La celebración del ganador se muestra después del resultado confirmado o de su reproducción en las pantallas manual y online. Se puede pausar; termina la animación tras 12 segundos de reproducción y conserva la ilustración ante errores de carga, WebGL o movimiento reducido. Los clips de lanzamiento, impacto y KO se pueden revisar en el visor, pero todavía no forman secuencias de enfrentamiento en las partidas. La colección y su integración pasaron 44 pruebas, comprobación de tipos y compilación de producción el 23 de octubre de 2026. Los archivos editables, exportaciones y límites se describen en [ARENA_3D.md](ARENA_3D.md).

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev

# Ejecutar suite de pruebas (Vitest)
pnpm test

# Verificación de tipos TypeScript
pnpm typecheck

# Compilar para producción
pnpm build
```

Para especificaciones detalladas de arquitectura, consulte `DOCUMENTACION_TECNICA.md`.  
Para el protocolo de despliegue y auditoría regulatoria, consulte `PRODUCTION_READINESS.md`.
