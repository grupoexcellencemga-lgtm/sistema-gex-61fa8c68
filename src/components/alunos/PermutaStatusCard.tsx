import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { statusPermutaDerived, type PermutaItem } from "@/lib/alunoFinanceiro";
import { formatCurrency } from "./alunosUtils";
import { cn } from "@/lib/utils";

interface Props {
  pagamento: any;
  itens: PermutaItem[];
  onRefresh: () => void;
}

type DialogMode = "confirmar" | "cancelar_item" | "cancelar_permuta" | null;

const ITEM_STATUS_LABEL: Record<string, string> = {
  acordado: "Acordado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const ITEM_STATUS_CLASS: Record<string, string> = {
  acordado: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  entregue: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelado: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PERMUTA_STATUS_CLASS: Record<string, string> = {
  pendente_permuta: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  pago: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelado: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PERMUTA_STATUS_LABEL: Record<string, string> = {
  pendente_permuta: "Aguardando entrega",
  pago: "Entregue",
  cancelado: "Cancelada",
};

export function PermutaStatusCard({ pagamento, itens, onRefresh }: Props) {
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);

  const statusDerived = statusPermutaDerived(itens);
  const itensAtivos = itens.filter((i) => !(i as any).deleted_at);

  const openConfirmar = (itemId: string) => {
    setActiveItemId(itemId);
    setObservacao("");
    setDialogMode("confirmar");
  };

  const openCancelarItem = (itemId: string) => {
    setActiveItemId(itemId);
    setMotivo("");
    setDialogMode("cancelar_item");
  };

  const openCancelarPermuta = () => {
    setMotivo("");
    setDialogMode("cancelar_permuta");
  };

  const handleConfirmar = async () => {
    if (!activeItemId) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("confirmar_entrega_item_permuta", {
        p_permuta_item_id: activeItemId,
        p_observacao: observacao.trim() || null,
      });
      if (error) {
        toast.error("Erro ao confirmar entrega: " + error.message);
        return;
      }
      toast.success("Entrega confirmada!");
      onRefresh();
      setDialogMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarItem = async () => {
    if (!activeItemId || !motivo.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("cancelar_item_permuta", {
        p_permuta_item_id: activeItemId,
        p_motivo_cancelamento: motivo.trim(),
      });
      if (error) {
        toast.error("Erro ao cancelar item: " + error.message);
        return;
      }
      toast.success("Item cancelado.");
      onRefresh();
      setDialogMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarPermuta = async () => {
    if (!motivo.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("cancelar_permuta", {
        p_pagamento_id: pagamento.id,
        p_motivo_cancelamento: motivo.trim(),
      });
      if (error) {
        toast.error("Erro ao cancelar permuta: " + error.message);
        return;
      }
      toast.success("Permuta cancelada.");
      onRefresh();
      setDialogMode(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="rounded-lg border p-3 text-sm space-y-2"
        data-testid={`permuta-card-${pagamento.id}`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs border-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
            >
              Permuta
            </Badge>
            <span className="font-medium">{formatCurrency(Number(pagamento.valor))}</span>
          </div>
          <Badge
            variant="outline"
            className={cn("text-xs border-0", PERMUTA_STATUS_CLASS[statusDerived] ?? "")}
          >
            {PERMUTA_STATUS_LABEL[statusDerived] ?? statusDerived}
          </Badge>
        </div>

        {itensAtivos.length > 0 && (
          <div className="space-y-1">
            {itensAtivos.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5"
                data-testid={`permuta-item-${item.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    className={cn("text-xs border-0 shrink-0", ITEM_STATUS_CLASS[item.status] ?? "")}
                  >
                    {ITEM_STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                  <span className="truncate text-xs">{item.descricao}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatCurrency(Number(item.valor))}
                  </span>
                </div>
                {item.status === "acordado" && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-emerald-600"
                      title="Confirmar entrega"
                      data-testid={`btn-confirmar-${item.id}`}
                      onClick={() => openConfirmar(item.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      title="Cancelar item"
                      data-testid={`btn-cancelar-item-${item.id}`}
                      onClick={() => openCancelarItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {statusDerived !== "cancelado" && statusDerived !== "pago" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive w-full"
            data-testid="btn-cancelar-permuta"
            onClick={openCancelarPermuta}
          >
            Cancelar permuta
          </Button>
        )}
      </div>

      {/* Confirmar entrega */}
      <AlertDialog
        open={dialogMode === "confirmar"}
        onOpenChange={(v) => !v && setDialogMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar entrega do item</AlertDialogTitle>
            <AlertDialogDescription>
              O item será marcado como entregue e não poderá ser cancelado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="obs-entrega">Observação (opcional)</Label>
            <Input
              id="obs-entrega"
              placeholder="..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-confirmar-entrega-ok"
              onClick={handleConfirmar}
              disabled={loading}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Confirmar entrega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelar item */}
      <AlertDialog
        open={dialogMode === "cancelar_item"}
        onOpenChange={(v) => !v && setDialogMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar item</AlertDialogTitle>
            <AlertDialogDescription>Informe o motivo do cancelamento.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-item">Motivo</Label>
            <Input
              id="motivo-item"
              data-testid="input-motivo-item"
              placeholder="Motivo..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Fechar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-cancelar-item-ok"
              onClick={handleCancelarItem}
              disabled={loading || !motivo.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Cancelar item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelar permuta */}
      <AlertDialog
        open={dialogMode === "cancelar_permuta"}
        onOpenChange={(v) => !v && setDialogMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar permuta</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os itens acordados serão cancelados. Itens já entregues são preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-permuta">Motivo</Label>
            <Input
              id="motivo-permuta"
              data-testid="input-motivo-permuta"
              placeholder="Motivo do cancelamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Fechar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="btn-cancelar-permuta-ok"
              onClick={handleCancelarPermuta}
              disabled={loading || !motivo.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Cancelar permuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
