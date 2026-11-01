# Emperador del Viento — revisión individual 2

24 de octubre de 2026. Se continúa después de El Rey Salvaje, siguiendo el orden de la galería y trabajando una mascota a la vez. Referencia: `public/mascots/emperador_viento.webp`.

## Alcance

- Cráneo de águila esculpido, pico oscuro ganchudo, cera ocre, orificios nasales, iris carmesí y cejas pronunciadas.
- Plumas geométricas curvas y superpuestas en cabeza, cuello y brazos, con raquis y detalles de barbas en las plumas faciales.
- Coraza guinda curva, hombreras laminadas, brazales, cinturón, faldones y grebas con filigrana en espiral.
- Sellos de viento sobre el pecho, los broches y la hebilla.
- Capa perforada con pliegues y bordes irregulares, y tabardo bordado.
- Manos y pies escamosos con garras, dado sobre la palma elevada y cetro con una pequeña águila de alas abiertas.
- Luz de borde rosada y emisión específica del personaje guinda en el visor.

El resultado es una interpretación estilizada. La filigrana y las plumas no alcanzan el detalle pictórico de la ilustración. Las plumas y el cetro siguen los huesos del esqueleto compartido; la capa usa pesos de pecho y cadera, sin simulación física. No se incluye el vórtice de viento ni las cartas o el escenario del fondo.

## Reproducción y archivos

```powershell
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python tools/blender/build_emperador_viento.py
node tools/check-mascot.mjs --file assets/mascots3d/emperador_viento/revision2/emperador_viento.glb
```

El generador escribe únicamente la candidata en `revision2/` mediante `reference_pipeline.py`. La candidata revisada se copió a `public/models/mascots/emperador_viento.glb`, con fuente, metadatos y render principal en la carpeta del personaje. La URL del catálogo incorpora `?v=2` para renovar la caché. `revision1/` conserva el GLB, fuente, metadatos y render anteriores. El generador general preserva las revisiones 2 o superiores.

Comparación disponible en **Mascotas → Emperador del Viento → Comparar con imagen**.

## Validación

Se inspeccionaron los renders finales de reposo, celebración y primer plano. La primera revisión motivó desplazar el plumaje lateral hacia fuera, añadir plumas de coronilla, afinar los iris y girar la cabeza para mostrar el perfil. La frente mantiene zonas lisas y la transición entre plumas requiere más detalle artístico. El cetro sigue la rotación de la mano en celebración: su remate queda detrás del hombro en esa pose.

Se añadieron parámetros opcionales de encuadre de celebración a `reference_pipeline.py`, sin cambiar los valores por defecto de las otras mascotas. El render de Emperador utiliza una vista más amplia para mostrar completo el extremo elevado del cetro.

La candidata final tiene 70 151 vértices fuente, 18 huesos, dos atlas compartidos de 2048 px y un GLB de 6,90 MiB. Pasó la comprobación de los cinco clips con poses finitas y contacto con el suelo en cinco instantes por clip. El archivo público coincide por SHA-256 con la candidata validada (`A38494C21655F026AA47ED1D019261CF0D8F16654009B0D8644ED77BC54060C1`); los otros nueve modelos conservaron sus hashes al integrar esta revisión.

La comprobación de tipos y ESLint del visor y el catálogo terminaron correctamente. Pasaron las cinco pruebas de `tests/mascots.test.ts` y `tests/mascot-celebration.test.tsx` en 74,77 segundos. Se repitió la ejecución porque la sesión anterior dejó de estar disponible antes de recuperar su resultado.

No se verificó visualmente esta revisión en el navegador: la apertura local fue bloqueada por la política de URL durante la revisión de Pantera y no se intentó eludir esa restricción. La revisión artística utiliza renders locales de Blender. No se ha medido FPS ni memoria en teléfonos físicos.
