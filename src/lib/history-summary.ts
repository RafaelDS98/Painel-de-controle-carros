/** Regras puras do resumo de alterações por atendimento (sem IA). */
export type SummaryEvent = {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  at: string;
  by: string | null;
};

export type HighlightKind = "data" | "oficina" | "situacao";

const KIND_BY_FIELD: Record<string, HighlightKind> = {
  date: "data",
  time: "data",
  original_deadline: "data",
  current_deadline: "data",
  workshop: "oficina",
  workshop_id: "oficina",
  status: "situacao",
};

export function highlightKind(field: string): HighlightKind | null {
  return KIND_BY_FIELD[field] ?? null;
}

/** Quantas mudanças de data, oficina e situação o atendimento teve. */
export function countHighlights(events: SummaryEvent[]): Record<HighlightKind, number> {
  const out: Record<HighlightKind, number> = { data: 0, oficina: 0, situacao: 0 };
  for (const e of events) {
    const kind = highlightKind(e.field);
    if (kind) out[kind] += 1;
  }
  return out;
}

const clean = (v: string | null) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 200) : "(vazio)";
};

/** Linhas cronológicas enviadas à IA; destaques marcados com [DESTAQUE]. Limita a 300 eventos. */
export function buildSummaryLines(events: SummaryEvent[], labels: Record<string, string>): string[] {
  return [...events]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-300)
    .map((e) => {
      const when = new Date(e.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const mark = highlightKind(e.field) ? "[DESTAQUE] " : "";
      const who = e.by || "Sincronização SGLOC ou usuário excluído";
      return `${mark}${when} · ${who} · ${labels[e.field] ?? e.field}: ${clean(e.oldValue)} → ${clean(e.newValue)}`;
    });
}
