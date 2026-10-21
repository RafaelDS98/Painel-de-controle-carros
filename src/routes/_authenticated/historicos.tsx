import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { HistoryLogPage } from "@/components/historicos";
import { CheckInLog } from "@/components/check-in-log";
import { ProfileGate } from "@/components/profile-gate";

export const Route = createFileRoute("/_authenticated/historicos")({
  head: () => ({
    meta: [
      { title: "Históricos | ANPEXC" },
      {
        name: "description",
        content: "Histórico auditável das alterações de manutenção da frota ANPEXC.",
      },
      { property: "og:title", content: "Históricos | ANPEXC" },
      {
        property: "og:description",
        content: "Histórico auditável das alterações de manutenção da frota ANPEXC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { aba?: "geral" | "checkins" } => ({
    aba: s.aba === "checkins" ? "checkins" : s.aba === "geral" ? "geral" : undefined,
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { aba } = Route.useSearch();
  return (
    <ProfileGate user={user} module="historicos">
      {() => (
        <div className="space-y-4">
          <div role="tablist" className="flex gap-2">
            <Button asChild variant={aba !== "checkins" ? "default" : "outline"} size="sm">
              <Link to="/historicos" search={{ aba: "geral" }}>
                Alterações
              </Link>
            </Button>
            <Button asChild variant={aba === "checkins" ? "default" : "outline"} size="sm">
              <Link to="/historicos" search={{ aba: "checkins" }}>
                Check-ins
              </Link>
            </Button>
          </div>
          {aba === "checkins" ? <CheckInLog /> : <HistoryLogPage />}
        </div>
      )}
    </ProfileGate>
  );
}
