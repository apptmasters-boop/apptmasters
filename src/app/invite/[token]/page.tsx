"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { setToken } from "@/lib/api";

interface InviteInfo {
  email: string;
  unitNumber: string;
  buildingName: string;
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${params.token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => setError("Failed to load invite"))
      .finally(() => setLoading(false));
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/invite/${params.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }
    setToken(data.token);
    router.replace("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Checking invite…
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {error === "Already used" ? "Invite already used" : error === "Expired" ? "Invite expired" : "Invalid invite"}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {error === "Already used"
              ? "This invite link has already been accepted. Please sign in."
              : error === "Expired"
              ? "This invite link has expired. Contact your landlord for a new one."
              : "This invite link is not valid. Please check the link and try again."}
          </p>
          <a href="/login" className="inline-block w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-6">
            <p className="text-4xl mb-3">🏠</p>
            <h1 className="text-xl font-bold text-gray-900">Welcome to {info.buildingName}</h1>
            <p className="text-sm text-gray-500 mt-1">Unit {info.unitNumber}</p>
          </div>

          <p className="text-sm text-gray-600 mb-5 text-center">
            Create your account for <span className="font-medium text-gray-900">{info.email}</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Full name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                required placeholder="Your name"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}"
                title="At least 8 characters, with at least one letter and one number"
                placeholder="Create a password"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-400 mt-1">At least 8 characters, with a letter and a number</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}

            <button type="submit" disabled={submitting}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {submitting ? "Creating account…" : "Create account & join"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-5">
            Already have an account?{" "}
            <a href="/login" className="text-indigo-600 hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
