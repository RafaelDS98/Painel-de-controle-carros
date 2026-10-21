import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { OsListPage } from "@/components/ordens-servico";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useMyPermissions } from "@/lib/permissions";
import { consultasSearch } from "@/components/layout/sidebar-navigation";

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
  const { data: permissions = new Set<string>() } = useMyPermissions();
  return (
    <ProfileGate user={user}>
      {(me) => (
        <>
          <div className="mx-auto flex max-w-[1400px] flex-wrap gap-2 px-5 pt-6 lg:px-8" aria-label="Módulos">
            {me.modules.includes("agenda") && <Button variant="outline" asChild><Link to="/" search={{ tab: "agenda" }}>Agenda</Link></Button>}
            {me.modules.includes("oficina") && <Button variant="outline" asChild><Link to="/" search={{ tab: "oficina" }}>Oficina</Link></Button>}
            {(permissions.has("module.veiculos") || permissions.has("module.os")) && <Button variant="outline" asChild><Link to="/" search={consultasSearch(permissions)}>Consultas</Link></Button>}
            <Button asChild><Link to="/ordens-servico" aria-current="page">Ordens de Serviço</Link></Button>
          </div>
          <OsListPage canCreate={me.role !== "oficina"} />
        </>
      )}
    </ProfileGate>
  );
}
