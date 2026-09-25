import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { parseStudentQr } from "@/lib/qr";
import type { Rule, RuleGroup } from "@/lib/points";
import type { Student } from "@/hooks/useStudents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RESCAN_MS = 4000;

export type ScanResult = { student: Student; rule: Rule; ok: boolean; message: string };

export function QrScannerDialog({
  open,
  onOpenChange,
  students,
  groups,
  rules,
  appliedToday,
  onScan,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  students: Student[];
  groups: RuleGroup[];
  rules: Rule[];
  appliedToday: Map<string, string>;
  onScan: (student: Student, rule: Rule) => Promise<void>;
}) {
  const defaultRule = rules.find((r) => r.key === "PRESENCA") ?? rules.find((r) => r.points > 0);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const rule = rules.find((r) => r.id === ruleId) ?? defaultRule;
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [log, setLog] = useState<ScanResult[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSeen = useRef(new Map<string, number>());
  const busy = useRef(false);
  const latest = useRef({ rule, students, appliedToday, onScan });
  latest.current = { rule, students, appliedToday, onScan };

  useEffect(() => {
    if (!open) {
      setLog([]);
      lastSeen.current.clear();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;
    setCameraError(null);
    setStarting(true);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Este navegador não permite usar a câmera.");
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled || !video) return;
        video.srcObject = stream;
        await video.play();
        setStarting(false);
        frame = requestAnimationFrame(tick);
      } catch {
        setCameraError("Não foi possível acessar a câmera. Verifique a permissão do navegador.");
        setStarting(false);
      }
    }

    function tick() {
      if (cancelled) return;
      frame = requestAnimationFrame(tick);
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA || busy.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const size = Math.min(video.videoWidth, video.videoHeight, 480);
      if (!size) return;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
      const image = ctx.getImageData(0, 0, size, size);
      const code = jsQR(image.data, size, size, { inversionAttempts: "dontInvert" });
      if (code?.data) void handle(code.data);
    }

    async function handle(text: string) {
      const studentId = parseStudentQr(text);
      if (!studentId) return;
      const now = Date.now();
      const seenAt = lastSeen.current.get(studentId) ?? 0;
      if (now - seenAt < RESCAN_MS) return;
      lastSeen.current.set(studentId, now);
      const { rule: currentRule, students, appliedToday, onScan } = latest.current;
      const student = students.find((s) => s.id === studentId);
      if (!currentRule) return;
      if (!student) {
        pushLog({
          student: { id: studentId, name: "Aluno desconhecido", email: "", total_points: 0 },
          rule: currentRule,
          ok: false,
          message: "Este QR não é de um aluno desta lista",
        });
        return;
      }
      if (appliedToday.has(`${student.id}:${currentRule.key}`)) {
        pushLog({ student, rule: currentRule, ok: true, message: "já estava marcado hoje" });
        return;
      }
      busy.current = true;
      try {
        await onScan(student, currentRule);
        pushLog({ student, rule: currentRule, ok: true, message: `${currentRule.label} lançada` });
      } catch (error) {
        pushLog({
          student,
          rule: currentRule,
          ok: false,
          message: error instanceof Error ? error.message : "Erro ao lançar",
        });
      } finally {
        busy.current = false;
      }
    }

    function pushLog(entry: ScanResult) {
      setLog((prev) => [entry, ...prev].slice(0, 8));
      if (navigator.vibrate) navigator.vibrate(entry.ok ? 80 : [60, 60, 60]);
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chamada por QR code</DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR code do aluno. Cada leitura lança a regra escolhida abaixo.
          </DialogDescription>
        </DialogHeader>

        <Select value={rule?.id ?? ""} onValueChange={setRuleId}>
          <SelectTrigger aria-label="Regra lançada ao ler o QR">
            <SelectValue placeholder="Escolha a regra" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => {
              const groupRules = rules.filter((r) => r.group_id === group.id);
              if (!groupRules.length) return null;
              return groupRules.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {group.name} · {r.label} ({r.points > 0 ? "+" : ""}
                  {r.points})
                </SelectItem>
              ));
            })}
          </SelectContent>
        </Select>

        <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} className="size-full object-cover" muted playsInline autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-gold/80"
          />
          {starting ? (
            <div className="absolute inset-0 grid place-items-center text-ink-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : null}
          {cameraError ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-foreground">
              <div>
                <Camera className="mx-auto mb-2 size-6" />
                {cameraError}
              </div>
            </div>
          ) : null}
        </div>

        {log.length ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {log.map((entry, index) => (
              <li
                key={`${entry.student.id}-${index}`}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                  entry.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                <CheckCircle2 className="size-4 shrink-0" />
                <span className="min-w-0 truncate">
                  <strong>{entry.student.name}</strong> · {entry.message}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Nenhuma leitura ainda. Os alunos encontram o QR na tela inicial deles.
          </p>
        )}

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
