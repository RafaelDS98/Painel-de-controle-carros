import type { Tables } from "@/integrations/supabase/types";

export type StatusOption = Tables<"status_options">;
export type FieldDefinition = Tables<"custom_field_definitions">;
export type CustomValues = Record<string, string>;

export const statusColors: Record<string, string> = {
  "status-blue": "border-status-blue/40 bg-status-blue text-status-blue-foreground",
  "status-amber": "border-status-amber/40 bg-status-amber text-status-amber-foreground",
  "status-orange": "border-status-orange/40 bg-status-orange text-status-orange-foreground",
  "status-green": "border-status-green/40 bg-status-green text-status-green-foreground",
  "status-purple": "border-status-purple/40 bg-status-purple text-status-purple-foreground",
  "status-gray": "border-status-gray/40 bg-status-gray text-status-gray-foreground",
};
export const colorNames: Record<string, string> = {
  "status-blue": "Azul", "status-amber": "Amarelo", "status-orange": "Laranja",
  "status-green": "Verde", "status-purple": "Roxo", "status-gray": "Cinza",
};
export function customValues(value: unknown): CustomValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
export function fieldKey(label: string) {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
