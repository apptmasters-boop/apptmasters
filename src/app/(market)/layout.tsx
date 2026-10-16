"use client";
import { MarketShell } from "@/components/market/MarketChrome";

/** Saved, More, How It Works and Help share the marketplace header and phone bar (Sprint 12). */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return <MarketShell>{children}</MarketShell>;
}
