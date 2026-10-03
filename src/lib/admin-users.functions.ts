import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  fullName: z.string().trim().min(2, "Informe o nome (mínimo 2 letras).").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(255),
  role: z.enum(["atendimento", "gerente", "master"]),
  password: z.string().min(8, "A senha provisória precisa ter pelo menos 8 caracteres.").max(72),
});

/** Cria um usuário com perfil. Só master; a verificação acontece aqui no servidor. */
export const createPanelUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = input.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { data: roleRow, error: roleError } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (roleError || roleRow?.role !== "master") throw new Error("Apenas master pode criar usuários.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, must_change_password: true },
    });
    if (error || !created.user) {
      const message = error?.message ?? "";
      if (/already|registered|exists/i.test(message)) throw new Error("Já existe um usuário com este e-mail.");
      throw new Error("Não foi possível criar o usuário. Tente de novo.");
    }
    const userId = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: data.fullName });
    const { error: insertRoleError } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });
    if (insertRoleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Não foi possível atribuir o perfil. Nenhum usuário foi criado.");
    }
    return { userId };
  });

const roleEnum = z.enum(["atendimento", "gerente", "master"]);
const updateInput = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2, "Informe o nome (mínimo 2 letras).").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(255),
  role: roleEnum.nullable(),
});
const passwordInput = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.").max(72),
  requireChange: z.boolean(),
});

function parseWith<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

async function assertMaster(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
  if (error || data?.role !== "master") throw new Error("Apenas master pode alterar usuários.");
}

/** Master altera nome, e-mail e perfil de qualquer usuário (inclusive o próprio). */
export const updatePanelUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseWith(updateInput, data))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current, error: getError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getError || !current.user) throw new Error("Usuário não encontrado.");
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", data.userId).maybeSingle();
    const { data: roleRow } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId).maybeSingle();
    const oldRole = roleRow?.role ?? null;
    const changes: string[] = [];

    if (oldRole === "master" && data.role !== "master") {
      const { count } = await supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "master");
      if ((count ?? 0) <= 1) throw new Error("Este é o último master. Defina outro master antes de remover este perfil.");
    }
    const oldEmail = (current.user.email ?? "").toLowerCase();
    if (data.email !== oldEmail) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) throw new Error("Já existe um usuário com este e-mail.");
        throw new Error("Não foi possível alterar o e-mail.");
      }
      changes.push(`E-mail: ${oldEmail || "—"} → ${data.email}`);
    }
    if ((profile?.full_name ?? "") !== data.fullName) {
      await supabaseAdmin.from("profiles").upsert({ id: data.userId, full_name: data.fullName });
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { user_metadata: { ...current.user.user_metadata, full_name: data.fullName } });
      changes.push(`Nome: ${profile?.full_name || "—"} → ${data.fullName}`);
    }
    if (oldRole !== data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      if (data.role) {
        const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
        if (error) throw new Error("Não foi possível alterar o perfil.");
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
    if (getError || !current.user) throw new Error("Usuário não encontrado.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      user_metadata: { ...current.user.user_metadata, must_change_password: data.requireChange },
    });
    if (error) {
      if (/pwned|leak|common|weak|breach/i.test(error.message)) throw new Error("Senha recusada pela proteção de senhas vazadas/muito comuns. Escolha outra senha.");
      throw new Error("Não foi possível redefinir a senha.");
    }
    if (data.userId !== context.userId) await supabaseAdmin.rpc("revoke_user_sessions", { _user_id: data.userId });
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", data.userId).maybeSingle();
    await supabaseAdmin.from("user_admin_log").insert({ actor_id: context.userId, target_id: data.userId, target_label: profile?.full_name || current.user.email || "", action: "Senha redefinida", detail: data.requireChange ? "Troca exigida no próximo acesso" : "" });
    return { ok: true };
  });
