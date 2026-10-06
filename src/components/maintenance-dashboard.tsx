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
import { AlertTriangle, ChevronLeft, ChevronRight, History, Trash2, Unlock, UserCircle } from "lucide-react";
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
import { DASH, EMPTY_OPTION, NO_DATE_GROUP, clampPage, compareDateTime, compareText, countBy, dash, exportHeaders, exportRows, foldedOptions, formatDateBR, groupWeek, inPeriod, matchesFilter, safeAverage, serviceCategory, textMatches, toCsv, buildImportRecords, dropExistingReferences, activeOnly, archiveConfirmText, importErrorReason } from "@/lib/agenda-safety";
import { TrashDialog } from "@/components/trash-dialog";
import { applySelection, hasSelection, isSelected, removeSelection, selectionChips, toggleSelection, type ChartDim, type ChartSelection } from "@/lib/chart-selection";
import { fixSheetRange } from "@/lib/sheet-range";
import { SearchableSelect } from "@/components/searchable-select";
import { weekdayIndex } from "@/lib/agenda-safety";
import { SectionBoundary } from "@/components/section-boundary";
import { customValues, statusColorProps, type FieldDefinition, type StatusOption, type CustomValues } from "@/lib/agenda-config";
import { IndicatorDetails, type IndicatorGroup, type IndicatorAppointment } from "@/components/indicator-details";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getSglocSyncStatus, pushAppointmentToSgloc } from "@/lib/sgloc/sgloc.functions";
import { AGENDA_REFRESH_MS, agendaWarnings, type SyncSnapshot } from "@/lib/agenda-freshness";
import { canManageDeadline, deadlineBlockReason } from "@/lib/edit-limits";
import { buildAppointmentUpdate } from "@/lib/appointment-update";
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
  managerEditsUsed: number;
  deadlineChangesUsed: number;
  deadlineChangesAllowed: number;
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
  sglocLastError: string;
};

export type AppRole = "atendimento" | "oficina" | "gerente" | "master";
export type CurrentUser = { id: string; name: string; role: AppRole; email?: string };
const roleLabels: Record<AppRole, string> = { atendimento: "Atendimento", oficina: "Oficina", gerente: "Gerente", master: "Master" };

function deadlineBlock(item: Appointment, role: AppRole): string | null {
  return deadlineBlockReason({ deadlineChangesUsed: item.deadlineChangesUsed, deadlineChangesAllowed: item.deadlineChangesAllowed }, role);
}

type ServiceStatus = string;

type AppointmentRow = {
  id: string; sheet_id: string; registered_at: string | null; date: string | null; time: string; plate: string; store: string;
  model: string; contact: string; workshop: string; issue: string; note: string; operator: string; external_order: string; status: string;
  creator_edits_used: number; creator_edits_allowed: number; manager_edit_used: boolean; manager_edits_used?: number | null; deadline_changes_used?: number | null; deadline_changes_allowed?: number | null; priority_urgent: boolean;
  original_deadline: string | null; current_deadline: string | null;
  rework_of: string | null; rework_reason: string | null; custom_fields: unknown;
  brand?: string | null; contact_number?: string | null; km_scheduled?: number | null; os_number?: number | null;
  schedule_type?: string | null; sgloc_reference?: string | null; sgloc_sync_state?: string | null; sgloc_last_error?: string | null; archived_at?: string | null;
};

function fromRow(row: AppointmentRow): Appointment {
  return {
    dbId: row.id, id: row.sheet_id, registeredAt: row.registered_at ?? "", date: row.date ?? "", time: safeText(row.time), plate: normalizePlate(row.plate),
    store: row.store, model: row.model, contact: row.contact, workshop: row.workshop, issue: row.issue, note: row.note,
    operator: row.operator, externalOrder: row.external_order, status: row.status,
    originalDeadline: row.original_deadline, currentDeadline: row.current_deadline,
    editsUsed: row.creator_edits_used, editsAllowed: row.creator_edits_allowed, managerEditUsed: row.manager_edit_used, managerEditsUsed: row.manager_edits_used ?? (row.manager_edit_used ? 1 : 0), deadlineChangesUsed: row.deadline_changes_used ?? 0, deadlineChangesAllowed: row.deadline_changes_allowed ?? 1, priorityUrgent: row.priority_urgent,
    reworkOf: row.rework_of, reworkReason: row.rework_reason, customFields: customValues(row.custom_fields),
    brand: safeText(row.brand), contactNumber: safeText(row.contact_number), kmScheduled: row.km_scheduled ?? null,
    osNumber: row.os_number ?? null, scheduleType: safeText(row.schedule_type) || "N", sglocReference: safeText(row.sgloc_reference),
    sglocSyncState: safeText(row.sgloc_sync_state) || "local_only",
    sglocLastError: safeText(row.sgloc_last_error),
  };
}

