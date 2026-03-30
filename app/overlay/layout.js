import "./overlay.css";

export const metadata = {
  title: "DADO SALVAJE — Overlay",
};

export default function OverlayLayout({ children }) {
  return (
    <html lang="es">
      <body
        style={{
          background: "transparent",
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {children}
      </body>
    </html>
  );
}
