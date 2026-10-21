export function canSeeNavigation(
  permissions: ReadonlySet<string>,
  required?: string,
  anyOf?: readonly string[],
): boolean {
  return (
    (!required || permissions.has(required)) && (!anyOf || anyOf.some((p) => permissions.has(p)))
  );
}

export function consultasSearch(permissions: ReadonlySet<string>): {
  tab: "consultas" | "consultas-os";
} {
  return { tab: permissions.has("module.veiculos") ? "consultas" : "consultas-os" };
}

export function isNavigationChildActive(
  pathname: string,
  target: string,
  search: Record<string, unknown>,
  childSearch?: Record<string, string>,
  first = false,
): boolean {
  if (pathname !== target) return false;
  if (!childSearch) return true;
  if (childSearch.tab === "consultas" || childSearch.tab === "consultas-os") {
    return search.tab === "consultas" || search.tab === "consultas-os";
  }
  return (
    Object.entries(childSearch).every(([key, value]) => search[key] === value) ||
    (first && !Object.keys(childSearch).some((key) => search[key]))
  );
}
