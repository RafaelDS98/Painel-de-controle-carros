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
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      return { full_name: profileResult.data?.full_name ?? null, role: roleResult.data?.role ?? null };
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

  return <MaintenanceDashboard onSignOut={signOut} currentUser={{ id: user.id, name: profile.data.full_name || user.email || "Usuário", role: profile.data.role }} />;
}
