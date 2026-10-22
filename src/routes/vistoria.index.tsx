import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardPlus, Download, FileClock, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlateCombobox } from "@/components/plate-combobox";

export const Route = createFileRoute("/vistoria/")({
  head: () => ({
    meta: [
      { title: "Início | ANPEXC Vistorias" },
      { name: "description", content: "Comece uma nova vistoria pela placa do veículo." },
      { property: "og:title", content: "Início | ANPEXC Vistorias" },
      { property: "og:description", content: "Comece uma nova vistoria pela placa do veículo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VistoriaHome,
});

const SHORTCUTS = ["Entrada manutenção", "Saída manutenção", "Entrega reserva", "Devolução reserva"];

type InstallPrompt = Event & { prompt: () => Promise<void> };

function VistoriaHome() {
  const [plate, setPlate] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  function start(operation?: string) {
    toast.info(
      `A tela de checklist chega na próxima etapa${plate ? ` — placa ${plate}` : ""}${operation ? `, ${operation}` : ""}.`,
    );
  }
  async function addToHome() {
    if (install) {
      await install.prompt();
      setInstall(null);
      return;
    }
    toast.info(
      "No celular, abra o menu do navegador e toque em “Adicionar à tela inicial”.",
      { duration: 6000 },
    );
  }
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova vistoria</h1>
        <p className="text-sm text-muted-foreground">Escolha a placa e o tipo de operação.</p>
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <label className="text-sm font-medium">Placa do veículo</label>
        <PlateCombobox value={plate} onChange={setPlate} />
        <Button className="h-14 w-full text-base" onClick={() => start()}>
          <ClipboardPlus className="h-5 w-5" />
          Nova vistoria
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {SHORTCUTS.map((s) => (
            <Button key={s} variant="outline" className="h-12 whitespace-normal" onClick={() => start(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-medium">
          <FileClock className="h-4 w-4" /> Continuar rascunho
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Nenhum rascunho neste aparelho.</p>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-medium">
          <ListChecks className="h-4 w-4" /> Minhas vistorias de hoje
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma vistoria hoje.</p>
      </section>
      <Button variant="ghost" className="h-12 w-full" onClick={addToHome}>
        <Download className="h-4 w-4" />
        Adicionar à tela inicial do celular
      </Button>
    </div>
  );
}
