import { describe, expect, it } from "vitest";
import { buildSummaryLines, countHighlights } from "./history-summary";

const ev = (field: string, at: string) => ({ field, oldValue: "a", newValue: "b", at, by: "Ana" });

describe("resumo do histórico", () => {
  it("conta mudanças de data, oficina e situação", () => {
    const events = [
      ev("date", "2026-10-01T10:00:00Z"),
      ev("current_deadline", "2026-10-02T10:00:00Z"),
      ev("workshop", "2026-10-03T10:00:00Z"),
      ev("status", "2026-10-04T10:00:00Z"),
      ev("note", "2026-10-05T10:00:00Z"),
    ];
    expect(countHighlights(events)).toEqual({ data: 2, oficina: 1, situacao: 1 });
  });

  it("ordena do mais antigo e marca destaques", () => {
    const lines = buildSummaryLines(
      [ev("note", "2026-10-02T10:00:00Z"), ev("status", "2026-10-01T10:00:00Z")],
      { status: "Situação" },
    );
    expect(lines[0]).toMatch(/^\[DESTAQUE\].*Situação: a → b$/);
    expect(lines[1]).not.toMatch(/DESTAQUE/);
  });
});
