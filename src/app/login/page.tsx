"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, setToken, redirectToApartment } from "@/lib/api";
import { safeReturnTo } from "@/lib/returnTo";
import AuthShell from "@/components/auth/AuthShell";
import { AuthField, PasswordField, FormError, PrimaryButton } from "@/components/auth/AuthFields";
import { MailIcon, LockIcon, LogInIcon, ShieldCheckIcon } from "@/components/landing/icons";

function ResendVerification({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    await apiFetch("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
    setSending(false);
    setSent(true);
  }

  if (sent) return <span className="mt-1 block font-medium text-brand">Verification email sent!</span>;
  return (
    <button type="button" onClick={resend} disabled={sending} className="mt-1 block text-left font-medium text-brand hover:underline disabled:opacity-50">
      {sending ? "Sending…" : "Resend verification email"}
    </button>
  );
}

/**
 * Backup codes are 8 letters/digits shown as XXXX-XXXX (see
 * api/users/2fa/backup-codes). The server compares that exact form, so we
 * uppercase, drop anything else, and insert the dash as the user types.
 */
function formatBackupCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"), "") || null;
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup";

  async function afterLogin(token: string) {
    setToken(token, remember);
    if (returnTo) { router.replace(returnTo); return; }
    await redirectToApartment(router);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUnverifiedEmail("");

    // Step 1: verify credentials
    const res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.error === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(form.email);
        setError("Please verify your email before signing in.");
      } else {
        setError(data.error ?? "Login failed");
      }
      setLoading(false);
      return;
    }

    // 2FA accounts get a challenge instead of a token; the server has already emailed the code
    if (data.twoFactorRequired) {
      setChallenge(data.challenge);
      setStep("2fa");
      setLoading(false);
      return;
    }

    await afterLogin(data.token);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await apiFetch("/api/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ challenge, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Invalid code"); return; }
    await afterLogin(data.token);
  }

  if (step === "2fa") {
    return (
      <AuthShell title={useBackupCode ? "Use a backup code" : "Check your email"}
        subtitle={useBackupCode ? "Enter one of the backup codes you saved when you turned on two-factor sign-in" : `We sent a 6-digit code to ${form.email}`}
        heroTitle="Find a safe place with people you can trust."
        heroText={<p>Temporary housing. Real community.<br />A path to your independence.</p>}>
        <form onSubmit={handleVerify} className="space-y-4">
          {error && <FormError>{error}</FormError>}
          {useBackupCode ? (
            <AuthField key="backup" icon={<ShieldCheckIcon className="h-5 w-5" />} label="Backup code"
              type="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} required
              value={code} onChange={e => setCode(formatBackupCode(e.target.value))} placeholder="XXXX-XXXX" />
          ) : (
            <AuthField key="email-code" icon={<ShieldCheckIcon className="h-5 w-5" />} label="Login code"
              type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code"
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
          )}
          <PrimaryButton loading={loading} disabled={code.length !== (useBackupCode ? 9 : 6)} icon={<LogInIcon className="h-4 w-4" />}>
            {loading ? "Verifying…" : "Verify and sign in"}
          </PrimaryButton>
          <button type="button" onClick={() => { setUseBackupCode(b => !b); setCode(""); setError(""); }}
            className="w-full text-sm font-medium text-brand hover:underline">
            {useBackupCode ? "Use the code from my email instead" : "Lost access to your email? Use a backup code"}
          </button>
          <button type="button" onClick={() => { setStep("credentials"); setCode(""); setError(""); }}
            className="w-full text-sm text-gray-500 hover:text-gray-800">
            ← Use a different account
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Apartment Masters account"
      heroTitle="Find a safe place with people you can trust."
      heroText={<p>Temporary housing. Real community.<br />A path to your independence.</p>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <FormError>
            {error}
            {unverifiedEmail && <ResendVerification email={unverifiedEmail} />}
          </FormError>
        )}
        <AuthField icon={<MailIcon className="h-5 w-5" />} label="Email"
          type="email" required autoComplete="email" placeholder="you@example.com"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <PasswordField icon={<LockIcon className="h-5 w-5" />} label="Password"
          required autoComplete="current-password" placeholder="Enter your password"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />

        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-brand" />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
            Forgot your password?
          </Link>
        </div>

        <PrimaryButton loading={loading} icon={<LogInIcon className="h-4 w-4" />}>
          {loading ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href={signupHref} className="font-semibold text-brand hover:underline">Sign up</Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
