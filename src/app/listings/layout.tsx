"use client";
import { useEffect, useState } from "react";
import ListingsNav from "@/components/ListingsNav";
import ApartmentSidebar from "@/components/ApartmentSidebar";
import { apiFetch, getToken } from "@/lib/api";

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apartment, setApartment] = useState<{ id: string; name: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!getToken()) { setApartment(null); return; }
    apiFetch("/api/auth/me").then(async res => {
      if (!res.ok) return;
      const me = await res.json();
      setIsSuperAdmin(me.systemRole === "SUPER_ADMIN");
      const memberships: { apartment: { id: string; name: string } }[] = me.memberships ?? [];
      setApartment(memberships.length > 0 ? memberships[0].apartment : null);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {apartment && (
        <ApartmentSidebar
          apartmentId={apartment.id}
          apartmentName={apartment.name}
          isSuperAdmin={isSuperAdmin}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      <div className={apartment ? "md:pl-64" : ""}>
        <ListingsNav onOpenMenu={apartment ? () => setSidebarOpen(true) : undefined} />
        {children}
      </div>
    </div>
  );
}
