// Server functions para o módulo de Ordens de Serviço.
// Padrão: createServerFn + requireSupabaseAuth + zod + panelError.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { errorCode, panelError } from "@/lib/auth-errors";

type Ctx = { supabase: any; userId: string };

async function assertApproved(context: Ctx) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
  if (error || !data?.role) throw panelError("", "Seu usuário ainda não tem acesso ao painel.");
}

async function assertMaster(context: Ctx) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
  if (error || data?.role !== "master") throw panelError("", "Você não tem permissão (apenas master).");
}

function parseWith<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw panelError("", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

async function safeError(op: string, caught: unknown): Promise<Error> {
  if (caught instanceof Error && /permissão|acesso ao painel|não pode/.test(caught.message)) return caught;
  const code = errorCode();
  console.error(`[os] ${op} falhou cód=${code}`, (caught as Error)?.name ?? "erro");
  return panelError("", `Erro inesperado em ordens de serviço (cód. ${code}).`, code);
}

// --- Schemas ---
const createOsInput = z.object({
  plate: z.string().trim().min(1, "Informe a placa do veículo.").max(10),
  km: z.number().int().min(0).nullable().optional(),
  storeId: z.number().int().nullable().optional(),
  workshopId: z.string().uuid().nullable().optional(),
  tipoId: z.number().int("Selecione o tipo de O.S."),
  centroCustoId: z.string().uuid().nullable().optional(),
  tipoAtendimento: z.enum(["P", "E", "N", "D"]).default("N"),
  appointmentId: z.string().uuid().nullable().optional(),
  hora: z.string().nullable().optional(),
  tanqueInicial: z.string().nullable().optional(),
  gnvInicial: z.string().nullable().optional(),
  posicaoInicial: z.string().nullable().optional(),
  contratoId: z.number().int().nullable().optional(),
  condutorNome: z.string().trim().max(200).nullable().optional(),
  condutorContato: z.string().trim().max(100).nullable().optional(),
  nf: z.string().trim().max(100).nullable().optional(),
  recuperado: z.boolean().nullable().optional(),
  externaRef: z.string().trim().max(200).nullable().optional(),
  obs1: z.string().trim().max(2000).nullable().optional(),
  obs2: z.string().trim().max(2000).nullable().optional(),
  previsaoConclusao: z.string().nullable().optional(),
  pagamentoMetodo: z.string().trim().max(100).nullable().optional(),
  solicitante: z.string().trim().max(200).nullable().optional(),
  autorizacao: z.string().trim().max(200).nullable().optional(),
  pendencia: z.boolean().default(false),
  pendenciaDesc: z.string().trim().max(500).nullable().optional(),
  executado: z.enum(["S", "A", "N"]).default("N"),
  autorizadoCliente: z.enum(["Sim", "Não", "Pendente"]).default("Pendente"),
});

const updateOsInput = z.object({
  id: z.string().uuid("ID inválido."),
  changes: z.record(z.unknown()),
});

const transitionStatusInput = z.object({
  id: z.string().uuid(),
  newStatusId: z.number().int().min(1).max(7),
});

const finalizeOsInput = z.object({
  id: z.string().uuid(),
  kmFinal: z.number().int().min(0).nullable().optional(),
  tanqueFinal: z.string().nullable().optional(),
  gnvFinal: z.string().nullable().optional(),
  posicaoFinal: z.string().nullable().optional(),
});

const addItemInput = z.object({
  osId: z.string().uuid(),
  description: z.string().trim().min(1, "Informe a descrição do item.").max(500),
  qty: z.number().positive("Quantidade deve ser positiva."),
  unitPrice: z.number().min(0, "Valor unitário não pode ser negativo."),
  itemType: z.enum(["service", "part"]),
  serviceCode: z.string().trim().max(50).nullable().optional(),
  partCode: z.string().trim().max(50).nullable().optional(),
  budgetAccount: z.string().trim().max(100).nullable().optional(),
  mechanicName: z.string().trim().max(200).nullable().optional(),
  classification: z.string().trim().max(200).nullable().optional(),
  requester: z.string().trim().max(200).nullable().optional(),
  authorizer: z.string().trim().max(200).nullable().optional(),
  observation: z.string().trim().max(1000).nullable().optional(),
  movementDate: z.string().nullable().optional(),
});

const updateItemInput = z.object({
  itemId: z.string().uuid(),
  changes: z.record(z.unknown()),
});

const deleteItemInput = z.object({
  itemId: z.string().uuid(),
});

const batchApproveInput = z.object({
  osId: z.string().uuid(),
  approval: z.enum(["Pendente", "Autorizado", "Negado"]),
});

const searchInput = z.object({
  filters: z.record(z.string()).default({}),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const detailInput = z.object({
  id: z.string().uuid(),
});

const archiveInput = z.object({
  id: z.string().uuid(),
});

// --- Server Functions ---

/** Cria uma nova Ordem de Serviço. */
export const createOrdemServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(createOsInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_create", {
        _plate: data.plate,
        _km: data.km ?? null,
        _store_id: data.storeId ?? null,
        _workshop_id: data.workshopId ?? null,
        _tipo_id: data.tipoId,
        _centro_custo_id: data.centroCustoId ?? null,
        _tipo_atendimento: data.tipoAtendimento,
        _appointment_id: data.appointmentId ?? null,
        _hora: data.hora ?? null,
        _tanque_inicial: data.tanqueInicial ?? null,
        _gnv_inicial: data.gnvInicial ?? null,
        _posicao_inicial: data.posicaoInicial ?? null,
        _contrato_id: data.contratoId ?? null,
        _condutor_nome: data.condutorNome ?? null,
        _condutor_contato: data.condutorContato ?? null,
        _nf: data.nf ?? null,
        _recuperado: data.recuperado ?? null,
        _externa_ref: data.externaRef ?? null,
        _obs1: data.obs1 ?? null,
        _obs2: data.obs2 ?? null,
        _previsao_conclusao: data.previsaoConclusao ?? null,
        _pagamento_metodo: data.pagamentoMetodo ?? null,
        _solicitante: data.solicitante ?? null,
        _autorizacao: data.autorizacao ?? null,
        _pendencia: data.pendencia,
        _pendencia_desc: data.pendenciaDesc ?? null,
        _executado: data.executado,
        _autorizado_cliente: data.autorizadoCliente,
      });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("createOrdemServico", caught); }
  });

