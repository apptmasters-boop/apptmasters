"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type State = "unsupported" | "loading" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function PushNotificationButton() {
  const [state, setState] = useState<State>("loading");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    // Register SW
    navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Check current subscription
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (Notification.permission === "denied") { setState("denied"); return; }
        setState(sub ? "subscribed" : "unsubscribed");
      });
    });
  }, []);

  async function subscribe() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await apiFetch("/api/push/subscribe").then(r => r.json());
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await apiFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) });
      setState("subscribed");
    } catch {
      if (Notification.permission === "denied") setState("denied");
    }
    setWorking(false);
  }

  async function unsubscribe() {
    setWorking(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiFetch("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("unsubscribed");
    setWorking(false);
  }

  if (state === "unsupported") return null;
  if (state === "loading") return null;

  if (state === "denied") {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500">
        <span>🔕</span>
        <span>Notifications blocked — enable in browser settings</span>
      </div>
    );
  }

  if (state === "subscribed") {
    return (
      <button onClick={unsubscribe} disabled={working}
        className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50">
        <span>🔔</span>
        {working ? "Turning off…" : "Push notifications on"}
      </button>
    );
  }

  return (
    <button onClick={subscribe} disabled={working}
      className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50">
      <span>🔔</span>
      {working ? "Enabling…" : "Enable push notifications"}
    </button>
  );
}
