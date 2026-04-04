import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { maskCPF, validateCPF, formatPhone, maskPhone } from "@/lib/utils";

const TIPOS_VINCULO = ["mei", "clt", "autonomo", "convidado"] as const;
const TIPO_LABELS: Record<string, string> = { mei: "MEI", clt: "CLT", autonomo: "Autônomo", convidado: "Convidado" };
const PIX_TIPOS = ["cpf", "cnpj", "email", "telefone"] as const;
const PIX_LABELS: Record<string, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone" };

import { formatCNPJ as maskCNPJ } from "@/lib/formatters";

export interface ProfissionalForm {
  nome: string;
  email: string;
  telefone: string;
  especialidade: string;
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

export const emptyForm: ProfissionalForm = {
  nome: "", email: "", telefone: "", especialidade: "",
  cpf: "", data_nascimento: "", tipo_vinculo: "autonomo", cnpj: "",
  chave_pix: "", chave_pix_tipo: "", banco: "", agencia: "", conta: "",
  ativo: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ProfissionalForm;
  setForm: React.Dispatch<React.SetStateAction<ProfissionalForm>>;
  onSave: () => void;
  saving: boolean;
  editing: boolean;
  isAdmin: boolean;
  cpfError: string;
}

export function ProfissionalFormDialog({ open, onOpenChange, form, setForm, onSave, saving, editing, isAdmin, cpfError }: Props) {
  const set = (key: keyof ProfissionalForm, val: any) => setForm(f => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Profissional" : "Novo Profissional"}</DialogTitle>
        </DialogHeader>
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
                disabled={!isAdmin && editing}
              />
              {cpfError && <p className="text-xs text-destructive">{cpfError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de Vínculo *</Label>
              <Select value={form.tipo_vinculo} onValueChange={v => set("tipo_vinculo", v)} disabled={!isAdmin && editing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          {/* Especialidade + Data Nascimento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Input value={form.especialidade} onChange={e => set("especialidade", e.target.value)} placeholder="Ex: Coach, Terapeuta..." />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} />
            </div>
          </div>

          {/* Chave PIX */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Tipo PIX</Label>
              <Select value={form.chave_pix_tipo} onValueChange={v => set("chave_pix_tipo", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
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

          <Button onClick={onSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editing ? "Salvar Alterações" : "Cadastrar Profissional"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
