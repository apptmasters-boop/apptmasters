import { redirect } from "next/navigation";

// Stats and Analytics became one Insights page (Sprint 10b); old links land there.
export default async function OldInsightsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/apartment/${id}/insights`);
}
