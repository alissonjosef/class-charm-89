const PREFIX = "classeviva:aluno:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function studentQrPayload(studentId: string): string {
  return `${PREFIX}${studentId}`;
}

/** Devolve o id do aluno se o texto lido for um QR da Classe Viva. */
export function parseStudentQr(text: string): string | null {
  if (!text.startsWith(PREFIX)) return null;
  const id = text.slice(PREFIX.length).trim();
  return UUID_RE.test(id) ? id : null;
}
