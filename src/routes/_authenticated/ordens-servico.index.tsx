import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { OsListPage } from "@/components/ordens-servico";

export const Route = createFileRoute("/_authenticated/ordens-servico/")({
  head: () => ({
    meta: [
      { title: "Ordens de Serviço | ANPEXC" },
      { name: "description", content: "Lista e pesquisa das ordens de serviço da frota ANPEXC." },
      { property: "og:title", content: "Ordens de Serviço | ANPEXC" },
      {
        property: "og:description",
        content: "Lista e pesquisa das ordens de serviço da frota ANPEXC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  return (
    <ProfileGate user={user}>
      {(me) => <OsListPage canCreate={me.role !== "oficina"} />}
    </ProfileGate>
  );
}
