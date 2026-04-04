import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Award, Phone, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { maskCPF, maskPhone } from "@/lib/utils";

const TIPOS_VINCULO = ["mei", "clt", "autonomo", "convidado"] as const;
const TIPO_LABELS: Record<string, string> = { mei: "MEI", clt: "CLT", autonomo: "Autônomo", convidado: "Convidado" };
const PIX_TIPOS = ["cpf", "cnpj", "email", "telefone"] as const;
const PIX_LABELS: Record<string, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone" };

import { formatCNPJ as maskCNPJ, formatCurrency } from "@/lib/formatters";

interface VendedorForm {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  data_nascimento: string;
  tipo_vinculo: string;
  cnpj: string;
  chave_pix: string;
  chave_pix_tipo: string;
  banco: string;
  agencia: string;
  conta: string;
  ativo: boolean;
}

const emptyForm: VendedorForm = {
  nome: "", email: "", telefone: "",
  cpf: "", data_nascimento: "", tipo_vinculo: "autonomo", cnpj: "",
  chave_pix: "", chave_pix_tipo: "", banco: "", agencia: "", conta: "",
  ativo: true,
};

const Vendedores = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<VendedorForm>(emptyForm);

  const set = (key: keyof VendedorForm, val: any) => setForm(f => ({ ...f, [key]: val }));

  const { data: comerciais = [], isLoading } = useQuery({
    queryKey: ["comerciais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes_vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comissoes").select("comercial_id, valor_comissao, valor_pago, status").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nome: form.nome,
        email: form.email || null,
        telefone: form.telefone || null,
        cpf: form.cpf || null,
        data_nascimento: form.data_nascimento || null,
        tipo_vinculo: form.tipo_vinculo,
        cnpj: form.tipo_vinculo === "mei" ? (form.cnpj || null) : null,
        chave_pix: form.chave_pix || null,
        chave_pix_tipo: form.chave_pix_tipo || null,
        banco: form.banco || null,
        agencia: form.agencia || null,
        conta: form.conta || null,
      };
      if (!payload.nome) throw new Error("Nome obrigatório");
      if (editing) {
        payload.ativo = form.ativo;
        const { error } = await supabase.from("comerciais").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comerciais").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comerciais"] });
      toast({ title: editing ? "Vendedor atualizado!" : "Vendedor cadastrado!" });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: () => toast({ title: "Erro ao salvar vendedor", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comerciais").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comerciais"] });
      toast({ title: "Vendedor removido" });
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("comerciais").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comerciais"] });
      toast({ title: "Status atualizado" });
    },
  });

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      nome: c.nome || "",
      email: c.email || "",
      telefone: c.telefone || "",
      cpf: c.cpf || "",
      data_nascimento: c.data_nascimento || "",
      tipo_vinculo: c.tipo_vinculo || "autonomo",
      cnpj: c.cnpj || "",
      chave_pix: c.chave_pix || "",
      chave_pix_tipo: c.chave_pix_tipo || "",
      banco: c.banco || "",
      agencia: c.agencia || "",
      conta: c.conta || "",
      ativo: c.ativo ?? true,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const getStats = (id: string) => {
    const cms = comissoes.filter((c: any) => c.comercial_id === id);
    const total = cms.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
    const pago = cms.reduce((s: number, c: any) => s + Number(c.valor_pago), 0);
    return { total, pago, pendente: total - pago, vendas: cms.length };
  };


  return (
    <div>
      <PageHeader title="Vendedores" description="Cadastro e gestão de vendedores/comerciais" />

      <div className="flex justify-end mb-4">
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Vendedor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Vendedor" : "Novo Vendedor"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome completo" />
              </div>

              {/* CPF + Tipo Vínculo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={e => set("cpf", maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Vínculo *</Label>
                  <Select value={form.tipo_vinculo} onValueChange={v => set("tipo_vinculo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_VINCULO.map(t => (
                        <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* CNPJ (only if MEI) */}
              {form.tipo_vinculo === "mei" && (
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={form.cnpj}
                    onChange={e => set("cnpj", maskCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
              )}

              {/* Email + Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={e => set("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
                </div>
              </div>

              {/* Data de Nascimento */}
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} />
              </div>

              {/* Chave PIX */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Tipo PIX</Label>
                  <Select value={form.chave_pix_tipo} onValueChange={v => set("chave_pix_tipo", v)}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      {PIX_TIPOS.map(t => (
                        <SelectItem key={t} value={t}>{PIX_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Chave PIX</Label>
                  <Input value={form.chave_pix} onChange={e => set("chave_pix", e.target.value)} placeholder="Chave PIX" />
                </div>
              </div>

              {/* Dados Bancários */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Banco</Label>
                  <Input value={form.banco} onChange={e => set("banco", e.target.value)} placeholder="Banco" />
                </div>
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input value={form.agencia} onChange={e => set("agencia", e.target.value)} placeholder="Agência" />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input value={form.conta} onChange={e => set("conta", e.target.value)} placeholder="Conta" />
                </div>
              </div>

              {/* Ativo (edit only) */}
              {editing && (
                <div className="flex items-center gap-3">
                  <Label>Ativo</Label>
                  <input type="checkbox" checked={form.ativo} onChange={e => set("ativo", e.target.checked)} />
                </div>
              )}

              <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? "Salvar Alterações" : "Cadastrar Vendedor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : comerciais.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum vendedor cadastrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comerciais.map((c: any) => {
            const stats = getStats(c.id);
            return (
              <Card key={c.id} className="overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Award className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{c.nome}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          <Badge variant={c.ativo ? "default" : "secondary"} className="text-xs">
                            {c.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          {c.tipo_vinculo && (
                            <Badge variant="outline" className="text-xs">
                              {TIPO_LABELS[c.tipo_vinculo] || c.tipo_vinculo}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {c.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {c.email}</div>}
                    {c.telefone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {c.telefone}</div>}
                    {c.cpf && <div className="text-xs">CPF: {c.cpf}</div>}
                    {c.chave_pix && <div className="text-xs">PIX: {c.chave_pix}</div>}
                    {c.banco && <div className="text-xs">Banco: {c.banco} {c.agencia ? `| Ag: ${c.agencia}` : ""} {c.conta ? `| Cc: ${c.conta}` : ""}</div>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendas</p>
                      <p className="text-sm font-bold">{stats.vendas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-sm font-bold">{formatCurrency(stats.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pendente</p>
                      <p className={`text-sm font-bold ${stats.pendente > 0 ? "text-destructive" : "text-emerald-600"}`}>{formatCurrency(stats.pendente)}</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => toggleAtivo.mutate({ id: c.id, ativo: !c.ativo })}
                  >
                    {c.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Vendedores;
