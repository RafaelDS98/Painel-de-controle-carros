import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FieldKind } from "@/lib/vistoria";

export interface VGroup {
  id: string;
  name: string;
  tab: "campos" | "checklist" | "fotos";
  fields: { id: string; label: string; kind: FieldKind; required: boolean }[];
}

export function useOperationTypes() {
  return useQuery({
    queryKey: ["inspection-optypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_operation_types")
        .select("id,name,base_type")
        .eq("active", true)
        .order("sort");
      if (error) throw error;
      return data;
    },
  });
}

export function useChecklistConfig() {
  return useQuery({
    queryKey: ["inspection-config"],
    queryFn: async (): Promise<VGroup[]> => {
      const [g, f] = await Promise.all([
        supabase
          .from("inspection_groups")
          .select("id,name,tab,sort")
          .eq("active", true)
          .order("sort"),
        supabase
          .from("inspection_fields")
          .select("id,group_id,label,kind,required,sort")
          .eq("active", true)
          .order("sort"),
      ]);
      if (g.error) throw g.error;
      if (f.error) throw f.error;
      return g.data.map((x) => ({
        id: x.id,
        name: x.name,
        tab: x.tab as VGroup["tab"],
        fields: f.data
          .filter((y) => y.group_id === x.id)
          .map((y) => ({
            id: y.id,
            label: y.label,
            kind: y.kind as FieldKind,
            required: y.required,
          })),
      }));
    },
  });
}

/** Reduz a foto no celular antes de enviar (lado maior 1600px, JPEG 0.75) e carimba data/hora. */
export async function compressPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const stamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, c.height - 44, ctx.measureText(stamp).width + 24, 44);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(stamp, 12, c.height - 13);
    return c.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadDataUrl(path: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase.storage
    .from("vistorias")
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return path;
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const list = paths.filter(Boolean);
  if (!list.length) return {};
  const { data } = await supabase.storage.from("vistorias").createSignedUrls(list, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export const BASE_LABEL: Record<string, string> = {
  pre_vistoria: "Pré-vistoria",
  entrega: "Entrega",
  cautelar: "Cautelar",
  coleta: "Coleta",
  coleta_entrega: "Coleta com entrega",
  autoinspecao: "Autoinspeção",
};

export const DRAFT_KEY = "vistoria-rascunho";
