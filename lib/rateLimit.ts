import "server-only";
import { getDatabase } from "./data/database";

export async function checkRateLimit(key: string,limit: number,windowMs: number): Promise<{allowed:boolean;retryAfter:number}> {
  if(!key || key.length>300 || !Number.isSafeInteger(limit) || limit<1 || limit>1000000 || !Number.isSafeInteger(windowMs) || windowMs<1) throw new Error("Límite inválido");
  const now = Date.now();
  const result = await getDatabase().query<{count:number;reset_at:string}>(`INSERT INTO rate_limit(key,count,reset_at) VALUES($1,1,$2)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limit.reset_at<=$3 THEN 1 ELSE LEAST(rate_limit.count+1,$4) END,
    reset_at=CASE WHEN rate_limit.reset_at<=$3 THEN $2 ELSE rate_limit.reset_at END RETURNING count,reset_at::text`,[key,now+windowMs,now,limit+1]);
  const row = result.rows[0];
  return {allowed:row.count<=limit,retryAfter:row.count<=limit ? 0 : Math.max(1,Math.ceil((Number(row.reset_at)-now)/1000))};
}
export async function clearRateLimit(key: string) { await getDatabase().query("DELETE FROM rate_limit WHERE key=$1",[key]); }
