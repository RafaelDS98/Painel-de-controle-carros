import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/searchable-select";
import { useOsConfig } from "@/components/ordens-servico";
import { announceAgendaChange } from "@/lib/agenda-freshness";
import { Wrench } from "lucide-react";
export function ForwardWorkshop({
  appointmentId,
  onDone,
  initiallyOpen = false,
  onClose,
}: {
  appointmentId: string;
  onDone?: () => void;
  initiallyOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; numero: number } | null>(null);
  const [f, setF] = useState({ workshop: "", store: "", tipo: "", centro: "", km: "" });
  const config = useOsConfig();
  const qc = useQueryClient();
  const appt = useQuery({
    queryKey: ["forward-appt", appointmentId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("plate,km_scheduled,store_id,workshop,os_number")
        .eq("id", appointmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const choose = (
    key: "workshop" | "store" | "tipo" | "centro",
    options: Array<{ id: string | number; label: string }> | undefined,
  ) => (
    <SearchableSelect
      label={
        { workshop: "Oficina", store: "Loja", tipo: "Tipo de O.S.", centro: "Centro de custo" }[key]
      }
      value={options?.find((x) => String(x.id) === f[key])?.label ?? ""}
      options={options?.map((x) => x.label) ?? []}
      onChange={(label) =>
        setF({ ...f, [key]: String(options?.find((x) => x.label === label)?.id ?? "") })
      }
    />
  );
  async function save() {
    if (
      !f.workshop ||
      !f.tipo ||
      !f.centro ||
      !(f.store || appt.data?.store_id) ||
      !(f.km || appt.data?.km_scheduled === 0 || appt.data?.km_scheduled)
    ) {
      toast.error("Preencha oficina, KM, loja, tipo e centro de custo.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("os_forward_appointment", {
        _appointment_id: appointmentId,
        _workshop_id: f.workshop,
        _km: Number(f.km || appt.data?.km_scheduled),
        _store_id: Number(f.store || appt.data?.store_id),
        _tipo_id: Number(f.tipo),
        _centro_custo_id: f.centro,
      });
      if (error) throw error;
      const r = data as { id: string; numero: number };
      setResult(r);
      announceAgendaChange({ source: "import", updated: 1 });
      await qc.invalidateQueries();
      toast.success(`Encaminhado · O.S. ${r.numero}`);
      onDone?.();
    } catch (e) {
      toast.error(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Não foi possível encaminhar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!initiallyOpen && <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          setResult(null);
        }}
      >
        <Wrench /> Encaminhar para oficina
      </Button>}
      <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)onClose?.();}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaminhar {appt.data?.plate ?? "veículo"}</DialogTitle>
            <DialogDescription>
              {appt.data?.os_number
                ? `O.S. atual: ${appt.data.os_number}. Uma O.S. ativa vinculada será reutilizada.`
                : "O encaminhamento cria uma O.S. vinculada ao agendamento e ao veículo."}
            </DialogDescription>
          </DialogHeader>
          {result ? (
            <div className="space-y-3">
              <p>Encaminhamento confirmado · O.S. {result.numero}</p>
              <Button asChild>
                <Link to="/ordens-servico/$id" params={{ id: result.id }}>
                  Abrir O.S.
                </Link>
              </Button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {(appt.isError || config.isError) && (
                <p role="alert" className="text-destructive">
                  Não foi possível carregar os dados.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {choose("workshop", config.data?.workshops)}
                {choose("store", config.data?.stores)}
                {choose("tipo", config.data?.tipos)}
                {choose("centro", config.data?.centros)}
                <label className="text-sm">
                  KM
                  <Input
                    type="number"
                    min="0"
                    value={f.km || String(appt.data?.km_scheduled ?? "")}
                    onChange={(e) => setF({ ...f, km: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {setOpen(false);onClose?.();}}>
                  Cancelar
                </Button>
                <Button
                  disabled={
                    busy || appt.isLoading || config.isLoading || appt.isError || config.isError
                  }
                >
                  {busy ? "Encaminhando…" : "Confirmar encaminhamento"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
