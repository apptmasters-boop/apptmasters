"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">ApptMasters</h1>
          <p className="text-gray-500 text-sm mt-1">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <p className="font-semibold text-gray-900">Check your inbox</p>
              <p className="text-sm text-gray-500">
                If an account exists for <strong>{email}</strong>, we sent a reset link. It expires in 1 hour.
              </p>
              <Link href="/login" className="block text-sm text-blue-600 hover:underline mt-4">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
