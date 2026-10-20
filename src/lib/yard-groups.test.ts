import { describe, it, expect } from "vitest";
import { itemsInGroup, validGroupName } from "./yard-groups";
import { checkInExportRows, checkInOrigin } from "./check-in-log";
describe("grupos de pátio", () => {
  it("filtra pelos locais do grupo sem caixa/acento e conta placa uma vez", () => {
    const items = [
      { workshop: "Oficina Arraís", plate: "ABC-1234" },
      { workshop: "OFICINA ARRAIS", plate: "ABC1234" },
      { workshop: "Pintura X", plate: "DEF1234" },
    ];
    expect(itemsInGroup(items, { workshopNames: ["oficina arrais"] })).toHaveLength(1);
  });
  it("exige nome", () => {
    expect(validGroupName(" ")).toBe(false);
    expect(validGroupName("Pátios Arrais")).toBe(true);
  });
});
describe("check-ins", () => {
  it("avulso sem agendamento e exportação protege fórmula", () => {
    expect(checkInOrigin({ appointment_id: null })).toBe("Avulso");
    const [r] = checkInExportRows([{ id: "1", type: "saida", occurred_at: "x", plate: "=ABC", note: null, photo_url: null, appointment_id: "a", os_number: 5, workshop_name: null, user_name: null }]);
    expect(r!.Tipo).toBe("Saída");
    expect(r!["Data/hora"]).toBe("—");
    expect(String(r!.Placa).startsWith("=")).toBe(false);
  });
});
