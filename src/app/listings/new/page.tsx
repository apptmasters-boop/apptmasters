"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import ListingForm, { emptyListingForm, toPayload, ListingFormData } from "../_components/ListingForm";

export default function NewListingPage() {
  const router = useRouter();
  const [form, setForm] = useState<ListingFormData>(emptyListingForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace("/listings/signup?returnTo=/listings/new"); return; }
    setChecked(true);
  }, [router]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const res = await apiFetch("/api/listings", { method: "POST", body: JSON.stringify(toPayload(form)) });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    router.push("/listings/mine");
  }

  if (!checked) return <main className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">Loading…</main>;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Post a listing</h1>
      <p className="text-sm text-gray-500 mb-6">Your listing goes live once an admin reviews it — usually quick.</p>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ListingForm form={form} setForm={setForm} onSubmit={handleSubmit} submitting={submitting} submitLabel="Submit for review" error={error} />
      </div>
    </main>
  );
}
