import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { AREA_LABELS, type AreaEvento } from "@/lib/checklistEvento";

// Âncoras disponíveis hoje na UI (evento de data única funciona só com a
// primeira; "cada sessão" ainda não está pronta — Parte 2).
const ANCORAS_DISPONIVEIS: { value: string; label: string }[] = [
  { value: "evento_inteiro", label: "Data do evento/início" },
  { value: "primeira_sessao", label: "1ª sessão da turma" },
  { value: "ultima_sessao", label: "Última sessão da turma" },
];

// Itens em edição no dialog (id null = novo)
interface ItemDraft {
  id: string | null;
  nome_tarefa: string;
  fase: string;
  offset_valor: string;
  offset_unidade: string;
  prioridade: string;
  obrigatoria: boolean;
  area: string;
  ancora: string;
}

const novoItem = (): ItemDraft => ({
  id: null, nome_tarefa: "", fase: "pre_evento", offset_valor: "1",
  offset_unidade: "dias", prioridade: "media", obrigatoria: true, area: "operacao",
  ancora: "evento_inteiro",
});

export function ChecklistTemplatesSection() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipoEvento, setTipoEvento] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [itens, setItens] = useState<ItemDraft[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checklist_templates")
        .select("*, checklist_template_items(id, deleted_at)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tiposExistentes = [] } = useQuery({
    queryKey: ["eventos-tipos"],
    queryFn: async () => {
      const { data } = await supabase.from("eventos").select("tipo").not("tipo", "is", null);
      return [...new Set((data || []).map((e: any) => e.tipo))].sort() as string[];
    },
  });

  const openCreate = () => {
    setEditingId(null); setNome(""); setTipoEvento(""); setAtivo(true);
    setItens([novoItem()]); setRemovidos([]); setDialogOpen(true);
  };

  const openEdit = async (t: any) => {
    const { data: rows } = await (supabase as any)
      .from("checklist_template_items")
      .select("*").eq("template_id", t.id).is("deleted_at", null);
    setEditingId(t.id); setNome(t.nome); setTipoEvento(t.tipo_evento); setAtivo(t.ativo);
    setItens((rows || []).map((r: any) => ({
      id: r.id, nome_tarefa: r.nome_tarefa, fase: r.fase,
      offset_valor: String(r.offset_valor), offset_unidade: r.offset_unidade,
      prioridade: r.prioridade, obrigatoria: r.obrigatoria, area: r.area || "operacao",
      ancora: r.ancora || "evento_inteiro",
    })));
    setRemovidos([]); setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const sb = supabase as any;
      let templateId = editingId;

      if (editingId) {
        // Versionamento (Fase 4.4, preparado na 1.2): template já usado em
        // evento/turma não muda retroativamente — incrementa a versão.
        const [{ count: countEventos }, { count: countTurmas }] = await Promise.all([
          sb.from("eventos").select("id", { count: "exact", head: true }).eq("checklist_template_id", editingId),
          sb.from("turmas").select("id", { count: "exact", head: true }).eq("checklist_template_id", editingId),
        ]);
        const bump = (countEventos || 0) > 0 || (countTurmas || 0) > 0;

        const { data: atual } = await sb.from("checklist_templates")
          .select("versao").eq("id", editingId).single();
        const { error } = await sb.from("checklist_templates").update({
          nome, tipo_evento: tipoEvento.toLowerCase().trim(), ativo,
          versao: bump ? (atual?.versao || 1) + 1 : atual?.versao || 1,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("checklist_templates").insert({
          nome, tipo_evento: tipoEvento.toLowerCase().trim(), ativo,
        }).select("id").single();
        if (error) throw error;
        templateId = data.id;
      }

      // Itens: soft delete dos removidos, update dos existentes, insert dos novos
      for (const id of removidos) {
        const { error } = await sb.from("checklist_template_items")
          .update({ deleted_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      }
      for (const item of itens) {
        if (!item.nome_tarefa.trim()) continue;
        const payload = {
          template_id: templateId,
          nome_tarefa: item.nome_tarefa.trim(),
          fase: item.fase,
          offset_valor: parseInt(item.offset_valor) || 0,
          offset_unidade: item.offset_unidade,
          prioridade: item.prioridade,
          obrigatoria: item.obrigatoria,
          area: item.area,
          ancora: item.ancora,
        };
        if (item.id) {
          const { error } = await sb.from("checklist_template_items").update(payload).eq("id", item.id);
          if (error) throw error;
        } else {
          const { error } = await sb.from("checklist_template_items").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success(editingId ? "Modelo atualizado" : "Modelo criado");
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro (somente admin edita modelos): " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("checklist_templates")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast.success("Modelo excluído");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const removeItem = (i: number) => {
    const item = itens[i];
    if (item.id) setRemovidos((prev) => [...prev, item.id!]);
    setItens((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Modelos de Checklist de Eventos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ao criar um evento do tipo correspondente, as tarefas do modelo são geradas automaticamente. Somente admin edita.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Modelo</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {templates.length === 0 && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum modelo criado. Ex.: modelo "Palestra" com tarefas de divulgação, materiais e pós-evento.
            </CardContent></Card>
          )}
          {templates.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{t.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{t.tipo_evento}</Badge>
                    <Badge variant="secondary">v{t.versao}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {(t.checklist_template_items || []).filter((i: any) => !i.deleted_at).length} tarefa(s)
                    </span>
                    {!t.ativo && <Badge variant="destructive">Inativo</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => { if (confirm("Excluir este modelo? Eventos já criados não são afetados.")) deleteMutation.mutate(t.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Modelo" : "Novo Modelo de Checklist"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome do modelo <span className="text-destructive">*</span></Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Checklist Palestra" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de evento <span className="text-destructive">*</span></Label>
                <Input value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}
                  placeholder="palestra, workshop..." list="tipos-evento-existentes" />
                <datalist id="tipos-evento-existentes">
                  {tiposExistentes.map((t) => <option key={t} value={t} />)}
                </datalist>
                <p className="text-[11px] text-muted-foreground">
                  Obrigatório: liga o modelo ao tipo do evento para aplicar sozinho.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={ativo} onCheckedChange={(v) => setAtivo(!!v)} /> Modelo ativo
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tarefas do modelo</Label>
                <Button variant="outline" size="sm" onClick={() => setItens((p) => [...p, novoItem()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Tarefa
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                "Quando" = quanto tempo <strong>antes</strong> do evento (ou{" "}
                <strong>depois</strong>, se a fase for Pós-evento). "Referência" = a partir
                de qual data contar — só importa em <strong>turmas</strong> com várias
                sessões (em eventos de data única, é sempre a mesma data).
              </p>
              {itens.map((item, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Atividade {i + 1}</Label>
                    <Input
                      className="h-9 text-sm"
                      placeholder="Ex: Confirmar local e palestrante"
                      value={item.nome_tarefa}
                      onChange={(e) => setItem(i, { nome_tarefa: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Fase</Label>
                      <Select value={item.fase} onValueChange={(v) => setItem(i, { fase: v })}>
                        <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pre_evento">Pré-evento</SelectItem>
                          <SelectItem value="dia_evento">Dia do evento</SelectItem>
                          <SelectItem value="pos_evento">Pós-evento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Quando</Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          className="h-9 w-16 text-sm"
                          value={item.offset_valor}
                          onChange={(e) => setItem(i, { offset_valor: e.target.value })}
                          onFocus={(e) => e.target.select()}
                        />
                        <Select value={item.offset_unidade} onValueChange={(v) => setItem(i, { offset_unidade: v })}>
                          <SelectTrigger className="h-9 w-28 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutos">minutos</SelectItem>
                            <SelectItem value="horas">horas</SelectItem>
                            <SelectItem value="dias">dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Prioridade</Label>
                      <Select value={item.prioridade} onValueChange={(v) => setItem(i, { prioridade: v })}>
                        <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Área</Label>
                      <Select value={item.area} onValueChange={(v) => setItem(i, { area: v })}>
                        <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(AREA_LABELS) as AreaEvento[]).map((a) => (
                            <SelectItem key={a} value={a}>{AREA_LABELS[a]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Referência (turmas)</Label>
                      <Select value={item.ancora} onValueChange={(v) => setItem(i, { ancora: v })}>
                        <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ANCORAS_DISPONIVEIS.map((a) => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive ml-auto"
                      onClick={() => removeItem(i)}
                      title="Remover atividade"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button className="w-full" disabled={saveMutation.isPending}
              onClick={() => {
                if (!nome.trim()) return toast.error('Dê um nome ao modelo (ex.: "Checklist Palestra").');
                if (!tipoEvento.trim()) return toast.error('Preencha o "Tipo de evento" (ex.: palestra).');
                if (!itens.some((i) => i.nome_tarefa.trim()))
                  return toast.error("Adicione pelo menos uma tarefa com nome.");
                saveMutation.mutate();
              }}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Salvar Modelo" : "Criar Modelo"}
            </Button>
            {editingId && (
              <p className="text-xs text-muted-foreground">
                Editar um modelo já usado em eventos cria uma nova versão — os checklists de eventos antigos não mudam.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
