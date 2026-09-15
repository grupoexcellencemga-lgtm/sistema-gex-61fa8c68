import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText, Paperclip, X, ExternalLink, CheckCircle2, Clock } from "lucide-react";
import { gerarContratoMatricula } from "@/lib/pdfUtils";
import { formatCurrency, formatDate } from "./alunosUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { calcTaxaMaquina } from "@/lib/taxaMaquina";
import { abrirComprovante } from "@/lib/comprovantes";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";


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
  // Garante que valor_total seja preenchido automaticamente quando:
  // 1. produto_id está definido mas valor_total ainda está vazio (race condition de carregamento)
  // 2. produtos carregou depois que o form foi montado
  useEffect(() => {
    if (!matriculaForm.produto_id) return;
    if (matriculaForm.valor_total) return; // já preenchido, não sobrescreve
    const produto = produtos.find((p: any) => p.id === matriculaForm.produto_id);
    if (produto?.valor == null) return;
    const val = String(produto.valor);
    if (!val) return;
    setMatriculaForm((prev: any) => ({
      ...prev,
      valor_total: val,
      valor_contratado: prev.valor_contratado || val,
    }));
  }, [matriculaForm.produto_id, produtos]); // eslint-disable-line react-hooks/exhaustive-deps

  const valorFinalCalc =
    parseFloat(matriculaForm.valor_contratado) > 0
      ? parseFloat(matriculaForm.valor_contratado)
      : (parseFloat(matriculaForm.valor_total) || 0);

  const entradaValorCalc = parseFloat(matriculaForm.entrada_valor) || 0;
  const restanteCalc = Math.max(valorFinalCalc - entradaValorCalc, 0);
  const { toast } = useToast();
  const modoEntrada = matriculaForm.modalidade_pagamento === "entrada_parcelas";

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

  const modalidade: "ja_pago" | "a_pagar" = matriculaForm.modalidade_cobranca || "ja_pago";

  const isCredito = ["credito", "cartao", "cartao_credito"].includes(
    matriculaForm.forma_pagamento
  );

  const isDebito = matriculaForm.forma_pagamento === "debito";
  const isLink = matriculaForm.forma_pagamento === "link";
  const isBoleto = matriculaForm.forma_pagamento === "boleto";

  // Boleto NÃO tem taxa de máquina — só cartão, débito e link.
  const showTaxa =
    !isBoleto && (formaAtual?.abre_taxa || isCredito || isDebito || isLink);

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

    if (isLink) {
      const nome = `${parcelas}x`;

      const found = taxas.find(
        (t: any) => t.tipo === "link" && t.nome === nome
      );

      return found
        ? { percentual: Number(found.percentual), nome: `Link ${found.nome}` }
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

  // ── Taxa automática para a ENTRADA ──
  const isEntradaCredito = ["credito", "cartao", "cartao_credito"].includes(
    matriculaForm.entrada_forma_pagamento || ""
  );
  const isEntradaDebito = matriculaForm.entrada_forma_pagamento === "debito";
  const isEntradaLink = matriculaForm.entrada_forma_pagamento === "link";
  const isEntradaBoleto = matriculaForm.entrada_forma_pagamento === "boleto";
  const showEntradaTaxa =
    !isEntradaBoleto && (isEntradaCredito || isEntradaDebito || isEntradaLink);

  const entradaTaxaAutoCalc = useMemo(() => {
    if (!showEntradaTaxa || !taxas.length) return { percentual: 0, nome: "" };
    const numP = parseInt(matriculaForm.entrada_parcelas) || 1;
    if (isEntradaDebito) {
      const found = taxas.find((t: any) => t.tipo === "maquininha" && t.nome === "Débito");
      return found ? { percentual: Number(found.percentual), nome: found.nome } : { percentual: 0, nome: "Débito" };
    }
    if (isEntradaCredito) {
      const nome = numP === 1 ? "Crédito 1x" : `Crédito ${numP}x`;
      const found = taxas.find((t: any) => t.tipo === "maquininha" && t.nome === nome);
      return found ? { percentual: Number(found.percentual), nome: found.nome } : { percentual: 0, nome };
    }
    if (isEntradaLink) {
      const nome = `${numP}x`;
      const found = taxas.find((t: any) => t.tipo === "link" && t.nome === nome);
      return found ? { percentual: Number(found.percentual), nome: `Link ${found.nome}` } : { percentual: 0, nome: `Link ${nome}` };
    }
    return { percentual: 0, nome: "" };
  }, [showEntradaTaxa, isEntradaCredito, isEntradaDebito, isEntradaLink, matriculaForm.entrada_parcelas, taxas]);

  useEffect(() => {
    if (!modoEntrada || !showEntradaTaxa || entradaTaxaAutoCalc.percentual <= 0) return;
    const entradaVal = parseFloat(matriculaForm.entrada_valor) || 0;
    if (entradaVal <= 0) return;
    const taxaVal = Math.round(entradaVal * entradaTaxaAutoCalc.percentual / 100 * 100) / 100;
    const current = parseFloat(matriculaForm.entrada_taxa_valor) || 0;
    if (current !== taxaVal) {
      setMatriculaForm((p: any) => ({ ...p, entrada_taxa_valor: String(taxaVal) }));
    }
  }, [entradaTaxaAutoCalc.percentual, matriculaForm.entrada_valor, showEntradaTaxa, modoEntrada]);

  // ── Taxa automática para o RESTANTE ──
  const isRestanteCredito = ["credito", "cartao", "cartao_credito"].includes(matriculaForm.parcelas_forma_pagamento || "");
  const isRestanteDebito = (matriculaForm.parcelas_forma_pagamento || "") === "debito";
  const isRestanteLink = (matriculaForm.parcelas_forma_pagamento || "") === "link";
  const isRestanteBoleto = (matriculaForm.parcelas_forma_pagamento || "") === "boleto";
  const showRestanteTaxa = modoEntrada && !isRestanteBoleto && (isRestanteCredito || isRestanteDebito || isRestanteLink);

  const restanteTaxaAutoCalc = useMemo(() => {
    if (!showRestanteTaxa || !taxas.length) return { percentual: 0, nome: "" };
    const numP = parseInt(matriculaForm.parcelas) || 1;
    if (isRestanteDebito) {
      const found = taxas.find((t: any) => t.tipo === "maquininha" && t.nome === "Débito");
      return found ? { percentual: Number(found.percentual), nome: found.nome } : { percentual: 0, nome: "Débito" };
    }
    if (isRestanteCredito) {
      const nome = numP === 1 ? "Crédito 1x" : `Crédito ${numP}x`;
      const found = taxas.find((t: any) => t.tipo === "maquininha" && t.nome === nome);
      return found ? { percentual: Number(found.percentual), nome: found.nome } : { percentual: 0, nome };
    }
    if (isRestanteLink) {
      const nome = `${numP}x`;
      const found = taxas.find((t: any) => t.tipo === "link" && t.nome === nome);
      return found ? { percentual: Number(found.percentual), nome: `Link ${found.nome}` } : { percentual: 0, nome: `Link ${nome}` };
    }
    return { percentual: 0, nome: "" };
  }, [showRestanteTaxa, isRestanteCredito, isRestanteDebito, isRestanteLink, matriculaForm.parcelas, taxas]);

  useEffect(() => {
    if (!modoEntrada || !showRestanteTaxa || restanteTaxaAutoCalc.percentual <= 0) return;
    const current = parseFloat(matriculaForm.parcelas_taxa_cartao) || 0;
    if (current !== restanteTaxaAutoCalc.percentual) {
      setMatriculaForm((p: any) => ({ ...p, parcelas_taxa_cartao: String(restanteTaxaAutoCalc.percentual) }));
    }
  }, [restanteTaxaAutoCalc.percentual, showRestanteTaxa, modoEntrada]); // eslint-disable-line react-hooks/exhaustive-deps

  const taxaCalc = calcTaxaMaquina(
    valorFinalCalc,
    showTaxa ? taxaPercentual : 0,
    !!matriculaForm.repassar_taxa
  );

  const valorTaxa = taxaCalc.valorTaxa;

  const valorCobradoCalc = matriculaForm.repassar_taxa
    ? taxaCalc.valorCobrado
    : taxaCalc.valorLiquido;

  const valorParcelaCalc =
    numParcelasCalc > 0
      ? Math.round((valorCobradoCalc / numParcelasCalc) * 100) / 100
      : 0;

  useEffect(() => {
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

  const comprovanteInputRef = useRef<HTMLInputElement>(null);

  const comprovantesAtuais = Array.isArray(matriculaForm.comprovantes_urls)
    ? matriculaForm.comprovantes_urls
    : [];

  const comprovantesNovos = Array.isArray(matriculaForm.comprovantes_files)
    ? matriculaForm.comprovantes_files
    : [];

  const handleComprovantesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setMatriculaForm((p: any) => ({
      ...p,
      comprovantes_files: [...(Array.isArray(p.comprovantes_files) ? p.comprovantes_files : []), ...files],
    }));

    if (comprovanteInputRef.current) comprovanteInputRef.current.value = "";
  };

  const removerComprovanteNovo = (indexToRemove: number) => {
    setMatriculaForm((p: any) => ({
      ...p,
      comprovantes_files: (Array.isArray(p.comprovantes_files) ? p.comprovantes_files : []).filter(
        (_: File, index: number) => index !== indexToRemove
      ),
    }));
  };

  const removerComprovanteAtual = (indexToRemove: number) => {
    setMatriculaForm((p: any) => ({
      ...p,
      comprovantes_urls: (Array.isArray(p.comprovantes_urls) ? p.comprovantes_urls : []).filter(
        (_: any, index: number) => index !== indexToRemove
      ),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Step indicator */}
        <div className="flex items-center border-b pb-4 -mx-6 px-6 pt-1 gap-1">
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center font-bold shrink-0">1</div>
            <span className="text-xs font-semibold text-primary leading-tight">Nova Matrícula</span>
          </div>
          <div className="h-px flex-none w-4 bg-border" />
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[11px] flex items-center justify-center font-bold shrink-0">2</div>
            <span className="text-xs text-muted-foreground leading-tight">Financeiro do Aluno</span>
          </div>
          <div className="h-px flex-none w-4 bg-border" />
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[11px] flex items-center justify-center font-bold shrink-0">3</div>
            <span className="text-xs text-muted-foreground leading-tight">Registrar Pagamento</span>
          </div>
        </div>

        <DialogHeader className="pt-2">
          <DialogTitle>
            {editingMatriculaId ? "Editar Matrícula" : "Nova Matrícula"}
          </DialogTitle>
          <DialogDescription>
            {editingMatriculaId
              ? `Editando matrícula de ${selectedAlunoNome}`
              : `Matricular ${selectedAlunoNome}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 mt-2">
          {/* Produto + Turma */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Produto</Label>
              <Select value={matriculaForm.produto_id} onValueChange={handleProdutoChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
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
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Turma</Label>
              <Select
                value={matriculaForm.turma_id}
                onValueChange={(v) => {
                  const turmaSelecionada = turmasFiltradas.find((t: any) => t.id === v);

                  const produtoDaTurma = turmaSelecionada?.produto_id
                    ? produtos.find((p: any) => p.id === turmaSelecionada.produto_id)
                    : null;

                  const novoProdutoVal = produtoDaTurma?.valor != null ? String(produtoDaTurma.valor) : null;
                  setMatriculaForm((p) => ({
                    ...p,
                    turma_id: v,
                    produto_id: turmaSelecionada?.produto_id || p.produto_id,
                    valor_total: novoProdutoVal ?? p.valor_total,
                    valor_contratado: novoProdutoVal ?? p.valor_contratado,
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
              <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
              <SelectContent>
                {turmasFiltradas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
                {turmasFiltradas.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma turma disponível</div>
                )}
              </SelectContent>
            </Select>
            </div>
          </div>

          {/* Valor produto + Valor contratado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Valor do Produto</Label>
              <Input
                type="number" step="0.01" min="0"
                value={matriculaForm.valor_total}
                onChange={(e) => setMatriculaForm((p: any) => ({
                  ...p,
                  valor_total: e.target.value,
                  valor_contratado: p.valor_contratado === p.valor_total || !p.valor_contratado ? e.target.value : p.valor_contratado,
                }))}
                placeholder={matriculaForm.produto_id ? "Sem valor" : "Selecione o produto"}
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">Valor de referência</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Valor Contratado</Label>
              <Input
                type="number" step="0.01"
                value={matriculaForm.valor_contratado}
                onChange={(e) => setMatriculaForm((p) => ({ ...p, valor_contratado: e.target.value }))}
                placeholder="Igual ao produto ou negociado"
              />
              {parseFloat(matriculaForm.valor_total) > 0 && parseFloat(matriculaForm.valor_contratado) > 0 &&
                parseFloat(matriculaForm.valor_contratado) < parseFloat(matriculaForm.valor_total) && (
                <p className="text-[11px] text-primary mt-0.5">
                  Desconto de {formatCurrency(parseFloat(matriculaForm.valor_total) - parseFloat(matriculaForm.valor_contratado))} aplicado
                </p>
              )}
            </div>
          </div>

          {/* Comercial + % Comissão */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Comercial</Label>
              <Select
                value={matriculaForm.comercial_id || "nenhum"}
                onValueChange={(v) => setMatriculaForm((p) => ({ ...p, comercial_id: v === "nenhum" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {comerciais.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">% Comissão</Label>
              <Input
                type="number" min="0" max="100" step="0.5"
                value={matriculaForm.percentual_comissao}
                onChange={(e) => setMatriculaForm((p) => ({ ...p, percentual_comissao: e.target.value }))}
                placeholder="5"
                disabled={!matriculaForm.comercial_id}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Status</Label>
            <div className="flex gap-2 mt-1">
              {([["ativo", "Ativo"], ["trancado", "Trancado"], ["cancelado", "Cancelado"]] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMatriculaForm((p: any) => ({ ...p, status: val }))}
                  className={cn(
                    "flex-1 h-9 rounded-lg border text-sm font-medium transition-colors",
                    matriculaForm.status === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-foreground/30"
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Entrada agora? */}
          <div className="rounded-lg border p-4 space-y-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Entrada agora?</p>
                <p className="text-xs text-muted-foreground">O aluno dará um valor inicial no ato da matrícula</p>
              </div>
              <Switch
                checked={modoEntrada}
                onCheckedChange={(c) => setMatriculaForm((p: any) => ({ ...p, modalidade_pagamento: c ? "entrada_parcelas" : "unico", modalidade_cobranca: "a_pagar" }))}
              />
            </div>

            {/* ── MODO ENTRADA + PARCELAMENTO ── */}
            {modoEntrada && (
              <div className="space-y-4 pt-1">
                {/* Entrada */}
                <div className="rounded-md border p-3 space-y-3 bg-background">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrada (paga agora)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Valor da entrada (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={matriculaForm.entrada_valor}
                        onChange={(e) => setMatriculaForm((p: any) => ({ ...p, entrada_valor: e.target.value }))}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label>Data do pagamento</Label>
                      <Input
                        type="date"
                        value={matriculaForm.entrada_data}
                        onChange={(e) => setMatriculaForm((p: any) => ({ ...p, entrada_data: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Forma de pagamento</Label>
                      <Select
                        value={matriculaForm.entrada_forma_pagamento}
                        onValueChange={(v) => setMatriculaForm((p: any) => ({ ...p, entrada_forma_pagamento: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {formasPagamento.map((f) => (
                            <SelectItem key={f.id} value={f.codigo}>{f.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Conta bancária</Label>
                      <Select
                        value={matriculaForm.entrada_conta_bancaria_id}
                        onValueChange={(v) => setMatriculaForm((p: any) => ({ ...p, entrada_conta_bancaria_id: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {contasBancarias.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Parcelas da entrada — visível apenas para crédito ou link */}
                  {(isEntradaCredito || isEntradaLink) && (
                    <div>
                      <Label>Parcelas</Label>
                      <Select
                        value={matriculaForm.entrada_parcelas}
                        onValueChange={(v) => setMatriculaForm((p: any) => ({ ...p, entrada_parcelas: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="1x" /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                            <SelectItem key={n} value={n}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* Taxa da entrada */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Taxa da operação (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={matriculaForm.entrada_taxa_absorvida_por === "" || matriculaForm.entrada_taxa_absorvida_por === "nenhuma" ? (matriculaForm.entrada_taxa_absorvida_por === "nenhuma" ? "" : matriculaForm.entrada_taxa_valor) : matriculaForm.entrada_taxa_valor}
                        onChange={(e) => setMatriculaForm((p: any) => ({ ...p, entrada_taxa_valor: e.target.value }))}
                        placeholder={matriculaForm.entrada_taxa_absorvida_por === "nenhuma" ? "Sem taxa" : "0,00 — opcional"}
                        disabled={matriculaForm.entrada_taxa_absorvida_por === "" || matriculaForm.entrada_taxa_absorvida_por === "nenhuma"}
                      />
                      {showEntradaTaxa && entradaTaxaAutoCalc.percentual > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {entradaTaxaAutoCalc.nome} · {entradaTaxaAutoCalc.percentual.toFixed(2).replace(".", ",")}%
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>
                        Quem absorveu a taxa? <span className="text-destructive">*</span>
                      </Label>
                      <div className={cn("grid grid-cols-3 gap-1 mt-1 rounded-lg", matriculaForm.entrada_taxa_absorvida_por === "" && "ring-1 ring-destructive")}>
                        {(["nenhuma", "empresa", "aluno"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={cn(
                              "h-9 rounded-lg border text-xs font-medium transition-colors",
                              matriculaForm.entrada_taxa_absorvida_por === opt
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border"
                            )}
                            onClick={() => setMatriculaForm((p: any) => ({
                              ...p,
                              entrada_taxa_absorvida_por: opt,
                            }))}
                          >
                            {opt === "nenhuma" ? "Sem taxa" : opt === "empresa" ? "Empresa" : "Aluno"}
                          </button>
                        ))}
                      </div>
                      {matriculaForm.entrada_taxa_absorvida_por === "" && (
                        <p className="text-[11px] text-destructive mt-1">Selecione uma opção antes de salvar.</p>
                      )}
                      {/* Resumo do impacto da taxa */}
                      {(() => {
                        const taxaVal = parseFloat(matriculaForm.entrada_taxa_valor) || 0;
                        const entVal = parseFloat(matriculaForm.entrada_valor) || 0;
                        const absorvida = matriculaForm.entrada_taxa_absorvida_por;
                        if (absorvida === "nenhuma") {
                          return (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                              Nenhuma taxa aplicada — valor líquido igual ao cobrado.
                            </p>
                          );
                        }
                        if (absorvida === "empresa" && taxaVal > 0 && entVal > 0) {
                          return (
                            <p className="text-[11px] text-amber-600 mt-1 leading-snug">
                              Empresa absorve {formatCurrency(taxaVal)} de taxa — líquido recebido: <strong>{formatCurrency(entVal - taxaVal)}</strong>
                            </p>
                          );
                        }
                        if (absorvida === "aluno" && taxaVal > 0 && entVal > 0) {
                          return (
                            <p className="text-[11px] text-blue-600 mt-1 leading-snug">
                              Aluno pagou {formatCurrency(entVal + taxaVal)} no total ({formatCurrency(entVal)} + {formatCurrency(taxaVal)} de taxa)
                            </p>
                          );
                        }
                        if ((absorvida === "empresa" || absorvida === "aluno") && taxaVal <= 0) {
                          return (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                              Informe o valor da taxa para ver o impacto.
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {entradaValorCalc > 0 && restanteCalc > 0 && (
                  <div className="rounded-md border p-3 space-y-3 bg-background">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Restante a cobrar</p>
                      <p className="text-sm font-semibold text-amber-600">{formatCurrency(restanteCalc)}</p>
                    </div>

                    {/* Campos: Restante */}
                    {(
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Forma de pagamento</Label>
                            <Select value={matriculaForm.parcelas_forma_pagamento}
                              onValueChange={(v) => setMatriculaForm((p: any) => ({ ...p, parcelas_forma_pagamento: v }))}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {formasPagamento.map((f) => (
                                  <SelectItem key={f.id} value={f.codigo}>{f.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>1º Vencimento</Label>
                            <Input type="date" value={matriculaForm.parcelas_data_vencimento}
                              onChange={(e) => setMatriculaForm((p: any) => ({ ...p, parcelas_data_vencimento: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Conta bancária</Label>
                            <Select value={matriculaForm.parcelas_conta_bancaria_id}
                              onValueChange={(v) => setMatriculaForm((p: any) => ({ ...p, parcelas_conta_bancaria_id: v }))}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                {contasBancarias.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {(isRestanteCredito || isRestanteLink) && (
                            <div>
                              <Label>Parcelas do restante</Label>
                              <Select value={matriculaForm.parcelas}
                                onValueChange={(v) => setMatriculaForm((p: any) => ({ ...p, parcelas: v }))}
                              >
                                <SelectTrigger><SelectValue placeholder="1x" /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                                    <SelectItem key={n} value={n}>{n}x</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {showRestanteTaxa && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Taxa da operação (R$)</Label>
                              <Input type="number" step="0.01"
                                value={matriculaForm.parcelas_taxa_cartao}
                                onChange={(e) => setMatriculaForm((p: any) => ({ ...p, parcelas_taxa_cartao: e.target.value }))}
                                placeholder="0,00 — opcional"
                              />
                              {restanteTaxaAutoCalc.percentual > 0 && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {restanteTaxaAutoCalc.nome} · {restanteTaxaAutoCalc.percentual.toFixed(2).replace(".", ",")}%
                                </p>
                              )}
                            </div>
                            <div>
                              <Label>Repassar taxa?</Label>
                              <div className="flex items-center gap-2 mt-2">
                                <Switch
                                  checked={matriculaForm.parcelas_repassar_taxa || false}
                                  onCheckedChange={(c) => setMatriculaForm((p: any) => ({ ...p, parcelas_repassar_taxa: c }))}
                                />
                                <span className="text-sm">Repassar ao aluno</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
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

          <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Comprovante da matrícula</Label>
                <p className="text-xs text-muted-foreground">
                  Anexe um ou mais comprovantes de pagamento, contrato ou documento relacionado à matrícula.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => comprovanteInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Anexar comprovante
              </Button>
            </div>

            <Input
              ref={comprovanteInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleComprovantesChange}
            />

            {(comprovantesAtuais.length > 0 || comprovantesNovos.length > 0) ? (
              <div className="space-y-2">
                {comprovantesAtuais.map((comp: any, index: number) => (
                  <div
                    key={`${comp.url}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {comp.nome || `Comprovante ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">Arquivo já anexado</p>
                    </div>

                    <div className="flex items-center gap-1">
                      {comp.url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => abrirComprovante(comp.url)}
                          title="Abrir comprovante"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removerComprovanteAtual(index)}
                        title="Remover comprovante"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {comprovantesNovos.map((file: File, index: number) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-background px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">Novo anexo para enviar ao salvar</p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removerComprovanteNovo(index)}
                      title="Remover anexo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum comprovante anexado ainda.
              </p>
            )}
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

            <Button
              className="flex-1"
              onClick={() => {
                if (modoEntrada && matriculaForm.entrada_taxa_absorvida_por === "") {
                  toast({ title: "Campo obrigatório", description: "Selecione quem absorveu a taxa da entrada antes de salvar.", variant: "destructive" });
                  return;
                }
                onSave();
              }}
              disabled={isSaving}
            >
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