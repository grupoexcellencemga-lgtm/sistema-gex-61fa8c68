import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText } from "lucide-react";
import { gerarContratoMatricula } from "@/lib/pdfUtils";
import { formatCurrency, formatDate } from "./alunosUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingMatriculaId: string | null;
  selectedAlunoNome: string;
  matriculaForm: any;
  setMatriculaForm: (fn: (prev: any) => any) => void;
  produtos: any[];
  turmasFiltradas: any[];
  contasBancarias: any[];
  comerciais: any[];
  onSave: () => void;
  isSaving: boolean;
  handleProdutoChange: (produtoId: string) => void;
}

export const MatriculaFormDialog = ({
  open,
  onOpenChange,
  editingMatriculaId,
  selectedAlunoNome,
  matriculaForm,
  setMatriculaForm,
  produtos,
  turmasFiltradas,
  contasBancarias,
  comerciais,
  onSave,
  isSaving,
  handleProdutoChange,
}: Props) => {
  const valorFinalCalc =
    (parseFloat(matriculaForm.valor_total) || 0) -
    (parseFloat(matriculaForm.desconto) || 0);

  const numParcelasCalc = parseInt(matriculaForm.parcelas) || 1;

  const { data: formasPagamento = [], isLoading: formasPagamentoLoading } =
    useFormasPagamento();

  const { data: taxas = [] } = useQuery({
    queryKey: ["taxas_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taxas_sistema")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const formaAtual = formasPagamento.find(
    (f) => f.codigo === matriculaForm.forma_pagamento
  );

  const isCredito = ["credito", "cartao", "cartao_credito"].includes(
    matriculaForm.forma_pagamento
  );

  const isDebito = matriculaForm.forma_pagamento === "debito";
  const isLink = matriculaForm.forma_pagamento === "link";
  const isBoleto = matriculaForm.forma_pagamento === "boleto";

  const showTaxa =
    formaAtual?.abre_taxa || isCredito || isDebito || isLink || isBoleto;

  const showParcelas =
    formaAtual?.abre_parcelas || isCredito || isLink || isBoleto;

  const taxaAutoCalc = useMemo(() => {
    if (!showTaxa || !taxas.length) return { percentual: 0, nome: "" };

    const parcelas = numParcelasCalc;

    if (isDebito) {
      const found = taxas.find(
        (t: any) => t.tipo === "maquininha" && t.nome === "Débito"
      );

      return found
        ? { percentual: Number(found.percentual), nome: found.nome }
        : { percentual: 0, nome: "Débito" };
    }

    if (isCredito) {
      const nome = parcelas === 1 ? "Crédito 1x" : `Crédito ${parcelas}x`;

      const found = taxas.find(
        (t: any) => t.tipo === "maquininha" && t.nome === nome
      );

      return found
        ? { percentual: Number(found.percentual), nome: found.nome }
        : { percentual: 0, nome };
    }

    if (isLink || isBoleto) {
      const nome = `${parcelas}x`;

      const found = taxas.find(
        (t: any) => t.tipo === "link" && t.nome === nome
      );

      return found
        ? {
            percentual: Number(found.percentual),
            nome: `${isBoleto ? "Boleto" : "Link"} ${found.nome}`,
          }
        : { percentual: 0, nome };
    }

    return { percentual: 0, nome: "" };
  }, [
    showTaxa,
    isCredito,
    isDebito,
    isLink,
    isBoleto,
    numParcelasCalc,
    taxas,
  ]);

  const taxaPercentual = taxaAutoCalc.percentual;
  const valorTaxa =
    valorFinalCalc > 0 ? Math.round(valorFinalCalc * taxaPercentual) / 100 : 0;

  useMemo(() => {
    if (showTaxa && taxaPercentual > 0) {
      const current = parseFloat(matriculaForm.taxa_cartao);

      if (current !== taxaPercentual) {
        setMatriculaForm((p: any) => ({
          ...p,
          taxa_cartao: String(taxaPercentual),
        }));
      }
    } else if (!showTaxa && matriculaForm.taxa_cartao) {
      setMatriculaForm((p: any) => ({
        ...p,
        taxa_cartao: "",
        repassar_taxa: false,
      }));
    }
  }, [taxaPercentual, showTaxa]);

  const handleFormaPagamentoChange = (v: string) => {
    const forma = formasPagamento.find((f) => f.codigo === v);

    setMatriculaForm((p: any) => ({
      ...p,
      forma_pagamento: v,
      repassar_taxa: false,
      parcelas:
        forma?.abre_parcelas ||
        ["credito", "cartao", "cartao_credito", "link", "boleto"].includes(v)
          ? p.parcelas || "1"
          : "1",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingMatriculaId ? "Editar Matrícula" : "Nova Matrícula"}
          </DialogTitle>

          <DialogDescription>
            {editingMatriculaId
              ? `Editando matrícula de ${selectedAlunoNome}`
              : `Matricular ${selectedAlunoNome} — matrícula + parcelas automáticas`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 mt-2">
          <div>
            <Label>Produto</Label>
            <Select
              value={matriculaForm.produto_id}
              onValueChange={handleProdutoChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>

              <SelectContent>
                {produtos.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} {p.valor ? `(${formatCurrency(Number(p.valor))})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Turma</Label>
            <Select
              value={matriculaForm.turma_id}
              onValueChange={(v) => {
                const turmaSelecionada = turmasFiltradas.find(
                  (t: any) => t.id === v
                );

                setMatriculaForm((p) => ({
                  ...p,
                  turma_id: v,
                  data_inicio:
                    turmaSelecionada?.data_inicio ||
                    turmaSelecionada?.dataInicio ||
                    turmaSelecionada?.inicio ||
                    turmaSelecionada?.start_date ||
                    "",
                  data_fim:
                    turmaSelecionada?.data_fim ||
                    turmaSelecionada?.dataFim ||
                    turmaSelecionada?.fim ||
                    turmaSelecionada?.end_date ||
                    "",
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>

              <SelectContent>
                {turmasFiltradas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}

                {turmasFiltradas.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhuma turma disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data início</Label>
              <Input
                type="date"
                value={matriculaForm.data_inicio || ""}
                readOnly
                className="bg-muted"
              />
            </div>

            <div>
              <Label>Data fim</Label>
              <Input
                type="date"
                value={matriculaForm.data_fim || ""}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-semibold">Valores do Contrato</p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Valor total (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={matriculaForm.valor_total}
                  onChange={(e) =>
                    setMatriculaForm((p) => ({
                      ...p,
                      valor_total: e.target.value,
                    }))
                  }
                  placeholder="0,00"
                />
              </div>

              <div>
                <Label>Desconto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={matriculaForm.desconto}
                  onChange={(e) =>
                    setMatriculaForm((p) => ({
                      ...p,
                      desconto: e.target.value,
                    }))
                  }
                  placeholder="0,00"
                />
              </div>

              <div>
                <Label>Valor final</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-background text-sm font-semibold">
                  {formatCurrency(valorFinalCalc)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  value={matriculaForm.parcelas}
                  onChange={(e) =>
                    setMatriculaForm((p) => ({
                      ...p,
                      parcelas: e.target.value,
                    }))
                  }
                  disabled={!showParcelas}
                />
              </div>

              <div>
                <Label>
                  {matriculaForm.forma_pagamento === "boleto" ||
                  matriculaForm.forma_pagamento === "recorrencia_cartao" ||
                  matriculaForm.forma_pagamento === "cheque"
                    ? "1º Vencimento"
                    : "Data do pagamento"}
                </Label>
                <Input
                  type="date"
                  value={matriculaForm.data_vencimento}
                  onChange={(e) =>
                    setMatriculaForm((p) => ({
                      ...p,
                      data_vencimento: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Forma de pagamento</Label>

                <Select
                  value={matriculaForm.forma_pagamento}
                  onValueChange={handleFormaPagamentoChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        formasPagamentoLoading
                          ? "Carregando..."
                          : "Selecione"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {formasPagamento.map((forma) => (
                      <SelectItem key={forma.id} value={forma.codigo}>
                        {forma.nome}
                      </SelectItem>
                    ))}

                    {formasPagamento.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhuma forma cadastrada
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Conta Bancária</Label>
                <Select
                  value={matriculaForm.conta_bancaria_id}
                  onValueChange={(v) =>
                    setMatriculaForm((p) => ({
                      ...p,
                      conta_bancaria_id: v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>

                  <SelectContent>
                    {contasBancarias.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} ({c.banco})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showTaxa && taxaPercentual > 0 && (
              <div className="rounded-md border p-3 bg-accent/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Taxa: {taxaAutoCalc.nome} —{" "}
                      {taxaPercentual.toFixed(2).replace(".", ",")}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Valor da taxa: {formatCurrency(valorTaxa)}
                    </p>
                  </div>
                </div>

                {(isCredito || isLink || isBoleto || isDebito) && (
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={matriculaForm.repassar_taxa || false}
                      onCheckedChange={(checked) =>
                        setMatriculaForm((p) => ({
                          ...p,
                          repassar_taxa: checked,
                        }))
                      }
                    />
                    <Label className="text-sm cursor-pointer font-medium">
                      Repassar taxa para o cliente
                    </Label>
                  </div>
                )}

                {matriculaForm.repassar_taxa &&
                  (isCredito || isLink || isBoleto || isDebito) && (
                    <p className="text-xs text-primary font-medium">
                      O cliente pagará{" "}
                      {formatCurrency(valorFinalCalc + valorTaxa)} (valor + taxa)
                    </p>
                  )}
              </div>
            )}

            {valorFinalCalc > 0 && numParcelasCalc > 0 && (
              <p className="text-xs text-muted-foreground">
                {numParcelasCalc}x de{" "}
                {formatCurrency(valorFinalCalc / numParcelasCalc)}
                {matriculaForm.data_vencimento &&
                  ` · 1ª parcela em ${formatDate(
                    matriculaForm.data_vencimento
                  )}`}
                {showTaxa &&
                  taxaPercentual > 0 &&
                  ` · Taxa: ${taxaPercentual
                    .toFixed(2)
                    .replace(".", ",")}%`}
              </p>
            )}
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={matriculaForm.status}
              onValueChange={(v) =>
                setMatriculaForm((p) => ({
                  ...p,
                  status: v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Comercial (Vendedor)</Label>
              <Select
                value={matriculaForm.comercial_id || "nenhum"}
                onValueChange={(v) =>
                  setMatriculaForm((p) => ({
                    ...p,
                    comercial_id: v === "nenhum" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {comerciais.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {matriculaForm.comercial_id && (
              <div>
                <Label>% Comissão</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={matriculaForm.percentual_comissao}
                  onChange={(e) =>
                    setMatriculaForm((p) => ({
                      ...p,
                      percentual_comissao: e.target.value,
                    }))
                  }
                  placeholder="5"
                />
              </div>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={matriculaForm.observacoes}
              onChange={(e) =>
                setMatriculaForm((p) => ({
                  ...p,
                  observacoes: e.target.value,
                }))
              }
              placeholder="Observações opcionais"
            />
          </div>

          <div className="flex gap-2">
            {editingMatriculaId && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const valorFinal =
                    (parseFloat(matriculaForm.valor_total) || 0) -
                    (parseFloat(matriculaForm.desconto) || 0);

                  const prod = produtos.find(
                    (p: any) => p.id === matriculaForm.produto_id
                  );

                  const turma = turmasFiltradas.find(
                    (t: any) => t.id === matriculaForm.turma_id
                  );

                  const formaLabel =
                    formasPagamento.find(
                      (f) => f.codigo === matriculaForm.forma_pagamento
                    )?.nome || matriculaForm.forma_pagamento;

                  gerarContratoMatricula({
                    alunoNome: selectedAlunoNome,
                    produtoNome: prod?.nome,
                    turmaNome: turma?.nome,
                    valorTotal: parseFloat(matriculaForm.valor_total) || 0,
                    desconto: parseFloat(matriculaForm.desconto) || 0,
                    valorFinal,
                    parcelas: parseInt(matriculaForm.parcelas) || 1,
                    dataInicio: matriculaForm.data_inicio
                      ? new Date(
                          matriculaForm.data_inicio + "T12:00"
                        ).toLocaleDateString("pt-BR")
                      : undefined,
                    dataFim: matriculaForm.data_fim
                      ? new Date(
                          matriculaForm.data_fim + "T12:00"
                        ).toLocaleDateString("pt-BR")
                      : undefined,
                    formaPagamento: formaLabel,
                  });
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Contrato
              </Button>
            )}

            <Button className="flex-1" onClick={onSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMatriculaId
                ? "Salvar Alterações"
                : "Criar Matrícula e Gerar Parcelas"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};