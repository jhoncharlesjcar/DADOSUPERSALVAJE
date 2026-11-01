# Variantes ligeras — 27 de octubre de 2026

Diez GLB reducidos publicados en `public/models/mascots/lite/`. Los originales completos se conservan. Las variantes mantienen los 18 huesos, cinco clips y duración de cada animación (tolerancia de una muestra a 30 Hz). Cada una pasó la comprobación de suelo y límites finitos de 25 poses con Three.js.

| Modelo | Completo MiB | Ligero MiB | Triángulos completos | Triángulos ligeros |
|---|---:|---:|---:|---:|
| Bestia de Fuego | 7,75 | 3,42 | 150697 | 45209 |
| Demonio | 3,33 | 1,33 | 37420 | 11213 |
| Emperador | 6,90 | 2,92 | 129474 | 38842 |
| Fantasma | 4,11 | 1,79 | 77930 | 23379 |
| Océano | 7,53 | 3,28 | 160736 | 48219 |
| Pantera | 5,78 | 2,51 | 127228 | 38168 |
| Pato | 6,64 | 2,90 | 118352 | 35505 |
| Poseidón revisión 3 | 8,99 | 3,94 | 201580 | 60474 |
| Rey Salvaje | 7,82 | 3,49 | 159895 | 47968 |
| Sombra | 5,05 | 2,21 | 98222 | 29465 |

El generador importa el GLB completo a 30 fps, simplifica antes del modificador de armadura, limita texturas a 1024 px y conserva pistas NLA. Los metadatos individuales cuentan además triángulos importados auxiliares; la tabla y `audit.json` cuentan exclusivamente las primitivas exportadas del GLB.

En el visor, Automática elige ligero con viewport <=700 px o puntero grueso al montar; Ligera usa DPR máximo 1 y sin bloom. Completa usa DPR máximo 1,75. Solo se descarga la variante seleccionada. El cambio conserva clip, tiempo y pausa. Esta heurística no mide la capacidad de la GPU.

Se inspeccionó `poseidon-preview.png`, render del GLB ligero importado en Blender con la misma cámara y luces del completo: conserva silueta, accesorios y color; pierde detalle fino y suavidad de reflejos. No se inspeccionaron visualmente las otras nueve variantes en esta intervención. Las pruebas de suelo y clips no verifican las texturas. Siguen pendientes FPS, memoria y tiempos reales en móvil/escritorio; no se certifican 30/60 FPS.

## Reproducir

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 2 --python-exit-code 1 --python tools/blender/build_mascot_lods.py
node tools/audit-mascot-assets.mjs
node tools/check-mascot.mjs --file public/models/mascots/lite/poseidon.glb
```

El generador escribe candidatas en esta carpeta; la publicación es una copia explícita tras comprobarlas. Admite `-- poseidon --source-dir assets/mascots3d/poseidon/revision3` para revisar una candidata antes de reemplazar el modelo público. `tools/blender/render_mascot_lod_review.py -- poseidon` produce la comparación desde la escena principal guardada.
