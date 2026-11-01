# Auditoría gráfica de Dado Salvaje

25 de octubre de 2026 · Revisión conjunta de arte 3D, arena/dados e interfaz.

## Dictamen

La base gráfica es funcional y contiene mecanismos de recuperación, pero todavía corresponde a un prototipo visual avanzado. No alcanza el acabado ni la fidelidad de las ilustraciones de referencia. Antes de ampliar detalles de las mascotas, conviene corregir encuadre, reloj de reproducción y legibilidad. Que un GLB cargue y sus animaciones pasen pruebas no acredita calidad artística, rendimiento móvil ni ausencia de recortes.

La auditoría inicial del 25 de octubre no modificó la implementación del juego ni los modelos: añadió este informe y una sonda numérica reproducible. El pulido adicional de Poseidón quedó pausado entonces antes de editar su generador. Los hallazgos y cifras siguientes conservan esa línea base; las correcciones posteriores se registran al final, sin presentar las verificaciones iniciales como evidencia del estado nuevo.

## Alcance y evidencia

- Inspección de código de las rutas de portada, manual, sala online, arena y galería, junto con componentes de resultados y estilos.
- Revisión visual de renders guardados, especialmente Pantera, Rey Salvaje y Poseidón; también se utilizaron las revisiones de Bestia de Fuego y Emperador examinadas durante esta sesión. Comparación directa entre el detalle de Poseidón y su ilustración.
- Inventario de los diez GLB públicos: tamaño, geometría exportada, materiales y texturas.
- `node tools/check-mascot.mjs --all`: aprobado para los diez modelos, cinco clips por modelo y cinco muestras por clip: 250 poses evaluadas con límites finitos y contacto con el suelo. La herramienta elimina texturas para cargar en Node; no evalúa su apariencia.
- `node tools/audit-arena-graphics.cjs`: seis tiradas deterministas, dos proporciones de cámara por tirada, doce escenarios. Calcula movimiento individual y proyección geométrica sin navegador.
- No se accedió al navegador local: hubo un bloqueo explícito de la política de URL durante la sesión. No se intentaron rutas alternativas. No se midieron FPS, consumo GPU, contraste renderizado ni tiempos de descarga reales.
- Las cinco pruebas de integración de mascotas y los controles de TypeScript/ESLint aprobaron en la intervención anterior. No se presentan como pruebas visuales de esta auditoría.

## Correcciones prioritarias de la arena

### G01 · Alta · Dados fuera del encuadre durante la tirada

**Confirmado por código y proyección numérica.** `lib/arena/scene.ts:136` obtiene los límites a partir de las posiciones finales. En las líneas 156–161 empieza un acercamiento hacia esos límites mientras los dados todavía ruedan. Los ocho vértices del cubo se proyectaron con la misma cámara de 40° y las mismas fórmulas de la escena.

Se detectó recorte en cinco de doce escenarios, no una tasa estimada para todas las partidas:

| Semilla | Aspecto ancho/alto | Primer recorte desde inicio del vuelo | Máximo proyectado |
|---|---:|---:|---:|
| physics-2-0 | 1,8 | 4,10 s | 1,258 |
| physics-2-1 | 0,8 | 3,85 s | 1,351 |
| physics-2-2 | 0,8 | 5,00 s | 1,022 |
| physics-2-2 | 1,8 | 3,70 s | 1,203 |
| physics-10-2 | 0,8 | 8,60 s | 1,050 |

El límite visible de la proyección es 1. La sonda utiliza esquinas del cubo envolvente; la geometría real tiene esquinas redondeadas. Los excesos amplios son evidencia clara del problema; los marginales deben verificarse visualmente.

**Corrección:** encuadrar los cuerpos activos o la trayectoria restante y reservar el acercamiento final para el reposo. **Aceptación:** ningún dado liberado sale del encuadre en las semillas revisadas, con margen visible, y validación adicional en móvil vertical/horizontal.

### G02 · Alta · Doce segundos globales no equivalen a doce segundos de movimiento por dado

**Confirmado por código y sonda.** `lib/arena/physics.ts:74` mantiene un único `lastMovingTime`. Las líneas 119–140 estiran la trayectoria a 12 s. El criterio de aceptación de la línea 97 exige más de cero contactos entre dados y al menos 2,5 vueltas por cuerpo, pero no movimiento sostenido de cada uno ni distribución temporal de los choques.

