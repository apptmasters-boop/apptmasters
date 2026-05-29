"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const DIETARY_OPTIONS: { key: string; label: string }[] = [
  { key: "VEGAN", label: "🌱 Vegan" },
  { key: "VEGETARIAN", label: "🥦 Vegetarian" },
  { key: "GLUTEN_FREE", label: "🌾 Gluten-free" },
  { key: "DAIRY_FREE", label: "🥛 Dairy-free" },
  { key: "NUT_FREE", label: "🥜 Nut-free" },
  { key: "HALAL", label: "☪️ Halal" },
  { key: "KOSHER", label: "✡️ Kosher" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", photo: "", roomAssignment: "", moveInDate: "", dietaryFlags: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({ pushEnabled: true, emailEnabled: true });
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/users/notification-prefs").then(async res => {
      if (res.ok) setNotifPrefs(await res.json());
    });
    apiFetch("/api/auth/me").then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      const data = await res.json();
      setForm({
        name: data.name ?? "",
        photo: data.photo ?? "",
        roomAssignment: data.roomAssignment ?? "",
        moveInDate: data.moveInDate ? data.moveInDate.slice(0, 10) : "",
        dietaryFlags: JSON.parse(data.dietaryFlags || "[]"),
      });
      setLoading(false);
    });
  }, [router]);

  function toggleFlag(key: string) {
    setForm(f => ({
      ...f,
      dietaryFlags: f.dietaryFlags.includes(key)
        ? f.dietaryFlags.filter(x => x !== key)
        : [...f.dietaryFlags, key],
    }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/users/upload-photo", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setForm(f => ({ ...f, photo: url }));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Upload failed.");
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwSaving(true);
    const res = await apiFetch("/api/users/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwError(data.error ?? "Something went wrong.");
    } else {
      setPwSaved(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwSaved(false), 2000);
    }
    setPwSaving(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await apiFetch("/api/users/profile", { method: "PATCH", body: JSON.stringify(form) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
        <span className="text-gray-300">|</span>
        <span className="font-bold text-gray-900">My profile</span>
      </header>

      <main className="max-w-md mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            {form.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photo} alt="Avatar" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
                {form.name ? form.name[0].toUpperCase() : "?"}
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
                <input
                  type="text" placeholder="https://… or upload below" value={form.photo}
                  onChange={e => setForm(f => ({ ...f, photo: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">Paste a link, or upload a file below.</p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Upload from device"}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room assignment</label>
            <input
              type="text" placeholder="e.g. Master bedroom, Room 2…"
              value={form.roomAssignment}
              onChange={e => setForm(f => ({ ...f, roomAssignment: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Move-in date</label>
            <input
              type="date" value={form.moveInDate}
              onChange={e => setForm(f => ({ ...f, moveInDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dietary flags</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => toggleFlag(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${form.dietaryFlags.includes(key) ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit" disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saved ? "Saved!" : saving ? "Saving…" : "Save profile"}
          </button>
        </form>

        <form onSubmit={handlePasswordChange} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-900">Change password</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password" required value={pwForm.currentPassword}
              onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password" required minLength={8} value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password" required value={pwForm.confirmPassword}
              onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          <button
            type="submit" disabled={pwSaving}
            className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            {pwSaved ? "Password changed!" : pwSaving ? "Saving…" : "Change password"}
          </button>
        </form>

        {/* Notification preferences */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-4 mt-6">
          <h2 className="text-sm font-semibold text-gray-900">Notification preferences</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-700">Push notifications</p>
                <p className="text-xs text-gray-400">Browser / device alerts</p>
              </div>
              <button type="button" onClick={() => setNotifPrefs(p => ({ ...p, pushEnabled: !p.pushEnabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifPrefs.pushEnabled ? "bg-indigo-600" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs.pushEnabled ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-700">Email notifications</p>
                <p className="text-xs text-gray-400">Expenses, disputes, messages</p>
              </div>
              <button type="button" onClick={() => setNotifPrefs(p => ({ ...p, emailEnabled: !p.emailEnabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifPrefs.emailEnabled ? "bg-indigo-600" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs.emailEnabled ? "translate-x-5" : ""}`} />
              </button>
            </label>
          </div>
          <button disabled={notifSaving} onClick={async () => {
            setNotifSaving(true);
            await apiFetch("/api/users/notification-prefs", { method: "PATCH", body: JSON.stringify(notifPrefs) });
            setNotifSaving(false);
          }} className="w-full bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors">
            {notifSaving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </main>
    </div>
  );
}
