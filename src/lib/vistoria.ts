/** Regras puras do checklist de vistoria (reaproveitáveis pelo futuro app). */
export type CheckStatus = "bom" | "ruim" | "atencao" | "na";
export type FieldKind = "check" | "photo" | "text" | "number";

export interface InspectionField {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
}

export interface AnswerDraft {
  status?: CheckStatus | undefined;
  value?: string | undefined;
  photo?: string | undefined; // dataURL comprimida enquanto não enviada
  note?: string | undefined;
  photoName?: string | undefined;
  photoAt?: string | undefined; // ISO da captura
}

export const STATUS_LABEL: Record<CheckStatus, string> = {
  bom: "Bom",
  ruim: "Ruim",
  atencao: "Atenção",
  na: "N/A",
};

export function isAnswered(field: InspectionField, a: AnswerDraft | undefined): boolean {
  if (!a) return false;
  if (field.kind === "check") return !!a.status;
  if (field.kind === "photo") return !!a.photo;
  return !!a.value?.trim();
}

/** Campos obrigatórios ainda em branco. */
export function missingRequired(
  fields: InspectionField[],
  answers: Record<string, AnswerDraft>,
): InspectionField[] {
  return fields.filter((f) => f.required && !isAnswered(f, answers[f.id]));
}

/** Avaria = item marcado Ruim ou Atenção. */
export function countDamages(answers: Record<string, AnswerDraft>): number {
  return Object.values(answers).filter((a) => a.status === "ruim" || a.status === "atencao").length;
}

export function progress(fields: InspectionField[], answers: Record<string, AnswerDraft>): number {
  if (!fields.length) return 0;
  return Math.round(
    (fields.filter((f) => isAnswered(f, answers[f.id])).length / fields.length) * 100,
  );
}

/** Itens com estado diferente entre duas vistorias (por rótulo), para achar avaria nova. */
export function diffAnswers(
  a: { label: string; status: string | null }[],
  b: { label: string; status: string | null }[],
): Set<string> {
  const map = new Map(a.map((x) => [x.label, x.status]));
  return new Set(b.filter((x) => x.status && map.get(x.label) !== x.status).map((x) => x.label));
}
