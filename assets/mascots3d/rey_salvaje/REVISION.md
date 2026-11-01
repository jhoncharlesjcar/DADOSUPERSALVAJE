# El Rey Salvaje — revisión individual 2

24 de octubre de 2026. Se continúa después de La Sombra, siguiendo el orden de la galería y trabajando una mascota a la vez. Referencia: `public/mascots/rey_salvaje.webp`.

## Alcance

- Cráneo y hocico esculpidos, puente nasal, nariz triangular, labios, almohadillas de bigotes, párpados, orejas y ojos verdes.
- Melena en capas con hebras geométricas, barba clara y pequeños mechones sobre los brazos y muslos.
- Corona abierta de ramas, metal patinado y esmeraldas facetadas.
- Coraza verde, placas abdominales, hombreras superpuestas, brazales, rodilleras, grebas y tabardo con ribetes y sigilos.
- Cristales de hombros y brazales, enredaderas sobre el torso y las piernas.
- Patas con dedos y garras, cola curva con borla y mano elevada con dado verde.
- Iluminación del visor con borde verde y emisión ajustada para esta mascota.

El resultado es una interpretación estilizada. Las hebras geométricas y texturas horneadas no equivalen al pelaje fotorrealista de la ilustración. Los cristales usan materiales facetados opacos, sin refracción volumétrica. Se conserva el esqueleto compartido; melena y cola no tienen simulación independiente. No se modela el escenario ni las hojas flotantes del fondo.

## Reproducción y archivos

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_rey_salvaje.py
node tools/check-mascot.mjs --file assets/mascots3d/rey_salvaje/revision2/rey_salvaje.glb
```

El generador escribe únicamente la candidata en `revision2/` mediante `reference_pipeline.py`. La candidata revisada se copió a `public/models/mascots/rey_salvaje.glb`, con fuente, metadatos y render principal en la carpeta del personaje. La URL del catálogo incorpora `?v=2` para renovar la caché. `revision1/` conserva el GLB, fuente, metadatos y render anteriores. El generador general preserva las revisiones 2 o superiores.

Comparación disponible en **Mascotas → El Rey Salvaje → Comparar con imagen**.

## Validación

Se inspeccionaron los renders de reposo, celebración y primer plano. La primera revisión motivó adelantar los ojos para evitar que los taparan las órbitas, ampliar y oscurecer la melena, acortar los mechones claros de la barba y conectar la gema superior con la corona.

La candidata final tiene 81 807 vértices fuente, 18 huesos, dos atlas compartidos de 2048 px y un GLB de 7,82 MiB. Pasó la comprobación de los cinco clips con poses finitas y contacto con el suelo en cinco instantes por clip. El archivo público coincide por SHA-256 con la candidata validada (`EB9B786D110027D4393C52BC3246DD556088ACB896CDEE3955AD7FD87F62874C`); los otros nueve modelos conservaron sus hashes.

La comprobación de tipos y ESLint del visor y el catálogo terminaron correctamente. Las cinco pruebas de `tests/mascots.test.ts` y `tests/mascot-celebration.test.tsx` pasaron en una ejecución de 48,60 segundos, después de finalizar Blender.

No se verificó visualmente esta revisión en el navegador: la apertura local fue bloqueada por la política de URL durante la revisión de Pantera y no se intentó eludir esa restricción. La revisión artística utiliza renders locales de Blender. Quedan por mejorar la suavidad de las fibras y los detalles de las texturas en primer plano; no se ha medido FPS ni memoria en teléfonos físicos.
