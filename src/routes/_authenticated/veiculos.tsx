import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { FleetPanel } from "@/components/fleet-panel";
export const Route = createFileRoute("/_authenticated/veiculos")({
  head: () => ({
    meta: [
      { title: "Veículos da empresa | ANPEXC" },
      { name: "description", content: "Consulta e cadastro da frota da empresa ANPEXC." },
      { property: "og:title", content: "Veículos da empresa | ANPEXC" },
      { property: "og:description", content: "Consulta e cadastro da frota da empresa ANPEXC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Vehicles,
});
function Vehicles() {
  const { user } = Route.useRouteContext();
  return (
    <ProfileGate user={user} module="veiculos">
      {(current) => <FleetPanel role={current.role} />}
    </ProfileGate>
  );
}
