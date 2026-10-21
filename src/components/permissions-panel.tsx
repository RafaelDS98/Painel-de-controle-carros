import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { PERMISSIONS, permissionDefault } from "@/lib/permissions";

const ROLE: Record<string, string> = {
  master: "Master",
  gerente: "Gerente",
  atendimento: "Atendimento",
  oficina: "Oficina",
};

type Override = { user_id: string; permission: string; allowed: boolean };

/** Tela master: liga/desliga cada aba e ação por usuário. "Padrão" segue o perfil. */
export function PermissionsPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const users = useQuery({
    queryKey: ["perm-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return data ?? [];
    },
  });
  const overrides = useQuery({
    queryKey: ["perm-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id,permission,allowed");
      if (error) throw error;
      return (data ?? []) as Override[];
    },
  });
  const map = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const o of overrides.data ?? []) m.set(`${o.user_id}|${o.permission}`, o.allowed);
    return m;
  }, [overrides.data]);
  const list = (users.data ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q);
  });

  async function set(userId: string, perm: string, value: "default" | "yes" | "no") {
    setBusy(`${userId}|${perm}`);
    const res =
      value === "default"
        ? await supabase
            .from("user_permissions")
            .delete()
            .eq("user_id", userId)
            .eq("permission", perm)
        : await supabase.from("user_permissions").upsert({
            user_id: userId,
            permission: perm,
            allowed: value === "yes",
            updated_by: currentUserId,
            updated_at: new Date().toISOString(),
          });
    setBusy("");
    if (res.error) {
      toast.error("Não foi possível salvar a permissão.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["perm-overrides"] });
    toast.success("Permissão atualizada");
  }

  if (users.isError || overrides.isError)
    return (
      <p role="alert" className="text-destructive">
        Não foi possível carregar as permissões.
      </p>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Marque para liberar e desmarque para bloquear. Já vem marcado o que o perfil libera por
        padrão; o ponto azul indica uma exceção feita para aquela pessoa. Master sempre tem acesso
        total e você não altera a si mesmo.
      </p>
      <Input
        placeholder="Buscar usuário por nome ou e-mail"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {users.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="sticky left-0 bg-muted p-2">Usuário</th>
                {PERMISSIONS.map((p) => (
                  <th
                    key={p.key}
                    className="min-w-24 p-2 text-center align-bottom text-xs font-medium"
                  >
                    <span className="block text-[10px] uppercase text-muted-foreground">
                      {p.group}
                    </span>
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const locked = u.role === "master" || u.user_id === currentUserId;
                return (
                  <tr key={u.user_id} className="border-t">
                    <td className="sticky left-0 bg-card p-2">
                      <p className="font-medium">{u.full_name || u.email || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.email || "—"} · {ROLE[u.role ?? ""] ?? "Sem perfil"}
                      </p>
                    </td>
                    {PERMISSIONS.map((p) => {
                      const k = `${u.user_id}|${p.key}`;
                      const def = permissionDefault(u.role, p.key);
                      const on = locked ? true : map.has(k) ? !!map.get(k) : def;
                      const custom = !locked && map.has(k);
                      return (
                        <td key={p.key} className="p-2 text-center">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            aria-label={`${p.label} — ${u.full_name || u.email}`}
                            title={custom ? "Exceção individual" : "Padrão do perfil"}
                            disabled={locked || busy === k || !u.role}
                            onClick={() => {
                              const next = !on;
                              void set(
                                u.user_id,
                                p.key,
                                next === def ? "default" : next ? "yes" : "no",
                              );
                            }}
                            className={`relative inline-flex size-6 items-center justify-center rounded border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                              on
                                ? "border-success bg-success text-success-foreground"
                                : "border-input bg-background hover:border-success"
                            }`}
                          >
                            {on && <Check className="size-4" strokeWidth={3} />}
                            {custom && (
                              <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="outline" onClick={() => void overrides.refetch()}>
        Recarregar
      </Button>
    </div>
  );
}
