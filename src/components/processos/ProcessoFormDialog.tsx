import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, UserCheck, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyInput, formatCPF, formatPhone } from "@/lib/formatters";

export interface ProcessoIndForm {
  cliente_nome: string; cliente_email: string; cliente_telefone: string;
  cpf: string; data_nascimento: string;
  aluno_id: string; responsavel: string; percentual_empresa: number;
  percentual_profissional: number; valor_total: string; valor_entrada: string; parcelas: string;
  sessoes: string; status: string; conta_bancaria_id: string; forma_pagamento: string;
  observacoes: string; data_inicio: string;
  comercial_id: string; percentual_comissao: string; taxa_cartao: string;
}

export const emptyProcessoIndForm: ProcessoIndForm = {
  cliente_nome: "", cliente_email: "", cliente_telefone: "",
  cpf: "", data_nascimento: "",
  aluno_id: "", responsavel: "", percentual_empresa: 50,
  percentual_profissional: 50, valor_total: "", valor_entrada: "", parcelas: "1",
  sessoes: "1", status: "aberto", conta_bancaria_id: "", forma_pagamento: "",
  observacoes: "", data_inicio: new Date().toISOString().split("T")[0],
  comercial_id: "", percentual_comissao: "5", taxa_cartao: "",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: ProcessoIndForm;
  setForm: React.Dispatch<React.SetStateAction<ProcessoIndForm>>;
  onSubmit: () => void;
  isPending: boolean;
  isEditing: boolean;
  tipoPagamento: "entrada" | "total";
  setTipoPagamento: (v: "entrada" | "total") => void;
  alunos: any[];
  profissionais: any[];
  comerciais: any[];
  contas: any[];
  valorNumerico: number;
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "cartao", label: "Cartão" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "cheque", label: "Cheque" },
  { value: "permuta", label: "Permuta" },
  { value: "recorrencia_cartao", label: "Recorrência no Cartão" },
];

