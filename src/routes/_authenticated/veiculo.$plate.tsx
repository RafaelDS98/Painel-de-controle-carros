import { createFileRoute } from "@tanstack/react-router";
import { VehicleHistoryPage } from "@/components/historicos";
import { ProfileGate } from "@/components/profile-gate";
import { plateFromParam } from "@/lib/history-log";

export const Route = createFileRoute("/_authenticated/veiculo/$plate")({
  head: () => ({ meta: [{ title: "Histórico do veículo | ANPEXC" }] }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { plate } = Route.useParams();
  return <ProfileGate user={user}>{() => <VehicleHistoryPage plate={plateFromParam(plate)} />}</ProfileGate>;
}
