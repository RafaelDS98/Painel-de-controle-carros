import { createFileRoute } from "@tanstack/react-router";
import { VehicleHistoryPage } from "@/components/historicos";
import { ProfileGate } from "@/components/profile-gate";
import { plateFromParam } from "@/lib/history-log";

export const Route = createFileRoute("/_authenticated/veiculo/$plate")({
  head: () => ({
    meta: [
      { title: "Histórico do veículo | ANPEXC" },
      {
        name: "description",
        content: "Movimentações e histórico de manutenção do veículo na frota ANPEXC.",
      },
      { property: "og:title", content: "Histórico do veículo | ANPEXC" },
      {
        property: "og:description",
        content: "Movimentações e histórico de manutenção do veículo na frota ANPEXC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { plate } = Route.useParams();
  return (
    <ProfileGate user={user} module="historicos">
      {() => <VehicleHistoryPage plate={plateFromParam(plate)} />}
    </ProfileGate>
  );
}
