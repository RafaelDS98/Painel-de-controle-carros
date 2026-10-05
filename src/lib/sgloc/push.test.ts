import { describe, expect, it } from "vitest";
import { buildCreateBody, buildUpdateBody, matchSupplier, missingForCreate, pushErrorMessage, readItem, SglocError, todayInSaoPaulo, enumLabel } from "./core";
import { buildAppointmentUpdate } from "@/lib/appointment-update";

const src = { date: "2026-10-10", time: "9:05:00", plate: "abc-1d23", km_scheduled: 1200, contact: "x".repeat(60), contact_number: "(11) 9999", issue: "p".repeat(250), note: "", external_order: "12345678901", supplierId: 7 };

describe("corpo de criação", () => {
  it("monta campos com limites e omite vazios, sem loja/confirmado/realizado", () => {
    const b = buildCreateBody(src, "2026-10-05");
    expect(b).toMatchObject({ data: "2026-10-05", data_agenda: "2026-10-10", hora: "09:05", placa: "ABC1D23", km_agendamento: 1200, fornecedor_id: 7, os_externa: "1234567890" });
    expect(String(b["contato"]).length).toBe(40);
    expect(String(b["problema"]).length).toBe(200);
    expect(b).not.toHaveProperty("obs");
    for (const k of ["loja_id", "confirmado", "realizado"]) expect(b).not.toHaveProperty(k);
    expect(missingForCreate(b)).toBeNull();
  });
  it("aponta obrigatórios ausentes", () => {
    expect(missingForCreate(buildCreateBody({ plate: "AB1" }, "2026-10-05"))).toMatch(/placa.*data do atendimento.*hora/);
  });
  it("data de hoje no fuso de São Paulo", () => {
    expect(todayInSaoPaulo(new Date("2026-10-06T02:00:00Z"))).toBe("2026-10-05");
  });
});

describe("corpo de edição", () => {
  it("só campos enviáveis alterados", () => {
    expect(buildUpdateBody(src, ["time", "status", "priority_urgent", "model", "custom_fields"])).toEqual({ hora: "09:05" });
    expect(buildUpdateBody(src, [])).toEqual({});
    expect(buildUpdateBody({ ...src, supplierId: null }, ["workshop"])).toEqual({});
  });
});

describe("fornecedor e erros", () => {
  it("casa nome ignorando caixa, acentos e espaços", () => {
    expect(matchSupplier("  oficina  mecânica ARRAIS ", [{ supplier_id: 3, name: "OFICINA MECANICA ARRAIS" }])).toBe(3);
    expect(matchSupplier("Outra", [{ supplier_id: 3, name: "X" }])).toBeNull();
  });
  it("mensagens curtas em português", () => {
    expect(pushErrorMessage(new SglocError("validation", "O SGLOC recusou os dados (422): KM inválido", 422))).toMatch(/KM inválido/);
    expect(pushErrorMessage(new SglocError("expired", "x"))).toMatch(/Minha conta/);
  });
  it("confirmado/realizado vazios viram não informado", () => {
    const item = readItem({ confirmado: "", realizado: null });
    expect(enumLabel(item.confirmado)).toBe("não informado");
    expect(enumLabel(item.realizado)).toBe("não informado");
  });
});

describe("salvar único", () => {
  it("Situação + Urgente + campos num só update", () => {
    const u = buildAppointmentUpdate({ status: "Finalizado", priorityUrgent: true, plate: "abc-1d23", note: " ok " }, {}, { canUrgent: true });
    expect(u).toEqual({ status: "Finalizado", priority_urgent: true, plate: "ABC1D23", note: "ok" });
  });
  it("atendimento não grava urgência", () => {
    expect(buildAppointmentUpdate({ priorityUrgent: true, status: "X" }, {}, { canUrgent: false })).toEqual({ status: "X" });
  });
});
