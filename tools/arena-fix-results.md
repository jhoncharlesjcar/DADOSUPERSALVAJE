# Arena — cierre técnico G01–G04, 27 de octubre de 2026

## Cambios

- **G01:** `camera.ts` calcula la envolvente de toda la trayectoria con una esfera que contiene cada orientación del dado. Mantiene el plano general durante el vuelo y acerca solo después del reposo. Recalcula la proyección al cambiar el tamaño.
- **G02:** fricción 0,06, restitución 0,78, giro inicial principal de 60–68 rad/s, abanico reducido y salidas físicas cada 0,10 s. `takes.json` contiene 21 tomas aceptadas para grupos de 2–10 dados. La semilla de escena selecciona una toma; cada partida calcula una sola simulación, sin búsquedas ni impulsos artificiales durante la reproducción. Las caras finales se ajustan mediante la simetría del cubo al resultado autoritativo existente.
- **G03:** reloj monotónico compartido con delta real de RAF; pausa y pestaña oculta descuentan su tiempo. Los frames tardíos no reproducen una ráfaga de sonidos viejos.
- **G04:** calidad cambia DPR y sombras sobre la escena existente. Al activar/desactivar sombras se recompilan los materiales; al cambiar resolución se libera el mapa anterior. El componente ya no se desmonta al cambiar calidad y conserva reloj, pausa y resultado.

## Evidencia

`tools/arena-audit-results.json` contiene las 21 tomas y sus métricas, con 84 proyecciones de cámara (aspectos 0,5; 0,8; 1,8; 2,5). La sonda usa las funciones de cámara del juego y comprueba ocho esquinas por dado cada tres frames, incluido el acercamiento final. Todas pasaron: máximo absoluto NDC **0,8433**, inferior al límite de prueba 0,9.

Todas las tomas duran **14,5 s desde la primera salida**. Cada dado mantiene movimiento medido después de t=10, con mínimo global **10,0667 s**. Los dados acumulan **3,0187–16,0553 vueltas** por trayectoria y las tomas registran **2–69 contactos dados–dados** por encima del umbral de impacto. El cubilete añade 2,65 s antes de la salida y la cámara 0,5 s al final: la escena completa dura 17,65 s, excluidas pausas.

| Dados | Tomas | Preparación Node observada (ms) | Contactos por toma |
|---:|---:|---:|---:|
| 2 | 3 | 7,98–41,28 | 2–6 |
| 3 | 2 | 19,56–26,23 | 9–10 |
| 4 | 2 | 12,97–25,00 | 19–22 |
| 5 | 2 | 11,00–16,77 | 11–23 |
| 6 | 3 | 12,80–15,29 | 26–33 |
| 7 | 1 | 11,65 | 39 |
| 8 | 3 | 8,32–20,44 | 39–46 |
| 9 | 2 | 19,20–24,48 | 67–69 |
| 10 | 3 | 13,30–19,96 | 52–66 |

Las mediciones de preparación son una ejecución local de Node; incluyen calentamiento y no representan carga, FPS o respuesta de un móvil.

**Vitest: 22 pruebas aprobadas en tres archivos** (`arena.test.ts`, `arena-playback.test.ts`, `arena-quality.test.tsx`), 8,56 s de ejecución reportada. Comprueban 2–10 dados con 12 semillas por cantidad y todas las caras, determinismo, estabilidad final, movimiento individual, reloj a 10/20/30/60 FPS simulados, pausa/visibilidad y continuidad al cambiar calidad. ESLint pasó para fuentes, herramientas y pruebas de esta corrección.

## Límites y reproducción

- t=10 se mide desde la primera salida, **no diez segundos desde la salida individual de cada dado**: las salidas visuales pueden escalonarse hasta 3,22 s. Tampoco se afirma que todos los dados choquen continuamente durante diez segundos; la desaceleración y los contactos son físicos.
- La reproducción ralentiza uniformemente la parte activa de una simulación física y comprime el tramo quieto final a 0,6 s. No altera posiciones durante la trayectoria. El ritmo artístico necesita inspección dentro del juego.
- La variedad es acotada: 21 tomas, una para grupos de siete. Repetir la semilla reproduce exactamente la misma toma. La selección de una toma no decide ganadores.
- No se abrió navegador por la restricción de acceso local ya documentada. No se midieron FPS/GPU ni se certifica aquí la percepción del movimiento.

```powershell
node tools/audit-arena-graphics.cjs
node node_modules/vitest/vitest.mjs run tests/arena.test.ts tests/arena-playback.test.ts tests/arena-quality.test.tsx
```

`arena-calibration.json` conserva la búsqueda histórica y sus semillas físicas exactas. `arena-calibrate.cjs` permite nuevas búsquedas offline y guarda cada aceptación antes de continuar; no publica automáticamente esas tomas en `takes.json`. Cambiar los parámetros físicos exige recalibrar y volver a ejecutar la sonda y las pruebas.
