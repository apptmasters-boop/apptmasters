import { redirect } from "next/navigation";

// The grocery list is part of Household → Shopping now (Sprint 4a); old links and notifications land there.
export default async function GroceryRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/apartment/${id}/shopping`);
}
