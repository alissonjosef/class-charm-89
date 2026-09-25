import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { studentQrPayload } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function StudentQrCard({ studentId, name }: { studentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const payload = studentQrPayload(studentId);

  return (
    <>
      <section className="surface flex items-center gap-4 p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-xl border border-border bg-white p-1.5 transition-transform hover:scale-105"
          aria-label="Ampliar meu QR code"
        >
          <QRCodeSVG value={payload} size={72} level="M" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold">Meu QR code de presença</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Mostre para o professor apontar a câmera e marcar sua presença na chamada.
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
            <QrCode className="size-3.5" /> Ampliar
          </Button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>Aproxime o celular da câmera do professor.</DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center rounded-2xl bg-white p-6">
            <QRCodeSVG value={payload} size={260} level="M" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
