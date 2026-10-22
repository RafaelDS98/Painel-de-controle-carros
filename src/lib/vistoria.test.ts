import { describe, expect, it } from "vitest";
import { countDamages, diffAnswers, missingRequired, progress, type InspectionField } from "./vistoria";

const fields: InspectionField[] = [
  { id: "a", label: "Lataria", kind: "check", required: true },
  { id: "b", label: "Frente", kind: "photo", required: true },
  { id: "c", label: "Estepe", kind: "check", required: false },
];

describe("vistoria", () => {
  it("bloqueia conclusão com obrigatório em branco", () => {
    expect(missingRequired(fields, { a: { status: "bom" } }).map((f) => f.id)).toEqual(["b"]);
    expect(missingRequired(fields, { a: { status: "na" }, b: { photo: "x" } })).toEqual([]);
  });
  it("conta Ruim e Atenção como avaria", () => {
    expect(countDamages({ a: { status: "ruim" }, b: { status: "atencao" }, c: { status: "bom" } })).toBe(2);
  });
  it("calcula progresso", () => {
    expect(progress(fields, { a: { status: "bom" } })).toBe(33);
  });
  it("aponta itens que mudaram entre entrega e devolução", () => {
    const d = diffAnswers(
      [{ label: "Lataria", status: "bom" }, { label: "Pneus", status: "bom" }],
      [{ label: "Lataria", status: "ruim" }, { label: "Pneus", status: "bom" }],
    );
    expect([...d]).toEqual(["Lataria"]);
  });
});
