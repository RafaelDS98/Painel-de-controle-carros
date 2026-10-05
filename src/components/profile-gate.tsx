import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/components/maintenance-dashboard";

export type GateUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

/** Carrega perfil/papel do usuário logado para as telas fora da Agenda e bloqueia quem ainda não tem acesso. */
export function ProfileGate({ user, children }: { user: GateUser; children: (current: { id: string; name: string; role: AppRole }) => ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      return { full_name: profileResult.data?.full_name ?? null, role: roleResult.data?.role ?? null };
    },
  });
  async function signOut() {
    await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  }
  if (profile.isLoading) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando…</div>;
  if (!profile.data?.role) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md rounded-lg border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold">Aguardando liberação de acesso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sua conta ainda não possui um perfil atribuído. Solicite a liberação a um usuário master.</p>
      <div className="mt-6 flex justify-center gap-2"><Button variant="outline" onClick={() => profile.refetch()}>Verificar novamente</Button><Button onClick={signOut}>Sair</Button></div>
    </div></div>;
  }
  return <>{children({ id: user.id, name: profile.data.full_name || user.email || "Usuário", role: profile.data.role })}</>;
}
