import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { PermissionsPanel } from "@/components/permissions-panel";

export const Route = createFileRoute("/_authenticated/usuarios/permissoes")({
  head: () => ({
    meta: [
      { title: "Permissões de usuários | ANPEXC" },
      { name: "description", content: "Controle de abas e ações liberadas por usuário no painel ANPEXC." },
      { property: "og:title", content: "Permissões de usuários | ANPEXC" },
      { property: "og:description", content: "Controle de abas e ações liberadas por usuário no painel ANPEXC." },
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
      {(current) =>
        current.role !== "master" ? (
          <p className="p-8 text-center">Apenas usuários Master acessam esta tela.</p>
        ) : (
          <main className="mx-auto max-w-[1600px] space-y-4 px-5 py-6 lg:px-8">
            <h1 className="text-2xl font-semibold">Permissões de usuários</h1>
            <PermissionsPanel currentUserId={current.id} />
          </main>
        )
      }
    </ProfileGate>
  );
}
