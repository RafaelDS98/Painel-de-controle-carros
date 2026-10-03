import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownAZ,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CarFront,
  ChevronDown,
  Download,
  LogOut,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Upload,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AppointmentHistory, ChangeLogDialog } from "@/components/edit-history";
import { AlertTriangle, ChevronLeft, ChevronRight, History, Unlock, UserCircle } from "lucide-react";
import { MyAccountDialog } from "@/components/my-account";
import { useQueryClient } from "@tanstack/react-query";
import { AppointmentForm, columnForField, emptyFields, type AppointmentFields } from "@/components/appointment-form";
import { ReworkForm, type ReworkFields } from "@/components/rework-form";
import { Checkbox } from "@/components/ui/checkbox";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { batchChanges, batchColumns, batchIdHeader, batchValidation, type BatchRecord } from "@/lib/bulk-appointments";
import { periodRange, weekRange, pendingDeliveries, type PeriodPreset } from "@/lib/agenda-period";
import { ContactRegister } from "@/components/contact-register";
import { AgendaSettings } from "@/components/agenda-settings";
import { isEmergency, normalizeDate, normalizePlate, normalizeTime, parseKm, safeText, sglocStateLabels, stripHtml } from "@/lib/normalize";
import { DASH, EMPTY_OPTION, NO_DATE_GROUP, clampPage, compareDateTime, compareText, countBy, dash, exportHeaders, exportRows, foldedOptions, formatDateBR, groupWeek, inPeriod, matchesFilter, safeAverage, serviceCategory, textMatches, toCsv, buildImportRecords, dropExistingReferences } from "@/lib/agenda-safety";
import { fixSheetRange } from "@/lib/sheet-range";
import { SearchableSelect } from "@/components/searchable-select";
import { weekdayIndex } from "@/lib/agenda-safety";
import { SectionBoundary } from "@/components/section-boundary";
import { customValues, statusColors, type FieldDefinition, type StatusOption, type CustomValues } from "@/lib/agenda-config";
import { IndicatorDetails, type IndicatorGroup, type IndicatorAppointment } from "@/components/indicator-details";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

type Appointment = {
  dbId: string;
  id: string;
  registeredAt: string;
  date: string;
  time: string;
  plate: string;
  store: string;
  model: string;
  contact: string;
  workshop: string;
  issue: string;
  note: string;
  operator: string;
  externalOrder: string;
  status: ServiceStatus;
  originalDeadline: string | null;
  currentDeadline: string | null;
  editsUsed: number;
  editsAllowed: number;
  managerEditUsed: boolean;
  priorityUrgent: boolean;
  reworkOf: string | null;
  reworkReason: string | null;
  customFields: CustomValues;
  brand: string;
  contactNumber: string;
  kmScheduled: number | null;
  osNumber: number | null;
  scheduleType: string;
  sglocReference: string;
  sglocSyncState: string;
};

export type AppRole = "atendimento" | "gerente" | "master";
export type CurrentUser = { id: string; name: string; role: AppRole; email?: string };
const roleLabels: Record<AppRole, string> = { atendimento: "Atendimento", gerente: "Gerente", master: "Master" };

function editBlockReason(item: Appointment, role: AppRole): string | null {
  if (role === "master") return null;
  if (role === "gerente") return item.managerEditUsed ? "Limite de 1 edição do gerente já foi usado neste agendamento." : null;
  return item.editsUsed >= item.editsAllowed ? `Limite de ${item.editsAllowed} edição(ões) já foi usado pelo atendimento neste agendamento.` : null;
}

type ServiceStatus = string;

type AppointmentRow = {
  id: string; sheet_id: string; registered_at: string | null; date: string | null; time: string; plate: string; store: string;
  model: string; contact: string; workshop: string; issue: string; note: string; operator: string; external_order: string; status: string;
  creator_edits_used: number; creator_edits_allowed: number; manager_edit_used: boolean; priority_urgent: boolean;
  original_deadline: string | null; current_deadline: string | null;
  rework_of: string | null; rework_reason: string | null; custom_fields: unknown;
  brand?: string | null; contact_number?: string | null; km_scheduled?: number | null; os_number?: number | null;
  schedule_type?: string | null; sgloc_reference?: string | null; sgloc_sync_state?: string | null;
};

function fromRow(row: AppointmentRow): Appointment {
  return {
    dbId: row.id, id: row.sheet_id, registeredAt: row.registered_at ?? "", date: row.date ?? "", time: safeText(row.time), plate: normalizePlate(row.plate),
    store: row.store, model: row.model, contact: row.contact, workshop: row.workshop, issue: row.issue, note: row.note,
    operator: row.operator, externalOrder: row.external_order, status: row.status,
    originalDeadline: row.original_deadline, currentDeadline: row.current_deadline,
    editsUsed: row.creator_edits_used, editsAllowed: row.creator_edits_allowed, managerEditUsed: row.manager_edit_used, priorityUrgent: row.priority_urgent,
    reworkOf: row.rework_of, reworkReason: row.rework_reason, customFields: customValues(row.custom_fields),
    brand: safeText(row.brand), contactNumber: safeText(row.contact_number), kmScheduled: row.km_scheduled ?? null,
    osNumber: row.os_number ?? null, scheduleType: safeText(row.schedule_type) || "N", sglocReference: safeText(row.sgloc_reference),
    sglocSyncState: safeText(row.sgloc_sync_state) || "local_only",
  };
}

function fieldsFromAppointment(item: Appointment): AppointmentFields {
  return {
    date: item.date, time: item.time, plate: item.plate, store: item.store,
    model: item.model, contact: item.contact, workshop: item.workshop,
    issue: item.issue, note: item.note, operator: item.operator,
    externalOrder: item.externalOrder, currentDeadline: item.currentDeadline ?? "", customFields: item.customFields,
    brand: item.brand, contactNumber: item.contactNumber, kmScheduled: item.kmScheduled === null ? "" : String(item.kmScheduled),
  };
}

function isoOrNull(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

const requiredColumns = [
  "ID",
  "Data Cadastro",
  "Data Atendimento",
  "Hora",
  "Placa",
  "Loja",
  "Modelo",
  "Contato",
  "Local/Oficina",
  "Problemas Relatado",
  "Observação",
  "Operador",
  "O.S Externa",
];
const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];





