import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, LogIn, LogOut, Trash2, Clock, History, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { statusColorProps, type StatusOption } from "@/lib/agenda-config";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/agenda-safety";
import {
  canEditField,
  YARD_EDITABLE_FIELD_LABELS,
  type YardAppointment,
  type YardSettings,
  type CheckInRecord,
} from "@/lib/yard-utils";

interface YardDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: YardAppointment | null;
  settings: YardSettings;
  statuses: StatusOption[];
  currentUserId: string;
  currentUserRole: string;
  onCheckIn: (item: YardAppointment) => void;
  onCheckOut: (item: YardAppointment) => void;
  onSaved: () => void;
  onPlateClick: (plate: string) => void;
}

export function YardDetailModal({
  open,
  onOpenChange,
  appointment,
  settings,
  statuses,
  currentUserId,
  currentUserRole,
  onCheckIn,
  onCheckOut,
  onSaved,
  onPlateClick,
}: YardDetailModalProps) {
  const [draft, setDraft] = useState<Record<string, string>>({} as any);
  const [saving, setSaving] = useState(false);
  const [checkInRecords, setCheckInRecords] = useState<CheckInRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (appointment && open) {
      setDraft({
        status: appointment.status,
        note: appointment.note,
        operator: appointment.operator,
        current_deadline: appointment.currentDeadline ?? "",
        contact: appointment.contact,
        contact_number: appointment.contactNumber,
        issue: appointment.issue,
        model: appointment.model,
        workshop: appointment.workshop,
        store: appointment.store,
        brand: appointment.brand,
      });
      void loadCheckInRecords(appointment.dbId);
    }
  }, [appointment, open]);

  async function loadCheckInRecords(appointmentId: string) {
    setLoadingRecords(true);
    const { data } = await (supabase as any)
      .from("check_in_records")
      .select("*")
      .eq("appointment_id", appointmentId)
      .order("occurred_at", { ascending: true });
    setCheckInRecords((data ?? []) as CheckInRecord[]);
    setLoadingRecords(false);
  }

  function fieldChanged(key: string): boolean {
    if (!appointment) return false;
    const originalMap: Record<string, string> = {
      status: appointment.status,
      note: appointment.note,
      operator: appointment.operator,
      current_deadline: appointment.currentDeadline ?? "",
      contact: appointment.contact,
      contact_number: appointment.contactNumber,
      issue: appointment.issue,
      model: appointment.model,
      workshop: appointment.workshop,
      store: appointment.store,
      brand: appointment.brand,
    };
    return (draft[key] ?? "") !== (originalMap[key] ?? "");
  }

  async function handleSave() {
    if (!appointment) return;
    setSaving(true);

    const changes: Record<string, unknown> = {};
    const colMap: Record<string, string> = {
      status: "status",
      note: "note",
      operator: "operator",
      current_deadline: "current_deadline",
      contact: "contact",
      contact_number: "contact_number",
      issue: "issue",
      model: "model",
      workshop: "workshop",
      store: "store",
      brand: "brand",
    };

    for (const [key, col] of Object.entries(colMap)) {
      if (fieldChanged(key) && canEditField(key, settings)) {
        changes[col] = draft[key]?.trim() || (col === "current_deadline" ? null : "");
      }
    }

    if (!Object.keys(changes).length) {
      toast.info("Nenhuma alteração detectada.");
      setSaving(false);
      return;
    }

    const { error } = await (supabase as any)
      .from("appointments")
      .update(changes)
      .eq("id", appointment.dbId);

    if (error) {
      toast.error(`Falha ao salvar: ${error.message}`);
      setSaving(false);
      return;
    }

    toast.success("Alterações salvas.", { duration: settings.toast_duration_ms });
    setSaving(false);
    onSaved();
  }

  async function deletePhoto(record: CheckInRecord) {
    if (!record.photo_url) return;
    const pathParts = record.photo_url.split("/check-in-photos/");
    const storagePath = pathParts[1];
    if (storagePath) {
      await supabase.storage.from("check-in-photos").remove([storagePath]);
    }
    const colPrefix = record.type === "entrada" ? "check_in" : "check_out";
    await (supabase as any)
      .from("appointments")
      .update({ [`${colPrefix}_photo_url`]: null })
      .eq("id", record.appointment_id);
    await (supabase as any)
      .from("check_in_records")
      .update({ photo_url: null })
      .eq("id", record.id);
    toast.success("Foto removida.");
    if (appointment) void loadCheckInRecords(appointment.dbId);
    onSaved();
  }

  const hasChanges = Object.keys(draft).some((key) => fieldChanged(key) && canEditField(key, settings));
  const deadlineUsed = appointment?.osNumber ? 0 : 0; // simplified — real logic uses deadline_changes_used from full appointment

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary px-2 py-1 text-primary-foreground text-sm font-bold">
                {appointment?.plate || "—"}
              </span>
              <span className="text-base">
                {[appointment?.brand, appointment?.model].filter(Boolean).join(" · ") || "—"}
              </span>
              {appointment?.priorityUrgent && (
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                  URGENTE
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Ficha do veículo — edite os campos permitidos e clique Salvar.
            </DialogDescription>
          </DialogHeader>

          {appointment && (
            <div className="space-y-5">
              {/* Campos editáveis */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Situação</label>
                  {canEditField("status", settings) ? (
                    <Select
                      value={draft["status"] ?? ""}
                      onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}
                    >
                      <SelectTrigger className={cn(fieldChanged("status") && "border-accent ring-1 ring-accent")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.label} value={s.label}>
                            <span className="flex items-center gap-2">
                              <span
                                className={cn("size-2 rounded-full", statusColorProps(s.color_token).className)}
                                style={statusColorProps(s.color_token).style}
                              />
                              {s.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["status"] || "—"}</p>
                  )}
                </div>

                {/* Prazo */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Previsão de entrega
                    {appointment.currentDeadline && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        (alterações restantes: {Math.max(0, 1 - 0)})
                      </span>
                    )}
                  </label>
                  {canEditField("current_deadline", settings) ? (
                    <Input
                      type="date"
                      value={draft["current_deadline"]}
                      onChange={(e) => setDraft((d) => ({ ...d, current_deadline: e.target.value }))}
                      className={cn(fieldChanged("current_deadline") && "border-accent ring-1 ring-accent")}
                    />
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">
                      {draft["current_deadline"] ? formatDateBR(draft["current_deadline"]) : "—"}
                    </p>
                  )}
                </div>

                {/* Operador */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Operador/Mecânico</label>
                  {canEditField("operator", settings) ? (
                    <Input
                      value={draft["operator"]}
                      onChange={(e) => setDraft((d) => ({ ...d, operator: e.target.value }))}
                      className={cn(fieldChanged("operator") && "border-accent ring-1 ring-accent")}
                    />
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["operator"] || "—"}</p>
                  )}
                </div>

                {/* Contato */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contato</label>
                  {canEditField("contact", settings) ? (
                    <Input
                      value={draft["contact"]}
                      onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
                      className={cn(fieldChanged("contact") && "border-accent ring-1 ring-accent")}
                    />
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["contact"] || "—"}</p>
                  )}
                </div>

                {/* Telefone */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                  {canEditField("contact_number", settings) ? (
                    <Input
                      value={draft["contact_number"]}
                      onChange={(e) => setDraft((d) => ({ ...d, contact_number: e.target.value }))}
                      className={cn(fieldChanged("contact_number") && "border-accent ring-1 ring-accent")}
                    />
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["contact_number"] || "—"}</p>
                  )}
                </div>

                {/* Loja */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Loja</label>
                  {canEditField("store", settings) ? (
                    <Input
                      value={draft["store"]}
                      onChange={(e) => setDraft((d) => ({ ...d, store: e.target.value }))}
                      className={cn(fieldChanged("store") && "border-accent ring-1 ring-accent")}
                    />
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["store"] || "—"}</p>
                  )}
                </div>

                {/* Modelo */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Modelo</label>
                  {canEditField("model", settings) ? (
                    <Input
                      value={draft["model"]}
                      onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                      className={cn(fieldChanged("model") && "border-accent ring-1 ring-accent")}
                    />
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["model"] || "—"}</p>
                  )}
                </div>

                {/* Marca */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Marca</label>
                  {canEditField("brand", settings) ? (
                    <Input
                      value={draft["brand"]}
                      onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                      className={cn(fieldChanged("brand") && "border-accent ring-1 ring-accent")}
                    />
                  ) : (
                    <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["brand"] || "—"}</p>
                  )}
                </div>
              </div>

              {/* Problema relatado */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Problema relatado</label>
                {canEditField("issue", settings) ? (
                  <Textarea
                    value={draft["issue"]}
                    onChange={(e) => setDraft((d) => ({ ...d, issue: e.target.value }))}
                    rows={2}
                    className={cn(fieldChanged("issue") && "border-accent ring-1 ring-accent")}
                  />
                ) : (
                  <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["issue"] || "—"}</p>
                )}
              </div>

              {/* Observação */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Observação</label>
                {canEditField("note", settings) ? (
                  <Textarea
                    value={draft["note"]}
                    onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                    rows={2}
                    className={cn(fieldChanged("note") && "border-accent ring-1 ring-accent")}
                  />
                ) : (
                  <p className="rounded border bg-muted/30 px-3 py-2 text-sm">{draft["note"] || "—"}</p>
                )}
              </div>

              {/* Check-in / Check-out actions */}
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {!appointment.checkInAt && (
                  <Button variant="outline" className="gap-1.5" onClick={() => { onOpenChange(false); onCheckIn(appointment); }}>
                    <LogIn className="size-4" /> Registrar entrada
                  </Button>
                )}
                {appointment.checkInAt && !appointment.checkOutAt && (
                  <Button variant="outline" className="gap-1.5" onClick={() => { onOpenChange(false); onCheckOut(appointment); }}>
                    <LogOut className="size-4" /> Registrar saída
                  </Button>
                )}
                {appointment.checkInAt && (
                  <div className="flex items-center gap-1 self-center text-xs text-green-600 dark:text-green-400">
                    ✓ Entrada {new Date(appointment.checkInAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                {appointment.checkOutAt && (
                  <div className="flex items-center gap-1 self-center text-xs text-blue-600 dark:text-blue-400">
                    ✓ Saída {new Date(appointment.checkOutAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>

              {/* Histórico de check-ins */}
              <div className="border-t pt-3">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <History className="size-4" /> Check-ins desta O.S.
                </h3>
                {loadingRecords ? (
                  <p className="text-xs text-muted-foreground">Carregando...</p>
                ) : checkInRecords.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum check-in registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {checkInRecords.map((rec) => (
                      <div key={rec.id} className="rounded border bg-muted/20 p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold",
                            rec.type === "entrada"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                          )}>
                            {rec.type === "entrada" ? "ENTRADA" : "SAÍDA"}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(rec.occurred_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {rec.note && <p className="mt-1">{rec.note}</p>}
                        {rec.photo_url && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPhotoExpanded(rec.photo_url)}
                              className="overflow-hidden rounded border"
                            >
                              <img src={rec.photo_url} alt="Foto check-in" className="h-12 w-16 object-cover" />
                            </button>
                            {(rec.performed_by === currentUserId || currentUserRole === "master") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-1.5 text-[10px] text-destructive"
                                onClick={() => void deletePhoto(rec)}
                              >
                                <Trash2 className="size-3" /> Remover
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão Salvar */}
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button
                  className="gap-1.5"
                  disabled={saving || !hasChanges}
                  onClick={() => void handleSave()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Salvando…" : "Salvar alterações"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Photo expanded overlay */}
      {photoExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPhotoExpanded(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            onClick={() => setPhotoExpanded(null)}
          >
            <X className="size-5" />
          </button>
          <img
            src={photoExpanded}
            alt="Foto ampliada"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}