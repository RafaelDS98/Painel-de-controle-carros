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
import { History, Unlock } from "lucide-react";
import { AppointmentForm, columnForField, emptyFields, type AppointmentFields } from "@/components/appointment-form";
import { ReworkForm, type ReworkFields } from "@/components/rework-form";
import { Checkbox } from "@/components/ui/checkbox";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

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
  reworkOf: string | null;
  reworkReason: string | null;
};

export type AppRole = "atendimento" | "gerente" | "master";
export type CurrentUser = { id: string; name: string; role: AppRole };
const roleLabels: Record<AppRole, string> = { atendimento: "Atendimento", gerente: "Gerente", master: "Master" };

function editBlockReason(item: Appointment, role: AppRole): string | null {
  if (role === "master") return null;
  if (role === "gerente") return item.managerEditUsed ? "Limite de 1 edição do gerente já foi usado neste agendamento." : null;
  return item.editsUsed >= item.editsAllowed ? `Limite de ${item.editsAllowed} edição(ões) já foi usado pelo atendimento neste agendamento.` : null;
}

type ServiceStatus = "" | "Recebido" | "Em execução" | "Peça" | "Finalizado";

const serviceStatuses: Exclude<ServiceStatus, "">[] = ["Recebido", "Em execução", "Peça", "Finalizado"];

type AppointmentRow = {
  id: string; sheet_id: string; registered_at: string | null; date: string | null; time: string; plate: string; store: string;
  model: string; contact: string; workshop: string; issue: string; note: string; operator: string; external_order: string; status: string;
  creator_edits_used: number; creator_edits_allowed: number; manager_edit_used: boolean;
  original_deadline: string | null; current_deadline: string | null;
  rework_of: string | null; rework_reason: string | null;
};

function fromRow(row: AppointmentRow): Appointment {
  const status = (serviceStatuses as string[]).includes(row.status) ? (row.status as ServiceStatus) : "";
  return {
    dbId: row.id, id: row.sheet_id, registeredAt: row.registered_at ?? "", date: row.date ?? "", time: row.time, plate: row.plate,
    store: row.store, model: row.model, contact: row.contact, workshop: row.workshop, issue: row.issue, note: row.note,
    operator: row.operator, externalOrder: row.external_order, status,
    originalDeadline: row.original_deadline, currentDeadline: row.current_deadline,
    editsUsed: row.creator_edits_used, editsAllowed: row.creator_edits_allowed, managerEditUsed: row.manager_edit_used,
    reworkOf: row.rework_of, reworkReason: row.rework_reason,
  };
}

