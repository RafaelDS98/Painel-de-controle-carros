import { describe, it, expect } from "vitest";
import { canCreateVehicle, importFleetRow, matchesFleet } from "./fleet";
describe("frota", () => {
  it("Master cadastra", () => expect(canCreateVehicle("master")).toBe(true));
  it("Gerente cadastra", () => expect(canCreateVehicle("gerente")).toBe(true));
  it("Atendimento não cadastra", () => expect(canCreateVehicle("atendimento")).toBe(false));
  it("Oficina não cadastra", () => expect(canCreateVehicle("oficina")).toBe(false));
  it("normaliza placa e rejeita resumo", () => {
    expect(importFleetRow({ Placa: "ASL-9669" })?.["plate"]).toBe("ASL9669");
    expect(importFleetRow({ Placa: "1146 VEÍCULOS" })).toBeNull();
  });
  it("filtra placa e idade sem inventar ausentes", () => {
    expect(
      matchesFleet(
        { plate: "ASL-9669", extra_data: { "Idade (meses)": 24 } },
        { plate: "asl9669", idade: "12" },
      ),
    ).toBe(true);
    expect(matchesFleet({ plate: "ASL9669" }, { idade: "12" })).toBe(false);
  });
});
