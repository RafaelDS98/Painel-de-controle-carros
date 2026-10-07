import { describe, expect, it } from "vitest";
import { activeAdvancedCount, buildAdvancedFields, matchesAdvanced, sanitizeAdvanced, setAdvancedText, toggleAdvancedValue, URGENT_KEY } from "./advanced-filter";

const defs = [
  { field_key: "workshop", label: "Local/Oficina", field_type: "select", storage: "column", visible: true },
  { field_key: "current_deadline", label: "Previsão", field_type: "date", storage: "column", visible: true },
  { field_key: "note", label: "Observação", field_type: "textarea", storage: "column", visible: true },
  { field_key: "mecanico", label: "Mecânico", field_type: "text", storage: "custom", visible: true },
  { field_key: "oculto", label: "Oculto", field_type: "text", storage: "custom", visible: false },
];
const fields = buildAdvancedFields(defs);
const row = (extra: Record<string, unknown> = {}) => ({ status: "Recebido", workshop: "Arrais", note: "Troca de óleo", priorityUrgent: false, customFields: { mecanico: "Renato" }, ...extra });

describe("advanced-filter", () => {
  it("gera campos dos cadastrados visíveis, sem datas", () => {
    expect(fields.map((f) => f.key)).toEqual(["status", URGENT_KEY, "workshop", "note", "custom:mecanico"]);
  });
  it("OU dentro do campo e E entre campos, sem diferenciar acento/caixa", () => {
    const f = toggleAdvancedValue(toggleAdvancedValue({}, "workshop", "arrais"), "workshop", "Fenix");
    expect(matchesAdvanced(row(), f, fields)).toBe(true);
    expect(matchesAdvanced(row({ workshop: "Outra" }), f, fields)).toBe(false);
    expect(matchesAdvanced(row(), { ...f, "custom:mecanico": ["Outro"] }, fields)).toBe(false);
  });
  it("texto livre, vazio e urgência", () => {
    expect(matchesAdvanced(row(), setAdvancedText({}, "note", "OLEO"), fields)).toBe(true);
    expect(matchesAdvanced(row({ workshop: "" }), { workshop: ["(sem valor)"] }, fields)).toBe(true);
    expect(matchesAdvanced(row({ priorityUrgent: true }), { [URGENT_KEY]: ["Urgente"] }, fields)).toBe(true);
    expect(matchesAdvanced(row(), { [URGENT_KEY]: ["Urgente"] }, fields)).toBe(false);
  });
  it("desmarcar o último valor remove o filtro; lixo salvo é ignorado", () => {
    const on = toggleAdvancedValue({}, "workshop", "Arrais");
    expect(activeAdvancedCount(on)).toBe(1);
    expect(toggleAdvancedValue(on, "workshop", "Arrais")).toEqual({});
    expect(sanitizeAdvanced({ workshop: ["A", 3], velho: ["x"], note: "x" }, fields)).toEqual({ workshop: ["A"] });
    expect(sanitizeAdvanced(null, fields)).toEqual({});
  });
});
