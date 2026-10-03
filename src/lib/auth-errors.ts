/** Tradução de erros do serviço de autenticação. Puro: usado no servidor e na tela. */
export type AuthField = "email" | "password" | "role" | "fullName" | "";

type AuthLikeError = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

const SEP = "::";

/** Remove trechos que poderiam carregar segredos ou detalhes técnicos. */
export function cleanAuthMessage(text: string): string {
  return text
    .replace(/(sb_(secret|publishable)_|eyJ)[A-Za-z0-9._-]+/g, "[oculto]")
    .replace(/\s+at\s+.*$/s, "")
    .replace(/https?:\/\/\S+/g, "")
    .slice(0, 200)
    .trim();
}

export function errorCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function translateAuthError(error: AuthLikeError, context: "create" | "update" | "password"): { field: AuthField; message: string } {
  const raw = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (/email_exists|already|registered|user_already_exists/.test(raw)) return { field: "email", message: "E-mail já cadastrado." };
  if (/email_address_invalid|invalid.*email|email.*invalid|unable to validate email|domain/.test(raw)) return { field: "email", message: "E-mail inválido ou domínio não aceito." };
  if (/weak_password|pwned|leak|known to be weak|easy to guess|common|breach/.test(raw)) return { field: "password", message: "Senha recusada por ser muito comum ou vazada, escolha outra." };
  if (/password.*(at least|characters|short)/.test(raw)) return { field: "password", message: context === "create" ? "Senha precisa de no mínimo 8 caracteres." : "Senha precisa de no mínimo 6 caracteres." };
  if (/fetch failed|network|timeout|econn|503|502|504/.test(raw) || (error?.status ?? 0) >= 500) return { field: "", message: "Falha de comunicação com o servidor de autenticação, tente de novo em instantes." };
  if (/not.*allowed|forbidden|401|403/.test(raw)) return { field: "", message: "Você não tem permissão (apenas master)." };
  const original = cleanAuthMessage(error?.message ?? "");
  return { field: "", message: original ? `Erro do serviço de autenticação: ${original}` : "Erro desconhecido do serviço de autenticação." };
}

/** Empacota campo + mensagem + código num Error que atravessa a função de servidor. */
export function panelError(field: AuthField, message: string, code = errorCode()): Error {
  return new Error(`${field}${SEP}${message} (cód. ${code})`);
}

export function parsePanelError(caught: unknown, fallback: string): { field: AuthField; message: string } {
  const text = caught instanceof Error && caught.message ? caught.message : fallback;
  const index = text.indexOf(SEP);
  if (index < 0 || index > 10) return { field: "", message: text };
  return { field: text.slice(0, index) as AuthField, message: text.slice(index + SEP.length) };
}
