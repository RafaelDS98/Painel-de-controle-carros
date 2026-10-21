import { describe, expect, it } from "vitest";
import { pickRegisteredPlate, plateSearchTerm, toggleId } from "./plate-pick";

const opts = [{ plate: "OTO4403", status: "Ativo", prefixo: null, ano: 14, modelo: "UNO" }];

describe("placa só do cadastro", () => {
  it("aceita placa cadastrada mesmo digitada com hífen", () => {
    expect(pickRegisteredPlate("oto-4403", opts)?.plate).toBe("OTO4403");
  });
  it("rejeita placa inexistente", () => {
    expect(pickRegisteredPlate("ABC1234", opts)).toBeNull();
  });
  it("busca exige 2 caracteres", () => {
    expect(plateSearchTerm("O")).toBeNull();
    expect(plateSearchTerm("ot-")).toBe("OT");
  });
  it("seleção em lote não duplica", () => {
    expect(toggleId(["a"], "a", true)).toEqual(["a"]);
    expect(toggleId(["a", "b"], "a", false)).toEqual(["b"]);
  });
});
