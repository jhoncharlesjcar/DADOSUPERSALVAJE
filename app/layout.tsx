import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: "DADO SALVAJE — La arena decide",
  description:
    "Experiencia de dados competitiva con partidas, progresión y una arena cinematográfica.",
  openGraph: {
    title: "DADO SALVAJE — La arena decide",
    description: "Entra a la arena, lanza los dados y conquista la clasificación.",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Dado Salvaje — La arena decide" }],
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DADO SALVAJE — La arena decide",
    description: "Entra a la arena, lanza los dados y conquista la clasificación.",
    images: ["/og.png"],
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
