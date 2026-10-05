import type React from "react";
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
/** Hexadecimal equivalente aos tokens antigos (só para exibir no seletor). */
export const tokenHex: Record<string, string> = {
  "status-blue": "#BFDBFE", "status-amber": "#FDE68A", "status-orange": "#FED7AA",
  "status-green": "#BBF7D0", "status-purple": "#DDD6FE", "status-gray": "#E5E7EB",
};
export const NEUTRAL_STATUS_CLASS = "border-input bg-muted text-foreground";
export function isHexColor(v: unknown): v is string { return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v); }
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const raw = v.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) return `#${raw.split("").map((c) => c + c).join("").toUpperCase()}`;
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}
function luminance(hex: string) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r = 0, g = 0, b = 0] = ch;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const LIGHT_TEXT = "#FFFFFF";
const DARK_TEXT = "#111827";
export function contrastText(hex: string) {
  const L = luminance(hex);
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio(L, luminance(LIGHT_TEXT)) >= ratio(L, luminance(DARK_TEXT)) ? LIGHT_TEXT : DARK_TEXT;
}
export function statusColorProps(token: unknown): { className: string; style: React.CSSProperties } {
  if (typeof token === "string" && statusColors[token]) return { className: statusColors[token], style: {} };
  if (isHexColor(token)) {
    const hex = token.toUpperCase();
    return { className: "border", style: { backgroundColor: hex, borderColor: `${hex}66`, color: contrastText(hex) } };
  }
  return { className: NEUTRAL_STATUS_CLASS, style: {} };
}
export function customValues(value: unknown): CustomValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
export function fieldKey(label: string) {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
