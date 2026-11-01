# Pato Salvaje — revisión individual 2

23 de octubre de 2026. El usuario aprobó Pantera como base y pidió continuar en el orden de la galería, una mascota a la vez. El siguiente personaje es Pato Salvaje (amarillo).

## Referencia y cambios

Referencia: `public/mascots/pato.webp`. Se trabaja el parecido mediante geometría original en Blender; no es una reconstrucción automática ni un acabado fotorrealista.

- Proporciones más compactas, manteniendo una cabeza relativamente grande.
- Pico ancho con curvatura, mandíbula separada, cavidad bucal y orificios nasales; ojos ámbar con pupilas y cejas inclinadas.
- Plumas superpuestas en mejillas, frente y muslos. Hombreras con plumas planas, nervaduras y relieves, sustituyendo las púas cónicas anteriores.
- Corona con puntas alternadas, anillos y gemas oscuras.
- Coraza de bronce y oro envejecido, esmalte amarillo, remaches y filigranas.
- Patas con escamas, dedos y membranas palmeadas; capa oscura con pliegues y bordado geométrico.
- Texturas compartidas de color y normales de 2048 px, horneadas para conservar los materiales al exportar a glTF.

Los cinco clips usan el esqueleto anterior, adaptado a las proporciones nuevas. La capa sigue siendo geometría ligada al cuerpo, sin simulación de tela. El plumaje, los grabados y el rostro conservan un acabado estilizado; todavía difieren de la ilustración. No se han añadido los rayos y llamas ambientales de la referencia.

## Reproducir y revisar

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_pato.py
node tools/check-mascot.mjs --file assets/mascots3d/pato/revision2/pato.glb
```

El generador escribe únicamente en `revision2/`. La candidata final fue revisada y copiada a `public/models/mascots/pato.glb`; su fuente, metadatos y render principal también se copiaron a la carpeta de Pato. `revision1/` conserva la versión anterior. El generador general `build_roster.py` preserva cualquier mascota cuyo `model.json` indique revisión 2 o superior.

La exportación final tiene 65 320 vértices fuente, 18 huesos, cinco clips, dos texturas compartidas y un tamaño de aproximadamente 6,64 MiB. El catálogo usa `pato.glb?v=2` para renovar la caché. Su peso y rendimiento siguen pendientes de medición en teléfonos físicos.

La revisión se puede comparar con la ilustración desde `/mascotas`, seleccionando **Pato Salvaje → Comparar con imagen**.

## Estado de validación

- Blender terminó la generación, el horneado y los tres renders (`preview.png`, `detail.png`, `celebrate.png`). Se inspeccionaron visualmente reposo, rostro y celebración. En la segunda pasada se redujo la corona, se estrecharon los ojos y se añadieron plumas al cuello y brazos.
- `tools/check-mascot.mjs --file assets/mascots3d/pato/revision2/pato.glb`: cinco clips presentes, poses finitas y contacto con el suelo en cinco instantes de cada clip. Este comprobador no decodifica texturas.
- Cinco pruebas aprobadas en `tests/mascots.test.ts` y `tests/mascot-celebration.test.tsx`. Vitest requirió ejecutarse fuera del entorno restringido por un error EPERM al renombrar temporales.
- Comprobación de tipos (`tsc --noEmit`) y ESLint del catálogo correctos. No se repitió la compilación de producción: esta revisión modifica el modelo, su generador y los datos del catálogo, sin cambios de componentes o rutas.
- La comprobación visual de esta revisión se hizo mediante renders locales de Blender. No se verificó el nuevo acabado en el navegador: permanece la restricción de URL detectada durante la revisión anterior y no se intentó eludirla.

La revisión artística del usuario queda pendiente. Todavía hay diferencias visibles en el rostro, la distribución del plumaje y la forma de la corona respecto a la ilustración. Las hombreras y articulaciones conservan rigidez en ciertas poses.
