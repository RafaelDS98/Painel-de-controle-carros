export type PeriodPreset = "today" | "week" | "month" | "custom";

const businessDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
export function saoPauloDate(date: Date) {
  const parts = businessDate.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function periodRange(preset: Exclude<PeriodPreset, "custom">, today = saoPauloDate(new Date())) {
  if (preset === "today") return { start: today, end: today };
  if (preset === "month") {
    const [year, month] = today.split("-").map(Number);
    return { start: `${today.slice(0, 7)}-01`, end: `${today.slice(0, 7)}-${String(new Date(Date.UTC(year ?? 2000, month ?? 1, 0)).getUTCDate()).padStart(2, "0")}` };
  }
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(today, -(day === 0 ? 6 : day - 1));
  return { start: monday, end: shiftDate(monday, 5) };
}

export function weekRange(today = saoPauloDate(new Date())) {
  return periodRange("week", today);
}

export function pendingDeliveries<T extends { date: string; status: string }>(items: T[], start: string, end: string) {
  return items.filter((item) => item.status !== "Finalizado" && item.date >= start && item.date <= end).length;
}