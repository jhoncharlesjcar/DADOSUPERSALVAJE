import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const parseCents = value => {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || BigInt(value)>9223372036854775807n) throw new Error('Céntimos inválidos');
  return BigInt(value);
};
export function validateSnapshot(data) {
  if(data.version!==1 || !Array.isArray(data.accounts) || !Array.isArray(data.archive?.jugadores) || !/^[a-f0-9]{64}$/.test(data.source_sha256)) throw new Error('Snapshot inválido');
  const ids=new Set(); let available=0n,bonus=0n;
  for(const a of data.accounts) {
    if(!/^\d{8}$/.test(a.dni) || ids.has(a.dni) || !Number.isSafeInteger(a.moneda_ingame) || a.moneda_ingame<0) throw new Error('Cuenta inválida');
    ids.add(a.dni); available+=parseCents(a.disponible_centimos); bonus+=parseCents(a.bono_centimos);
  }
  if(data.archive.jugadores.length!==ids.size || new Set(data.archive.jugadores.map(p=>p.dni)).size!==ids.size || data.archive.jugadores.some(p=>!ids.has(p.dni))) throw new Error('Jugadores no coinciden con billeteras');
  for(const p of data.archive.jugadores) parseCents(data.player_stats?.[p.dni]?.total_ganado_centimos);
  for(const p of data.archive.partidas ?? []) {
    for(const field of ['jugadores_json','resultados_json']) {
      if(p[field]!=null && !Array.isArray(JSON.parse(p[field]))) throw new Error('Historial inválido');
    }
  }
  if(available!==parseCents(data.totals.disponible_centimos) || bonus!==parseCents(data.totals.bono_centimos)) throw new Error('Conciliación de origen fallida');
  return {available,bonus};
}
/** Caller supplies one dedicated client and wraps this whole operation in a transaction. */
export async function importSnapshot(client,data,hash,demo) {
  const totals=validateSnapshot(data);
  if(typeof demo!=='boolean' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Destino demo/real y hash explícitos requeridos');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('sqlite-opening-import'))");
  const existing=await client.query('SELECT id FROM importaciones_legacy WHERE id=$1',[hash]);
  if(existing.rows.length) return {replay:true};
  const occupied=await client.query('SELECT id FROM usuarios LIMIT 1');
  if(occupied.rows.length) throw new Error('La importación inicial requiere un destino sin usuarios; nunca sobrescribe saldos');
  await client.query('INSERT INTO importaciones_legacy(id,fuente_sha256,manifiesto,disponible_centimos,bono_centimos) VALUES($1,$2,$3::jsonb,$4,$5)',
    [hash,data.source_sha256,JSON.stringify({version:1,demo,counts:Object.fromEntries(Object.entries(data.archive).map(([k,v])=>[k,v.length]))}),totals.available.toString(),totals.bonus.toString()]);
  for(const [table,rows] of Object.entries(data.archive)) for(const [i,row] of rows.entries()) {
    await client.query('INSERT INTO archivo_legacy(importacion_id,tabla,fila,datos) VALUES($1,$2,$3,$4::jsonb)',[hash,table,i,JSON.stringify(row)]);
  }
  for(const p of data.archive.jugadores) {
    const a=data.accounts.find(a=>a.dni===p.dni),userId=randomUUID(),walletId=randomUUID();
    await client.query(`INSERT INTO usuarios(id,dni,nombres,celular,pin_hash,estado,puntos,partidas_jugadas,partidas_ganadas,total_ganado_centimos,racha_actual,mejor_racha,titulo)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[userId,p.dni,p.nombres,p.celular??null,p.pin_hash??null,p.activo===0?'bloqueado':'activo',p.puntos??0,p.partidas_jugadas??0,p.partidas_ganadas??0,data.player_stats?.[p.dni]?.total_ganado_centimos??'0',p.racha_actual??0,p.mejor_racha??0,p.titulo??'']);
    await client.query('INSERT INTO billeteras(id,usuario_id,demo,disponible_centimos,bono_centimos,moneda_ingame) VALUES($1,$2,$3,$4,$5,$6)',[walletId,userId,demo,a.disponible_centimos,a.bono_centimos,a.moneda_ingame]);
    await client.query('INSERT INTO billeteras(usuario_id,demo) VALUES($1,$2)',[userId,!demo]);
    await client.query('INSERT INTO limites_usuario(usuario_id) VALUES($1)',[userId]);
    await client.query(`INSERT INTO movimientos(billetera_id,tipo,monto_centimos,disponible_delta,bloqueado_delta,bono_delta,saldo_disponible_despues,saldo_bloqueado_despues,saldo_bono_despues,referencia_tipo,referencia_id,clave_idempotencia,descripcion)
      VALUES($1,'ajuste_admin',$2,$3,0,$4,$3,0,$4,'importacion',$5,$6,'Saldo inicial migrado')`,[walletId,(BigInt(a.disponible_centimos)+BigInt(a.bono_centimos)).toString(),a.disponible_centimos,a.bono_centimos,hash,`import:${hash}:${userId}`]);
  }
  const {rows:[sum]}=await client.query('SELECT COALESCE(SUM(disponible_centimos),0)::text disponible,COALESCE(SUM(bono_centimos),0)::text bono FROM billeteras WHERE usuario_id IS NOT NULL AND demo=$1',[demo]);
  if(BigInt(sum.disponible)!==totals.available || BigInt(sum.bono)!==totals.bonus) throw new Error('Conciliación destino fallida; rollback');
  const {rows:[ledger]}=await client.query("SELECT COALESCE(SUM(monto_centimos),0)::text total FROM movimientos WHERE referencia_tipo='importacion' AND referencia_id=$1",[hash]);
  if(BigInt(ledger.total)!==totals.available+totals.bonus) throw new Error('Libro inicial no concilia');
  // Evaluate every compatibility projection inside the import transaction, so malformed
  // historical fields reject the import instead of breaking the dashboard after cutover.
  await client.query('SELECT * FROM historial_partidas_legacy');
  await client.query("INSERT INTO auditoria_admin(actor,accion,referencia_tipo,referencia_id,detalle) VALUES('sqlite-migrator','saldo_inicial','importacion',$1,$2::jsonb)",[hash,JSON.stringify({demo,accounts:data.accounts.length})]);
  return {replay:false,accounts:data.accounts.length,available:sum.disponible,bonus:sum.bono};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const args=process.argv.slice(2), file=args.find(a=>!a.startsWith('--'));
    if(!file) throw new Error('Uso: node tools/import-postgres.mjs snapshot.json [--apply --demo|--real]');
    const raw=readFileSync(file), data=JSON.parse(raw.toString('utf8')), totals=validateSnapshot(data);
    if(!args.includes('--apply')) console.log(JSON.stringify({dryRun:true,accounts:data.accounts.length,available:totals.available.toString(),bonus:totals.bonus.toString()}));
    else {
      if(args.includes('--demo')===args.includes('--real')) throw new Error('Selecciona exactamente --demo o --real; nunca se infiere la naturaleza del saldo');
      if(!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL del destino');
      const client=new pg.Client({connectionString:process.env.DATABASE_URL}); await client.connect();
      try { await client.query('BEGIN'); const result=await importSnapshot(client,data,createHash('sha256').update(raw).digest('hex'),args.includes('--demo')); await client.query('COMMIT'); console.log(JSON.stringify(result)); }
      catch(error) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); }
    }
  } catch { console.error('Importación rechazada. Revisa snapshot, conciliación y configuración del destino; no se publican datos privados.'); process.exitCode=1; }
}
