export const MASCOT_MODELS: Record<string, { slug: string; name: string; accent: string; description: string; revision?: number }> = {
  rojo: { slug: "demonio", name: "Demonio Salvaje", accent: "#f66b34", description: "Roca volcánica, cuernos, maza y dado en llamas." },
  rosado: { slug: "pantera", name: "Pantera Rosada", accent: "#f268c5", revision: 2, description: "Revisión 2: rostro felino esculpido, pelaje con manchas, abrigo de cuero entallado, neón fino y dado sobre la palma. Acabado en revisión frente a la ilustración original." },
  amarillo: { slug: "pato", name: "Pato Salvaje", accent: "#e7ba47", revision: 2, description: "Revisión 2: pico curvo, mirada firme, plumaje en capas, corona con gemas oscuras, armadura de oro y bronce, capa bordada y patas palmeadas. Acabado en revisión frente a la ilustración original." },
  celeste: { slug: "oceano", name: "Titán del Océano", accent: "#4cdbf2", revision: 2, description: "Revisión 2: torso esculpido, piel escamosa, branquias, aletas con membranas, coral ramificado y conchas sobre armadura marina. Acabado en revisión frente a la ilustración original." },
  blanco: { slug: "fantasma", name: "La Fantasma", accent: "#d7ebff", revision: 2, description: "Revisión 2: yelmo curvo con visor negro, armadura plateada esbelta, runas luminosas, cadena y capa perforada con velos translúcidos. Acabado en revisión frente a la ilustración original." },
  negro: { slug: "sombra", name: "La Sombra", accent: "#ac7cf2", revision: 2, description: "Revisión 2: capucha de tela con rostro oculto, ojos violetas, armadura negra en capas, runas finas, garras y manto rasgado. Acabado en revisión frente a la ilustración original." },
  verde: { slug: "rey_salvaje", name: "El Rey Salvaje", accent: "#4de49b", revision: 2, description: "Revisión 2: rostro de león esculpido, melena en capas, corona de esmeraldas, armadura verde con cristales y enredaderas, patas con garras y cola curva. Acabado en revisión frente a la ilustración original." },
  guinda: { slug: "emperador_viento", name: "Emperador del Viento", accent: "#df7695", revision: 2, description: "Revisión 2: cabeza de águila con pico curvo, plumaje en capas, armadura guinda con espirales, capa rasgada y cetro con águila de alas abiertas. Acabado en revisión frente a la ilustración original." },
  naranja: { slug: "bestia_fuego", name: "Bestia de Fuego", accent: "#ffa44a", revision: 2, description: "Revisión 2: hocico de zorro, orejas altas, mejillas blancas, cola curva con punta marfil, armadura de cobre y llamas estilizadas. Acabado en revisión frente a la ilustración original." },
  azul: { slug: "poseidon", name: "Poseidón", accent: "#6b9dff", revision: 3, description: "Revisión 3: rostro continuo, cuello más corto, barba con hebras curvas y placas abdominales depuradas; conserva corona alada, capa azul y tridente de doble extremo. Acabado en revisión frente a la ilustración original." },
};

export function mascotModel(dadoId: string) {
  if (!Object.hasOwn(MASCOT_MODELS, dadoId)) return null;
  const model = MASCOT_MODELS[dadoId];
  return { ...model, url: `/models/mascots/${model.slug}.glb${model.revision ? `?v=${model.revision}` : ""}`, liteUrl: `/models/mascots/lite/${model.slug}.glb?v=${model.revision || 1}-1`, image: `/mascots/${model.slug}.webp` };
}