| Semilla | Último movimiento detectable por dado | Contactos entre dados | Vueltas |
|---|---|---:|---|
| physics-2-0 | 7,38 / 11,42 s | 1 | 3,58 / 4,28 |
| physics-2-1 | 5,63 / 11,40 s | 2 | 3,54 / 5,97 |

En `physics-10-2`, algunos dados dejan de moverse a los 5,65 y 6,80 s. La medición considera movimiento si el cambio angular supera 0,003 rad o el desplazamiento supera 0,001 unidades por muestra; mide último movimiento detectable, no tiempo continuo de movimiento.

**Impacto:** el requisito de giros y choques visibles durante 10–15 s está cumplido solo parcialmente. Estirar el reloj no crea contactos físicos nuevos.

**Corrección:** establecer aceptación por dado y por distribución de contactos; ajustar impulso, fricción, amortiguación y geometría de la salida antes de recurrir a cámara lenta. **Aceptación propuesta:** franja activa de 10–15 s con varios giros completos por dado, encuentros repartidos durante la fase activa y frenado progresivo. Validar el ritmo visual, evitando exigir choques constantes artificiales.

### G03 · Alta · El reloj ralentiza la tirada cuando cae el FPS

**Confirmado por cálculo del código, sin medir un dispositivo.** `app/_components/ThreeJsDiceEmbed.tsx:38` limita el incremento a 0,05 s por frame. A 10 FPS, cada 100 ms reales solo avanza 50 ms de reproducción: 12 s de vuelo pasan a aproximadamente 24 s reales. Con entrada y cola, la secuencia de 15,15 s se aproxima a 30,3 s, sin contar preparación.

**Corrección:** reloj basado en tiempo real descontando pausas y pestaña oculta; la física ya está precalculada. **Aceptación:** duración estable a 10/20/30/60 FPS simulados y reanudación sin saltos después de una pausa.

### G04 · Media · Cambiar calidad reinicia la tirada

**Confirmado por flujo de estado.** `app/_components/ArenaReplay.tsx:52` borra el estado de reposo al cambiar calidad. El efecto de `ThreeJsDiceEmbed.tsx:56` depende de `quality` y vuelve a crear el reloj desde cero.

**Corrección:** conservar trayectoria y tiempo al cambiar renderer, o actualizar resolución/sombras sin reconstruir la reproducción. **Aceptación:** cambiar de Alta a Ligera en mitad del rodamiento conserva el instante y el resultado.

## Arte 3D y rendimiento

### G05 · Alta para el objetivo artístico · Fidelidad todavía insuficiente

**Confirmado en renders, con juicio artístico.** En Poseidón la frente y las mejillas aparecen como volúmenes redondeados separados; barba y pelo forman grupos de hebras rígidas, y parte de los bordes y grabados sobresalen como alambres. En Rey Salvaje la melena se lee como placas, con pocos cambios de volumen fino. En Pantera, varios ribetes de neón dominan sobre las formas del abrigo. Los materiales y las proporciones aún producen un acabado de figura estilizada, mientras las referencias presentan anatomía, pelo, metal y tela mucho más naturales.

Evidencias principales: `assets/mascots3d/poseidon/revision2/detail.png`, `public/mascots/poseidon.webp`, `assets/mascots3d/rey_salvaje/revision2/preview.png` y `assets/mascots3d/pantera/revision2/preview.png`.

**Corrección:** aprobar un personaje patrón a tamaño real de juego. Trabajar primero silueta y anatomía; después pelo, materiales y grabados. Usar relieve superficial o normal maps para detalle fino y geometría para la silueta. No aumentar el número de piezas como sustituto del parecido.

**Aceptación:** comparación frontal y tres cuartos con igual encuadre, más reposo y celebración en el visor del juego; revisión explícita del parecido antes de aplicar el método al resto.

### G06 · Media · Coste geométrico alto sin variante ligera de mascotas

**Datos medidos en archivos; impacto de FPS pendiente.** El visor limita DPR a 1,75 (`MascotPreview.tsx:72`), pero no selecciona un GLB de menor detalle. El selector de calidad de la arena no controla las mascotas. La galería añade bloom; la celebración no utiliza ese postproceso. Solo se carga el modelo seleccionado, por lo que no corresponde sumar los diez como coste simultáneo.

