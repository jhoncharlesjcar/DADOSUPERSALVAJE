# Bestia de Fuego — revisión individual 2

24 de octubre de 2026. Se continúa después de Emperador del Viento, siguiendo el orden de la galería y trabajando una mascota a la vez. Referencia: `public/mascots/bestia_fuego.webp`.

## Alcance

- Cabeza esculpida con hocico estrecho, nariz triangular, ojos ámbar, mejillas blancas, bigotes y orejas altas con interior oscuro.
- Mechones de pelaje en mejillas, cuello, brazos y muslos; cola curva voluminosa con punta marfil y hebras geométricas.
- Coraza curva de cobre, placas abdominales, hombreras, brazales, cinturón, rodilleras y grebas con ribetes y grabados de llama.
- Surcos incandescentes y lenguas de fuego en crin, hombros, brazales, cola y dado.
- Patas con dedos y garras y mano elevada sosteniendo el dado.
- Emisión específica del personaje naranja en el visor, conservando su iluminación cálida.

Es una interpretación estilizada: el pelaje geométrico y las texturas no reproducen el detalle fotorrealista de la ilustración. Las llamas son cintas curvas emisivas, sin simulación volumétrica ni animación de combustión; se mueven con sus huesos. La cola conserva el movimiento de cadera del esqueleto compartido y no tiene física independiente. No se incluye el fuego del escenario.

## Reproducción y archivos

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_bestia_fuego.py
node tools/check-mascot.mjs --file assets/mascots3d/bestia_fuego/revision2/bestia_fuego.glb
```

El generador escribe únicamente la candidata en `revision2/` mediante `reference_pipeline.py`. `revision1/` conserva el GLB, fuente, metadatos y render anteriores. El generador general preserva las revisiones 2 o superiores cuando se promociona la candidata.

## Validación

- Revisión 2 integrada en `public/models/mascots/bestia_fuego.glb`, con fuente, metadatos y vista previa copiados al directorio principal. El catálogo solicita la revisión 2 para renovar la caché.
- 78 235 vértices fuente, 18 huesos, dos atlas de 2048 px y GLB de 7,75 MiB. Conserva `Idle`, `Celebrate`, `Throw`, `Hit` y `Knockout`.
- Dos iteraciones visuales: la segunda adelanta los interiores de las orejas, acorta los mechones del cuello y añade pelo geométrico en la frente. Se revisaron los renders de reposo, celebración y detalle facial. El cuello liso, los mechones y el fuego aún requieren pulido artístico para acercarse a la imagen.
- `check-mascot.mjs` pasó: cinco muestras por clip con límites finitos y contacto con el suelo. Esta comprobación no valida la fidelidad visual.
- TypeScript y ESLint pasaron. Vitest: cinco pruebas aprobadas en `mascots.test.ts` y `mascot-celebration.test.tsx`.
- El GLB público coincide con la candidata: SHA-256 `ECB7763BC22A9BE6015906EE1263CB3A870A7DA509191524614169D41596B4A7`. Los otros nueve GLB conservaron sus hashes anteriores.
- Pendiente la revisión de esta versión en navegador: la política de acceso bloqueó la URL local. La inspección visual se realizó con los renders de Blender.

Después corresponde Poseidón (azul), manteniendo la revisión individual.
