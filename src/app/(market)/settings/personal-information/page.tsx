"use client";
/**
 * Personal information (fix F13, owner 2026-10-17): change your photo and
 * name; your email and whether it's verified. People who live in a Home also
 * set their room, move-in date and dietary needs here. My Profile shows them.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { initials, refreshMe, type Me } from "@/components/market/useMe";
import { Card, PageTitle, field, fieldLabel, loading, pageWidth, primaryButton, useSignedIn } from "@/components/market/SettingsList";
import { DIETARY_OPTIONS, parseDietary } from "@/lib/dietary";
import { CameraIcon, CheckIcon } from "@/components/landing/icons";

const noChange = () => () => {};

function PersonalForm({ me }: { me: Me }) {
  const resident = me.homes.length > 0;
  const [name, setName] = useState(me.name);
  const [photo, setPhoto] = useState(me.photo ?? "");
  const [room, setRoom] = useState(me.roomAssignment ?? "");
  const [moveIn, setMoveIn] = useState(me.moveInDate ? me.moveInDate.slice(0, 10) : "");
  const [dietary, setDietary] = useState(() => parseDietary(me.dietaryFlags));
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [photoNote, setPhotoNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [resend, setResend] = useState<"" | "sending" | "sent">("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setPhotoNote("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/users/upload-photo", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPhotoNote(data.error ?? "Upload failed.");
      setUploading(false);
      return;
    }
    // The file keeps the same name each time: the version makes the new photo show at once.
    const url = `${(await res.json()).url}?v=${Date.now()}`;
    const saved = await apiFetch("/api/users/profile", { method: "PATCH", body: JSON.stringify({ photo: url }) });
    setUploading(false);
    if (!saved.ok) { setPhotoNote("Couldn't save the photo. Try again."); return; }
    setPhoto(url);
    setPhotoNote("Photo saved.");
    refreshMe();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const body = resident ? { name, roomAssignment: room, moveInDate: moveIn, dietaryFlags: dietary } : { name };
    const res = await apiFetch("/api/users/profile", { method: "PATCH", body: JSON.stringify(body) });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) refreshMe();
  }

  async function resendVerification() {
    setResend("sending");
    await apiFetch("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email: me.email }) });
    setResend("sent");
  }

  const toggleDiet = (key: string) => {
    setStatus("");
    setDietary(list => list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  };

  return (
    <>
      <Card title="Photo">
        <div className="flex items-center gap-4">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Your photo" className="h-20 w-20 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl font-semibold text-brand dark:bg-brand/30 dark:text-emerald-200">{initials(name)}</span>
          )}
          <div className="min-w-0">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={uploadPhoto} />
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800">
              <CameraIcon className="h-4 w-4" />{uploading ? "Uploading…" : photo ? "Change photo" : "Add a photo"}
            </button>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">JPG, PNG, WebP or GIF, up to 5 MB.</p>
            {photoNote && <p role="status" className="mt-1 text-sm text-gray-700 dark:text-gray-200">{photoNote}</p>}
          </div>
        </div>
      </Card>

      <form onSubmit={save}>
        <Card title="About you">
          <div className="space-y-4">
            <div>
              <label htmlFor="pi-name" className={fieldLabel}>Name</label>
              <input id="pi-name" type="text" required value={name} autoComplete="name"
                onChange={e => { setName(e.target.value); setStatus(""); }} className={field} />
            </div>
            <div>
              <p className={fieldLabel}>Email</p>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950">
                <span className="min-w-0 truncate text-sm text-gray-800 dark:text-gray-100">{me.email}</span>
                {me.emailVerified ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand dark:text-emerald-300"><CheckIcon className="h-4 w-4" />Verified</span>
                ) : (
                  <span className="flex shrink-0 items-center gap-2 text-sm">
                    <span className="font-medium text-amber-600">Not verified</span>
                    {resend === "sent" ? <span className="text-brand">Email sent</span> : (
                      <button type="button" onClick={resendVerification} disabled={resend === "sending"} className="font-semibold text-brand hover:underline disabled:opacity-50">
                        {resend === "sending" ? "Sending…" : "Resend"}
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {resident && (
          <Card id="home-details" title="Home details" description="Shown to the people you live with.">
            <div className="space-y-4">
              <div>
                <label htmlFor="pi-room" className={fieldLabel}>Room</label>
                <input id="pi-room" type="text" value={room} placeholder="e.g. Master bedroom, Room 2…"
                  onChange={e => { setRoom(e.target.value); setStatus(""); }} className={field} />
              </div>
              <div>
                <label htmlFor="pi-move-in" className={fieldLabel}>Move-in date</label>
                <input id="pi-move-in" type="date" value={moveIn}
                  onChange={e => { setMoveIn(e.target.value); setStatus(""); }} className={field} />
              </div>
              <fieldset>
                <legend className={fieldLabel}>Dietary needs</legend>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(({ key, label }) => {
                    const on = dietary.includes(key);
                    return (
                      <button key={key} type="button" aria-pressed={on} onClick={() => toggleDiet(key)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? "border-brand bg-brand text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </Card>
        )}

        <button type="submit" disabled={status === "saving"} className={`${primaryButton} mt-6`}>
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <p role="status" className="mt-2 min-h-5 text-center text-sm">
          {status === "saved" && <span className="text-brand dark:text-emerald-300">Saved.</span>}
          {status === "error" && <span className="text-red-600">Couldn&apos;t save. Try again.</span>}
        </p>
      </form>
    </>
  );
}

export default function PersonalInformationPage() {
  const me = useSignedIn();
  // Opened from My Profile's Edit: going back returns there.
  const fromProfile = useSyncExternalStore(noChange, () => new URLSearchParams(window.location.search).get("from") === "profile", () => false);
  const ready = !!me;

  useEffect(() => {
    if (ready && window.location.hash === "#home-details") document.getElementById("home-details")?.scrollIntoView();
  }, [ready]);

  if (!me) return loading;
  return (
    <main className={pageWidth}>
      <PageTitle back={fromProfile ? { href: "/profile", label: "My Profile" } : { href: "/settings", label: "Settings" }}
        title="Personal information" subtitle="Your name and photo show to your roommates and in your messages." />
      <PersonalForm me={me} />
    </main>
  );
}
