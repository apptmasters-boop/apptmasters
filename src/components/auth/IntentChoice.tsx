"use client";
/**
 * "What brings you to ApptMasters?" (step O1, owner 2026-10-18): asked right
 * after the email is confirmed (/welcome), required. "I…" sentences: the
 * owner's wording choice.
 */
import { CheckIcon, SearchIcon, HomeUsersIcon, KeyHouseIcon } from "@/components/landing/icons";
import type { Intent } from "@/lib/intent";

const CHOICES: { value: Intent; title: string; text: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { value: "FIND_HOME", title: "I'm looking for a place", text: "A room or an apartment", icon: SearchIcon },
  { value: "HAVE_HOME", title: "I already have a place", text: "Share rent, expenses and chores with my roommates", icon: HomeUsersIcon },
  { value: "RENT_OUT", title: "I have a place to rent out", text: "A room in my home, or an apartment I own", icon: KeyHouseIcon },
];

export default function IntentChoice({ value, onChange }: { value: Intent | null; onChange: (v: Intent) => void }) {
  return (
    <fieldset id="intent">
      <legend className="mb-2 text-sm font-semibold text-gray-900">What brings you to ApptMasters?</legend>
      <div className="space-y-2">
        {CHOICES.map(({ value: v, title, text, icon: Icon }) => {
          const on = value === v;
          return (
            <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40 ${
              on ? "border-brand bg-brand-soft/60" : "border-gray-200 hover:border-gray-300"}`}>
              <input type="radio" name="intent" value={v} checked={on} onChange={() => onChange(v)} className="sr-only" />
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">{title}</span>
                <span className="block text-xs text-gray-500">{text}</span>
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
