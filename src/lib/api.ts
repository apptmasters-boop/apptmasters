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

export async function redirectToApartment(router: { replace: (path: string) => void }) {
  // Every account lands on /dashboard first — it's the shared, role-aware
  // welcome screen (stats + a "continue to your area" card), not a bounce.
  router.replace("/dashboard");
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
