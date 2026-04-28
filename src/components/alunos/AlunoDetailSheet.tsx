import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppDialog, WhatsAppHistory } from "@/components/WhatsAppDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, GraduationCap, Plus, Loader2, Clock, FileText, MessageSquare, Receipt, CheckSquare } from "lucide-react";
import { gerarReciboPagamento } from "@/lib/pdfUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatPhone, formatCPF } from "@/lib/utils";
import { formatDate, formatCurrency, calcMultaJuros } from "./alunosUtils";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { TarefasContextSection } from "@/components/tarefas/TarefasContextSection";
import { useFormasPagamento, getFormaPagamentoLabel } from "@/hooks/useFormasPagamento";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedAluno: any;
  matriculas: any[];
  pagamentos: any[];
  contasBancarias: any[];
  onEdit: (aluno: any) => void;
  onDeleteAluno: () => void;
  deleteAlunoDialogOpen: boolean;
  setDeleteAlunoDialogOpen: (v: boolean) => void;
  deleteAlunoMutation: any;
  onNewMatricula: () => void;
  onEditMatricula: (m: any) => void;
  onDeleteMatricula: (id: string) => void;
  onNewPagamento: () => void;
  onConfirmPagamento: (p: any, fees: any) => void;
  onDesfazerPagamento: (p: any) => void;
  onEditPagamento: (p: any) => void;
  onDeletePagamento: (id: string) => void;
  // Parcelas detail
  parcelasDetailOpen: boolean;
  setParcelasDetailOpen: (v: boolean) => void;
  selectedParcelas: any[];
  setSelectedParcelas: (v: any) => void;
  // Edit pagamento dialog
  editPagamentoDialog: boolean;
  setEditPagamentoDialog: (v: boolean) => void;
  editPagForm: any;
  setEditPagForm: (fn: (prev: any) => any) => void;
  onSavePagamento: () => void;
  updatePagamentoIsPending: boolean;
  // Novo pagamento dialog
  novoPagamentoDialog: boolean;
  setNovoPagamentoDialog: (v: boolean) => void;
  novoPagForm: any;
  setNovoPagForm: (fn: (prev: any) => any) => void;
  onSaveNovoPagamento: () => void;
  insertPagamentoIsPending: boolean;
}

