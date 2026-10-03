import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | ANPEXC Agenda de Manutenção" },
      { name: "description", content: "Acesso ao painel de agendamentos de manutenção da frota ANPEXC." },
      { property: "og:title", content: "Entrar | ANPEXC Agenda de Manutenção" },
      { property: "og:description", content: "Acesso ao painel de agendamentos de manutenção da frota ANPEXC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage("E-mail ou senha inválidos.");
      else navigate({ to: "/", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
      });
      if (error) setMessage(error.message);
      else if (data.session) navigate({ to: "/", replace: true });
      else setMessage("Cadastro realizado. Confira seu e-mail para confirmar a conta.");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">ANPEXC</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Entre para acessar a agenda de manutenção." : "Crie sua conta de acesso."}</p>
        </div>
        {mode === "signup" && <Input placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />}
        <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{mode === "login" ? "Entrar" : "Cadastrar"}</Button>
        <Button type="button" variant="link" className="w-full" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
          {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </Button>
      </form>
    </div>
  );
}
