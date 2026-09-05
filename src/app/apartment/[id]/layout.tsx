"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import ApartmentSidebar from "@/components/ApartmentSidebar";

export default function ApartmentLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apartmentName, setApartmentName] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    apiFetch(`/api/apartments/${id}`).then(async res => {
      if (res.ok) { const apt = await res.json(); setApartmentName(apt.name ?? ""); }
    });
    apiFetch("/api/auth/me").then(async res => {
      if (res.ok) { const me = await res.json(); setIsSuperAdmin(me.systemRole === "SUPER_ADMIN"); }
    });
  }, [id]);

  return (
    <>
      <ApartmentSidebar
        apartmentId={id}
        apartmentName={apartmentName || "Apartment"}
        isSuperAdmin={isSuperAdmin}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile-only menu bar — h-12 is a fixed, deliberate height: pages with their own h-screen flex layout (chat) size against it */}
      <div className="md:hidden sticky top-0 z-30 h-12 bg-white border-b border-gray-200 px-3 flex items-center gap-2">
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-500 truncate">{apartmentName}</span>
      </div>

      <div className="md:pl-64">
        {children}
      </div>
    </>
  );
}
