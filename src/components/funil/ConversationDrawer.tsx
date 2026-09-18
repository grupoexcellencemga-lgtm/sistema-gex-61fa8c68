import { useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export function ConversationDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Sheet open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <SheetContent side="right" className="flex h-[100dvh] w-full flex-col gap-0 p-0 sm:w-full sm:max-w-[960px] [&>button]:hidden"
        onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus({ preventScroll: true }); }}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={onClose}><ArrowLeft className="h-4 w-4" />Voltar à lista</Button>
        </div>
        <SheetDescription className="sr-only">Histórico e ações de atendimento. Volte à lista para escolher outro contato.</SheetDescription>
        <div className="flex flex-1 min-h-0 overflow-hidden">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
