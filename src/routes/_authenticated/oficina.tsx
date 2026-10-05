import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { OficinaPage } from "@/components/oficina-page";
import { ProfileGate } from "@/components/profile-gate";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/oficina")({
  head: () => ({ meta: [{ title: "Oficina | ANPEXC" }] }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function signOut() {
    await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  }
  return <ProfileGate user={user} module="oficina">{(current) => <OficinaPage modules={current.modules} onSignOut={signOut} />}</ProfileGate>;
}
