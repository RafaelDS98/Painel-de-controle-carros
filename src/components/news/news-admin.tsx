import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyPermissions } from "@/lib/permissions";
import { relativeTime, useNewsPosts, type NewsPost } from "@/lib/news";
import { NewsEditor } from "./news-editor";
import { NewsImage } from "./news-parts";

export function NewsAdmin({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const can = (k: string) => perms.data?.has(k) ?? false;
  const posts = useNewsPosts();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [open, setOpen] = useState(false);
  const q = search.trim().toLowerCase();
  const list = (posts.data ?? []).filter(
    (p) => !q || `${p.title} ${p.kicker} ${p.category}`.toLowerCase().includes(q),
  );

  async function remove(p: NewsPost) {
    if (!window.confirm(`Excluir a notícia "${p.title}"?`)) return;
    const { error } = await supabase.from("news_posts").delete().eq("id", p.id);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    const files = [p.image_path, p.video_path].filter((x): x is string => !!x);
    if (files.length) await supabase.storage.from("noticias").remove(files);
    await qc.invalidateQueries({ queryKey: ["news-posts"] });
    toast.success("Notícia excluída");
  }

  return (
    <main className="mx-auto max-w-[1200px] space-y-4 px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notícias</h1>
          <p className="text-sm text-muted-foreground">
            Publique comunicados e novidades que aparecem na Home, organizados por data.
          </p>
        </div>
        {can("action.news_create") && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Nova notícia
          </Button>
        )}
      </div>
      <Input
        placeholder="Buscar por manchete, chapéu ou editoria"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {posts.isError ? (
        <p className="text-destructive">Não foi possível carregar as notícias.</p>
      ) : posts.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !list.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma notícia encontrada.</p>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {list.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md">
                <NewsImage post={p} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  {relativeTime(p.published_at)} · {p.category}
                  {p.featured && " · Destaque"}
                  {!p.published && " · Rascunho"}
                </p>
              </div>
              {can("action.news_edit") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                >
                  <Pencil className="size-4" /> Editar
                </Button>
              )}
              {can("action.news_delete") && (
                <Button size="sm" variant="outline" onClick={() => void remove(p)}>
                  <Trash2 className="size-4" /> Excluir
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <NewsEditor open={open} post={editing} userId={userId} onClose={() => setOpen(false)} />
    </main>
  );
}
