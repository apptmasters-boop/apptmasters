import { NextRequest } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  // SSE: accept token from query param since EventSource can't set headers
  const token = req.nextUrl.searchParams.get("token");
  const fakeReq = token
    ? new Request(req.url, { headers: { authorization: `Bearer ${token}` } })
    : req;
  const payload = getTokenFromRequest(fakeReq as NextRequest);
  if (!payload) return new Response("Unauthorized", { status: 401 });

  const { id: apartmentId, userId: otherUserId } = await params;
  const member = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  let lastId = req.nextUrl.searchParams.get("lastId") ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { /* closed */ }
      }, 25000);

      const poll = setInterval(async () => {
        try {
          const messages = await prisma.directMessage.findMany({
            where: {
              apartmentId,
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
            // Mark incoming messages as read
            await prisma.directMessage.updateMany({
              where: { apartmentId, senderId: otherUserId, receiverId: payload.userId, read: false },
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
