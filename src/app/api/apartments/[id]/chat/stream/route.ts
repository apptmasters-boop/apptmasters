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

  const { id: apartmentId } = await params;
  const member = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!member) return new Response("Forbidden", { status: 403 });

  let lastId = req.nextUrl.searchParams.get("lastId") ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send a heartbeat every 25s to keep the connection alive
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { /* closed */ }
      }, 25000);

      // Poll for new messages every second
      const poll = setInterval(async () => {
        try {
          const where = lastId
            ? { apartmentId, id: { gt: lastId } }
            : { apartmentId };

          const messages = await prisma.chatMessage.findMany({
            where,
            include: { sender: { select: { id: true, name: true, photo: true } } },
            orderBy: { createdAt: "asc" },
            take: 20,
          });

          if (messages.length > 0) {
            lastId = messages[messages.length - 1].id;
            const data = JSON.stringify(messages);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } catch { /* db error or closed */ }
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
