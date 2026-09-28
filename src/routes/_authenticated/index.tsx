import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MaintenanceDashboard } from "@/components/maintenance-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Agenda de Manutenção | ANPEX" },
      { name: "description", content: "Painel semanal de agendamentos de manutenção da frota ANPEX." },
      { property: "og:title", content: "Agenda de Manutenção | ANPEX" },
      { property: "og:description", content: "Painel semanal de agendamentos de manutenção da frota ANPEX." },
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
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
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

  return <MaintenanceDashboard onSignOut={signOut} currentUser={{ id: user.id, name: profile.data.full_name || user.email || "Usuário", role: profile.data.role }} />;
}
