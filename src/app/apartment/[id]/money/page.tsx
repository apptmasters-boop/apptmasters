"use client";
import { useParams } from "next/navigation";
import { HubPage, HubSection } from "@/components/home/HubPage";
import { ScaleIcon, CalendarIcon, DollarIcon } from "@/components/landing/icons";

// Money tab (PRODUCT_LOGIC §11). Sprint 5 adds the unified Overview / Activity /
// Balances view on top; for now it leads to the existing finance pages.
export default function MoneyPage() {
  const { id } = useParams<{ id: string }>();
  const at = (path: string) => `/apartment/${id}/${path}`;
  return (
    <HubPage title="Money" subtitle="Rent, shared expenses and the household fund.">
      <HubSection items={[
        { href: at("finance"), label: "Shared expenses & balances", description: "Who paid, who owes, settle up", icon: ScaleIcon },
        { href: at("rent"), label: "Rent", description: "Monthly rent and who has paid", icon: CalendarIcon },
        { href: at("fund"), label: "Shared fund", description: "The household's common pot", icon: DollarIcon },
      ]} />
    </HubPage>
  );
}
