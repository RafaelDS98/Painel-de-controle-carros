import { createFileRoute } from "@tanstack/react-router";
import { MaintenanceDashboard } from "@/components/maintenance-dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agenda de Manutenção | ANPEX" },
      { name: "description", content: "Painel semanal de agendamentos de manutenção da frota ANPEX." },
      { property: "og:title", content: "Agenda de Manutenção | ANPEX" },
      { property: "og:description", content: "Painel semanal de agendamentos de manutenção da frota ANPEX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <MaintenanceDashboard />;
}
