import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { YardGroupsSettings } from "@/components/yard-groups-settings";
import { supabase } from "@/integrations/supabase/client";
import type { YardSettings, WorkshopInfo } from "@/lib/yard-utils";
import { YARD_EDITABLE_FIELD_LABELS } from "@/lib/yard-utils";
import type { StatusOption } from "@/lib/agenda-config";

interface YardSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: YardSettings;
  statuses: StatusOption[];
  workshops: WorkshopInfo[];
  onUpdate: (patch: Partial<YardSettings>, userId: string) => Promise<boolean>;
  onStatusesUpdated: () => void;
  currentUserId: string;
}

export function YardSettingsPanel({
  open,
  onOpenChange,
  settings,
  statuses,
  workshops,
  onUpdate,
  onStatusesUpdated,
  currentUserId,
}: YardSettingsPanelProps) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<YardSettings>(settings);
  const [statusDrafts, setStatusDrafts] = useState<
    Record<string, { show_in_yard: boolean; show_external: boolean }>
  >(() =>
    Object.fromEntries(
      statuses.map((s) => [
        s.label,
        { show_in_yard: !!s.show_in_yard, show_external: !!s.show_external },
      ]),
    ),
  );
  const [ownYardWorkshop, setOwnYardWorkshop] = useState(
    () => workshops.find((w) => w.isOwnYard)?.name ?? "",
  );

  // Sync draft when settings prop changes
  useState(() => {
    setDraft(settings);
  });

  async function handleSaveSettings() {
    setSaving(true);
    const ok = await onUpdate(draft, currentUserId);
    if (ok) {
      toast.success("Configurações do pátio salvas.");
    } else {
      toast.error("Falha ao salvar configurações.");
    }
    setSaving(false);
  }

  async function handleSaveStatuses() {
    setSaving(true);
    let allOk = true;
    for (const status of statuses) {
      const d = statusDrafts[status.label];
      if (!d) continue;
      if (d.show_in_yard !== !!status.show_in_yard || d.show_external !== !!status.show_external) {
        const { error } = await supabase
          .from("status_options")
          .update({ show_in_yard: d.show_in_yard, show_external: d.show_external })
          .eq("id", status.id);
        if (error) allOk = false;
      }
    }
    if (allOk) {
      toast.success("Statuses por tela salvos.");
      onStatusesUpdated();
    } else {
      toast.error("Falha ao salvar alguns statuses.");
    }
    setSaving(false);
  }

  async function handleSaveOwnYard() {
    setSaving(true);
    const chosen = workshops.find((w) => w.name === ownYardWorkshop);
    const { data, error: lookupError } = chosen
      ? await supabase.from("workshops").select("id").eq("name", chosen.name).single()
      : { data: null, error: null };
    if (lookupError) {
      toast.error("Não foi possível localizar o pátio.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.rpc("set_own_yard", {
      _workshop_id: data?.id ?? (null as unknown as string),
    });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    toast.success("Pátio próprio atualizado.");
    onStatusesUpdated();
    setSaving(false);
  }

  function toggleField(field: string) {
    setDraft((prev) => ({
      ...prev,
      editable_fields: prev.editable_fields.includes(field)
        ? prev.editable_fields.filter((f) => f !== field)
        : [...prev.editable_fields, field],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do Pátio</DialogTitle>
          <DialogDescription>
            Configure timer, check-in, notificações, campos editáveis e statuses por tela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Timer semafórico */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Timer Semafórico</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Verde até (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={draft.timer_green_hours}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, timer_green_hours: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amarelo até (horas)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={draft.timer_yellow_hours}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, timer_yellow_hours: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Vermelho = acima do limite amarelo.</p>
          </section>

          {/* Check-in */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Check-in / Check-out</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.check_in_required}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, check_in_required: !!v }))}
                />
                Entrada obrigatória
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.check_out_required}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, check_out_required: !!v }))}
                />
                Saída obrigatória
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.photo_capture_enabled}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, photo_capture_enabled: !!v }))}
                />
                Permitir tirar foto
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.photo_upload_enabled}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, photo_upload_enabled: !!v }))}
                />
                Permitir inserir arquivo
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tamanho máximo da foto (MB)</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={draft.photo_max_mb}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, photo_max_mb: Number(e.target.value) || 10 }))
                }
                className="w-24"
              />
            </div>
          </section>

          {/* Notificações */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Notificações</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.notification_sound_enabled}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, notification_sound_enabled: !!v }))
                  }
                />
                Som de alerta
              </label>
              <div className="space-y-1">
                <Label className="text-xs">Intervalo de atualização (segundos)</Label>
                <Input
                  type="number"
                  min={15}
                  max={300}
                  value={draft.polling_seconds}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, polling_seconds: Number(e.target.value) || 30 }))
                  }
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" title="Tempo que o aviso pequeno no canto da tela fica visível (4000 = 4 segundos)">Duração do aviso na tela (ms)</Label>
                <Input
                  type="number"
                  min={1000}
                  max={15000}
                  step={500}
                  value={draft.toast_duration_ms}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, toast_duration_ms: Number(e.target.value) || 4000 }))
                  }
                  className="w-28"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destaque novidade (minutos)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={draft.new_highlight_minutes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, new_highlight_minutes: Number(e.target.value) || 5 }))
                  }
                  className="w-24"
                />
              </div>
            </div>
          </section>

          {/* Campos editáveis pela oficina */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Campos editáveis pela Oficina</h3>
            <p className="text-[11px] text-muted-foreground">
              Marque quais campos o perfil Oficina pode alterar no modal de detalhes.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(YARD_EDITABLE_FIELD_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.editable_fields.includes(key)}
                    onCheckedChange={() => toggleField(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <YardGroupsSettings />

          {/* Pátio próprio */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Pátio Próprio</h3>
            <p className="text-[11px] text-muted-foreground">
              Selecione qual oficina é o pátio próprio da ANPEXC.
            </p>
            <Select value={ownYardWorkshop} onValueChange={setOwnYardWorkshop}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Selecionar oficina..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum (todos são externos)</SelectItem>
                {workshops.map((w) => (
                  <SelectItem key={w.name} value={w.name}>
                    {w.name} {w.isOwnYard && "(atual)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => void handleSaveOwnYard()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar pátio próprio
            </Button>
          </section>

          {/* Statuses por tela */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Statuses por Tela</h3>
            <p className="text-[11px] text-muted-foreground">
              Configure quais statuses aparecem no Pátio e em Externos.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-center">Mostrar no Pátio</th>
                    <th className="px-3 py-2 text-center">Mostrar Externo</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="px-3 py-2 font-medium">{s.label}</td>
                      <td className="px-3 py-2 text-center">
                        <Checkbox
                          checked={!!statusDrafts[s.label]?.show_in_yard}
                          onCheckedChange={(v) =>
                            setStatusDrafts((prev) => ({
                              ...prev,
                              [s.label]: {
                                ...prev[s.label],
                                show_in_yard: !!v,
                                show_external: prev[s.label]?.show_external ?? false,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Checkbox
                          checked={!!statusDrafts[s.label]?.show_external}
                          onCheckedChange={(v) =>
                            setStatusDrafts((prev) => ({
                              ...prev,
                              [s.label]: {
                                ...prev[s.label],
                                show_external: !!v,
                                show_in_yard: prev[s.label]?.show_in_yard ?? false,
                              },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => void handleSaveStatuses()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar statuses por tela
            </Button>
          </section>

          {/* Botão salvar configurações gerais */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button className="gap-1.5" disabled={saving} onClick={() => void handleSaveSettings()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Salvando…" : "Salvar configurações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
