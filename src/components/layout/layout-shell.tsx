import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronsLeft,
  ClipboardPlus,
  Plus,
  Settings,
  ChevronsRight,
  ClipboardList,
  DollarSign,
  FileText,
  HelpCircle,
  History,
  Home,
  Newspaper,
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
import { useMyPermissions } from "@/lib/permissions";
import { QuickCheckInButton } from "@/components/quick-check-in";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { canSeeNavigation, consultasSearch, isNavigationChildActive } from "./sidebar-navigation";
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
  perm?: string;
  anyPerm?: string[];
  children?: {
    label: string;
    search?: Record<string, string>;
    to?: string;
    perm?: string;
    anyPerm?: string[];
  }[];
};

const NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: Home, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    to: "/",
    label: "Agenda de Manutenção",
    icon: CalendarClock,
    exact: true,
    anyPerm: ["module.agenda", "module.oficina", "module.veiculos", "module.os"],
    children: [
      { label: "Agenda", search: { tab: "agenda" }, perm: "module.agenda" },
      { label: "Oficina / Pátio", search: { tab: "oficina" }, perm: "module.oficina" },
      {
        label: "Consultas",
        search: { tab: "consultas" },
        anyPerm: ["module.veiculos", "module.os"],
      },
      { label: "Ordens de Serviço", to: "/ordens-servico", perm: "module.os" },
    ],
  },
  {
    to: "/usuarios/permissoes",
    label: "Usuários · Permissões",
    icon: ShieldCheck,
    onlyFor: ["master"],
  },
  { to: "/noticias", label: "Notícias", icon: Newspaper, perm: "module.noticias" },
  { to: "/ordens-servico", label: "Ordens de Serviço", icon: ClipboardList, perm: "module.os" },
  {
    to: "/historicos",
    label: "Históricos",
    icon: History,
    hideFor: ["oficina"],
    perm: "module.historicos",
    children: [
      { label: "Alterações", search: { aba: "geral" } },
      { label: "Check-ins", search: { aba: "checkins" } },
    ],
  },
  { to: "/veiculos", label: "Veículos", icon: Truck, perm: "module.veiculos" },
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
  "/home": "Home",
  "/noticias": "Notícias",
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

