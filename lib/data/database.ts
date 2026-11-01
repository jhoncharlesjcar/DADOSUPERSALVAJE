import "server-only";
import { Pool } from "pg";

export type Row = Record<string, unknown>;
export interface SqlResult<T> { rows: T[]; rowCount: number; }
export interface SqlClient {
  query<T = Row>(text: string, values?: unknown[]): Promise<SqlResult<T>>;
}
export interface Database extends SqlClient {
  transaction<T>(operation: (client: SqlClient) => Promise<T>): Promise<T>;
}

let pool: Pool | undefined;
let testDatabase: Database | undefined;
// Injection is deliberately unavailable outside tests; there is no in-memory production fallback.
export function setTestDatabase(database: Database | undefined) {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo para pruebas");
  testDatabase = database;
}
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL de Supabase en el servidor");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8,
      connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
  }
  return pool;
}
function clientAdapter(client: Pick<Pool, "query">): SqlClient {
  return { async query<T>(text: string, values: unknown[] = []) {
    const result = await client.query(text, values);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  } };
}
const postgres: Database = {
  query<T>(text: string, values?: unknown[]) { return clientAdapter(getPool()).query<T>(text, values); },
  async transaction<T>(operation: (client: SqlClient) => Promise<T>) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await operation(clientAdapter(client));
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  },
};
export function getDatabase(): Database { return testDatabase ?? postgres; }
export async function closeDatabase() { if (pool) { await pool.end(); pool = undefined; } }
