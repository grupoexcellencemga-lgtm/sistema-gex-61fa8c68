import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Link } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento: any;
}

const CANAIS = [
  { label: "WhatsApp",      source: "whatsapp",  medium: "chat",   emoji: "💬" },
  { label: "Instagram Feed",source: "instagram", medium: "social", emoji: "📸" },
  { label: "Stories",       source: "stories",   medium: "social", emoji: "📱" },
  { label: "Facebook",      source: "facebook",  medium: "social", emoji: "📘" },
  { label: "E-mail",        source: "email",     medium: "email",  emoji: "📧" },
  { label: "Link na Bio",   source: "bio",       medium: "social", emoji: "🔗" },
];

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function UTMLinksDialog({ open, onOpenChange, evento }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const base = `${window.location.origin}/inscricao/${evento.id}`;
  const campaign = slugify(evento.nome || "evento");

  const buildUrl = (source: string, medium: string) =>
    `${base}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;

  const copy = (source: string, medium: string) => {
    navigator.clipboard.writeText(buildUrl(source, medium)).then(() => {
      setCopied(source);
      toast.success(`Link ${source} copiado!`);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Links de inscrição com rastreamento</DialogTitle>
          <DialogDescription>
            Cada link registra de onde veio a inscrição. Cole no canal correspondente.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {/* Link simples sem UTM */}
          <div className="flex items-center gap-3 rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2.5">
            <Link className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Link simples</p>
              <p className="text-xs text-muted-foreground truncate">{base}</p>
            </div>
            <Button
              variant={copied === "__base__" ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(base).then(() => {
                  setCopied("__base__");
                  toast.success("Link copiado!");
                  setTimeout(() => setCopied(null), 2000);
                });
              }}
            >
              {copied === "__base__" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-1">Com rastreamento de origem:</p>

          {CANAIS.map(({ label, source, medium, emoji }) => {
            const url = buildUrl(source, medium);
            const isCopied = copied === source;
            return (
              <div key={source} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                <span className="text-lg shrink-0">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{url}</p>
                </div>
                <Button
                  variant={isCopied ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => copy(source, medium)}
                >
                  {isCopied
                    ? <Check className="h-3.5 w-3.5" />
                    : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          A origem de cada inscrição fica registrada automaticamente no sistema.
        </p>
      </DialogContent>
    </Dialog>
  );
}
