import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { maskPhone, maskCPF } from "@/lib/utils";
import { AlunoForm } from "./alunosUtils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId: string | null;
  form: AlunoForm;
  updateField: (field: keyof AlunoForm, value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  cpfWarning?: string;
}

export const AlunoFormDialog = ({ open, onOpenChange, editingId, form, updateField, onSave, isSaving, cpfWarning }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{editingId ? "Editar Aluno" : "Cadastrar Novo Aluno"}</DialogTitle>
        <DialogDescription>Preencha os dados do aluno</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="col-span-2"><Label>Nome completo</Label><Input value={form.nome} onChange={(e) => updateField("nome", e.target.value)} placeholder="Nome do aluno" /></div>
        <div><Label>Data de nascimento</Label><Input type="date" value={form.data_nascimento} onChange={(e) => updateField("data_nascimento", e.target.value)} /></div>
        <div><Label>Sexo</Label>
          <Select value={form.sexo} onValueChange={(v) => updateField("sexo", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => updateField("telefone", maskPhone(e.target.value))} placeholder="(44) 99999-0000" /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@email.com" /></div>
        <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => updateField("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" />{cpfWarning && <p className="text-xs text-amber-500 mt-1">{cpfWarning}</p>}</div>
        <div className="col-span-2">
          <Button className="w-full" onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingId ? "Salvar Alterações" : "Cadastrar Aluno"}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
