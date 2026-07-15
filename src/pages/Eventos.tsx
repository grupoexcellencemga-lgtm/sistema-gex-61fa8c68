import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { definirChecklistDoEvento, recalcularPrazosDoEvento } from "@/lib/checklistEvento";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { NOMES_MES } from "@/components/agenda/agendaUtils";
import { useProfissionais } from "@/hooks/useProfissionais";
import { useDataFilter } from "@/hooks/useDataFilter";
import { EventoFormDialog, EventoForm, emptyForm } from "@/components/eventos/EventoFormDialog";
import { EventoTable } from "@/components/eventos/EventoTable";
import { ParticipantesSection } from "@/components/eventos/ParticipantesSection";

const Eventos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const eventoIdFromUrl = searchParams.get("evento");

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
      const { data, error } = await (supabase as any)
        .from("eventos")
        .select("*, eventos_responsaveis(profissional_id, profissionais(id, nome))")
        .is("deleted_at", null)
        .order("data", { ascending: true });
      if (error) throw error;
      return (data || []).map((e: any) => {
        const nomes = (e.eventos_responsaveis || []).map((r: any) => r.profissionais?.nome).filter(Boolean);
        return {
          ...e,
          responsavel: nomes.join(", ") || e.responsavel || null,
          responsavelIds: (e.eventos_responsaveis || []).map((r: any) => r.profissional_id),
        };
      });
    },
  });

  const eventos = filterByResponsavel(eventosRaw);

  // Navegação por mês
  const [verTodos, setVerTodos] = useState(false);
  const [mesRef, setMesRef] = useState(() => {
    const h = new Date(Date.now() - 3 * 3_600_000);
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const refMesStr = `${mesRef.getFullYear()}-${String(mesRef.getMonth() + 1).padStart(2, "0")}`;
  const eventosDoMes = verTodos
    ? eventos
    : eventos.filter((e: any) => e.data && e.data.slice(0, 7) === refMesStr);
  const irMes = (delta: number) =>
    setMesRef((r) => new Date(r.getFullYear(), r.getMonth() + delta, 1));
  const irHoje = () => {
    const h = new Date(Date.now() - 3 * 3_600_000);
    setMesRef(new Date(h.getFullYear(), h.getMonth(), 1));
    setVerTodos(false);
  };

  useEffect(() => {
    if (!eventoIdFromUrl) return;
    if (!eventos.length) return;

    const eventoDaUrl = eventos.find((e: any) => e.id === eventoIdFromUrl);
    if (!eventoDaUrl) return;

    setSelectedEvento((atual: any) => {
      if (atual?.id === eventoDaUrl.id) return atual;
      return eventoDaUrl;
    });
  }, [eventoIdFromUrl, eventos]);

  const openEventoDetail = (evento: any) => {
    setSelectedEvento(evento);
    const next = new URLSearchParams(searchParams);
    next.set("evento", evento.id);
    next.delete("tab");
    next.delete("sub");
    setSearchParams(next, { replace: false });
  };

  const closeEventoDetail = () => {
    setSelectedEvento(null);
    const next = new URLSearchParams(searchParams);
    next.delete("evento");
    next.delete("tab");
    next.delete("sub");
    setSearchParams(next, { replace: true });
  };

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

  const { data: modelosChecklist = [] } = useQuery({
    queryKey: ["checklist-modelos-form"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checklist_templates")
        .select("id, nome, tipo_evento")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const countParticipantes = (eventoId: string) => {
    return allParticipantes.filter(p => p.evento_id === eventoId).length + inscricoes.filter(i => i.evento_id === eventoId).length;
  };

  // Mutations
  const insertMutation = useMutation({
    mutationFn: async (data: EventoForm) => {
      const { data: criado, error } = await supabase.from("eventos").insert({
        nome: data.nome, data: data.data || null, local: data.local || null,
        tipo: data.tipo ? data.tipo.toLowerCase() : null,
        responsavel: null,
        limite_participantes: data.limite_participantes ? parseInt(data.limite_participantes) : null,
        descricao: data.descricao || null, pago: data.pago,
        valor: data.pago && data.valor ? parseFloat(data.valor) : 0, comunidade: data.comunidade,
        produto_id: data.produto_id || null, turma_id: data.turma_id || null,
      }).select("id, nome, tipo, data").single();
      if (error) throw error;

      if (criado && data.responsavelIds.length > 0) {
        await (supabase as any).from("eventos_responsaveis").insert(
          data.responsavelIds.map((pid) => ({ evento_id: criado.id, profissional_id: pid }))
        );
      }

      // Aplica o checklist ESCOLHIDO no cadastro (obrigatório).
      const { data: auth } = await supabase.auth.getUser();
      if (criado && auth.user && data.checklist_template_id) {
        try {
          const r = await definirChecklistDoEvento(
            { id: criado.id, nome: criado.nome, data: criado.data },
            data.checklist_template_id,
            auth.user.id,
          );
          return { aplicado: true, ...r };
        } catch (e: any) {
          // Sem data ainda: vincula o modelo, mas os prazos só são gerados ao definir a data.
          await supabase.from("eventos")
            .update({ checklist_template_id: data.checklist_template_id })
            .eq("id", criado.id);
          toast.warning(
            "Evento criado e checklist vinculado. Defina a data do evento para gerar os prazos das tarefas.",
          );
        }
      }
      return null;
    },
    onSuccess: (checklist) => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      if (checklist?.aplicado && checklist.tarefasCriadas) {
        toast.success(`Evento cadastrado — checklist "${checklist.templateNome}" aplicado (${checklist.tarefasCriadas} tarefas)`);
      } else {
        toast.success("Evento cadastrado");
      }
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EventoForm }) => {
      const { error } = await supabase.from("eventos").update({
        nome: data.nome, data: data.data || null, local: data.local || null,
        tipo: data.tipo ? data.tipo.toLowerCase() : null,
        responsavel: null,
        limite_participantes: data.limite_participantes ? parseInt(data.limite_participantes) : null,
        descricao: data.descricao || null, pago: data.pago,
        valor: data.pago && data.valor ? parseFloat(data.valor) : 0, comunidade: data.comunidade,
        produto_id: data.produto_id || null, turma_id: data.turma_id || null,
      }).eq("id", id);
      if (error) throw error;

      await (supabase as any).from("eventos_responsaveis").delete().eq("evento_id", id);
      if (data.responsavelIds.length > 0) {
        await (supabase as any).from("eventos_responsaveis").insert(
          data.responsavelIds.map((pid) => ({ evento_id: id, profissional_id: pid }))
        );
      }

      // A data pode ter mudado (feriado, imprevisto...) — recalcula os prazos
      // das tarefas do checklist ainda pendentes para acompanhar a nova data.
      try {
        const r = await recalcularPrazosDoEvento(id);
        return r.atualizadas;
      } catch {
        return 0; // não trava a edição do evento por causa disso
      }
    },
    onSuccess: (atualizadas) => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      queryClient.invalidateQueries({ queryKey: ["tarefas-evento", editingId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Evento atualizado"); setDialogOpen(false);
      if (atualizadas) {
        toast.info(`Checklist: ${atualizadas} prazo(s) reajustado(s) pela nova data.`);
      }
      if (selectedEvento && editingId === selectedEvento.id) {
        setSelectedEvento((prev: any) => ({
          ...prev, nome: form.nome, data: form.data || null, local: form.local || null,
          tipo: form.tipo || null, responsavelIds: form.responsavelIds,
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["eventos"] }); toast.success("Evento excluído"); if (selectedEvento) closeEventoDetail(); },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  // Handlers
  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (e: any) => {
    setForm({
      nome: e.nome, data: e.data || "", local: e.local || "", tipo: e.tipo || "",
      responsavelIds: e.responsavelIds || [],
      limite_participantes: e.limite_participantes?.toString() || "",
      descricao: e.descricao || "", pago: e.pago || false, valor: e.valor ? String(e.valor) : "",
      comunidade: e.comunidade || false, vincular_turma: !!(e.produto_id && !e.comunidade),
      produto_id: e.produto_id || "", turma_id: e.turma_id || "",
      checklist_template_id: e.checklist_template_id || "",
    });
    setEditingId(e.id); setDialogOpen(true);
  };

  const save = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!editingId && !form.checklist_template_id) {
      toast.error("Escolha o checklist do evento para prosseguir.");
      return;
    }
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else insertMutation.mutate(form);
  };

  // Detail view
  if (selectedEvento) {
    return (
      <>
        <ParticipantesSection
          evento={selectedEvento}
          onBack={closeEventoDetail}
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
          checklistModelos={modelosChecklist}
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
        checklistModelos={modelosChecklist}
      />

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={irHoje}>
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => irMes(-1)}
            disabled={verTodos}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => irMes(1)}
            disabled={verTodos}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-1">
            {verTodos
              ? "Todos os meses"
              : `${NOMES_MES[mesRef.getMonth()]} de ${mesRef.getFullYear()}`}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {eventosDoMes.length} evento(s)
          </span>
          <Button
            variant={verTodos ? "default" : "outline"}
            size="sm"
            onClick={() => setVerTodos((v) => !v)}
          >
            {verTodos ? "Ver por mês" : "Ver todos"}
          </Button>
        </div>
      </div>

      <EventoTable
        eventos={eventosDoMes}
        isLoading={isLoading}
        countParticipantes={countParticipantes}
        onSelect={openEventoDetail}
        onEdit={openEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
};

export default Eventos;
