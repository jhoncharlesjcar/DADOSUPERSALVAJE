# Arena 3D y colección de mascotas

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

`/mascotas` incorpora **Comparar con imagen**, con la ilustración original al lado del modelo. Los renders y el alcance artístico están documentados en [la revisión de Pantera](assets/mascots3d/pantera/REVISION.md). Todavía no se considera un parecido final aprobado. `revision1/` conserva su versión anterior; `build_pantera.py` genera la nueva candidata y `build_roster.py` la preserva cuando detecta la revisión 2.

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

# Regenerar las otras nueve mascotas, preservando Demonio; reemplaza sus salidas anteriores
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup --python '.\tools\blender\build_roster.py'

# Regenerar solo una de las nueve, usando su identificador de archivo
& '.\.tools\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup --python '.\tools\blender\build_roster.py' -- pantera

# Comprobar las diez exportaciones con Three.js; sin --all comprueba solo Demonio
node '.\tools\check-mascot.mjs' --all
```

`tools/blender/build_demonio.py` genera geometría procedural original tomando la imagen como referencia artística; no reconstruye automáticamente esa imagen. La regeneración incluye el horneado y tres renders. `tools/blender/build_roster.py` genera las otras nueve mascotas sin modificar Demonio.

`tools/check-mascot.mjs --all` exige diez GLB y los cinco clips en cada uno. Quita las texturas del JSON antes de cargar la geometría en Three.js, ya que Node no decodifica imágenes; comprueba además los cuatro accesorios de Demonio y poses finitas y contacto con el suelo en cinco instantes de cada clip. No certifica la visualización de texturas, el acabado artístico ni sustituye la revisión visual de las animaciones.

**Validación de la colección y su integración (23 de octubre de 2026):** 44 pruebas aprobadas en 11 archivos, comprobación de tipos y compilación de producción correctas. ESLint pasa en los archivos de la integración. Las pruebas nuevas verifican los diez GLB, sus cinco clips y esqueletos, los identificadores desconocidos, el cambio de movimiento reducido y la ilustración alternativa ante un fallo del visor. `tools/check-mascot.mjs --all` pasó para los diez modelos, con cinco muestras por clip.

En el navegador se verificó la carga de las diez mascotas, el modo celebración, pausa/reanudación y los controles a 390 × 844. Se corrigió el exceso de emisión de los nuevos modelos y se oculta el botón de pausa al terminar los 12 segundos. No se ejecutaron cobros ni partidas con dinero para esta revisión; la integración de resultados queda respaldada por la compilación y las pruebas, y la revisión visual utiliza el mismo componente desde `/mascotas`.

Queda pendiente medir FPS y memoria en dispositivos físicos de gama baja y sustituir materiales procedurales por activos artísticos si se busca mayor fotorrealismo. Las comprobaciones visuales aquí se hicieron en el navegador de escritorio y con un viewport móvil, no en un teléfono real.
