import { useEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePageAction } from "@/hooks/use-page-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellOff,
  CarFront,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  LogOut,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  UserCircle,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { MyAccountDialog } from "@/components/my-account";
import { useQueryClient } from "@tanstack/react-query";
import { statusColorProps, type StatusOption } from "@/lib/agenda-config";
import { customValues } from "@/lib/agenda-config";
import { safeText, normalizePlate } from "@/lib/normalize";
import { formatDateBR } from "@/lib/agenda-safety";
import { YardCard } from "@/components/yard-card";
import { ForwardWorkshop } from "@/components/forward-workshop";
import { AGENDA_CHANGED_EVENT } from "@/lib/agenda-freshness";
import { YardKpis } from "@/components/yard-kpis";
import { CheckInSheet } from "@/components/check-in-sheet";
import { YardDetailModal } from "@/components/yard-detail-modal";
import { useYardSettings } from "@/hooks/use-yard-settings";
import { useYardNotifications } from "@/hooks/use-yard-notifications";
import {
  splitYardAndExternal,
  matchesYardSearch,
  sortByTimerDesc,
  type YardAppointment,
  type YardSettings,
  type WorkshopInfo,
} from "@/lib/yard-utils";
import type { Tables } from "@/integrations/supabase/types";
import { useYardGroups } from "@/components/yard-groups-settings";
import { itemsInGroup } from "@/lib/yard-groups";

type AppointmentRow = Tables<"appointments">;

const rowColumns =
  "id, sheet_id, registered_at, date, time, plate, store, model, contact, workshop, issue, note, operator, external_order, status, original_deadline, current_deadline, priority_urgent, rework_of, rework_reason, custom_fields, brand, contact_number, km_scheduled, os_number, schedule_type, check_in_at, check_in_note, check_in_photo_url, check_in_by, check_out_at, check_out_note, check_out_photo_url, check_out_by, archived_at, created_by";

function fromRow(row: AppointmentRow, lastStatusChangeAt: string | null): YardAppointment {
  return {
    dbId: row.id,
    plate: normalizePlate(row.plate),
    model: safeText(row.model),
    brand: safeText(row.brand),
    status: safeText(row.status),
    workshop: safeText(row.workshop),
    store: safeText(row.store),
    contact: safeText(row.contact),
    contactNumber: safeText(row.contact_number),
    issue: safeText(row.issue),
    note: safeText(row.note),
    operator: safeText(row.operator),
    currentDeadline: row.current_deadline,
    registeredAt: row.registered_at ?? "",
    checkInAt: row.check_in_at ?? null,
    checkInNote: row.check_in_note ?? null,
    checkInPhotoUrl: row.check_in_photo_url ?? null,
    checkInBy: row.check_in_by ?? null,
    checkOutAt: row.check_out_at ?? null,
    checkOutNote: row.check_out_note ?? null,
    checkOutPhotoUrl: row.check_out_photo_url ?? null,
    checkOutBy: row.check_out_by ?? null,
    osNumber: row.os_number ?? null,
    priorityUrgent: row.priority_urgent ?? false,
    lastStatusChangeAt,
    forwardedAt: row.forwarded_at,
  };
}

interface CurrentUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface WorkshopYardProps {
  currentUser: CurrentUser;
  tabs?: ReactNode;
  onSignOut?: () => void;
  onOpenMovements?: (plate: string) => void;
}

