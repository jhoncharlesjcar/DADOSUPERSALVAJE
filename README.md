# 🎲 DADO SALVAJE — Casino Fantasy Competitivo (v4.0 AAA)

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-blue?logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r183-black?logo=three.js)](https://threejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?logo=sqlite)](https://sqlite.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest)](https://vitest.dev/)

**Dado Salvaje** es una plataforma web de juegos de azar competitivos con economía en soles peruanos (**S/**), una arena 3D en Three.js con contactos físicos de Cannon ES, audio sintético y resultados resueltos en el servidor.

---

## 🚀 Características Principales

* 🎲 **Arena 3D compartida:** Cubilete animado, dados biselados, materiales procedurales, iluminación y contactos entre dados, mesa y borde. Se utiliza en modo manual y en nuevas partidas online.
* 🔒 **Resultados del servidor:** `crypto.randomInt(1, 7)` resuelve las rondas. La liquidación consulta los resultados y cobros guardados; los reintentos conservan la misma partida y evitan duplicar cobros y premios.
* 💰 **Economía y Billetera Atómica:** Billetera virtual unificada (`wallet.saldo_real`) con transacciones inmediatas (`BEGIN IMMEDIATE`), prevención de doble gasto y distribución exacta en centavos (80% ganador, 16% casa, 4% ranking).
* ⚔️ **Desempates por rondas:** Solo los líderes empatados vuelven a lanzar. La reproducción permite consultar el historial completo y conserva el ganador explícito del servidor.
* 🎛️ **Controles de reproducción:** Calidad ajustable, sonido opcional, pausa, omisión y repetición. Si WebGL falla, se puede consultar el resultado guardado.
* 📈 **Curva de Progresión XP Balanceada:** Sistema de niveles, rangos y cofres con curva calculada para retención a largo plazo.
* 🧠 **Psicología de Juego Near-Miss:** Detección de "¡Por poco!" para rivales a 1 punto del ganador y rachas de victoria consecutivas.
* 🎛️ **Consola de Operador / Streamer:** Panel `/admin` para torneos en vivo, eventos presenciales o transmisiones por streaming (OBS compatible).
* 🛡️ **Rate Limiting Persistente:** Control de abuso respaldado en SQLite con auto-purga de ventanas de tiempo expiradas.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Framework Web** | Next.js 16 (App Router) + React 19 |
| **Gráficos 3D** | Three.js (r183), RoundedBoxGeometry, materiales e iluminación procedurales |
| **Contactos físicos** | Cannon ES 0.20.0, trayectorias precalculadas y reproducibles |
| **Estilos & Animaciones** | Tailwind CSS 4, Framer Motion, Vanilla CSS personalizado |
| **Audio** | Web Audio API con osciladores y buffers sintéticos de bajo retardo |
| **Base de Datos** | SQLite con `better-sqlite3` en modo WAL (`synchronous = NORMAL`) |
| **Seguridad** | Criptografía nativa Node.js (`scrypt`, HMAC-SHA256, timingSafeEqual) |
| **Pruebas Automatizadas** | Vitest + Testing Library |

---

## 📋 Requisitos Previos

- **Node.js:** v20.x o superior
- **Gestor de paquetes:** `pnpm` (recomendado) o `npm`

---

## ⚡ Instalación y Puesta en Marcha

1. **Clonar e instalar dependencias:**
   ```bash
   pnpm install
   ```

2. **Configurar variables de entorno:**
   Copiar `.env.example` a `.env.local` y definir los secretos de sesión:
   ```bash
   cp .env.example .env.local
   ```

3. **Iniciar el servidor de desarrollo:**
   ```bash
   pnpm dev
   ```
   Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

La ruta `/arena` ofrece demostraciones de dos jugadores, diez jugadores y desempate sin cobros ni cambios de saldo. El lanzamiento se reproduce durante 12 segundos, con varias rotaciones, contactos físicos y un remapeo cinematográfico del tiempo. El visor `/mascotas` permite revisar diez modelos animados creados en Blender y su modo de celebración. La mascota ganadora celebra en las pantallas de resultado manual y online; la ilustración se conserva ante errores o movimiento reducido. Son modelos estilizados iniciales y solo está integrada la celebración, no los enfrentamientos o KO. La ampliación pasó 44 pruebas, comprobación de tipos y compilación de producción el 23 de octubre de 2026. El alcance y los pendientes se detallan en [ARENA_3D.md](ARENA_3D.md).

---

## 🧪 Pruebas y Validación de Calidad

```bash
# Ejecutar todas las pruebas unitarias y de integración
pnpm test

# Verificación de tipos TypeScript estricto
pnpm typecheck

# Auditoría de linter
pnpm lint

# Compilar para producción
pnpm build
```

---

## 📚 Documentación del Proyecto

* 📖 [DOCUMENTACION.md](DOCUMENTACION.md): Visión general del producto, flujo de jugador y guías de uso.
* 🏗️ [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md): Arquitectura detallada, esquema DDL, máquina de estados y optimizaciones de bajo nivel.
* 🎲 [ARENA_3D.md](ARENA_3D.md): Arena compartida, lanzamiento de 12 segundos, colección de diez mascotas, celebración, validaciones y límites.
* 🚀 [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md): Checklist de pre-producción, seguridad regulatoria y guía de despliegue.

---

## 📄 Licencia

Uso privado e interno para el proyecto **Dado Salvaje**. Todos los derechos reservados.
