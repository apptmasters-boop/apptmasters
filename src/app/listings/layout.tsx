"use client";
import { useEffect, useState } from "react";
import ListingsNav from "@/components/ListingsNav";
import { HomeSidebar, HomeBottomBar, useChatUnread } from "@/components/home/HomeNav";
import { apiFetch, getToken } from "@/lib/api";

/** Home navigation for people who belong to an apartment (they reach listings from More). */
function MemberNav({ apartment }: { apartment: { id: string; name: string } }) {
  const unread = useChatUnread(apartment.id);
  return (
    <>
      <HomeSidebar apartmentId={apartment.id} apartmentName={apartment.name} unread={unread} />
      <HomeBottomBar apartmentId={apartment.id} unread={unread} />
    </>
  );
}

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  const [apartment, setApartment] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!getToken()) { setApartment(null); return; }
    apiFetch("/api/auth/me").then(async res => {
      if (!res.ok) return;
      const me = await res.json();
      const memberships: { apartment: { id: string; name: string } }[] = me.memberships ?? [];
      setApartment(memberships.length > 0 ? memberships[0].apartment : null);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {apartment && <MemberNav apartment={apartment} />}
      <div className={apartment ? "pb-16 md:pb-0 md:pl-64" : ""}>
        <ListingsNav />
        {children}
      </div>
    </div>
  );
}
