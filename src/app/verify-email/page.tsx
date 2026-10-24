"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch, setToken } from "@/lib/api";
import { safeReturnTo } from "@/lib/returnTo";
import AuthShell, { HeroLines } from "@/components/auth/AuthShell";
import FullPageLoading from "@/components/FullPageLoading";
import { CheckIcon } from "@/components/landing/icons";

// Landing page for the link in the confirmation email (see src/lib/emailVerification.ts).
function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.verify");
  const common = useTranslations("common");
  // After confirming: "What brings you to ApptMasters?" (/welcome, step O1), which then goes on to
  // what they were doing (the link's returnTo) or the answer's start page.
  const back = safeReturnTo(searchParams.get("returnTo"), "");
  const next = back ? `/welcome?returnTo=${encodeURIComponent(back)}` : "/welcome";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg(t("noToken"));
      return;
    }

    apiFetch("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? t("failed"));
        return;
      }
      setToken(data.token);
      setStatus("success");
      setTimeout(() => router.replace(next), 1500);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hero = { heroTitle: t("heroTitle"), heroText: <HeroLines /> };

  if (status === "loading") {
    return (
      <AuthShell title={t("confirming")} subtitle={t("moment")} {...hero}>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </AuthShell>
    );
  }

  if (status === "success") {
    return (
      <AuthShell title={t("confirmed")} subtitle={t("ready")} {...hero}>
        <div className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
            <CheckIcon className="h-7 w-7" />
          </div>
          <p className="text-sm text-gray-700">{t("signedIn")}</p>
          <button type="button" onClick={() => router.replace(next)}
            className="inline-block text-sm font-semibold text-brand hover:underline">{common("continue")}</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("didntWork")} subtitle={t("expired")} {...hero}>
      <div className="space-y-5">
        <p className="text-sm text-gray-700">{errorMsg}</p>
        <p className="text-sm text-gray-500">{t("help")}</p>
        <Link href="/login"
          className="flex w-full items-center justify-center rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark">
          {t("goToSignIn")}
        </Link>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <VerifyEmail />
    </Suspense>
  );
}
