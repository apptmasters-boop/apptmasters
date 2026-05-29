"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface AuditEntry {
  id: string; action: string; entityType: string; entityId: string | null;
  meta: string; createdAt: string;
  user: { id: string; name: string } | null;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  ROLE_CHANGED:        { label: "Role changed",         icon: "🔄", color: "text-blue-600" },
  STATUS_CHANGED:      { label: "Status changed",       icon: "📋", color: "text-amber-600" },
  MEMBER_REMOVED:      { label: "Member removed",       icon: "🚪", color: "text-red-600" },
  DISPUTE_RESOLVED:    { label: "Dispute resolved",     icon: "🤝", color: "text-green-600" },
  DISPUTE_DISMISSED:   { label: "Dispute dismissed",    icon: "🗑️", color: "text-gray-500" },
  SYSTEM_ROLE_CHANGED: { label: "System role changed",  icon: "⚙️", color: "text-purple-600" },
  ACCOUNT_DELETED:     { label: "Account deleted",      icon: "❌", color: "text-red-700" },
};

export default function AuditPage() {
  const { id: apartmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/apartments/${apartmentId}/audit`).then(async res => {
      if (res.status === 401) { router.replace("/login"); return; }
      if (res.status === 403) { router.replace(`/apartment/${apartmentId}`); return; }
      if (res.ok) setLogs(await res.json());
      setLoading(false);
    });
  }, [apartmentId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href={`/apartment/${apartmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Apartment</Link>
        <span className="text-gray-300">|</span>
        <span className="font-bold text-gray-900">Audit Log</span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{logs.length} entries</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {logs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-gray-500">No audit entries yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {logs.map(log => {
              const info = ACTION_LABELS[log.action] ?? { label: log.action, icon: "📝", color: "text-gray-600" };
              const meta = JSON.parse(log.meta || "{}");
              return (
                <div key={log.id} className="px-5 py-4 flex items-start gap-3">
                  <span className="text-xl mt-0.5">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${info.color}`}>{info.label}</span>
                      {log.user && <span className="text-xs text-gray-400">by {log.user.name}</span>}
                    </div>
                    {Object.keys(meta).length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
