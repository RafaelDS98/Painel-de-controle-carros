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
