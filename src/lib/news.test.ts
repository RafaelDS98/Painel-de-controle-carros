import { describe, expect, it } from "vitest";
import { embedUrl, moveItem, normalizeWidgets, relativeTime } from "./news";

describe("notícias", () => {
  it("normaliza painéis sem repetir e completa os faltantes", () => {
    expect(normalizeWidgets(["resumo", "resumo", "x"])).toEqual([
      "resumo",
      "destaques",
      "noticias",
      "atalhos",
    ]);
  });
  it("arrastar move o painel para a nova posição", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
  it("tempo relativo", () => {
    const now = Date.parse("2026-10-21T12:00:00Z");
    expect(relativeTime("2026-10-21T09:00:00Z", now)).toBe("Há 3 horas");
    expect(relativeTime("ruim", now)).toBe("—");
  });
  it("incorpora YouTube", () => {
    expect(embedUrl("https://youtu.be/abcdefg")).toBe("https://www.youtube.com/embed/abcdefg");
  });
});
