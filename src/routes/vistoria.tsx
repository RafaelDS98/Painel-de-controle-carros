import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  ClipboardPlus,
  Home,
  ListChecks,
  LogOut,
  Radio,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/logo-anpexc.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProfileGate } from "@/components/profile-gate";
import { useMyPermissions } from "@/lib/permissions";
import {
  hasPanelAccess,
  isVistoriaSessionExpired,
  VISTORIA_LOGIN_KEY,
} from "@/lib/vistoria-session";

export const Route = createFileRoute("/vistoria")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ANPEXC Vistorias" },
      { name: "description", content: "Vistorias de veículos da frota ANPEXC pelo celular." },
      { property: "og:title", content: "ANPEXC Vistorias" },
      {
        property: "og:description",
        content: "Vistorias de veículos da frota ANPEXC pelo celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#1e3a5f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "manifest", href: "/vistoria.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  component: VistoriaRoot,
});

function VistoriaRoot() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    void (async () => {
      const raw = localStorage.getItem(VISTORIA_LOGIN_KEY);
      if (isVistoriaSessionExpired(raw ? Number(raw) : null, Date.now())) {
        localStorage.removeItem(VISTORIA_LOGIN_KEY);
        await supabase.auth.signOut();
      }
      const { data } = await supabase.auth.getUser();
      setUser(data.user ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (user === undefined)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  if (!user) return <VistoriaLogin />;
  return (
    <ProfileGate user={user} permission="module.vistorias">
      {(current) => <VistoriaShell name={current.name} />}
    </ProfileGate>
  );
}

function VistoriaLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    localStorage.setItem(VISTORIA_LOGIN_KEY, String(Date.now()));
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <div className="text-center">
          <img src={logoAsset.url} alt="ANPEXC" className="mx-auto h-20 w-auto object-contain" />
          <h1 className="mt-3 text-xl font-semibold">ANPEXC Vistorias</h1>
          <p className="text-sm text-muted-foreground">Entre com a mesma conta do painel.</p>
        </div>
        <Input
          type="email"
          placeholder="E-mail"
          autoComplete="email"
          className="h-12"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Senha"
          autoComplete="current-password"
          className="h-12"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Você continua conectado neste aparelho por até 12 horas.
        </p>
      </form>
    </div>
  );
}

const MENU: { label: string; icon: LucideIcon; to?: "/vistoria"; stage?: string }[] = [
  { label: "Início", icon: Home, to: "/vistoria" },
  { label: "Nova vistoria", icon: ClipboardPlus, stage: "Etapa 1" },
  { label: "Vistorias", icon: ListChecks, stage: "Etapa 1" },
  { label: "Localizar por placa", icon: Search, stage: "Etapa 1" },
  { label: "Ao Vivo", icon: Radio, stage: "Etapa 2" },
  { label: "Clientes", icon: Users, stage: "Etapa 4" },
  { label: "Relatórios", icon: BarChart3, stage: "Etapa 4" },
  { label: "Configurações", icon: Settings, stage: "Etapa 3" },
];

function VistoriaShell({ name }: { name: string }) {
  const perms = useMyPermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canPanel = perms.data ? hasPanelAccess(perms.data) : false;
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    localStorage.removeItem(VISTORIA_LOGIN_KEY);
    await supabase.auth.signOut();
    void navigate({ to: "/vistoria", replace: true });
  }
  const back = canPanel && (
    <Button asChild variant="outline" size="sm" className="h-10">
      <Link to="/home">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Voltar ao painel ANPEXC</span>
        <span className="sm:hidden">Painel</span>
      </Link>
    </Button>
  );
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <span className="font-semibold">Vistorias</span>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {MENU.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                className="flex h-10 items-center gap-3 rounded-md bg-sidebar-accent px-3 text-sm font-medium"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ) : (
              <div
                key={item.label}
                title={`Em construção (${item.stage})`}
                className="flex h-10 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] uppercase">{item.stage}</span>
              </div>
            ),
          )}
        </nav>
        {canPanel && (
          <div className="border-t p-2">
            <Link
              to="/home"
              className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-link hover:bg-sidebar-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao painel ANPEXC
            </Link>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
          <img src={logoAsset.url} alt="ANPEXC" className="h-9 w-auto object-contain" />
          <span className="font-semibold md:hidden">Vistorias</span>
          <div className="ml-auto flex items-center gap-2">
            {back}
            <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={signOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
