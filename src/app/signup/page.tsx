"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { safeReturnTo } from "@/lib/returnTo";
import AuthShell from "@/components/auth/AuthShell";
import { AuthField, PasswordField, FormError, PrimaryButton } from "@/components/auth/AuthFields";
import { MailIcon, LockIcon, UserIcon, UserPlusIcon, CheckIcon } from "@/components/landing/icons";

// Keep in sync with the schema in src/app/api/listings/signup/route.ts
const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "A letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
];

const HERO = {
  heroTitle: "Create your account",
  heroText: <><p>Join Apartment Masters and find your next home.</p><p className="mt-4">Safe. Simple. Community-driven.</p></>,
};

/** Shown after sign-up: the account only works once the emailed link is clicked. */
function CheckYourEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function resend() {
    setState("sending");
    await apiFetch("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
    setState("sent");
  }

  return (
    <AuthShell title="Check your email" subtitle="One last step to create your account" {...HERO}>
      <div className="space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MailIcon className="h-7 w-7" />
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          We sent a confirmation link to <strong className="text-gray-900">{email}</strong>.
          Click it to confirm your email and finish creating your account. The link expires in 24 hours.
        </p>
        <p className="text-sm text-gray-500">Can&apos;t find it? Check your spam folder.</p>
        <button type="button" onClick={resend} disabled={state !== "idle"}
          className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-60">
          {state === "sending" ? "Sending…" : state === "sent" ? "New link sent" : "Resend the link"}
        </button>
      </div>
      <p className="mt-8 text-center text-sm text-gray-600">
        Already confirmed? <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"), "/listings");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const passwordOk = PASSWORD_RULES.every(r => r.test(form.password));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk) { setError("Please choose a password that meets all the requirements."); return; }
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/listings/signup", { method: "POST", body: JSON.stringify({ ...form, returnTo }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setPendingEmail(data.email);
  }

  if (pendingEmail) return <CheckYourEmail email={pendingEmail} />;

  return (
    <AuthShell title="Create your account" subtitle="Start your journey with Apartment Masters" {...HERO}>
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
        <p className="text-center text-xs text-gray-500">We&apos;ll email you a link to confirm your address.</p>
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
