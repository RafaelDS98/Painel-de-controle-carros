import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MaintenanceDashboard } from "@/components/maintenance-dashboard";
import { WorkshopYard } from "@/components/workshop-yard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FirstPasswordScreen } from "@/components/first-password";
import { useEffect, useRef, useState } from "react";
import { MovementsPanel } from "@/components/movements-panel";
import { OsConsultaPanel } from "@/components/os-consulta";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Agenda de Manutenção | ANPEXC" },
      {
        name: "description",
        content: "Painel semanal de agendamentos de manutenção da frota ANPEXC.",
      },
      { property: "og:title", content: "Agenda de Manutenção | ANPEXC" },
      {
        property: "og:description",
        content: "Painel semanal de agendamentos de manutenção da frota ANPEXC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { tab?: AgendaTab; acao?: string } => ({
    tab: TABS.includes(s.tab as AgendaTab) ? (s.tab as AgendaTab) : undefined,
    acao: typeof s.acao === "string" ? s.acao : undefined,
  }),
  component: Index,
});

const TABS = ["agenda", "oficina", "consultas", "consultas-os"] as const;
type AgendaTab = (typeof TABS)[number];

function Index() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [tab, setTab] = useState<"agenda" | "oficina" | null>(null);
  const [movements, setMovements] = useState(false);
  const [sub, setSub] = useState<"veiculos" | "os">("veiculos");
  const [movReq, setMovReq] = useState<{ plate: string; nonce: number } | null>(null);
  const scrolls = useRef<Record<string, number>>({});
  const view = movements ? "mov" : "dash";
  const { tab: urlTab } = Route.useSearch();
  useEffect(() => {
    if (urlTab === "agenda" || urlTab === "oficina") {
      setTab(urlTab);
      setMovements(false);
    } else if (urlTab === "consultas" || urlTab === "consultas-os") {
      setSub(urlTab === "consultas" ? "veiculos" : "os");
      setMovements(true);
    }
  }, [urlTab]);
  useEffect(() => {
    window.scrollTo(0, scrolls.current[view] ?? 0);
  }, [view]);
  const go = (next: boolean) => {
    scrolls.current[view] = window.scrollY;
    setMovements(next);
  };
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const [profileResult, roleResult, modulesResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("get_my_modules"),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      return {
        full_name: profileResult.data?.full_name ?? null,
        role: roleResult.data?.role ?? null,
        modules: (modulesResult.data ?? []) as string[],
      };
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (profile.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!profile.data?.role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-card-foreground">
            Aguardando liberação de acesso
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ({user.email}) foi criada, mas ainda não possui um perfil atribuído. Solicite
            a liberação a um usuário master.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => profile.refetch()}>
              Verificar novamente
            </Button>
            <Button onClick={signOut}>Sair</Button>
          </div>
        </div>
      </div>
    );
  }

  if (user.user_metadata?.["must_change_password"] === true && !passwordChanged) {
    return (
      <FirstPasswordScreen
        email={user.email ?? ""}
        onDone={() => setPasswordChanged(true)}
        onSignOut={signOut}
      />
    );
  }

  const modules = profile.data.modules;
  const available = (["agenda", "oficina"] as const).filter((m) => modules.includes(m));
  const active = tab && available.includes(tab) ? tab : (available[0] ?? "agenda");
  const tabBtn = (key: string, label: string, on: boolean, click: () => void) => (
    <Button
      key={key}
      role="tab"
      aria-selected={on}
      variant={on ? "default" : "outline"}
      onClick={click}
    >
      {label}
    </Button>
  );
  const tabs = (
    <div role="tablist" aria-label="Módulos" className="flex flex-wrap gap-2">
      {available.map((m) =>
        tabBtn(m, m === "agenda" ? "Agenda" : "Oficina", !movements && m === active, () => {
          go(false);
          setTab(m);
          void navigate({ to: "/", search: { tab: m } });
        }),
      )}
      {tabBtn("mov", "Consultas", movements, () => {
        go(true);
        void navigate({ to: "/", search: { tab: sub === "os" ? "consultas-os" : "consultas" } });
      })}
      <Button variant="outline" onClick={() => navigate({ to: "/ordens-servico" })}>
        Ordens de Serviço
      </Button>
    </div>
  );
  const currentUser = {
    id: user.id,
    name: profile.data.full_name || user.email || "Usuário",
    role: profile.data.role,
    email: user.email ?? "",
  };
  return (
    <>
      <div className={movements ? "hidden" : undefined}>
        {(active === "oficina" || profile.data.role === "oficina") ? (
          <WorkshopYard
            key="yard"
            currentUser={currentUser}
            tabs={tabs}
            onSignOut={signOut}
            onOpenMovements={(plate) => {
              setMovReq({ plate, nonce: Date.now() });
              setSub("veiculos");
              go(true);
            }}
          />
        ) : (
          <MaintenanceDashboard
            key={active}
            mode={active}
            tabs={tabs}
            onSignOut={signOut}
            currentUser={currentUser}
            onOpenMovements={(plate) => {
              setMovReq({ plate, nonce: Date.now() });
              setSub("veiculos");
              go(true);
            }}
          />
        )}
      </div>
      {movements && (
        <div className="bg-background text-foreground">
          <main className="mx-auto max-w-[1600px] space-y-4 px-5 py-6 lg:px-8">
            {tabs}
            <div role="tablist" aria-label="Consultas" className="flex gap-2 border-b pb-2">
              {tabBtn("sub-v", "Veículos", sub === "veiculos", () => setSub("veiculos"))}
              {tabBtn("sub-os", "O.S.", sub === "os", () => setSub("os"))}
            </div>
          </main>
        </div>
      )}
      <div
        className={
          movements && sub === "veiculos"
            ? "mx-auto -mt-2 max-w-[1600px] bg-background px-5 pb-10 text-foreground lg:px-8"
            : "hidden"
        }
      >
        <MovementsPanel isMaster={currentUser.role === "master"} request={movReq} />
      </div>
      {movements && sub === "os" && (
        <div className="mx-auto -mt-2 max-w-[1600px] bg-background px-5 pb-10 text-foreground lg:px-8">
          <OsConsultaPanel
            onOpenPlate={(plate) => {
              setMovReq({ plate, nonce: Date.now() });
              setSub("veiculos");
            }}
          />
        </div>
      )}
    </>
  );
}