export const AlunoDetailSheet = (props: Props) => {
  const {
    open, onOpenChange, selectedAluno, matriculas, pagamentos, contasBancarias,
    onEdit, deleteAlunoDialogOpen, setDeleteAlunoDialogOpen, deleteAlunoMutation,
    onNewMatricula, onEditMatricula, onDeleteMatricula,
    onNewPagamento, onConfirmPagamento, onDesfazerPagamento, onEditPagamento, onDeletePagamento,
    parcelasDetailOpen, setParcelasDetailOpen, selectedParcelas, setSelectedParcelas,
    editPagamentoDialog, setEditPagamentoDialog, editPagForm, setEditPagForm, onSavePagamento, updatePagamentoIsPending,
    novoPagamentoDialog, setNovoPagamentoDialog, novoPagForm, setNovoPagForm, onSaveNovoPagamento, insertPagamentoIsPending,
  } = props;
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const { data: formasPagamento = [] } = useFormasPagamento();

  const getFormaLabel = (codigo: string | null | undefined) => getFormaPagamentoLabel(codigo, formasPagamento);
  const getFormaConfig = (codigo: string | null | undefined) => formasPagamento.find((f) => f.codigo === codigo);

  const { data: taxasSistema = [] } = useQuery({
    queryKey: ["taxas_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taxas_sistema")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const novoValorBase = parseFloat(novoPagForm.valor) || 0;
  const novoParcelasCalc = parseInt(novoPagForm.parcelas_cartao) || 1;
  const novoFormaConfig = getFormaConfig(novoPagForm.forma_pagamento);
  const novoTipoForma = novoFormaConfig?.tipo || "";
  const novoIsCartaoCredito =
    novoTipoForma === "credito" ||
    ["credito", "cartao", "cartao_credito", "recorrencia_cartao"].includes(novoPagForm.forma_pagamento);
  const novoIsLink = novoTipoForma === "link" || novoPagForm.forma_pagamento === "link";
  const novoIsBoleto = novoTipoForma === "boleto" || novoPagForm.forma_pagamento === "boleto";
  const novoShowTaxa = Boolean(novoFormaConfig?.abre_taxa) || novoIsCartaoCredito || novoIsLink || novoIsBoleto;

  const novoTaxaAutoCalc = useMemo(() => {
    if (!novoShowTaxa || !taxasSistema.length) return { percentual: 0, nome: "" };

    if (novoIsCartaoCredito) {
      const nome = novoParcelasCalc === 1 ? "Crédito 1x" : `Crédito ${novoParcelasCalc}x`;
      const found = taxasSistema.find((t: any) => t.tipo === "maquininha" && t.nome === nome);
      return found ? { percentual: Number(found.percentual), nome: found.nome } : { percentual: 0, nome };
    }

    if (novoIsLink || novoIsBoleto) {
      const nome = `${novoParcelasCalc}x`;
      const found = taxasSistema.find((t: any) => t.tipo === "link" && t.nome === nome);
      return found ? { percentual: Number(found.percentual), nome: found.nome } : { percentual: 0, nome };
    }

    return { percentual: 0, nome: "" };
  }, [novoShowTaxa, novoIsCartaoCredito, novoIsLink, novoIsBoleto, novoParcelasCalc, taxasSistema]);

  const novoTaxaPercentual = novoTaxaAutoCalc.percentual;
  const novoValorTaxa = novoValorBase > 0 ? Math.round(novoValorBase * novoTaxaPercentual) / 100 : 0;
  const novoValorComTaxa = novoPagForm.repassar_taxa && novoShowTaxa ? novoValorBase + novoValorTaxa : novoValorBase;

  useEffect(() => {
    if (novoShowTaxa && novoTaxaPercentual > 0) {
      const current = parseFloat(novoPagForm.taxa_cartao);
      if (current !== novoTaxaPercentual) {
        setNovoPagForm((p: any) => ({ ...p, taxa_cartao: String(novoTaxaPercentual) }));
      }
    } else if (!novoShowTaxa && (novoPagForm.taxa_cartao || novoPagForm.repassar_taxa)) {
      setNovoPagForm((p: any) => ({ ...p, taxa_cartao: "", repassar_taxa: false }));
    }
  }, [novoShowTaxa, novoTaxaPercentual, novoPagForm.taxa_cartao, novoPagForm.repassar_taxa, setNovoPagForm]);

  const totalPago = pagamentos.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalPendente = pagamentos.filter((p: any) => p.status === "pendente").reduce((s: number, p: any) => s + Number(p.valor), 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col h-[100dvh]">
          {selectedAluno && (
            <div className="flex flex-col h-full min-h-0">
              <div className="px-6 pt-6 pb-3 pr-14 shrink-0">
                <SheetHeader className="p-0">
                  <SheetTitle>{selectedAluno.nome}</SheetTitle>
                  <div className="flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => onEdit(selectedAluno)}><Pencil className="h-3.5 w-3.5 mr-1.5" />Editar</Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteAlunoDialogOpen(true)}><Trash2 className="h-3.5 w-3.5 mr-1.5" />Excluir</Button>
                  </div>
                </SheetHeader>
              </div>

              <Tabs defaultValue="dados" className="flex flex-col min-h-0 flex-1">
                <div className="overflow-x-auto no-scrollbar -mx-1 px-1 shrink-0 px-6">
                  <TabsList className="w-max min-w-full">
                    <TabsTrigger value="dados">Dados</TabsTrigger>
                    <TabsTrigger value="matriculas">Matrículas</TabsTrigger>
                    <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                    <TabsTrigger value="atividades"><Clock className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
                    <TabsTrigger value="auditoria"><FileText className="h-3.5 w-3.5 mr-1" />Auditoria</TabsTrigger>
                    <TabsTrigger value="tarefas"><CheckSquare className="h-3.5 w-3.5 mr-1" />Tarefas</TabsTrigger>
                    <TabsTrigger value="whatsapp"><MessageSquare className="h-3.5 w-3.5 mr-1" />WhatsApp</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
                <TabsContent value="dados" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Email:</span><p>{selectedAluno.email || "—"}</p></div>
                    <div>
                      <span className="text-muted-foreground">Telefone:</span>
                      <div className="flex items-center gap-1">
                        <p>{formatPhone(selectedAluno.telefone) || "—"}</p>
                        {selectedAluno.telefone && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWhatsappOpen(true)} title="Enviar WhatsApp">
                            <MessageSquare className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div><span className="text-muted-foreground">Nascimento:</span><p>{formatDate(selectedAluno.data_nascimento)}</p></div>
                    <div><span className="text-muted-foreground">Sexo:</span><p>{selectedAluno.sexo || "—"}</p></div>
                    <div><span className="text-muted-foreground">CPF:</span><p>{formatCPF(selectedAluno.cpf) || "—"}</p></div>
                  </div>
                </TabsContent>

                <TabsContent value="matriculas" className="mt-4 space-y-4">
                  <Button size="sm" onClick={onNewMatricula}>
                    <GraduationCap className="h-4 w-4 mr-2" />Nova Matrícula
                  </Button>
                  {matriculas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma matrícula registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {matriculas.map((m: any) => (
                        <div key={m.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{m.produtos?.nome || "Produto"}</span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditMatricula(m)}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm("Excluir matrícula e todos os pagamentos vinculados?")) onDeleteMatricula(m.id); }}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                              <Badge variant={m.status === "ativo" ? "default" : m.status === "cancelado" ? "destructive" : "secondary"}>{m.status}</Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">Turma: {m.turmas?.nome || "—"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(m.data_inicio)} → {formatDate(m.data_fim)}</p>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span>Total: {formatCurrency(Number(m.valor_total || 0))}</span>
                            {Number(m.desconto) > 0 && <span className="text-emerald-600">Desc: -{formatCurrency(Number(m.desconto))}</span>}
                            <span className="font-semibold">Final: {formatCurrency(Number(m.valor_final || 0))}</span>
                          </div>
                          {m.observacoes && <p className="text-xs text-muted-foreground mt-1">{m.observacoes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="atividades" className="mt-4">
                  <ActivityTimeline alunoId={selectedAluno.id} />
                </TabsContent>

                <TabsContent value="auditoria" className="mt-4">
                  <AuditLogTab registroId={selectedAluno.id} tabela="alunos" />
                </TabsContent>

                <TabsContent value="tarefas" className="mt-4">
                  <TarefasContextSection alunoId={selectedAluno.id} />
                </TabsContent>

                <TabsContent value="whatsapp" className="mt-4">
                  <WhatsAppHistory entidadeTipo="aluno" entidadeId={selectedAluno.id} />
                </TabsContent>

                <TabsContent value="financeiro" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Parcelas são geradas automaticamente ao criar uma matrícula.</p>
                    <Button size="sm" onClick={onNewPagamento}>
                      <Plus className="h-4 w-4 mr-1.5" />Novo Pagamento
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Total pago</p>
                      <p className="text-lg font-semibold text-primary">{formatCurrency(totalPago)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Pendente</p>
                      <p className="text-lg font-semibold text-warning">{formatCurrency(totalPendente)}</p>
                    </div>
                  </div>

                  {pagamentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado</p>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const grouped: any[] = [];
                        const cartaoGroups: Record<string, any[]> = {};

                        pagamentos.forEach((p: any) => {
                          if (["credito", "cartao", "cartao_credito", "recorrencia_cartao"].includes(p.forma_pagamento) && p.parcelas > 1) {
                            const key = `${p.produto_id || "none"}-${p.parcelas}-${p.matricula_id || "none"}`;
                            if (!cartaoGroups[key]) cartaoGroups[key] = [];
                            cartaoGroups[key].push(p);
                          } else if (p.parcelas > 1) {
                            const key = `${p.matricula_id || p.produto_id || "none"}-${p.parcelas}`;
                            if (!cartaoGroups[key]) cartaoGroups[key] = [];
                            cartaoGroups[key].push(p);
                          } else {
                            grouped.push({ type: "single", data: p });
                          }
                        });

                        Object.values(cartaoGroups).forEach((items) => {
                          grouped.push({ type: "group", data: items });
                        });

                        return grouped.map((item, idx) => {
                          if (item.type === "group") {
                            const items = item.data as any[];
                            const totalGrupo = items.reduce((s: number, p: any) => s + Number(p.valor), 0);
                            const pagas = items.filter((p: any) => p.status === "pago").length;
                            return (
                              <div
                                key={`group-${idx}`}
                                className="rounded-lg border p-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                                onClick={() => { setSelectedParcelas(items.sort((a: any, b: any) => a.parcela_atual - b.parcela_atual)); setParcelasDetailOpen(true); }}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{formatCurrency(totalGrupo)} · {items.length}x de {formatCurrency(Number(items[0].valor))}</p>
                                    <p className="text-xs text-muted-foreground">{items[0]?.produtos?.nome || "—"} · {getFormaLabel(items[0]?.forma_pagamento)} · {pagas}/{items.length} pagas</p>
                                  </div>
                                  <Badge variant={pagas === items.length ? "default" : "secondary"}>
                                    {pagas === items.length ? "Quitado" : `${pagas}/${items.length}`}
                                  </Badge>
                                </div>
                              </div>
                            );
                          }
                          const p = item.data;
                          const fees = calcMultaJuros(p);
                          return (
                            <div key={p.id} className="rounded-lg border p-3 text-sm flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {formatCurrency(Number(p.valor))}
                                  {["credito", "cartao", "cartao_credito", "recorrencia_cartao"].includes(p.forma_pagamento) && p.parcelas_cartao && ` · ${p.parcelas_cartao}x no cartão`}
                                  {["credito", "cartao", "cartao_credito", "recorrencia_cartao"].includes(p.forma_pagamento) && !p.parcelas_cartao && " · 1x no cartão"}
                                  {["credito", "cartao", "cartao_credito", "recorrencia_cartao"].includes(p.forma_pagamento) && (p as any).taxa_cartao > 0 && ` · Taxa: ${(p as any).taxa_cartao}%`}
                                </p>
                                <p className="text-xs text-muted-foreground">{p.produtos?.nome || "—"} · {getFormaLabel(p.forma_pagamento)}</p>
                                <p className="text-xs text-muted-foreground">Venc: {formatDate(p.data_vencimento)}</p>
                                {fees.multa > 0 && (
                                  <p className="text-xs text-destructive">+{formatCurrency(fees.multa + fees.juros)} multa/juros</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {p.status === "pendente" && (
                                  <Button variant="outline" size="sm" onClick={() => onConfirmPagamento(p, fees)}>
                                    Confirmar
                                  </Button>
                                )}
                                {p.status === "pago" && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Gerar Recibo" onClick={() => gerarReciboPagamento({
                                      alunoNome: selectedAluno?.nome || "—",
                                      alunoCpf: selectedAluno?.cpf || undefined,
                                      produtoNome: p.produtos?.nome || "—",
                                      valor: Number(p.valor),
                                      dataPagamento: p.data_pagamento ? new Date(p.data_pagamento + "T12:00").toLocaleDateString("pt-BR") : undefined,
                                      formaPagamento: getFormaLabel(p.forma_pagamento),
                                      reciboId: p.id,
                                    })}><Receipt className="h-3.5 w-3.5 text-primary" /></Button>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDesfazerPagamento(p)}>
                                      Desfazer
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditPagamento(p)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Excluir este pagamento?")) onDeletePagamento(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                <Badge variant={p.status === "pago" ? "default" : p.status === "vencido" ? "destructive" : "secondary"}>{p.status}</Badge>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog - Confirmar exclusão do aluno */}
      <AlertDialog open={deleteAlunoDialogOpen} onOpenChange={setDeleteAlunoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá excluir <strong>{selectedAluno?.nome}</strong> e todos os dados relacionados: matrículas, pagamentos, comissões, presenças, inscrições e atividades. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedAluno && deleteAlunoMutation.mutate(selectedAluno.id)}
              disabled={deleteAlunoMutation.isPending}
            >
              {deleteAlunoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog - Detalhes das Parcelas */}
      <Dialog open={parcelasDetailOpen} onOpenChange={setParcelasDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes das Parcelas</DialogTitle>
            <DialogDescription>
              {selectedParcelas[0]?.produtos?.nome || "Produto"} · {selectedParcelas.length} parcela(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto">
            {selectedParcelas.map((p: any) => {
              const fees = calcMultaJuros(p);
              return (
                <div key={p.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Parcela {p.parcela_atual}/{p.parcelas} — {formatCurrency(Number(p.valor))}</p>
                      <p className="text-xs text-muted-foreground">Venc: {formatDate(p.data_vencimento)}{p.data_pagamento ? ` · Pago: ${formatDate(p.data_pagamento)}` : ""}</p>
                      {fees.multa > 0 && (
                        <p className="text-xs text-destructive mt-0.5">
                          Multa: {formatCurrency(fees.multa)} + Juros: {formatCurrency(fees.juros)} = Total: {formatCurrency(fees.total)}
                          <span className="text-muted-foreground"> ({fees.diasAtraso} dias)</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === "pendente" && (
                        <Button variant="outline" size="sm" onClick={() => onConfirmPagamento(p, fees)}>
                          Confirmar
                        </Button>
                      )}
                      {p.status === "pago" && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDesfazerPagamento(p)}>
                          Desfazer
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditPagamento(p)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Excluir este pagamento?")) onDeletePagamento(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      <Badge variant={p.status === "pago" ? "default" : p.status === "vencido" ? "destructive" : "secondary"}>{p.status}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog - Editar Pagamento */}
      <Dialog open={editPagamentoDialog} onOpenChange={setEditPagamentoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={editPagForm.valor} onChange={(e) => setEditPagForm(p => ({ ...p, valor: e.target.value }))} /></div>
            <div><Label>Data de vencimento</Label><Input type="date" value={editPagForm.data_vencimento} onChange={(e) => setEditPagForm(p => ({ ...p, data_vencimento: e.target.value }))} /></div>
            <div><Label>Forma de pagamento</Label>
              <Select value={editPagForm.forma_pagamento} onValueChange={(v) => setEditPagForm(p => ({ ...p, forma_pagamento: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.length === 0 ? (
                    <SelectItem value="nenhuma_forma_pagamento" disabled>
                      Nenhuma forma cadastrada
                    </SelectItem>
                  ) : (
                    formasPagamento.map((forma) => (
                      <SelectItem key={forma.id} value={forma.codigo}>
                        {forma.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Conta Bancária</Label>
              <Select value={editPagForm.conta_bancaria_id} onValueChange={(v) => setEditPagForm(p => ({ ...p, conta_bancaria_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={onSavePagamento} disabled={updatePagamentoIsPending}>
              {updatePagamentoIsPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog - Novo Pagamento Avulso */}
      <Dialog open={novoPagamentoDialog} onOpenChange={setNovoPagamentoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Pagamento</DialogTitle>
            <DialogDescription>Lançar pagamento adicional para {selectedAluno?.nome}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            <div><Label>Matrícula (opcional)</Label>
              <Select value={novoPagForm.matricula_id} onValueChange={(v) => {
                const mat = (matriculas || []).find((m: any) => m.id === v);
                setNovoPagForm(p => ({ ...p, matricula_id: v, produto_id: mat?.produto_id || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Vincular a uma matrícula" /></SelectTrigger>
                <SelectContent>
                  {(matriculas || []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.produtos?.nome || "Produto"} — {m.turmas?.nome || "Sem turma"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={novoPagForm.valor} onChange={(e) => setNovoPagForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" /></div>
            <div><Label>Data de vencimento</Label><Input type="date" value={novoPagForm.data_vencimento} onChange={(e) => setNovoPagForm(p => ({ ...p, data_vencimento: e.target.value }))} /></div>
            <div><Label>Forma de pagamento</Label>
              <Select value={novoPagForm.forma_pagamento} onValueChange={(v) => setNovoPagForm(p => ({ ...p, forma_pagamento: v, repassar_taxa: false }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.length === 0 ? (
                    <SelectItem value="nenhuma_forma_pagamento" disabled>
                      Nenhuma forma cadastrada
                    </SelectItem>
                  ) : (
                    formasPagamento.map((forma) => (
                      <SelectItem key={forma.id} value={forma.codigo}>
                        {forma.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {novoShowTaxa && (
              <div className="rounded-md border p-3 bg-accent/30 space-y-2">
                <div>
                  <Label>Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    value={novoPagForm.parcelas_cartao || "1"}
                    onChange={(e) => setNovoPagForm((p: any) => ({ ...p, parcelas_cartao: e.target.value }))}
                    placeholder="1"
                  />
                </div>

                {novoTaxaPercentual > 0 ? (
                  <>
                    <div>
                      <p className="text-sm font-medium">
                        Taxa: {novoTaxaAutoCalc.nome} — {novoTaxaPercentual.toFixed(2).replace(".", ",")}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valor da taxa: {formatCurrency(novoValorTaxa)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={novoPagForm.repassar_taxa || false}
                        onCheckedChange={(checked) => setNovoPagForm((p: any) => ({ ...p, repassar_taxa: checked }))}
                      />
                      <Label className="text-sm cursor-pointer">Repassar taxa para o cliente</Label>
                    </div>

                    {novoPagForm.repassar_taxa && (
                      <div className="text-sm bg-background rounded p-2">
                        <span className="text-muted-foreground">Cliente pagará: </span>
                        <span className="font-semibold">{formatCurrency(novoValorComTaxa)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma taxa automática encontrada para esta forma de pagamento/parcela.
                  </p>
                )}
              </div>
            )}
            <div><Label>Conta Bancária</Label>
              <Select value={novoPagForm.conta_bancaria_id} onValueChange={(v) => setNovoPagForm(p => ({ ...p, conta_bancaria_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.banco})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={onSaveNovoPagamento} disabled={insertPagamentoIsPending}>
              {insertPagamentoIsPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Lançar Pagamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <WhatsAppDialog open={whatsappOpen} onOpenChange={setWhatsappOpen} telefone={selectedAluno?.telefone || ""} nome={selectedAluno?.nome || ""} entidadeTipo="aluno" entidadeId={selectedAluno?.id} />
    </>
  );
};

function AuditLogTab({ registroId, tabela }: { registroId: string; tabela: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs-registro", tabela, registroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("tabela", tabela)
        .eq("registro_id", registroId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (logs.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de auditoria.</p>;

  return (
    <div className="space-y-3">
      {logs.map((log: any) => (
        <div key={log.id} className="border rounded-lg p-3 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium">{log.user_nome || "Sistema"}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          </div>
          <p className="text-muted-foreground">Ação: <span className="font-medium text-foreground">{log.acao}</span></p>
          {log.dados_anteriores && log.dados_novos && log.acao === "editar" && (
            <details className="text-xs mt-1">
              <summary className="cursor-pointer text-primary">Ver alterações</summary>
              <div className="mt-2 space-y-1">
                {Object.keys(log.dados_novos).filter((k) => JSON.stringify(log.dados_anteriores[k]) !== JSON.stringify(log.dados_novos[k])).map((k) => (
                  <div key={k} className="grid grid-cols-3 gap-1">
                    <span className="font-medium">{k}</span>
                    <span className="text-destructive line-through">{log.dados_anteriores[k] === null ? "null" : String(log.dados_anteriores[k])}</span>
                    <span className="text-primary">{log.dados_novos[k] === null ? "null" : String(log.dados_novos[k])}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
