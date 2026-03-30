import "./globals.css";

export const metadata = {
  title: "DADO SALVAJE — Panel de Control",
  description:
    "Panel administrativo para el juego Dado Salvaje. Busca jugadores, crea partidas y lanza dados en segundos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