| Modelo | MiB | Vértices exportados | Triángulos | Primitivas/materiales |
|---|---:|---:|---:|---:|
| Demonio | 3,33 | 28 433 | 37 420 | 20 / 14 |
| Pantera | 5,78 | 89 600 | 127 228 | 15 / 15 |
| Pato | 6,64 | 105 077 | 118 352 | 14 / 14 |
| Océano | 7,53 | 117 048 | 160 736 | 14 / 14 |
| Fantasma | 4,11 | 62 049 | 77 930 | 10 / 10 |
| Sombra | 5,05 | 80 591 | 98 222 | 10 / 10 |
| Rey Salvaje | 7,82 | 125 994 | 159 895 | 16 / 16 |
| Emperador | 6,90 | 114 000 | 129 474 | 15 / 15 |
| Bestia de Fuego | 7,75 | 123 350 | 150 697 | 15 / 15 |
| Poseidón | 7,78 | 127 331 | 163 864 | 13 / 13 |

Los vértices exportados incluyen separaciones por UV, normales y materiales; no son los vértices fuente documentados por Blender. Las primitivas indican partición de malla, no una medición de draw calls GPU. Todos salvo Demonio incluyen dos texturas; Demonio incluye tres.

**Corrección:** medir en un móvil objetivo y preparar un LOD reducido si no cumple presupuesto; reducir hebras, ribetes y piezas pequeñas, y consolidar materiales compatibles. **Aceptación propuesta:** al menos 30 FPS sostenidos en el móvil elegido y 60 FPS en el escritorio elegido, con tiempos de carga y memoria registrados. Estos valores son objetivos propuestos, no resultados medidos.

### G07 · Media · La imagen de respaldo desaparece mientras carga el módulo del visor

**Confirmado por composición de componentes.** `MascotCelebration.tsx:7` declara `loading: () => null`. Tras la hidratación, sin movimiento reducido, se monta el componente dinámico y su contenedor puede quedar vacío hasta descargar el módulo. La imagen durante la carga del GLB está dentro de `MascotPreview`, por lo que aún no existe en ese intervalo.

**Corrección:** mantener la ilustración en el padre hasta que el visor informe que está listo. **Aceptación:** red lenta y caché vacía nunca dejan un hueco vacío donde debería aparecer la mascota.

## Interfaz y accesibilidad visual

### G08 · Media · Legibilidad insuficiente en filas de derrota

**Confirmado por estilos; contraste renderizado pendiente.** `GameResults.tsx:283` aplica opacidad 0,55 a la fila y la línea 299 usa blanco con alpha 0,3 para DERROTA, con fuente de 9 px en la celda. La contribución blanca combinada es 0,165; no se afirma un ratio de contraste sin medir el fondo compuesto.

**Corrección:** texto opaco y tamaño legible; distinguir al ganador con fondo, borde e icono. **Aceptación:** verificar contraste de texto normal y lectura a tamaño móvil, sin depender del brillo de pantalla.

### G09 · Media · Etiquetas y modal con riesgo de recorte en pantallas pequeñas

**Restricciones confirmadas por código; reproducción visual pendiente.** La etiqueta de mascota de `GameResults.tsx:177` es absoluta, no tiene ancho máximo, usa `nowrap`, padding horizontal de 48 px y espaciado de 2 px. Su tarjeta tiene `overflow: hidden` en la línea 102. Nombres como «El Titán del Océano Salvaje» requieren validación a 320/360 px.

El modal de ascenso (`globals.css:502–503`) está centrado en un overlay fijo sin altura máxima ni scroll; `GameResults.tsx:345–348` añade emoji de 100 px y nombre de 48 px. En una pantalla baja o con zoom el contenido puede exceder el viewport.

**Corrección:** etiqueta en flujo normal con salto de línea; modal limitado por `dvh`, scroll interno y tamaños fluidos. **Aceptación:** nombres largos, móvil horizontal y zoom 200 % con texto y botón de continuar accesibles.

### G10 · Media · Movimiento reducido incompleto

