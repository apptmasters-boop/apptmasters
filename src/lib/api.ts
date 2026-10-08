import { landingPath } from "@/lib/housing";

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
 * (home seekers), the manager portal or Admin. The rule is landingPath() in
 * src/lib/housing.ts; /dashboard ("Your homes") is the fallback.
 */
export async function goToLandingPage(router: { replace: (path: string) => void }) {
  const res = await apiFetch("/api/auth/me").catch(() => null);
  if (!res?.ok) { router.replace("/dashboard"); return; }
  router.replace(landingPath(await res.json()));
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
  return res;
}
