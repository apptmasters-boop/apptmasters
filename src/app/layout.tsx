import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import DarkModeProvider from "@/components/DarkModeProvider";
import { dirOf } from "@/i18n/locales";

export const dynamic = "force-dynamic";

// The lettering in the owner's designs (Sprint 13a; docs/mockups/).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Arabic letters (translation T1): after Inter, so Latin text keeps Inter. Not preloaded:
// the browser only downloads it when a page shows Arabic.
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: "ApptMasters",
    description: t("description"),
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "ApptMasters",
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1d5c4b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The reader's language (cookie, else the browser's); Arabic reads right to left.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${inter.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <DarkModeProvider />
          <ServiceWorkerRegistrar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
