// Planilhas exportadas pelo SGLOC declaram dimensão errada (ex.: A1:C1); sempre recalcular o !ref antes de ler.
type Cell = { r: number; c: number };
type Range = { s: Cell; e: Cell };
export type SheetRangeUtils = {
  decode_cell: (address: string) => Cell;
  decode_range: (ref: string) => Range;
  encode_range: (range: Range) => string;
};

/** Amplia sheet["!ref"] para cobrir as células realmente presentes. Nunca lança erro. */
export function fixSheetRange(sheet: Record<string, unknown> | undefined | null, utils: SheetRangeUtils): void {
  try {
    if (!sheet) return;
    let found: Range | null = null;
    for (const key of Object.keys(sheet)) {
      if (key.startsWith("!")) continue;
      const cell = utils.decode_cell(key);
      if (!Number.isInteger(cell.r) || !Number.isInteger(cell.c) || cell.r < 0 || cell.c < 0) continue;
      if (!found) found = { s: { ...cell }, e: { ...cell } };
      else {
        found.s.r = Math.min(found.s.r, cell.r); found.s.c = Math.min(found.s.c, cell.c);
        found.e.r = Math.max(found.e.r, cell.r); found.e.c = Math.max(found.e.c, cell.c);
      }
    }
    if (!found) return;
    const declared = typeof sheet["!ref"] === "string" ? utils.decode_range(sheet["!ref"] as string) : null;
    if (!declared) { sheet["!ref"] = utils.encode_range(found); return; }
    const merged: Range = {
      s: { r: Math.min(declared.s.r, found.s.r), c: Math.min(declared.s.c, found.s.c) },
      e: { r: Math.max(declared.e.r, found.e.r), c: Math.max(declared.e.c, found.e.c) },
    };
    const bigger = merged.s.r < declared.s.r || merged.s.c < declared.s.c || merged.e.r > declared.e.r || merged.e.c > declared.e.c;
    if (bigger) sheet["!ref"] = utils.encode_range(merged);
  } catch {
    // Mantém a faixa declarada se algo inesperado ocorrer.
  }
}
