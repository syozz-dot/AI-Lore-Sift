export function normalizePrivateSearchQuery(value: unknown, maxLength = 120) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

export function privateSearchPattern(value: unknown) {
  const query = normalizePrivateSearchQuery(value);
  const escaped = query.replace(/[\\%_]/g, (character) => `\\${character}`);
  return escaped ? `%${escaped}%` : null;
}
