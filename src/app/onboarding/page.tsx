"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const DIETARY_OPTIONS = [
  { key: "VEGAN", label: "🌱 Vegan" },
  { key: "VEGETARIAN", label: "🥦 Vegetarian" },
  { key: "GLUTEN_FREE", label: "🌾 Gluten-free" },
  { key: "DAIRY_FREE", label: "🥛 Dairy-free" },
  { key: "NUT_FREE", label: "🥜 Nut-free" },
  { key: "HALAL", label: "☪️ Halal" },
  { key: "KOSHER", label: "✡️ Kosher" },
];

const STEPS = ["Welcome", "Your photo", "Your details", "Dietary", "Done"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [roomAssignment, setRoomAssignment] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [dietaryFlags, setDietaryFlags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/users/upload-photo", { method: "POST", body: fd });
    if (res.ok) { const { url } = await res.json(); setPhoto(url); }
    setUploading(false);
    e.target.value = "";
  }

  function toggleFlag(key: string) {
    setDietaryFlags(f => f.includes(key) ? f.filter(x => x !== key) : [...f, key]);
  }

  async function finish() {
    setSaving(true);
    await apiFetch("/api/users/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: name || undefined, photo: photo || undefined, roomAssignment: roomAssignment || undefined, moveInDate: moveInDate || undefined, dietaryFlags }),
    });
    router.replace("/dashboard");
  }

  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>{STEPS[step]}</span>
            <span>{step + 1} of {STEPS.length}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm space-y-6">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <p className="text-5xl">👋</p>
              <h1 className="text-2xl font-bold text-gray-900">Welcome to ApptMasters!</h1>
              <p className="text-gray-500 text-sm">Let's take 60 seconds to set up your profile so your roommates know who you are.</p>
              <button onClick={() => setStep(1)}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors">
                Get started
              </button>
              <button onClick={() => router.replace("/dashboard")}
                className="w-full text-sm text-gray-400 hover:text-gray-600">
                Skip for now
              </button>
            </div>
          )}

          {/* Step 1: Photo */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900">Add a profile photo</h2>
              <p className="text-sm text-gray-500">Help your roommates put a face to the name.</p>
              <div className="flex flex-col items-center gap-4">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Your photo" className="w-24 h-24 rounded-full object-cover border-2 border-blue-200" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-4xl">👤</div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="border border-dashed border-blue-300 text-blue-600 px-6 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors disabled:opacity-50">
                  {uploading ? "Uploading…" : photo ? "Change photo" : "Upload photo"}
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(2)}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors">
                  {photo ? "Next" : "Skip"}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900">A few details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room assignment</label>
                <input type="text" value={roomAssignment} onChange={e => setRoomAssignment(e.target.value)}
                  placeholder="e.g. Master bedroom, Room 2…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Move-in date</label>
                <input type="date" value={moveInDate} onChange={e => setMoveInDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={() => setStep(3)}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors">
                Next
              </button>
            </div>
          )}

          {/* Step 3: Dietary */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900">Dietary preferences</h2>
              <p className="text-sm text-gray-500">Helps roommates plan shared meals and groceries.</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => toggleFlag(key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${dietaryFlags.includes(key) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(4)}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors">
                Next
              </button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <p className="text-5xl">🎉</p>
              <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
              <p className="text-gray-500 text-sm">Your profile is ready. Head to your dashboard to explore your apartment.</p>
              <button onClick={finish} disabled={saving}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Go to dashboard"}
              </button>
            </div>
          )}

        </div>

        {step > 0 && step < 4 && (
          <button onClick={() => setStep(s => s - 1)} className="mt-4 text-sm text-gray-400 hover:text-gray-600 w-full text-center">
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
