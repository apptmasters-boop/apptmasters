"use client";
import { MarketShell } from "@/components/market/MarketChrome";

/** Find a Home pages share the marketplace header and phone bar (Sprint 12; MARKETPLACE_FLOW.md §13). */
export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return <MarketShell>{children}</MarketShell>;
}
