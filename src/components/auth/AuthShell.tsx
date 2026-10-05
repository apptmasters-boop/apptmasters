import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/landing/SiteChrome";
import { ArrowLeftIcon, ClipboardCheckIcon, UsersIcon, ShieldCheckIcon } from "@/components/landing/icons";

/**
 * Shared layout for the sign-in and sign-up pages.
 *
 * Desktop (lg+): photo panel on the left with the marketing message and trust
 * badges, form on the right. Mobile: the photo becomes a short header with the
 * page title, and the form card overlaps it. The header only offers
 * "Back to home" so the form stays the focus.
 */
export default function AuthShell({ title, subtitle, heroTitle, heroText, children }: {
  title: string;
  subtitle: string;
  heroTitle: string;
  heroText: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 lg:items-center lg:justify-center lg:p-8">
        <div className="flex w-full flex-col lg:grid lg:max-w-6xl lg:grid-cols-2 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-gray-200 lg:bg-white lg:shadow-xl lg:shadow-black/5">
          {/* Photo: short header on mobile, full-height panel on desktop */}
          <div className="relative h-56 sm:h-64 lg:h-auto lg:min-h-[600px]">
            <Image src="/landing/hero.png" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" fetchPriority="high"
              className="object-cover object-[50%_58%]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f26]/90 via-black/45 to-black/20" />
            <div className="absolute inset-x-0 bottom-0 p-5 pb-10 text-white sm:p-8 sm:pb-12 lg:p-10">
              {/* Mobile shows the form's own title here; desktop shows the marketing message */}
              <h1 className="text-[28px] font-bold leading-tight lg:hidden">{title}</h1>
              <p className="mt-1 text-sm text-white/85 lg:hidden">{subtitle}</p>
              <div className="hidden lg:block">
                <h2 className="max-w-md text-4xl font-bold leading-[1.1]">{heroTitle}</h2>
                <div className="mt-4 max-w-md text-base leading-relaxed text-white/90">{heroText}</div>
                <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
                  <li className="inline-flex items-center gap-2"><ClipboardCheckIcon className="h-4 w-4" />Reviewed listings</li>
                  <li className="inline-flex items-center gap-2"><UsersIcon className="h-4 w-4" />Trusted community</li>
                  <li className="inline-flex items-center gap-2"><ShieldCheckIcon className="h-4 w-4" />Safe &amp; secure</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="relative -mt-6 flex-1 rounded-t-3xl bg-white px-5 pb-10 pt-7 sm:px-10 lg:mt-0 lg:flex lg:items-center lg:rounded-none lg:px-14 lg:py-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-6 hidden lg:block">
                <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
