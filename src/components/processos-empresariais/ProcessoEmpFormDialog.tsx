import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, UserCheck, FileUp, FileText, X } from "lucide-react";
import { formatCurrency, formatCurrencyInput, formatCNPJ, formatPhone } from "@/lib/formatters";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";

export interface ProcessoEmpForm {
  empresa_nome: string; cnpj: string; empresa_email: string; empresa_telefone: string;
  contato_nome: string; aluno_id: string; responsavel: string; percentual_empresa: number;
  percentual_profissional: number; valor_total: string; valor_entrada: string; parcelas: string;
  sessoes: string; status: string; conta_bancaria_id: string; forma_pagamento: string;
  observacoes: string; data_inicio: string;
  comercial_id: string; percentual_comissao: string; taxa_cartao: string;
}

export const emptyProcessoEmpForm: ProcessoEmpForm = {
  empresa_nome: "", cnpj: "", empresa_email: "", empresa_telefone: "",
  contato_nome: "", aluno_id: "", responsavel: "", percentual_empresa: 50,
  percentual_profissional: 50, valor_total: "", valor_entrada: "", parcelas: "1",
  sessoes: "1", status: "aberto", conta_bancaria_id: "", forma_pagamento: "",
  observacoes: "", data_inicio: new Date().toISOString().split("T")[0],
  comercial_id: "", percentual_comissao: "5", taxa_cartao: "",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: ProcessoEmpForm;
  setForm: React.Dispatch<React.SetStateAction<ProcessoEmpForm>>;
  onSubmit: () => void;
  isPending: boolean;
  isEditing: boolean;
  editing: any;
  tipoPagamento: "entrada" | "total";
  setTipoPagamento: (v: "entrada" | "total") => void;
  profissionais: any[];
  comerciais: any[];
  contas: any[];
  valorNumerico: number;
  propostaFile: File | null;
  setPropostaFile: (f: File | null) => void;
  uploadingProposta: boolean;
}

