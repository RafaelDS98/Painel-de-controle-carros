import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NewsPost = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  body: string;
  category: string;
  related: string[];
  image_path: string | null;
  video_path: string | null;
  video_url: string | null;
  featured: boolean;
  published: boolean;
  published_at: string;
  sort_order: number;
  created_by: string | null;
};

export const HOME_WIDGETS = {
  destaques: "Destaques",
  noticias: "Últimas notícias",
  resumo: "Resumo da operação",
  atalhos: "Acesso rápido",
} as const;
export type WidgetKey = keyof typeof HOME_WIDGETS;

/** Mantém só painéis conhecidos, sem repetir, e acrescenta os que faltarem no fim. */
export function normalizeWidgets(value: unknown): WidgetKey[] {
  const all = Object.keys(HOME_WIDGETS) as WidgetKey[];
  const list = Array.isArray(value) ? value.filter((v): v is WidgetKey => all.includes(v)) : [];
  const unique = [...new Set(list)];
  return [...unique, ...all.filter((k) => !unique.includes(k))];
}

/** Move um item da posição `from` para `to` (arrastar e soltar). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** "Há 5 minutos", "Há 3 horas", "Ontem", ou a data — igual a portais de notícia. */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "Agora";
  if (min < 60) return `Há ${min} minuto${min === 1 ? "" : "s"}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Há ${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ontem";
  if (d < 7) return `Há ${d} dias`;
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Agrupa por dia (fuso de São Paulo), mais recente primeiro. */
export function groupByDay(posts: NewsPost[]): { day: string; posts: NewsPost[] }[] {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  const sorted = [...posts].sort((a, b) => b.published_at.localeCompare(a.published_at));
  const out: { day: string; posts: NewsPost[] }[] = [];
  for (const p of sorted) {
    const day = fmt(p.published_at);
    const last = out[out.length - 1];
    if (last && last.day === day) last.posts.push(p);
    else out.push({ day, posts: [p] });
  }
  return out;
}

/** Converte link do YouTube/Vimeo em endereço incorporável; outros links ficam como estão. */
export function embedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

export function useNewsPosts() {
  return useQuery({
    queryKey: ["news-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .order("published_at", { ascending: false })
        .range(0, 999);
      if (error) throw error;
      return (data ?? []) as NewsPost[];
    },
  });
}

/** Arquivos ficam em local privado; gera um link temporário para exibir. */
export function useMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["news-media", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("noticias")
        .createSignedUrl(path as string, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
