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
export interface StampedPhoto {
  photo: string;
  photoName: string;
  photoAt: string;
}

/** Nome de arquivo legível: CAMPO_ddmmaaaa_hhmmss.jpg */
export function photoFileName(label: string, at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
  return `${slug}_${p(at.getDate())}${p(at.getMonth() + 1)}${at.getFullYear()}_${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.jpg`;
}

export async function compressPhoto(file: File, label: string): Promise<StampedPhoto> {
  const at = new Date();
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
    const stamp = at.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(",", "");
    const size = Math.max(18, Math.round(c.width / 36));
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;
    ctx.fillText(label.toUpperCase(), c.width - 12, c.height - size * 1.4 - 10);
    ctx.fillText(stamp, c.width - 12, c.height - 10);
    return {
      photo: c.toDataURL("image/jpeg", 0.75),
      photoName: photoFileName(label, at),
      photoAt: at.toISOString(),
    };
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
