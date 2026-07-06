// Junta nomes de listas (dos dois módulos), removendo duplicados por igualdade
// case-insensitive (mantém a 1ª grafia encontrada) e ordena. Usado nos autocompletes
// de cadastro para sugerir registros já existentes em ambos os módulos.
export function mergeNames(...lists: (string | null | undefined)[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list) {
      const v = String(raw ?? "").trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (!seen.has(key)) seen.set(key, v);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}
