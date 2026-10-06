import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MaintenanceDashboard } from "@/components/maintenance-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FirstPasswordScreen } from "@/components/first-password";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Agenda de Manutenção | ANPEXC" },
      { name: "description", content: "Painel semanal de agendamentos de manutenção da frota ANPEXC." },
      { property: "og:title", content: "Agenda de Manutenção | ANPEXC" },
      { property: "og:description", content: "Painel semanal de agendamentos de manutenção da frota ANPEXC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [tab, setTab] = useState<"agenda" | "oficina" | null>(null);
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
      return { full_name: profileResult.data?.full_name ?? null, role: roleResult.data?.role ?? null, modules: (modulesResult.data ?? []) as string[] };
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (profile.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando…</div>;
  }

  if (!profile.data?.role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-card-foreground">Aguardando liberação de acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ({user.email}) foi criada, mas ainda não possui um perfil atribuído. Solicite a liberação a um usuário master.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => profile.refetch()}>Verificar novamente</Button>
            <Button onClick={signOut}>Sair</Button>
          </div>
        </div>
      </div>
    );
  }

  if (user.user_metadata?.['must_change_password'] === true && !passwordChanged) {
    return <FirstPasswordScreen email={user.email ?? ""} onDone={() => setPasswordChanged(true)} onSignOut={signOut} />;
  }

  const modules = profile.data.modules;
  const available = (["agenda", "oficina"] as const).filter((m) => modules.includes(m));
  const active = tab && available.includes(tab) ? tab : available[0] ?? "agenda";
  const tabs = available.length > 1 ? <div role="tablist" aria-label="Módulos" className="flex gap-2">{available.map((m) => <Button key={m} role="tab" aria-selected={m === active} variant={m === active ? "default" : "outline"} onClick={() => setTab(m)}>{m === "agenda" ? "Agenda" : "Oficina"}</Button>)}</div> : null;
  return <MaintenanceDashboard key={active} mode={active} tabs={tabs} onSignOut={signOut} currentUser={{ id: user.id, name: profile.data.full_name || user.email || "Usuário", role: profile.data.role, email: user.email ?? "" }} />;
}
