# La Sombra — revisión individual 2

24 de octubre de 2026. Se continúa después de La Fantasma, siguiendo el orden de la galería y trabajando una mascota a la vez. Referencia: `public/mascots/sombra.webp`.

## Alcance

- Capucha hueca de tela con borde curvo, costuras, interior negro y ojos afilados violetas. Se eliminan el rostro y el cuello expuestos de la base.
- Cuello envuelto en pliegues, mangas arrugadas y silueta esbelta.
- Coraza curva de acero negro, hombreras laminadas, brazales, cinturón, faldones laterales, rodilleras y grebas con ribetes finos.
- Sigilos originales de emisión violeta, broches circulares y bordados sobre el tabardo.
- Manto perforado y faldas con pliegues y bordes irregulares.
- Dedos articulados con garras, botas divididas y mano elevada sosteniendo el dado de amatista.
- Luz de borde violeta y emisión específica del personaje negro en el visor.

El resultado sigue siendo una interpretación estilizada. No reproduce la filigrana pictórica de la ilustración ni incluye el vórtice de humo o los escombros flotantes del fondo. La tela usa pesos del esqueleto compartido; no hay simulación física independiente. La pose y las proporciones conservan restricciones de ese esqueleto.

## Reproducción y archivos

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_sombra.py
node tools/check-mascot.mjs --file assets/mascots3d/sombra/revision2/sombra.glb
```

El generador escribe únicamente la candidata en `revision2/` y utiliza `reference_pipeline.py`. La candidata final se revisó y copió a `public/models/mascots/sombra.glb`, con fuente, metadatos y render principal en la carpeta del personaje. La URL incorpora `?v=2` para renovar la caché. `revision1/` conserva el GLB, fuente, metadatos y render anteriores. El generador general preserva las revisiones 2 o superiores.

Comparación disponible en **Mascotas → La Sombra → Comparar con imagen**.

## Validación

Se inspeccionaron los renders finales de reposo, celebración y primer plano. La primera revisión motivó bajar y compactar la capucha, reducir los pliegues del cuello, cubrir el frente de las hombreras y estrechar el manto. Una última corrección retrajo el plano negro interior para que no sobresaliera por la punta de la capucha.

La versión final tiene 49 786 vértices fuente, 18 huesos, dos atlas compartidos de 2048 px y un GLB de 5,05 MiB. Pasó la comprobación de los cinco clips con poses finitas y contacto con el suelo en cinco instantes por clip. El archivo público coincide por SHA-256 con la candidata validada (`F6174262404E52D4859327D691EA91DF0185451306D23ECEA048314FD161FED4`); los otros nueve modelos conservaron sus hashes.

La comprobación de tipos y ESLint del visor y el catálogo terminaron correctamente. Pasaron las cinco pruebas de `tests/mascots.test.ts` (dos) y `tests/mascot-celebration.test.tsx` (tres). La primera ejecución en sandbox quedó bloqueada al renombrar un archivo temporal; fuera del sandbox, el componente de celebración agotó el tiempo de arranque mientras Blender renderizaba. Su repetición después de finalizar Blender pasó en 25,30 segundos, sin errores.

No se verificó visualmente esta revisión en el navegador: la apertura local fue bloqueada por la política de URL durante la revisión de Pantera y no se intentó eludir esa restricción. La revisión artística utiliza renders locales de Blender. No se ha medido FPS ni memoria en teléfonos físicos.
