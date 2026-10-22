import { describe, expect, it } from "vitest";
import { inspectionStats } from "./vistoria-stats";

const now = new Date("2026-10-22T15:00:00Z"); // 12h em São Paulo
const r = (plate: string, who: string, at: string, damage = 0, status = "concluida") => ({
  plate,
  inspector_id: who,
  damage_count: damage,
  created_at: at,
  status,
});

describe("inspectionStats", () => {
  it("conta hoje pelo dia de São Paulo e ignora canceladas", () => {
    const s = inspectionStats(
      [
        r("AAA", "u1", "2026-10-22T10:00:00Z"),
        r("BBB", "u1", "2026-10-22T02:00:00Z"), // 21/10 23h em SP
        r("CCC", "u2", "2026-10-22T12:00:00Z", 2, "cancelada"),
        r("AAA", "u2", "2026-10-05T12:00:00Z", 1),
      ],
      now,
    );
    expect(s.today).toBe(1);
    expect(s.month).toBe(3);
    expect(s.vehicles).toBe(2);
    expect(s.withDamage).toBe(1);
    expect(s.top[0]).toEqual(["u1", 2]);
    expect(s.days.at(-1)).toEqual({ day: "2026-10-22", total: 1 });
    expect(s.days.at(-2)).toEqual({ day: "2026-10-21", total: 1 });
  });
});