function ChartPanel({ title, subtitle, children, className, empty }: { title: string; subtitle: string; children: React.ReactNode; className?: string; empty?: boolean }) {
  return (
    <section className={cn("rounded-lg border bg-card p-5 shadow-sm", className)}>
      <div className="mb-5"><h3 className="font-semibold text-card-foreground">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>
      <div className="h-64 w-full">{empty ? <div className="grid h-full place-items-center rounded-md border border-dashed text-sm text-muted-foreground">Sem dados no período</div> : children}</div>
    </section>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string; payload?: { name?: string } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-lg"><p className="font-medium text-popover-foreground">{label || payload[0]?.payload?.name}</p><p className="mt-1 text-muted-foreground">{payload[0]?.value} agendamento(s)</p></div>;
}

function statusClasses(status: ServiceStatus, statuses: StatusOption[]) {
  if (!status) return "border-input bg-background text-muted-foreground";
  return statusColors[statuses.find((option) => option.label === status)?.color_token ?? ""] ?? "border-input bg-muted text-foreground";
}

type DeadlineState = "overdue" | "today" | "onTime" | "deliveredOnTime" | "deliveredLate";
const deadlineLabels: Record<DeadlineState, string> = {
  overdue: "Atrasado", today: "Vence hoje", onTime: "No prazo",
  deliveredOnTime: "Entregue no prazo", deliveredLate: "Entregue com atraso",
};
const deadlineClasses: Record<DeadlineState, string> = {
  overdue: "border-destructive/40 bg-destructive/10 text-destructive",
  today: "border-status-progress/40 bg-status-progress text-status-progress-foreground",
  onTime: "border-border bg-muted text-muted-foreground",
  deliveredOnTime: "border-status-finished/40 bg-status-finished text-status-finished-foreground",
  deliveredLate: "border-status-part/40 bg-status-part text-status-part-foreground",
};
const businessDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
function dateInBrazil(date: Date) {
  const parts = businessDate.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function deadlineState(item: Pick<Appointment, "status" | "currentDeadline">, completedAt?: string, today = dateInBrazil(new Date()), completion = "Finalizado"): DeadlineState | null {
  if (!item.currentDeadline) return null;
  if (item.status === completion) {
    if (!completedAt) return null;
    return dateInBrazil(new Date(completedAt)) <= item.currentDeadline ? "deliveredOnTime" : "deliveredLate";
  }
  if (item.currentDeadline < today) return "overdue";
  if (item.currentDeadline === today) return "today";
  return "onTime";
}
function DeadlineBadge({ item, completedAt, today, completion }: { item: Appointment; completedAt: string | undefined; today: string; completion: string }) {
  const state = deadlineState(item, completedAt, today, completion);
  return state ? <span className={cn("inline-flex w-fit items-center whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold", deadlineClasses[state])}>{deadlineLabels[state]}</span> : null;
}
function ReworkBadge() {
  return <span className="inline-flex w-fit items-center rounded border border-accent bg-accent/30 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Retrabalho</span>;
}

export function priorityLevel(item: Pick<Appointment, "status" | "currentDeadline" | "priorityUrgent">, today: string, completion: string): number {
  const open = item.status !== completion;
  if (item.priorityUrgent && open) return 0;
  if (!item.currentDeadline) return 4;
  if (item.currentDeadline < today && open) return 1;
  if (item.currentDeadline === today) return 2;
  if (item.currentDeadline > today) return 3;
  return 4;
}
export function comparePriority(a: Pick<Appointment, "status" | "currentDeadline" | "priorityUrgent" | "date" | "time">, b: typeof a, today: string, completion: string) {
  const level = priorityLevel(a, today, completion) - priorityLevel(b, today, completion);
  if (level) return level;
  if (priorityLevel(a, today, completion) === 3 && a.currentDeadline !== b.currentDeadline) return (a.currentDeadline ?? "").localeCompare(b.currentDeadline ?? "");
  return `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
}
function EmergencyBadge() {
  return <span className="inline-flex w-fit items-center rounded border border-status-orange/40 bg-status-orange px-2 py-0.5 text-[11px] font-semibold text-status-orange-foreground">Emergencial</span>;
}
function UrgentBadge() {
  return <span className="inline-flex w-fit items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"><AlertTriangle className="size-3" />Urgente</span>;
}

const rowColumns = "id, sheet_id, registered_at, date, time, plate, store, model, contact, workshop, issue, note, operator, external_order, status, original_deadline, current_deadline, creator_edits_used, creator_edits_allowed, manager_edit_used, priority_urgent, rework_of, rework_reason, custom_fields, brand, contact_number, km_scheduled, os_number, schedule_type, sgloc_reference, sgloc_sync_state";

export function MaintenanceDashboard({ onSignOut, currentUser }: { onSignOut?: () => void; currentUser: CurrentUser }) {
  const [logOpen, setLogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const queryClientForAccount = useQueryClient();
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<FieldDefinition[]>([]);
  const completion = statuses.find((option) => option.is_completion)?.label ?? "";
  const serviceStatuses = statuses.map((option) => option.label);
  const [historyKey, setHistoryKey] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [completedAtById, setCompletedAtById] = useState<Record<string, string>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [reworkSource, setReworkSource] = useState<Appointment | null>(null);
  const [reworksOnly, setReworksOnly] = useState(false);
  const [today, setToday] = useState(() => dateInBrazil(new Date()));
  const [search, setSearch] = useState("");
  const [plateFilter, setPlateFilter] = useState("");
  const [contact, setContact] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [model, setModel] = useState("");
  const [operator, setOperator] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("week");
  const [kpiOpen, setKpiOpen] = useState<string | null>(null);
  const [gridStart, setGridStart] = useState<string | null>(null);
  const [historyPlate, setHistoryPlate] = useState<string | null>(null);
  const agendaRef = useRef<HTMLElement>(null);
  useEffect(() => { setGridStart(null); }, [startDate, endDate]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: keyof Appointment | "priority"; asc: boolean }>({ key: "priority", asc: true });
  const [message, setMessage] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<{ updated: number; unchanged: number; skipped: number; errors: { line: number; plate: string; reason: string }[] } | null>(null);
  const [dark, setDark] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refreshToday = () => setToday(dateInBrazil(new Date()));
    const interval = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (periodPreset === "custom") return;
    const range = periodRange(periodPreset, today);
    setStartDate(range.start); setEndDate(range.end); setPage(1);
  }, [periodPreset, today]);

  async function loadCompletionLogs(rows: Appointment[]) {
    const ids = rows.filter((item) => completion && item.status === completion && item.currentDeadline).map((item) => item.dbId);
    if (!ids.length) { setCompletedAtById({}); return; }
    const latest: Record<string, string> = {};
    // Page through the filtered log so a busy agenda never loses older completion records.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("edit_log")
        .select("appointment_id, changed_at")
        .in("appointment_id", ids).eq("field_changed", "status").eq("new_value", completion)
        .order("changed_at", { ascending: false }).range(offset, offset + 499);
      if (error) { setMessage("Não foi possível verificar os prazos de entrega."); return; }
      for (const log of data ?? []) latest[log.appointment_id] ??= log.changed_at;
      if (!data || data.length < 500) break;
    }
    setCompletedAtById(latest);
  }

  async function loadAppointments() {
    const data: AppointmentRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("appointments").select(rowColumns).order("date").order("time").range(offset, offset + 499);
      if (result.error) { setLoadError("Não foi possível carregar a agenda. Verifique sua conexão e tente de novo."); return; }
      data.push(...(result.data ?? []));
      if (!result.data || result.data.length < 500) break;
    }
    setLoadError("");
    const rows = data.map(fromRow);
    setAppointments(rows);
    void loadCompletionLogs(rows);
  }

  async function loadConfig() {
    const [statusResult, fieldResult] = await Promise.all([
      supabase.from("status_options").select("*").order("sort_order").order("created_at"),
      supabase.from("custom_field_definitions").select("*").order("sort_order").order("created_at"),
    ]);
    if (statusResult.error || fieldResult.error) { setLoadError("Não foi possível carregar as configurações da agenda. Tente de novo."); return; }
    setStatuses(statusResult.data ?? []);
    setFieldDefinitions(fieldResult.data ?? []);
  }
  useEffect(() => { void loadConfig(); void loadAppointments(); }, []);
  useEffect(() => { if (statuses.length) void loadCompletionLogs(appointments); }, [completion]);

  const option = (key: keyof Appointment) => foldedOptions(appointments.map((item) => item[key]));
  const baseFiltered = useMemo(() => appointments.filter((item) => {
    const qPlate = normalizePlate(search);
    const hit = !search.trim() || (qPlate !== "" && item.plate.includes(qPlate)) || textMatches(search, [item.plate, item.brand, item.contactNumber, item.contact, item.issue, item.model, item.workshop, item.note, ...fieldDefinitions.filter((field) => field.storage === "custom" && ["text", "textarea"].includes(field.field_type)).map((field) => item.customFields[field.field_key])]);
    return hit && (!plateFilter || (plateFilter === EMPTY_OPTION ? !item.plate : normalizePlate(item.plate) === normalizePlate(plateFilter))) && matchesFilter(item.contact, contact) && matchesFilter(item.workshop, workshop) && matchesFilter(item.model, model) && matchesFilter(item.operator, operator) && (!reworksOnly || Boolean(item.reworkOf));
  }), [appointments, contact, model, operator, plateFilter, reworksOnly, search, workshop, fieldDefinitions]);
  const filtered = useMemo(() => baseFiltered.filter((item) => inPeriod(item.date, startDate, endDate)), [baseFiltered, startDate, endDate]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort.key === "priority") return comparePriority(a, b, today, completion) * (sort.asc ? 1 : -1);
    if (sort.key === "date") return compareDateTime(a, b, sort.asc);
    return compareText(a[sort.key], b[sort.key], sort.asc);
  }), [filtered, sort, today, completion]);
  const pageSize = 8;
  const { pages, current: currentPage } = clampPage(page, sorted.length, pageSize);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const visibleWeek = weekRange(today);
  const selectedWeek = startDate && endDate && (new Date(`${endDate}T12:00:00Z`).getTime() - new Date(`${startDate}T12:00:00Z`).getTime()) <= 6 * 86400000 ? weekRange(startDate) : visibleWeek;
  const gridWeek = gridStart ? weekRange(gridStart) : selectedWeek;
  const gridDays = groupWeek(baseFiltered, gridWeek.start, gridWeek.end).days;
  const week = { days: gridDays, noDate: groupWeek(filtered, gridWeek.start, gridWeek.end).noDate };
  const shiftGrid = (weeks: number) => { const base = new Date(`${gridWeek.start}T12:00:00Z`); base.setUTCDate(base.getUTCDate() + weeks * 7); setGridStart(base.toISOString().slice(0, 10)); };
  const shortDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)).replace(/\./g, "").replace(" de ", " ");
  const gridLabel = `${shortDay(gridWeek.start)} – ${shortDay(gridWeek.end)}`;
  const daily = days.map((name, index) => ({ name: name.slice(0, 3), value: filtered.filter((item) => weekdayIndex(item.date) === index).length }));
  const pendingToday = pendingDeliveries(appointments, today, today, completion);
  const pendingWeek = pendingDeliveries(appointments, visibleWeek.start, visibleWeek.end, completion);
  const hourly = countBy(filtered, (item) => normalizeTime(item.time)).sort((a, b) => a.name === DASH ? 1 : b.name === DASH ? -1 : a.name.localeCompare(b.name));
  const workshops = countBy(filtered, (item) => item.workshop).slice(0, 6);
  const contacts = countBy(filtered, (item) => item.contact).slice(0, 7);
  const services = countBy(filtered, (item) => serviceCategory(item.issue));
  const models = countBy(filtered, (item) => item.model).slice(0, 6);
  const uniqueVehicles = new Set(filtered.map((item) => item.plate).filter(Boolean)).size;
  const uniqueContacts = countBy(filtered.filter((item) => safeText(item.contact)), (item) => item.contact).length;
  const uniqueWorkshops = countBy(filtered.filter((item) => safeText(item.workshop)), (item) => item.workshop).length;
  const usedDays = new Set(filtered.map((item) => normalizeDate(item.date)).filter(Boolean)).size;
  const average = safeAverage(filtered.filter((item) => normalizeDate(item.date)).length, usedDays);

  function resetFilters() {
    setSearch(""); setPlateFilter(""); setContact(""); setWorkshop(""); setModel(""); setOperator(""); setPeriodPreset("custom"); setStartDate(""); setEndDate(""); setReworksOnly(false); setPage(1);
  }

  function applyDetailFilter(label: string, apply: () => void, undo: () => void) {
    apply(); setPage(1); setKpiOpen(null); setHistoryPlate(null);
    window.setTimeout(() => agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
    toast(`Filtrando por: ${label}`, { action: { label: "Desfazer", onClick: () => { undo(); setPage(1); } } });
  }
  function filterPlate(value: string) {
    const previous = plateFilter;
    applyDetailFilter(`Placa: ${value === EMPTY_OPTION ? "Não informado" : value}`, () => setPlateFilter(value), () => setPlateFilter(previous));
  }
  function openVehicle(plate: string) { setKpiOpen(null); setLogOpen(false); setSelected(null); setHistoryPlate(plate || EMPTY_OPTION); }
  const activeFilters = [
    search && { key: "search", label: `Busca: ${search}`, remove: () => setSearch("") },
    plateFilter && { key: "plate", label: `Placa: ${plateFilter === EMPTY_OPTION ? "Não informado" : plateFilter}`, remove: () => setPlateFilter("") },
    contact && { key: "contact", label: `Cliente: ${contact === EMPTY_OPTION ? "Não informado" : contact}`, remove: () => setContact("") },
    workshop && { key: "workshop", label: `Oficina: ${workshop === EMPTY_OPTION ? "Não informado" : workshop}`, remove: () => setWorkshop("") },
    model && { key: "model", label: `Modelo: ${model === EMPTY_OPTION ? "Não informado" : model}`, remove: () => setModel("") },
    operator && { key: "operator", label: `Operador: ${operator === EMPTY_OPTION ? "Não informado" : operator}`, remove: () => setOperator("") },
    startDate && { key: "start", label: `De: ${formatDateBR(startDate)}`, remove: () => { setStartDate(""); setPeriodPreset("custom"); } },
    endDate && { key: "end", label: `Até: ${formatDateBR(endDate)}`, remove: () => { setEndDate(""); setPeriodPreset("custom"); } },
    reworksOnly && { key: "reworks", label: "Somente retrabalhos", remove: () => setReworksOnly(false) },
  ].filter((filter): filter is { key: string; label: string; remove: () => void } => Boolean(filter));

  function changeSort(key: keyof Appointment | "priority") {
    setSort((current) => ({ key, asc: current.key === key ? !current.asc : true }));
  }

  function replaceRow(row: AppointmentRow) {
    const next = fromRow(row);
    setAppointments((current) => current.map((item) => item.dbId === next.dbId ? next : item));
    setSelected((current) => current?.dbId === next.dbId ? next : current);
    setHistoryKey((k) => k + 1);
  }

  function updateAppointmentRow(id: string, update: TablesUpdate<"appointments">) {
    return supabase.from("appointments").update(update).eq("id", id).select(rowColumns).single();
  }

  async function updateStatus(dbId: string, status: ServiceStatus) {
    const item = appointments.find((a) => a.dbId === dbId);
    if (!item) return;
    const blocked = editBlockReason(item, currentUser.role);
    if (blocked) { setMessage(blocked); return; }
    if (status && !serviceStatuses.includes(status)) return;
    const { data, error } = await updateAppointmentRow(dbId, { status });
    if (error || !data) { setMessage(error?.message || "Não foi possível salvar a situação."); return; }
    replaceRow(data);
    void loadCompletionLogs(appointments.map((row) => row.dbId === dbId ? fromRow(data) : row));
  }

  async function updateUrgent(item: Appointment, value: boolean) {
    if (currentUser.role === "atendimento") return;
    const blocked = editBlockReason(item, currentUser.role);
    if (blocked) { setMessage(blocked); return; }
    const { data, error } = await updateAppointmentRow(item.dbId, { priority_urgent: value });
    if (error || !data) { setMessage(error?.message || "Não foi possível alterar a prioridade."); return; }
    replaceRow(data);
  }

  async function saveAppointment(changes: Partial<AppointmentFields>): Promise<boolean> {
    if (!selected) return false;
    const blocked = editBlockReason(selected, currentUser.role);
    if (blocked) { setMessage(blocked); return false; }
    const update: TablesUpdate<"appointments"> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (key === "customFields") { update.custom_fields = { ...selected.customFields, ...(value as CustomValues) }; continue; }
      if (key === "currentDeadline") update.current_deadline = String(value || "") || null;
      else if (key === "kmScheduled") update.km_scheduled = parseKm(value) ?? null;
      else if (key === "plate") update.plate = normalizePlate(value);
      else if (typeof value === "string") Object.assign(update, { [columnForField[key as keyof typeof columnForField]]: value.trim() });
      else Object.assign(update, { [columnForField[key as keyof typeof columnForField]]: value });
    }
    if (!Object.keys(update).length) return true;
    const { data, error } = await updateAppointmentRow(selected.dbId, update);
    if (error || !data) { setMessage(error?.message || "Não foi possível salvar as alterações."); return false; }
    replaceRow(data);
    if (data.status === completion) void loadCompletionLogs(appointments.map((row) => row.dbId === data.id ? fromRow(data) : row));
    setMessage("Alterações salvas.");
    return true;
  }

  const [newUrgent, setNewUrgent] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [extraColumns, setExtraColumns] = useState(false);
  async function createAppointment(fields: Partial<AppointmentFields>): Promise<boolean> {
    const date = fields.date?.trim();
    const time = fields.time?.trim();
    const plate = normalizePlate(fields.plate);
    if (!date || !time || !plate) { setMessage("Informe data, hora e placa."); return false; }
    const values: TablesInsert<"appointments"> = {
      date, time, plate, created_by: currentUser.id, status: "", sheet_id: "",
      original_deadline: fields.currentDeadline || null,
      current_deadline: fields.currentDeadline || null,
      priority_urgent: currentUser.role !== "atendimento" && newUrgent,
    };
    values.custom_fields = fields.customFields ?? {};
    for (const [key, value] of Object.entries(fields)) {
      if (key === "kmScheduled") { values.km_scheduled = parseKm(value) ?? null; continue; }
      if (key !== "customFields" && key !== "currentDeadline" && key !== "date" && key !== "time" && key !== "plate")
        Object.assign(values, { [columnForField[key as keyof typeof columnForField]]: typeof value === "string" ? value.trim() : "" });
    }
    const { data, error } = await supabase.from("appointments").insert(values).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível criar o agendamento."); return false; }
    setNewOpen(false);
    setNewUrgent(false);
    resetFilters();
    await loadAppointments();
    setMessage(`Agendamento de ${plate} criado com sucesso.`);
    return true;
  }

  async function createRework(fields: ReworkFields): Promise<boolean> {
    if (!reworkSource) return false;
    const date = fields.date.trim();
    const time = fields.time.trim();
    const plate = normalizePlate(fields.plate);
    const reason = fields.reason.trim();
    if (!date || !time || !plate || !reason) { setMessage("Informe data, hora, placa e motivo do retorno."); return false; }
    const values: TablesInsert<"appointments"> = {
      date, time, plate, model: fields.model.trim(), contact: fields.contact.trim(),
      workshop: fields.workshop.trim(), operator: fields.operator.trim(),
      rework_of: reworkSource.dbId, rework_reason: reason,
      created_by: currentUser.id, status: "", sheet_id: "",
    };
    const { data, error } = await supabase.from("appointments").insert(values).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível registrar o retrabalho."); return false; }
    setReworkSource(null);
    resetFilters();
    await loadAppointments();
    setSelected(fromRow(data));
    setMessage(`Retrabalho de ${plate} registrado com sucesso.`);
    return true;
  }

  function openRework(item: Appointment) {
    setSelected(null);
    setReworkSource(item);
  }

  function openLinked(item: Appointment) {
    setSelected(item);
    setHistoryKey((key) => key + 1);
  }

  async function grantExtraEdit(item: Appointment) {
    const { data, error } = await supabase.from("appointments").update({ creator_edits_allowed: item.editsAllowed + 1 }).eq("id", item.dbId).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível liberar a edição extra."); return; }
    replaceRow(data); setMessage(`Edição extra liberada para ${item.plate}.`);
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheetName = book.SheetNames[0];
      if (!sheetName) throw new Error("A planilha não possui abas.");
      const sheet = book.Sheets[sheetName];
      if (!sheet) throw new Error("A primeira aba está vazia.");
      fixSheetRange(sheet, XLSX.utils);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const firstRow = rows[0];
      const columns = firstRow ? Object.keys(firstRow) : [];
      const missing = requiredColumns.filter((column) => !columns.includes(column));
      if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(", ")}`);
      const hasDeadline = columns.includes("Previsão de Entrega");
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData.user?.id ?? null;
      const { records: candidates, skippedEmpty } = buildImportRecords(rows, createdBy, hasDeadline);
      const refs = [...new Set(candidates.map((item) => item.sgloc_reference).filter((ref): ref is string => Boolean(ref)))];
      const existing = new Set<string>();
      for (let start = 0; start < refs.length; start += 200) {
        const { data, error } = await supabase.from("appointments").select("sgloc_reference").in("sgloc_reference", refs.slice(start, start + 200));
        if (error) throw new Error("Não foi possível conferir os IDs do SGLOC já cadastrados.");
        for (const item of data ?? []) if (item.sgloc_reference) existing.add(item.sgloc_reference);
      }
      const { kept: records, skippedExisting } = dropExistingReferences(candidates, existing);
      if (records.length) {
        const { error } = await supabase.from("appointments").insert(records);
        if (error) throw new Error(error.code === "23505" ? "Outro usuário cadastrou um ID do SGLOC desta planilha ao mesmo tempo. Importe novamente." : "Não foi possível gravar a agenda importada no banco.");
      }
      await loadAppointments(); resetFilters();
      setMessage(`${records.length} agendamento(s) importado(s) • ${skippedEmpty} linha(s) ignorada(s) (sem placa ou vazias) • ${skippedExisting} ignorada(s) por ID do SGLOC já existente.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo."); }
  }

  function exportFile(kind: "csv" | "xlsx") {
    import("xlsx").then((XLSX) => {
      const rows = exportRows(sorted);
      const sheet = XLSX.utils.json_to_sheet(rows, { header: exportHeaders });
      if (kind === "csv") {
        const blob = new Blob(["\ufeff", toCsv(rows, exportHeaders)], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "agenda-filtrada.csv"; link.click(); URL.revokeObjectURL(link.href);
      } else {
        const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Agenda"); XLSX.writeFile(book, "agenda-filtrada.xlsx");
      }
    });
  }

  async function exportBatch() {
    try {
      const XLSX = await import("xlsx");
      const rows = sorted.map((item) => {
        const record: Record<string, string> = { [batchIdHeader]: item.dbId };
        const values: BatchRecord = {
          date: item.date, time: item.time, plate: item.plate, status: item.status,
          model: item.model, contact: item.contact, workshop: item.workshop,
          issue: item.issue, note: item.note, operator: item.operator,
          external_order: item.externalOrder, current_deadline: item.currentDeadline,
        };
        for (const [column, header] of batchColumns) record[header] = values[column] ?? "";
        return record;
      });
      const sheet = XLSX.utils.json_to_sheet(rows, { header: [batchIdHeader, ...batchColumns.map(([, header]) => header)] });
      sheet["!cols"] = [{ wch: 43 }, ...batchColumns.map(() => ({ wch: 22 }))];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Edição em lote");
      XLSX.writeFile(book, `agenda-lote-${dateInBrazil(new Date())}.xlsx`);
    } catch { setMessage("Não foi possível exportar a planilha de edição em lote."); }
  }

  async function importBatch(file?: File) {
    if (!file || batchBusy) return;
    setBatchResult(null);
    setBatchBusy(true);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = book.Sheets[book.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("A planilha não possui abas.");
      fixSheetRange(sheet, XLSX.utils);
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: true });
      const headers = (grid[0] ?? []).map((value) => String(value).trim());
      if (!headers.includes(batchIdHeader)) throw new Error(`Coluna "${batchIdHeader}" ausente. Use o arquivo gerado por "Exportar para edição em lote".`);
      const missing = batchColumns.map(([, header]) => header).filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(", ")}. Use o arquivo gerado por "Exportar para edição em lote".`);
      if (new Set(headers).size !== headers.length) throw new Error("A planilha contém colunas repetidas. Use o arquivo original de edição em lote.");
      const result = { updated: 0, unchanged: 0, skipped: 0, errors: [] as { line: number; plate: string; reason: string }[] };
      const seen = new Set<string>();
      const startRow = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s.r : 0;
      for (const [index, cells] of grid.entries()) {
        if (index === 0 || !cells.some((value) => String(value ?? "").trim())) continue;
        const row = Object.fromEntries(headers.map((header, column) => [header, cells[column] ?? ""]));
        const line = startRow + index + 1;
        const id = String(row[batchIdHeader] ?? "").trim();
        if (/registro\(s\)/i.test(stripHtml(row[batchIdHeader])) || !normalizePlate(stripHtml(row["Placa"]))) { result.skipped++; continue; }
        const plate = normalizePlate(stripHtml(row["Placa"]));
        if (!id) { result.errors.push({ line, plate, reason: "ID do sistema vazio — use Importar agenda para registros novos." }); continue; }
        if (seen.has(id)) { result.errors.push({ line, plate, reason: "ID repetido nesta planilha." }); continue; }
        seen.add(id);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { result.errors.push({ line, plate, reason: "ID não encontrado — use Importar agenda para registros novos." }); continue; }
        try {
          const { data: current, error: readError } = await supabase.from("appointments").select(rowColumns).eq("id", id).maybeSingle();
          if (readError) throw new Error(readError.message);
          if (!current) { result.errors.push({ line, plate, reason: "ID não encontrado — use Importar agenda para registros novos." }); continue; }
          const changes = batchChanges(row, current);
          if (!Object.keys(changes).length) { result.unchanged++; continue; }
          const validation = batchValidation(changes, serviceStatuses);
          if (validation) { result.errors.push({ line, plate, reason: validation }); continue; }
          const { error: updateError } = await updateAppointmentRow(id, changes);
          if (updateError) throw new Error(updateError.message);
          result.updated++;
        } catch (error) {
          result.errors.push({ line, plate, reason: error instanceof Error ? error.message : "Não foi possível atualizar esta linha." });
        }
      }
      await loadAppointments();
      setBatchResult(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo de edição em lote.");
    } finally {
      setBatchBusy(false);
      if (batchInputRef.current) batchInputRef.current.value = "";
    }
  }

  const kpis = [
    { label: "Agendamentos", value: filtered.length, detail: "no período", icon: CalendarDays },
    { label: "Retrabalhos no período", value: filtered.filter((item) => item.reworkOf).length, detail: "agendamentos de retorno", icon: RotateCcw },
    { label: "Veículos únicos", value: uniqueVehicles, detail: "placas distintas", icon: CarFront },
    { label: "Clientes atendidos", value: uniqueContacts, detail: "órgãos e secretarias", icon: Users },
    { label: "Oficinas acionadas", value: uniqueWorkshops, detail: "prestadores", icon: Building2 },
    { label: "Média por dia", value: average.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), detail: `${usedDays} dias com agenda`, icon: Wrench },
  ];
  const orderedDates = appointments.map((item) => item.date).filter(Boolean).sort();
  const firstDate = orderedDates[0];
  const lastDate = orderedDates.at(-1);
  const loadedPeriod = firstDate && lastDate ? `${formatDateBR(firstDate)} — ${formatDateBR(lastDate)}` : "Sem dados";
  const selectedOriginal = selected?.reworkOf ? appointments.find((item) => item.dbId === selected.reworkOf) : undefined;
  const indicatorRow = (item: Appointment): IndicatorAppointment => ({
    dbId: item.dbId, plate: item.plate, date: item.date, time: item.time, status: item.status, workshop: item.workshop,
    reworkReason: item.reworkReason, original: item.reworkOf ? appointments.find((row) => row.dbId === item.reworkOf)?.plate || "Não informado" : undefined,
  });
  const grouped = (key: keyof Pick<Appointment, "plate" | "contact" | "workshop">): IndicatorGroup[] => foldedOptions(filtered.map((item) => item[key])).map((value) => {
    const rows = filtered.filter((item) => key === "plate" ? (value === EMPTY_OPTION ? !item.plate : normalizePlate(item.plate) === normalizePlate(value)) : matchesFilter(item[key], value));
    const previous = key === "plate" ? plateFilter : key === "contact" ? contact : workshop;
    return { key: value, label: value === EMPTY_OPTION ? "Não informado" : value, rows: rows.map(indicatorRow),
      filter: () => key === "plate" ? filterPlate(value) : applyDetailFilter(`${key === "contact" ? "Cliente" : "Oficina"}: ${value === EMPTY_OPTION ? "Não informado" : value}`,
        () => key === "contact" ? setContact(value) : setWorkshop(value), () => key === "contact" ? setContact(previous) : setWorkshop(previous)) };
  });
  const indicatorGroups: IndicatorGroup[] = kpiOpen === "Veículos únicos" ? grouped("plate") : kpiOpen === "Clientes atendidos" ? grouped("contact") : kpiOpen === "Oficinas acionadas" ? grouped("workshop") :
    kpiOpen === "Média por dia" ? [...new Set(filtered.map((item) => normalizeDate(item.date)).filter((date): date is string => Boolean(date)))].sort().map((date) => ({ key: date, label: formatDateBR(date), rows: filtered.filter((item) => normalizeDate(item.date) === date).map(indicatorRow), filter: () => { const before = { startDate, endDate, periodPreset }; applyDetailFilter(`Dia: ${formatDateBR(date)}`, () => { setPeriodPreset("custom"); setStartDate(date); setEndDate(date); }, () => { setPeriodPreset(before.periodPreset); setStartDate(before.startDate); setEndDate(before.endDate); }); } })) :
    kpiOpen === "Agendamentos" || kpiOpen === "Retrabalhos no período" ? sorted.filter((item) => kpiOpen === "Agendamentos" || item.reworkOf).map((item) => ({ key: item.dbId, label: `${item.plate || "Não informado"} · ${formatDateBR(item.date)}${item.reworkOf ? ` · Original: ${appointments.find((row) => row.dbId === item.reworkOf)?.plate || "Não informado"}` : ""}`, rows: [indicatorRow(item)], filter: () => filterPlate(item.plate || EMPTY_OPTION) })) : [];

  const renderCard = (item: Appointment) => (<article key={item.dbId} className="overflow-hidden rounded-md border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-accent"><div className="p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-accent-foreground">{dash(normalizeTime(item.time))}</span><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", serviceCategory(item.issue) === "Revisão" ? "bg-service-review text-service-review-foreground" : "bg-service-repair text-service-repair-foreground")}>{serviceCategory(item.issue)}</span></div><Button variant="link" className="mt-1 min-h-11 h-auto px-0 font-bold text-primary" onClick={() => openVehicle(item.plate)}>{item.plate || "Não informado"}<ChevronRight className="size-4" /></Button><p className="truncate text-xs text-muted-foreground">{dash(item.model)}</p><p className="mt-2 truncate text-xs font-medium">{dash(item.contact)}</p><p className="mt-1 line-clamp-2 whitespace-normal text-[11px] leading-4 text-muted-foreground">{dash(item.issue)}</p><div className="mt-2 flex flex-wrap gap-1">{item.priorityUrgent && item.status !== completion && <UrgentBadge />}{item.reworkOf && <ReworkBadge />}{isEmergency(item.scheduleType) && <EmergencyBadge />}<DeadlineBadge item={item} completedAt={completedAtById[item.dbId]} today={today} completion={completion} /></div><Button variant="ghost" size="sm" className="mt-2 w-full justify-between text-primary" onClick={() => setSelected(item)}>Abrir agendamento<ChevronRight className="size-4" /></Button></div><label className="relative block border-t"><span className="sr-only">Situação de {item.plate}</span><select value={item.status} disabled={Boolean(editBlockReason(item, currentUser.role))} title={editBlockReason(item, currentUser.role) ?? undefined} onChange={(event) => updateStatus(item.dbId, event.target.value as ServiceStatus)} className={cn("disabled:cursor-not-allowed disabled:opacity-70 h-9 w-full appearance-none border-0 px-3 pr-8 text-xs font-semibold outline-none focus:ring-2 focus:ring-inset focus:ring-ring", statusClasses(item.status, statuses))}><option value="">Atualizar situação</option>{serviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 opacity-70" /></label></article>);

  return (
    <div className={cn("min-h-screen overflow-x-hidden bg-background text-foreground", dark && "dark")}>
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-md bg-primary-foreground text-primary"><Wrench className="size-5" /></div><div><p className="text-xl font-bold">ANPEXC</p><p className="text-xs text-primary-foreground/70">Gestão de Agendamentos</p></div></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAccountOpen(true)} title="Minha conta" className="mr-2 min-h-11 rounded-md px-2 text-right text-sm hover:bg-primary-foreground/10"><p className="font-semibold"><UserCircle className="mr-1 inline size-4" />{currentUser.name}</p><p className="text-xs text-primary-foreground/70">{roleLabels[currentUser.role]} · Minha conta</p></button>
            <MyAccountDialog open={accountOpen} onOpenChange={setAccountOpen} userId={currentUser.id} email={currentUser.email ?? ""} name={currentUser.name} onSaved={() => void queryClientForAccount.invalidateQueries({ queryKey: ["profile", currentUser.id] })} />
            <Button variant="secondary" onClick={() => setLogOpen(true)}><History /> Log de alterações</Button>
            <Button variant="secondary" onClick={() => setNewOpen(true)}><Plus /> Novo agendamento</Button>
             {currentUser.role === "master" && <Button variant="secondary" onClick={() => setSettingsOpen(true)}><Settings /> Configurações</Button>}
            <Button variant="secondary" onClick={() => inputRef.current?.click()}><Upload /> Importar agenda</Button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => importFile(event.target.files?.[0])} />
            <Button variant="ghost" size="icon" onClick={() => setDark((value) => !value)} className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Alternar tema">{dark ? <Sun /> : <Moon />}</Button>
            {onSignOut && <Button variant="ghost" size="icon" onClick={onSignOut} className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Sair"><LogOut /></Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-1 text-xs font-semibold uppercase text-accent-foreground">Operação semanal</p><h1 className="text-2xl font-bold lg:text-3xl">Agenda de manutenção</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhamento da frota, oficinas e serviços programados.</p></div>
          <div className="rounded-md border bg-card px-4 py-2 text-right"><p className="text-xs text-muted-foreground">Período carregado</p><p className="text-sm font-semibold">{loadedPeriod}</p></div>
        </div>

        {loadError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"><span>{loadError}</span><Button variant="outline" size="sm" onClick={() => { void loadConfig(); void loadAppointments(); }}>Tentar de novo</Button></div>}
        {message && <div className="flex items-center justify-between rounded-md border border-accent bg-accent/30 px-4 py-3 text-sm"><span>{message}</span><Button variant="ghost" size="icon" onClick={() => setMessage("")}><X /></Button></div>}
        {batchResult && <section aria-label="Resultado da atualização em lote" className="space-y-2 border-y py-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Atualização em lote concluída</h2><Button variant="ghost" size="icon" aria-label="Fechar resultado" onClick={() => setBatchResult(null)}><X /></Button></div>
          <p>{batchResult.updated} atualizado(s) · {batchResult.unchanged} sem mudança · {batchResult.skipped} ignorada(s) (sem placa ou linha de total) · {batchResult.errors.length} erro(s)</p>
          {batchResult.errors.length > 0 && <ul className="max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-destructive">{batchResult.errors.map((error) => <li key={`${error.line}-${error.plate}`}>Linha {error.line} · {error.plate}: {error.reason}</li>)}</ul>}
        </section>}

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row">
            <label className="relative min-w-0 flex-[1.4] sm:min-w-64"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar placa, contato ou serviço" className="pl-9" /></label>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:min-w-64"><Input type="date" aria-label="Data inicial" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPeriodPreset("custom"); setPage(1); }} className="min-w-36 flex-1" /><Input type="date" aria-label="Data final" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPeriodPreset("custom"); setPage(1); }} className="min-w-36 flex-1" /></div>
            <SearchableSelect label="Todos os contatos" value={contact} options={option("contact")} onChange={setContact} />
            <SearchableSelect label="Todas as oficinas" value={workshop} options={option("workshop")} onChange={setWorkshop} />
          </div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <SearchableSelect label="Todas as placas" value={plateFilter} options={option("plate")} onChange={(value) => { setPlateFilter(value); setPage(1); }} />
            <SearchableSelect label="Todos os modelos" value={model} options={option("model")} onChange={setModel} />
            <SearchableSelect label="Todos os operadores" value={operator} options={option("operator")} onChange={setOperator} />
            <label className="flex min-h-10 items-center gap-2 text-sm text-foreground"><Checkbox checked={reworksOnly} onCheckedChange={(checked) => { setReworksOnly(checked === true); setPage(1); }} aria-label="Mostrar somente retrabalhos" />Mostrar somente retrabalhos</label>
            <Button variant="outline" onClick={resetFilters}><RotateCcw /> Limpar tudo</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Período da agenda">{([ ["today", "Hoje"], ["week", "Esta semana"], ["month", "Este mês"], ["custom", "Personalizado"] ] as const).map(([key, label]) => <Button key={key} size="sm" variant={periodPreset === key ? "default" : "outline"} aria-pressed={periodPreset === key} onClick={() => { setPeriodPreset(key); setPage(1); }}>{label}</Button>)}</div>
        </section>
        {activeFilters.length > 0 && <section aria-label="Filtros ativos" className="flex flex-wrap items-center gap-2 border-y py-3 text-sm"><strong className="mr-1">Filtros ativos</strong>{activeFilters.map((filter) => <Button key={filter.key} variant="secondary" size="sm" className="min-h-11 max-w-full gap-2" aria-label={`Remover filtro ${filter.label}`} onClick={() => { filter.remove(); setPage(1); }}><span className="truncate">{filter.label}</span><X className="size-4 shrink-0" /></Button>)}<Button variant="outline" size="sm" className="min-h-11 border-primary font-semibold text-primary" onClick={resetFilters}><RotateCcw className="size-4" />Limpar tudo</Button></section>}

        <section aria-label="Entregas pendentes" className="flex flex-wrap gap-x-8 gap-y-2 border-y py-4 text-sm"><p><span className="font-semibold">Hoje:</span> {pendingToday} veículo(s) a entregar</p><p><span className="font-semibold">Esta semana:</span> {pendingWeek} veículo(s) a entregar</p></section>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map(({ label, value, detail, icon: Icon }) => <Button key={label} variant="outline" onClick={() => setKpiOpen(label)} title={`Ver detalhes de ${label}`} className="h-auto min-h-28 min-w-0 cursor-pointer flex-col items-stretch justify-start whitespace-normal rounded-md bg-card p-4 text-left shadow-sm transition-colors hover:border-primary hover:bg-accent/20"><span className="mb-4 flex w-full items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{label}</span><Icon className="size-4 shrink-0 text-accent-foreground" /></span><span className="text-3xl font-bold tabular-nums">{value}</span><span className="mt-1 text-xs font-normal text-muted-foreground">{detail}</span><span className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">Ver detalhes<ChevronRight className="size-3" /></span></Button>)}
        </section>

        <SectionBoundary name="a grade semanal"><section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Grade semanal</h2><div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => shiftGrid(-1)}><ChevronLeft /></Button><span className="min-w-32 text-center text-sm font-medium" aria-live="polite">{gridLabel}</span><Button variant="outline" size="icon" aria-label="Próxima semana" onClick={() => shiftGrid(1)}><ChevronRight /></Button><Button variant="outline" size="sm" onClick={() => setGridStart(weekRange(today).start)}>Hoje</Button></div></div>
          <div className="grid min-w-0 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {days.map((day, index) => {
              const rows = [...(week.days[index] ?? [])].sort((a,b) => comparePriority(a, b, today, completion));
               return <div key={day} className="min-h-48 rounded-lg border bg-muted/30 p-3"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">{day}</h3><p className="text-xs text-muted-foreground">{dayMonth.format(new Date(new Date(`${gridWeek.start}T12:00:00Z`).getTime() + index * 86400000))}</p></div><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{rows.length}</span></div><div className="space-y-2">{rows.map(renderCard)}</div></div>;
            })}
          </div>
          {week.noDate.length > 0 && <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{NO_DATE_GROUP}</h3><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{week.noDate.length}</span></div><div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">{week.noDate.map(renderCard)}</div></div>}
        </section></SectionBoundary>

        <SectionBoundary name="os gráficos"><section><h2 className="mb-3 text-lg font-semibold">Indicadores da operação</h2><div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartPanel empty={daily.every((d) => !d.value)} title="Atendimentos por dia da semana" subtitle="Soma de todo o período filtrado (registros sem data ficam de fora)"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-1)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!hourly.length} title="Faixas de horário" subtitle="Concentração ao longo da manhã"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourly}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="value" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.16} strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!workshops.length} title="Volume por oficina" subtitle="Prestadores mais acionados"><ResponsiveContainer width="100%" height="100%"><BarChart data={workshops} layout="vertical" margin={{ left: 8 }}><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" allowDecimals={false} hide /><YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-3)" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!contacts.length} title="Atendimentos por contato" subtitle="Participação dos órgãos atendidos"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={contacts} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>{contacts.map((item,index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!services.length} title="Categorias de serviço" subtitle="Classificação pelos problemas relatados"><ResponsiveContainer width="100%" height="100%"><BarChart data={services}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-4)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!models.length} title="Top modelos" subtitle="Veículos com maior demanda"><ResponsiveContainer width="100%" height="100%"><BarChart data={models} layout="vertical"><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" allowDecimals={false} hide /><YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-5)" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></ChartPanel>
        </div></section></SectionBoundary>

        <SectionBoundary name="a tabela"><section ref={agendaRef} className="scroll-mt-4 rounded-lg border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">Agenda detalhada</h2><p className="text-xs text-muted-foreground">{sorted.length} registros encontrados</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" aria-pressed={extraColumns} onClick={() => setExtraColumns((value) => !value)}>{extraColumns ? "Ocultar colunas extras" : "Mostrar colunas extras"}</Button><Button variant="outline" size="sm" onClick={exportBatch}><Download /> Exportar para edição em lote</Button><Button variant="outline" size="sm" disabled={batchBusy} onClick={() => batchInputRef.current?.click()}><Upload /> {batchBusy ? "Atualizando…" : "Atualizar agenda em lote"}</Button><input ref={batchInputRef} type="file" accept=".xlsx" className="hidden" aria-label="Arquivo de atualização em lote" onChange={(event) => void importBatch(event.target.files?.[0])} /><Button variant="outline" size="sm" onClick={() => exportFile("csv")}><Download /> CSV</Button><Button variant="outline" size="sm" onClick={() => exportFile("xlsx")}><Download /> Excel</Button></div></div>
           <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[1400px] text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{[["priority","Prioridade"],["id","ID"],["date","Atendimento"],["time","Hora"],["plate","Placa"],["status","Situação"],["currentDeadline","Prazo"],["model","Modelo"],["contact","Contato"],["workshop","Local/Oficina"],["issue","Problema relatado"],["note","Observação"],["operator","Operador"], ...(extraColumns ? [["brand","Marca"],["kmScheduled","KM"],["contactNumber","Telefone"],["osNumber","O.S Fornecedor"]] : [])].map(([key,label]) => <th key={key} className="px-4 py-3 font-medium"><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => changeSort(key as keyof Appointment | "priority")}>{label}<ArrowDownAZ className="size-3" /></Button></th>)}</tr></thead><tbody>{pageRows.map((item) => <tr key={item.dbId} onClick={() => setSelected(item)} className="cursor-pointer border-t hover:bg-muted/40"><td className="px-4 py-3">{item.priorityUrgent && item.status !== completion ? <UrgentBadge /> : <span className="text-xs text-muted-foreground">{["Urgente","Atrasado","Hoje","Futuro","Sem prazo"][priorityLevel(item, today, completion)]}</span>}</td><td className="px-4 py-3 font-mono text-xs">#{item.id}</td><td className="whitespace-nowrap px-4 py-3">{formatDateBR(item.date)}</td><td className="px-4 py-3 font-semibold">{dash(normalizeTime(item.time))}</td><td className="px-4 py-3 font-bold"><Button variant="link" className="min-h-11 h-auto px-0 font-bold text-primary" onClick={(event) => { event.stopPropagation(); openVehicle(item.plate); }}>{item.plate || "Não informado"}<ChevronRight className="size-4" /></Button>{item.reworkOf && <span className="mt-1 block"><ReworkBadge /></span>}{isEmergency(item.scheduleType) && <span className="mt-1 block"><EmergencyBadge /></span>}</td><td className="px-4 py-3"><span className={cn("whitespace-nowrap rounded border px-2 py-1 text-xs font-semibold", statusClasses(item.status, statuses))}>{item.status || "Não atualizada"}</span></td><td className="whitespace-nowrap px-4 py-3"><DeadlineBadge item={item} completedAt={completedAtById[item.dbId]} today={today} completion={completion} /></td><td title={item.model} className="max-w-48 truncate px-4 py-3">{dash(item.model)}</td><td title={item.contact} className="max-w-48 truncate px-4 py-3">{dash(item.contact)}</td><td title={item.workshop} className="max-w-52 truncate px-4 py-3">{dash(item.workshop)}</td><td title={item.issue} className="max-w-72 truncate px-4 py-3 text-muted-foreground">{dash(item.issue.replace(/\s+/g, " "))}</td><td title={item.note} className="max-w-36 truncate px-4 py-3">{dash(item.note.replace(/\s+/g, " "))}</td><td title={item.operator} className="max-w-40 truncate whitespace-nowrap px-4 py-3">{dash(item.operator)}</td>{extraColumns && <><td title={item.brand} className="max-w-36 truncate px-4 py-3">{dash(item.brand)}</td><td className="whitespace-nowrap px-4 py-3">{dash(item.kmScheduled)}</td><td className="whitespace-nowrap px-4 py-3">{dash(item.contactNumber)}</td><td className="whitespace-nowrap px-4 py-3">{dash(item.osNumber)}</td></>}</tr>)}</tbody></table></div>
          <div className="flex items-center justify-between border-t p-4"><p className="text-xs text-muted-foreground">Página {currentPage} de {pages}</p><div className="flex gap-2"><Button variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1,value-1))} aria-label="Página anterior"><ArrowLeft /></Button><Button variant="outline" size="icon" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages,value+1))} aria-label="Próxima página"><ArrowRight /></Button></div></div>
        </section></SectionBoundary>
      </main>

      <Dialog open={Boolean(kpiOpen)} onOpenChange={(open) => { if (!open) setKpiOpen(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{kpiOpen}</DialogTitle><DialogDescription>Agendamentos no período filtrado</DialogDescription></DialogHeader>
          <IndicatorDetails key={kpiOpen ?? ""} groups={indicatorGroups} placeholder={kpiOpen === "Veículos únicos" ? "Buscar placa" : kpiOpen === "Clientes atendidos" ? "Buscar cliente" : kpiOpen === "Oficinas acionadas" ? "Buscar oficina" : kpiOpen === "Média por dia" ? "Buscar dia" : "Buscar agendamento"} onPlate={openVehicle} onAppointment={(id) => { setKpiOpen(null); setSelected(appointments.find((item) => item.dbId === id) ?? null); }} />
        </DialogContent>
      </Dialog>
      <Dialog open={historyPlate !== null} onOpenChange={(open) => { if (!open) setHistoryPlate(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Histórico do veículo · {historyPlate === EMPTY_OPTION ? "Não informado" : historyPlate}</DialogTitle><DialogDescription>Todos os agendamentos desta placa, independentemente do período.</DialogDescription></DialogHeader>
          <div className="space-y-2">{appointments.filter((item) => historyPlate === EMPTY_OPTION ? !item.plate : normalizePlate(item.plate) === normalizePlate(historyPlate)).sort((a, b) => compareDateTime(a, b, false)).map((item) => <Button key={item.dbId} variant="outline" className="min-h-11 h-auto w-full justify-between whitespace-normal text-left hover:border-primary" onClick={() => { setHistoryPlate(null); setSelected(item); }}><span>{formatDateBR(item.date)} · {normalizeTime(item.time) || "—"} · {item.status || "Não atualizada"} · {item.workshop || "Não informado"}</span><ChevronRight className="size-4 shrink-0 text-primary" /></Button>)}
            {!appointments.some((item) => historyPlate === EMPTY_OPTION ? !item.plate : normalizePlate(item.plate) === normalizePlate(historyPlate)) && <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>}
            {historyPlate !== null && <Button variant="outline" className="min-h-11" onClick={() => { const plate = historyPlate; const previous = { plateFilter, startDate, endDate, periodPreset }; applyDetailFilter(`Placa: ${plate === EMPTY_OPTION ? "Não informado" : plate}`, () => { setPlateFilter(plate); setPeriodPreset("custom"); setStartDate(""); setEndDate(""); }, () => { setPlateFilter(previous.plateFilter); setPeriodPreset(previous.periodPreset); setStartDate(previous.startDate); setEndDate(previous.endDate); }); }}><ArrowRight className="size-4" />Ver na agenda</Button>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Novo agendamento</DialogTitle><DialogDescription>Dados do atendimento</DialogDescription></DialogHeader>
          {newOpen && <label className="mb-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-destructive" checked={newUrgent && currentUser.role !== "atendimento"} disabled={currentUser.role === "atendimento"} onChange={(event) => setNewUrgent(event.target.checked)} />Marcar como urgente{currentUser.role === "atendimento" && <span className="text-xs font-normal text-muted-foreground">(somente gerente ou master)</span>}</label>}
          {newOpen && <AppointmentForm initial={emptyFields} definitions={fieldDefinitions} onSave={createAppointment} />}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(reworkSource)} onOpenChange={(open) => { if (!open) setReworkSource(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Registrar retrabalho</DialogTitle><DialogDescription>{reworkSource ? `Retorno de ${reworkSource.plate} • ${formatDateBR(reworkSource.date)}` : ""}</DialogDescription></DialogHeader>
          {reworkSource && <ReworkForm key={reworkSource.dbId} initial={{ date: "", time: "", plate: reworkSource.plate, model: reworkSource.model, contact: reworkSource.contact, workshop: reworkSource.workshop, operator: reworkSource.operator, reason: "" }} onSave={createRework} />}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && <SectionBoundary name="a ficha do agendamento">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3"><span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">{selected.plate}</span>{selected.model}{selected.priorityUrgent && selected.status !== completion && <UrgentBadge />}{selected.reworkOf && <ReworkBadge />}{isEmergency(selected.scheduleType) && <EmergencyBadge />}{(selected.sglocReference || selected.sglocSyncState !== "local_only") && <span className="inline-flex w-fit items-center rounded border bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">SGLOC: {sglocStateLabels[selected.sglocSyncState] ?? selected.sglocSyncState}</span>}</DialogTitle>
              <DialogDescription>{selected.id ? `Agendamento #${selected.id} • ` : ""}{formatDateBR(selected.date)} às {dash(normalizeTime(selected.time))}</DialogDescription>
            </DialogHeader>
            {selected.reworkOf && <div className="space-y-2 border-b pb-4">
              <Detail label="Motivo do retorno" value={selected.reworkReason ?? ""} />
              {selectedOriginal ? <Button variant="link" className="h-auto p-0 text-left whitespace-normal" onClick={() => openLinked(selectedOriginal)}>Agendamento original: {selectedOriginal.plate} • {formatDateBR(selectedOriginal.date)}</Button> : <p className="text-sm text-muted-foreground">Agendamento original indisponível</p>}
            </div>}
            {appointments.filter((item) => item.reworkOf === selected.dbId).map((child) => <div key={child.dbId} className="border-b pb-3"><Button variant="link" className="h-auto p-0 text-left whitespace-normal" onClick={() => openLinked(child)}>Gerou retrabalho em {child.date ? formatDateBR(child.date) : "data não informada"} • {child.plate}</Button></div>)}
            <div className="space-y-3 border-b pb-4">
              <DeadlineBadge item={selected} completedAt={completedAtById[selected.dbId]} today={today} completion={completion} />
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.originalDeadline && selected.originalDeadline !== selected.currentDeadline && <Detail label="Prazo original" value={formatDateBR(selected.originalDeadline)} />}
                {selected.currentDeadline ? <Detail label={selected.originalDeadline === selected.currentDeadline ? "Previsão de entrega" : "Prazo atual"} value={formatDateBR(selected.currentDeadline)} /> : <Detail label={selected.originalDeadline ? "Prazo atual" : "Previsão de entrega"} value="" />}
              </div>
            </div>
            <label><span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Situação do veículo</span>
              <select value={selected.status} disabled={Boolean(editBlockReason(selected, currentUser.role))} onChange={(event) => updateStatus(selected.dbId, event.target.value as ServiceStatus)} className={cn("disabled:cursor-not-allowed disabled:opacity-70 h-10 w-full rounded-md border px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring", statusClasses(selected.status, statuses))}>
                <option value="">Não atualizada</option>{serviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-destructive" checked={selected.priorityUrgent} disabled={currentUser.role === "atendimento" || Boolean(editBlockReason(selected, currentUser.role))} onChange={(event) => void updateUrgent(selected, event.target.checked)} />Marcar como urgente{currentUser.role === "atendimento" && <span className="text-xs font-normal text-muted-foreground">(somente gerente ou master)</span>}</label>
            {editBlockReason(selected, currentUser.role) && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{editBlockReason(selected, currentUser.role)}</p>}
            {currentUser.role !== "atendimento" && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={selected.editsAllowed > 1} onClick={() => grantExtraEdit(selected)}><Unlock /> Liberar edição extra</Button><span className="text-xs text-muted-foreground">Atendimento: {selected.editsUsed} de {selected.editsAllowed} edição(ões) usada(s){selected.editsAllowed > 1 ? " • edição extra já liberada" : ""}</span></div>}
            <AppointmentForm key={`${selected.dbId}-${historyKey}`} initial={fieldsFromAppointment(selected)} definitions={fieldDefinitions} editing blocked={editBlockReason(selected, currentUser.role)} onSave={saveAppointment} />
            <div className="border-t pt-4"><Button variant="outline" onClick={() => openRework(selected)}><RotateCcw /> Registrar retrabalho</Button></div>
            {(selected.osNumber !== null && fieldDefinitions.find((field) => field.field_key === "os_number")?.visible !== false) || selected.sglocReference ? <div className="grid gap-3 sm:grid-cols-2">
              {selected.osNumber !== null && fieldDefinitions.find((field) => field.field_key === "os_number")?.visible !== false && <Detail label="O.S Fornecedor" value={String(selected.osNumber)} />}
              {selected.sglocReference && <Detail label="ID SGLOC" value={selected.sglocReference} />}
            </div> : null}
            <Detail label="Data de cadastro" value={formatDateBR(selected.registeredAt)} />
            <ContactRegister key={selected.dbId} appointmentId={selected.dbId} userId={currentUser.id} />
            <AppointmentHistory appointmentId={selected.dbId} refreshKey={historyKey} customLabels={Object.fromEntries(fieldDefinitions.map((field) => [field.field_key, field.label]))} />
          </SectionBoundary>}
        </DialogContent>
      </Dialog>
      <ChangeLogDialog open={logOpen} onOpenChange={setLogOpen} onPlateClick={openVehicle} />
      <Toaster richColors position="bottom-right" />
      {currentUser.role === "master" && <AgendaSettings open={settingsOpen} onOpenChange={setSettingsOpen} statuses={statuses} fields={fieldDefinitions} currentUserId={currentUser.id} onRefresh={async () => { await loadConfig(); await loadAppointments(); }} />}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{dash(value)}</p></div>;
}