function fieldsFromAppointment(item: Appointment): AppointmentFields {
  return {
    date: item.date, time: item.time, plate: item.plate, store: item.store,
    model: item.model, contact: item.contact, workshop: item.workshop,
    issue: item.issue, note: item.note, operator: item.operator,
    externalOrder: item.externalOrder, currentDeadline: item.currentDeadline ?? "", customFields: item.customFields,
    brand: item.brand, contactNumber: item.contactNumber, kmScheduled: item.kmScheduled === null ? "" : String(item.kmScheduled),
    status: item.status, priorityUrgent: item.priorityUrgent,
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





const chartHint = "Clique para filtrar; clique de novo para limpar";

function ChartPanel({ title, subtitle, children, className, empty, items, isOn, onToggle }: { title: string; subtitle: string; children: React.ReactNode; className?: string; empty?: boolean; items?: string[]; isOn?: (name: string) => boolean; onToggle?: (name: string, additive: boolean) => void }) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card p-5 shadow-sm", className)}>
      <div className="mb-5"><h3 className="font-semibold text-card-foreground">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>{onToggle && <p className="mt-1 text-[11px] text-muted-foreground">{chartHint}. Ctrl/Cmd+clique soma itens.</p>}</div>
      <div className="h-64 w-full cursor-pointer" title={onToggle ? chartHint : undefined}>{empty ? <div className="grid h-full place-items-center rounded-md border border-dashed text-sm text-muted-foreground">Sem dados no período</div> : children}</div>
      {onToggle && items && items.length > 0 && <div role="group" aria-label={`Filtrar por ${title}`} className="sr-only focus-within:not-sr-only focus-within:mt-3 focus-within:flex focus-within:flex-wrap focus-within:gap-1">{items.map((name) => <button key={name} type="button" aria-pressed={isOn?.(name) ?? false} onClick={(event) => onToggle(name, event.ctrlKey || event.metaKey)} className={cn("min-h-11 max-w-full truncate rounded-md border px-3 text-xs", isOn?.(name) && "border-primary bg-primary text-primary-foreground")}>{name}</button>)}</div>}
    </section>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string; payload?: { name?: string } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-lg"><p className="font-medium text-popover-foreground">{label || payload[0]?.payload?.name}</p><p className="mt-1 text-muted-foreground">{payload[0]?.value} agendamento(s)</p></div>;
}

function statusProps(status: ServiceStatus, statuses: StatusOption[]) {
  return statusColorProps(status ? statuses.find((option) => option.label === status)?.color_token : undefined);
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

const rowColumns = "id, sheet_id, registered_at, date, time, plate, store, model, contact, workshop, issue, note, operator, external_order, status, original_deadline, current_deadline, creator_edits_used, creator_edits_allowed, manager_edit_used, manager_edits_used, deadline_changes_used, deadline_changes_allowed, priority_urgent, rework_of, rework_reason, custom_fields, brand, contact_number, km_scheduled, os_number, schedule_type, sgloc_reference, sgloc_sync_state, sgloc_last_error, archived_at";

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
  const [trashOpen, setTrashOpen] = useState(false);
  const [chartSel, setChartSel] = useState<ChartSelection>({});
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setChartSel((current) => (hasSelection(current) ? {} : current)); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: keyof Appointment | "priority"; asc: boolean }>({ key: "priority", asc: true });
  const [message, setMessage] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchResult, setBatchResult] = useState<{ updated: number; unchanged: number; skipped: number; errors: { line: number; plate: string; reason: string }[] } | null>(null);
  const [importResult, setImportResult] = useState<{ created: { line: number; plate: string; date: string | null; time: string; ref: string | null }[]; skippedEmpty: number; skippedExisting: number; errors: { line: number; plate: string; reason: string }[] } | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [syncSnap, setSyncSnap] = useState<SyncSnapshot | null>(null);
  const syncStatus = useServerFn(getSglocSyncStatus);
  const freshness = agendaWarnings({ loadedAt, now: nowTick, loadFailed, sync: syncSnap });
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

  async function archiveAppointment(item: Appointment) {
    if (!window.confirm(archiveConfirmText(item.sglocReference))) return;
    const { error } = await supabase.from("appointments").update({ archived_at: new Date().toISOString() }).eq("id", item.dbId);
    if (error) { toast.error(`Não foi possível excluir: ${error.message}`); return; }
    setSelected(null); toast.success("Agendamento excluído. Ele está na Lixeira e pode ser restaurado.");
    await loadAppointments();
  }

  async function loadAppointments() {
    const data: AppointmentRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from("appointments").select(rowColumns).is("archived_at", null).order("date").order("time").range(offset, offset + 499);
      if (result.error) { setLoadFailed(true); setLoadError("Não foi possível carregar a agenda. Verifique sua conexão e tente de novo."); return; }
      data.push(...(result.data ?? []));
      if (!result.data || result.data.length < 500) break;
    }
    setLoadError(""); setLoadFailed(false); setLoadedAt(Date.now());
    const rows = activeOnly(data).map(fromRow);
    setAppointments(rows);
    void loadCompletionLogs(rows);
  }

  async function loadSyncSnapshot() {
    if (currentUser.role !== "master") return;
    try {
      const s = await syncStatus();
      setSyncSnap({ syncLive: s.settings.syncLive, intervalMinutes: s.settings.intervalMinutes, last: s.last, lastRealSuccessAt: s.lastRealSuccessAt, accountWarning: s.accountWarning });
    } catch { /* aviso de sincronização é opcional; a agenda continua */ }
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
  const [, setLimitsTick] = useState(0);
  useEffect(() => {
    void (async () => {
      setLimitsTick((t) => t + 1);
    })();
  }, []);
  useEffect(() => { void loadConfig(); void loadAppointments(); void loadSyncSnapshot(); }, []);
  // Recarrega sozinha a cada 2 min e ao voltar para a aba, para novos agendamentos aparecerem sem recarregar a página.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") { void loadAppointments(); void loadSyncSnapshot(); } setNowTick(Date.now()); };
    const interval = window.setInterval(refresh, AGENDA_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => { if (statuses.length) void loadCompletionLogs(appointments); }, [completion]);

  const option = (key: keyof Appointment) => foldedOptions(appointments.map((item) => item[key]));
  const baseFiltered = useMemo(() => appointments.filter((item) => {
    const qPlate = normalizePlate(search);
    const hit = !search.trim() || (qPlate !== "" && item.plate.includes(qPlate)) || textMatches(search, [item.plate, item.brand, item.contactNumber, item.contact, item.issue, item.model, item.workshop, item.note, ...fieldDefinitions.filter((field) => field.storage === "custom" && ["text", "textarea"].includes(field.field_type)).map((field) => item.customFields[field.field_key])]);
    return hit && (!plateFilter || (plateFilter === EMPTY_OPTION ? !item.plate : normalizePlate(item.plate) === normalizePlate(plateFilter))) && matchesFilter(item.contact, contact) && matchesFilter(item.workshop, workshop) && matchesFilter(item.model, model) && matchesFilter(item.operator, operator) && (!reworksOnly || Boolean(item.reworkOf));
  }), [appointments, contact, model, operator, plateFilter, reworksOnly, search, workshop, fieldDefinitions]);
  const periodFiltered = useMemo(() => baseFiltered.filter((item) => inPeriod(item.date, startDate, endDate)), [baseFiltered, startDate, endDate]);
  // Seleção dos gráficos (filtro cruzado): vale para KPIs, balões, lista e grade; cada gráfico ignora a própria seleção.
  const filtered = useMemo(() => applySelection(periodFiltered, chartSel), [periodFiltered, chartSel]);
  const chartBase = (dim: ChartDim) => applySelection(periodFiltered, chartSel, dim);

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
  const gridDays = groupWeek(applySelection(baseFiltered, chartSel), gridWeek.start, gridWeek.end).days;
  const week = { days: gridDays, noDate: groupWeek(filtered, gridWeek.start, gridWeek.end).noDate };
  const shiftGrid = (weeks: number) => { const base = new Date(`${gridWeek.start}T12:00:00Z`); base.setUTCDate(base.getUTCDate() + weeks * 7); setGridStart(base.toISOString().slice(0, 10)); };
  const shortDay = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)).replace(/\./g, "").replace(" de ", " ");
  const gridLabel = `${shortDay(gridWeek.start)} – ${shortDay(gridWeek.end)}`;
  const daily = days.map((name, index) => ({ name: name.slice(0, 3), value: chartBase("weekday").filter((item) => weekdayIndex(item.date) === index).length }));
  const pendingToday = pendingDeliveries(appointments, today, today, completion);
  const pendingWeek = pendingDeliveries(appointments, visibleWeek.start, visibleWeek.end, completion);
  const hourly = countBy(chartBase("hour"), (item) => normalizeTime(item.time)).sort((a, b) => a.name === DASH ? 1 : b.name === DASH ? -1 : a.name.localeCompare(b.name));
  const workshops = countBy(chartBase("workshop"), (item) => item.workshop).slice(0, 6);
  const contacts = countBy(chartBase("contact"), (item) => item.contact).slice(0, 7);
  const services = countBy(chartBase("service"), (item) => serviceCategory(item.issue));
  const models = countBy(chartBase("model"), (item) => item.model).slice(0, 6);
  const uniqueVehicles = new Set(filtered.map((item) => item.plate).filter(Boolean)).size;
  const uniqueContacts = countBy(filtered.filter((item) => safeText(item.contact)), (item) => item.contact).length;
  const uniqueWorkshops = countBy(filtered.filter((item) => safeText(item.workshop)), (item) => item.workshop).length;
  const usedDays = new Set(filtered.map((item) => normalizeDate(item.date)).filter(Boolean)).size;
  const average = safeAverage(filtered.filter((item) => normalizeDate(item.date)).length, usedDays);

  function resetFilters() {
    setSearch(""); setPlateFilter(""); setContact(""); setWorkshop(""); setModel(""); setOperator(""); setPeriodPreset("custom"); setStartDate(""); setEndDate(""); setReworksOnly(false); setChartSel({}); setPage(1);
  }

  function applyDetailFilter(label: string, apply: () => void, undo: () => void) {
    apply(); setPage(1); setKpiOpen(null); setHistoryPlate(null);
    window.setTimeout(() => agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
    toast(`Filtrando por: ${label}`, { action: { label: "Desfazer", onClick: () => { undo(); setPage(1); } } });
  }
  function selectChart(dim: ChartDim, value: unknown, additive = false) {
    const name = safeText(value);
    if (!name) return;
    setChartSel((current) => toggleSelection(current, dim, name, additive)); setPage(1);
  }
  const chartClick = (dim: ChartDim) => (entry: { name?: unknown; payload?: { name?: unknown } } | undefined, _index?: number, event?: React.MouseEvent) =>
    selectChart(dim, entry?.payload?.name ?? entry?.name, Boolean(event?.ctrlKey || event?.metaKey));
  const dimOpacity = (dim: ChartDim, name: string) => (!hasSelection(chartSel, dim) || isSelected(chartSel, dim, name) ? 1 : 0.25);
  const chartKeys = (dim: ChartDim, data: { name: string }[]) => ({ items: data.map((d) => d.name), isOn: (name: string) => isSelected(chartSel, dim, name), onToggle: (name: string, additive: boolean) => selectChart(dim, name, additive) });
  /** Balões e cartões: clicar no filtro já ativo desfaz (mesma lógica de alternar dos gráficos). */
  function toggleDetailFilter(label: string, active: boolean, apply: () => void, undo: () => void, clear: () => void) {
    if (active) { clear(); setPage(1); setKpiOpen(null); toast(`Filtro removido: ${label}`); return; }
    applyDetailFilter(label, apply, undo);
  }
  function filterPlate(value: string) {
    const previous = plateFilter;
    if (previous && normalizePlate(previous) === normalizePlate(value)) { toggleDetailFilter(`Placa: ${value === EMPTY_OPTION ? "Não informado" : value}`, true, () => {}, () => {}, () => setPlateFilter("")); return; }
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

  const pushSgloc = useServerFn(pushAppointmentToSgloc);
  const dirtyRef = useRef(false);
  const sendableKeys: Record<string, string> = { date: "date", time: "time", plate: "plate", kmScheduled: "km_scheduled", contact: "contact", contactNumber: "contact_number", issue: "issue", note: "note", workshop: "workshop", externalOrder: "external_order" };

  async function refreshRow(id: string) {
    const { data } = await supabase.from("appointments").select(rowColumns).eq("id", id).maybeSingle();
    if (data) replaceRow(data);
  }

  /** Envia ao SGLOC sem desfazer nada no painel; mostra o resultado. */
  async function sendToSgloc(id: string, origin: "create" | "update" | "retry", changed: string[] = []) {
    try {
      const result = await pushSgloc({ data: { appointmentId: id, origin, changed } });
      if (result.warning) toast.warning(result.warning);
      if (result.status === "synced") toast.success("Enviado ao SGLOC.");
      if (result.status === "failed") toast.error(`SGLOC: falha no envio. ${result.message ?? ""}`);
      if (result.status === "synced" || result.status === "failed") await refreshRow(id);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível enviar ao SGLOC."); }
  }

  async function saveAppointment(changes: Partial<AppointmentFields>): Promise<boolean> {
    if (!selected) return false;
    const blocked = "currentDeadline" in changes ? deadlineBlock(selected, currentUser.role) : null;
    if (blocked) { setMessage(blocked); return false; }
    if (changes.status && !serviceStatuses.includes(changes.status)) { setMessage("Situação inválida."); return false; }
    const update = buildAppointmentUpdate(changes, selected.customFields, { canUrgent: canManageDeadline(currentUser.role) }) as TablesUpdate<"appointments">;
    if (!Object.keys(update).length) return true;
    const { data, error } = await updateAppointmentRow(selected.dbId, update);
    if (error || !data) { setMessage(error?.message || "Não foi possível salvar as alterações."); return false; }
    replaceRow(data);
    if (data.status === completion) void loadCompletionLogs(appointments.map((row) => row.dbId === data.id ? fromRow(data) : row));
    dirtyRef.current = false;
    setMessage("Alterações salvas.");
    const changedSendable = Object.keys(changes).map((key) => sendableKeys[key]).filter((v): v is string => Boolean(v));
    if (data.sgloc_reference && changedSendable.length) void sendToSgloc(data.id, "update", changedSendable);
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
      if (key !== "customFields" && key !== "status" && key !== "priorityUrgent" && key !== "currentDeadline" && key !== "date" && key !== "time" && key !== "plate")
        Object.assign(values, { [columnForField[key as keyof typeof columnForField]]: typeof value === "string" ? value.trim() : "" });
    }
    const { data, error } = await supabase.from("appointments").insert(values).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível criar o agendamento."); return false; }
    setNewOpen(false);
    setNewUrgent(false);
    resetFilters();
    await loadAppointments();
    setMessage(`Agendamento de ${plate} criado com sucesso.`);
    void sendToSgloc(data.id, "create");
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

  async function grantDeadlineChange(item: Appointment) {
    const { data, error } = await supabase.from("appointments").update({ deadline_changes_allowed: Math.max(item.deadlineChangesAllowed, item.deadlineChangesUsed) + 1 }).eq("id", item.dbId).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível liberar a alteração da previsão."); return; }
    replaceRow(data); setMessage(`Nova alteração da previsão liberada para ${item.plate}.`);
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
      const { records: candidates, skippedEmpty, lines } = buildImportRecords(rows, createdBy, hasDeadline);
      const refs = [...new Set(candidates.map((item) => item.sgloc_reference).filter((ref): ref is string => Boolean(ref)))];
      const existing = new Set<string>();
      for (let start = 0; start < refs.length; start += 200) {
        const { data, error } = await supabase.rpc("existing_sgloc_references", { _refs: refs.slice(start, start + 200) });
        if (error) throw new Error("Não foi possível conferir os IDs do SGLOC já cadastrados.");
        for (const ref of data ?? []) if (ref) existing.add(ref);
      }
      const tagged = candidates.map((record, index) => ({ record, line: lines[index] ?? 0, sgloc_reference: record.sgloc_reference }));
      const { kept, skippedExisting } = dropExistingReferences(tagged, existing);
      const created: { line: number; plate: string; date: string | null; time: string; ref: string | null }[] = [];
      const errors: { line: number; plate: string; reason: string }[] = [];
      const ok = (item: (typeof kept)[number]) => created.push({ line: item.line, plate: item.record.plate ?? "", date: item.record.date ?? null, time: item.record.time ?? "", ref: item.record.sgloc_reference ?? null });
      // Grava em blocos; se um bloco falhar, tenta linha a linha para gravar as boas e explicar as recusadas.
      for (let start = 0; start < kept.length; start += 50) {
        const chunk = kept.slice(start, start + 50);
        const { error } = await supabase.from("appointments").insert(chunk.map((item) => item.record));
        if (!error) { chunk.forEach(ok); continue; }
        for (const item of chunk) {
          const single = await supabase.from("appointments").insert(item.record);
          if (single.error) errors.push({ line: item.line, plate: item.record.plate ?? "", reason: importErrorReason(single.error) });
          else ok(item);
        }
      }
      await loadAppointments(); resetFilters();
      setMessage("");
      setImportResult({ created, skippedEmpty, skippedExisting, errors });
      const firstDate = created.map((item) => item.date).filter((d): d is string => Boolean(d)).sort()[0];
      if (firstDate) window.setTimeout(() => setGridStart(weekRange(firstDate).start), 50);
      if (created.length) toast.success(`${created.length} agendamento(s) criado(s) pela importação.`);
      else if (errors.length) toast.error("Nenhum agendamento foi gravado. Veja os erros por linha.");
    } catch (error) { setImportResult(null); setMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo."); }
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
      filter: () => key === "plate" ? filterPlate(value) : toggleDetailFilter(`${key === "contact" ? "Cliente" : "Oficina"}: ${value === EMPTY_OPTION ? "Não informado" : value}`, Boolean(previous) && matchesFilter(value, previous),
        () => key === "contact" ? setContact(value) : setWorkshop(value), () => key === "contact" ? setContact(previous) : setWorkshop(previous), () => key === "contact" ? setContact("") : setWorkshop("")) };
  });
  const indicatorGroups: IndicatorGroup[] = kpiOpen === "Veículos únicos" ? grouped("plate") : kpiOpen === "Clientes atendidos" ? grouped("contact") : kpiOpen === "Oficinas acionadas" ? grouped("workshop") :
    kpiOpen === "Média por dia" ? [...new Set(filtered.map((item) => normalizeDate(item.date)).filter((date): date is string => Boolean(date)))].sort().map((date) => ({ key: date, label: formatDateBR(date), rows: filtered.filter((item) => normalizeDate(item.date) === date).map(indicatorRow), filter: () => { const before = { startDate, endDate, periodPreset }; toggleDetailFilter(`Dia: ${formatDateBR(date)}`, startDate === date && endDate === date, () => { setPeriodPreset("custom"); setStartDate(date); setEndDate(date); }, () => { setPeriodPreset(before.periodPreset); setStartDate(before.startDate); setEndDate(before.endDate); }, () => { setPeriodPreset("custom"); setStartDate(""); setEndDate(""); }); } })) :
    kpiOpen === "Agendamentos" || kpiOpen === "Retrabalhos no período" ? sorted.filter((item) => kpiOpen === "Agendamentos" || item.reworkOf).map((item) => ({ key: item.dbId, label: `${item.plate || "Não informado"} · ${formatDateBR(item.date)}${item.reworkOf ? ` · Original: ${appointments.find((row) => row.dbId === item.reworkOf)?.plate || "Não informado"}` : ""}`, rows: [indicatorRow(item)], filter: () => filterPlate(item.plate || EMPTY_OPTION) })) : [];

  const renderCard = (item: Appointment) => (<article key={item.dbId} className="overflow-hidden rounded-md border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-accent"><div className="p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-accent-foreground">{dash(normalizeTime(item.time))}</span><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", serviceCategory(item.issue) === "Revisão" ? "bg-service-review text-service-review-foreground" : "bg-service-repair text-service-repair-foreground")}>{serviceCategory(item.issue)}</span></div><Button variant="link" className="mt-1 min-h-11 h-auto px-0 font-bold text-primary" onClick={() => openVehicle(item.plate)}>{item.plate || "Não informado"}<ChevronRight className="size-4" /></Button><p className="truncate text-xs text-muted-foreground">{dash(item.model)}</p><p className="mt-2 truncate text-xs font-medium">{dash(item.contact)}</p><p className="mt-1 line-clamp-2 whitespace-normal text-[11px] leading-4 text-muted-foreground">{dash(item.issue)}</p><div className="mt-2 flex flex-wrap gap-1">{item.priorityUrgent && item.status !== completion && <UrgentBadge />}{item.reworkOf && <ReworkBadge />}{isEmergency(item.scheduleType) && <EmergencyBadge />}<DeadlineBadge item={item} completedAt={completedAtById[item.dbId]} today={today} completion={completion} /></div><Button variant="ghost" size="sm" className="mt-2 w-full justify-between text-primary" onClick={() => setSelected(item)}>Abrir agendamento<ChevronRight className="size-4" /></Button></div><div className={cn("border-t px-3 py-2 text-xs font-semibold", statusProps(item.status, statuses).className)} style={statusProps(item.status, statuses).style}>{item.status || "Situação não atualizada"}</div></article>);

  return (
    <div className={cn("min-h-screen overflow-x-hidden bg-background text-foreground", dark && "dark")}>
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-md bg-primary-foreground text-primary"><Wrench className="size-5" /></div><div><p className="text-xl font-bold">ANPEXC</p><p className="text-xs text-primary-foreground/70">Gestão de Agendamentos</p></div></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAccountOpen(true)} title="Minha conta" className="mr-2 min-h-11 rounded-md px-2 text-right text-sm hover:bg-primary-foreground/10"><p className="font-semibold"><UserCircle className="mr-1 inline size-4" />{currentUser.name}</p><p className="text-xs text-primary-foreground/70">{roleLabels[currentUser.role]} · Minha conta</p></button>
            <MyAccountDialog open={accountOpen} onOpenChange={setAccountOpen} userId={currentUser.id} email={currentUser.email ?? ""} name={currentUser.name} onSaved={() => void queryClientForAccount.invalidateQueries({ queryKey: ["profile", currentUser.id] })} />
            <Button variant="secondary" onClick={() => setLogOpen(true)}><History /> Log de alterações</Button>
            {currentUser.role !== "oficina" && <Button variant="secondary" onClick={() => setNewOpen(true)}><Plus /> Novo agendamento</Button>}
             {currentUser.role === "master" && <Button variant="secondary" onClick={() => setSettingsOpen(true)}><Settings /> Configurações</Button>}
            {currentUser.role === "master" && <Button variant="secondary" onClick={() => setTrashOpen(true)}><Trash2 /> Lixeira</Button>}
            {currentUser.role !== "oficina" && <Button variant="secondary" onClick={() => inputRef.current?.click()}><Upload /> Importar agenda</Button>}
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
        {freshness.length > 0 && <div role="status" aria-label="Aviso de agenda desatualizada" className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><ul className="flex-1 space-y-1">{freshness.map((text) => <li key={text}>{text}</li>)}</ul><Button variant="outline" size="sm" onClick={() => { void loadAppointments(); void loadSyncSnapshot(); }}>Atualizar agora</Button></div>}
        {message && <div className="flex items-center justify-between rounded-md border border-accent bg-accent/30 px-4 py-3 text-sm"><span>{message}</span><Button variant="ghost" size="icon" onClick={() => setMessage("")}><X /></Button></div>}
        {importResult && <section aria-label="Resultado da importação" className="space-y-2 border-y py-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Importação concluída</h2><Button variant="ghost" size="icon" aria-label="Fechar resultado da importação" onClick={() => setImportResult(null)}><X /></Button></div>
          <p>{importResult.created.length} criado(s) · 0 atualizado(s) (a importação só cria; para alterar use "Atualizar agenda em lote") · {importResult.skippedEmpty} ignorada(s) sem placa ou vazias · {importResult.skippedExisting} ignorada(s) por ID do SGLOC já existente · {importResult.errors.length} erro(s)</p>
          {importResult.created.length > 0 && <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5">{importResult.created.map((item) => <li key={`c-${item.line}`}>Linha {item.line} · {dash(item.plate)} · {formatDateBR(item.date)} {dash(item.time)}{item.ref ? ` · ID SGLOC ${item.ref}` : ""}</li>)}</ul>}
          {importResult.errors.length > 0 && <ul className="max-h-64 list-disc space-y-1 overflow-y-auto pl-5 text-destructive">{importResult.errors.map((error) => <li key={`e-${error.line}`}>Linha {error.line} · {dash(error.plate)}: {error.reason}</li>)}</ul>}
        </section>}
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

        <SectionBoundary name="os gráficos"><section><h2 className="mb-3 text-lg font-semibold">Indicadores da operação</h2>
          {hasSelection(chartSel) && <div aria-label="Seleções dos gráficos" className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-xs font-semibold text-muted-foreground">Filtrando pelos gráficos:</span>{selectionChips(chartSel).map((chip) => <Button key={`${chip.dim}-${chip.value}`} variant="secondary" size="sm" className="min-h-11 max-w-full gap-2" aria-label={`Remover ${chip.label}`} onClick={() => setChartSel((current) => removeSelection(current, chip.dim, chip.value))}><span className="truncate">{chip.label}</span><X className="size-4 shrink-0" /></Button>)}<Button variant="outline" size="sm" className="min-h-11" onClick={() => setChartSel({})}><RotateCcw className="size-4" />Limpar tudo</Button></div>}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartPanel empty={daily.every((d) => !d.value)} title="Atendimentos por dia da semana" subtitle="Soma de todo o período filtrado (registros sem data ficam de fora)" {...chartKeys("weekday", daily)}><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-1)" radius={[4,4,0,0]} cursor="pointer" onClick={chartClick("weekday")}>{daily.map((d) => <Cell key={d.name} fillOpacity={dimOpacity("weekday", d.name)} />)}</Bar></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!hourly.length} title="Faixas de horário" subtitle="Concentração ao longo da manhã" {...chartKeys("hour", hourly)}><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourly} onClick={(state, event) => state?.activeLabel !== undefined && selectChart("hour", state.activeLabel, Boolean((event as unknown as React.MouseEvent | undefined)?.ctrlKey || (event as unknown as React.MouseEvent | undefined)?.metaKey))}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="value" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={hasSelection(chartSel, "hour") ? 0.08 : 0.16} strokeWidth={2} dot={(props: { cx?: number; cy?: number; payload?: { name: string }; index?: number }) => <g key={props.index} style={{ cursor: "pointer" }}><circle cx={props.cx} cy={props.cy} r={14} fill="transparent" /><circle cx={props.cx} cy={props.cy} r={isSelected(chartSel, "hour", props.payload?.name ?? "") ? 6 : 4} fill="var(--chart-2)" fillOpacity={dimOpacity("hour", props.payload?.name ?? "")} /></g>} /></AreaChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!workshops.length} title="Volume por oficina" subtitle="Prestadores mais acionados" {...chartKeys("workshop", workshops)}><ResponsiveContainer width="100%" height="100%"><BarChart data={workshops} layout="vertical" margin={{ left: 8 }}><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" allowDecimals={false} hide /><YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-3)" radius={[0,4,4,0]} cursor="pointer" onClick={chartClick("workshop")}>{workshops.map((d) => <Cell key={d.name} fillOpacity={dimOpacity("workshop", d.name)} />)}</Bar></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!contacts.length} title="Atendimentos por contato" subtitle="Participação dos órgãos atendidos" {...chartKeys("contact", contacts)}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={contacts} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2} cursor="pointer" onClick={chartClick("contact")}>{contacts.map((item,index) => <Cell key={item.name} fill={palette[index % palette.length]} fillOpacity={dimOpacity("contact", item.name)} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!services.length} title="Categorias de serviço" subtitle="Classificação pelos problemas relatados" {...chartKeys("service", services)}><ResponsiveContainer width="100%" height="100%"><BarChart data={services}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-4)" radius={[4,4,0,0]} cursor="pointer" onClick={chartClick("service")}>{services.map((d) => <Cell key={d.name} fillOpacity={dimOpacity("service", d.name)} />)}</Bar></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel empty={!models.length} title="Top modelos" subtitle="Veículos com maior demanda" {...chartKeys("model", models)}><ResponsiveContainer width="100%" height="100%"><BarChart data={models} layout="vertical"><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" allowDecimals={false} hide /><YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-5)" radius={[0,4,4,0]} cursor="pointer" onClick={chartClick("model")}>{models.map((d) => <Cell key={d.name} fillOpacity={dimOpacity("model", d.name)} />)}</Bar></BarChart></ResponsiveContainer></ChartPanel>
        </div></section></SectionBoundary>

        <SectionBoundary name="a tabela"><section ref={agendaRef} className="scroll-mt-4 rounded-lg border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">Agenda detalhada</h2><p className="text-xs text-muted-foreground">{sorted.length} registros encontrados</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" aria-pressed={extraColumns} onClick={() => setExtraColumns((value) => !value)}>{extraColumns ? "Ocultar colunas extras" : "Mostrar colunas extras"}</Button><Button variant="outline" size="sm" onClick={exportBatch}><Download /> Exportar para edição em lote</Button><Button variant="outline" size="sm" disabled={batchBusy} onClick={() => batchInputRef.current?.click()}><Upload /> {batchBusy ? "Atualizando…" : "Atualizar agenda em lote"}</Button><input ref={batchInputRef} type="file" accept=".xlsx" className="hidden" aria-label="Arquivo de atualização em lote" onChange={(event) => void importBatch(event.target.files?.[0])} /><Button variant="outline" size="sm" onClick={() => exportFile("csv")}><Download /> CSV</Button><Button variant="outline" size="sm" onClick={() => exportFile("xlsx")}><Download /> Excel</Button></div></div>
           <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[1400px] text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{[["priority","Prioridade"],["id","ID"],["date","Atendimento"],["time","Hora"],["plate","Placa"],["status","Situação"],["currentDeadline","Prazo"],["model","Modelo"],["contact","Contato"],["workshop","Local/Oficina"],["issue","Problema relatado"],["note","Observação"],["operator","Operador"], ...(extraColumns ? [["brand","Marca"],["kmScheduled","KM"],["contactNumber","Telefone"],["osNumber","O.S Fornecedor"]] : [])].map(([key,label]) => <th key={key} className="px-4 py-3 font-medium"><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => changeSort(key as keyof Appointment | "priority")}>{label}<ArrowDownAZ className="size-3" /></Button></th>)}</tr></thead><tbody>{pageRows.map((item) => <tr key={item.dbId} onClick={() => setSelected(item)} className="cursor-pointer border-t hover:bg-muted/40"><td className="px-4 py-3">{item.priorityUrgent && item.status !== completion ? <UrgentBadge /> : <span className="text-xs text-muted-foreground">{["Urgente","Atrasado","Hoje","Futuro","Sem prazo"][priorityLevel(item, today, completion)]}</span>}</td><td className="px-4 py-3 font-mono text-xs">#{item.id}</td><td className="whitespace-nowrap px-4 py-3">{formatDateBR(item.date)}</td><td className="px-4 py-3 font-semibold">{dash(normalizeTime(item.time))}</td><td className="px-4 py-3 font-bold"><Button variant="link" className="min-h-11 h-auto px-0 font-bold text-primary" onClick={(event) => { event.stopPropagation(); openVehicle(item.plate); }}>{item.plate || "Não informado"}<ChevronRight className="size-4" /></Button>{item.reworkOf && <span className="mt-1 block"><ReworkBadge /></span>}{isEmergency(item.scheduleType) && <span className="mt-1 block"><EmergencyBadge /></span>}</td><td className="px-4 py-3"><span className={cn("whitespace-nowrap rounded border px-2 py-1 text-xs font-semibold", statusProps(item.status, statuses).className)} style={statusProps(item.status, statuses).style}>{item.status || "Não atualizada"}</span></td><td className="whitespace-nowrap px-4 py-3"><DeadlineBadge item={item} completedAt={completedAtById[item.dbId]} today={today} completion={completion} /></td><td title={item.model} className="max-w-48 truncate px-4 py-3">{dash(item.model)}</td><td title={item.contact} className="max-w-48 truncate px-4 py-3">{dash(item.contact)}</td><td title={item.workshop} className="max-w-52 truncate px-4 py-3">{dash(item.workshop)}</td><td title={item.issue} className="max-w-72 truncate px-4 py-3 text-muted-foreground">{dash(item.issue.replace(/\s+/g, " "))}</td><td title={item.note} className="max-w-36 truncate px-4 py-3">{dash(item.note.replace(/\s+/g, " "))}</td><td title={item.operator} className="max-w-40 truncate whitespace-nowrap px-4 py-3">{dash(item.operator)}</td>{extraColumns && <><td title={item.brand} className="max-w-36 truncate px-4 py-3">{dash(item.brand)}</td><td className="whitespace-nowrap px-4 py-3">{dash(item.kmScheduled)}</td><td className="whitespace-nowrap px-4 py-3">{dash(item.contactNumber)}</td><td className="whitespace-nowrap px-4 py-3">{dash(item.osNumber)}</td></>}</tr>)}</tbody></table></div>
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
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (open) return; if (dirtyRef.current && !window.confirm("Há alterações não salvas nesta ficha. Fechar e descartar?")) return; dirtyRef.current = false; setSelected(null); }}>
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
            {selected.sglocSyncState === "push_failed" && <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p className="font-semibold">SGLOC: falha no envio</p>
              {selected.sglocLastError && <p>{selected.sglocLastError}</p>}
              <Button size="sm" variant="outline" onClick={() => void sendToSgloc(selected.dbId, "retry")}>Reenviar</Button>
            </div>}
            {deadlineBlock(selected, currentUser.role) && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{deadlineBlock(selected, currentUser.role)}</p>}
            {canManageDeadline(currentUser.role) && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={selected.deadlineChangesAllowed > selected.deadlineChangesUsed} onClick={() => grantDeadlineChange(selected)}><Unlock /> Liberar nova alteração da previsão</Button><span className="text-xs text-muted-foreground">Previsão (atendimento/oficina): {selected.deadlineChangesUsed} de {selected.deadlineChangesAllowed} alteração(ões) usada(s)</span></div>}
            <AppointmentForm key={`${selected.dbId}-${historyKey}`} initial={fieldsFromAppointment(selected)} definitions={fieldDefinitions} editing blocked={null} deadlineLocked={Boolean(deadlineBlock(selected, currentUser.role))} onSave={saveAppointment} statusOptions={serviceStatuses} canUrgent={canManageDeadline(currentUser.role)} onDirtyChange={(dirty) => { dirtyRef.current = dirty; }} />
            <div className="flex flex-wrap gap-2 border-t pt-4">{currentUser.role !== "oficina" && <Button variant="outline" onClick={() => openRework(selected)}><RotateCcw /> Registrar retrabalho</Button>}{currentUser.role === "master" && <Button variant="destructive" onClick={() => void archiveAppointment(selected)}><Trash2 /> Excluir</Button>}</div>
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
      {currentUser.role === "master" && <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} onRestored={() => void loadAppointments()} />}
      {currentUser.role === "master" && <AgendaSettings open={settingsOpen} onOpenChange={setSettingsOpen} statuses={statuses} fields={fieldDefinitions} currentUserId={currentUser.id} onRefresh={async () => { await loadConfig(); await loadAppointments(); }} />}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{dash(value)}</p></div>;
}