import { describe, it, expect } from "vitest";
import {
  splitYardAndExternal,
  elapsedSince,
  formatDuration,
  type YardAppointment,
} from "./yard-utils";
const apt = (id: string, plate: string, workshop: string): YardAppointment => ({
  dbId: id,
  plate,
  workshop,
  model: "",
  brand: "",
  status: "",
  store: "",
  contact: "",
  contactNumber: "",
  issue: "",
  note: "",
  operator: "",
  currentDeadline: null,
  registeredAt: "2026-10-20",
  checkInAt: null,
  checkInNote: null,
  checkInPhotoUrl: null,
  checkInBy: null,
  checkOutAt: null,
  checkOutNote: null,
  checkOutPhotoUrl: null,
  checkOutBy: null,
  osNumber: null,
  priorityUrgent: false,
  lastStatusChangeAt: null,
});
describe("Pátio e externos", () => {
  it("separa por local e mantém situação vazia", () => {
    const r = splitYardAndExternal(
      [apt("1", "ABC1234", "Pátio"), apt("2", "DEF1234", "Externo")],
      [{ name: "Pátio", isOwnYard: true }],
      [],
    );
    expect(r.patio).toHaveLength(1);
    expect(r.externalByWorkshop.get("Externo")).toHaveLength(1);
  });
  it("conta carro uma única vez por placa normalizada", () => {
    const r = splitYardAndExternal(
      [apt("1", "ABC-1234", "Externo"), apt("2", "ABC1234", "Externo")],
      [],
      [],
    );
    expect(r.externalByWorkshop.get("Externo")).toHaveLength(1);
  });
  it("saída retira veículo do serviço", () => {
    const r = splitYardAndExternal(
      [{ ...apt("1", "ABC1234", "Externo"), checkOutAt: "2026-10-20T12:00:00Z" }],
      [],
      [],
    );
    expect(r.externalByWorkshop.size).toBe(0);
  });
  it("não inventa tempo com data inválida", () => {
    expect(elapsedSince("bad", 0)).toBe(0);
    expect(formatDuration(NaN)).toBe("0min");
  });
});
