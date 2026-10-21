import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  ClipboardList,
  GripVertical,
  LayoutDashboard,
  Pencil,
  Plus,
  Save,
  Truck,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMyPermissions } from "@/lib/permissions";
import {
  HOME_WIDGETS,
  groupByDay,
  moveItem,
  normalizeWidgets,
  relativeTime,
  useNewsPosts,
  type NewsPost,
  type WidgetKey,
} from "@/lib/news";
import { NewsArticleDialog, NewsImage, NewsListItem } from "./news-parts";
import { NewsEditor } from "./news-editor";
import { cn } from "@/lib/utils";

function useSummary() {
  return useQuery({
    queryKey: ["home-summary"],
    queryFn: async () => {
      const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
        const r = await q;
        return r.error ? null : (r.count ?? 0);
      };
      const [agenda, veiculos, os] = await Promise.all([
        count(
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .is("archived_at", null),
        ),
        count(supabase.from("vehicles").select("id", { count: "exact", head: true })),
        count(
          supabase
            .from("ordens_servico")
            .select("id", { count: "exact", head: true })
            .is("closed_at", null)
            .is("archived_at", null),
        ),
      ]);
      return { agenda, veiculos, os };
    },
  });
}

function Featured({ posts, onOpen }: { posts: NewsPost[]; onOpen: (p: NewsPost) => void }) {
  const list = posts.filter((p) => p.featured).slice(0, 3);
  if (!list.length)
    return <p className="text-sm text-muted-foreground">Nenhuma notícia marcada como destaque.</p>;
  const [main, ...side] = list;
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {main && (
        <button
          type="button"
          onClick={() => onOpen(main)}
          className="group relative aspect-video overflow-hidden rounded-xl text-left"
        >
          <NewsImage post={main} className="transition-transform group-hover:scale-105" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-5">
            {main.kicker && (
              <p className="text-sm font-medium text-muted-foreground">{main.kicker}</p>
            )}
            <h2 className="text-2xl font-bold leading-tight text-foreground">{main.title}</h2>
            {main.subtitle && <p className="mt-1 text-sm text-foreground/80">{main.subtitle}</p>}
          </div>
        </button>
      )}
      <div className="grid gap-4">
        {side.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p)}
            className="group grid grid-cols-[120px_1fr] gap-3 text-left"
          >
            <div className="aspect-video overflow-hidden rounded-lg">
              <NewsImage post={p} className="transition-transform group-hover:scale-105" />
            </div>
            <div>
              <h3 className="font-bold leading-tight text-primary group-hover:underline">
                {p.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{relativeTime(p.published_at)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, to, icon: Icon }: {
  label: string;
  value: number | null | undefined;
  to: "/" | "/veiculos" | "/ordens-servico";
  icon: typeof Truck;
}) {
  return (
    <Link to={to} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
      <Icon className="size-5 text-primary" />
      <p className="mt-2 text-2xl font-bold">{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}

export function HomePage({ userId, userName }: { userId: string; userName: string }) {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const can = (k: string) => perms.data?.has(k) ?? false;
  const posts = useNewsPosts();
  const summary = useSummary();
  const layout = useQuery({
    queryKey: ["home-layout"],
    queryFn: async () => {
      const { data, error } = await supabase.from("home_layout").select("widgets").maybeSingle();
      if (error) throw error;
      return normalizeWidgets(data?.widgets);
    },
  });
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<WidgetKey[]>(normalizeWidgets(null));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [open, setOpen] = useState<NewsPost | null>(null);
  const [editor, setEditor] = useState(false);
  useEffect(() => {
    if (layout.data && !editing) setOrder(layout.data);
  }, [layout.data, editing]);

  async function saveLayout() {
    const { error } = await supabase
      .from("home_layout")
      .update({ widgets: order, updated_by: userId, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) {
      toast.error("Não foi possível salvar a organização.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["home-layout"] });
    setEditing(false);
    toast.success("Organização da Home salva para todos");
  }

  const list = (posts.data ?? []).filter((p) => p.published);
  const hour = Number(
    new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }),
  );
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const widgets: Record<WidgetKey, ReactNode> = {
    destaques: <Featured posts={list} onOpen={setOpen} />,
    noticias: posts.isError ? (
      <p className="text-sm text-destructive">Não foi possível carregar as notícias.</p>
    ) : !list.length ? (
      <p className="text-sm text-muted-foreground">
        {posts.isLoading ? "Carregando…" : "Nenhuma notícia publicada ainda."}
      </p>
    ) : (
      <div className="space-y-4">
        {groupByDay(list).map((g) => (
          <section key={g.day}>
            <p className="border-b pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.day}
            </p>
            {g.posts.map((p) => (
              <NewsListItem key={p.id} post={p} onOpen={() => setOpen(p)} />
            ))}
          </section>
        ))}
      </div>
    ),
    resumo: (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Agendamentos ativos" value={summary.data?.agenda} to="/" icon={CalendarClock} />
        <Stat label="Veículos na frota" value={summary.data?.veiculos} to="/veiculos" icon={Truck} />
        <Stat label="O.S. em aberto" value={summary.data?.os} to="/ordens-servico" icon={ClipboardList} />
      </div>
    ),
    atalhos: (
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link to="/"><CalendarClock className="size-4" />Agenda</Link></Button>
        <Button asChild variant="outline"><Link to="/dashboard"><LayoutDashboard className="size-4" />Dashboard</Link></Button>
        <Button asChild variant="outline"><Link to="/ordens-servico"><ClipboardList className="size-4" />Ordens de Serviço</Link></Button>
        <Button asChild variant="outline"><Link to="/veiculos"><Truck className="size-4" />Veículos</Link></Button>
      </div>
    ),
  };

  return (
    <main className="mx-auto max-w-[1200px] space-y-6 px-5 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Portal ANPEXC
          </p>
          <h1 className="text-3xl font-bold">
            {greet}, {userName.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">Informações gerais e novidades da empresa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("action.news_create") && (
            <Button onClick={() => setEditor(true)}>
              <Plus className="size-4" /> Nova notícia
            </Button>
          )}
          {can("action.home_layout") &&
            (editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  <X className="size-4" /> Cancelar
                </Button>
                <Button onClick={() => void saveLayout()}>
                  <Save className="size-4" /> Salvar organização
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Organizar painéis
              </Button>
            ))}
        </div>
      </header>
      {editing && (
        <p className="rounded-lg border border-dashed border-primary bg-primary/5 p-3 text-sm">
          Clique e arraste os painéis pela alça para mudar a ordem. A organização vale para todos.
        </p>
      )}
      {order.map((key, i) => (
        <section
          key={key}
          draggable={editing}
          onDragStart={() => setDragFrom(i)}
          onDragOver={(e) => editing && e.preventDefault()}
          onDrop={() => {
            if (dragFrom !== null) setOrder((o) => moveItem(o, dragFrom, i));
            setDragFrom(null);
          }}
          className={cn(
            "rounded-xl border bg-card p-5",
            editing && "cursor-move border-dashed border-primary",
            dragFrom === i && "opacity-50",
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            {editing && <GripVertical className="size-4 text-muted-foreground" />}
            <h2 className="text-lg font-semibold">{HOME_WIDGETS[key]}</h2>
            {editing && (
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => setOrder((o) => moveItem(o, i, i - 1))} aria-label="Subir painel">↑</Button>
                <Button size="sm" variant="ghost" disabled={i === order.length - 1} onClick={() => setOrder((o) => moveItem(o, i, i + 1))} aria-label="Descer painel">↓</Button>
              </div>
            )}
          </div>
          {widgets[key]}
        </section>
      ))}
      <NewsArticleDialog post={open} onClose={() => setOpen(null)} />
      <NewsEditor open={editor} post={null} userId={userId} onClose={() => setEditor(false)} />
    </main>
  );
}
