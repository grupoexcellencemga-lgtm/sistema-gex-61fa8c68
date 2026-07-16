import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Mail, MapPin, ArrowRight, ArrowLeft, XCircle, Loader2, Clock, Pencil, UserCheck, User, Trash2 } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import { toast } from "sonner";
import { ActivityTimeline, logActivity } from "@/components/ActivityTimeline";
import { TarefasContextSection } from "@/components/tarefas/TarefasContextSection";
import { LeadForm, emptyLeadForm, origens, cidades, ETAPA_CORES, type FunilEtapa } from "./funilUtils";
import { maskPhone } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  produtos: any[];
  comerciais: any[];
  turmas: any[];
  etapas: FunilEtapa[];
  onLeadUpdated: () => void;
  onDeleteLead: (id: string) => void;
}

export function LeadDetailSheet({ open, onOpenChange, lead, produtos, comerciais, turmas, etapas, onLeadUpdated, onDeleteLead }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<LeadForm>(emptyLeadForm);
  const [perdidoDialogOpen, setPerdidoDialogOpen] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({ produto_id: "", turma_id: "" });
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  // Hooks precisam rodar sempre na mesma ordem/quantidade, mesmo quando o
  // sheet ainda não tem lead selecionado (fica montado com lead=null antes
  // do primeiro clique) — por isso ficam TODOS antes do "if (!lead)" abaixo.
  const etapasAtivas = [...etapas].filter((e) => e.tipo !== "perdido").sort((a, b) => a.ordem - b.ordem);
  const etapaPerdido = etapas.find((e) => e.tipo === "perdido");
  const currentIdxForMutation = lead ? etapasAtivas.findIndex((e) => e.id === lead.etapa_id) : -1;

  const saveEdit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({
        nome: editForm.nome,
        email: editForm.email || null,
        telefone: editForm.telefone || null,
        cidade: editForm.cidade || null,
        produto_interesse: editForm.produto_interesse || null,
        origem: editForm.origem ? editForm.origem.toLowerCase() : null,
        observacoes: editForm.observacoes || null,
        responsavel_id: editForm.responsavel_id && editForm.responsavel_id !== "none" ? editForm.responsavel_id : null,
      } as any).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onLeadUpdated();
      setEditing(false);
      toast.success("Lead atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (currentIdxForMutation < 0 || currentIdxForMutation >= etapasAtivas.length - 1) return;
      const nextEtapa = etapasAtivas[currentIdxForMutation + 1];
      const { error } = await supabase.from("leads").update({ etapa_id: nextEtapa.id } as any).eq("id", lead.id);
      if (error) throw error;
      await logActivity({ tipo: "avanco_etapa", descricao: `Lead avançou para ${nextEtapa.nome}`, lead_id: lead.id });
    },
    onSuccess: () => { onLeadUpdated(); toast.success("Lead avançado"); onOpenChange(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const retrocederMutation = useMutation({
    mutationFn: async () => {
      if (currentIdxForMutation <= 0) return;
      const prevEtapa = etapasAtivas[currentIdxForMutation - 1];
      const { error } = await supabase.from("leads").update({ etapa_id: prevEtapa.id } as any).eq("id", lead.id);
      if (error) throw error;
      await logActivity({ tipo: "avanco_etapa", descricao: `Lead retrocedeu para ${prevEtapa.nome}`, lead_id: lead.id });
    },
    onSuccess: () => { onLeadUpdated(); toast.success("Lead retrocedido"); onOpenChange(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const marcarPerdido = useMutation({
    mutationFn: async () => {
      if (!motivoPerda.trim()) throw new Error("Motivo é obrigatório");
      if (!etapaPerdido) throw new Error('Crie uma coluna do tipo "Perdido" em Novo Lead → Nova Coluna.');
      const { error } = await supabase.from("leads").update({
        etapa_id: etapaPerdido.id,
        motivo_perda: motivoPerda.trim(),
      } as any).eq("id", lead.id);
      if (error) throw error;
      await logActivity({ tipo: "avanco_etapa", descricao: `Lead marcado como Perdido. Motivo: ${motivoPerda.trim()}`, lead_id: lead.id });
    },
    onSuccess: () => {
      onLeadUpdated();
      setPerdidoDialogOpen(false);
      setMotivoPerda("");
      toast.success("Lead marcado como perdido");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const converterAluno = useMutation({
    mutationFn: async () => {
      const etapaGanho = [...etapas].filter((e) => e.tipo === "ganho").sort((a, b) => a.ordem - b.ordem)[0];

      // 1. Create aluno
      const { data: aluno, error: alunoErr } = await supabase.from("alunos").insert({
        nome: lead.nome,
        email: lead.email || null,
        telefone: lead.telefone || null,
        cidade: lead.cidade || null,
      }).select("id").single();
      if (alunoErr) throw alunoErr;

      // 2. Create matricula if produto selected
      if (convertForm.produto_id) {
        const produto = produtos.find((p: any) => p.id === convertForm.produto_id);
        const valorTotal = Number(produto?.valor || 0);
        const { error: matErr } = await supabase.from("matriculas").insert({
          aluno_id: aluno.id,
          produto_id: convertForm.produto_id || null,
          turma_id: convertForm.turma_id || null,
          valor_total: valorTotal,
          valor_final: valorTotal,
          status: "ativo",
          data_inicio: new Date().toISOString().split("T")[0],
        });
        if (matErr) throw matErr;
      }

      // 3. Mark lead as converted
      if (etapaGanho) {
        const { error: leadErr } = await supabase.from("leads").update({
          etapa_id: etapaGanho.id,
        } as any).eq("id", lead.id);
        if (leadErr) throw leadErr;
      }

      await logActivity({ tipo: "matricula", descricao: `Lead convertido em aluno e matriculado`, lead_id: lead.id });
      if (aluno) {
        await logActivity({ tipo: "matricula", descricao: `Aluno criado a partir do lead ${lead.nome}`, aluno_id: aluno.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      onLeadUpdated();
      setConvertDialogOpen(false);
      toast.success("Lead convertido em aluno com sucesso!");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  if (!lead) return null;

  const etapaAtual = etapas.find((e) => e.id === lead.etapa_id);
  const cores = etapaAtual ? ETAPA_CORES[etapaAtual.cor] || ETAPA_CORES.slate : ETAPA_CORES.slate;
  const comercialNome = lead.responsavel_id ? comerciais.find((c: any) => c.id === lead.responsavel_id)?.nome : null;
  const currentIdx = currentIdxForMutation;
  const maxOrdemAtivo = Math.max(-1, ...etapasAtivas.filter((e) => e.tipo === "em_andamento").map((e) => e.ordem));
  const podeConverter = etapaAtual && (etapaAtual.tipo === "ganho" || etapaAtual.ordem === maxOrdemAtivo);

  const startEdit = () => {
    setEditForm({
      nome: lead.nome || "",
      email: lead.email || "",
      telefone: lead.telefone || "",
      cidade: lead.cidade || "",
      produto_interesse: lead.produto_interesse || "",
      origem: lead.origem || "",
      observacoes: lead.observacoes || "",
      responsavel_id: lead.responsavel_id || "",
    });
    setEditing(true);
  };

  const turmasFiltradas = convertForm.produto_id
    ? turmas.filter((t: any) => t.produto_id === convertForm.produto_id)
    : [];

  const u = (field: keyof LeadForm, value: string) => setEditForm((prev) => ({ ...prev, [field]: value }));

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditing(false); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {lead.nome}
              {!editing && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={startEdit} title="Editar lead">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {editing ? (
              /* Edit mode */
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input value={editForm.nome} onChange={(e) => u("nome", e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => u("email", e.target.value)} /></div>
                  <div><Label>Telefone</Label><Input value={editForm.telefone} onChange={(e) => u("telefone", maskPhone(e.target.value))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cidade</Label>
                    <Select value={editForm.cidade} onValueChange={(v) => u("cidade", v)}>
                      <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
                      <SelectContent>{cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Produto</Label>
                    <Select value={editForm.produto_interesse} onValueChange={(v) => u("produto_interesse", v)}>
                      <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>{produtos.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Origem</Label>
                    <Select value={editForm.origem} onValueChange={(v) => u("origem", v)}>
                      <SelectTrigger><SelectValue placeholder="Origem" /></SelectTrigger>
                      <SelectContent>{origens.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vendedor</Label>
                    <Select value={editForm.responsavel_id} onValueChange={(v) => u("responsavel_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {comerciais.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block">Observações</Label>
                  <RichTextEditor
                    value={editForm.observacoes}
                    onChange={(html) => u("observacoes", html)}
                    placeholder="Anotações, detalhes, histórico..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                    {saveEdit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              /* View mode */
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cores.badge}>{etapaAtual?.nome || "—"}</Badge>
                  {comercialNome && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <User className="h-3 w-3" />{comercialNome}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  {lead.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{lead.email}</div>}
                  {lead.telefone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />{formatPhone(lead.telefone)}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWhatsappOpen(true)} title="Enviar WhatsApp">
                        <MessageSquare className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    </div>
                  )}
                  {lead.cidade && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{lead.cidade}</div>}
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-2">Detalhes</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Produto:</span><p>{lead.produto_interesse || "—"}</p></div>
                    <div><span className="text-muted-foreground">Origem:</span><p>{lead.origem || "—"}</p></div>
                  </div>
                </div>

                {lead.observacoes && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-2">Observações</h3>
                    <div
                      className="text-sm text-muted-foreground [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5"
                      dangerouslySetInnerHTML={{ __html: lead.observacoes }}
                    />
                  </div>
                )}

                {lead.motivo_perda && etapaAtual?.tipo === "perdido" && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-2 text-destructive">Motivo da Perda</h3>
                    <p className="text-sm text-muted-foreground">{lead.motivo_perda}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="border-t pt-4 space-y-2">
                  {etapaAtual?.tipo !== "perdido" && (
                    <>
                      {podeConverter && (
                        <Button className="w-full" variant="default" onClick={() => setConvertDialogOpen(true)}>
                          <UserCheck className="h-4 w-4 mr-2" />Converter em Aluno
                        </Button>
                      )}
                      <div className="flex gap-2">
                        {currentIdx > 0 && (
                          <Button variant="outline" className="flex-1" onClick={() => retrocederMutation.mutate()} disabled={retrocederMutation.isPending}>
                            {retrocederMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowLeft className="h-4 w-4 mr-2" />}
                            Retroceder
                          </Button>
                        )}
                        {currentIdx >= 0 && currentIdx < etapasAtivas.length - 1 && (
                          <Button className="flex-1" onClick={() => advanceMutation.mutate()} disabled={advanceMutation.isPending}>
                            {advanceMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                            Avançar
                          </Button>
                        )}
                      </div>
                      <Button variant="destructive" className="w-full" onClick={() => setPerdidoDialogOpen(true)}>
                        <XCircle className="h-4 w-4 mr-2" />Marcar como Perdido
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Excluir o lead "${lead.nome}"? Esta ação não pode ser desfeita.`)) {
                        onDeleteLead(lead.id);
                        onOpenChange(false);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />Excluir Lead
                  </Button>
                </div>

                {/* Timeline */}
                <div className="border-t pt-4">
                  <TarefasContextSection leadId={lead.id} />
                </div>

                {/* Timeline */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Histórico</h3>
                  <ActivityTimeline leadId={lead.id} />
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog: Marcar como perdido */}
      <Dialog open={perdidoDialogOpen} onOpenChange={setPerdidoDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Marcar Lead como Perdido</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Motivo da perda *</Label>
              <Textarea value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)} placeholder="Descreva o motivo..." rows={3} />
            </div>
            <Button className="w-full" variant="destructive" onClick={() => marcarPerdido.mutate()} disabled={marcarPerdido.isPending || !motivoPerda.trim()}>
              {marcarPerdido.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Perda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Converter em aluno */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Converter Lead em Aluno</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Um novo aluno será criado com os dados de <strong>{lead.nome}</strong>.
            </p>
            <div>
              <Label>Produto (opcional)</Label>
              <Select value={convertForm.produto_id} onValueChange={(v) => setConvertForm((f) => ({ ...f, produto_id: v, turma_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {produtos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {turmasFiltradas.length > 0 && (
              <div>
                <Label>Turma (opcional)</Label>
                <Select value={convertForm.turma_id} onValueChange={(v) => setConvertForm((f) => ({ ...f, turma_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {turmasFiltradas.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full" onClick={() => converterAluno.mutate()} disabled={converterAluno.isPending}>
              {converterAluno.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <UserCheck className="h-4 w-4 mr-2" />Converter em Aluno
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <WhatsAppDialog open={whatsappOpen} onOpenChange={setWhatsappOpen} telefone={lead?.telefone || ""} nome={lead?.nome || ""} entidadeTipo="lead" entidadeId={lead?.id} />
    </>
  );
}
