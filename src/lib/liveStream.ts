/**
 * Opens a live (Server-Sent Events) connection to one of the /stream routes.
 *
 * The login token never goes in the URL: each connection first exchanges it
 * for a 60-second stream ticket (POST /api/stream-ticket; see signStreamTicket
 * in src/lib/auth.ts). Because a ticket expires, the browser's built-in
 * EventSource reconnect (which reuses the old URL) can't be relied on, so on
 * any error we close the connection and reconnect with a fresh ticket, backing
 * off from 2 s up to 30 s.
 *
 * Usage in a page:
 *   useEffect(() => openLiveStream(`/api/apartments/${id}/chat/stream`, onData), [id]);
 */
import { apiFetch } from "@/lib/api";

const MIN_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;

export function openLiveStream(path: string, onMessage: (data: unknown) => void): () => void {
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryMs = MIN_RETRY_MS;
  let closed = false;

  function scheduleReconnect() {
    if (closed) return;
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }

  async function connect() {
    if (closed) return;
    const res = await apiFetch("/api/stream-ticket", { method: "POST" }).catch(() => null);
    if (closed) return;
    if (!res?.ok) {
      // 401: signed out, nothing to stream. Anything else: try again later.
      if (res?.status !== 401) scheduleReconnect();
      return;
    }
    const { ticket } = (await res.json()) as { ticket: string };
    if (closed) return;

    const url = `${path}${path.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(ticket)}`;
    source = new EventSource(url);
    source.onopen = () => { retryMs = MIN_RETRY_MS; };
    source.onmessage = e => onMessage(JSON.parse(e.data));
    source.onerror = () => {
      source?.close();
      source = null;
      scheduleReconnect();
    };
  }

  connect();

  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    source?.close();
  };
}
