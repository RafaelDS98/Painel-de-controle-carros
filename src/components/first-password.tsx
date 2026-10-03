import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Tela de troca da senha provisória no primeiro acesso. */
export function FirstPasswordScreen({ email, onDone, onSignOut }: { email: string; onDone: () => void; onSignOut: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError("A nova senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não conferem."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setBusy(false);
    if (error) { setError(/different|same/i.test(error.message) ? "Escolha uma senha diferente da provisória." : "Não foi possível trocar a senha. Tente de novo."); return; }
    onDone();
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-lg border bg-card p-8 shadow-sm">
        <div><h1 className="text-xl font-semibold text-card-foreground">Crie sua senha</h1><p className="mt-1 text-sm text-muted-foreground">Primeiro acesso de {email}. Troque a senha provisória para continuar.</p></div>
        <label className="block text-sm">Nova senha<Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block text-sm">Confirmar nova senha<Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2"><Button type="submit" disabled={busy}>Salvar senha</Button><Button type="button" variant="outline" onClick={onSignOut}>Sair</Button></div>
      </form>
    </div>
  );
}
