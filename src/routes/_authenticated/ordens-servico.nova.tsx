import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProfileGate } from "@/components/profile-gate";
import { OsNewPage } from "@/components/ordens-servico";

export const Route = createFileRoute("/_authenticated/ordens-servico/nova")({
  validateSearch: z.object({ agendamento: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Nova Ordem de Serviço | ANPEXC" },
      { name: "description", content: "Abrir uma nova ordem de serviço no painel ANPEXC." },
      { property: "og:title", content: "Nova Ordem de Serviço | ANPEXC" },
      { property: "og:description", content: "Abrir uma nova ordem de serviço no painel ANPEXC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { agendamento } = Route.useSearch();
  return (
    <ProfileGate user={user} permission="action.create_os">
      {(me) =>
        me.role === "oficina" ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Seu perfil não cria ordens de serviço.
          </p>
        ) : (
          <OsNewPage appointmentId={agendamento} />
        )
      }
    </ProfileGate>
  );
}