export function WorkshopYard({ currentUser, tabs, onSignOut, onOpenMovements }: WorkshopYardProps) {
  const { settings, loading: settingsLoading, updateSettings } = useYardSettings();
  const queryClient = useQueryClient();

  const [appointments, setAppointments] = useState<YardAppointment[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [workshopFilter, setWorkshopFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState<{
    item: YardAppointment;
    type: "entrada" | "saida";
  } | null>(null);
  const [detailTarget, setDetailTarget] = useState<YardAppointment | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  usePageAction((a) => {
    if (a === "config" && currentUser.role === "master") setSettingsOpen(true);
  });
  const [completionStatus, setCompletionStatus] = useState("");
  const [locationTab, setLocationTab] = useState<string>("patio");
  const yardGroups = useYardGroups();
  const [forwardId, setForwardId] = useState("");
  const [stays, setStays] = useState<Record<string, string>>({});
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  // Notification hook
  const notificationItems = useMemo(
    () => appointments.map((a) => ({ dbId: a.dbId, status: a.status, workshop: a.workshop })),
    [appointments],
  );
  const { newCount, clearNew, soundEnabled, toggleSound } = useYardNotifications(
    notificationItems,
    settings,
    true,
  );

  // Tick clock every 30s for timer updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Polling based on settings
  useEffect(() => {
    if (settingsLoading) return;
    let interval: number | undefined;
    const tick = () => {
      void loadData();
    };
    const start = () => {
      if (interval === undefined)
        interval = window.setInterval(tick, settings.polling_seconds * 1000);
    };
    const stop = () => {
      if (interval !== undefined) {
        clearInterval(interval);
        interval = undefined;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        tick();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [settings.polling_seconds, settingsLoading]);

  async function loadData() {
    try {
      const [apptResult, statusResult, workshopResult, durationResult, stayResult] =
        await Promise.all([
          (async () => {
            const data: Tables<"appointments">[] = [];
            for (let start = 0; ; start += 1000) {
              const r = await supabase
                .from("appointments")
                .select("*")
                .is("archived_at", null)
                .order("id")
                .range(start, start + 999);
              if (r.error) return r;
              data.push(...(r.data ?? []));
              if ((r.data ?? []).length < 1000) break;
            }
            return { data, error: null };
          })(),
          supabase.from("status_options").select("*").order("sort_order"),
          supabase.from("workshops").select("name, is_own_yard").order("name"),
          supabase.rpc("yard_status_durations"),
          supabase
            .from("workshop_movements")
            .select("appointment_id,entered_at")
            .is("left_at", null),
        ]);

      for (const r of [apptResult, statusResult, workshopResult, durationResult, stayResult])
        if (r.error) throw r.error;

      const durationMap = new Map<string, string>();
      for (const d of (durationResult.data ?? []) as {
        appointment_id: string;
        last_status_change_at: string;
      }[]) {
        durationMap.set(d.appointment_id, d.last_status_change_at);
      }

      const rows = (apptResult.data ?? []).map((row: Tables<"appointments">) =>
        fromRow(row, durationMap.get(row.id) ?? null),
      );
      setStays(
        Object.fromEntries((stayResult.data ?? []).map((s) => [s.appointment_id, s.entered_at])),
      );
      setAppointments(rows);
      setStatuses((statusResult.data ?? []) as StatusOption[]);
      setWorkshops(
        (workshopResult.data ?? []).map((w) => ({
          name: w.name,
          isOwnYard: w.is_own_yard ?? false,
        })),
      );

      const completion = (statusResult.data ?? []).find((s: StatusOption) => s.is_completion);
      if (completion) setCompletionStatus(completion.label);

      setLoadError("");
      setLoadedAt(Date.now());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const reload = () => void loadData();
    window.addEventListener(AGENDA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(AGENDA_CHANGED_EVENT, reload);
  }, []);

  // Toast for new items
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (newCount > 0 && newCount !== prevCountRef.current) {
      toast.success(`${newCount} novo(s) veículo(s) detectado(s)`, {
        duration: settings.toast_duration_ms,
      });
      prevCountRef.current = newCount;
    }
  }, [newCount, settings.toast_duration_ms]);

  // Split into patio and external
  const { patio, externalByWorkshop } = useMemo(
    () => splitYardAndExternal(appointments, workshops, statuses),
    [appointments, workshops, statuses],
  );

  // Apply filters
  function applyFilters(items: YardAppointment[]): YardAppointment[] {
    return items
      .filter((item) => matchesYardSearch(item, search))
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter((item) => !workshopFilter || item.workshop === workshopFilter)
      .filter(
        (item) => !brandFilter || item.brand.toLowerCase().includes(brandFilter.toLowerCase()),
      )
      .sort((a, b) => sortByTimerDesc(a, b, now));
  }

  const filteredPatio = useMemo(
    () => applyFilters(patio),
    [patio, search, statusFilter, workshopFilter, brandFilter, now],
  );
  const filteredExternal = useMemo(() => {
    const result = new Map<string, YardAppointment[]>();
    for (const [ws, items] of externalByWorkshop) {
      const filtered = applyFilters(items);
      if (filtered.length > 0) result.set(ws, filtered);
    }
    return result;
  }, [externalByWorkshop, search, statusFilter, workshopFilter, brandFilter, now]);

  const yardStatuses = statuses;
  const uniqueBrands = useMemo(
    () => [...new Set(appointments.map((a) => a.brand).filter(Boolean))].sort(),
    [appointments],
  );
  const uniqueWorkshops = useMemo(
    () => [...new Set(appointments.map((a) => a.workshop).filter(Boolean))].sort(),
    [appointments],
  );

  function handleReload() {
    setLoading(true);
    void loadData();
  }

  function openPlateHistory(plate: string) {
    if (onOpenMovements) onOpenMovements(plate);
  }

  if (loading && appointments.length === 0) {
    return (
      <div className={cn("min-h-screen bg-background text-foreground", dark && "dark")}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Wrench className="mx-auto size-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Carregando pátio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("min-h-screen overflow-x-hidden bg-background text-foreground", dark && "dark")}
    >
      <Toaster />

      <MyAccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        userId={currentUser.id}
        email={currentUser.email}
        name={currentUser.name}
        onSaved={() =>
          void queryClient.invalidateQueries({ queryKey: ["profile", currentUser.id] })
        }
      />

      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-5 lg:px-8">
        {tabs}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearNew}
            title={newCount > 0 ? `${newCount} novidade(s) — clique para limpar` : "Sem novidades"}
          >
            <Bell className={cn("size-4", newCount === 0 && "opacity-50")} />
            {newCount > 0 ? `${newCount > 99 ? "99+" : newCount} novidade(s)` : "Sem novidades"}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleSound}>
            {soundEnabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            {soundEnabled ? "Som ligado" : "Som desligado"}
          </Button>
          {currentUser.role === "master" && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="size-4" /> Configurar pátio
            </Button>
          )}
        </div>

        {/* Title + reload */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-accent-foreground">
              Operação em tempo real
            </p>
            <h1 className="text-2xl font-bold lg:text-3xl">Pátio da Oficina</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Veículos em manutenção no pátio e em oficinas externas. Atualização a cada{" "}
              {settings.polling_seconds}s.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-md border bg-card px-3 py-2 text-right">
              <p className="text-xs text-muted-foreground">Última atualização</p>
              <p className="text-sm font-semibold">
                {new Date(loadedAt ?? now).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
            <Button variant="outline" onClick={handleReload} aria-label="Recarregar">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Recarregar
            </Button>
          </div>
        </div>

        {/* Load error */}
        {loadError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={handleReload}>
              Tentar de novo
            </Button>
          </div>
        )}

        {/* Search + filters */}
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar placa, modelo, marca, contato..."
                className="pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="size-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setAdvancedOpen(!advancedOpen)}>
              <SlidersHorizontal className="size-4" /> Mais filtros
              <ChevronDown className={cn("size-3 transition", advancedOpen && "rotate-180")} />
            </Button>
          </div>

          {/* Advanced filters */}
          {advancedOpen && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <select
                value={statusFilter ?? ""}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os status</option>
                {yardStatuses.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label} ({patio.filter((i) => i.status === s.label).length})
                  </option>
                ))}
              </select>
              <select
                value={workshopFilter}
                onChange={(e) => setWorkshopFilter(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as oficinas</option>
                {uniqueWorkshops.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as marcas</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {(statusFilter || workshopFilter || brandFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatusFilter(null);
                    setWorkshopFilter("");
                    setBrandFilter("");
                  }}
                >
                  <X className="size-3" /> Limpar filtros
                </Button>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {(search || statusFilter || workshopFilter || brandFilter) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Filtros:</span>
              {search && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5">
                  Busca: {search}
                  <button onClick={() => setSearch("")}>
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5">
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter(null)}>
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {workshopFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5">
                  Oficina: {workshopFilter}
                  <button onClick={() => setWorkshopFilter("")}>
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {brandFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5">
                  Marca: {brandFilter}
                  <button onClick={() => setBrandFilter("")}>
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {!workshops.some((w) => w.isOwnYard) && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Pátio próprio ainda não definido.</span>
            {currentUser.role === "master" && (
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                Definir pátio próprio
              </Button>
            )}
          </div>
        )}
        {/* KPIs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Local de atendimento">
          <Button
            role="tab"
            aria-selected={locationTab === "patio"}
            variant={locationTab === "patio" ? "default" : "outline"}
            onClick={() => setLocationTab("patio")}
          >
            Pátio próprio · {loadError ? "Indisponível" : filteredPatio.length}
          </Button>
          <Button
            role="tab"
            aria-selected={locationTab === "externos"}
            variant={locationTab === "externos" ? "default" : "outline"}
            onClick={() => setLocationTab("externos")}
          >
            Serviço externo ·{" "}
            {loadError
              ? "Indisponível"
              : [...filteredExternal.values()].reduce((n, a) => n + a.length, 0)}
          </Button>
          {yardGroups.data
            ?.filter((g) => g.active)
            .map((g) => (
              <Button
                key={g.id}
                role="tab"
                aria-selected={locationTab === `g:${g.id}`}
                variant={locationTab === `g:${g.id}` ? "default" : "outline"}
                onClick={() => setLocationTab(`g:${g.id}`)}
              >
                {g.name} ·{" "}
                {loadError
                  ? "Indisponível"
                  : itemsInGroup([...filteredPatio, ...[...filteredExternal.values()].flat()], g)
                      .length}
              </Button>
            ))}
        </div>
        {!loadError && locationTab === "patio" && (
          <YardKpis
            patioItems={filteredPatio}
            yardStatuses={yardStatuses}
            activeStatusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
          />
        )}

        {/* NOSSO PÁTIO */}
        {!loadError && locationTab === "patio" && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="size-5 text-accent-foreground" />
              <h2 className="text-lg font-bold">Nosso Pátio</h2>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold">
                {filteredPatio.length} veículo{filteredPatio.length !== 1 ? "s" : ""}
              </span>
            </div>
            {filteredPatio.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                <CarFront className="mx-auto mb-2 size-8 opacity-30" />
                Nenhum veículo no pátio com os filtros atuais.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredPatio.map((item) => (
                  <YardCard
                    key={item.dbId}
                    item={{ ...item, forwardedAt: stays[item.dbId] ?? item.forwardedAt ?? null }}
                    settings={settings}
                    now={now}
                    completionStatus={completionStatus}
                    onCheckIn={(i) => setCheckInTarget({ item: i, type: "entrada" })}
                    onCheckOut={(i) => setCheckInTarget({ item: i, type: "saida" })}
                    onDetails={setDetailTarget}
                    onForward={
                      currentUser.role !== "oficina" ? (i) => setForwardId(i.dbId) : undefined
                    }
                    onPlateClick={openPlateHistory}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* EXTERNOS */}
        {!loadError && locationTab === "externos" && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-bold">Externos</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                {[...filteredExternal.values()].reduce((sum, arr) => sum + arr.length, 0)} veículo
                {[...filteredExternal.values()].reduce((sum, arr) => sum + arr.length, 0) !== 1
                  ? "s"
                  : ""}
              </span>
            </div>
            {filteredExternal.size === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum carro em serviço externo com os filtros atuais.
              </p>
            )}
            <div className="space-y-4">
              {[...filteredExternal.entries()].map(([wsName, items]) => (
                <div key={wsName} className="rounded-lg border bg-card">
                  <div className="flex items-center gap-2 border-b px-4 py-2.5">
                    <MapPin className="size-4 text-muted-foreground" />
                    <h3 className="font-semibold">{wsName}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {items.length} veículo{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => (
                      <YardCard
                        key={item.dbId}
                        item={{
                          ...item,
                          forwardedAt: stays[item.dbId] ?? item.forwardedAt ?? null,
                        }}
                        settings={settings}
                        now={now}
                        completionStatus={completionStatus}
                        onCheckIn={(i) => setCheckInTarget({ item: i, type: "entrada" })}
                        onCheckOut={(i) => setCheckInTarget({ item: i, type: "saida" })}
                        onDetails={setDetailTarget}
                        onForward={
                          currentUser.role !== "oficina" ? (i) => setForwardId(i.dbId) : undefined
                        }
                        onPlateClick={openPlateHistory}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {!loadError &&
          locationTab.startsWith("g:") &&
          (() => {
            const g = yardGroups.data?.find((x) => `g:${x.id}` === locationTab);
            if (!g) return null;
            const items = itemsInGroup(
              [...filteredPatio, ...[...filteredExternal.values()].flat()],
              g,
            );
            const byPlace = new Map<string, YardAppointment[]>();
            for (const i of items) byPlace.set(i.workshop, [...(byPlace.get(i.workshop) ?? []), i]);
            return (
              <section className="space-y-4">
                <h2 className="text-lg font-bold">
                  {g.name} · {items.length} veículo{items.length !== 1 ? "s" : ""}
                </h2>
                {!items.length && (
                  <p className="text-sm text-muted-foreground">Nenhum carro neste grupo.</p>
                )}
                {[...byPlace.entries()].map(([place, list]) => (
                  <div key={place} className="rounded-lg border bg-card">
                    <h3 className="border-b px-4 py-2.5 font-semibold">
                      {place} · {list.length}
                    </h3>
                    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {list.map((item) => (
                        <YardCard
                          key={item.dbId}
                          item={{
                            ...item,
                            forwardedAt: stays[item.dbId] ?? item.forwardedAt ?? null,
                          }}
                          settings={settings}
                          now={now}
                          completionStatus={completionStatus}
                          onCheckIn={(i) => setCheckInTarget({ item: i, type: "entrada" })}
                          onCheckOut={(i) => setCheckInTarget({ item: i, type: "saida" })}
                          onDetails={setDetailTarget}
                          onForward={
                            currentUser.role !== "oficina" ? (i) => setForwardId(i.dbId) : undefined
                          }
                          onPlateClick={openPlateHistory}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })()}
      </main>

      {forwardId && (
        <ForwardWorkshop
          initiallyOpen
          appointmentId={forwardId}
          onClose={() => setForwardId("")}
          onDone={() => {
            void loadData();
          }}
        />
      )}
      {/* Check-in Sheet */}
      <CheckInSheet
        open={!!checkInTarget}
        onOpenChange={(open) => {
          if (!open) setCheckInTarget(null);
        }}
        appointment={checkInTarget?.item ?? null}
        type={checkInTarget?.type ?? "entrada"}
        settings={settings}
        statuses={statuses}
        currentUserId={currentUser.id}
        onDone={() => void loadData()}
      />

      {/* Detail Modal */}
      <YardDetailModal
        open={!!detailTarget}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
        appointment={detailTarget}
        settings={settings}
        statuses={statuses}
        currentUserId={currentUser.id}
        currentUserRole={currentUser.role}
        onCheckIn={(item) => {
          setDetailTarget(null);
          setCheckInTarget({ item, type: "entrada" });
        }}
        onCheckOut={(item) => {
          setDetailTarget(null);
          setCheckInTarget({ item, type: "saida" });
        }}
        onSaved={() => void loadData()}
        onPlateClick={openPlateHistory}
      />

      {/* Master Settings Panel — lazy loaded */}
      {settingsOpen && currentUser.role === "master" && (
        <YardSettingsPanelLazy
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          statuses={statuses}
          workshops={workshops}
          onUpdate={updateSettings}
          onStatusesUpdated={() => void loadData()}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}

// Lazy wrapper to avoid importing settings panel when not needed
const YardSettingsPanel = lazy(() =>
  import("@/components/yard-settings-panel").then((m) => ({ default: m.YardSettingsPanel })),
);

function YardSettingsPanelLazy(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: YardSettings;
  statuses: StatusOption[];
  workshops: WorkshopInfo[];
  onUpdate: (patch: Partial<YardSettings>, userId: string) => Promise<boolean>;
  onStatusesUpdated: () => void;
  currentUserId: string;
}) {
  return (
    <Suspense fallback={null}>
      <YardSettingsPanel {...props} />
    </Suspense>
  );
}
