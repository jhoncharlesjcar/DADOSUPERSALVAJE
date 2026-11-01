# Titán del Océano — revisión individual 2

23 de octubre de 2026. Se continúa después de Pato Salvaje, respetando el orden de la galería y trabajando una mascota a la vez. Referencia: `public/mascots/oceano.webp`.

## Cambios artísticos

- Torso descubierto y esculpido como una superficie continua, con pectorales, abdominales, oblicuos y clavículas. Se retiran las placas abdominales genéricas.
- Piel azul con escamas y variación de color; brazo superior y rostro unificados mediante remallado.
- Mandíbula, pómulos, cejas óseas, ojos estrechos luminosos, branquias y crestas craneales.
- Aletas con membranas y radios en cabeza, antebrazos y pantorrillas.
- Coral ramificado e incrustaciones sobre hombreras y caderas, armadura patinada y conchas curvas con costillas en pecho, cintura y rodillas.
- Mano izquierda elevada y dado sobre la palma, manteniendo la alineación entre geometría y huesos.
- Iluminación fría específica para el dado celeste en el visor, evitando teñir el personaje de naranja.

Es una interpretación 3D estilizada. Aún difiere de la anatomía fina, la complejidad del coral y el acabado pictórico de la referencia. No incluye las olas, salpicaduras ni rayos ambientales de la ilustración. Reutiliza los cinco clips anteriores; los accesorios rígidos no tienen una simulación independiente.

## Archivos y reproducción

`revision1/` conserva modelo, GLB, metadatos y render anteriores. `tools/blender/build_oceano.py` escribe la candidata en `revision2/`, sin modificar automáticamente el archivo público. `reference_pipeline.py` contiene las utilidades de escultura, horneado, compensación de suelo y renders utilizadas por esta revisión; no cambia escenas al importarse ni regenera otras mascotas.

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_oceano.py
node tools/check-mascot.mjs --file assets/mascots3d/oceano/revision2/oceano.glb
```

El generador general `build_roster.py` preserva los modelos con revisión 2 o superior. Para comparar en la interfaz: **Mascotas → Titán del Océano → Comparar con imagen**.

## Validación

La candidata final tiene 81 206 vértices fuente, 18 huesos, cinco clips y dos atlas compartidos de 2048 px. La primera pasada tenía 99 794 vértices y un GLB de 9,06 MiB; la optimización reduce el GLB a 7,53 MiB. No se ha medido rendimiento en teléfonos físicos.

Ambas exportaciones pasaron los cinco clips, poses finitas y contacto con el suelo en cinco instantes de cada clip. La compensación de suelo de esta revisión lee los vértices por bloques con NumPy para evitar el recorrido individual en Python, conservando la corrección por fotograma. El comprobador Three.js valida el resultado exportado, pero no decodifica las texturas.

La primera revisión visual motivó reducir el relieve de la piel, oscurecer su azul y suavizar el volumen de abdominales y pómulos. El render final de reposo se revisó y la candidata se copió a `public/models/mascots/oceano.glb`, con fuente, metadatos y render en la carpeta del personaje. La URL del catálogo incorpora `?v=2` para renovar la caché.

La comprobación de tipos (`tsc --noEmit`) y ESLint del visor y del catálogo finalizaron correctamente. Pasaron las dos pruebas de catálogo y las tres del componente de celebración. El primer intento del componente agotó el tiempo al iniciar el trabajador de Vitest; la repetición aislada terminó con las tres pruebas correctas, sin cambiar las pruebas. Se inspeccionaron los tres renders finales: reposo, rostro y celebración. Los hashes del resto de modelos públicos permanecieron iguales.

No se ha verificado visualmente esta revisión en el navegador: permanece la restricción de URL encontrada en la revisión de Pantera. La revisión visual se realiza con renders locales de Blender, sin eludir esa restricción. El parecido final queda sujeto a revisión del usuario.
