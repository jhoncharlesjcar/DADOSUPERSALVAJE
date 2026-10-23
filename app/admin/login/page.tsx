import { loginAdmin } from "./actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/admin";

  return (
    <main className="admin-login-page">
      <form action={loginAdmin} className="card admin-login-card">
        <div className="admin-login-mark" aria-hidden="true">🛡️</div>
        <h1>Acceso administrativo</h1>
        <p>Ingresa la clave del operador para administrar jugadores, saldos y partidas.</p>
        <input type="hidden" name="next" value={nextPath} />
        <label htmlFor="admin-password">Contraseña</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {params.error && <div className="form-error" role="alert">Contraseña incorrecta.</div>}
        <button className="btn btn-primary" type="submit">INGRESAR</button>
      </form>
    </main>
  );
}
