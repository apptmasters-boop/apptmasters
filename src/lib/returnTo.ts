/**
 * Validates a "returnTo" value (where to send the user after sign-in/sign-up).
 *
 * Only same-site paths are allowed. Anything else, e.g. "https://evil.example"
 * or "//evil.example" (which browsers treat as another site), falls back, so a
 * crafted apptmasters.com link can't bounce people to a look-alike site after
 * they log in (an "open redirect").
 */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
