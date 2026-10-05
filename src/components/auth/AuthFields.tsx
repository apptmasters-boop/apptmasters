"use client";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/landing/icons";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id">;

/** Bordered field with a leading icon and a small label above the input, as in the auth mockups. */
export function AuthField({ icon, label, trailing, ...input }: InputProps & { icon: ReactNode; label: string; trailing?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
      <span className="shrink-0 text-gray-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-[11px] text-gray-500">{label}</label>
        <input id={id} {...input}
          className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none" />
      </div>
      {trailing}
    </div>
  );
}

/** AuthField for passwords, with a show/hide toggle. */
export function PasswordField(props: InputProps & { icon: ReactNode; label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <AuthField {...props} type={visible ? "text" : "password"}
      trailing={
        <button type="button" onClick={() => setVisible(v => !v)}
          aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}
          className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      } />
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

export function PrimaryButton({ loading, icon, children, disabled }: { loading: boolean; icon: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60">
      {icon}
      {children}
    </button>
  );
}
