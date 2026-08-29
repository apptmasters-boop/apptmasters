"use client";
import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const LIFESTYLE_OPTIONS = [
  { key: "non-smoker", label: "🚭 Non-smoker" },
  { key: "pet-friendly", label: "🐾 Pet-friendly" },
  { key: "quiet-household", label: "🤫 Quiet household" },
  { key: "early-riser", label: "🌅 Early riser" },
  { key: "night-owl", label: "🌙 Night owl" },
  { key: "student-friendly", label: "🎓 Student-friendly" },
];

export interface ListingFormData {
  type: "APARTMENT_FOR_RENT" | "ROOM_TO_SHARE";
  title: string;
  description: string;
  price: string;
  priceMax: string;
  city: string;
  state: string;
  address: string;
  bedrooms: string;
  bathrooms: string;
  availableFrom: string;
  leaseLength: string;
  roommateGenderPref: string;
  roommateAgeMin: string;
  roommateAgeMax: string;
  roommateOccupation: string;
  roommateSmoking: string;
  roommatePets: string;
  roommateLifestyleTags: string[];
  roommateCulturalNotes: string;
  photoUrls: string[];
}

export const emptyListingForm: ListingFormData = {
  type: "APARTMENT_FOR_RENT",
  title: "",
  description: "",
  price: "",
  priceMax: "",
  city: "",
  state: "",
  address: "",
  bedrooms: "",
  bathrooms: "",
  availableFrom: "",
  leaseLength: "",
  roommateGenderPref: "",
  roommateAgeMin: "",
  roommateAgeMax: "",
  roommateOccupation: "",
  roommateSmoking: "",
  roommatePets: "",
  roommateLifestyleTags: [],
  roommateCulturalNotes: "",
  photoUrls: [],
};

export function toPayload(form: ListingFormData) {
  return {
    type: form.type,
    title: form.title,
    description: form.description,
    price: parseFloat(form.price),
    priceMax: form.priceMax ? parseFloat(form.priceMax) : undefined,
    city: form.city,
    state: form.state || undefined,
    address: form.address || undefined,
    bedrooms: form.bedrooms ? parseInt(form.bedrooms, 10) : undefined,
    bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : undefined,
    availableFrom: form.availableFrom || undefined,
    leaseLength: form.leaseLength || undefined,
    roommateGenderPref: form.roommateGenderPref || undefined,
    roommateAgeMin: form.roommateAgeMin ? parseInt(form.roommateAgeMin, 10) : undefined,
    roommateAgeMax: form.roommateAgeMax ? parseInt(form.roommateAgeMax, 10) : undefined,
    roommateOccupation: form.roommateOccupation || undefined,
    roommateSmoking: form.roommateSmoking || undefined,
    roommatePets: form.roommatePets || undefined,
    roommateLifestyleTags: form.roommateLifestyleTags,
    roommateCulturalNotes: form.roommateCulturalNotes || undefined,
    photoUrls: form.photoUrls,
  };
}

interface Props {
  form: ListingFormData;
  setForm: (updater: (f: ListingFormData) => ListingFormData) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  error?: string | null;
  rejectionReason?: string | null;
}

