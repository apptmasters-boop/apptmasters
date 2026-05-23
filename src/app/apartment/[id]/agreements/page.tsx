"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

const PRESET_KEYS = [
  { key: "LEASE_START", label: "Lease start date", placeholder: "e.g. 2025-09-01" },
  { key: "LEASE_END", label: "Lease end date", placeholder: "e.g. 2026-08-31" },
  { key: "RENT_DUE_DAY", label: "Rent due day", placeholder: "e.g. 1st of each month" },
  { key: "WIFI_NAME", label: "WiFi network name", placeholder: "e.g. AptMasters_5G" },
  { key: "WIFI_PASSWORD", label: "WiFi password", placeholder: "e.g. supersecret123" },
  { key: "EMERGENCY_CONTACT", label: "Emergency contact", placeholder: "e.g. John Smith — 555-1234" },
];

interface Agreement { id: string; key: string; label: string; value: string; updatedAt: string }

export default function AgreementsPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  async function load() {
    const [agrRes, aptRes] = await Promise.all([
      apiFetch(`/api/apartments/${apartmentId}/agreements`),
      apiFetch(`/api/apartments/${apartmentId}`),
    ]);
    if (agrRes.status === 401) { router.replace("/login"); return; }
    const data: Agreement[] = await agrRes.json();
    setAgreements(data);
    const vals: Record<string, string> = {};
    data.forEach(a => { vals[a.key] = a.value; });
    setValues(vals);
    if (aptRes.ok) { const apt = await aptRes.json(); setIsAdmin(apt.currentUserRole === "ADMIN"); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [apartmentId]);

  async function save(key: string, label: string) {
    setSaving(true);
    await apiFetch(`/api/apartments/${apartmentId}/agreements`, {
      method: "POST",
      body: JSON.stringify({ key, label, value: values[key] ?? "" }),
    });
    setSaving(false);
    setEditing(null);
    load();
  }

  async function saveCustom(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const key = `CUSTOM_${customKey.toUpperCase().replace(/\s+/g, "_")}`;
    await apiFetch(`/api/apartments/${apartmentId}/agreements`, {
      method: "POST",
      body: JSON.stringify({ key, label: customLabel, value: customValue }),
    });
    setCustomKey(""); setCustomLabel(""); setCustomValue("");
    setShowCustom(false);
    setSaving(false);
    load();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  const agreementMap = Object.fromEntries(agreements.map(a => [a.key, a]));
  const customAgreements = agreements.filter(a => a.key.startsWith("CUSTOM_"));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-900">Shared Agreements</span>
        </div>
        <NotificationBell apartmentId={apartmentId} />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        <p className="text-sm text-gray-500 mb-4">
          Key info everyone in the apartment should know.{!isAdmin && " Contact an admin to update these."}
        </p>

        {/* Preset agreements */}
        {PRESET_KEYS.map(({ key, label, placeholder }) => {
          const existing = agreementMap[key];
          const isEditing = editing === key;
          return (
            <div key={key} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                {isAdmin && !isEditing && (
                  <button onClick={() => { setEditing(key); setValues(v => ({ ...v, [key]: existing?.value ?? "" })); }}
                    className="text-xs text-indigo-500 hover:underline">
                    {existing ? "Edit" : "Set"}
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="flex gap-2 mt-2">
                  <input type="text" value={values[key] ?? ""} placeholder={placeholder}
                    onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button onClick={() => save(key, label)} disabled={saving}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {saving ? "…" : "Save"}
                  </button>
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-500 px-2">Cancel</button>
                </div>
              ) : (
                <p className={`text-sm mt-0.5 ${existing ? "text-gray-900 font-medium" : "text-gray-400 italic"}`}>
                  {existing?.value || "Not set"}
                </p>
              )}
              {existing && !isEditing && (
                <p className="text-[10px] text-gray-400 mt-1">Updated {new Date(existing.updatedAt).toLocaleDateString()}</p>
              )}
            </div>
          );
        })}

        {/* Custom agreements */}
        {customAgreements.map(a => (
          <div key={a.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{a.label}</p>
              {isAdmin && (
                <button onClick={() => { setEditing(a.key); setValues(v => ({ ...v, [a.key]: a.value })); }}
                  className="text-xs text-indigo-500 hover:underline">Edit</button>
              )}
            </div>
            {editing === a.key ? (
              <div className="flex gap-2 mt-2">
                <input type="text" value={values[a.key] ?? ""}
                  onChange={e => setValues(v => ({ ...v, [a.key]: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => save(a.key, a.label)} disabled={saving}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {saving ? "…" : "Save"}
                </button>
                <button onClick={() => setEditing(null)} className="text-xs text-gray-500 px-2">Cancel</button>
              </div>
            ) : (
              <p className="text-sm text-gray-900 font-medium mt-0.5">{a.value}</p>
            )}
          </div>
        ))}

        {/* Add custom */}
        {isAdmin && (
          showCustom ? (
            <form onSubmit={saveCustom} className="bg-white border border-dashed border-gray-300 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Add custom info</h3>
              <input required type="text" placeholder="Label (e.g. Parking spot)" value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input required type="text" placeholder="Value" value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {saving ? "…" : "Add"}
                </button>
                <button type="button" onClick={() => setShowCustom(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowCustom(true)}
              className="w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
              + Add custom info
            </button>
          )
        )}
      </main>
    </div>
  );
}
