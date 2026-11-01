# Pantera Rosada — revisión 2

23 de octubre de 2026. Se trabaja únicamente esta mascota para revisar el parecido antes de extender el acabado a las demás.

## Referencia y alcance

La ilustración original está en `public/mascots/pantera.webp`. Esta versión busca acercar la silueta, el traje y los rasgos felinos; **no es una reconstrucción fiel ni un acabado fotorrealista aprobado**. El usuario aceptó la revisión 2 como base y autorizó continuar con Pato Salvaje siguiendo el orden de la galería.

- Cabeza esculpida y unificada, puente nasal, orejas felinas, párpados, pupilas y bigotes.
- Rosetas irregulares en el pelaje y fibras cortas de geometría en la cabeza.
- Abrigo ceñido, solapas y cuello alto, faldones separados, chaleco, pantalón y botas. Se retira la armadura genérica con gemas de la primera versión.
- Neón estrecho, cuero con grano, bordes metálicos y funda lateral inspirados en la imagen.
- Cola de curva continua y mano elevada, conservando la palma hacia arriba y el dado visible.
- Dos atlas de 2048 px: color y normales. Los materiales comparten las mismas dos texturas exportadas; no se duplican 28 descriptores en el GLB.
- 71 044 vértices fuente, 18 huesos, cinco clips. GLB aproximado: 5,78 MiB.

Persisten diferencias en la anatomía fina del rostro, la densidad y dirección del pelo y los pliegues del traje. Las animaciones reutilizan la base anterior y muestran articulaciones rígidas en algunas poses; no hay simulación de tela. El aumento de peso requiere medición en móviles físicos antes de considerar este detalle definitivo.

## Archivos

- `revision1/`: modelo, GLB, metadatos y render anteriores, conservados antes de sustituirlos.
- `revision2/model.blend`: fuente editable de esta revisión.
- `revision2/pantera.glb`: exportación candidata, validada y copiada a `public/models/mascots/pantera.glb`.
- `revision2/preview.png`, `detail.png`, `celebrate.png`: renders reales del modelo.
- `model.blend`, `model.json`, `preview.png`: copia de la revisión actualmente integrada.

En `/mascotas`, seleccionar Pantera Rosada y activar **Comparar con imagen** muestra la ilustración junto al visor. La URL del GLB incorpora `?v=2` para evitar reutilizar el modelo anterior en caché.

## Reproducir

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_pantera.py
node tools/check-mascot.mjs --file assets/mascots3d/pantera/revision2/pantera.glb
```

El generador escribe la candidata en `revision2/`; la copia al modelo público es un paso separado después de revisar. `build_roster.py` preserva Pantera cuando detecta la revisión 2. Para volver a renderizar sin reconstruir: ejecutar `tools/blender/render_pantera_review.py` con Blender en segundo plano.

## Validación

La exportación actual pasó los cinco clips, poses finitas y contacto con el suelo en cinco instantes por clip. Se revisaron renders de reposo, rostro y celebración. La comprobación visual de esta revisión en el navegador quedó pendiente: la herramienta rechazó la apertura local por su política de URL. No se eludió esa restricción.

Pasaron las cinco pruebas de `tests/mascots.test.ts` y `tests/mascot-celebration.test.tsx`, además de la compilación de producción con comprobación de tipos. No se volvió a ejecutar toda la suite de la arena porque esta revisión no cambia su física ni la resolución de partidas.
