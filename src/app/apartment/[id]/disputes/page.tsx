import { redirect } from "next/navigation";

// "Disputes" became Household issues (Sprint 10a); old links and notifications land there.
export default async function DisputesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/apartment/${id}/issues`);
}