/** Mostra o nome da opção ao passar o mouse (ou focar pelo teclado). */
function NameTip({
  label,
  side = "right",
  children,
}: {
  label: string;
  side?: "right" | "bottom";
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

function CollapsedSubmenu({
  item,
  active,
  children,
}: {
  item: NavItem;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelClose() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function scheduleClose() {
    cancelClose();
    timer.current = setTimeout(() => setOpen(false), 180);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-label={item.label}
          className={cn(
            "h-10 w-full px-0",
            active && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") {
              cancelClose();
              setOpen(true);
            }
          }}
          onPointerLeave={scheduleClose}
        >
          <item.icon className={cn("size-4", active && "text-primary")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        aria-label={`Subtelas de ${item.label}`}
        className="w-60 max-h-[80vh] overflow-y-auto p-2"
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <p className="px-2 py-2 text-xs font-semibold text-muted-foreground">{item.label}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
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
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const perms = useMyPermissions();
  const permissions = perms.data ?? new Set<string>();
  const items = NAV.filter(
    (item) =>
      canSeeNavigation(permissions, item.perm, item.anyPerm) &&
      !item.hideFor?.includes(role ?? "") &&
      (!item.onlyFor || item.onlyFor.includes(role ?? "")),
  );
  const logo = (
    <Link
      to="/home"
      onClick={onNavigate}
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
  );
  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-4",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? <NameTip label="ANPEXC — tela inicial">{logo}</NameTip> : logo}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Navegação principal">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const kids = (item.children ?? []).filter((c) =>
            canSeeNavigation(permissions, c.perm, c.anyPerm),
          );
          const open = !collapsed && kids.length > 0 && (active || expanded === item.label);
          const childLinks = kids.map((c, index) => {
            const target = c.to ?? item.to;
            const childSearch = c.label === "Consultas" ? consultasSearch(permissions) : c.search;
            const kidActive = isNavigationChildActive(
              pathname,
              target,
              search,
              childSearch,
              index === 0,
            );
            return (
              <Link
                key={c.label}
                to={target}
                search={childSearch as never}
                onClick={onNavigate}
                aria-current={kidActive ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center rounded-md px-2 text-[13px] transition-colors",
                  kidActive
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-foreground hover:bg-sidebar-accent/50",
                )}
              >
                {c.label}
              </Link>
            );
          });
          const link = (
            <Link
              to={item.to}
              onClick={() => {
                setExpanded(item.label);
                onNavigate();
              }}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              aria-expanded={kids.length ? open : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && kids.length > 0 && (
                <ChevronDown
                  className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")}
                />
              )}
            </Link>
          );
          return (
            <div key={item.label}>
              {collapsed ? (
                kids.length > 0 ? (
                  <CollapsedSubmenu item={item} active={active}>
                    {childLinks}
                  </CollapsedSubmenu>
                ) : (
                  <NameTip label={item.label}>{link}</NameTip>
                )
              ) : (
                link
              )}
              {open && <div className="ml-5 mt-1 space-y-0.5 border-l pl-3">{childLinks}</div>}
            </div>
          );
        })}
        <Separator className="my-2" />
        {!collapsed && (
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Em breve
          </p>
        )}
        {SOON.map((item) => (
          <NameTip key={item.label} label={`${item.label} — em breve`}>
            <span
              title={`${item.label} — em breve`}
              aria-disabled
              className={cn(
                "flex min-h-10 cursor-default select-none items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/70",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </span>
          </NameTip>
        ))}
      </nav>
      <div className="space-y-1 border-t px-2 py-3">
        <NameTip label="Central de Ajuda — em breve">
          <span
            title="Central de Ajuda — em breve"
            aria-disabled
            className="flex min-h-10 cursor-default select-none items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/70"
          >
            <HelpCircle className="size-4 shrink-0" />
            {!collapsed && <span>Central de Ajuda</span>}
          </span>
        </NameTip>
        {onToggleCollapse && (
          <NameTip label={collapsed ? "Expandir menu" : "Recolher menu"}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className={cn(
                "w-full gap-3 text-muted-foreground",
                collapsed ? "justify-center px-0" : "justify-start",
              )}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? (
                <ChevronsRight className="size-4" />
              ) : (
                <ChevronsLeft className="size-4" />
              )}
              {!collapsed && "Recolher menu"}
            </Button>
          </NameTip>
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const currentTab = useRouterState({
    select: (state) => (state.location.search as { tab?: "agenda" | "oficina" }).tab,
  });

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
    <TooltipProvider delayDuration={200}>
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
          <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 border-b bg-card px-4 py-2 lg:px-6">
            <NameTip label="Abrir menu" side="bottom">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="size-5" />
              </Button>
            </NameTip>
            <Breadcrumb className="min-w-0 flex-1 sm:flex-initial">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="hidden sm:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">ANPEXC</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((crumb, index) => (
                  <span key={`${crumb.label}-${index}`} className="contents">
                    <BreadcrumbSeparator className={index === 0 ? "hidden sm:block" : undefined} />
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
            <div className="flex shrink-0 items-center justify-end gap-1 whitespace-nowrap sm:min-w-0 sm:flex-1">
              {me?.role && me.role !== "oficina" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:inline-flex"
                  title="Novo agendamento"
                  onClick={() => void navigate({ to: "/", search: { acao: "novo" } })}
                >
                  <Plus /> <span className="hidden xl:inline">Novo agendamento</span>
                </Button>
              )}
              {me?.role && me.role !== "oficina" && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="hidden md:inline-flex"
                  title="Nova O.S."
                >
                  <Link to="/ordens-servico/nova">
                    <ClipboardPlus /> <span className="hidden xl:inline">Nova O.S.</span>
                  </Link>
                </Button>
              )}
              {me?.role && <QuickCheckInButton compact />}
              {me?.role === "master" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:inline-flex"
                  title="Configurações"
                  onClick={() =>
                    void navigate({
                      to: "/",
                      search: { acao: "config", tab: pathname === "/" ? currentTab : undefined },
                    })
                  }
                >
                  <Settings /> <span className="hidden xl:inline">Configurações</span>
                </Button>
              )}
              <div id="topbar-actions" className="flex items-center gap-1" />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NameTip label="Buscar (Ctrl+K)" side="bottom">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchOpen(true)}
                  className="size-9 p-0 text-foreground"
                  aria-label="Buscar (Ctrl+K)"
                >
                  <Search className="size-4" />
                </Button>
              </NameTip>
              <NameTip
                label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
                side="bottom"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
                >
                  {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
              </NameTip>
              <DropdownMenu>
                <NameTip label="Notificações" side="bottom">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Notificações">
                      <Bell className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </NameTip>
                <DropdownMenuContent align="end" className="w-56">
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    Sem notificações no momento.
                  </p>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <NameTip label="Menu do usuário" side="bottom">
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
                      <span className="hidden text-left 2xl:block">
                        <span className="block max-w-36 truncate text-xs font-semibold leading-tight">
                          {name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">{roleLabel}</span>
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                </NameTip>
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
              <NameTip label="Sair" side="bottom">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void signOut()}
                  aria-label="Sair"
                >
                  <LogOut className="size-4" />
                </Button>
              </NameTip>
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
    </TooltipProvider>
  );
}
