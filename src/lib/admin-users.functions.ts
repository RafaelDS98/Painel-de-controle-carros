import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { errorCode, panelError, translateAuthError, type AuthField } from "@/lib/auth-errors";

const fieldOf = (path: PropertyKey | undefined): AuthField =>
  path === "email" || path === "password" || path === "role" || path === "fullName" ? path : "";

function parseWith<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw panelError(fieldOf(issue?.path[0]), issue?.message ?? "Dados inválidos.");
  }
  return parsed.data;
}

/** Registra o erro técnico (nunca a senha) e devolve um erro traduzido com código curto. */
function fail(op: string, error: unknown, context: "create" | "update" | "password", prefix = ""): Error {
  const code = errorCode();
  const e = error as { message?: string; code?: string; status?: number; name?: string } | null;
  console.error(`[admin-users] ${op} falhou cód=${code}`, JSON.stringify({ name: e?.name, code: e?.code, status: e?.status, message: e?.message }));
  const t = translateAuthError(e, context);
  return panelError(t.field, prefix + t.message, code);
}

const roleEnum = z.enum(["atendimento", "oficina", "gerente", "master"], { message: "Perfil inválido." });
const input = z.object({
  fullName: z.string().trim().min(2, "Informe o nome (mínimo 2 letras).").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido ou domínio não aceito.").max(255),
  role: roleEnum,
  sector: z.string().trim().max(200).optional().default(""),
  password: z.string().min(8, "Senha precisa de no mínimo 8 caracteres.").max(72, "Senha pode ter no máximo 72 caracteres."),
});

async function assertMaster(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
  if (error || data?.role !== "master") throw panelError("", "Você não tem permissão (apenas master).");
}

/** Cria um usuário com perfil. Só master; a verificação acontece aqui no servidor. */
export const createPanelUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(input, data))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let created;
    try {
      created = await supabaseAdmin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
        user_metadata: { full_name: data.fullName, must_change_password: true },
      });
    } catch (caught) { throw fail("createUser", caught, "create"); }
    if (created.error || !created.data.user) throw fail("createUser", created.error, "create");
    const userId = created.data.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.fullName, sector: data.sector || null });
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
    if (roleError) {
      const { error: undoError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      const code = errorCode();
      console.error(`[admin-users] atribuir perfil falhou cód=${code}`, JSON.stringify({ code: roleError.code, message: roleError.message, undo: undoError?.message ?? "ok" }));
      throw panelError("role", undoError
        ? `Falha ao atribuir o perfil: ${roleError.message}. O usuário ficou sem acesso; edite-o para definir o perfil.`
        : `Falha ao atribuir o perfil: ${roleError.message}. Nenhum usuário foi criado.`, code);
    }
    return { userId };
  });

const updateInput = z.object({
  userId: z.string().uuid("Usuário inválido."),
  fullName: z.string().trim().min(2, "Informe o nome (mínimo 2 letras).").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido ou domínio não aceito.").max(255),
  role: roleEnum.nullable(),
  sector: z.string().trim().max(200).optional().default(""),
});
const passwordInput = z.object({
  userId: z.string().uuid("Usuário inválido."),
  password: z.string().min(6, "Senha precisa de no mínimo 6 caracteres.").max(72, "Senha pode ter no máximo 72 caracteres."),
  requireChange: z.boolean(),
});

/** Master altera nome, e-mail e perfil de qualquer usuário (inclusive o próprio). */
export const updatePanelUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(updateInput, data))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: getError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getError || !current.user) throw fail("getUserById", getError ?? { message: "Usuário não encontrado." }, "update");
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, sector").eq("id", data.userId).maybeSingle();
    const { data: roleRow } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId).maybeSingle();
    const oldRole = roleRow?.role ?? null;
    const changes: string[] = [];

    if (oldRole === "master" && data.role !== "master") {
      const { count } = await supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "master");
      if ((count ?? 0) <= 1) throw panelError("role", "Este é o último master. Defina outro master antes de remover este perfil.");
    }
    const oldEmail = (current.user.email ?? "").toLowerCase();
    if (data.email !== oldEmail) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true });
      if (error) throw fail("updateEmail", error, "update");
      changes.push(`E-mail: ${oldEmail || "—"} → ${data.email}`);
    }
    if ((profile?.full_name ?? "") !== data.fullName) {
      const { error } = await supabaseAdmin.from("profiles").upsert({ id: data.userId, full_name: data.fullName });
      if (error) throw fail("updateName", error, "update", "Falha ao salvar o nome: ");
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { user_metadata: { ...current.user.user_metadata, full_name: data.fullName } });
      changes.push(`Nome: ${profile?.full_name || "—"} → ${data.fullName}`);
    }
    if ((profile?.sector ?? "") !== data.sector) {
      const { error } = await supabaseAdmin.from("profiles").update({ sector: data.sector || null }).eq("id", data.userId);
      if (error) throw fail("updateSector", error, "update", "Falha ao salvar o setor: ");
      changes.push(`Setor: ${profile?.sector || "—"} → ${data.sector || "—"}`);
    }
    if (oldRole !== data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      if (data.role) {
        const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
        if (error) {
          const code = errorCode();
          console.error(`[admin-users] trocar perfil falhou cód=${code}`, JSON.stringify({ code: error.code, message: error.message }));
          throw panelError("role", `Falha ao atribuir o perfil: ${error.message}. O usuário ficou sem acesso; tente salvar de novo.`, code);
        }
      }
      changes.push(`Perfil: ${oldRole ?? "sem acesso"} → ${data.role ?? "sem acesso"}`);
    }
    if (changes.length) {
      await supabaseAdmin.from("user_admin_log").insert({ actor_id: context.userId, target_id: data.userId, target_label: data.fullName, action: "Cadastro alterado", detail: changes.join("; ") });
    }
    return { changed: changes.length };
  });

/** Master define nova senha; encerra as sessões do usuário. A senha nunca é guardada nem devolvida. */
export const resetPanelPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(passwordInput, data))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: getError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getError || !current.user) throw fail("getUserById", getError ?? { message: "Usuário não encontrado." }, "password");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      user_metadata: { ...current.user.user_metadata, must_change_password: data.requireChange },
    });
    if (error) throw fail("resetPassword", error, "password");
    if (data.userId !== context.userId) await supabaseAdmin.rpc("revoke_user_sessions", { _user_id: data.userId });
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", data.userId).maybeSingle();
    await supabaseAdmin.from("user_admin_log").insert({ actor_id: context.userId, target_id: data.userId, target_label: profile?.full_name || current.user.email || "", action: "Senha redefinida", detail: data.requireChange ? "Troca exigida no próximo acesso" : "" });
    return { ok: true };
  });
