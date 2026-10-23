export const MASCOT_MODELS: Record<string, { slug: string; name: string; accent: string; description: string; revision?: number }> = {
  rojo: { slug: "demonio", name: "Demonio Salvaje", accent: "#f66b34", description: "Roca volcánica, cuernos, maza y dado en llamas." },
  rosado: { slug: "pantera", name: "Pantera Rosada", accent: "#f268c5", revision: 2, description: "Revisión 2: rostro felino esculpido, pelaje con manchas, abrigo de cuero entallado, neón fino y dado sobre la palma. Acabado en revisión frente a la ilustración original." },
  amarillo: { slug: "pato", name: "Pato Salvaje", accent: "#e7ba47", description: "Corona, pico, patas palmeadas y hombreras de plumas doradas." },
  celeste: { slug: "oceano", name: "Titán del Océano", accent: "#4cdbf2", description: "Aletas, coral y conchas sobre armadura marina." },
  blanco: { slug: "fantasma", name: "La Fantasma", accent: "#d7ebff", description: "Yelmo plateado, ojos de luz y capa rasgada." },
  negro: { slug: "sombra", name: "La Sombra", accent: "#ac7cf2", description: "Capucha, rostro oculto y marcas de energía violeta." },
  verde: { slug: "rey_salvaje", name: "El Rey Salvaje", accent: "#4de49b", description: "León coronado, melena, cola y cristales de esmeralda." },
  guinda: { slug: "emperador_viento", name: "Emperador del Viento", accent: "#df7695", description: "Cabeza de águila, armadura guinda y cetro alado." },
  naranja: { slug: "bestia_fuego", name: "Bestia de Fuego", accent: "#ffa44a", description: "Zorro de orejas altas, cola espesa y crin de fuego." },
  azul: { slug: "poseidon", name: "Poseidón", accent: "#6b9dff", description: "Corona, barba, armadura azul y tridente." },
};

export function mascotModel(dadoId: string) {
  if (!Object.hasOwn(MASCOT_MODELS, dadoId)) return null;
  const model = MASCOT_MODELS[dadoId];
  return { ...model, url: `/models/mascots/${model.slug}.glb${model.revision ? `?v=${model.revision}` : ""}`, image: `/mascots/${model.slug}.webp` };
}
