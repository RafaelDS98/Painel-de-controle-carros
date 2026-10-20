import { normalizePlate } from "@/lib/normalize";

export interface YardGroup {
  id: string;
  name: string;
  active: boolean;
  workshopNames: string[];
}

const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Itens cujo local pertence ao grupo, uma vez por placa normalizada. */
export function itemsInGroup<T extends { workshop: string; plate: string }>(
  items: T[],
  group: Pick<YardGroup, "workshopNames">,
): T[] {
  const names = new Set(group.workshopNames.map(key));
  const seen = new Set<string>();
  return items.filter((i) => {
    if (!names.has(key(i.workshop ?? ""))) return false;
    const p = normalizePlate(i.plate ?? "");
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

export function validGroupName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 80;
}
