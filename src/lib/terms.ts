export function termOf(date: Date): string {
  return `${date.getFullYear()}-T${Math.floor(date.getMonth() / 3) + 1}`;
}

export function currentTerm(): string {
  return termOf(new Date());
}

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo, igual à regra usada no banco. */
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function termLabel(term: string): string {
  const [year, quarter] = term.split("-T");
  return `${quarter}º trimestre de ${year}`;
}

export const LESSONS_PER_SEMESTER = 13;

/** Semestre (YYYY-S1 / YYYY-S2) de uma data YYYY-MM-DD. */
export function semesterOf(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${year}-S${Number(month) <= 6 ? 1 : 2}`;
}

export function currentSemester(): string {
  return semesterOf(todayInSaoPaulo());
}

export function semesterLabel(semester: string): string {
  const [year, half] = semester.split("-S");
  return `${half}º semestre de ${year}`;
}

/** Mês (YYYY-MM) de uma data YYYY-MM-DD. */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function monthLabel(month: string): string {
  const [year, mm] = month.split("-");
  const label = new Date(Number(year), Number(mm) - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Mês atual e os anteriores (YYYY-MM), do mais recente para o mais antigo. */
export function recentMonths(count = 12): string[] {
  const [year, month] = todayInSaoPaulo().split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year!, month! - 1 - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

/** Trimestre atual e os anteriores, do mais recente para o mais antigo. */
export function recentTerms(count = 8): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) =>
    termOf(new Date(now.getFullYear(), now.getMonth() - index * 3, 1)),
  );
}
