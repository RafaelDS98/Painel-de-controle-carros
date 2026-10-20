import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/searchable-select";
import { useYardSettings } from "@/hooks/use-yard-settings";
import { normalizePlate } from "@/lib/normalize";
import { checkInTypeLabel, checkInOrigin, formatCheckInDate } from "@/lib/check-in-log";
import { LogIn, LogOut } from "lucide-react";

/** Entrada/saída pelo veículo: ligada ao agendamento em aberto ou avulsa pela placa. */
export function VehicleCheckIn({ plate }: { plate: string }) {
  const p = normalizePlate(plate);
  const qc = useQueryClient();
  const { settings } = useYardSettings();
  const [type, setType] = useState<"entrada" | "saida" | null>(null);
  const [note, setNote] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const open = useQuery({
    queryKey: ["vehicle-open-appt", p],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,workshop,os_number,date")
        .ilike("plate", `%${p.slice(0, 3)}%${p.slice(3)}%`)
        .is("archived_at", null)
        .is("check_out_at", null)
        .order("date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const workshops = useQuery({
    queryKey: ["checkin-workshops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("id,name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["vehicle-checkins", p],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_in_records")
        .select(
          "id,type,occurred_at,note,photo_url,appointment_id,os_number,workshops(name),profiles(full_name)",
        )
        .eq("plate", p)
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const allowFile = settings.photo_capture_enabled || settings.photo_upload_enabled;
  const required = type === "entrada" ? settings.check_in_required : settings.check_out_required;

  async function save() {
    if (!type) return;
    const appt = open.data;
    const ws = workshops.data?.find((w) => w.name === (workshop || appt?.workshop));
    if (!appt && !ws) {
      toast.error("Escolha o local da entrada/saída.");
      return;
    }
    if (required && !note.trim() && !file) {
      toast.error("Informe uma observação ou foto.");
      return;
    }
    if (file && file.size > settings.photo_max_mb * 1024 * 1024) {
      toast.error(`Arquivo acima de ${settings.photo_max_mb} MB.`);
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada.");
      let photo: string | null = null;
      if (file) {
        const path = `${uid}/${p}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("check-in-photos").upload(path, file);
        if (error) throw error;
        photo = path;
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from("check_in_records").insert({
        appointment_id: appt?.id ?? null,
        os_number: appt?.os_number ?? null,
        plate: p,
        workshop_id: ws?.id ?? null,
        type,
        occurred_at: now,
        note: note.trim() || null,
        photo_url: photo,
        performed_by: uid,
      });
      if (error) throw error;
      if (appt) {
        const cols =
          type === "entrada"
            ? { check_in_at: now, check_in_by: uid, check_in_note: note.trim() || null }
            : { check_out_at: now, check_out_by: uid, check_out_note: note.trim() || null };
        const { error: e2 } = await supabase.from("appointments").update(cols).eq("id", appt.id);
        if (e2) toast.warning("Registro salvo, mas o agendamento não pôde ser atualizado.");
      }
      toast.success(`${checkInTypeLabel(type)} registrada.`);
      setType(null);
      setNote("");
      setFile(null);
      await qc.invalidateQueries({ queryKey: ["vehicle-checkins", p] });
      await qc.invalidateQueries({ queryKey: ["vehicle-open-appt", p] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  }

  async function openPhoto(path: string) {
    const { data, error } = await supabase.storage
      .from("check-in-photos")
      .createSignedUrl(path, 300);
    if (error || !data) toast.error("Foto indisponível.");
    else window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Check-in / Check-out</h2>
      <p className="text-sm text-muted-foreground">
        {open.isLoading
          ? "Verificando agendamento…"
          : open.data
            ? `Agendamento em aberto em ${open.data.workshop || "—"}${open.data.os_number ? ` · O.S. ${open.data.os_number}` : ""} — o registro fica ligado a ele.`
            : "Sem agendamento em aberto — o registro será avulso pela placa."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setType("entrada")}>
          <LogIn /> Registrar entrada
        </Button>
        <Button variant="outline" onClick={() => setType("saida")}>
          <LogOut /> Registrar saída
        </Button>
      </div>
      {type && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">{checkInTypeLabel(type)}</p>
          {!open.data && (
            <SearchableSelect
              label="Local"
              value={workshop}
              options={workshops.data?.map((w) => w.name) ?? []}
              onChange={setWorkshop}
            />
          )}
          <Textarea
            placeholder={required ? "Observação (obrigatória sem foto)" : "Observação"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {allowFile && (
            <Input
              type="file"
              accept="image/*,application/pdf"
              {...(settings.photo_capture_enabled ? { capture: "environment" as const } : {})}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setType(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      )}
      {history.isError ? (
        <p className="text-sm">Histórico indisponível.</p>
      ) : history.data?.length ? (
        <ul className="space-y-1 text-sm">
          {history.data.map((r) => (
            <li key={r.id}>
              {formatCheckInDate(r.occurred_at)} · {checkInTypeLabel(r.type)} ·{" "}
              {r.workshops?.name ?? "—"} · {checkInOrigin(r)} ·{" "}
              {r.profiles?.full_name ?? "Usuário excluído"}
              {r.note ? ` · ${r.note}` : ""}
              {r.photo_url && (
                <Button
                  variant="link"
                  className="h-auto p-0 pl-1"
                  onClick={() => void openPhoto(r.photo_url!)}
                >
                  ver foto
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum check-in registrado.</p>
      )}
    </section>
  );
}
