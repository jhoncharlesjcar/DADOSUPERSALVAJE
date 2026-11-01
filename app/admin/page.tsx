import { getTodosJugadores, getReporteFinanciero, getTodasTransacciones, getEstadisticasGlobales } from "@/lib/db";
import AdminClient from "./AdminClient";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import { logoutAdmin } from "./login/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login?next=/admin");
  const [jugadores, reporte, transacciones, stats] = await Promise.all([
    getTodosJugadores(), getReporteFinanciero(), getTodasTransacciones(), getEstadisticasGlobales(),
  ]);

  return (
    <div style={{ padding: "40px 20px", background: "#05080E", minHeight: "100vh", color: "white", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 40, borderBottom: "1px solid rgba(212,175,55,0.3)", paddingBottom: 20, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "var(--gold)", margin: 0, fontFamily: "'Playfair Display', serif", letterSpacing: 2 }}>
            🛡️ PANEL DE ADMINISTRACIÓN
          </h1>
          <p style={{ color: "var(--white-muted)", marginTop: 8 }}>Gestión de jugadores, saldos en soles y estadísticas globales</p>
          </div>
          <form action={logoutAdmin}><button className="btn btn-ghost" type="submit">Cerrar sesión</button></form>
        </header>

        <AdminClient 
          initialJugadores={jugadores} 
          reporte={reporte} 
          transacciones={transacciones}
          stats={stats}
        />
      </div>
    </div>
  );
}