export default function ListingForm({ form, setForm, onSubmit, submitting, submitLabel, error, rejectionReason }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (form.photoUrls.length >= 8) { e.target.value = ""; return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await apiFetch("/api/upload/listing-photo", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setForm(f => ({ ...f, photoUrls: [...f.photoUrls, url] }));
    }
    setUploading(false);
    e.target.value = "";
  }

  function removePhoto(url: string) {
    setForm(f => ({ ...f, photoUrls: f.photoUrls.filter(u => u !== url) }));
  }

  function toggleLifestyleTag(key: string) {
    setForm(f => ({
      ...f,
      roommateLifestyleTags: f.roommateLifestyleTags.includes(key)
        ? f.roommateLifestyleTags.filter(t => t !== key)
        : [...f.roommateLifestyleTags, key],
    }));
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="space-y-5">
      {rejectionReason && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Not approved — please fix and resubmit</p>
          <p className="text-sm text-amber-800">{rejectionReason}</p>
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 mb-2 block font-medium">What are you listing?</label>
        <div className="flex gap-2">
          {(["APARTMENT_FOR_RENT", "ROOM_TO_SHARE"] as const).map(t => (
            <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                form.type === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
              }`}>
              {t === "APARTMENT_FOR_RENT" ? "Apartment for rent" : "Room to share"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
        <input type="text" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Sunny 2BR near downtown"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <textarea required rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Tell people about the place…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {form.type === "ROOM_TO_SHARE" ? "Rent ($/mo)" : "Price ($/mo)"}
          </label>
          <input type="number" required min="0" step="1" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Up to (optional, for a range)</label>
          <input type="number" min="0" step="1" value={form.priceMax} onChange={e => setForm(f => ({ ...f, priceMax: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
          <input type="text" required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">State (optional)</label>
          <input type="text" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Address (optional — shown to everyone browsing)</label>
        <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Bedrooms (0 = studio)</label>
          <input type="number" min="0" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Bathrooms</label>
          <input type="number" min="0" step="0.5" value={form.bathrooms} onChange={e => setForm(f => ({ ...f, bathrooms: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Available from</label>
          <input type="date" value={form.availableFrom} onChange={e => setForm(f => ({ ...f, availableFrom: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Lease length</label>
          <input type="text" placeholder="e.g. 1 year, month-to-month" value={form.leaseLength} onChange={e => setForm(f => ({ ...f, leaseLength: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {form.type === "ROOM_TO_SHARE" && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Roommate you're looking for (all optional)</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Gender preference</label>
              <select value={form.roommateGenderPref} onChange={e => setForm(f => ({ ...f, roommateGenderPref: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">No preference</option>
                <option value="ANY">Any</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Occupation</label>
              <select value={form.roommateOccupation} onChange={e => setForm(f => ({ ...f, roommateOccupation: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">No preference</option>
                <option value="STUDENT">Student</option>
                <option value="PROFESSIONAL">Working professional</option>
                <option value="EITHER">Either</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Age min</label>
              <input type="number" min="18" value={form.roommateAgeMin} onChange={e => setForm(f => ({ ...f, roommateAgeMin: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Age max</label>
              <input type="number" min="18" value={form.roommateAgeMax} onChange={e => setForm(f => ({ ...f, roommateAgeMax: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Smoking</label>
              <select value={form.roommateSmoking} onChange={e => setForm(f => ({ ...f, roommateSmoking: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">No preference</option>
                <option value="NO">Non-smoker preferred</option>
                <option value="YES">Smoking ok</option>
                <option value="EITHER">No preference</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pets</label>
              <select value={form.roommatePets} onChange={e => setForm(f => ({ ...f, roommatePets: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">No preference</option>
                <option value="NO">No pets</option>
                <option value="YES">Pets ok</option>
                <option value="EITHER">No preference</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Lifestyle</label>
            <div className="flex flex-wrap gap-2">
              {LIFESTYLE_OPTIONS.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => toggleLifestyleTag(key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    form.roommateLifestyleTags.includes(key) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Language / cultural / religious notes (optional)</label>
            <textarea rows={2} value={form.roommateCulturalNotes} onChange={e => setForm(f => ({ ...f, roommateCulturalNotes: e.target.value }))}
              placeholder="e.g. Fulani-speaking household, halal kitchen…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Photos (1–8)</label>
        <div className="flex flex-wrap gap-2">
          {form.photoUrls.map(url => (
            <div key={url} className="relative w-20 h-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
              <button type="button" onClick={() => removePhoto(url)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center">
                ×
              </button>
            </div>
          ))}
          {form.photoUrls.length < 8 && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors disabled:opacity-50">
              {uploading ? "…" : "+"}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
        {form.photoUrls.length === 0 && <p className="text-xs text-gray-400 mt-1.5">At least one photo is required.</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting || uploading || form.photoUrls.length === 0}
        className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        {submitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
