# La Fantasma — revisión individual 2

23 de octubre de 2026. Se continúa después de Titán del Océano, siguiendo el orden de la galería y trabajando una mascota a la vez. Referencia: `public/mascots/fantasma.webp`.

## Alcance

- Silueta más estrecha, malla oscura bajo la armadura y escarpes puntiagudos.
- Yelmo curvo con bóveda, protector nasal y faldones laterales que enmarcan un visor negro; ojos blancos luminosos, sin rostro humano visible.
- Coraza curva, hombreras superpuestas, brazales, placas abdominales, rodilleras y grebas plateadas con bordes definidos.
- Sigilos angulares originales, broches y eslabones de cadena sobre el pecho.
- Capa y tabardo con pliegues, agujeros reales y tiras irregulares; velos laterales parcialmente transparentes.
- Mano elevada con el dado sobre la palma; se preservan los cinco clips del esqueleto compartido.
- Luz fría y emisión específica del personaje blanco en el visor, evitando el tinte naranja anterior.

El resultado sigue siendo una interpretación estilizada. Las telas se deforman con huesos y pesos; no existe simulación de tela ni humo volumétrico. Los escarpes evocan la silueta de la ilustración, pero el personaje conserva la compensación de suelo de las animaciones: no se ha implementado levitación. Queda por alcanzar el detalle pictórico y la transparencia envolvente de la referencia.

## Reproducción y archivos

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_fantasma.py
node tools/check-mascot.mjs --file assets/mascots3d/fantasma/revision2/fantasma.glb
```

El generador escribe únicamente la candidata en `revision2/` y utiliza las utilidades existentes de `reference_pipeline.py`. La candidata final se revisó y copió a `public/models/mascots/fantasma.glb`, con fuente, metadatos y render principal en la carpeta del personaje. La URL del catálogo incorpora `?v=2` para renovar la caché. `revision1/` conserva el GLB, fuente, metadatos y render anteriores. El generador general preserva las revisiones 2 o superiores.

Comparación disponible en **Mascotas → La Fantasma → Comparar con imagen**.

## Validación

Las dos candidatas pasaron la comprobación de cinco clips, poses finitas y contacto con el suelo en cinco instantes de cada clip. La revisión visual de la primera motivó aclarar la plata, cubrir el cuello con pliegues de tela, redondear las hombreras y reducir la opacidad de los velos. La versión final tiene 39 575 vértices fuente, 18 huesos, dos atlas compartidos de 2048 px y un GLB de 4,11 MiB.

La comprobación de tipos y ESLint del visor y el catálogo terminaron correctamente. Pasaron las cinco pruebas de `tests/mascots.test.ts` y `tests/mascot-celebration.test.tsx`. Se inspeccionaron los renders finales de reposo, celebración y primer plano. El archivo público coincide por SHA-256 con la candidata validada; los otros nueve modelos conservaron sus hashes.

No se verificó visualmente esta revisión en el navegador: la apertura local fue bloqueada por la política de URL durante la revisión de Pantera y no se intentó eludir esa restricción. La revisión artística utiliza renders locales de Blender. No se ha medido FPS ni memoria en teléfonos físicos.
