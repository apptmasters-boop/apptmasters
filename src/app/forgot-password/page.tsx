"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageButton from "@/components/LanguageButton";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <LanguageButton className="absolute end-4 top-4" />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">ApptMasters</h1>
          <p className="text-gray-500 text-sm mt-1">{t("forgot.subtitle")}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <p className="font-semibold text-gray-900">{t("forgot.checkInbox")}</p>
              <p className="text-sm text-gray-500">
                {t.rich("forgot.sent", { email, strong: chunks => <strong><bdi>{chunks}</bdi></strong> })}
              </p>
              <Link href="/login" className="block text-sm text-blue-600 hover:underline mt-4">
                {t("forgot.backToSignIn")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">{t("forgot.emailAddress")}</label>
                <input
                  id="forgot-email" type="email" required value={email} dir="ltr"
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? common("sending") : t("forgot.send")}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
                  {t("forgot.backToSignIn")}
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
