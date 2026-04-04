import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

export interface EventoForm {
  nome: string;
  data: string;
  local: string;
  tipo: string;
  responsavel: string;
  limite_participantes: string;
  descricao: string;
  pago: boolean;
  valor: string;
  comunidade: boolean;
  vincular_turma: boolean;
  produto_id: string;
  turma_id: string;
}

export const emptyForm: EventoForm = {
  nome: "", data: "", local: "", tipo: "", responsavel: "",
  limite_participantes: "", descricao: "", pago: false, valor: "",
  comunidade: false, vincular_turma: false, produto_id: "", turma_id: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EventoForm;
  setForm: React.Dispatch<React.SetStateAction<EventoForm>>;
  onSubmit: () => void;
  isEditing: boolean;
  isPending: boolean;
  produtos: any[];
  turmas: any[];
  profissionais: any[];
}

export function EventoFormDialog({ open, onOpenChange, form, setForm, onSubmit, isEditing, isPending, produtos, turmas, profissionais }: Props) {
  const u = (field: keyof EventoForm, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }));

  const produtosTurma = produtos.filter((p: any) => p.tipo !== "comunidade");
  const produtosComunidade = produtos.filter((p: any) => p.tipo === "comunidade");
  const turmasFiltradas = form.produto_id ? turmas.filter((t: any) => t.produto_id === form.produto_id) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Evento" : "Cadastrar Novo Evento"}</DialogTitle>
          <DialogDescription>Preencha o evento e defina se ele será vinculado a turma ou comunidade.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Nome do evento</Label>
            <Input value={form.nome} onChange={(e) => u("nome", e.target.value)} placeholder="Nome" />
          </div>

          {/* Vincular Turma */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-base">Vincular com Turma</Label>
                <p className="text-sm text-muted-foreground">Ative para escolher produto e turma deste evento</p>
              </div>
              <Switch
                checked={form.vincular_turma}
                disabled={form.comunidade}
                onCheckedChange={(v) => setForm(f => ({ ...f, vincular_turma: v, comunidade: v ? false : f.comunidade, produto_id: "", turma_id: "" }))}
              />
            </div>
            {form.vincular_turma && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={form.produto_id} onValueChange={(v) => setForm(f => ({ ...f, produto_id: v, turma_id: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar produto..." /></SelectTrigger>
                    <SelectContent>{produtosTurma.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Turma</Label>
                  <Select value={form.turma_id} onValueChange={(v) => u("turma_id", v)} disabled={!form.produto_id || turmasFiltradas.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={!form.produto_id ? "Escolha um produto primeiro" : turmasFiltradas.length === 0 ? "Nenhuma turma disponível" : "Selecionar turma..."} />
                    </SelectTrigger>
                    <SelectContent>{turmasFiltradas.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Comunidade */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-base">Evento de Comunidade</Label>
                <p className="text-sm text-muted-foreground">Ative para escolher a comunidade vinculada ao evento</p>
              </div>
              <Switch
                checked={form.comunidade}
                disabled={form.vincular_turma}
                onCheckedChange={(v) => setForm(f => ({ ...f, comunidade: v, vincular_turma: v ? false : f.vincular_turma, produto_id: "", turma_id: "" }))}
              />
            </div>
            {form.comunidade && (
              <div className="mt-4 space-y-2">
                <Label>Comunidade</Label>
                <Select value={form.produto_id} onValueChange={(v) => setForm(f => ({ ...f, produto_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar comunidade..." /></SelectTrigger>
                  <SelectContent>{produtosComunidade.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
                {produtosComunidade.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma comunidade cadastrada em produtos no momento.</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => u("data", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Local</Label>
              <Input value={form.local} onChange={(e) => u("local", e.target.value)} placeholder="Local" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => u("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="palestra">Palestra</SelectItem>
                  <SelectItem value="caminhada">Caminhada</SelectItem>
                  <SelectItem value="jantar">Jantar</SelectItem>
                  <SelectItem value="encontro">Encontro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.responsavel} onValueChange={(v) => u("responsavel", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar profissional..." /></SelectTrigger>
                <SelectContent>{profissionais.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Limite de participantes</Label>
              <Input type="number" value={form.limite_participantes} onChange={(e) => u("limite_participantes", e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Pago */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-base">Evento pago</Label>
                <p className="text-sm text-muted-foreground">Marque se este evento cobra uma taxa de participação</p>
              </div>
              <Switch checked={form.pago} onCheckedChange={(v) => u("pago", v)} />
            </div>
            {form.pago && (
              <div className="mt-4 space-y-2">
                <Label>Valor por participante (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => u("valor", e.target.value)} placeholder="0,00" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => u("descricao", e.target.value)} placeholder="Descrição do evento" />
          </div>

          <Button className="w-full" onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Cadastrar Evento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
