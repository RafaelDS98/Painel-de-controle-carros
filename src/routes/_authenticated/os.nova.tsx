import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProfileGate } from "@/components/profile-gate";
import { OsForm } from "@/components/os-form";

export const Route = createFileRoute("/_authenticated/os/nova")({
  head: () => ({
    meta: [{ title: "Nova O.S. | ANPEXC" }],
  }),
  component: OsNewPage,
});

function OsNewPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const search = Route.useSearch() as { appointmentId?: string } | undefined;
  return (
    <ProfileGate user={user} module="os">
      {() => (
        <OsForm
          osId={null}
          initialAppointmentId={search?.appointmentId ?? null}
          onCreated={(id) => navigate({ to: "/os/$id", params: { id } })}
        />
      )}
    </ProfileGate>
  );
}