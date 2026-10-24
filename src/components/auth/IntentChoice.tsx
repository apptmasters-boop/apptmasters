"use client";
/**
 * "What brings you to ApptMasters?" (step O1, owner 2026-10-18): asked right
 * after the email is confirmed (/welcome), required. "I…" sentences: the
 * owner's wording choice.
 */
import { useTranslations } from "next-intl";
import { CheckIcon, SearchIcon, HomeUsersIcon, KeyHouseIcon } from "@/components/landing/icons";
import type { Intent } from "@/lib/intent";

/** The words are intent.<CHOICE>.title / .text in messages/<language>.json (T1). */
const CHOICES: { value: Intent; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { value: "FIND_HOME", icon: SearchIcon },
  { value: "HAVE_HOME", icon: HomeUsersIcon },
  { value: "RENT_OUT", icon: KeyHouseIcon },
];

export default function IntentChoice({ value, onChange }: { value: Intent | null; onChange: (v: Intent) => void }) {
  const t = useTranslations("intent");
  return (
    <fieldset id="intent">
      <legend className="mb-2 text-sm font-semibold text-gray-900">{t("question")}</legend>
      <div className="space-y-2">
        {CHOICES.map(({ value: v, icon: Icon }) => {
          const on = value === v;
          return (
            <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40 ${
              on ? "border-brand bg-brand-soft/60" : "border-gray-200 hover:border-gray-300"}`}>
              <input type="radio" name="intent" value={v} checked={on} onChange={() => onChange(v)} className="sr-only" />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">{t(`${v}.title`)}</span>
                <span className="block text-xs text-gray-500">{t(`${v}.text`)}</span>
              </span>
              <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-brand bg-brand text-white" : "border-gray-300"}`}>
                {on && <CheckIcon className="h-3 w-3" />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
