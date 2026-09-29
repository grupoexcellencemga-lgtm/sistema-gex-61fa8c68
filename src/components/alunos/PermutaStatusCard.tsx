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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { statusPermutaDerived, type PermutaItem } from "@/lib/alunoFinanceiro";
import { formatCurrency } from "./alunosUtils";
import { cn } from "@/lib/utils";
import type { PermutaItemTipo } from "./PermutaModal";

interface Props {
  pagamento: any;
  itens: PermutaItem[];
  onRefresh: () => void;
}

type DialogMode =
  | "confirmar"
  | "excluir_item"
  | "editar_item"
  | "excluir_permuta"
  | "editar_permuta"
  | null;

interface EditItemForm {
  tipo: PermutaItemTipo;
  descricao: string;
  valor: string;
  observacao: string;
}

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
  const [editItemForm, setEditItemForm] = useState<EditItemForm>({
    tipo: "servico",
    descricao: "",
    valor: "",
    observacao: "",
  });
  const [editPermutaObs, setEditPermutaObs] = useState("");
  const [loading, setLoading] = useState(false);

  const statusDerived = statusPermutaDerived(itens);
  const itensAtivos = itens.filter((i) => !(i as any).deleted_at);

  // ── Abrir diálogos ──────────────────────────────────────────────────────────

  const openConfirmar = (itemId: string) => {
    setActiveItemId(itemId);
    setObservacao("");
    setDialogMode("confirmar");
  };

  const openExcluirItem = (itemId: string) => {
    setActiveItemId(itemId);
    setMotivo("");
    setDialogMode("excluir_item");
  };

  const openEditarItem = (item: any) => {
    setActiveItemId(item.id);
    setEditItemForm({
      tipo: (item.tipo as PermutaItemTipo) || "servico",
      descricao: item.descricao || "",
      valor: String(item.valor ?? ""),
      observacao: item.observacao || "",
    });
    setDialogMode("editar_item");
  };

  const openExcluirPermuta = () => {
    setMotivo("");
    setDialogMode("excluir_permuta");
  };

  const openEditarPermuta = () => {
    setEditPermutaObs(pagamento.observacao || "");
    setDialogMode("editar_permuta");
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  const handleExcluirItem = async () => {
    if (!activeItemId || !motivo.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("excluir_item_permuta", {
        p_item_id: activeItemId,
        p_motivo: motivo.trim(),
      });
      if (error) {
        toast.error("Erro ao excluir item: " + error.message);
        return;
      }
      toast.success("Item excluído.");
      onRefresh();
      setDialogMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarItem = async () => {
    if (!activeItemId || !editItemForm.descricao.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("editar_item_permuta", {
        p_item_id: activeItemId,
        p_tipo: editItemForm.tipo,
        p_descricao: editItemForm.descricao.trim(),
        p_valor: parseFloat(editItemForm.valor.replace(",", ".")) || 0,
        p_observacao: editItemForm.observacao.trim() || null,
      });
      if (error) {
        toast.error("Erro ao editar item: " + error.message);
        return;
      }
      toast.success("Item atualizado.");
      onRefresh();
      setDialogMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirPermuta = async () => {
    if (!motivo.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("excluir_permuta", {
        p_pagamento_id: pagamento.id,
        p_motivo: motivo.trim(),
      });
      if (error) {
        toast.error("Erro ao excluir permuta: " + error.message);
        return;
      }
      toast.success("Permuta excluída.");
      onRefresh();
      setDialogMode(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarPermuta = async () => {
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("editar_permuta", {
        p_pagamento_id: pagamento.id,
        p_observacao: editPermutaObs.trim() || null,
      });
      if (error) {
        toast.error("Erro ao editar permuta: " + error.message);
        return;
      }
      toast.success("Permuta atualizada.");
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
        {/* Cabeçalho */}
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
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("text-xs border-0", PERMUTA_STATUS_CLASS[statusDerived] ?? "")}
            >
              {PERMUTA_STATUS_LABEL[statusDerived] ?? statusDerived}
            </Badge>
            {statusDerived !== "cancelado" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  title="Editar permuta"
                  data-testid="btn-editar-permuta"
                  onClick={openEditarPermuta}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  title="Excluir permuta"
                  data-testid="btn-excluir-permuta"
                  onClick={openExcluirPermuta}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Observação */}
        {pagamento.observacao && (
          <p className="text-xs text-muted-foreground italic">{pagamento.observacao}</p>
        )}

        {/* Itens */}
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
                {item.status !== "cancelado" && (
                  <div className="flex gap-1 shrink-0">
                    {item.status === "acordado" && (
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
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      title="Editar item"
                      data-testid={`btn-editar-item-${item.id}`}
                      onClick={() => openEditarItem(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      title="Excluir item"
                      data-testid={`btn-cancelar-item-${item.id}`}
                      onClick={() => openExcluirItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Confirmar entrega ─────────────────────────────────────────────────── */}
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

      {/* ── Excluir item ──────────────────────────────────────────────────────── */}
      <AlertDialog
        open={dialogMode === "excluir_item"}
        onOpenChange={(v) => !v && setDialogMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo. Itens entregues terão seu efeito financeiro revertido.
            </AlertDialogDescription>
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
              onClick={handleExcluirItem}
              disabled={loading || !motivo.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Excluir item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Editar item ───────────────────────────────────────────────────────── */}
      <Dialog
        open={dialogMode === "editar_item"}
        onOpenChange={(v) => !v && setDialogMode(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={editItemForm.tipo}
                onValueChange={(v) => setEditItemForm((f) => ({ ...f, tipo: v as PermutaItemTipo }))}
              >
                <SelectTrigger data-testid="select-editar-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-desc">Descrição</Label>
              <Input
                id="editar-desc"
                data-testid="input-editar-desc"
                value={editItemForm.descricao}
                onChange={(e) => setEditItemForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-valor">Valor (R$)</Label>
              <Input
                id="editar-valor"
                data-testid="input-editar-valor"
                value={editItemForm.valor}
                onChange={(e) => setEditItemForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-obs-item">Observação (opcional)</Label>
              <Input
                id="editar-obs-item"
                placeholder="..."
                value={editItemForm.observacao}
                onChange={(e) => setEditItemForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              data-testid="btn-editar-item-ok"
              onClick={handleEditarItem}
              disabled={loading || !editItemForm.descricao.trim()}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Excluir permuta ───────────────────────────────────────────────────── */}
      <AlertDialog
        open={dialogMode === "excluir_permuta"}
        onOpenChange={(v) => !v && setDialogMode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permuta</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os itens serão cancelados, incluindo entregues (estorno financeiro completo).
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
              data-testid="btn-excluir-permuta-ok"
              onClick={handleExcluirPermuta}
              disabled={loading || !motivo.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Excluir permuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Editar permuta ────────────────────────────────────────────────────── */}
      <Dialog
        open={dialogMode === "editar_permuta"}
        onOpenChange={(v) => !v && setDialogMode(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar permuta</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="editar-obs-permuta">Observação</Label>
            <Input
              id="editar-obs-permuta"
              data-testid="input-editar-obs-permuta"
              placeholder="Descreva o acordado..."
              value={editPermutaObs}
              onChange={(e) => setEditPermutaObs(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              data-testid="btn-editar-permuta-ok"
              onClick={handleEditarPermuta}
              disabled={loading}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
