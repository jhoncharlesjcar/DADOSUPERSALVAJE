import { loginAdmin } from "./actions";
import { usesSupabaseAdminAuth } from "@/lib/supabaseAdminAuth";

const errors: Record<string, string> = {
  credentials: "No se pudo iniciar sesión. Revisa tu correo y contraseña.",
  forbidden: "Tu cuenta no tiene habilitado el acceso developer. Contacta al responsable del proyecto.",
  configuration: "El acceso administrativo aún no está configurado. Contacta al responsable del proyecto.",
  unavailable: "No pudimos conectar con el servicio de acceso. Inténtalo de nuevo.",
  rate_limit: "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/admin";
  const supabase = usesSupabaseAdminAuth();

  return (
    <main className="admin-login-page">
      <form action={loginAdmin} className="card admin-login-card">
        <div className="admin-login-mark" aria-hidden="true">🛡️</div>
        <h1>Acceso administrativo</h1>
        <p>{supabase ? "Ingresa con tu cuenta developer para administrar el videojuego." : "Ingresa la clave del operador para administrar jugadores, saldos y partidas."}</p>
        <input type="hidden" name="next" value={nextPath} />
        {supabase && <>
          <label htmlFor="admin-email">Correo electrónico</label>
          <input id="admin-email" name="email" type="email" autoComplete="username" maxLength={254} required autoFocus />
        </>}
        <label htmlFor="admin-password">Contraseña</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" maxLength={4096} required autoFocus={!supabase} />
        {params.error && <div className="form-error" role="alert">{errors[params.error] || errors.credentials}</div>}
        <button className="btn btn-primary" type="submit">INGRESAR</button>
      </form>
    </main>
  );
}
