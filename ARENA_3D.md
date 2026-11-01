# Arena 3D y colección de mascotas

## Seguimiento de la auditoría gráfica — 27 de octubre de 2026

La intervención actual aborda los once hallazgos de [la auditoría gráfica](AUDITORIA_GRAFICA_2026-10-25.md#seguimiento-de-correcciones--27-de-octubre-de-2026). Las secciones fechadas anteriores se conservan como historial, no como verificación de cambios posteriores.

La arena utiliza 21 tomas físicas validadas para grupos de 2–10 dados. Duran 14,5 s desde la primera salida (17,65 s con vaso y cámara), con 3,0187–16,0553 giros por dado y 2–69 contactos por toma en la sonda. Cada dado mantiene movimiento después de t=10 global; no significa diez segundos desde su propia salida ni choques continuos. La cámara cubre la trayectoria completa y se acerca al terminar. Pausas y pestañas ocultas no consumen tiempo; cambiar calidad conserva escena y reloj. Pasaron 22 pruebas y 84 proyecciones numéricas. [Métricas y límites](tools/arena-fix-results.md).

La ilustración de celebración ya permanece visible mientras descarga el módulo del visor y hasta que el modelo esté listo; se recupera si el visor falla. Pasaron los cinco casos de `tests/mascot-celebration.test.tsx`, con visor simulado. El selector de mascotas ofrece calidad automática, ligera y completa: automática utiliza el GLB ligero con viewport de hasta 700 px o puntero grueso; ligera limita DPR a 1 y omite bloom, mientras completa conserva el límite de 1,75. La selección de calidad de mascotas es independiente de la arena.

Las diez variantes ligeras están integradas: reducen aproximadamente un 70 % los triángulos y entre 55,4 y 60,2 % los bytes. Las cincuenta animaciones pasaron 250 muestras de suelo y límites finitos; se conservan esqueletos y duraciones. Datos y reproducción en [el informe de variantes ligeras](assets/mascots3d/lite/README.md). Poseidón revisión 3 ya está integrado, con rostro continuo, cuello más corto, barba curva y placas corregidas; se inspeccionaron reposo, celebración, detalle y render de su GLB ligero. La revisión artística no supone que el conjunto reproduzca las ilustraciones: siguen pendientes el parecido final, la melena del Rey y el neón de Pantera. Los renders de Blender y las pruebas numéricas no sustituyen la revisión en el visor.

La interfaz incluye etiquetas adaptables, filas de derrota legibles, diálogo nativo de ascenso con recuperación de foco y scroll limitado por altura de pantalla, movimiento reducido en wrappers y ranking aplicado al grid item correcto. Los nombres de personajes provienen del catálogo común. Pasaron cuatro pruebas de resultados/diálogo, tres de activos y cinco de respaldo de celebración; la validación conjunta se registra en la auditoría.

La validación visual de esta intervención en navegador está pendiente por el bloqueo de la política de URL local de la sesión anterior. No se han medido FPS, memoria ni descarga real en móviles. Los resultados de navegador descritos en las secciones históricas corresponden a sus fechas, no a esta continuación.

**Cierre técnico:** 68 pruebas aprobadas en 14 archivos, TypeScript y ESLint de cambios correctos. Compilación de producción con Webpack aprobada. El script `build` ahora incluye `--webpack`: Turbopack falló al iniciar su subproceso de CSS en este entorno, también fuera del sandbox; la alternativa oficial compiló las rutas correctamente.

## Implementación

- Three.js para renderizar y Cannon ES para contactos entre dados, mesa y borde. Ambas dependencias usan licencia MIT.
- Mesa de paño, borde de cuero, detalles metálicos, cubilete hueco y dados de seis caras con relieve, barniz y colores asociados al jugador.
- Entrada, agitación y vuelco del cubilete; salida escalonada, rebotes, reposo y acercamiento de cámara. El movimiento del cubilete es coreografiado: su interior no se simula físicamente.
- Calidad ligera/equilibrada/alta, sonido opcional, pausa, omisión, repetición y alternativa de resultados cuando WebGL falla. Se respeta la preferencia de movimiento reducido.
- La misma reproducción se utiliza en `/manual` y en nuevas partidas de `/play/[salaId]`. Las partidas online antiguas sin historial de tiradas muestran su resultado guardado sin inventar rondas.
- `/arena` contiene demostraciones fijas de dos jugadores, diez jugadores y desempate. No realiza solicitudes de cobro ni modifica saldos.

## Resultado y reproducción

`resolveArena` obtiene los valores mediante `crypto.randomInt` en el servidor. Solo los líderes empatados participan en la siguiente ronda. El ganador está identificado explícitamente; comparar las últimas tiradas de jugadores eliminados en rondas distintas produciría un ganador incorrecto.

`manual_rolls` conserva una resolución por identificador. Preparar otra vez el mismo identificador devuelve las mismas rondas. La liquidación toma participantes, ganador y monto de los registros del servidor, y es idempotente. La interfaz espera su confirmación antes de mostrar el premio. Los cobros también comprueban que un identificador repetido conserve participantes y monto.

La trayectoria física se precalcula con una semilla estable. Se descartan tomas apiladas o inestables antes de mostrarlas. Una simetría constante del cubo asigna las caras al resultado confirmado durante **toda** la trayectoria, evitando girar el dado artificialmente al final. La física presenta el resultado; no decide el premio. Repetir la escena no solicita nuevos valores.

Las salas online guardan `replay_json`; la API pública sustituye los DNI por asientos de la sala. La migración de SQLite es aditiva y conserva registros anteriores.

## Validación

Las siguientes comprobaciones corresponden a la primera etapa de la arena, anterior al ajuste de ritmo y al prototipo de mascota:

- Pruebas de resolución, exclusión de eliminados, determinismo de trayectorias, reposo y caras superiores para 2 y 10 dados.
- Pruebas con bases temporales de preparación, cobro repetido, cambio de participantes/monto, ganador adulterado y liquidación repetida; persistencia de rondas online.
- Comprobación de tipos y compilación de producción.
- Revisión visual de duelo, batalla y desempate; pausa, omisión e historial; disposición móvil a 390 × 844.

El script de compilación invoca Node explícitamente: el lanzador local de paquetes cerraba prematuramente el proceso CSS de Turbopack. ESLint de los archivos de esta etapa pasa. El lint global conserva incidencias previas en `CinematicIntro.tsx`, `app/page.tsx` y `app/lobby/page.tsx`.

## Ajuste de ritmo — implementado (22 de octubre de 2026)

La reproducción dura **12 segundos desde la primera salida del cubilete hasta el reposo**, dentro del intervalo solicitado de 10–15 segundos. El impulso angular inicial es mayor y los contactos entre dados, mesa y borde siguen calculándose con Cannon ES. La entrada y agitación del cubilete, las pausas del usuario y los desempates aumentan el tiempo total de la partida.

La duración se consigue mediante un remapeo cinematográfico del tiempo de la trayectoria simulada, con una cola de reposo de 0,6 segundos. No equivale a 12 segundos de simulación física en tiempo real ni añade una espera estática de esa duración. Salidas escalonadas, audio de impactos y cámara utilizan la misma escala temporal.

Antes de reproducir se rechazan tomas fuera de la mesa, apiladas, inestables, sin contactos entre dados o con menos de 2,5 vueltas acumuladas por dado. Se permiten hasta ocho intentos; si no se prepara una toma válida, la interfaz conserva la alternativa de resultados. La duración y selección de trayectorias no cambian las probabilidades, las rondas guardadas ni el premio. Pausa y omisión siguen disponibles.

**Validación de esta continuación:** pasaron las cinco pruebas de `tests/arena.test.ts`, incluyendo doce semillas para dos dados y doce para diez dados (24 escenas). Cubren resolución, duración, movimiento hasta cerca del final, contactos, varias rotaciones, caras superiores, reposo y determinismo. El 22 de octubre de 2026 se confirmó además la suite completa (39 pruebas en 9 archivos), `tsc --noEmit` sin errores y la compilación de producción.

## Personajes — colección inicial y celebración del ganador

La colección contiene **diez modelos GLB**, todos con 18 huesos y cinco clips: `Idle`, `Celebrate`, `Throw`, `Hit` y `Knockout`. `lib/mascots.ts` relaciona el color del dado, el nombre, la ilustración y el modelo de cada mascota.

| Dado | Mascota | Identificador de archivo |
|---|---|---|
| Rojo | Demonio Salvaje | `demonio` |
| Rosado | Pantera Rosada | `pantera` |
| Amarillo | Pato Salvaje | `pato` |
| Celeste | Titán del Océano | `oceano` |
| Blanco | La Fantasma | `fantasma` |
| Negro | La Sombra | `sombra` |
| Verde | El Rey Salvaje | `rey_salvaje` |
| Guinda | Emperador del Viento | `emperador_viento` |
| Naranja | Bestia de Fuego | `bestia_fuego` |
| Azul | Poseidón | `poseidon` |

Son modelos estilizados iniciales para revisión. Demonio Salvaje conserva el trabajo previo y tiene mayor detalle y texturas que los nueve modelos añadidos. La colección todavía necesita pulido artístico y revisión conjunta de proporciones, accesorios y animaciones.

`MascotCelebration` está integrado en `GameResults`, `WinnerReveal` y la sala online `/play/[salaId]`, después del resultado confirmado o de su reproducción. Muestra la mascota asociada al dado ganador: reproduce `Celebrate`, pasa a `Idle` y detiene la actualización de la animación al acumular 12 segundos de reproducción. Incluye pausa; la preferencia de movimiento reducido muestra la ilustración. También se conserva la ilustración cuando WebGL o la carga del modelo fallan.

El visor `/mascotas` permite elegir entre las diez mascotas, girar y acercar la cámara, seleccionar los cinco clips, pausar y restablecer la vista. Su modo «Ver celebración de partida» permite revisar el mismo componente utilizado en resultados. **La integración actual abarca la celebración del ganador.** La existencia de clips `Throw`, `Hit` y `Knockout` no significa que estén integrados lanzamientos de objetos, enfrentamientos entre personajes ni secuencias de KO en partidas.

### Revisión individual de Pantera — 23 de octubre de 2026

Por indicación del usuario, el pulido hacia las ilustraciones se realiza primero sobre **Pantera Rosada**. La revisión 2 sustituye su armadura genérica por un abrigo entallado y rehace rostro, orejas, pelaje con manchas, cola, manos, botas y detalles de neón. Incluye dos atlas de 2048 px, 71 044 vértices fuente y un GLB de unos 5,78 MiB. Conserva los cinco clips y 18 huesos. Las demás mascotas no se regeneraron en esta revisión.

`/mascotas` incorpora **Comparar con imagen**, con la ilustración original al lado del modelo. Los renders y el alcance artístico están documentados en [la revisión de Pantera](assets/mascots3d/pantera/REVISION.md). El usuario aprobó esta Pantera como base para continuar, sin considerar alcanzada la fidelidad final de la ilustración. `revision1/` conserva su versión anterior; `build_pantera.py` genera la nueva candidata y `build_roster.py` la preserva cuando detecta la revisión 2.

### Revisión individual de Pato — 23 de octubre de 2026

Tras aprobar Pantera como base, el usuario pidió continuar **en el orden de la galería, una mascota a la vez**. Sigue Pato Salvaje (amarillo); después corresponde Titán del Océano (celeste). No se regeneró el resto de la colección.

El generador individual `tools/blender/build_pato.py` rehace proporciones, pico, ojos, plumaje en capas, hombreras de plumas, corona, armadura con filigranas, capa oscura y patas palmeadas. Exporta una candidata animada con dos atlas de 2048 px. Los renders, límites del parecido y validación se detallan en [la revisión de Pato](assets/mascots3d/pato/REVISION.md). Se conserva `revision1/` como respaldo y el generador general preserva todas las mascotas con revisión 2 o superior.

### Revisión individual del Titán del Océano — 23 de octubre de 2026

Al pedir continuar después de presentar Pato, se trabaja únicamente Titán del Océano (celeste). Se rehacen torso y rostro con superficies continuas, escamas, branquias, aletas con membranas, coral ramificado, conchas curvas y armadura marina. La mano que ofrece el dado queda elevada. El visor usa una iluminación fría específica para este personaje.

`tools/blender/build_oceano.py` genera la candidata y sus renders; `reference_pipeline.py` reúne las utilidades de escultura, horneado y revisión sin regenerar otros personajes. Se conserva la base anterior en `assets/mascots3d/oceano/revision1/`. El alcance y los resultados están en [la revisión del Titán](assets/mascots3d/oceano/REVISION.md). El siguiente personaje en el orden de la galería es La Fantasma (blanco).

### Revisión individual de La Fantasma — 23 de octubre de 2026

El siguiente pedido de continuar se aplica exclusivamente a La Fantasma (blanco). Se rehacen el yelmo curvo con visor negro, la silueta esbelta, la armadura plateada, los sigilos luminosos, la cadena del pecho y la capa perforada. Se añaden velos laterales parcialmente transparentes e iluminación fría específica en el visor.

`tools/blender/build_fantasma.py` genera la candidata y los tres renders mediante las utilidades existentes de `reference_pipeline.py`. El respaldo anterior está en `assets/mascots3d/fantasma/revision1/`. El alcance, las limitaciones de la tela y el estado de validación están en [la revisión de La Fantasma](assets/mascots3d/fantasma/REVISION.md). Después corresponde La Sombra (negro).

### Revisión individual de La Sombra — 24 de octubre de 2026

El siguiente pedido de continuar se aplica exclusivamente a La Sombra (negro). La revisión rehace la capucha hueca con ojos violetas y rostro oculto, el cuello de tela, las placas negras superpuestas, los sigilos, las garras y el manto perforado. Se ajusta el visor con iluminación fría y borde violeta.

`tools/blender/build_sombra.py` genera únicamente la candidata y tres renders mediante `reference_pipeline.py`. El respaldo anterior está en `assets/mascots3d/sombra/revision1/`. El alcance y el estado de validación están en [la revisión de La Sombra](assets/mascots3d/sombra/REVISION.md). Es una interpretación estilizada, sin simulación de tela ni vórtice de humo. Después corresponde El Rey Salvaje (verde).

### Revisión individual de El Rey Salvaje — 24 de octubre de 2026

El siguiente pedido de continuar se aplica exclusivamente a El Rey Salvaje (verde). Se rehacen el cráneo y hocico de león, la melena con hebras geométricas, la corona de esmeraldas y metal patinado, la armadura facetada y las enredaderas. Se añaden patas con dedos y garras y una cola curva con borla. El visor usa iluminación de borde verde.

`tools/blender/build_rey_salvaje.py` genera únicamente la candidata y sus tres renders mediante `reference_pipeline.py`. Se conserva la base en `assets/mascots3d/rey_salvaje/revision1/`. El alcance, las limitaciones del pelaje y la validación están en [la revisión de El Rey Salvaje](assets/mascots3d/rey_salvaje/REVISION.md). Después corresponde Emperador del Viento (guinda).

### Revisión individual de Emperador del Viento — 24 de octubre de 2026

La revisión continúa exclusivamente con Emperador del Viento (guinda). Se rehacen la cabeza de águila, el pico curvo y el plumaje, y se añaden coraza curva con espirales, sellos de viento, capa perforada y un cetro con águila de alas abiertas. El visor utiliza luz de borde rosada.

`tools/blender/build_emperador_viento.py` genera únicamente la candidata y sus tres renders mediante `reference_pipeline.py`. Se conserva la base en `assets/mascots3d/emperador_viento/revision1/`. El alcance y la validación están en [la revisión de Emperador del Viento](assets/mascots3d/emperador_viento/REVISION.md). Después corresponde Bestia de Fuego (naranja).

### Revisión individual de Bestia de Fuego — 24 de octubre de 2026

La revisión continúa exclusivamente con Bestia de Fuego (naranja). Se rehacen el hocico de zorro, las orejas altas, las mejillas blancas y la cola curva con punta marfil. Se añaden armadura de cobre, grabados de llama, surcos incandescentes y fuego mediante cintas emisivas. Estas llamas siguen los huesos y no constituyen una simulación de combustión.

`tools/blender/build_bestia_fuego.py` genera únicamente la candidata y sus tres renders mediante `reference_pipeline.py`. Se conserva la base en `assets/mascots3d/bestia_fuego/revision1/`. El alcance y la validación están en [la revisión de Bestia de Fuego](assets/mascots3d/bestia_fuego/REVISION.md). Después corresponde Poseidón (azul).

La revisión 2 está integrada: GLB de 7,75 MiB, 78 235 vértices fuente, 18 huesos, cinco clips y dos atlas de 2048 px. Pasaron la validación de animaciones y suelo, TypeScript, ESLint y las cinco pruebas de mascotas. Se inspeccionaron tres renders de Blender; la comprobación visual en navegador sigue pendiente. El pelaje y el fuego siguen siendo estilizados.

### Revisión individual de Poseidón — 25 de octubre de 2026

La revisión continúa con Poseidón (azul), el último de los nueve modelos iniciales que se están revisando individualmente. Se rehacen rostro humano, barba, cabello y casco con aletas, y se añaden coraza azul curva, placas abdominales, grabados marinos, brazos musculosos, capa plisada y tridente ornamentado en ambos extremos. El visor utiliza iluminación fría y borde azul.

`tools/blender/build_poseidon.py` escribe la candidata en `assets/mascots3d/poseidon/revision2/`; `revision1/` conserva la versión anterior. El alcance y la validación están en [la revisión de Poseidón](assets/mascots3d/poseidon/REVISION.md). El parecido sigue siendo estilizado; la revisión individual no equivale a aprobación artística final del conjunto.

La revisión 2 está integrada: 83 240 vértices fuente, 18 huesos, cinco clips, dos atlas de 2048 px y GLB de 7,78 MiB. Pasaron la validación de animaciones y suelo, TypeScript, ESLint y las cinco pruebas de mascotas. Se revisaron tres renders; falta comprobar esta revisión visualmente en navegador. Los otros nueve GLB conservaron sus hashes. Con Poseidón termina la primera pasada individual del orden acordado y queda pendiente el pulido artístico del conjunto.

### Demonio Salvaje

Existe un **Demonio Salvaje 3D estilizado**, basado en la referencia actual. Tiene 15 052 vértices en la malla del cuerpo, 18 huesos y cinco clips: `Idle`, `Celebrate`, `Throw`, `Hit` y `Knockout`. Su GLB ocupa aproximadamente 3,3 MB.

**Pulido del 22 de octubre de 2026:**

- **Piel de roca con grietas de lava.** Torso descubierto con pectorales y abdominales. Las grietas se generan con un sombreador Voronoi y se hornean en tres texturas de 2048 px: color, emisión y normales. Se exportan en WebP porque glTF no admite nodos procedurales.
- **Runas incandescentes** en relieve: cinturón R·P·K (como en la referencia), brazales, hombreras, grebas y faldón.
- **Maza de fuego** en `hand.R`: mango envuelto con anillos de bronce, cabeza de roca facetada sobre un núcleo de lava, púas con punta incandescente y llamas.
- **Dado en llamas** en `hand.L`: el antebrazo izquierdo ahora se adelanta con la palma hacia arriba. El dado rojo muestra el 6 al frente, sus caras opuestas suman 7 y las garras lo sostienen por debajo sin tapar los puntos. En `Celebrate` el dado se alza hacia la cámara.
- Maza, dado y llamas se exportan como nodos `Maza`, `Llamas_Maza`, `Dado` y `Llamas_Dado`, hijos de los huesos de las manos. El visor añade a cada llama una luz que parpadea, con escala variable y *bloom*; con movimiento reducido las llamas quedan fijas. La compensación de contacto con el suelo incluye estos accesorios.

Queda pendiente reducir el peso del GLB si se mide un impacto en la carga móvil. Sus accesorios y clips no constituyen combate 3D implementado.

Archivos generados:

| Archivo | Uso |
|---|---|
| `assets/mascots3d/demonio/demonio.blend` | Modelo y escena editables en Blender |
| `assets/mascots3d/demonio/preview.png` | Render de revisión del personaje |
| `assets/mascots3d/demonio/celebrate.png` | Render de revisión de celebración |
| `assets/mascots3d/demonio/detail.png` | Primer plano del dado en llamas |
| `public/models/mascots/demonio.glb` | Modelo animado utilizado por el visor web |
| `assets/mascots3d/<slug>/model.blend` | Escena editable de cada una de las otras nueve mascotas |
| `assets/mascots3d/<slug>/model.json` | Nombre, referencia, vértices, huesos y clips de cada modelo nuevo |
| `assets/mascots3d/<slug>/preview.png` | Render de revisión de cada modelo nuevo |
| `public/models/mascots/<slug>.glb` | Exportaciones animadas del catálogo de diez mascotas |

**Blender 4.5.9 LTS ya está instalado** en formato portátil dentro de `.tools/blender/blender-4.5.9-windows-x64/`. Se comprobó la versión ejecutable y se comparó el SHA-256 del ZIP descargado con el manifiesto oficial.

Desde la raíz del proyecto, en PowerShell:

```powershell
# Comprobar la instalación
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --version

# Abrir Blender
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe'

# Regenerar modelo, GLB y renders; reemplaza las salidas anteriores del prototipo
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup --python '.\tools\blender\build_demonio.py'

# Regenerar bases sin revisión individual; preserva Demonio y mascotas con revisión >= 2
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup --python '.\tools\blender\build_roster.py'

# Generar la candidata individual de Pato (no copia automáticamente al GLB público)
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup -t 6 --python '.\tools\blender\build_pato.py'

# Comprobar las diez exportaciones con Three.js; sin --all comprueba solo Demonio
node '.\tools\check-mascot.mjs' --all
```

`tools/blender/build_demonio.py` genera geometría procedural original tomando la imagen como referencia artística; no reconstruye automáticamente esa imagen. La regeneración incluye el horneado y tres renders. `tools/blender/build_roster.py` genera las bases de las otras mascotas sin modificar Demonio ni las revisiones individuales 2 o superiores.

`tools/check-mascot.mjs --all` exige diez GLB y los cinco clips en cada uno. Quita las texturas del JSON antes de cargar la geometría en Three.js, ya que Node no decodifica imágenes; comprueba además los cuatro accesorios de Demonio y poses finitas y contacto con el suelo en cinco instantes de cada clip. No certifica la visualización de texturas, el acabado artístico ni sustituye la revisión visual de las animaciones.

**Validación de la colección y su integración (23 de octubre de 2026):** 44 pruebas aprobadas en 11 archivos, comprobación de tipos y compilación de producción correctas. ESLint pasa en los archivos de la integración. Las pruebas nuevas verifican los diez GLB, sus cinco clips y esqueletos, los identificadores desconocidos, el cambio de movimiento reducido y la ilustración alternativa ante un fallo del visor. `tools/check-mascot.mjs --all` pasó para los diez modelos, con cinco muestras por clip.

En el navegador se verificó la carga de las diez mascotas, el modo celebración, pausa/reanudación y los controles a 390 × 844. Se corrigió el exceso de emisión de los nuevos modelos y se oculta el botón de pausa al terminar los 12 segundos. No se ejecutaron cobros ni partidas con dinero para esta revisión; la integración de resultados queda respaldada por la compilación y las pruebas, y la revisión visual utiliza el mismo componente desde `/mascotas`.

Queda pendiente medir FPS y memoria en dispositivos físicos de gama baja y sustituir materiales procedurales por activos artísticos si se busca mayor fotorrealismo. Las comprobaciones visuales aquí se hicieron en el navegador de escritorio y con un viewport móvil, no en un teléfono real.
