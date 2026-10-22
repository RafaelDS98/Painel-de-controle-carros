/** Indicadores da Página inicial de Vistorias (dias no fuso America/Sao_Paulo). */
export interface StatRow {
  plate: string;
  inspector_id: string;
  damage_count: number;
  created_at: string;
  status: string;
}

export const spDay = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function inspectionStats(rows: StatRow[], now: Date) {
  const valid = rows.filter((r) => r.status !== "cancelada");
  const today = spDay(now);
  const month = today.slice(0, 7);
  const inMonth = valid.filter((r) => spDay(r.created_at).startsWith(month));
  const byInspector = new Map<string, number>();
  inMonth.forEach((r) =>
    byInspector.set(r.inspector_id, (byInspector.get(r.inspector_id) ?? 0) + 1),
  );
  const days: { day: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = spDay(new Date(now.getTime() - i * 86400_000));
    days.push({ day: d, total: valid.filter((r) => spDay(r.created_at) === d).length });
  }
  return {
    today: valid.filter((r) => spDay(r.created_at) === today).length,
    month: inMonth.length,
    vehicles: new Set(inMonth.map((r) => r.plate)).size,
    inspectors: byInspector.size,
    withDamage: inMonth.filter((r) => r.damage_count > 0).length,
    top: [...byInspector].sort((a, b) => b[1] - a[1]).slice(0, 5),
    days,
  };
}
