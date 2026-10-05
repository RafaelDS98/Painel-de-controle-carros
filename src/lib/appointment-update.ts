/** Monta o ÚNICO update da ficha (campos + Situação + Urgente) — conta 1 edição no limite. Função pura. */
import { normalizePlate, parseKm } from "@/lib/normalize";

export const fieldColumns: Record<string, string> = {
  date: "date", time: "time", plate: "plate", store: "store", model: "model",
  contact: "contact", workshop: "workshop", issue: "issue", note: "note",
  operator: "operator", externalOrder: "external_order", currentDeadline: "current_deadline",
  brand: "brand", contactNumber: "contact_number", kmScheduled: "km_scheduled",
  status: "status", priorityUrgent: "priority_urgent",
};

export function buildAppointmentUpdate(
  changes: Record<string, unknown>,
  currentCustom: Record<string, string>,
  opts: { canUrgent: boolean },
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (key === "customFields") { update["custom_fields"] = { ...currentCustom, ...(value as Record<string, string>) }; continue; }
    if (key === "priorityUrgent") { if (opts.canUrgent) update["priority_urgent"] = Boolean(value); continue; }
    const column = fieldColumns[key];
    if (!column) continue;
    if (key === "currentDeadline") update[column] = String(value || "") || null;
    else if (key === "kmScheduled") update[column] = parseKm(value as string) ?? null;
    else if (key === "plate") update[column] = normalizePlate(value as string);
    else update[column] = typeof value === "string" ? value.trim() : value;
  }
  return update;
}
