# Poseidón — historial de revisiones individuales

## Revisión 3 — integrada el 27 de octubre de 2026

- Se reemplazó el rostro formado por volúmenes abultados por una superficie continua con mandíbula y mejillas más planas. Se acortó el cuello, ajustando también el esqueleto.
- La barba combina una superficie continua y hebras curvas finas; se redujeron el grosor de ribetes y el relieve de grabados. Las placas abdominales dejaron de usar polígonos alabeados.
- Inspección de reposo, celebración y detalle en Blender. El primer pase tenía barba demasiado lisa: se corrigió antes de integrar. Persisten estilización marcada, cejas/párpados gruesos, acabado de pelo esculpido y diferencias de anatomía/material respecto a la referencia. G05 continúa abierto a aprobación del patrón en el visor.
- Fuente: 101754 vértices, 18 huesos, dos atlas de 2048 px. GLB completo: 8,99 MiB y 201580 triángulos exportados. La variante ligera usa 60474 triángulos y 3,94 MiB; conserva cinco clips y duraciones. El aumento de geometría del completo frente a revisión 2 no se presenta como una optimización.
- Ambos GLB aprobaron límites finitos y suelo en cinco muestras de los cinco clips. Se inspeccionó además el render del GLB ligero importado: menor detalle fino y reflejos más simplificados, sin pérdida de la silueta principal.
- `revision3/` conserva candidata, fuente y tres renders; el modelo principal y el GLB público están actualizados. Catálogo `?v=3`; SHA-256 público `D81A07A762201A88AEDC7F492B3DD7FF590D0D38CED434B5F2AF6BDE481BF55E`.
- La revisión 2 y su generador se conservan en `revision2/`. No se han declarado aprobados el parecido final, los FPS ni la apariencia en navegador.

Reproducción actual: `tools/blender/build_poseidon.py` escribe en `revision3/`. Usar `--python-exit-code 1` al ejecutarlo con Blender. `render_poseidon_review.py` reanuda los tres renders de `revision3` por defecto y acepta `-- revision2` para la fuente anterior.

## Registro de revisión 2 (25 de octubre)

Iniciada el 24 de octubre de 2026 y retomada el 25. Continúa después de Bestia de Fuego y completa la primera pasada individual de los nueve modelos iniciales. Demonio Salvaje conserva su trabajo previo. Referencia: `public/mascots/poseidon.webp`.

## Alcance

- Rostro humano esculpido, nariz, párpados, cejas, boca seria, barba en capas y cabello con hebras grises.
- Diadema ajustada con punta central, gema cian, protectores de sien y aletas laterales.
- Coraza curva azul, placas abdominales, hombreras laminadas, grabados marinos y sellos de tridente.
- Brazos musculosos descubiertos, brazales con aletas, faldón articulado, rodilleras, grebas y botas laminadas.
- Capa azul plisada con pesos de pecho y cadera, sin simulación de tela.
- Tridente con tres puntas curvas en ambos extremos, bordes de oro envejecido y gemas cian, unido a la mano derecha.
- Dado de seis caras sobre la mano elevada. La ilustración muestra un poliedro distinto; se conserva el dado del juego.
- Iluminación fría y borde azul en el visor.

Es una interpretación estilizada. No reproduce el detalle fotorrealista de piel, cabello, grabados o tela. La emisión es estática; no se añaden relámpagos animados ni el escenario de la ilustración. Se conservan los cinco clips existentes, sin crear combate o física de accesorios.

## Reproducción

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_poseidon.py
node tools/check-mascot.mjs --file assets/mascots3d/poseidon/revision2/poseidon.glb
```

Si la generación se interrumpe después de guardar la escena y el render de reposo, `tools/blender/render_poseidon_review.py` produce únicamente la celebración y el detalle desde `revision2/model.blend`, sin regenerar el GLB ni modificar la escena guardada.

El generador escribe únicamente la candidata en `revision2/`. `revision1/` conserva el GLB, fuente, metadatos y render anteriores. El generador general preserva modelos cuyo `model.json` principal indique revisión 2 o superior.

## Validación

- Revisión 2 integrada en `public/models/mascots/poseidon.glb`, con fuente, metadatos y vista previa copiados al directorio principal. El catálogo solicita `?v=2` para renovar la caché.
- 83 240 vértices fuente, 18 huesos, dos atlas de 2048 px y GLB de 7,78 MiB.
- `check-mascot.mjs` pasó: cinco muestras por clip, límites finitos y mínimo vertical igual a cero. No valida la fidelidad artística.
- Se inspeccionaron reposo, celebración y detalle facial. La celebración usa un encuadre más amplio para incluir el tridente levantado. El accesorio gira con la mano; en esa pose se ve arriba el extremo menor y el extremo grande queda detrás del cuerpo.
- Queda pulido artístico: mejillas y frente demasiado redondeadas, barba y cabello con hebras rígidas, algunos grabados muy elevados y pequeños artefactos de textura en primeros planos. Los renders no equivalen a una reproducción fiel de la ilustración.
- TypeScript y ESLint pasaron. Vitest: cinco pruebas aprobadas en `mascots.test.ts` y `mascot-celebration.test.tsx` (dos archivos).
- El GLB público coincide con la candidata: SHA-256 `7D4AD3A3EE8C172455D7BB0DCFE38A36DE05FC078BD1289497CE3E686C8E2594`. Los otros nueve GLB conservaron sus hashes anteriores.
- Revisión visual en navegador pendiente: la política de acceso bloqueó la URL local en la sesión. La inspección de esta revisión se realizó mediante Blender.
