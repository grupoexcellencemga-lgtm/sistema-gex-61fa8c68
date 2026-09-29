import { useState, useRef, useMemo, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  resumirMatriculaV2, validarSomaItensPermuta, type PermutaItem,
} from "@/lib/alunoFinanceiro";
import { formatCurrency } from "./alunosUtils";

export type PermutaItemTipo = "servico" | "produto" | "outro";

interface ItemForm {
  tipo: PermutaItemTipo;
  descricao: string;
  valor: string;
}

export interface PermutaModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matriculaId: string;
  matriculaValorFinal: number;
  pagamentosMatricula: any[];
  permutaItens: Record<string, PermutaItem[]>;
  onSuccess: () => void;
}

const emptyItem = (): ItemForm => ({ tipo: "servico", descricao: "", valor: "" });

const HINT_MESSAGES: Record<string, string> = {
  idempotency_conflict: "Operação já iniciada com parâmetros diferentes. Feche o modal e tente novamente.",
  saldo_insuficiente: "Saldo insuficiente para este valor de permuta.",
  soma_divergente: "A soma dos itens não corresponde ao valor da permuta.",
  itens_vazios: "Adicione ao menos um item à permuta.",
  item_tipo_invalido: "Tipo de item inválido.",
  permissao_negada: "Permissão negada.",
};

export function PermutaModal({
  open,
  onOpenChange,
  matriculaId,
  matriculaValorFinal,
  pagamentosMatricula,
  permutaItens,
  onSuccess,
}: PermutaModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      idempotencyKeyRef.current = null;
      setStep(1);
      setValor("");
      setObservacao("");
      setItens([emptyItem()]);
      setSubmitting(false);
    }
  }, [open]);

  const resumo = useMemo(
    () => resumirMatriculaV2(matriculaValorFinal, pagamentosMatricula, permutaItens),
    [matriculaValorFinal, pagamentosMatricula, permutaItens],
  );
  const saldoDisponivel = resumo.saldoDisponivelNovoPagamento;

  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const step1Valid = valor.trim() !== "" && valorNum >= 0 && valorNum <= saldoDisponivel + 0.005;

  const somaValidation = validarSomaItensPermuta(
    valorNum,
    itens.map((i) => ({ valor: parseFloat(i.valor.replace(",", ".")) || 0 })),
  );
  const step2Valid =
    itens.length > 0 &&
    somaValidation.valido &&
    itens.every((i) => i.descricao.trim() !== "");

  const addItem = () => setItens((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) =>
    setItens((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  const updateItem = (idx: number, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));

  const handleSubmit = async () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    const key = idempotencyKeyRef.current;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("registrar_permuta", {
        p_matricula_id: matriculaId,
        p_valor: valorNum,
        p_itens: itens.map((i) => ({
          tipo: i.tipo,
          descricao: i.descricao.trim(),
          valor: parseFloat(i.valor.replace(",", ".")) || 0,
        })),
        p_idempotency_key: key,
        p_observacao: observacao.trim() || null,
      });

      if (error) {
        const hint = (error as any).hint as string | undefined;
        toast.error(HINT_MESSAGES[hint ?? ""] || `Erro ao registrar permuta: ${error.message}`);
        return;
      }

      toast.success("Permuta registrada com sucesso!");
      onOpenChange(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles: Record<number, string> = {
    1: "Valor da permuta",
    2: "Itens da permuta",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar permuta — {stepTitles[step]}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Saldo disponível para nova permuta: </span>
              <span className="font-semibold" data-testid="saldo-disponivel">
                {formatCurrency(saldoDisponivel)}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permuta-valor">Valor total da permuta (R$)</Label>
              <Input
                id="permuta-valor"
                data-testid="permuta-valor-input"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              {valorNum > saldoDisponivel + 0.005 && valorNum > 0 && (
                <p className="text-xs text-destructive" data-testid="saldo-error">
                  Valor excede o saldo disponível ({formatCurrency(saldoDisponivel)})
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="permuta-obs">Observação (opcional)</Label>
              <Input
                id="permuta-obs"
                placeholder="Descreva o acordado..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Total da permuta:</span>
              <span className="font-semibold">{formatCurrency(valorNum)}</span>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_2fr_1fr_auto] gap-2 items-start">
                  <Select
                    value={item.tipo}
                    onValueChange={(v) => updateItem(idx, { tipo: v as PermutaItemTipo })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="produto">Produto</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Descrição"
                    data-testid={`item-descricao-${idx}`}
                    value={item.descricao}
                    onChange={(e) => updateItem(idx, { descricao: e.target.value })}
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Valor R$"
                    data-testid={`item-valor-${idx}`}
                    value={item.valor}
                    onChange={(e) => updateItem(idx, { valor: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeItem(idx)}
                    disabled={itens.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                data-testid="add-item-btn"
                onClick={addItem}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar item
              </Button>
            </div>
            <div
              data-testid="soma-itens"
              className={`text-sm font-medium ${somaValidation.valido ? "text-emerald-600" : "text-destructive"}`}
            >
              Soma dos itens: {formatCurrency(somaValidation.soma)}
              {!somaValidation.valido && ` (diferença: ${formatCurrency(somaValidation.diferenca)})`}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {step > 1 && (
            <Button
              variant="outline"
              data-testid="btn-voltar"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
              disabled={submitting}
            >
              ← Voltar
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          {step === 1 && (
            <Button
              data-testid="btn-proximo"
              onClick={() => setStep(2)}
              disabled={!step1Valid}
            >
              Próximo →
            </Button>
          )}
          {step === 2 && (
            <Button data-testid="btn-registrar" onClick={handleSubmit} disabled={submitting || !step2Valid}>
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Lançar permuta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
