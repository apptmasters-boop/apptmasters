import { NextRequest } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.nextUrl.searchParams.get("token");
  const fakeReq = token
    ? new Request(req.url, { headers: { authorization: `Bearer ${token}` } })
    : req;
  const payload = getTokenFromRequest(fakeReq as NextRequest);
  if (!payload) return new Response("Unauthorized", { status: 401 });

  const { id: listingId } = await params;
  const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { ownerId: true } });
  if (!listing) return new Response("Not found", { status: 404 });

  let otherUserId: string;
  if (listing.ownerId === payload.userId) {
    const withUserId = req.nextUrl.searchParams.get("with");
    if (!withUserId) return new Response("Missing 'with' user", { status: 400 });
    otherUserId = withUserId;
  } else {
    otherUserId = listing.ownerId;
  }

  let lastId = req.nextUrl.searchParams.get("lastId") ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { /* closed */ }
      }, 25000);

      const poll = setInterval(async () => {
        try {
          const messages = await prisma.listingMessage.findMany({
            where: {
              listingId,
              OR: [
                { senderId: payload.userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: payload.userId },
              ],
              ...(lastId ? { id: { gt: lastId } } : {}),
            },
            include: { sender: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
            take: 20,
          });

          if (messages.length > 0) {
            lastId = messages[messages.length - 1].id;
            await prisma.listingMessage.updateMany({
              where: { listingId, senderId: otherUserId, receiverId: payload.userId, read: false },
              data: { read: true },
            });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(messages)}\n\n`));
          }
        } catch { /* closed */ }
      }, 1000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearInterval(poll);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
