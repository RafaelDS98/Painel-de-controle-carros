import { guardFormula } from "@/lib/agenda-safety";

export interface CheckInRow {
  id: string;
  type: string;
  occurred_at: string;
  plate: string | null;
  note: string | null;
  photo_url: string | null;
  appointment_id: string | null;
  os_number: number | null;
  workshop_name: string | null;
  user_name: string | null;
}

export const checkInTypeLabel = (t: string) =>
  t === "entrada" ? "Entrada" : t === "saida" ? "Saída" : "—";

export const checkInOrigin = (r: Pick<CheckInRow, "appointment_id">) =>
  r.appointment_id ? "Agendamento" : "Avulso";

export function formatCheckInDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Linhas para exportação, com proteção contra fórmulas. */
export function checkInExportRows(rows: CheckInRow[]) {
  return rows.map((r) => ({
    "Data/hora": formatCheckInDate(r.occurred_at),
    Tipo: checkInTypeLabel(r.type),
    Placa: guardFormula(r.plate ?? ""),
    Local: guardFormula(r.workshop_name ?? ""),
    Origem: checkInOrigin(r),
    "O.S.": r.os_number ?? "",
    Usuário: guardFormula(r.user_name ?? "Usuário excluído"),
    Observação: guardFormula(r.note ?? ""),
    Foto: r.photo_url ? "Sim" : "Não",
  }));
}
