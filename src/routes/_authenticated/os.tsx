import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { OsDashboard } from "@/components/os-dashboard";

export const Route = createFileRoute("/_authenticated/os")({
  head: () => ({
    meta: [
      { title: "Ordens de Serviço | ANPEXC" },
      { name: "description", content: "Gestão de ordens de serviço da frota ANPEXC." },
    ],
  }),
  component: OsPage,
});

function OsPage() {
  const { user } = Route.useRouteContext();
  return (
    <ProfileGate user={user} module="os">
      {() => <OsDashboard />}
    </ProfileGate>
  );
}