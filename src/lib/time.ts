export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (date >= todayStart) return time;
  if (date >= yesterdayStart) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}
