import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { OsDetailPage } from "@/components/ordens-servico";

export const Route = createFileRoute("/_authenticated/ordens-servico/$id")({
  head: () => ({ meta: [
    { title: "Ordem de Serviço | ANPEXC" },
    { name: "description", content: "Ficha da ordem de serviço: itens, situação e observações." },
    { property: "og:title", content: "Ordem de Serviço | ANPEXC" },
    { property: "og:description", content: "Ficha da ordem de serviço: itens, situação e observações." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  return <ProfileGate user={user}>{() => <OsDetailPage id={id} />}</ProfileGate>;
}
