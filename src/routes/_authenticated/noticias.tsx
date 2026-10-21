import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { NewsAdmin } from "@/components/news/news-admin";
import { useMyPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/noticias")({
  head: () => ({
    meta: [
      { title: "Notícias | ANPEXC" },
      { name: "description", content: "Publicação de comunicados e novidades da ANPEXC." },
      { property: "og:title", content: "Notícias | ANPEXC" },
      { property: "og:description", content: "Publicação de comunicados e novidades da ANPEXC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Gate({ userId }: { userId: string }) {
  const perms = useMyPermissions();
  if (perms.isLoading) return <p className="p-8 text-center text-muted-foreground">Carregando…</p>;
  if (!perms.data?.has("module.noticias"))
    return <p className="p-8 text-center">Você não tem acesso ao gerenciamento de notícias.</p>;
  return <NewsAdmin userId={userId} />;
}

function Page() {
  const { user } = Route.useRouteContext();
  return <ProfileGate user={user}>{(current) => <Gate userId={current.id} />}</ProfileGate>;
}