**Confirmado por código.** Existen reglas CSS globales y fallback estático de mascotas, pero `/play/[salaId]/page.tsx:99` y wrappers de `GameResults.tsx:110` conservan transformaciones de Framer Motion sin respetar la preferencia. Las reglas CSS no detienen las transformaciones animadas mediante JavaScript.

**Corrección:** aplicar `useReducedMotion` a esos wrappers o una configuración global adecuada. **Aceptación:** activar la preferencia elimina desplazamientos y escalados decorativos en entrada y resultados, manteniendo la información.

### G11 · Baja · Ranking e identidad de la mascota naranja

**Confirmado por código.** `globals.css:215` intenta expandir `.ranking-panel` a dos columnas, pero el grid item es su wrapper `motion.div` (`PanelPrincipal.tsx:353`), por lo que la regla no actúa en el grid exterior. Aplicar la expansión al wrapper.

`lib/dados.ts:19` muestra «La Naranja Salvaje», mientras `lib/mascots.ts:10` utiliza «Bestia de Fuego». `GameResults.tsx:194` coloca el primer nombre junto al nuevo modelo. Centralizar el nombre visible del personaje y mantener el color como identificador separado.

## Aspectos que ya están resueltos

- Resultado autoritativo separado de la reproducción visual y orientación final consistente del dado.
- Pausa, omisión, selección de calidad y fallback de fallo WebGL en la arena.
- Liberación explícita de recursos Three.js en desmontaje.
- Mascota estática cuando se solicita movimiento reducido, incluida reacción a cambios de preferencia en `MascotCelebration`.
- Diez modelos con cinco clips y comprobación de suelo aprobada; revisiones anteriores conservadas.
- Comparación con ilustración disponible en la galería y controles con foco visible.

`WinnerReveal` no está montado en las rutas revisadas: se importa su configuración desde `GameResults`. No se contaron sus defectos como fallos activos de pantalla.

## Orden recomendado de trabajo

1. **Arena:** corregir G01 y G03; después ajustar G02 con métricas por dado y revisión de ritmo. Resolver G04 en el mismo flujo de reproducción.
2. **Interfaz:** corregir G07–G10 y cerrar los dos detalles de G11. Comprobar 320, 360, 390, 768 y 1440 px, orientación horizontal y zoom 200 %.
3. **Arte:** continuar con una sola mascota patrón, Poseidón, corrigiendo anatomía y material antes de añadir adornos. Aprobar su parecido dentro del juego.
4. **Optimización:** medir el modelo patrón en móvil/escritorio, fijar presupuesto y generar una variante ligera si hace falta. Solo después aplicar el estándar a las demás mascotas.
5. **Validación visual final:** capturas de rutas activas, primera carga, pérdida de WebGL, reintento, movimiento reducido, cambio de calidad y pantalla de resultados. Esta fase sigue pendiente de acceso autorizado al navegador.

## Reproducción técnica

```powershell
node tools/audit-arena-graphics.cjs
node tools/check-mascot.mjs --all
```

La sonda original del 25 de octubre usó 2/10 dados, semillas `physics-{cantidad}-{0|1|2}`, aspectos 0,8/1,8 y muestreo cada tres frames. La versión actual importa las funciones de cámara del juego y recorre las 21 tomas aceptadas de 2–10 dados con aspectos 0,5/0,8/1,8/2,5; guarda sus resultados en `tools/arena-audit-results.json`. No sustituye las pruebas de imagen ni el perfilado en hardware real.

## Seguimiento de correcciones — 27 de octubre de 2026

El usuario autorizó abordar todos los hallazgos. Esta tabla distingue implementación, comprobación automatizada y aceptación visual: no se cierra el parecido artístico ni el rendimiento de dispositivos a partir de pruebas de código.

