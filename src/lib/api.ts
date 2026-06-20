export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export async function redirectToApartment(router: { replace: (path: string) => void }) {
  const res = await apiFetch("/api/auth/me");
  if (res.ok) {
    const data = await res.json();
    const memberships: { apartment: { id: string } }[] = data.memberships ?? [];
    if (memberships.length > 0) {
      router.replace(`/apartment/${memberships[0].apartment.id}`);
      return;
    }
  }
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
