"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, setToken } from "@/lib/api";
import { safeReturnTo } from "@/lib/returnTo";
import AuthShell from "@/components/auth/AuthShell";
import { CheckIcon } from "@/components/landing/icons";

// Landing page for the link in the confirmation email (see src/lib/emailVerification.ts).
function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnTo(searchParams.get("returnTo"), "/dashboard");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("No confirmation token found. Please use the link from your email.");
      return;
    }

    apiFetch("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Confirmation failed.");
        return;
      }
      setToken(data.token);
      setStatus("success");
      setTimeout(() => router.replace(next), 2000);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hero = {
    heroTitle: "Welcome to Apartment Masters",
    heroText: <p>Temporary housing. Real community.<br />A path to your independence.</p>,
  };

  if (status === "loading") {
    return (
      <AuthShell title="Confirming your email…" subtitle="This only takes a moment" {...hero}>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </AuthShell>
    );
  }

  if (status === "success") {
    return (
      <AuthShell title="Email confirmed!" subtitle="Your account is ready" {...hero}>
        <div className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
            <CheckIcon className="h-7 w-7" />
          </div>
          <p className="text-sm text-gray-700">You&apos;re signed in. Taking you there now…</p>
          <Link href={next} className="inline-block text-sm font-semibold text-brand hover:underline">Continue</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="This link didn't work" subtitle="It may have expired or already been used" {...hero}>
      <div className="space-y-5">
        <p className="text-sm text-gray-700">{errorMsg}</p>
        <p className="text-sm text-gray-500">
          If you already confirmed, just sign in. Otherwise, try signing in and we&apos;ll offer to send a new link.
        </p>
        <Link href="/login"
          className="flex w-full items-center justify-center rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark">
          Go to sign in
        </Link>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Loading…</div>}>
      <VerifyEmail />
    </Suspense>
  );
}