/** Atualiza campos de uma O.S. existente. */
export const updateOrdemServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(updateOsInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_update", {
        _os_id: data.id,
        _changes: data.changes,
      });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("updateOrdemServico", caught); }
  });

/** Transiciona o status de uma O.S. */
export const transitionOsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(transitionStatusInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_transition_status", {
        _os_id: data.id,
        _new_status_id: data.newStatusId,
      });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("transitionOsStatus", caught); }
  });

/** Finaliza uma O.S. (só se Em andamento). */
export const finalizeOrdemServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(finalizeOsInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_finalize", {
        _os_id: data.id,
        _km_final: data.kmFinal ?? null,
        _tanque_final: data.tanqueFinal ?? null,
        _gnv_final: data.gnvFinal ?? null,
        _posicao_final: data.posicaoFinal ?? null,
      });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("finalizeOrdemServico", caught); }
  });

/** Arquiva uma O.S. (master only). */
export const archiveOrdemServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(archiveInput, data))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    try {
      const { error } = await context.supabase.rpc("os_archive", { _os_id: data.id });
      if (error) throw error;
      return { success: true };
    } catch (caught) { throw await safeError("archiveOrdemServico", caught); }
  });

/** Adiciona item à O.S. */
export const addOsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(addItemInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_item_add", {
        _os_id: data.osId,
        _description: data.description,
        _qty: data.qty,
        _unit_price: data.unitPrice,
        _item_type: data.itemType,
        _service_code: data.serviceCode ?? null,
        _part_code: data.partCode ?? null,
        _budget_account: data.budgetAccount ?? null,
        _mechanic_name: data.mechanicName ?? null,
        _classification: data.classification ?? null,
        _requester: data.requester ?? null,
        _authorizer: data.authorizer ?? null,
        _observation: data.observation ?? null,
        _movement_date: data.movementDate ?? null,
      });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("addOsItem", caught); }
  });

/** Atualiza item da O.S. */
export const updateOsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(updateItemInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_item_update", {
        _item_id: data.itemId,
        _changes: data.changes,
      });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("updateOsItem", caught); }
  });

/** Exclui item da O.S. */
export const deleteOsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(deleteItemInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { error } = await context.supabase.rpc("os_item_delete", { _item_id: data.itemId });
      if (error) throw error;
      return { success: true };
    } catch (caught) { throw await safeError("deleteOsItem", caught); }
  });

/** Aprova/desaprova todos os itens de uma O.S. */
export const batchApproveItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(batchApproveInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { error } = await context.supabase.rpc("os_items_batch_approve", {
        _os_id: data.osId,
        _approval: data.approval,
      });
      if (error) throw error;
      return { success: true };
    } catch (caught) { throw await safeError("batchApproveItems", caught); }
  });

/** Busca O.S. com filtros paginados. */
export const searchOrdensServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(searchInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("search_ordens_servico", {
        _filters: data.filters,
        _page: data.page,
        _page_size: data.pageSize,
      });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("searchOrdensServico", caught); }
  });

/** Obtém detalhe completo de uma O.S. */
export const getOsDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(detailInput, data))
  .handler(async ({ data, context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_get_detail", { _os_id: data.id });
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("getOsDetail", caught); }
  });

/** Lista configurações (tipos, status, centros, etc.). */
export const getOsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertApproved(context);
    try {
      const { data: result, error } = await context.supabase.rpc("os_config_list");
      if (error) throw error;
      return result;
    } catch (caught) { throw await safeError("getOsConfig", caught); }
  });