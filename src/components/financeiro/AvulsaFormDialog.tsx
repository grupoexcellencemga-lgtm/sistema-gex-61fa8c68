import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useEntradaTaxas, getDefaultImposto } from "@/hooks/useEntradaTaxas";
import { EntradaTaxaFields } from "./EntradaTaxaFields";

interface Props {
  editingAvulsa: any;
  contas: any[];
  categoriasReceita: any[];
  onSave: (form: any) => void;
  isSaving: boolean;
}

export const AvulsaFormDialog = ({ editingAvulsa, contas, categoriasReceita, onSave, isSaving }: Props) => {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [categoria, setCategoria] = useState("");
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [imposto, setImposto] = useState(9.5);
  const [repassarTaxa, setRepassarTaxa] = useState(false);
  const [dataVencimento, setDataVencimento] = useState("");

  const { data: taxas = [] } = useQuery({
    queryKey: ["taxas_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase.from("taxas_sistema").select("*").order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (editingAvulsa) {
      setDescricao(editingAvulsa.descricao || "");
      setValor(editingAvulsa.valor ? String(editingAvulsa.valor) : "");
      setData(editingAvulsa.data || new Date().toISOString().split("T")[0]);
      setCategoria(editingAvulsa.categoria || "");
      setContaBancariaId(editingAvulsa.conta_bancaria_id || "");
      setFormaPagamento(editingAvulsa.forma_pagamento || "");
      setObservacoes(editingAvulsa.observacoes || "");
      setParcelas(1);
      setRepassarTaxa(false);
      setDataVencimento("");
    } else {
      setDescricao("");
      setValor("");
      setData(new Date().toISOString().split("T")[0]);
      setCategoria("");
      setContaBancariaId("");
      setFormaPagamento("");
      setObservacoes("");
      setParcelas(1);
      setRepassarTaxa(false);
      setDataVencimento("");
    }
  }, [editingAvulsa]);

  useEffect(() => {
    if (taxas.length > 0) {
      setImposto(getDefaultImposto(taxas));
    }
  }, [taxas]);

  const valorNum = parseFloat(valor) || 0;
  const calc = useEntradaTaxas(formaPagamento, valorNum, parcelas, imposto, repassarTaxa);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: editingAvulsa?.id,
      descricao,
      valor: Number(valor),
      data,
      categoria: categoria || null,
      conta_bancaria_id: contaBancariaId || null,
      forma_pagamento: formaPagamento || null,
      observacoes: observacoes || null,
    });
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editingAvulsa ? "Editar Entrada Avulsa" : "Nova Entrada Avulsa"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                {categoriasReceita.map((c: any) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conta Bancária</Label>
            <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                {contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <EntradaTaxaFields
          formaPagamento={formaPagamento}
          onFormaPagamentoChange={(v) => { setFormaPagamento(v); setRepassarTaxa(false); }}
          parcelas={parcelas}
          onParcelasChange={setParcelas}
          impostoPercentual={imposto}
          onImpostoChange={setImposto}
          repassarTaxa={repassarTaxa}
          onRepassarTaxaChange={setRepassarTaxa}
          calc={calc}
          dataVencimento={dataVencimento}
          onDataVencimentoChange={setDataVencimento}
          taxas={taxas}
        />

        <div>
          <Label>Observações</Label>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
        </div>
        <Button type="submit" className="w-full" disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {editingAvulsa ? "Salvar Alterações" : "Registrar Entrada"}
        </Button>
      </form>
    </DialogContent>
  );
};
