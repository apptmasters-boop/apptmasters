"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, setToken, redirectToApartment } from "@/lib/api";

function ResendVerification({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    await apiFetch("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
    setSending(false);
    setSent(true);
  }

  if (sent) return <span className="block mt-1 text-indigo-600">Verification email sent!</span>;
  return (
    <button onClick={resend} disabled={sending} className="block mt-1 text-indigo-600 hover:underline disabled:opacity-50 text-left">
      {sending ? "Sending…" : "Resend verification email"}
    </button>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [code, setCode] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  async function afterLogin() {
    if (returnTo) { router.replace(returnTo); return; }
    await redirectToApartment(router);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

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

    // Check if 2FA is required
    const twoFaRes = await apiFetch("/api/auth/2fa/send", {
      method: "POST", body: JSON.stringify({ email: form.email }),
    });
    const twoFaData = await twoFaRes.json();

    if (twoFaData.required) {
      setStep("2fa");
      setLoading(false);
      return;
    }

    // No 2FA — complete login
    setToken(data.token);
    await afterLogin();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await apiFetch("/api/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ email: form.email, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Invalid code"); return; }
    setToken(data.token);
    await afterLogin();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {step === "credentials" ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-sm text-gray-500 mb-6">Sign in to ApptMasters</p>
            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
                {unverifiedEmail && <ResendVerification email={unverifiedEmail} />}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" required autoComplete="email"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required autoComplete="current-password"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <div className="text-center">
                <Link href="/forgot-password" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">
                  Forgot your password?
                </Link>
              </div>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <a href="/register" className="text-indigo-600 font-medium hover:underline">Sign up</a>
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <p className="text-3xl mb-2">🔐</p>
              <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
              <p className="text-sm text-gray-500 mt-1">
                We sent a 6-digit code to <strong>{form.email}</strong>
              </p>
            </div>
            {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" disabled={loading || code.length !== 6}
                className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button type="button" onClick={() => { setStep("credentials"); setCode(""); setError(""); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600">
                ← Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
