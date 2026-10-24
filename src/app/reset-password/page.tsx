"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageButton from "@/components/LanguageButton";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.reset");
  const common = useTranslations("common");
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError(t("mismatch")); return; }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? t("failed")); }
    else { setDone(true); setTimeout(() => router.replace("/login"), 2500); }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-red-500 font-medium">{t("invalidLink")}</p>
        <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">{t("requestNew")}</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="font-semibold text-gray-900">{t("updated")}</p>
        <p className="text-sm text-gray-500">{t("redirecting")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">{t("newPassword")}</label>
        <input id="new-password" type="password" required minLength={8} value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 mt-0.5">{t("minimum")}</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">{t("confirmNew")}</label>
        <input id="confirm-password" type="password" required value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {loading ? common("saving") : t("set")}
      </button>
    </form>
  );
}

function Loading() {
  const common = useTranslations("common");
  return <div className="text-center text-gray-400 text-sm">{common("loading")}</div>;
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  return (
    <div className="relative min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <LanguageButton className="absolute end-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">ApptMasters</h1>
          <p className="text-gray-500 text-sm mt-1">{t("reset.subtitle")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <Suspense fallback={<Loading />}>
            <ResetForm />
          </Suspense>
        </div>
        <p className="text-center mt-4">
          <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">{t("forgot.backToSignIn")}</Link>
        </p>
      </div>
    </div>
  );
}
