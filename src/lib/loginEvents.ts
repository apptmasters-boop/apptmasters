import { prisma } from "@/lib/db";

interface LoginEventParams {
  userId: string;
  ip: string;
  userAgent: string | null;
  success: boolean;
}

export async function recordLoginEvent({ userId, ip, userAgent, success }: LoginEventParams) {
  await prisma.loginEvent.create({
    data: { userId, ip, userAgent, success },
  }).catch(() => {}); // never block the login flow
}

// Lightweight device/browser label from a raw User-Agent string — no external dependency.
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser =
    userAgent.includes("Edg/") ? "Edge" :
    userAgent.includes("OPR/") ? "Opera" :
    userAgent.includes("Chrome/") ? "Chrome" :
    userAgent.includes("CriOS") ? "Chrome" :
    userAgent.includes("Firefox/") ? "Firefox" :
    userAgent.includes("Safari/") ? "Safari" :
    "Unknown browser";

  const os =
    userAgent.includes("iPhone") ? "iPhone" :
    userAgent.includes("iPad") ? "iPad" :
    userAgent.includes("Android") ? "Android" :
    userAgent.includes("Mac OS X") ? "Mac" :
    userAgent.includes("Windows") ? "Windows" :
    userAgent.includes("Linux") ? "Linux" :
    "Unknown device";

  return `${browser} on ${os}`;
}
