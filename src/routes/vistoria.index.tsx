import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardPlus, Download, FileClock, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlateCombobox } from "@/components/plate-combobox";
import { DRAFT_KEY, useOperationTypes } from "@/lib/vistoria-data";

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

type InstallPrompt = Event & { prompt: () => Promise<void> };

function VistoriaHome() {
  const navigate = useNavigate();
  const ops = useOperationTypes();
  const [plate, setPlate] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  const [draft, setDraft] = useState<{ plate: string | null; savedAt?: number } | null>(null);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsPhone(window.matchMedia("(pointer: coarse)").matches && !standalone);
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft(JSON.parse(raw));
    } catch {
      /* ignora */
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  const today = useQuery({
    queryKey: ["inspections", "today"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { data } = await supabase
        .from("inspections")
        .select("id,number,plate,operation_name,damage_count,created_at")
        .eq("inspector_id", u.user?.id ?? "")
        .gte("created_at", `${day}T00:00:00-03:00`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  function start(op?: string) {
    if (draft && !confirm("Existe um rascunho neste aparelho. Começar uma nova vistoria descarta o rascunho. Continuar?")) return;
    localStorage.removeItem(DRAFT_KEY);
    void navigate({ to: "/vistoria/nova", search: { placa: plate ?? undefined, op } });
  }
  async function addToHome() {
    if (install) {
      await install.prompt();
      setInstall(null);
      return;
    }
    toast.info("Abra o menu do navegador e toque em “Adicionar à tela inicial”.", { duration: 6000 });
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
          {ops.data?.slice(0, 4).map((o) => (
            <Button key={o.id} variant="outline" className="h-12 whitespace-normal" onClick={() => start(o.name)}>
              {o.name}
            </Button>
          ))}
        </div>
      </div>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-medium">
          <FileClock className="h-4 w-4" /> Continuar rascunho
        </h2>
        {draft ? (
          <Button asChild variant="secondary" className="mt-2 h-12 w-full justify-start">
            <Link to="/vistoria/nova" search={{ rascunho: 1 }}>
              {draft.plate ?? "Sem placa"} · salvo{" "}
              {draft.savedAt ? new Date(draft.savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}
              {typeof navigator !== "undefined" && !navigator.onLine && " · pendente de envio"}
            </Link>
          </Button>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum rascunho neste aparelho.</p>
        )}
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-medium">
          <ListChecks className="h-4 w-4" /> Minhas vistorias de hoje
        </h2>
        {today.data?.length ? (
          <ul className="mt-2 divide-y text-sm">
            {today.data.map((i) => (
              <li key={i.id}>
                <Link to="/vistoria/$id" params={{ id: i.id }} className="flex items-center gap-2 py-2">
                  <span className="rounded border bg-white px-1.5 font-mono font-bold text-black">{i.plate}</span>
                  <span className="flex-1 truncate">{i.operation_name}</span>
                  <span className={i.damage_count ? "text-destructive" : "text-success"}>{i.damage_count} av.</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma vistoria hoje.</p>
        )}
      </section>
      {isPhone && (
        <Button variant="ghost" className="h-12 w-full" onClick={addToHome}>
          <Download className="h-4 w-4" />
          Adicionar à tela inicial do celular
        </Button>
      )}
    </div>
  );
}
