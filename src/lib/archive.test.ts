import { describe, expect, it } from "vitest";
import { activeOnly, archiveConfirmText, dropExistingReferences } from "./agenda-safety";

describe("lixeira", () => {
  it("visibilidade centralizada remove arquivados", () => {
    const rows = [{ id: 1, archived_at: null }, { id: 2, archived_at: "2026-10-03T10:00:00Z" }, { id: 3 }];
    expect(activeOnly(rows).map((r) => r.id)).toEqual([1, 3]);
  });
  it("deduplicação considera IDs SGLOC de arquivados", () => {
    const archivedRefs = ["500"]; // vindos de existing_sgloc_references (inclui arquivados)
    const { kept, skippedExisting } = dropExistingReferences([{ sgloc_reference: "500" }, { sgloc_reference: "501" }], archivedRefs);
    expect(kept).toEqual([{ sgloc_reference: "501" }]);
    expect(skippedExisting).toBe(1);
  });
  it("confirmação avisa SGLOC só quando há referência", () => {
    expect(archiveConfirmText(null)).not.toContain("SGLOC");
    expect(archiveConfirmText("123")).toContain("NÃO exclui no SGLOC");
  });
});
