import { describe, expect, it } from "vitest";
import { normalizeHex, statusColorProps, statusColors, NEUTRAL_STATUS_CLASS } from "./agenda-config";

describe("statusColorProps", () => {
  it("token antigo mantém as classes", () => {
    expect(statusColorProps("status-blue")).toEqual({ className: statusColors["status-blue"], style: {} });
  });
  it("cor clara dá texto escuro", () => { expect(statusColorProps("#FFE08A").style.color).toBe("#111827"); });
  it("cor escura dá texto claro", () => { expect(statusColorProps("#1E3A8A").style.color).toBe("#FFFFFF"); });
  it("inválido cai no neutro", () => { expect(statusColorProps("xyz")).toEqual({ className: NEUTRAL_STATUS_CLASS, style: {} }); expect(statusColorProps(null).className).toBe(NEUTRAL_STATUS_CLASS); });
  it("normalizeHex", () => { expect(normalizeHex("abc")).toBe("#AABBCC"); expect(normalizeHex("#1e3a8a")).toBe("#1E3A8A"); expect(normalizeHex("#12")).toBeNull(); });
});
