import type { ReactNode } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/components/maintenance-dashboard";
import { knownModules, landingPath, type ModuleKey } from "@/lib/modules";

export type GateUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
export type GateCurrent = { id: string; name: string; role: AppRole; modules: ModuleKey[] };

/** Carrega perfil, papel e módulos do usuário logado; bloqueia quem não tem acesso ou não enxerga o módulo pedido. */
export function ProfileGate({ user, module, children }: { user: GateUser; module?: ModuleKey; children: (current: GateCurrent) => ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const [profileResult, roleResult, moduleResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("get_my_modules"),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      if (moduleResult.error) throw moduleResult.error;
      return { full_name: profileResult.data?.full_name ?? null, role: roleResult.data?.role ?? null, modules: knownModules(moduleResult.data) };
    },
  });
  async function signOut() {
    await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  }
  if (profile.isLoading) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando…</div>;
  if (profile.isError) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md rounded-lg border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar seu acesso</h1>
      <div className="mt-6 flex justify-center gap-2"><Button variant="outline" onClick={() => profile.refetch()}>Tentar de novo</Button><Button onClick={signOut}>Sair</Button></div>
    </div></div>;
  }
  if (!profile.data?.role) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md rounded-lg border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold">Aguardando liberação de acesso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sua conta ainda não possui um perfil atribuído. Solicite a liberação a um usuário master.</p>
      <div className="mt-6 flex justify-center gap-2"><Button variant="outline" onClick={() => profile.refetch()}>Verificar novamente</Button><Button onClick={signOut}>Sair</Button></div>
    </div></div>;
  }
  const { modules } = profile.data;
  if (module && !modules.includes(module)) {
    const landing = landingPath(modules);
    if (module === "agenda" && landing) return <Navigate to={landing} replace />;
    return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md rounded-lg border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold">{landing ? "Você não tem acesso a esta área" : "Nenhuma área liberada"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{landing ? "O setor do seu usuário não inclui este módulo." : "Seu usuário ainda não está em um setor com módulos liberados. Solicite a um usuário master."}</p>
      <div className="mt-6 flex justify-center gap-2">{landing && <Button asChild><Link to={landing}>Ir para uma área liberada</Link></Button>}<Button variant="outline" onClick={signOut}>Sair</Button></div>
    </div></div>;
  }
  return <>{children({ id: user.id, name: profile.data.full_name || user.email || "Usuário", role: profile.data.role, modules })}</>;
}
