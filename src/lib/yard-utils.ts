import { safeText } from "@/lib/normalize";
import type { StatusOption } from "@/lib/agenda-config";

export interface YardSettings {
  timer_green_hours: number;
  timer_yellow_hours: number;
  check_in_required: boolean;
  check_out_required: boolean;
  photo_capture_enabled: boolean;
  photo_upload_enabled: boolean;
  photo_max_mb: number;
  notification_sound_enabled: boolean;
  polling_seconds: number;
  toast_duration_ms: number;
  new_highlight_minutes: number;
  editable_fields: string[];
}

export const DEFAULT_YARD_SETTINGS: YardSettings = {
  timer_green_hours: 4,
  timer_yellow_hours: 24,
  check_in_required: true,
  check_out_required: true,
  photo_capture_enabled: false,
  photo_upload_enabled: false,
  photo_max_mb: 10,
  notification_sound_enabled: true,
  polling_seconds: 30,
  toast_duration_ms: 4000,
  new_highlight_minutes: 5,
  editable_fields: ["status", "note", "operator", "current_deadline", "contact", "contact_number", "issue"],
};

export interface YardAppointment {
  dbId: string;
  plate: string;
  model: string;
  brand: string;
  status: string;
  workshop: string;
  store: string;
  contact: string;
  contactNumber: string;
  issue: string;
  note: string;
  operator: string;
  currentDeadline: string | null;
  registeredAt: string;
  checkInAt: string | null;
  checkInNote: string | null;
  checkInPhotoUrl: string | null;
  checkInBy: string | null;
  checkOutAt: string | null;
  checkOutNote: string | null;
  checkOutPhotoUrl: string | null;
  checkOutBy: string | null;
  osNumber: number | null;
  priorityUrgent: boolean;
  lastStatusChangeAt: string | null;
  forwardedAt?: string | null;
}

export type TimerLevel = "ok" | "warn" | "danger";

export function timerLevel(elapsedMs: number, settings: YardSettings): TimerLevel {
  const hours = elapsedMs / 3_600_000;
  if (hours < settings.timer_green_hours) return "ok";
  if (hours < settings.timer_yellow_hours) return "warn";
  return "danger";
}

export function timerColorClass(level: TimerLevel): string {
  switch (level) {
    case "ok": return "text-green-600 dark:text-green-400";
    case "warn": return "text-amber-600 dark:text-amber-400";
    case "danger": return "text-red-600 dark:text-red-400";
  }
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) {
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${totalMinutes}min`;
}

export function elapsedSince(isoDate: string | null, now: number): number {
  if (!isoDate) return 0;
  return now - new Date(isoDate).getTime();
}

export interface WorkshopInfo {
  name: string;
  isOwnYard: boolean;
}

export function splitYardAndExternal(
  appointments: YardAppointment[],
  workshops: WorkshopInfo[],
  statuses: StatusOption[],
): { patio: YardAppointment[]; externalByWorkshop: Map<string, YardAppointment[]> } {
  const norm=(v:string)=>safeText(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const ownYardNames = new Set(workshops.filter(w=>w.isOwnYard).map(w=>norm(w.name)));
  const patio: YardAppointment[]=[];
  const externalByWorkshop=new Map<string,YardAppointment[]>();
  const latest=new Map<string,YardAppointment>();
  for(const apt of appointments){if(apt.checkOutAt || statuses.some(s=>s.label===apt.status&&s.is_completion))continue;const key=apt.plate||apt.dbId;const previous=latest.get(key);if(!previous || String(apt.registeredAt)>String(previous.registeredAt))latest.set(key,apt);}
  for(const apt of latest.values()){
    if(ownYardNames.has(norm(apt.workshop))) patio.push(apt);
    else if(apt.workshop.trim()){const list=externalByWorkshop.get(apt.workshop)??[];list.push(apt);externalByWorkshop.set(apt.workshop,list);}
  }
  return { patio, externalByWorkshop };
}

export function matchesYardSearch(apt: YardAppointment, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  return [
    apt.plate, apt.model, apt.brand, apt.contact, apt.contactNumber,
    apt.issue, apt.note, apt.workshop, apt.store, apt.operator,
  ].some((field) => field?.toLowerCase().includes(q));
}

export function isNewHighlight(registeredAt: string, lastStatusChangeAt: string | null, highlightMinutes: number, now: number): boolean {
  const reference = lastStatusChangeAt ?? registeredAt;
  if (!reference) return false;
  const elapsed = now - new Date(reference).getTime();
  return elapsed < highlightMinutes * 60_000;
}

export function sortByTimerDesc(a: YardAppointment, b: YardAppointment, now: number): number {
  const aRef = a.lastStatusChangeAt ?? a.registeredAt;
  const bRef = b.lastStatusChangeAt ?? b.registeredAt;
  const aTime = aRef ? new Date(aRef).getTime() : now;
  const bTime = bRef ? new Date(bRef).getTime() : now;
  return aTime - bTime; // oldest first (longest waiting)
}

export interface CheckInRecord {
  id: string;
  appointment_id: string;
  os_number: number | null;
  type: "entrada" | "saida";
  occurred_at: string;
  note: string | null;
  photo_url: string | null;
  performed_by: string | null;
}

export function canEditField(fieldName: string, settings: YardSettings): boolean {
  return settings.editable_fields.includes(fieldName);
}

export const YARD_EDITABLE_FIELD_LABELS: Record<string, string> = {
  status: "Situação",
  note: "Observação",
  operator: "Operador/Mecânico",
  current_deadline: "Previsão de entrega",
  contact: "Contato",
  contact_number: "Telefone",
  issue: "Problema relatado",
  model: "Modelo",
  workshop: "Local/Oficina",
  date: "Data",
  time: "Hora",
  store: "Loja",
  brand: "Marca",
};