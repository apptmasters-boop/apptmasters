import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRightIcon } from "@/components/landing/icons";

export interface HubItem {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

/**
 * Page frame for the Household, Money and More tabs: a title and compact
 * grouped lists (PRODUCT_LOGIC §7, §23: compact navigation, not large colored
 * menu cards). Primary pages, so no back arrow.
 */
export function HubPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 md:py-10">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </main>
  );
}

export function HubSection({ title, items }: { title?: string; items: HubItem[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      {title && <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>}
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {items.map(({ href, label, description, icon: Icon }) => (
          <li key={href + label}>
            <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/30 dark:text-emerald-200">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900">{label}</span>
                <span className="block truncate text-xs text-gray-500">{description}</span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
