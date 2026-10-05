import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MaintenanceDashboard } from "@/components/maintenance-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { FirstPasswordScreen } from "@/components/first-password";
import { useState } from "react";
import { ProfileGate } from "@/components/profile-gate";

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
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <ProfileGate user={user} module="agenda">
      {(current) => user.user_metadata?.['must_change_password'] === true && !passwordChanged
        ? <FirstPasswordScreen email={user.email ?? ""} onDone={() => setPasswordChanged(true)} onSignOut={signOut} />
        : <MaintenanceDashboard onSignOut={signOut} modules={current.modules} currentUser={{ id: user.id, name: current.name, role: current.role, email: user.email ?? "" }} />}
    </ProfileGate>
  );
}
