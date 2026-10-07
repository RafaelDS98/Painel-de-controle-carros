import { formatDateTimeBR, guardFormula } from "@/lib/agenda-safety";
import { authorLabel } from "@/lib/normalize";

export type LogExportSource = {
  changed_at: unknown; changed_by: string | null; field_changed: string; old_value: string | null; new_value: string | null;
  profiles: { full_name: string | null } | null; appointments: { plate: string } | null;
};

export const logExportHeaders = ["Data e hora", "Usuário", "Placa", "Campo", "Valor anterior", "Novo valor"];

/** Linhas do log para CSV/XLSX; rótulos dos campos vêm de fora (fixos + personalizados). Protege contra fórmulas. */
export function logExportRows(rows: LogExportSource[], labels: Record<string, string>): Record<string, string>[] {
  return rows.map((row) => ({
    "Data e hora": formatDateTimeBR(row.changed_at),
    Usuário: authorLabel(row.changed_by, row.profiles?.full_name),
    Placa: guardFormula(row.appointments?.plate ?? ""),
    Campo: labels[row.field_changed] ?? row.field_changed,
    "Valor anterior": guardFormula(row.old_value ?? ""),
    "Novo valor": guardFormula(row.new_value ?? ""),
  }));
}

/** Placa de URL → só letras/números maiúsculos (vazio se inválida). */
export function plateFromParam(param: unknown): string {
  return typeof param === "string" ? param.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) : "";
}
