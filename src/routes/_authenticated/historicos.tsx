import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { HistoryLogPage } from "@/components/historicos";
import { CheckInLog } from "@/components/check-in-log";
import { ProfileGate } from "@/components/profile-gate";
import { ClosedAppointments } from "@/components/closed-appointments";
import { OsConsultaPanel } from "@/components/os-consulta";

type Aba = "geral" | "checkins" | "os" | "atendimentos";
const ABAS: Aba[] = ["geral", "checkins", "os", "atendimentos"];

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
  validateSearch: (s: Record<string, unknown>): { aba?: Aba | undefined } => ({
    aba: ABAS.includes(s["aba"] as Aba) ? (s["aba"] as Aba) : undefined,
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
          <div role="tablist" className="flex flex-wrap gap-2 px-5 pt-4">
            {(
              [
                ["geral", "Alterações de atendimentos e agendamentos"],
                ["atendimentos", "Atendimentos encerrados"],
                ["os", "Histórico de O.S."],
                ["checkins", "Check-ins"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                asChild
                size="sm"
                variant={(aba ?? "geral") === k ? "default" : "outline"}
              >
                <Link to="/historicos" search={{ aba: k }}>
                  {label}
                </Link>
              </Button>
            ))}
          </div>
          {aba === "checkins" ? (
            <CheckInLog />
          ) : aba === "os" ? (
            <div className="mx-auto max-w-[1600px] px-5">
              <OsConsultaPanel scope="encerradas" />
            </div>
          ) : aba === "atendimentos" ? (
            <ClosedAppointments />
          ) : (
            <HistoryLogPage />
          )}
        </div>
      )}
    </ProfileGate>
  );
}
