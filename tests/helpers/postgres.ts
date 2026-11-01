import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Database, SqlClient } from "../../lib/data/database";

/** Real PostgreSQL SQL in WASM. Transactions are serialized by PGlite, not a network-lock benchmark. */
export async function createTestDatabase(options: { allMigrations?: boolean } = {}): Promise<Database & { close(): Promise<void> }> {
  const engine = new PGlite();
  await engine.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  const directory = path.join(process.cwd(), "supabase/migrations");
  const migrations = readdirSync(directory).filter(file => file.endsWith(".sql")).sort();
  for (const file of options.allMigrations !== false ? migrations : migrations.filter(file => file.includes("001_core"))) {
    await engine.exec(readFileSync(path.join(directory, file), "utf8"));
  }
  const adapt = (client: Pick<PGlite, "query">): SqlClient => ({
    async query<T>(sql: string, parameters: unknown[] = []) {
      const result = await client.query<T>(sql, parameters);
      // PGlite reports affectedRows=0 for SELECT, while pg.rowCount is the selected count.
      return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
    },
  });
  return { ...adapt(engine), transaction: operation => engine.transaction(tx => operation(adapt(tx))), close: () => engine.close() };
}
