"use client";
/**
 * "What brings you to ApptMasters?" (step O1, owner 2026-10-18): right after the email
 * is confirmed, and at the next sign-in if it was left. Moved here from the sign-up form
 * at the owner's request, so that form stays short. Required: Continue waits for a choice.
 * Pre-selected from what they were doing (returnTo); then back to it when it fits the
 * answer, otherwise to the answer's start (Home, Create a Home, Post a listing).
 */
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch, getToken } from "@/lib/api";
import { safeReturnTo } from "@/lib/returnTo";
import { signInPath } from "@/lib/housing";
import { afterSignup, intentFromReturnTo, type Intent } from "@/lib/intent";
import { forgetMe } from "@/components/market/useMe";
import AuthShell from "@/components/auth/AuthShell";
import FullPageLoading from "@/components/FullPageLoading";
import IntentChoice from "@/components/auth/IntentChoice";
import { FormError, PrimaryButton } from "@/components/auth/AuthFields";
import { ArrowRightIcon } from "@/components/landing/icons";

function Welcome() {
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"), "");
  const [intent, setIntent] = useState<Intent | null>(() => intentFromReturnTo(returnTo));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("auth.welcome");
  const common = useTranslations("common");
  const hero = {
    heroTitle: t("heroTitle"),
    heroText: <><p>{t("heroText")}</p><p className="mt-4">{t("heroTagline")}</p></>,
  };

  // Signed in only; someone who already answered goes straight on.
  useEffect(() => {
    if (!getToken()) { router.replace(`/login?returnTo=${encodeURIComponent("/welcome")}`); return; }
    let current = true;
    apiFetch("/api/auth/me").then(async res => {
      if (!current) return;
      if (!res.ok) { router.replace("/login"); return; }
      const me = await res.json();
      if (me.intent) router.replace(returnTo || signInPath(me));
      else setReady(true);
    });
    return () => { current = false; };
  }, [router, returnTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!intent) return;
    setSaving(true);
    setError("");
    const res = await apiFetch("/api/users/intent", { method: "POST", body: JSON.stringify({ intent }) });
    if (!res.ok && res.status !== 409) {
      setError((await res.json().catch(() => null))?.error ?? common("somethingWrong"));
      setSaving(false);
      return;
    }
    forgetMe(); // the header and Home load the answer next
    router.replace(afterSignup(intent, returnTo));
  }

  if (!ready) return <FullPageLoading />;

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")} {...hero}>
      <form onSubmit={submit} className="space-y-5">
        {error && <FormError>{error}</FormError>}
        <IntentChoice value={intent} onChange={setIntent} />
        <PrimaryButton loading={saving} disabled={!intent} icon={<ArrowRightIcon className="h-4 w-4" />}>
          {saving ? common("saving") : intent ? common("continue") : t("chooseOne")}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <Welcome />
    </Suspense>
  );
}
