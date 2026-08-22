export function nextDueDate(frequency: string, from: Date = new Date()): Date {
  const d = new Date(from);
  if (frequency === "DAILY") d.setDate(d.getDate() + 1);
  else if (frequency === "WEEKLY") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1); // MONTHLY
  return d;
}

// Next occurrence of the given weekday (0=Sunday..6=Saturday), always at least 1 day after `from`.
export function nextWeekdayDate(weekday: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
}
