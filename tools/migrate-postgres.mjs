import { readdirSync,readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>/^\d+_[a-z_]+\.sql$/.test(f)).sort();
if(!process.argv.includes('--apply')) {
  console.log(JSON.stringify({dryRun:true,migrations:files}));
} else {
  if(!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL del destino');
  const client=new pg.Client({connectionString:process.env.DATABASE_URL});
  try {
    await client.connect(); await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dado-versioned-migrations'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS dado_migrations');
    await client.query('REVOKE ALL ON SCHEMA dado_migrations FROM PUBLIC');
    await client.query('CREATE TABLE IF NOT EXISTS dado_migrations.versiones(nombre text PRIMARY KEY,sha256 text NOT NULL,aplicada_en timestamptz NOT NULL DEFAULT now())');
    await client.query('ALTER TABLE dado_migrations.versiones ENABLE ROW LEVEL SECURITY');
    for(const file of files) {
      const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
      const {rows}=await client.query('SELECT sha256 FROM dado_migrations.versiones WHERE nombre=$1',[file]);
      if(rows.length) { if(rows[0].sha256!==hash) throw new Error('Una migración aplicada fue modificada: '+file); continue; }
      await client.query(sql);
      await client.query('INSERT INTO dado_migrations.versiones(nombre,sha256) VALUES($1,$2)',[file,hash]);
      console.log('Aplicada: '+file);
    }
    await client.query('COMMIT');
  } catch { await client.query('ROLLBACK').catch(()=>{}); console.error('Migración no aplicada; revisa conexión, permisos e historial.');process.exitCode=1; }
  finally { await client.end(); }
}
