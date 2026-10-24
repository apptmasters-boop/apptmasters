"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { safeReturnTo } from "@/lib/returnTo";
import AuthShell from "@/components/auth/AuthShell";
import FullPageLoading from "@/components/FullPageLoading";
import { AuthField, PasswordField, FormError, PrimaryButton } from "@/components/auth/AuthFields";
import { MailIcon, LockIcon, UserIcon, UserPlusIcon, CheckIcon } from "@/components/landing/icons";

// Keep in sync with the schema in src/app/api/listings/signup/route.ts
const PASSWORD_RULES = [
  { key: "rule8", test: (p: string) => p.length >= 8 },
  { key: "ruleLetter", test: (p: string) => /[A-Za-z]/.test(p) },
  { key: "ruleNumber", test: (p: string) => /[0-9]/.test(p) },
] as const;

/** The big title and lines beside the form on computers. */
function useHero() {
  const t = useTranslations("auth.signup");
  return {
    heroTitle: t("heroTitle"),
    heroText: <><p>{t("heroText")}</p><p className="mt-4">{t("heroTagline")}</p></>,
  };
}

/** Shown after sign-up: the account only works once the emailed link is clicked. */
function CheckYourEmail({ email }: { email: string }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const hero = useHero();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function resend() {
    setState("sending");
    await apiFetch("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
    setState("sent");
  }

  return (
    <AuthShell title={t("checkEmail.title")} subtitle={t("checkEmail.subtitle")} {...hero}>
      <div className="space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MailIcon className="h-7 w-7" />
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          {t.rich("checkEmail.sent", { email, strong: chunks => <strong className="text-gray-900"><bdi>{chunks}</bdi></strong> })}
        </p>
        <p className="text-sm text-gray-500">{t("checkEmail.spam")}</p>
        <button type="button" onClick={resend} disabled={state !== "idle"}
          className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-60">
          {state === "sending" ? common("sending") : state === "sent" ? t("checkEmail.newLinkSent") : t("checkEmail.resend")}
        </button>
      </div>
      <p className="mt-8 text-center text-sm text-gray-600">
        {t("checkEmail.alreadyConfirmed")} <Link href="/login" className="font-semibold text-brand hover:underline">{t("signIn")}</Link>
      </p>
    </AuthShell>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const hero = useHero();
  // What they were doing (a listing, a save, Post a listing…); empty when they just pressed Sign up.
  // It travels in the confirmation link; "What brings you…" comes after confirming (/welcome, step O1).
  const returnTo = safeReturnTo(searchParams.get("returnTo"), "");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const passwordOk = PASSWORD_RULES.every(r => r.test(form.password));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk) { setError(t("signup.chooseBetter")); return; }
    setLoading(true);
    setError("");
    const res = await apiFetch("/api/listings/signup", { method: "POST", body: JSON.stringify({ ...form, returnTo }) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? t("signup.failed"));
      return;
    }
    setPendingEmail(data.email);
  }

  if (pendingEmail) return <CheckYourEmail email={pendingEmail} />;

  return (
    <AuthShell title={t("signup.title")} subtitle={t("signup.subtitle")} {...hero}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <FormError>{error}</FormError>}
        <AuthField icon={<UserIcon className="h-5 w-5" />} label={t("signup.fullName")}
          type="text" required maxLength={80} autoComplete="name" placeholder={t("signup.namePlaceholder")}
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <AuthField icon={<MailIcon className="h-5 w-5" />} label={t("email")}
          type="email" required autoComplete="email" placeholder={t("emailPlaceholder")} dir="ltr"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <div>
          <PasswordField icon={<LockIcon className="h-5 w-5" />} label={t("password")}
            required autoComplete="new-password" placeholder={t("signup.passwordPlaceholder")}
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs" aria-label={t("signup.requirements")}>
            {PASSWORD_RULES.map(rule => {
              const met = rule.test(form.password);
              return (
                <li key={rule.key} className={`inline-flex items-center gap-1 ${met ? "text-brand" : "text-gray-500"}`}>
                  <CheckIcon className={`h-3.5 w-3.5 ${met ? "opacity-100" : "opacity-30"}`} />
                  {t(`signup.${rule.key}`)}
                  <span className="sr-only">{met ? t("signup.ruleDone") : t("signup.ruleMissing")}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <PrimaryButton loading={loading} icon={<UserPlusIcon className="h-4 w-4" />}>
          {loading ? t("signup.creating") : t("signup.create")}
        </PrimaryButton>
        <p className="text-center text-xs text-gray-500">{t("signup.weEmail")}</p>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600">
        {t("signup.haveAccount")}{" "}
        <Link href={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"} className="font-semibold text-brand hover:underline">{t("signIn")}</Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <SignupForm />
    </Suspense>
  );
}
