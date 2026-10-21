import { Newspaper, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { embedUrl, relativeTime, useMediaUrl, type NewsPost } from "@/lib/news";
import { cn } from "@/lib/utils";

export function NewsImage({ post, className }: { post: NewsPost; className?: string }) {
  const img = useMediaUrl(post.image_path);
  if (img.data)
    return <img src={img.data} alt="" className={cn("h-full w-full object-cover", className)} />;
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
        className,
      )}
    >
      {post.video_path || post.video_url ? (
        <PlayCircle className="size-10" />
      ) : (
        <Newspaper className="size-10" />
      )}
    </div>
  );
}

export function NewsVideo({ post }: { post: NewsPost }) {
  const file = useMediaUrl(post.video_path);
  if (post.video_path && file.data)
    return <video src={file.data} controls className="w-full rounded-lg bg-muted" />;
  if (post.video_url)
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <iframe
          src={embedUrl(post.video_url)}
          title={post.title}
          className="h-full w-full"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  return null;
}

/** Tags pequenas que apenas classificam a notícia. */
export function NewsTags({ tags, className }: { tags: string[]; className?: string }) {
  if (!tags?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          #{t}
        </span>
      ))}
    </div>
  );
}

/** Item no estilo de portal: imagem à esquerda, chapéu, manchete, linha fina, relacionadas e tempo. */
export function NewsListItem({ post, onOpen }: { post: NewsPost; onOpen: () => void }) {
  return (
    <article className="grid gap-4 border-b py-5 last:border-b-0 sm:grid-cols-[minmax(0,300px)_1fr]">
      <button
        type="button"
        onClick={onOpen}
        className="aspect-video overflow-hidden rounded-lg"
        aria-label={`Abrir notícia: ${post.title}`}
      >
        <NewsImage post={post} className="transition-transform hover:scale-105" />
      </button>
      <div className="min-w-0">
        {post.kicker && <p className="text-sm font-medium text-muted-foreground">{post.kicker}</p>}
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="mt-1 text-xl font-bold leading-tight text-foreground hover:text-link hover:underline">
            {post.title}
          </h3>
        </button>
        {post.subtitle && <p className="mt-1 text-sm text-foreground/80">{post.subtitle}</p>}
        <NewsTags tags={post.related} className="mt-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {relativeTime(post.published_at)} — Em {post.category || "Geral"}
          {!post.published && " · Rascunho"}
        </p>
      </div>
    </article>
  );
}

export function NewsArticleDialog({
  post,
  onClose,
}: {
  post: NewsPost | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4 overflow-y-auto">
        {post && (
          <>
            <DialogHeader className="shrink-0 pr-6 text-left">
              {post.kicker && (
                <p className="text-sm font-medium text-muted-foreground">{post.kicker}</p>
              )}
              <DialogTitle className="text-2xl font-bold leading-tight text-foreground">
                {post.title}
              </DialogTitle>
              {post.subtitle && <p className="text-base text-foreground/80">{post.subtitle}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(post.published_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}{" "}
                — Em {post.category || "Geral"}
              </p>
              <NewsTags tags={post.related} />
            </DialogHeader>
            {post.image_path && (
              <div className="shrink-0 overflow-hidden rounded-lg bg-muted">
                <NewsImage post={post} className="max-h-[60vh] object-contain" />
              </div>
            )}
            <div className="shrink-0">
              <NewsVideo post={post} />
            </div>
            <div className="shrink-0 whitespace-pre-wrap text-sm leading-relaxed">{post.body}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
