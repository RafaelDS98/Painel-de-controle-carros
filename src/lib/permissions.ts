import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Catálogo de permissões configuráveis pelo master. O banco (has_permission) decide; a tela só espelha. */
export const PERMISSIONS = [
  { key: "module.agenda", group: "Abas", label: "Agenda de Manutenção" },
  { key: "module.oficina", group: "Abas", label: "Pátio da Oficina" },
  { key: "module.historicos", group: "Abas", label: "Históricos" },
  { key: "module.os", group: "Abas", label: "Ordens de Serviço" },
  { key: "module.veiculos", group: "Abas", label: "Veículos" },
  { key: "module.noticias", group: "Abas", label: "Notícias (gerenciar)" },
  { key: "action.forward_workshop", group: "Ações", label: "Encaminhar veículo para oficina" },
  { key: "action.create_os", group: "Ações", label: "Criar ordem de serviço" },
  { key: "action.os_edit_closed", group: "Ações", label: "Alterar/reabrir O.S. e atendimentos finalizados/cancelados" },
  { key: "action.manage_vehicles", group: "Ações", label: "Cadastrar/editar veículos" },
  { key: "action.news_create", group: "Notícias", label: "Publicar notícia" },
  { key: "action.news_edit", group: "Notícias", label: "Editar notícia" },
  { key: "action.news_delete", group: "Notícias", label: "Excluir notícia" },
  { key: "action.home_layout", group: "Notícias", label: "Organizar painéis da Home" },
  { key: "module.vistorias", group: "Vistorias", label: "Acessar módulo Vistorias" },
  { key: "action.inspection_create", group: "Vistorias", label: "Fazer vistoria" },
  { key: "action.inspection_cancel", group: "Vistorias", label: "Cancelar vistoria" },
  { key: "action.inspection_config", group: "Vistorias", label: "Configurar vistorias" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

/** Espelho de permission_default() no banco: o que cada perfil tem sem exceção. */
export function permissionDefault(role: string | null | undefined, key: string): boolean {
  if (!role) return false;
  if (role === "master") return true;
  const oficina = role === "oficina";
  switch (key) {
    case "module.agenda":
    case "module.historicos":
      return !oficina;
    case "module.os":
      return true;
    case "module.oficina":
      return oficina;
    case "module.veiculos":
      return true;
    case "action.forward_workshop":
    case "action.create_os":
      return role === "gerente" || role === "atendimento";
    case "action.manage_vehicles":
    case "module.noticias":
    case "action.news_create":
    case "action.news_edit":
    case "action.news_delete":
    case "action.home_layout":
      return role === "gerente";
    case "module.vistorias":
    case "action.inspection_create":
      return true;
    case "action.inspection_cancel":
    case "action.inspection_config":
      return role === "gerente";
    default:
      return false;
  }
}

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
