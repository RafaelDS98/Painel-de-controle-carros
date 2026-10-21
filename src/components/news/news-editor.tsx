import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NewsPost } from "@/lib/news";

type Draft = {
  kicker: string;
  title: string;
  subtitle: string;
  body: string;
  category: string;
  related: string;
  video_url: string;
  featured: boolean;
  published: boolean;
  published_at: string;
};

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

function emptyDraft(post: NewsPost | null): Draft {
  return {
    kicker: post?.kicker ?? "",
    title: post?.title ?? "",
    subtitle: post?.subtitle ?? "",
    body: post?.body ?? "",
    category: post?.category ?? "Geral",
    related: (post?.related ?? []).join("\n"),
    video_url: post?.video_url ?? "",
    featured: post?.featured ?? false,
    published: post?.published ?? true,
    published_at: toLocalInput(post?.published_at ?? new Date().toISOString()),
  };
}

async function upload(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("noticias")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export function NewsEditor({
  open,
  post,
  userId,
  onClose,
}: {
  open: boolean;
  post: NewsPost | null;
  userId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(emptyDraft(post));
  const [image, setImage] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setD(emptyDraft(post));
      setImage(null);
      setVideo(null);
      setRemoveImage(false);
      setRemoveVideo(false);
    }
  }, [open, post]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!d.title.trim()) {
      toast.error("Informe a manchete.");
      return;
    }
    setSaving(true);
    try {
      const image_path = image
        ? await upload(image, "imagens")
        : removeImage
          ? null
          : (post?.image_path ?? null);
      const video_path = video
        ? await upload(video, "videos")
        : removeVideo
          ? null
          : (post?.video_path ?? null);
      const when = new Date(d.published_at);
      const row = {
        kicker: d.kicker.trim(),
        title: d.title.trim(),
        subtitle: d.subtitle.trim(),
        body: d.body,
        category: d.category.trim() || "Geral",
        related: d.related
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        video_url: d.video_url.trim() || null,
        featured: d.featured,
        published: d.published,
        published_at: Number.isFinite(when.getTime())
          ? when.toISOString()
          : new Date().toISOString(),
        image_path,
        video_path,
        updated_at: new Date().toISOString(),
      };
      const res = post
        ? await supabase.from("news_posts").update(row).eq("id", post.id)
        : await supabase.from("news_posts").insert({ ...row, created_by: userId });
      if (res.error) throw res.error;
      await qc.invalidateQueries({ queryKey: ["news-posts"] });
      toast.success(post ? "Notícia atualizada" : "Notícia publicada");
      onClose();
    } catch {
      toast.error("Não foi possível salvar. Confira sua permissão e o tamanho dos arquivos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post ? "Editar notícia" : "Nova notícia"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label>Chapéu (acima da manchete)</Label>
              <Input
                value={d.kicker}
                onChange={(e) => set("kicker", e.target.value)}
                placeholder="Ex.: Frota"
              />
            </div>
            <div className="grid gap-1">
              <Label>Editoria</Label>
              <Input
                value={d.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Ex.: Comunicados"
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Manchete *</Label>
            <Input value={d.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Linha fina (subtítulo)</Label>
            <Input value={d.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Texto</Label>
            <Textarea rows={6} value={d.body} onChange={(e) => set("body", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Chamadas relacionadas (uma por linha)</Label>
            <Textarea
              rows={2}
              value={d.related}
              onChange={(e) => set("related", e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label>Imagem de capa</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
              {post?.image_path && !image && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={removeImage}
                    onChange={(e) => setRemoveImage(e.target.checked)}
                  />
                  Remover imagem atual
                </label>
              )}
            </div>
            <div className="grid gap-1">
              <Label>Vídeo (arquivo até 200 MB)</Label>
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
              />
              {post?.video_path && !video && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={removeVideo}
                    onChange={(e) => setRemoveVideo(e.target.checked)}
                  />
                  Remover vídeo atual
                </label>
              )}
            </div>
          </div>
          <div className="grid gap-1">
            <Label>Ou link de vídeo (YouTube/Vimeo)</Label>
            <Input
              value={d.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="https://youtu.be/..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div className="grid gap-1">
              <Label>Data de publicação</Label>
              <Input
                type="datetime-local"
                value={d.published_at}
                onChange={(e) => set("published_at", e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={d.featured} onCheckedChange={(v) => set("featured", v)} />
              Destaque
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={d.published} onCheckedChange={(v) => set("published", v)} />
              Publicada
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
