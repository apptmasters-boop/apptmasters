import { signInPath } from "@/lib/housing";

/**
 * The login token lives in localStorage when the user chose "Remember me"
 * (survives closing the browser) and in sessionStorage otherwise (gone when
 * the browser closes). Always go through these helpers; never read storage directly.
 */
const TOKEN_KEY = "token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember = true) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Sends a just-signed-in user to the right place: their Home, the listings
 * (home seekers), their listings (signed up to rent out), the manager portal or
 * Admin. The rule is signInPath() in src/lib/housing.ts; /dashboard ("Your homes")
 * is the fallback.
 */
export async function goToLandingPage(router: { replace: (path: string) => void }) {
  const res = await apiFetch("/api/auth/me").catch(() => null);
  if (!res?.ok) { router.replace("/dashboard"); return; }
  router.replace(signInPath(await res.json()));
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  // A sign-in lasts 7 days; after that the stored one is stale. The server saying
  // "Unauthorized" means it no longer works: forget it, so every page treats the
  // person as signed out (fix F19, 2026-10-23). Not on the log-in and two-step code
  // screens, where 401 means a wrong password or code.
  if (res.status === 401 && token && !/^\/api\/auth\/(login|2fa)/.test(path)) clearToken();
  return res;
}
