import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useProfissionais } from "@/hooks/useProfissionais";
import { useDataFilter } from "@/hooks/useDataFilter";
import { EventoFormDialog, EventoForm, emptyForm } from "@/components/eventos/EventoFormDialog";
import { EventoTable } from "@/components/eventos/EventoTable";
import { ParticipantesSection } from "@/components/eventos/ParticipantesSection";

const Eventos = () => {
  const { data: profissionais = [] } = useProfissionais();
  const queryClient = useQueryClient();
  const { filterByResponsavel } = useDataFilter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventoForm>(emptyForm);
  const [selectedEvento, setSelectedEvento] = useState<any>(null);

  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", data.user.id).maybeSingle();
        setCurrentUserName(profile?.nome ?? data.user.email ?? null);
      }
    });
  }, []);

  // Queries
  const { data: eventosRaw = [], isLoading } = useQuery({
    queryKey: ["eventos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos").select("*").is("deleted_at", null).order("data", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const eventos = filterByResponsavel(eventosRaw);

  const { data: allParticipantes = [] } = useQuery({
    queryKey: ["all_participantes_eventos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participantes_eventos").select("evento_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: inscricoes = [] } = useQuery({
    queryKey: ["inscricoes-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inscricoes_eventos").select("evento_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtosEvento = [] } = useQuery({
    queryKey: ["produtos_evento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome, tipo").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: turmasEvento = [] } = useQuery({
    queryKey: ["turmas_evento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("id, nome, produto_id").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const countParticipantes = (eventoId: string) => {
    return allParticipantes.filter(p => p.evento_id === eventoId).length + inscricoes.filter(i => i.evento_id === eventoId).length;
  };

  // Mutations
  const insertMutation = useMutation({
    mutationFn: async (data: EventoForm) => {
      const { error } = await supabase.from("eventos").insert({
        nome: data.nome, data: data.data || null, local: data.local || null,
        tipo: data.tipo ? data.tipo.toLowerCase() : null, responsavel: data.responsavel || null,
        limite_participantes: data.limite_participantes ? parseInt(data.limite_participantes) : null,
        descricao: data.descricao || null, pago: data.pago,
        valor: data.pago && data.valor ? parseFloat(data.valor) : 0, comunidade: data.comunidade,
        produto_id: data.produto_id || null, turma_id: data.turma_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos"] }); toast.success("Evento cadastrado"); setDialogOpen(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EventoForm }) => {
      const { error } = await supabase.from("eventos").update({
        nome: data.nome, data: data.data || null, local: data.local || null,
        tipo: data.tipo ? data.tipo.toLowerCase() : null, responsavel: data.responsavel || null,
        limite_participantes: data.limite_participantes ? parseInt(data.limite_participantes) : null,
        descricao: data.descricao || null, pago: data.pago,
        valor: data.pago && data.valor ? parseFloat(data.valor) : 0, comunidade: data.comunidade,
        produto_id: data.produto_id || null, turma_id: data.turma_id || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      toast.success("Evento atualizado"); setDialogOpen(false);
      if (selectedEvento && editingId === selectedEvento.id) {
        setSelectedEvento((prev: any) => ({
          ...prev, nome: form.nome, data: form.data || null, local: form.local || null,
          tipo: form.tipo || null, responsavel: form.responsavel || null,
          limite_participantes: form.limite_participantes ? parseInt(form.limite_participantes) : null,
          descricao: form.descricao || null, pago: form.pago,
          valor: form.pago && form.valor ? parseFloat(form.valor) : 0, comunidade: form.comunidade,
          produto_id: form.produto_id || null, turma_id: form.turma_id || null,
        }));
      }
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventos").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos"] }); toast.success("Evento excluído"); if (selectedEvento) setSelectedEvento(null); },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  // Handlers
  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (e: any) => {
    setForm({
      nome: e.nome, data: e.data || "", local: e.local || "", tipo: e.tipo || "",
      responsavel: e.responsavel || "", limite_participantes: e.limite_participantes?.toString() || "",
      descricao: e.descricao || "", pago: e.pago || false, valor: e.valor ? String(e.valor) : "",
      comunidade: e.comunidade || false, vincular_turma: !!(e.produto_id && !e.comunidade),
      produto_id: e.produto_id || "", turma_id: e.turma_id || "",
    });
    setEditingId(e.id); setDialogOpen(true);
  };

  const save = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else insertMutation.mutate(form);
  };

  // Detail view
  if (selectedEvento) {
    return (
      <>
        <ParticipantesSection
          evento={selectedEvento}
          onBack={() => setSelectedEvento(null)}
          onEditEvento={openEdit}
          currentUserName={currentUserName}
          produtos={produtosEvento}
          turmas={turmasEvento}
        />
        <EventoFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          form={form}
          setForm={setForm}
          onSubmit={save}
          isEditing={!!editingId}
          isPending={insertMutation.isPending || updateMutation.isPending}
          produtos={produtosEvento}
          turmas={turmasEvento}
          profissionais={profissionais}
        />
      </>
    );
  }

  // List view
  return (
    <div>
      <PageHeader title="Eventos" description="Gerencie eventos do Grupo Excellence">
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Evento</Button>
      </PageHeader>

      <EventoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        onSubmit={save}
        isEditing={!!editingId}
        isPending={insertMutation.isPending || updateMutation.isPending}
        produtos={produtosEvento}
        turmas={turmasEvento}
        profissionais={profissionais}
      />

      <EventoTable
        eventos={eventos}
        isLoading={isLoading}
        countParticipantes={countParticipantes}
        onSelect={setSelectedEvento}
        onEdit={openEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
};

export default Eventos;
