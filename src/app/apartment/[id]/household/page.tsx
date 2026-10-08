"use client";
import { useParams } from "next/navigation";
import { HubPage, HubSection } from "@/components/home/HubPage";
import { BroomIcon, CartIcon, RepeatIcon, BoxIcon, ClipboardCheckIcon, BedIcon, UsersIcon, ScaleIcon } from "@/components/landing/icons";

// Household tab (PRODUCT_LOGIC §7). Sprint 3/4 add a "This week" activity view on top.
export default function HouseholdPage() {
  const { id } = useParams<{ id: string }>();
  const at = (path: string) => `/apartment/${id}/${path}`;
  return (
    <HubPage title="Household" subtitle="Day-to-day responsibilities, shared by everyone at home.">
      <HubSection items={[
        { href: at("cleaning"), label: "Cleaning", description: "Whole-home cleaning rotation", icon: BroomIcon },
        { href: at("grocery"), label: "Shopping list", description: "Shared grocery list", icon: CartIcon },
        { href: at("rotation"), label: "Shopping rotation", description: "Whose turn it is to shop", icon: RepeatIcon },
        { href: at("inventory"), label: "Inventory", description: "What the household has at home", icon: BoxIcon },
        { href: at("chores"), label: "Chores", description: "Optional small tasks", icon: ClipboardCheckIcon },
        { href: at("rooms"), label: "Rooms", description: "Rooms and their condition", icon: BedIcon },
      ]} />
      <HubSection title="People & agreements" items={[
        { href: at("members"), label: "Members", description: "Who lives here, invites, travel", icon: UsersIcon },
        { href: at("rules"), label: "House rules", description: "Rules and proposals to vote on", icon: ScaleIcon },
      ]} />
    </HubPage>
  );
}
