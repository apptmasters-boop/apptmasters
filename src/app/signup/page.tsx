"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, setToken } from "@/lib/api";
import AuthShell from "@/components/auth/AuthShell";
import { AuthField, PasswordField, FormError, PrimaryButton } from "@/components/auth/AuthFields";
import { MailIcon, LockIcon, UserIcon, UserPlusIcon, CheckIcon } from "@/components/landing/icons";

// Keep in sync with the schema in src/app/api/listings/signup/route.ts
const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "A letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
];

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/listings";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordOk = PASSWORD_RULES.every(r => r.test(form.password));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk) { setError("Please choose a password that meets all the requirements."); return; }
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/listings/signup", { method: "POST", body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    setToken(data.token);
    router.replace(returnTo);
  }

  return (
    <AuthShell title="Create your account" subtitle="Start your journey with Apartment Masters"
      heroTitle="Create your account"
      heroText={<><p>Join Apartment Masters and find your next home.</p><p className="mt-4">Safe. Simple. Community-driven.</p></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <FormError>{error}</FormError>}
        <AuthField icon={<UserIcon className="h-5 w-5" />} label="Full name"
          type="text" required maxLength={80} autoComplete="name" placeholder="John Doe"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <AuthField icon={<MailIcon className="h-5 w-5" />} label="Email"
          type="email" required autoComplete="email" placeholder="you@example.com"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <div>
          <PasswordField icon={<LockIcon className="h-5 w-5" />} label="Password"
            required autoComplete="new-password" placeholder="At least 8 characters"
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs" aria-label="Password requirements">
            {PASSWORD_RULES.map(rule => {
              const met = rule.test(form.password);
              return (
                <li key={rule.label} className={`inline-flex items-center gap-1 ${met ? "text-brand" : "text-gray-500"}`}>
                  <CheckIcon className={`h-3.5 w-3.5 ${met ? "opacity-100" : "opacity-30"}`} />
                  {rule.label}
                  <span className="sr-only">{met ? "(done)" : "(missing)"}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <PrimaryButton loading={loading} icon={<UserPlusIcon className="h-4 w-4" />}>
          {loading ? "Creating account…" : "Create account"}
        </PrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