| Hallazgo | Estado de esta intervención | Evidencia y condición pendiente |
|---|---|---|
| G01 · Encuadre | Corregido y comprobado numéricamente | Envolvente de toda la trayectoria; acercamiento después del reposo. Pasan 21 tomas × 4 aspectos. Pendiente revisión visual móvil vertical y horizontal. |
| G02 · Movimiento individual | Ajustado y comprobado numéricamente | 14,5 s globales, al menos 3 giros por dado y 2–69 contactos por toma; todos presentan movimiento después de t=10 global. No se garantizan 10 s desde la salida individual ni choque continuo. Pendiente validar ritmo visual. |
| G03 · Reloj | Corregido y probado | Reloj monotónico que descuenta pausas y visibilidad; pruebas a 10, 20, 30 y 60 FPS simulados. El visor de mascotas comparte el reloj para excluir el tiempo oculto. |
| G04 · Calidad | Corregido y probado a nivel de componente | DPR y sombras cambian sin recrear escena, trayectoria, instante ni resultado. Los materiales se recompilan al activar/desactivar sombras. Pendiente verificación en GPU real. |
| G05 · Parecido artístico | Patrón mejorado e integrado; aceptación abierta | Poseidón revisión 3 integrado, con rostro continuo, barba curva, cuello más corto y placas depuradas. Renders de reposo, celebración y detalle inspeccionados. Falta aceptar el parecido dentro del juego; siguen pendientes la melena del Rey, los ribetes de Pantera y el acabado del conjunto. |
| G06 · Coste de mascotas | Diez variantes ligeras integradas y comprobadas | Reducción aproximada del 70 % de triángulos y 55,4–60,2 % de bytes. Cinco clips y 18 huesos conservados. Selector de calidad implementado. FPS, memoria y carga real siguen sin medirse. |
| G07 · Respaldo durante carga | Corregido y probado a nivel de componente | La ilustración permanece en el padre hasta recibir la señal de modelo listo y se recupera ante fallo. Cinco pruebas aprobadas; la red lenta real queda pendiente. |
| G08 · Filas de derrota | Implementado; comprobación de componente aprobada | Texto opaco y tamaño legible; falta contraste del resultado renderizado. |
| G09 · Etiquetas y modal | Implementado; ciclo del diálogo probado | Etiquetas con salto de línea, modal nativo con foco recuperado, límites de altura y scroll; falta validar 320 px, horizontal y zoom 200 % en navegador. |
| G10 · Movimiento reducido | Implementado; wrappers de resultados probados | Preferencia aplicada a resultados, manual, online y portada. Falta revisión visual en navegador. |
| G11 · Ranking e identidad | Implementado; identidad probada | Expansión aplicada al wrapper del ranking y nombres ligados al catálogo común. Falta validar distribución renderizada. |

### Arena: métricas de cierre

La sonda aprobó 21 tomas y 84 proyecciones, con máximo absoluto NDC 0,8433 frente al límite de prueba 0,9. Se observaron 3,0187–16,0553 vueltas por dado, 2–69 contactos entre dados y movimiento individual hasta al menos t=10,0667 desde la primera salida. La preparación de una toma duró 7,98–41,28 ms en Node local; esto no mide la respuesta en móvil.

Cada tirada dura 14,5 s desde la primera salida. Con entrada/agitación del vaso y acercamiento final, la escena suma 17,65 s, sin pausas. La reproducción ralentiza la parte activa de una simulación física; el tramo quieto final ocupa 0,6 s. Las salidas se escalonan hasta 3,22 s, por lo que no se certifican diez segundos de movimiento contados desde la salida individual. La variedad es acotada: 21 tomas, una para siete jugadores. No se buscan tomas durante una partida y el servidor conserva la autoridad del resultado. Detalles y comandos: `tools/arena-fix-results.md`.

Las pruebas de arena aprobaron 22 casos en tres archivos: física, determinismo, caras finales, movimiento individual, reloj, pausa/visibilidad, encuadre y calidad sin reiniciar.

### Respaldo y calidad de mascotas

`MascotCelebration` mantiene la imagen de referencia fuera del módulo dinámico. El visor comunica que está listo después de dibujar su primer frame; descargar el GLB no basta para retirar la imagen. La descarga del módulo, la carga del GLB y el fallo del visor ya no dependen de que el propio visor haya montado su respaldo. `tests/mascot-celebration.test.tsx` aprobó sus cinco casos: módulo pendiente, transición a modelo listo y pérdida de WebGL, cambios de movimiento reducido, error del visor e identificador desconocido. Son pruebas de componente con visor simulado, no pérdida de contexto en una GPU real.

`MascotPreview` ofrece calidad automática, ligera y completa. Automática selecciona la variante ligera al iniciar el visor si el ancho es de hasta 700 px o el puntero es grueso. Ligera limita DPR a 1 y desactiva bloom; completa conserva DPR máximo de 1,75. La elección de calidad de la arena y la de mascotas son independientes. El cambio de calidad conserva clip, tiempo y pausa de la mascota. El criterio automático es una heurística de viewport/entrada, no una medición de la capacidad del dispositivo.

