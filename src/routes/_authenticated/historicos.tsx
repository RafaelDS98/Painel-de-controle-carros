import { createFileRoute } from "@tanstack/react-router";
import { HistoryLogPage } from "@/components/historicos";
import { ProfileGate } from "@/components/profile-gate";

export const Route = createFileRoute("/_authenticated/historicos")({
  head: () => ({ meta: [{ title: "Históricos | ANPEXC" },{name:'description',content:'Histórico auditável das alterações de manutenção da frota ANPEXC.'},{property:'og:title',content:'Históricos | ANPEXC'},{property:'og:description',content:'Histórico auditável das alterações de manutenção da frota ANPEXC.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}] }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  return (
    <ProfileGate user={user} module="historicos">
      {() => <HistoryLogPage />}
    </ProfileGate>
  );
}