function fieldsFromAppointment(item: Appointment): AppointmentFields {
  return {
    date: item.date, time: item.time, plate: item.plate, store: item.store,
    model: item.model, contact: item.contact, workshop: item.workshop,
    issue: item.issue, note: item.note, operator: item.operator,
    externalOrder: item.externalOrder, currentDeadline: item.currentDeadline ?? "",
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
const fullDate = new Intl.DateTimeFormat("pt-BR");
const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function localDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function parseExcelDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split(/[\/\-]/);
  const [day, month, year] = parts;
  if (day && month && year) return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return raw;
}

function parseTime(value: unknown): string {
  if (typeof value === "number") {
    const minutes = Math.round(value * 24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const raw = String(value ?? "");
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  const hour = match?.[1];
  const minute = match?.[2];
  return hour && minute ? `${hour.padStart(2, "0")}:${minute}` : raw;
}

function serviceCategory(issue: string) {
  const text = issue.toLocaleUpperCase("pt-BR");
  if (text.includes("FREIO")) return "Freios";
  if (text.includes("SUSPENS")) return "Suspensão";
  if (text.includes("PNEU") || text.includes("ALINH") || text.includes("BALANCE")) return "Pneus";
  if (text.includes("REVIS") || text.includes("MANUTEN")) return "Revisão";
  return "Corretiva";
}

function countBy(data: Appointment[], getter: (item: Appointment) => string) {
  const counts = new Map<string, number>();
  data.forEach((item) => {
    const key = getter(item) || "Não informado";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="relative min-w-44 flex-1">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring">
        <option value="">{label}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" />
    </label>
  );
}

function ChartPanel({ title, subtitle, children, className }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card p-5 shadow-sm", className)}>
      <div className="mb-5"><h3 className="font-semibold text-card-foreground">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number; name?: string; payload?: { name?: string } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-lg"><p className="font-medium text-popover-foreground">{label || payload[0]?.payload?.name}</p><p className="mt-1 text-muted-foreground">{payload[0]?.value} agendamento(s)</p></div>;
}

function statusClasses(status: ServiceStatus) {
  const classes: Record<ServiceStatus, string> = {
    "": "border-input bg-background text-muted-foreground",
    Recebido: "border-status-received/40 bg-status-received text-status-received-foreground",
    "Em execução": "border-status-progress/40 bg-status-progress text-status-progress-foreground",
    Peça: "border-status-part/40 bg-status-part text-status-part-foreground",
    Finalizado: "border-status-finished/40 bg-status-finished text-status-finished-foreground",
  };
  return classes[status];
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
export function deadlineState(item: Pick<Appointment, "status" | "currentDeadline">, completedAt?: string, today = dateInBrazil(new Date())): DeadlineState | null {
  if (!item.currentDeadline) return null;
  if (item.status === "Finalizado") {
    if (!completedAt) return null;
    return dateInBrazil(new Date(completedAt)) <= item.currentDeadline ? "deliveredOnTime" : "deliveredLate";
  }
  if (item.currentDeadline < today) return "overdue";
  if (item.currentDeadline === today) return "today";
  return "onTime";
}
function DeadlineBadge({ item, completedAt, today }: { item: Appointment; completedAt: string | undefined; today: string }) {
  const state = deadlineState(item, completedAt, today);
  return state ? <span className={cn("inline-flex w-fit items-center whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold", deadlineClasses[state])}>{deadlineLabels[state]}</span> : null;
}
function ReworkBadge() {
  return <span className="inline-flex w-fit items-center rounded border border-accent bg-accent/30 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Retrabalho</span>;
}

const rowColumns = "id, sheet_id, registered_at, date, time, plate, store, model, contact, workshop, issue, note, operator, external_order, status, original_deadline, current_deadline, creator_edits_used, creator_edits_allowed, manager_edit_used, rework_of, rework_reason";

export function MaintenanceDashboard({ onSignOut, currentUser }: { onSignOut?: () => void; currentUser: CurrentUser }) {
  const [logOpen, setLogOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [completedAtById, setCompletedAtById] = useState<Record<string, string>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [reworkSource, setReworkSource] = useState<Appointment | null>(null);
  const [reworksOnly, setReworksOnly] = useState(false);
  const [today, setToday] = useState(() => dateInBrazil(new Date()));
  const [search, setSearch] = useState("");
  const [contact, setContact] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [model, setModel] = useState("");
  const [operator, setOperator] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: keyof Appointment; asc: boolean }>({ key: "date", asc: true });
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refreshToday = () => setToday(dateInBrazil(new Date()));
    const interval = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadCompletionLogs(rows: Appointment[]) {
    const ids = rows.filter((item) => item.status === "Finalizado" && item.currentDeadline).map((item) => item.dbId);
    if (!ids.length) { setCompletedAtById({}); return; }
    const latest: Record<string, string> = {};
    // Page through the filtered log so a busy agenda never loses older completion records.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("edit_log")
        .select("appointment_id, changed_at")
        .in("appointment_id", ids).eq("field_changed", "status").eq("new_value", "Finalizado")
        .order("changed_at", { ascending: false }).range(offset, offset + 499);
      if (error) { setMessage("Não foi possível verificar os prazos de entrega."); return; }
      for (const log of data ?? []) latest[log.appointment_id] ??= log.changed_at;
      if (!data || data.length < 500) break;
    }
    setCompletedAtById(latest);
  }

  async function loadAppointments() {
    const { data, error } = await supabase.from("appointments").select(rowColumns).order("date").order("time");
    if (error) { setMessage("Não foi possível carregar a agenda."); return; }
    const rows = (data ?? []).map(fromRow);
    setAppointments(rows);
    void loadCompletionLogs(rows);
  }

  useEffect(() => { void loadAppointments(); }, []);

  const option = (key: keyof Appointment) => [...new Set(appointments.map((item) => String(item[key])).filter(Boolean))].sort();
  const filtered = useMemo(() => appointments.filter((item) => {
    const q = search.toLocaleLowerCase("pt-BR");
    const hit = !q || [item.plate, item.contact, item.issue, item.model].some((value) => value.toLocaleLowerCase("pt-BR").includes(q));
    return hit && (!contact || item.contact === contact) && (!workshop || item.workshop === workshop) && (!model || item.model === model) && (!operator || item.operator === operator) && (!startDate || item.date >= startDate) && (!endDate || item.date <= endDate) && (!reworksOnly || Boolean(item.reworkOf));
  }), [appointments, contact, endDate, model, operator, reworksOnly, search, startDate, workshop]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const first = sort.key === "date" ? `${a.date}${a.time}` : String(a[sort.key]);
    const second = sort.key === "date" ? `${b.date}${b.time}` : String(b[sort.key]);
    return first.localeCompare(second, "pt-BR", { numeric: true }) * (sort.asc ? 1 : -1);
  }), [filtered, sort]);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const daily = days.map((name, index) => ({ name: name.slice(0, 3), value: filtered.filter((item) => localDate(item.date).getDay() === index + 1).length }));
  const hourly = countBy(filtered, (item) => item.time).sort((a, b) => a.name.localeCompare(b.name));
  const workshops = countBy(filtered, (item) => item.workshop).slice(0, 6);
  const contacts = countBy(filtered, (item) => item.contact).slice(0, 7);
  const services = countBy(filtered, (item) => serviceCategory(item.issue));
  const models = countBy(filtered, (item) => item.model).slice(0, 6);
  const uniqueVehicles = new Set(filtered.map((item) => item.plate)).size;
  const uniqueContacts = new Set(filtered.map((item) => item.contact)).size;
  const uniqueWorkshops = new Set(filtered.map((item) => item.workshop).filter(Boolean)).size;
  const usedDays = new Set(filtered.map((item) => item.date)).size;
  const average = usedDays ? filtered.length / usedDays : 0;

  function resetFilters() {
    setSearch(""); setContact(""); setWorkshop(""); setModel(""); setOperator(""); setStartDate(""); setEndDate(""); setReworksOnly(false); setPage(1);
  }

  function changeSort(key: keyof Appointment) {
    setSort((current) => ({ key, asc: current.key === key ? !current.asc : true }));
  }

  function replaceRow(row: AppointmentRow) {
    const next = fromRow(row);
    setAppointments((current) => current.map((item) => item.dbId === next.dbId ? next : item));
    setSelected((current) => current?.dbId === next.dbId ? next : current);
    setHistoryKey((k) => k + 1);
  }

  async function updateStatus(dbId: string, status: ServiceStatus) {
    const item = appointments.find((a) => a.dbId === dbId);
    if (!item) return;
    const blocked = editBlockReason(item, currentUser.role);
    if (blocked) { setMessage(blocked); return; }
    const { data, error } = await supabase.from("appointments").update({ status }).eq("id", dbId).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível salvar a situação."); return; }
    replaceRow(data);
    void loadCompletionLogs(appointments.map((row) => row.dbId === dbId ? fromRow(data) : row));
  }

  async function saveAppointment(changes: Partial<AppointmentFields>): Promise<boolean> {
    if (!selected) return false;
    const blocked = editBlockReason(selected, currentUser.role);
    if (blocked) { setMessage(blocked); return false; }
    const update: TablesUpdate<"appointments"> = {};
    for (const [key, value] of Object.entries(changes)) {
      if (key === "currentDeadline") update.current_deadline = value || null;
      else Object.assign(update, { [columnForField[key as keyof AppointmentFields]]: value });
    }
    if (!Object.keys(update).length) return true;
    const { data, error } = await supabase.from("appointments").update(update).eq("id", selected.dbId).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível salvar as alterações."); return false; }
    replaceRow(data);
    if (data.status === "Finalizado") void loadCompletionLogs(appointments.map((row) => row.dbId === data.id ? fromRow(data) : row));
    setMessage("Alterações salvas.");
    return true;
  }

  async function createAppointment(fields: Partial<AppointmentFields>): Promise<boolean> {
    const date = fields.date?.trim();
    const time = fields.time?.trim();
    const plate = fields.plate?.trim();
    if (!date || !time || !plate) { setMessage("Informe data, hora e placa."); return false; }
    const values: TablesInsert<"appointments"> = {
      date, time, plate, created_by: currentUser.id, status: "", sheet_id: "",
      original_deadline: fields.currentDeadline || null,
      current_deadline: fields.currentDeadline || null,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (key !== "currentDeadline" && key !== "date" && key !== "time" && key !== "plate")
        Object.assign(values, { [columnForField[key as keyof AppointmentFields]]: value?.trim() ?? "" });
    }
    const { data, error } = await supabase.from("appointments").insert(values).select(rowColumns).single();
    if (error || !data) { setMessage(error?.message || "Não foi possível criar o agendamento."); return false; }
    setNewOpen(false);
    resetFilters();
    await loadAppointments();
    setMessage(`Agendamento de ${plate} criado com sucesso.`);
    return true;
  }

  async function createRework(fields: ReworkFields): Promise<boolean> {
    if (!reworkSource) return false;
    const date = fields.date.trim();
    const time = fields.time.trim();
    const plate = fields.plate.trim();
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
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const firstRow = rows[0];
      const columns = firstRow ? Object.keys(firstRow) : [];
      const missing = requiredColumns.filter((column) => !columns.includes(column));
      if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(", ")}`);
      const hasDeadline = columns.includes("Previsão de Entrega");
      const { data: userData } = await supabase.auth.getUser();
      const createdBy = userData.user?.id ?? null;
      const records = rows.map((row) => {
        const deadline = hasDeadline && String(row["Previsão de Entrega"] ?? "").trim() !== "" ? isoOrNull(parseExcelDate(row["Previsão de Entrega"])) : null;
        return {
          sheet_id: String(row["ID"] ?? ""), registered_at: isoOrNull(parseExcelDate(row["Data Cadastro"])), date: isoOrNull(parseExcelDate(row["Data Atendimento"])),
          time: parseTime(row["Hora"]), plate: String(row["Placa"] ?? ""), store: String(row["Loja"] ?? ""), model: String(row["Modelo"] ?? ""),
          contact: String(row["Contato"] ?? ""), workshop: String(row["Local/Oficina"] ?? ""), issue: String(row["Problemas Relatado"] ?? ""),
          note: String(row["Observação"] ?? ""), operator: String(row["Operador"] ?? ""), external_order: String(row["O.S Externa"] ?? ""),
          status: "", created_by: createdBy, original_deadline: deadline, current_deadline: deadline,
        };
      });
      const { error } = await supabase.from("appointments").insert(records);
      if (error) throw new Error("Não foi possível gravar a agenda importada no banco.");
      await loadAppointments(); resetFilters(); setMessage(`${records.length} agendamentos importados com sucesso.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo."); }
  }

  function exportFile(kind: "csv" | "xlsx") {
    import("xlsx").then((XLSX) => {
       const rows = sorted.map((item) => ({ ID: item.id, "Data Atendimento": item.date, Hora: item.time, Placa: item.plate, Situação: item.status || "Não atualizada", Modelo: item.model, Contato: item.contact, "Local/Oficina": item.workshop, "Problemas Relatado": item.issue, Observação: item.note, Operador: item.operator }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      if (kind === "csv") {
        const blob = new Blob(["\ufeff", XLSX.utils.sheet_to_csv(sheet)], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "agenda-filtrada.csv"; link.click(); URL.revokeObjectURL(link.href);
      } else {
        const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Agenda"); XLSX.writeFile(book, "agenda-filtrada.xlsx");
      }
    });
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
  const loadedPeriod = firstDate && lastDate ? `${fullDate.format(localDate(firstDate))} — ${fullDate.format(localDate(lastDate))}` : "Sem dados";

  return (
    <div className={cn("min-h-screen bg-background text-foreground", dark && "dark")}>
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-md bg-primary-foreground text-primary"><Wrench className="size-5" /></div><div><p className="text-xl font-bold">ANPEX</p><p className="text-xs text-primary-foreground/70">Gestão de Agendamentos</p></div></div>
          <div className="flex items-center gap-2">
            <div className="mr-2 hidden text-right text-sm sm:block"><p className="font-semibold">{currentUser.name}</p><p className="text-xs text-primary-foreground/70">{roleLabels[currentUser.role]}</p></div>
            <Button variant="secondary" onClick={() => setLogOpen(true)}><History /> Log de alterações</Button>
            <Button variant="secondary" onClick={() => setNewOpen(true)}><Plus /> Novo agendamento</Button>
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

        {message && <div className="flex items-center justify-between rounded-md border border-accent bg-accent/30 px-4 py-3 text-sm"><span>{message}</span><Button variant="ghost" size="icon" onClick={() => setMessage("")}><X /></Button></div>}

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row">
            <label className="relative min-w-64 flex-[1.4]"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar placa, contato ou serviço" className="pl-9" /></label>
            <div className="flex min-w-64 flex-1 gap-2"><Input type="date" aria-label="Data inicial" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><Input type="date" aria-label="Data final" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <FilterSelect label="Todos os contatos" value={contact} options={option("contact")} onChange={setContact} />
            <FilterSelect label="Todas as oficinas" value={workshop} options={option("workshop")} onChange={setWorkshop} />
          </div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <FilterSelect label="Todos os modelos" value={model} options={option("model")} onChange={setModel} />
            <FilterSelect label="Todos os operadores" value={operator} options={option("operator")} onChange={setOperator} />
            <label className="flex min-h-10 items-center gap-2 text-sm text-foreground"><Checkbox checked={reworksOnly} onCheckedChange={(checked) => { setReworksOnly(checked === true); setPage(1); }} aria-label="Mostrar somente retrabalhos" />Mostrar somente retrabalhos</label>
            <Button variant="outline" onClick={resetFilters}><RotateCcw /> Limpar filtros</Button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-lg border bg-card p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">{label}</p><Icon className="size-4 text-accent-foreground" /></div><p className="text-3xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></article>)}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-semibold">Grade semanal</h2><p className="text-sm text-muted-foreground">Clique em um veículo para abrir a ficha.</p></div></div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {days.map((day, index) => {
              const rows = filtered.filter((item) => localDate(item.date).getDay() === index + 1).sort((a,b) => a.time.localeCompare(b.time));
               return <div key={day} className="min-h-48 rounded-lg border bg-muted/30 p-3"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">{day}</h3><p className="text-xs text-muted-foreground">{rows[0] ? dayMonth.format(localDate(rows[0].date)) : "—"}</p></div><span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{rows.length}</span></div><div className="space-y-2">{rows.map((item) => <article key={item.dbId} className="overflow-hidden rounded-md border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-accent"><Button variant="ghost" onClick={() => setSelected(item)} className="h-auto w-full justify-start rounded-none p-3 text-left hover:bg-transparent"><span className="min-w-0 flex-1"><span className="flex items-center justify-between"><span className="text-xs font-bold text-accent-foreground">{item.time}</span><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", serviceCategory(item.issue) === "Revisão" ? "bg-service-review text-service-review-foreground" : "bg-service-repair text-service-repair-foreground")}>{serviceCategory(item.issue)}</span></span><span className="mt-2 block font-bold tracking-wide">{item.plate}</span><span className="block truncate text-xs font-normal text-muted-foreground">{item.model}</span><span className="mt-2 block truncate text-xs font-medium">{item.contact}</span><span className="mt-1 line-clamp-2 whitespace-normal text-[11px] font-normal leading-4 text-muted-foreground">{item.issue}</span><span className="mt-2 flex flex-wrap gap-1">{item.reworkOf && <ReworkBadge />}<DeadlineBadge item={item} completedAt={completedAtById[item.dbId]} today={today} /></span></span></Button><label className="relative block border-t"><span className="sr-only">Situação de {item.plate}</span><select value={item.status} disabled={Boolean(editBlockReason(item, currentUser.role))} title={editBlockReason(item, currentUser.role) ?? undefined} onChange={(event) => updateStatus(item.dbId, event.target.value as ServiceStatus)} className={cn("disabled:cursor-not-allowed disabled:opacity-70 h-9 w-full appearance-none border-0 px-3 pr-8 text-xs font-semibold outline-none focus:ring-2 focus:ring-inset focus:ring-ring", statusClasses(item.status))}><option value="">Atualizar situação</option>{serviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 opacity-70" /></label></article>)}</div></div>;
            })}
          </div>
        </section>

        <section><h2 className="mb-3 text-lg font-semibold">Indicadores da operação</h2><div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartPanel title="Atendimentos por dia" subtitle="Volume distribuído na semana"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-1)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel title="Faixas de horário" subtitle="Concentração ao longo da manhã"><ResponsiveContainer width="100%" height="100%"><AreaChart data={hourly}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="value" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.16} strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartPanel>
          <ChartPanel title="Volume por oficina" subtitle="Prestadores mais acionados"><ResponsiveContainer width="100%" height="100%"><BarChart data={workshops} layout="vertical" margin={{ left: 8 }}><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" allowDecimals={false} hide /><YAxis dataKey="name" type="category" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-3)" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel title="Atendimentos por contato" subtitle="Participação dos órgãos atendidos"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={contacts} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>{contacts.map((item,index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer></ChartPanel>
          <ChartPanel title="Categorias de serviço" subtitle="Classificação pelos problemas relatados"><ResponsiveContainer width="100%" height="100%"><BarChart data={services}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-4)" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></ChartPanel>
          <ChartPanel title="Top modelos" subtitle="Veículos com maior demanda"><ResponsiveContainer width="100%" height="100%"><BarChart data={models} layout="vertical"><CartesianGrid horizontal={false} stroke="var(--border)" /><XAxis type="number" allowDecimals={false} hide /><YAxis dataKey="name" type="category" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="value" fill="var(--chart-5)" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></ChartPanel>
        </div></section>

        <section className="rounded-lg border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">Agenda detalhada</h2><p className="text-xs text-muted-foreground">{sorted.length} registros encontrados</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => exportFile("csv")}><Download /> CSV</Button><Button variant="outline" size="sm" onClick={() => exportFile("xlsx")}><Download /> Excel</Button></div></div>
           <div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-sm"><thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{[["id","ID"],["date","Atendimento"],["time","Hora"],["plate","Placa"],["status","Situação"],["currentDeadline","Prazo"],["model","Modelo"],["contact","Contato"],["workshop","Local/Oficina"],["issue","Problema relatado"],["note","Observação"],["operator","Operador"]].map(([key,label) => <th key={key} className="px-4 py-3 font-medium"><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => changeSort(key as keyof Appointment)}>{label}<ArrowDownAZ className="size-3" /></Button></th>)}</tr></thead><tbody>{pageRows.map((item) => <tr key={item.dbId} onClick={() => setSelected(item)} className="cursor-pointer border-t hover:bg-muted/40"><td className="px-4 py-3 font-mono text-xs">#{item.id}</td><td className="whitespace-nowrap px-4 py-3">{fullDate.format(localDate(item.date))}</td><td className="px-4 py-3 font-semibold">{item.time}</td><td className="px-4 py-3 font-bold">{item.plate}{item.reworkOf && <span className="mt-1 block"><ReworkBadge /></span>}</td><td className="px-4 py-3"><span className={cn("whitespace-nowrap rounded border px-2 py-1 text-xs font-semibold", statusClasses(item.status))}>{item.status || "Não atualizada"}</span></td><td className="whitespace-nowrap px-4 py-3"><DeadlineBadge item={item} completedAt={completedAtById[item.dbId]} today={today} /></td><td className="max-w-48 truncate px-4 py-3">{item.model}</td><td className="px-4 py-3">{item.contact}</td><td className="max-w-52 truncate px-4 py-3">{item.workshop || "—"}</td><td className="max-w-72 truncate px-4 py-3 text-muted-foreground">{item.issue}</td><td className="max-w-36 truncate px-4 py-3">{item.note || "—"}</td><td className="whitespace-nowrap px-4 py-3 capitalize">{item.operator}</td></tr>)}</tbody></table></div>
          <div className="flex items-center justify-between border-t p-4"><p className="text-xs text-muted-foreground">Página {Math.min(page, pages)} de {pages}</p><div className="flex gap-2"><Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage((value) => Math.max(1,value-1))} aria-label="Página anterior"><ArrowLeft /></Button><Button variant="outline" size="icon" disabled={page === pages} onClick={() => setPage((value) => Math.min(pages,value+1))} aria-label="Próxima página"><ArrowRight /></Button></div></div>
        </section>
      </main>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Novo agendamento</DialogTitle><DialogDescription>Dados do atendimento</DialogDescription></DialogHeader>
          {newOpen && <AppointmentForm initial={emptyFields} onSave={createAppointment} />}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(reworkSource)} onOpenChange={(open) => { if (!open) setReworkSource(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Registrar retrabalho</DialogTitle><DialogDescription>{reworkSource ? `Retorno de ${reworkSource.plate} • ${reworkSource.date ? fullDate.format(localDate(reworkSource.date)) : "Sem data"}` : ""}</DialogDescription></DialogHeader>
          {reworkSource && <ReworkForm key={reworkSource.dbId} initial={{ date: "", time: "", plate: reworkSource.plate, model: reworkSource.model, contact: reworkSource.contact, workshop: reworkSource.workshop, operator: reworkSource.operator, reason: "" }} onSave={createRework} />}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selected && <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-3"><span className="rounded-md bg-primary px-2 py-1 text-primary-foreground">{selected.plate}</span>{selected.model}{selected.reworkOf && <ReworkBadge />}</DialogTitle>
              <DialogDescription>{selected.id ? `Agendamento #${selected.id} • ` : ""}{selected.date ? fullDate.format(localDate(selected.date)) : "Sem data"} às {selected.time}</DialogDescription>
            </DialogHeader>
            {selected.reworkOf && <div className="space-y-2 border-b pb-4">
              <Detail label="Motivo do retorno" value={selected.reworkReason ?? ""} />
              {appointments.find((item) => item.dbId === selected.reworkOf) ? <Button variant="link" className="h-auto p-0 text-left whitespace-normal" onClick={() => { const original = appointments.find((item) => item.dbId === selected.reworkOf); if (original) openLinked(original); }}>Agendamento original: {appointments.find((item) => item.dbId === selected.reworkOf)?.plate} • {appointments.find((item) => item.dbId === selected.reworkOf)?.date ? fullDate.format(localDate(appointments.find((item) => item.dbId === selected.reworkOf)?.date ?? "")) : "Sem data"}</Button> : <p className="text-sm text-muted-foreground">Agendamento original indisponível</p>}
            </div>}
            {appointments.filter((item) => item.reworkOf === selected.dbId).map((child) => <div key={child.dbId} className="border-b pb-3"><Button variant="link" className="h-auto p-0 text-left whitespace-normal" onClick={() => openLinked(child)}>Gerou retrabalho em {child.date ? fullDate.format(localDate(child.date)) : "data não informada"} • {child.plate}</Button></div>)}
            <div className="space-y-3 border-b pb-4">
              <DeadlineBadge item={selected} completedAt={completedAtById[selected.dbId]} today={today} />
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.originalDeadline && selected.originalDeadline !== selected.currentDeadline && <Detail label="Prazo original" value={fullDate.format(localDate(selected.originalDeadline))} />}
                {selected.currentDeadline ? <Detail label={selected.originalDeadline === selected.currentDeadline ? "Previsão de entrega" : "Prazo atual"} value={fullDate.format(localDate(selected.currentDeadline))} /> : <Detail label={selected.originalDeadline ? "Prazo atual" : "Previsão de entrega"} value="" />}
              </div>
            </div>
            <label><span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Situação do veículo</span>
              <select value={selected.status} disabled={Boolean(editBlockReason(selected, currentUser.role))} onChange={(event) => updateStatus(selected.dbId, event.target.value as ServiceStatus)} className={cn("disabled:cursor-not-allowed disabled:opacity-70 h-10 w-full rounded-md border px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring", statusClasses(selected.status))}>
                <option value="">Não atualizada</option>{serviceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            {editBlockReason(selected, currentUser.role) && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{editBlockReason(selected, currentUser.role)}</p>}
            {currentUser.role !== "atendimento" && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={selected.editsAllowed > 1} onClick={() => grantExtraEdit(selected)}><Unlock /> Liberar edição extra</Button><span className="text-xs text-muted-foreground">Atendimento: {selected.editsUsed} de {selected.editsAllowed} edição(ões) usada(s){selected.editsAllowed > 1 ? " • edição extra já liberada" : ""}</span></div>}
            <AppointmentForm key={`${selected.dbId}-${historyKey}`} initial={fieldsFromAppointment(selected)} editing blocked={editBlockReason(selected, currentUser.role)} onSave={saveAppointment} />
            <div className="border-t pt-4"><Button variant="outline" onClick={() => openRework(selected)}><RotateCcw /> Registrar retrabalho</Button></div>
            <Detail label="Data de cadastro" value={selected.registeredAt ? fullDate.format(localDate(selected.registeredAt)) : ""} />
            <AppointmentHistory appointmentId={selected.dbId} refreshKey={historyKey} />
          </>}
        </DialogContent>
      </Dialog>
      <ChangeLogDialog open={logOpen} onOpenChange={setLogOpen} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm leading-6">{value || "Não informado"}</p></div>;
}