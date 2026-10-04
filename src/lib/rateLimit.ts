// In-memory sliding window rate limiter — suitable for single-instance deployments.
// For multi-instance deployments, replace with Redis.

import type { NextRequest } from "next/server";

/**
 * The visitor's IP address, for rate limiting.
 *
 * nginx sets X-Real-IP from the actual TCP connection, so the client cannot
 * fake it. X-Forwarded-For must NOT be used for this: nginx appends to
 * whatever the client sent, so its contents are attacker-controlled and a new
 * value per request would dodge every per-IP limit.
 */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-real-ip") ?? "unknown";
}

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

/**
 * True while `key` has reached `maxFailures` within its window. Check this
 * BEFORE verifying a password or code: a lock that is only consulted after a
 * wrong guess still lets a right guess through, so it never stops brute force.
 */
export function isLocked(key: string, maxFailures: number): boolean {
  const entry = store.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= maxFailures);
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
