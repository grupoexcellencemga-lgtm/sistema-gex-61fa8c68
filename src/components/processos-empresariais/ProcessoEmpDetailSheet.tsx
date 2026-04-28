import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Mail, Phone, Calendar, CreditCard, FileText } from "lucide-react";

import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatPhone, formatCNPJ } from "./processosEmpresariaisUtils";
import { useFormasPagamento, getFormaPagamentoLabel } from "@/hooks/useFormasPagamento";

export const DetalhesProcessoEmpDialog = ({ processo, onClose }: { processo: any; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const { data: formasPagamento = [] } = useFormasPagamento();
  const { data: lancamentos = [], refetch } = useQuery({
    queryKey: ["pagamentos_processo_empresarial", processo.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo_empresarial")
        .select("*")
        .eq("processo_id", processo.id)
        .is("deleted_at", null)
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos_processo_empresarial").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_empresarial_all"] });
      toast({ title: "Lançamento removido" });
    },
  });

  const total = Number(processo.valor_total || 0);
  const totalLancado = lancamentos.reduce((s: number, l: any) => s + Number(l.valor || 0), 0);
  const restante = Math.max(0, total - totalLancado);
  const sessoesRealizadas = Number(processo.sessoes_realizadas || 0);
  const sessoesTotal = Number(processo.sessoes || 1);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{processo.empresa_nome}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
          </TabsList>
          <TabsContent value="resumo" className="mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-2">
            <div className="space-y-2">
            {processo.cnpj && (
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">CNPJ:</span>
                <span className="font-medium">{formatCNPJ(processo.cnpj)}</span>
              </div>
            )}
            {processo.empresa_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">E-mail:</span>
                <span className="font-medium">{processo.empresa_email}</span>
              </div>
            )}
            {processo.empresa_telefone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Telefone:</span>
                <span className="font-medium">{formatPhone(processo.empresa_telefone)}</span>
              </div>
            )}
            {processo.contato_nome && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Contato:</span>
                <span className="font-medium">{processo.contato_nome}</span>
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Informações do Processo</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Especialista</p>
                <p className="text-sm font-semibold">{processo.responsavel}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Sessões</p>
                <p className="text-sm font-semibold">{sessoesRealizadas} / {sessoesTotal}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-sm font-semibold">{formatCurrency(total)}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Lançado</p>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(totalLancado)}</p>
              </div>
              <div className="rounded-lg border p-3 text-center col-span-2">
                <p className="text-xs text-muted-foreground">Restante a Pagar</p>
                <p className={cn("text-sm font-semibold", restante > 0 ? "text-orange-600" : "text-green-600")}>
                  {formatCurrency(restante)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Empresa</p>
                <p className="text-sm font-semibold text-primary">{processo.percentual_empresa}% — {formatCurrency(total * processo.percentual_empresa / 100)}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Profissional</p>
                <p className="text-sm font-semibold">{processo.percentual_profissional}% — {formatCurrency(total * processo.percentual_profissional / 100)}</p>
              </div>
            </div>
          </div>

          {processo.status === "cancelado" && processo.motivo_cancelamento && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-1">Motivo do Cancelamento</p>
              <p className="text-sm text-destructive">{processo.motivo_cancelamento}</p>
            </div>
          )}

          {lancamentos.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Histórico de Lançamentos</p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {lancamentos.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={l.tipo === "entrada" ? "default" : "outline"} className="text-xs">
                        {l.tipo === "entrada" ? "Entrada" : l.tipo === "parcela" ? "Parcela" : "Pagamento"}
                      </Badge>
                      <span className="text-muted-foreground">{formatDate(l.data)}</span>
                      {l.forma_pagamento && (
                        <span className="text-xs text-muted-foreground">
                          • {getFormaPagamentoLabel(l.forma_pagamento, formasPagamento)}
                          {l.observacoes?.match(/(\d+)x/)?.[0] && ` ${l.observacoes.match(/(\d+)x/)?.[0]}`}
                          {Number(l.taxa_cartao || 0) > 0 && ` (taxa ${l.taxa_cartao}%)`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <span className="font-medium whitespace-nowrap">{formatCurrency(Number(l.valor))}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        if (confirm("Remover este lançamento?")) deleteMutation.mutate(l.id);
                      }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {processo.proposta_url && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-1">Proposta</p>
              <a href={processo.proposta_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <FileText className="h-4 w-4" /> Ver Proposta
              </a>
            </div>
          )}

          {processo.observacoes && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm">{processo.observacoes}</p>
            </div>
          )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
