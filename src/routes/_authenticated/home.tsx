import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { HomePage } from "@/components/news/home-page";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home | ANPEXC" },
      { name: "description", content: "Informações gerais e notícias da empresa ANPEXC." },
      { property: "og:title", content: "Home | ANPEXC" },
      { property: "og:description", content: "Informações gerais e notícias da empresa ANPEXC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  return (
    <ProfileGate user={user}>
      {(current) => <HomePage userId={current.id} userName={current.name} />}
    </ProfileGate>
  );
}
