// Listas de seleção (Loja, Marca, Operador, Mecânico, Local/Oficina): regras puras.
import { EMPTY_OPTION, foldKey } from "./agenda-safety";

export type CatalogKind = "store" | "brand" | "operator" | "mechanic" | "workshop" | "sector";
export type CatalogItem = { id: string; kind: CatalogKind; name: string; active: boolean; sgloc_id: number | null; source?: string };
export type Catalog = Record<CatalogKind, CatalogItem[]>;

export const CATALOG_KINDS: CatalogKind[] = ["workshop", "store", "brand", "mechanic", "operator", "sector"];
export const emptyCatalog = (): Catalog => ({ store: [], brand: [], operator: [], mechanic: [], workshop: [], sector: [] });

/** Campo do formulário (field_key) → lista. */
export const kindForField: Record<string, CatalogKind> = {
  workshop: "workshop", store: "store", brand: "brand", operator: "operator", mecanico_responsavel: "mechanic",
};
export const catalogLabels: Record<CatalogKind, { title: string; add: string; noun: string }> = {
  workshop: { title: "Locais/Oficinas", add: "Adicionar local...", noun: "local" },
  store: { title: "Lojas", add: "Adicionar loja...", noun: "loja" },
  brand: { title: "Marcas", add: "Adicionar marca...", noun: "marca" },
  mechanic: { title: "Mecânicos", add: "Adicionar mecânico...", noun: "mecânico" },
  operator: { title: "Operadores", add: "Adicionar operador...", noun: "operador" },
  sector: { title: "Setores", add: "Adicionar setor...", noun: "setor" },
};
/** Listas que têm ID no SGLOC. */
export const hasSglocId = (kind: CatalogKind) => kind === "store" || kind === "operator";

/** Mesma normalização do banco (norm_name): sem acento, sem caixa, espaços únicos. */
export const catalogKey = (value: unknown) => foldKey(value).trim();
export const cleanName = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export function findItem(items: CatalogItem[], name: unknown): CatalogItem | undefined {
  const key = catalogKey(name);
  return key ? items.find((item) => catalogKey(item.name) === key) : undefined;
}

/** Opções do select: ativos em ordem alfabética + valor atual quando inativo ou fora da lista (nunca some do registro). */
export function selectOptions(items: CatalogItem[], current: unknown): string[] {
  const names = items.filter((item) => item.active).map((item) => item.name).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  const value = cleanName(current);
  if (value && !names.some((name) => catalogKey(name) === catalogKey(value))) names.push(value);
  return names;
}

/** Opções de filtro: nomes da lista + valores presentes nos registros (sem repetir por nome normalizado). */
export function filterOptions(items: CatalogItem[], present: string[]): string[] {
  const seen = new Map<string, string>();
  const tail: string[] = [];
  for (const name of [...items.map((item) => item.name), ...present]) {
    const key = catalogKey(name);
    if (!key || name === EMPTY_OPTION) { if (name && !tail.includes(name)) tail.push(name); continue; }
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...[...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })), ...tail];
}

/** Valores ainda não cadastrados (únicos por nome normalizado), na grafia vista primeiro. */
export function missingNames(items: CatalogItem[], values: unknown[]): string[] {
  const known = new Set(items.map((item) => catalogKey(item.name)));
  const out = new Map<string, string>();
  for (const value of values) {
    const key = catalogKey(value);
    if (key && !known.has(key) && !out.has(key)) out.set(key, cleanName(value));
  }
  return [...out.values()];
}

/** Troca o texto pelo nome cadastrado quando casa pelo nome normalizado. */
export function canonicalName(items: CatalogItem[], value: unknown): string {
  return findItem(items, value)?.name ?? cleanName(value);
}

/** Bloqueio do envio ao SGLOC por loja sem vínculo; null = pode enviar. */
export function storeLinkError(store: unknown, stores: { name: string; sgloc_id: number | null }[]): string | null {
  const name = cleanName(store);
  if (!name) return null;
  const item = stores.find((s) => catalogKey(s.name) === catalogKey(name));
  if (!item || item.sgloc_id === null) return `Loja "${name}" sem vínculo SGLOC. Informe o ID da loja no SGLOC em Configurações > Listas e clique em Reenviar.`;
  return null;
}
