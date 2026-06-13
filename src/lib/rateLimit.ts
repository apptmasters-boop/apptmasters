// In-memory sliding window rate limiter — suitable for single-instance deployments.
// For multi-instance deployments, replace with Redis.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  entry.count++;
  return { ok: true, remaining: limit - entry.count };
}

// Increments a failure counter and returns whether the key is now locked.
export function recordFailure(key: string, maxFailures: number, windowMs: number): { locked: boolean } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { locked: false };
  }

  entry.count++;
  return { locked: entry.count >= maxFailures };
}

// Clears the failure counter for a key (call on successful login).
export function resetKey(key: string): void {
  store.delete(key);
}

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 10 * 60 * 1000);
