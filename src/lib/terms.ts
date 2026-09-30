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

export const LESSONS_PER_TERM = 13;

/** Primeiro trimestre exibido nos filtros; trimestres anteriores ficam ocultos. */
export const FIRST_TERM = "2026-T3";

export function isVisibleTerm(term: string): boolean {
  return term.localeCompare(FIRST_TERM) >= 0;
}

/** Trimestre (YYYY-T1 … YYYY-T4) de uma data YYYY-MM-DD, no mesmo formato de `termOf`. */
export function termOfDate(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${year}-T${Math.floor((Number(month) - 1) / 3) + 1}`;
}

/** Trimestre de hoje no fuso de São Paulo. */
export function currentTermSaoPaulo(): string {
  return termOfDate(todayInSaoPaulo());
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

/** Do trimestre atual até `FIRST_TERM`, do mais recente para o mais antigo. */
export function recentTerms(): string[] {
  const now = new Date();
  const terms: string[] = [];
  for (let index = 0; ; index++) {
    const term = termOf(new Date(now.getFullYear(), now.getMonth() - index * 3, 1));
    if (!isVisibleTerm(term)) break;
    terms.push(term);
  }
  return terms.length ? terms : [currentTerm()];
}
