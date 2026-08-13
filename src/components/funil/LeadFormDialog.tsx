import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { maskPhone } from "@/lib/utils";
import { LeadForm, origens, cidades, type FunilEtapa } from "./funilUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LeadForm;
  setForm: (form: LeadForm) => void;
  onSave: () => void;
  isPending: boolean;
  produtos: any[];
  comerciais: any[];
  quadros: { id: string; nome: string }[];
  allEtapas: FunilEtapa[];
  title?: string;
}

export function LeadFormDialog({ open, onOpenChange, form, setForm, onSave, isPending, produtos, comerciais, quadros = [], allEtapas = [], title = "Cadastrar Novo Lead" }: Props) {
  const u = (field: keyof LeadForm, value: string) => setForm({ ...form, [field]: value });

  const handleQuadroChange = (quadroId: string) => {
    const primeiraEtapa = allEtapas
      .filter((e) => e.quadro_id === quadroId)
      .sort((a, b) => a.ordem - b.ordem)[0];
    setForm({ ...form, quadro_id: quadroId, etapa_id: primeiraEtapa?.id || "" });
  };

  const etapasDoCuadro = allEtapas
    .filter((e) => e.quadro_id === form.quadro_id)
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => u("nome", e.target.value)} placeholder="Nome do lead" />
          </div>

          {/* Funil + Coluna */}
          <div>
            <Label>Funil *</Label>
            <Select value={form.quadro_id} onValueChange={handleQuadroChange}>
              <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
              <SelectContent>
                {quadros.map((q) => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Coluna *</Label>
            <Select value={form.etapa_id} onValueChange={(v) => u("etapa_id", v)} disabled={!form.quadro_id || etapasDoCuadro.length === 0}>
              <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
              <SelectContent>
                {etapasDoCuadro.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => u("email", e.target.value)} placeholder="email@email.com" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => u("telefone", maskPhone(e.target.value))} placeholder="(44) 99999-0000" />
          </div>
          <div>
            <Label>Cidade</Label>
            <Select value={form.cidade} onValueChange={(v) => u("cidade", v)}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Produto de Interesse</Label>
            <Select value={form.produto_interesse} onValueChange={(v) => u("produto_interesse", v)}>
              <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                {produtos.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem</Label>
            <Select value={form.origem} onValueChange={(v) => u("origem", v)}>
              <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                {origens.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vendedor Responsável</Label>
            <Select value={form.responsavel_id} onValueChange={(v) => u("responsavel_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {comerciais.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor potencial (R$)</Label>
            <Input
              type="number"
              min={0}
              value={form.valor}
              onChange={(e) => u("valor", e.target.value)}
              placeholder="Ex.: 5000"
            />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => u("observacoes", e.target.value)} placeholder="Observações" />
          </div>
          <div className="col-span-2">
            <Button className="w-full" onClick={onSave} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {title.includes("Editar") ? "Salvar Alterações" : "Cadastrar Lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