export function ProcessoFormDialog({
  open, onOpenChange, form, setForm, onSubmit, isPending, isEditing,
  tipoPagamento, setTipoPagamento, alunos, profissionais, comerciais, contas, valorNumerico,
}: Props) {
  const [alunoPopoverOpen, setAlunoPopoverOpen] = useState(false);

  const selectedAlunoName = useMemo(() => {
    if (!form.aluno_id) return "";
    return alunos.find((a: any) => a.id === form.aluno_id)?.nome || "";
  }, [form.aluno_id, alunos]);

  const selectAluno = (alunoId: string) => {
    const aluno = alunos.find((a: any) => a.id === alunoId);
    if (aluno) {
      setForm(f => ({
        ...f, aluno_id: alunoId, cliente_nome: aluno.nome,
        cliente_email: aluno.email || f.cliente_email,
        cliente_telefone: aluno.telefone ? formatPhone(aluno.telefone) : f.cliente_telefone,
        cpf: aluno.cpf ? formatCPF(aluno.cpf) : f.cpf,
        data_nascimento: aluno.data_nascimento || f.data_nascimento,
      }));
    }
    setAlunoPopoverOpen(false);
  };

  const handlePercentChange = (val: number[]) => {
    const emp = val[0];
    setForm(f => ({ ...f, percentual_empresa: emp, percentual_profissional: 100 - emp }));
  };

  const handleFormaPagamentoChange = (v: string) => {
    setForm(f => ({ ...f, forma_pagamento: v, parcelas: v === "cartao" ? f.parcelas || "1" : "1", taxa_cartao: v === "cartao" ? f.taxa_cartao : "" }));
  };

  const renderPaymentFields = () => (
    <>
      <div className="space-y-2">
        <Label>Forma de Pagamento{tipoPagamento === "entrada" ? " (Entrada)" : ""}</Label>
        <Select value={form.forma_pagamento} onValueChange={handleFormaPagamentoChange}>
          <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
          <SelectContent>
            {FORMAS_PAGAMENTO.map(fp => <SelectItem key={fp.value} value={fp.value}>{fp.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {form.forma_pagamento === "cartao" && (
        <>
          <div className="space-y-2">
            <Label>Quantidade de Vezes</Label>
            <Input type="number" min="1" value={form.parcelas} onChange={(e) => setForm(f => ({ ...f, parcelas: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Taxa do Cartão (%)</Label>
            <Input type="number" min="0" max="100" step="0.1" value={form.taxa_cartao} onChange={(e) => setForm(f => ({ ...f, taxa_cartao: e.target.value }))} placeholder="Ex: 3.5" />
          </div>
        </>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Processo" : "Novo Processo Individual"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 max-h-[65vh] overflow-y-auto pr-2">
          {/* Vincular a Aluno */}
          <div className="space-y-2">
            <Label>Vincular a Aluno (opcional)</Label>
            <Popover open={alunoPopoverOpen} onOpenChange={setAlunoPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedAlunoName || "Pesquisar aluno..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                <Command>
                  <CommandInput placeholder="Digite o nome do aluno..." />
                  <CommandList>
                    <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                    <CommandGroup>
                      {alunos.map((a: any) => (
                        <CommandItem key={a.id} value={a.nome} onSelect={() => selectAluno(a.id)}>
                          <Check className={cn("mr-2 h-4 w-4", form.aluno_id === a.id ? "opacity-100" : "opacity-0")} />
                          <div>
                            <span>{a.nome}</span>
                            {a.cpf && <span className="ml-2 text-xs text-muted-foreground">{formatCPF(a.cpf)}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Client info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input value={form.cliente_nome} onChange={(e) => setForm(f => ({ ...f, cliente_nome: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Responsável / Profissional *</Label>
              <Select value={form.responsavel} onValueChange={(v) => setForm(f => ({ ...f, responsavel: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar profissional..." /></SelectTrigger>
                <SelectContent>
                  {profissionais.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {profissionais.length === 0 && <p className="text-xs text-muted-foreground">Cadastre profissionais na aba Profissionais primeiro.</p>}
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))} placeholder="000.000.000-00" maxLength={14} />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.data_nascimento} onChange={(e) => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-mail do Cliente</Label>
              <Input type="email" value={form.cliente_email} onChange={(e) => setForm(f => ({ ...f, cliente_email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telefone do Cliente</Label>
              <Input value={form.cliente_telefone} onChange={(e) => setForm(f => ({ ...f, cliente_telefone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} />
            </div>
          </div>

          {/* Revenue split */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Divisão de Receita</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Grupo Excellence: <strong>{form.percentual_empresa}%</strong></span>
                <span className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-accent-foreground" />Profissional: <strong>{form.percentual_profissional}%</strong></span>
              </div>
              <Slider value={[form.percentual_empresa]} onValueChange={handlePercentChange} min={0} max={100} step={5} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground"><span>0% Empresa</span><span>100% Empresa</span></div>
            </CardContent>
          </Card>

          {/* Financial */}
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

          {/* Payment mode toggle */}
          <div className="space-y-3">
            <Label>Como será o pagamento?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={tipoPagamento === "entrada" ? "default" : "outline"} className="w-full" onClick={() => setTipoPagamento("entrada")}>Entrada + Restante</Button>
              <Button type="button" variant={tipoPagamento === "total" ? "default" : "outline"} className="w-full" onClick={() => setTipoPagamento("total")}>Valor Total Completo</Button>
            </div>

            {tipoPagamento === "entrada" ? (
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">O cliente dará uma entrada agora. O restante será lançado depois conforme o acordo.</p>
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

          {/* Preview split */}
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

          {/* Date, account, status */}
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

          {/* Vendedor / Comissão */}
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

          <Button onClick={onSubmit} disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? "Salvar Alterações" : "Cadastrar Processo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