La comprobación de las diez variantes ligeras comprende 50 clips y 250 poses con límites finitos y contacto con el suelo. La prueba de activos compara además esqueleto, nombres/duraciones de clips, tamaño y triángulos frente al modelo completo. Se inspeccionó el render del GLB ligero de Poseidón importado en Blender: conserva silueta y accesorios, con pérdida de detalle fino y suavidad de reflejos. Las otras nueve variantes no tuvieron inspección visual individual en esta intervención. Métricas, hashes y reproducción: `assets/mascots3d/lite/audit.json`, `assets/mascots3d/lite/README.md` y `tools/audit-mascot-assets.mjs`.

Poseidón completo revisión 3 ocupa 8,99 MiB y usa 201580 triángulos; la variante ligera, 3,94 MiB y 60474 triángulos. La revisión artística aumentó la geometría del completo frente a revisión 2; no se presenta como una optimización. El objetivo de parecido sigue abierto.

### Interfaz implementada; pruebas de componente aprobadas

Las filas de derrota ya no reducen la opacidad del contenido y utilizan texto `#e5e7eb` de 12 px. La etiqueta de personaje pasa al flujo normal, limita su ancho y permite saltos. El ascenso utiliza un `dialog` nativo con título y descripción accesibles, cierre por Escape, recuperación del foco y bloqueo del scroll del fondo; su contenido tiene scroll y altura máxima `calc(100dvh - 24px)`. La portada adapta tarjetas y tipografía a anchuras pequeñas mediante tamaños fluidos.

Los wrappers de resultados, manual, online y portada consultan la preferencia de movimiento reducido; la portada omite la introducción con esa preferencia. La expansión del ranking se aplica ahora al wrapper que participa en el grid. `lib/dados.ts` obtiene los nombres del catálogo `MASCOT_MODELS`, por lo que el personaje naranja aparece como «Bestia de Fuego» de forma coherente.

Estas correcciones de código aún requieren comprobar el contraste renderizado, la distribución a 320/360/390/768/1440 px, móvil horizontal, zoom 200 %, foco y Escape en un navegador real. La emulación de `dialog` en jsdom no sustituye esas comprobaciones.

`tests/game-results-accessibility.test.tsx`: cuatro pruebas aprobadas. La primera ejecución detectó que el autofocus de React impedía guardar el foco anterior; se corrigió enfocando el botón después de abrir el diálogo. Se probaron identidad y resultados completos, apertura/cierre y devolución de foco, cierre notificado por el diálogo y wrappers sin desplazamiento con movimiento reducido. `tests/mascots.test.ts`: tres pruebas aprobadas; `tests/mascot-celebration.test.tsx`: cinco aprobadas.

### Límites de esta validación

**Cierre automatizado del 27 de octubre:** 68 pruebas aprobadas en los 14 archivos de la suite, ejecutados en tres grupos (22 de arena, 12 de mascotas/interfaz y 34 de regresión). TypeScript y ESLint de los archivos modificados pasan; `git diff --check` no detecta errores de espacios. Compilación de producción con Webpack aprobada, con 22 páginas generadas y rutas de arena, manual, mascotas y online incluidas.

Turbopack falló al iniciar el subproceso de CSS tanto dentro como fuera del sandbox. La alternativa oficial `next build --webpack` compiló correctamente; el script `build` de `package.json` ahora utiliza esa opción. No se cambió el comando de desarrollo ni se actualizaron dependencias. El registro local queda en `tools/build-webpack.log` y su salida en `tools/build-webpack.exit` (0). La compilación valida integración, no apariencia ni rendimiento de GPU.

La política de acceso bloqueó la URL local en la sesión anterior y no se usaron rutas alternativas para sortearla. En esta intervención no se han obtenido capturas de navegador, ratios de contraste renderizado ni FPS o memoria en teléfonos físicos. Los renders de Blender sirven para revisar el modelo y su acabado, pero no acreditan su apariencia exacta bajo la iluminación del visor web. Los objetivos de 30 FPS móvil y 60 FPS escritorio permanecen pendientes de medir.
