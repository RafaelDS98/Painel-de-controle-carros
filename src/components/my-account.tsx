import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SglocAccountSection } from "@/components/sgloc-account";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function isWeakPassword(value: string) {
  return value.length > 0 && (value.length < 8 || /^(\d+|[a-z]+)$/i.test(value));
}

/** Campo de senha com mostrar/ocultar. */
export function PasswordInput({ label, value, onChange, autoComplete = "new-password" }: { label: string; value: string; onChange: (v: string) => void; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return <label className="block text-sm">{label}<span className="relative block"><Input type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} className="pr-11" maxLength={72} />
    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((v) => !v)}>{show ? <EyeOff /> : <Eye />}</Button></span></label>;
}

export function MyAccountDialog({ open, onOpenChange, userId, email, name, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string; email: string; name: string; onSaved: () => void }) {
  const [fullName, setFullName] = useState(name);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) { setMsg({ error: "Informe o nome (mínimo 2 letras)." }); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", userId);
    setBusy(false);
    if (error) setMsg({ error: "Não foi possível salvar o nome." }); else { setMsg({ ok: "Nome atualizado." }); onSaved(); }
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!current) { setMsg({ error: "Informe a senha atual." }); return; }
    if (password.length < 6) { setMsg({ error: "A nova senha precisa ter pelo menos 6 caracteres." }); return; }
    if (password !== confirm) { setMsg({ error: "As senhas não conferem." }); return; }
    setBusy(true); setMsg({});
    const check = await supabase.auth.signInWithPassword({ email, password: current });
    if (check.error) { setBusy(false); setMsg({ error: "Senha atual incorreta." }); return; }
    const { error } = await supabase.auth.updateUser({ password, current_password: current } as never);
    setBusy(false);
    if (error) {
      setMsg({ error: /pwned|leak|common|weak|breach/i.test(error.message) ? "Senha recusada pela proteção de senhas vazadas/muito comuns. Escolha outra." : /different|same/i.test(error.message) ? "A nova senha deve ser diferente da atual." : "Não foi possível trocar a senha." });
      return;
    }
    setCurrent(""); setPassword(""); setConfirm(""); setMsg({ ok: "Senha alterada." });
  }

  return <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); setMsg({}); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>Minha conta</DialogTitle><DialogDescription>{email || "—"}</DialogDescription></DialogHeader>
      <form onSubmit={saveName} className="space-y-2"><label className="block text-sm">Nome<Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} /></label><Button type="submit" size="sm" disabled={busy}>Salvar nome</Button></form>
      <form onSubmit={savePassword} className="space-y-2 border-t pt-4"><h3 className="font-semibold">Alterar senha</h3>
        <PasswordInput label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput label="Nova senha" value={password} onChange={setPassword} />
        {isWeakPassword(password) && <p className="text-xs text-muted-foreground">Senha fraca — permitida, mas considere uma mais forte.</p>}
        <PasswordInput label="Confirmar nova senha" value={confirm} onChange={setConfirm} />
        <Button type="submit" size="sm" disabled={busy}>Alterar senha</Button></form>
      {msg.error && <p role="alert" className="text-sm text-destructive">{msg.error}</p>}
      {msg.ok && <p role="status" className="text-sm text-muted-foreground">{msg.ok}</p>}
      {open && <SglocAccountSection />}
    </DialogContent>
  </Dialog>;
}
