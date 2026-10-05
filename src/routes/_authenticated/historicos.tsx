import { createFileRoute } from "@tanstack/react-router";
import { HistoryLogPage } from "@/components/historicos";
import { ProfileGate } from "@/components/profile-gate";

export const Route = createFileRoute("/_authenticated/historicos")({
  head: () => ({ meta: [{ title: "Históricos | ANPEXC" }] }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  return <ProfileGate user={user}>{() => <HistoryLogPage />}</ProfileGate>;
}
