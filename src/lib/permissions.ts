import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Catálogo de permissões configuráveis pelo master. O banco (has_permission) decide; a tela só espelha. */
export const PERMISSIONS = [
  { key: "module.agenda", group: "Abas", label: "Agenda de Manutenção" },
  { key: "module.oficina", group: "Abas", label: "Pátio da Oficina" },
  { key: "module.historicos", group: "Abas", label: "Históricos" },
  { key: "module.os", group: "Abas", label: "Ordens de Serviço" },
  { key: "module.veiculos", group: "Abas", label: "Veículos" },
  { key: "action.forward_workshop", group: "Ações", label: "Encaminhar veículo para oficina" },
  { key: "action.create_os", group: "Ações", label: "Criar ordem de serviço" },
  { key: "action.manage_vehicles", group: "Ações", label: "Cadastrar/editar veículos" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export function useMyPermissions() {
  return useQuery({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_permissions");
      if (error) throw error;
      return new Set((data ?? []) as string[]);
    },
    staleTime: 60_000,
  });
}

export function useCan(key: PermissionKey): boolean {
  const q = useMyPermissions();
  return q.data?.has(key) ?? false;
}
