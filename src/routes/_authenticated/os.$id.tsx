import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { OsForm } from "@/components/os-form";

export const Route = createFileRoute("/_authenticated/os/$id")({
  head: () => ({
    meta: [{ title: "Editar O.S. | ANPEXC" }],
  }),
  component: OsEditPage,
});

function OsEditPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  return (
    <ProfileGate user={user} module="os">
      {() => <OsForm osId={id} />}
    </ProfileGate>
  );
}