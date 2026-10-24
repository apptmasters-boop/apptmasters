"use client";
import { useTranslations } from "next-intl";

/** "Loading…" in the middle of the screen, in the reader's language (T1). */
export default function FullPageLoading() {
  const common = useTranslations("common");
  return <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">{common("loading")}</div>;
}
