// Aviso de agenda desatualizada: falha na carga, carga antiga ou sincronização SGLOC falha/desligada/atrasada.

export type SyncSnapshot = {
  syncLive: boolean;
  /** Rotina de tempo em tempo ligada (sgloc_settings.auto_sync_enabled). */
  autoSyncEnabled: boolean;
  intervalMinutes: number;
  last: { started_at: string | null; status: string; dry_run: boolean; error_detail?: unknown } | null;
  lastRealSuccessAt: string | null;
  accountWarning: string | null;
};

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export const AUTO_OFF_NOTICE = "Atualização automática com o SGLOC desligada — use o botão Atualizar.";

/** Recarga automática da agenda (ms) e idade a partir da qual a carga é considerada desatualizada. */
export const AGENDA_REFRESH_MS = 2 * 60_000;
export const AGENDA_STALE_MS = 10 * 60_000;

export function agendaWarnings(input: { loadedAt: number | null; now: number; loadFailed: boolean; sync: SyncSnapshot | null }): string[] {
  const out: string[] = [];
  const { loadedAt, now, loadFailed, sync } = input;
  if (loadFailed && loadedAt) out.push(`A última atualização da agenda falhou. Os dados mostrados são de ${fmt(new Date(loadedAt).toISOString())}.`);
  else if (!loadFailed && loadedAt && now - loadedAt > AGENDA_STALE_MS) out.push(`A agenda não é atualizada desde ${fmt(new Date(loadedAt).toISOString())}. Recarregue para ver os agendamentos mais recentes.`);
  if (!sync) return out;
  if (!sync.autoSyncEnabled) {
    // Automática desligada: só um aviso neutro se a última atualização real tiver mais de 24 h.
    const ok = sync.lastRealSuccessAt ? Date.parse(sync.lastRealSuccessAt) : NaN;
    if (!Number.isFinite(ok) || now - ok > 24 * 3600_000) out.push(AUTO_OFF_NOTICE);
    return out;
  }
  if (!sync.syncLive) {
    out.push("Sincronização com o SGLOC em modo simulação: nada do SGLOC entra na agenda sozinho. \"Simular agora\" só conta o que seria criado; para gravar, use \"Importar agenda\" ou ative o modo real.");
  } else {
    const realLast = sync.last && !sync.last.dry_run ? sync.last : null;
    if (realLast?.status === "failed") {
      const detail = Array.isArray(realLast.error_detail) ? (realLast.error_detail as { message?: string }[])[0]?.message : undefined;
      out.push(`A última sincronização com o SGLOC falhou${realLast.started_at ? ` (${fmt(realLast.started_at)})` : ""}${detail ? `: ${detail}` : "."}`);
    }
    const ok = sync.lastRealSuccessAt ? Date.parse(sync.lastRealSuccessAt) : NaN;
    if (!Number.isFinite(ok)) out.push("Nenhuma sincronização real com o SGLOC foi concluída ainda.");
    else if (now - ok > 2 * Math.max(15, sync.intervalMinutes) * 60_000) out.push(`Sincronização com o SGLOC atrasada: a última concluída foi em ${fmt(sync.lastRealSuccessAt as string)}.`);
  }
  if (sync.accountWarning) out.push(sync.accountWarning);
  return out;
}

/** Evento de janela disparado quando uma sincronização ou importação termina: a Agenda recarrega na hora. */
export const AGENDA_CHANGED_EVENT = "anpexc:agenda-changed";
export type AgendaChange = { source: "sync" | "simulation" | "import"; inserted?: number; updated?: number };
export function announceAgendaChange(change: AgendaChange) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<AgendaChange>(AGENDA_CHANGED_EVENT, { detail: change }));
}
/** Texto do aviso após a recarga; simulação não grava nada, então não avisa. */
export function agendaChangeToast(change: AgendaChange | null | undefined): string | null {
  if (!change || change.source === "simulation") return null;
  const inserted = Math.max(0, Number(change.inserted) || 0);
  const updated = Math.max(0, Number(change.updated) || 0);
  if (change.source === "sync") return `Agenda atualizada pela sincronização: ${inserted} novo(s), ${updated} alterado(s).`;
  return inserted ? `Agenda atualizada: ${inserted} agendamento(s) entraram.` : null;
}
