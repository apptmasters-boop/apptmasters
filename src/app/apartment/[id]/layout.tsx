"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { HomeSidebar, HomeBottomBar, useChatUnread } from "@/components/home/HomeNav";

// Frame for every "My Home" page: side menu on computers, bottom bar on phones
// (Home | Household | Money | Chat | More). Pages draw their own headers; the
// bottom bar is 4rem tall, so full-height pages (chat) size against it.
export default function ApartmentLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [apartmentName, setApartmentName] = useState("");
  const unread = useChatUnread(id);

  useEffect(() => {
    apiFetch(`/api/apartments/${id}`).then(async res => {
      if (res.ok) { const apt = await res.json(); setApartmentName(apt.name ?? ""); }
    });
  }, [id]);

  return (
    <>
      <HomeSidebar apartmentId={id} apartmentName={apartmentName || "My Home"} unread={unread} />
      <div className="pb-16 md:pb-0 md:pl-64">
        {children}
      </div>
      <HomeBottomBar apartmentId={id} unread={unread} />
    </>
  );
}
