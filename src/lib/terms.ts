export function termOf(date: Date): string {
  return `${date.getFullYear()}-T${Math.floor(date.getMonth() / 3) + 1}`;
}

export function currentTerm(): string {
  return termOf(new Date());
}

export function termLabel(term: string): string {
  const [year, quarter] = term.split("-T");
  return `${quarter}º trimestre de ${year}`;
}

/** Trimestre atual e os anteriores, do mais recente para o mais antigo. */
export function recentTerms(count = 8): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) =>
    termOf(new Date(now.getFullYear(), now.getMonth() - index * 3, 1)),
  );
}
