import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  CalendarClock,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  DollarSign,
  FileText,
  HelpCircle,
  History,
  Home,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import phoenixAsset from "@/assets/logo-anpexc-marca.png.asset.json";

const ROLE_LABELS: Record<string, string> = {
  master: "Master",
  gerente: "Gerente",
  oficina: "Oficina",
  atendimento: "Atendimento",
};

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  hideFor?: string[];
  onlyFor?: string[];
};

const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/", label: "Agenda de Manutenção", icon: CalendarClock, exact: true },
  {
    to: "/usuarios/permissoes",
    label: "Usuários · Permissões",
    icon: ShieldCheck,
    onlyFor: ["master"],
  },
  { to: "/ordens-servico", label: "Ordens de Serviço", icon: ClipboardList },
  { to: "/historicos", label: "Históricos", icon: History, hideFor: ["oficina"] },
  { to: "/veiculos", label: "Veículos", icon: Truck },
];

/** Módulos futuros — visíveis desabilitados até existirem. */
const SOON: { label: string; icon: LucideIcon }[] = [
  { label: "Motoristas", icon: Users },
  { label: "Contratos", icon: FileText },
  { label: "Financeiro", icon: DollarSign },
  { label: "Relatórios", icon: BarChart3 },
];

const SECTION_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/ordens-servico": "Ordens de Serviço",
  "/ordens-servico/nova": "Nova O.S.",
  "/historicos": "Históricos",
  "/veiculo": "Veículo",
  "/veiculos": "Veículos",
  "/usuarios": "Usuários",
  "/usuarios/permissoes": "Permissões",
};

function useCrumbs(): { label: string; to?: string }[] {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (!parts.length) return [{ label: "Agenda" }];
    const out: { label: string; to?: string }[] = [];
    let acc = "";
    for (const part of parts) {
      acc += `/${part}`;
      const known = SECTION_LABELS[acc];
      out.push(known ? { label: known, to: acc } : { label: part.toUpperCase() });
    }
    return out;
  }, [pathname]);
}

function SidebarContent({
  collapsed,
  role,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean;
  role: string | null;
  onNavigate: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = NAV.filter(
    (item) =>
      !item.hideFor?.includes(role ?? "") && (!item.onlyFor || item.onlyFor.includes(role ?? "")),
  );
  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          title="Ir para a tela inicial"
          aria-label="ANPEXC — voltar para a tela inicial"
          className="flex min-w-0 items-center gap-2 rounded-md hover:opacity-80"
        >
          <img src={phoenixAsset.url} alt="" className="size-9 shrink-0 object-contain" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight">ANPEXC</p>
              <p className="truncate text-[11px] text-muted-foreground">Gestão de Frota</p>
            </div>
          )}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Navegação principal">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
        <Separator className="my-2" />
        {!collapsed && (
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Em breve
          </p>
        )}
        {SOON.map((item) => (
          <span
            key={item.label}
            title="Em breve"
            aria-disabled
            className={cn(
              "flex min-h-10 cursor-default select-none items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/50",
              collapsed && "justify-center px-0",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </span>
        ))}
      </nav>
      <div className="space-y-1 border-t px-2 py-3">
        <span
          title="Em breve"
          aria-disabled
          className="flex min-h-10 cursor-default select-none items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/50"
        >
          <HelpCircle className="size-4 shrink-0" />
          {!collapsed && <span>Central de Ajuda</span>}
        </span>
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="w-full justify-start gap-3 text-muted-foreground"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {!collapsed && "Recolher menu"}
          </Button>
        )}
      </div>
    </>
  );
}

function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const plate = useMemo(() => {
    const value = search.trim().toUpperCase().replace(/[\s-]/g, "");
    return /^[A-Z]{3}[A-Z0-9]{4}$/.test(value) ? value : null;
  }, [search]);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar página ou placa do veículo…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {NAV.map((item) => (
            <CommandItem
              key={item.label}
              value={item.label}
              onSelect={() => {
                onOpenChange(false);
                setSearch("");
                void navigate({ to: item.to });
              }}
            >
              <item.icon className="size-4 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {plate && (
          <CommandGroup heading="Veículo">
            <CommandItem
              value={`placa ${plate}`}
              onSelect={() => {
                onOpenChange(false);
                setSearch("");
                void navigate({ to: "/veiculo/$plate", params: { plate } });
              }}
            >
              <Truck className="size-4 text-muted-foreground" />
              Abrir veículo {plate}
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function LayoutShell({
  user,
  children,
}: {
  user: { id: string; email?: string | null };
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { dark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const crumbs = useCrumbs();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: me } = useQuery({
    queryKey: ["shell-me", user.id],
    queryFn: async () => {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (roleResult.error) throw roleResult.error;
      return { name: profileResult.data?.full_name ?? null, role: roleResult.data?.role ?? null };
    },
  });

  const name = me?.name || user.email || "Usuário";
  const roleLabel = ROLE_LABELS[me?.role ?? ""] ?? "—";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  function toggleCollapse() {
    setCollapsed((current) => {
      try {
        localStorage.setItem("sidebar-collapsed", current ? "0" : "1");
      } catch {
        /* storage indisponível */
      }
      return !current;
    });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar text-sidebar-foreground lg:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          role={me?.role ?? null}
          onNavigate={() => {}}
          onToggleCollapse={toggleCollapse}
        />
      </aside>
      <div className={cn("flex min-h-screen flex-col", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">ANPEXC</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {crumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="contents">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="max-w-[200px] truncate">
                    {index === crumbs.length - 1 ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      crumb.to && (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.to}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div
            id="topbar-actions"
            className="mx-2 flex min-w-0 flex-1 items-center justify-center overflow-x-auto"
          />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="gap-2 bg-primary/15 text-foreground hover:bg-primary/25"
              aria-label="Buscar"
            >
              <Search className="size-4" />
              <span className="hidden text-xs sm:inline">Buscar</span>
              <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] md:inline-block">
                Ctrl K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notificações">
                  <Bell className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Sem notificações no momento.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-10 items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-accent"
                  aria-label="Menu do usuário"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs font-semibold">
                      {initials || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-36 truncate text-xs font-semibold leading-tight">
                      {name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{roleLabel}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email ?? ""}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarContent
            collapsed={false}
            role={me?.role ?? null}
            onNavigate={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