export function ProcessoEmpFormDialog({
  open, onOpenChange, form, setForm, onSubmit, isPending, isEditing, editing,
  tipoPagamento, setTipoPagamento, profissionais, comerciais, contas, valorNumerico,
  propostaFile, setPropostaFile, uploadingProposta,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: formasPagamento = [], isLoading: loadingFormasPagamento } = useFormasPagamento();

  const selectedFormaPagamento = formasPagamento.find((fp) => fp.codigo === form.forma_pagamento);

  const formaAbreParcelas =
    selectedFormaPagamento?.abre_parcelas ||
    ["cartao", "credito", "cartao_credito", "recorrencia_cartao"].includes(form.forma_pagamento);

  const formaAbreTaxa =
    selectedFormaPagamento?.abre_taxa ||
    ["cartao", "credito", "cartao_credito", "recorrencia_cartao"].includes(form.forma_pagamento);

  const handlePercentChange = (val: number[]) => {
    const emp = val[0];
    setForm(f => ({ ...f, percentual_empresa: emp, percentual_profissional: 100 - emp }));
  };

  const handleFormaPagamentoChange = (codigo: string) => {
    const formaSelecionada = formasPagamento.find((fp) => fp.codigo === codigo);

    const deveAbrirParcelas =
      formaSelecionada?.abre_parcelas ||
      ["cartao", "credito", "cartao_credito", "recorrencia_cartao"].includes(codigo);

    const deveAbrirTaxa =
      formaSelecionada?.abre_taxa ||
      ["cartao", "credito", "cartao_credito", "recorrencia_cartao"].includes(codigo);

    setForm(f => ({
      ...f,
      forma_pagamento: codigo,
      parcelas: deveAbrirParcelas ? f.parcelas || "1" : "1",
      taxa_cartao: deveAbrirTaxa ? f.taxa_cartao : "",
    }));
  };

  const renderPaymentFields = () => (
    <>
      <div className="space-y-2">
        <Label>Forma de Pagamento{tipoPagamento === "entrada" ? " (Entrada)" : ""}</Label>
        <Select value={form.forma_pagamento} onValueChange={handleFormaPagamentoChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar" />
          </SelectTrigger>
          <SelectContent>
            {loadingFormasPagamento ? (
              <SelectItem value="carregando_formas_pagamento" disabled>
                Carregando formas...
              </SelectItem>
            ) : formasPagamento.length === 0 ? (
              <SelectItem value="nenhuma_forma_pagamento" disabled>
                Nenhuma forma cadastrada
              </SelectItem>
            ) : (
              formasPagamento.map((fp) => (
                <SelectItem key={fp.id} value={fp.codigo}>
                  {fp.nome}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {formaAbreParcelas && (
        <div className="space-y-2">
          <Label>Quantidade de Vezes</Label>
          <Input
            type="number"
            min="1"
            value={form.parcelas}
            onChange={(e) => setForm(f => ({ ...f, parcelas: e.target.value }))}
          />
        </div>
      )}

      {formaAbreTaxa && (
        <div className="space-y-2">
          <Label>Taxa da Forma de Pagamento (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.taxa_cartao}
            onChange={(e) => setForm(f => ({ ...f, taxa_cartao: e.target.value }))}
            placeholder="Ex: 3.5"
          />
        </div>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Processo" : "Novo Processo Empresarial"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 max-h-[65vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Empresa *</Label>
              <Input value={form.empresa_nome} onChange={(e) => setForm(f => ({ ...f, empresa_nome: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Especialista *</Label>
              <Select value={form.responsavel} onValueChange={(v) => setForm(f => ({ ...f, responsavel: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar especialista..." /></SelectTrigger>
                <SelectContent>
                  {profissionais.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {profissionais.length === 0 && <p className="text-xs text-muted-foreground">Cadastre profissionais na aba Profissionais primeiro.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm(f => ({ ...f, cnpj: formatCNPJ(e.target.value) }))} placeholder="00.000.000/0000-00" maxLength={18} />
            </div>

            <div className="space-y-2">
              <Label>Nome do Contato</Label>
              <Input value={form.contato_nome} onChange={(e) => setForm(f => ({ ...f, contato_nome: e.target.value }))} placeholder="Pessoa de contato na empresa" />
            </div>

            <div className="space-y-2">
              <Label>E-mail da Empresa</Label>
              <Input type="email" value={form.empresa_email} onChange={(e) => setForm(f => ({ ...f, empresa_email: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Telefone da Empresa</Label>
              <Input value={form.empresa_telefone} onChange={(e) => setForm(f => ({ ...f, empresa_telefone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Divisão de Receita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Grupo Excellence: <strong>{form.percentual_empresa}%</strong>
                </span>
                <span className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-accent-foreground" />
                  Profissional: <strong>{form.percentual_profissional}%</strong>
                </span>
              </div>
              <Slider value={[form.percentual_empresa]} onValueChange={handlePercentChange} min={0} max={100} step={5} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0% Empresa</span>
                <span>100% Empresa</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Total do Processo (R$) *</Label>
              <Input value={form.valor_total} onChange={(e) => setForm(f => ({ ...f, valor_total: formatCurrencyInput(e.target.value) }))} placeholder="0,00" />
            </div>

            <div className="space-y-2">
              <Label>Qtd. Sessões</Label>
              <Input type="number" min="1" value={form.sessoes} onChange={(e) => setForm(f => ({ ...f, sessoes: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Como será o pagamento?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={tipoPagamento === "entrada" ? "default" : "outline"} className="w-full" onClick={() => setTipoPagamento("entrada")}>
                Entrada + Restante
              </Button>
              <Button type="button" variant={tipoPagamento === "total" ? "default" : "outline"} className="w-full" onClick={() => setTipoPagamento("total")}>
                Valor Total Completo
              </Button>
            </div>

            {tipoPagamento === "entrada" ? (
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    A empresa dará uma entrada agora. O restante será lançado depois conforme o acordo.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor da Entrada (R$)</Label>
                      <Input value={form.valor_entrada} onChange={(e) => setForm(f => ({ ...f, valor_entrada: formatCurrencyInput(e.target.value) }))} placeholder="0,00" />
                    </div>
                    {renderPaymentFields()}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderPaymentFields()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {valorNumerico > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium mb-2">Previsão de Divisão</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Grupo Excellence ({form.percentual_empresa}%):</span>
                  <p className="text-lg font-semibold text-primary">{formatCurrency(valorNumerico * form.percentual_empresa / 100)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Profissional ({form.percentual_profissional}%):</span>
                  <p className="text-lg font-semibold">{formatCurrency(valorNumerico * form.percentual_profissional / 100)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select value={form.conta_bancaria_id} onValueChange={(v) => setForm(f => ({ ...f, conta_bancaria_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.banco}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vendedor (Comercial)</Label>
              <Select value={form.comercial_id || "nenhum"} onValueChange={(v) => setForm(f => ({ ...f, comercial_id: v === "nenhum" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {comerciais.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.comercial_id && (
              <div className="space-y-2">
                <Label>% Comissão</Label>
                <Input type="number" min="0" max="100" step="0.5" value={form.percentual_comissao} onChange={(e) => setForm(f => ({ ...f, percentual_comissao: e.target.value }))} placeholder="5" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Proposta (PDF, Word, etc.)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPropostaFile(file);
              }}
            />

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="h-4 w-4 mr-1" />
                Selecionar Arquivo
              </Button>

              {propostaFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{propostaFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPropostaFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {editing?.proposta_url && !propostaFile && (
                <a href={editing.proposta_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <FileText className="h-4 w-4" />
                  Ver proposta atual
                </a>
              )}
            </div>
          </div>

          <Button onClick={onSubmit} disabled={isPending || uploadingProposta} className="w-full">
            {(isPending || uploadingProposta) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? "Salvar Alterações" : "Cadastrar Processo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}