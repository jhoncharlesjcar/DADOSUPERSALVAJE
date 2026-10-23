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

El generador escribe únicamente en `revision2/`. La integración en `public/models/mascots/pato.glb` es un paso separado tras revisar los renders y validar los clips. `revision1/` conserva la versión anterior. El generador general `build_roster.py` preserva cualquier mascota cuyo `model.json` indique revisión 2 o superior.

La revisión se puede comparar con la ilustración desde `/mascotas`, seleccionando **Pato Salvaje → Comparar con imagen**.

## Estado de validación

Pendiente de terminar la exportación y revisar los renders de esta ejecución.
