import Link from "next/link";
import { HomeIcon, SearchIcon, PlusCircleIcon, UserIcon } from "./icons";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Apartment Masters home">
      <svg className="h-8 w-8 text-brand" viewBox="0 0 32 32" aria-hidden>
        <path fill="currentColor" d="M16 3 3 13.5V29h9v-9h8v9h9V13.5L16 3Z" />
      </svg>
      <span className="text-[15px] font-bold leading-[1.05] text-gray-900">
        Apartment
        <br />
        Masters
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/", label: "Find a Home" },
  { href: "/listings", label: "Browse listings" },
  { href: "/listings/new", label: "List a space" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((n, i) => (
              <Link key={n.href} href={n.href}
                className={`relative py-5 text-sm font-medium transition-colors ${i === 0 ? "text-brand" : "text-gray-600 hover:text-gray-900"}`}>
                {n.label}
                {i === 0 && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
            Sign in
          </Link>
          <Link href="/register" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/listings", label: "Search", icon: SearchIcon },
  { href: "/listings/new", label: "List a Space", icon: PlusCircleIcon },
  { href: "/login", label: "Sign in", icon: UserIcon },
];

export function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }, i) => (
          <li key={href}>
            <Link href={href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${i === 0 ? "text-brand" : "text-gray-500"}`}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
