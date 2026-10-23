export interface DadoConfig {
  id: string;
  nombre: string;
  colorStyle: string;
  dotColor: string;
  shadow: string;
  imagen: string;
}

export const DADOS_DISPONIBLES: DadoConfig[] = [
  { id: "rojo",     nombre: "Demonio Salvaje",            colorStyle: "linear-gradient(145deg, #FF3B3B, #CC0000)", dotColor: "#FFFFFF", shadow: "rgba(255, 59, 59, 0.4)",    imagen: "/dados/rojo.webp" },
  { id: "rosado",   nombre: "Pantera Rosada Salvaje",     colorStyle: "linear-gradient(145deg, #FF66B2, #D11585)", dotColor: "#FFFFFF", shadow: "rgba(255, 102, 178, 0.4)",  imagen: "/dados/rosado.webp" },
  { id: "amarillo", nombre: "Pato Salvaje",               colorStyle: "linear-gradient(145deg, #FFD700, #D4AF37)", dotColor: "#0D0D0D", shadow: "rgba(255, 215, 0, 0.4)",    imagen: "/dados/amarillo.webp" },
  { id: "celeste",  nombre: "El Titán del Océano Salvaje",colorStyle: "linear-gradient(145deg, #00BFFF, #008B8B)", dotColor: "#FFFFFF", shadow: "rgba(0, 191, 255, 0.4)",    imagen: "/dados/celeste.webp" },
  { id: "blanco",   nombre: "La Fantasma Salvaje",        colorStyle: "linear-gradient(145deg, #FFFFFF, #E0E0E0)", dotColor: "#0D0D0D", shadow: "rgba(255, 255, 255, 0.4)",  imagen: "/dados/blanco.webp" },
  { id: "negro",    nombre: "La Sombra Salvaje",          colorStyle: "linear-gradient(145deg, #333333, #050505)", dotColor: "#FFFFFF", shadow: "rgba(50, 50, 50, 0.5)",     imagen: "/dados/negro.webp" },
  { id: "verde",    nombre: "El Rey Salvaje",             colorStyle: "linear-gradient(145deg, #00E676, #008242)", dotColor: "#FFFFFF", shadow: "rgba(0, 230, 118, 0.4)",    imagen: "/dados/verde.webp" },
  { id: "guinda",   nombre: "El Emperador del Viento",    colorStyle: "linear-gradient(145deg, #A80038, #5C001E)", dotColor: "#FFFFFF", shadow: "rgba(168, 0, 56, 0.4)",     imagen: "/dados/guinda.webp" },
  { id: "naranja",  nombre: "La Naranja Salvaje",         colorStyle: "linear-gradient(145deg, #FF9100, #E65100)", dotColor: "#FFFFFF", shadow: "rgba(255, 145, 0, 0.4)",    imagen: "/dados/naranja.webp" },
  { id: "azul",     nombre: "El Poseidón Salvaje",        colorStyle: "linear-gradient(145deg, #2962FF, #00008B)", dotColor: "#FFFFFF", shadow: "rgba(41, 98, 255, 0.4)",    imagen: "/dados/azul.webp" },
];
