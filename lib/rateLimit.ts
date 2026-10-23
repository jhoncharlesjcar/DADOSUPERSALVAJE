import { getDB } from "./db";

type Bucket = { count: number; resetAt: number };
const memoryFallback = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  try {
    const db = getDB();
    
    // Clean expired rate limit records periodically
    db.prepare("DELETE FROM rate_limit WHERE reset_at < ?").run(now);

    const row = db.prepare(
      "SELECT count, reset_at FROM rate_limit WHERE key = ? AND reset_at > ?"
    ).get(key, now) as { count: number; reset_at: number } | undefined;

    if (!row) {
      db.prepare("INSERT OR REPLACE INTO rate_limit (key, count, reset_at) VALUES (?, 1, ?)").run(key, now + windowMs);
      return { allowed: true, retryAfter: 0 };
    }

    if (row.count >= limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.reset_at - now) / 1000)) };
    }

    db.prepare("UPDATE rate_limit SET count = count + 1 WHERE key = ?").run(key);
    return { allowed: true, retryAfter: 0 };
  } catch {
    // Graceful in-memory fallback
    const current = memoryFallback.get(key);
    if (!current || current.resetAt <= now) {
      memoryFallback.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    if (current.count >= limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
    }
    current.count += 1;
    return { allowed: true, retryAfter: 0 };
  }
}

export function clearRateLimit(key: string): void {
  try {
    const db = getDB();
    db.prepare("DELETE FROM rate_limit WHERE key = ?").run(key);
  } catch {}
  memoryFallback.delete(key);
}

