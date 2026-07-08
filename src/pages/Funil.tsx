import { useState, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/components/ActivityTimeline";
import type { LeadRow, ProdutoSelect, ComercialSelect, TurmaSelect } from "@/types";

import { LeadForm, emptyLeadForm, origens, cidades, type FunilEtapa } from "@/components/funil/funilUtils";
import { FunilMetrics } from "@/components/funil/FunilMetrics";
import { FunilFilters } from "@/components/funil/FunilFilters";
import { FunilColumn } from "@/components/funil/FunilColumn";
import { FunilEtapaDialog } from "@/components/funil/FunilEtapaDialog";
import { LeadFormDialog } from "@/components/funil/LeadFormDialog";
import { LeadDetailSheet } from "@/components/funil/LeadDetailSheet";

interface Filters {
  search: string;
  responsavel_id: string;
  produto_interesse: string;
  origem: string;
  cidade: string;
}

const defaultFilters: Filters = {
  search: "", responsavel_id: "todos", produto_interesse: "todos", origem: "todos", cidade: "todos",
};

const Funil = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyLeadForm);
  const [etapaDialogOpen, setEtapaDialogOpen] = useState(false);
  const [editEtapa, setEditEtapa] = useState<FunilEtapa | null>(null);

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);

  // Sensors for drag-and-drop (pointer + touch)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // ── Queries ──
  const { data: leads = [], isLoading } = useQuery<LeadRow[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: etapas = [], isLoading: etapasLoading } = useQuery<FunilEtapa[]>({
    queryKey: ["funil-etapas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_etapas")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as FunilEtapa[];
    },
  });

  const { data: produtos = [] } = useQuery<ProdutoSelect[]>({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome, valor").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: comerciais = [] } = useQuery<ComercialSelect[]>({
    queryKey: ["comerciais-funil"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: turmas = [] } = useQuery<TurmaSelect[]>({
    queryKey: ["turmas-funil"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("id, nome, produto_id").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const comerciaisMap = useMemo(() => new Map(comerciais.map((c) => [c.id, c.nome])), [comerciais]);
  const etapasMap = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  // ── Filtered leads ──
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (debouncedSearch && !l.nome.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (filters.responsavel_id !== "todos") {
        if (filters.responsavel_id === "sem") { if (l.responsavel_id) return false; }
        else if (l.responsavel_id !== filters.responsavel_id) return false;
      }
      if (filters.produto_interesse !== "todos" && l.produto_interesse !== filters.produto_interesse) return false;
      if (filters.origem !== "todos" && l.origem !== filters.origem) return false;
      if (filters.cidade !== "todos" && l.cidade !== filters.cidade) return false;
      return true;
    });
  }, [leads, debouncedSearch, filters]);

  const getLeadsByEtapa = (etapaId: string) => filteredLeads.filter((l: any) => l.etapa_id === etapaId);

  const boardWidth = Math.max(etapas.length * 296, 1);
  const syncScroll = (from: "top" | "board") => {
    if (syncingScrollRef.current) return;
    const top = topScrollRef.current;
    const board = boardScrollRef.current;
    if (!top || !board) return;
    syncingScrollRef.current = true;
    if (from === "top") board.scrollLeft = top.scrollLeft;
    else top.scrollLeft = board.scrollLeft;
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  };

  // ── Mutations: leads ──
  const insertMutation = useMutation({
    mutationFn: async (data: LeadForm) => {
      const primeiraEtapa = [...etapas].sort((a, b) => a.ordem - b.ordem)[0];
      if (!primeiraEtapa) throw new Error("Crie ao menos uma coluna no funil antes de cadastrar leads.");
      const { error } = await supabase.from("leads").insert({
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        cidade: data.cidade || null,
        produto_interesse: data.produto_interesse || null,
        origem: data.origem ? data.origem.toLowerCase() : null,
        observacoes: data.observacoes || null,
        responsavel_id: data.responsavel_id && data.responsavel_id !== "none" ? data.responsavel_id : null,
        etapa_id: primeiraEtapa.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead cadastrado");
      setDialogOpen(false);
      setForm(emptyLeadForm);
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const moveEtapaMutation = useMutation({
    mutationFn: async ({ id, fromEtapaId, toEtapaId }: { id: string; fromEtapaId: string; toEtapaId: string }) => {
      const { error } = await supabase.from("leads").update({ etapa_id: toEtapaId } as any).eq("id", id);
      if (error) throw error;
      await logActivity({
        tipo: "avanco_etapa",
        descricao: `Lead movido de ${etapasMap.get(fromEtapaId)?.nome || fromEtapaId} para ${etapasMap.get(toEtapaId)?.nome || toEtapaId}`,
        lead_id: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead movido");
    },
    onError: (err: Error) => toast.error("Erro ao mover: " + err.message),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead excluído");
    },
    onError: (err: Error) => toast.error("Erro ao excluir: " + err.message),
  });

  // ── Mutations: etapas (colunas) ──
  const insertEtapaMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"] }) => {
      const ordem = etapas.length;
      const { error } = await (supabase as any).from("funil_etapas").insert({ ...data, ordem });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-etapas"] }); toast.success("Coluna criada"); },
    onError: (err: any) => toast.error("Erro ao criar coluna: " + err.message),
  });

  const updateEtapaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nome: string; cor: string; tipo: FunilEtapa["tipo"] } }) => {
      const { error } = await (supabase as any).from("funil_etapas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-etapas"] }); toast.success("Coluna atualizada"); },
    onError: (err: any) => toast.error("Erro ao atualizar coluna: " + err.message),
  });

  const deleteEtapaMutation = useMutation({
    mutationFn: async (etapa: FunilEtapa) => {
      const emUso = leads.filter((l: any) => l.etapa_id === etapa.id).length;
      if (emUso > 0) {
        throw new Error(`Mova os ${emUso} lead(s) desta coluna antes de excluí-la.`);
      }
      const { error } = await (supabase as any).from("funil_etapas").delete().eq("id", etapa.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-etapas"] }); toast.success("Coluna excluída"); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const reorderEtapasMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; ordem: number }>) => {
      const results = await Promise.all(
        updates.map((u) => (supabase as any).from("funil_etapas").update({ ordem: u.ordem }).eq("id", u.id))
      );
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funil-etapas"] }),
    onError: (err: any) => toast.error("Erro ao mover coluna: " + err.message),
  });

  const handleMoveEtapa = (etapa: FunilEtapa, direction: -1 | 1) => {
    const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
    const idx = ordenadas.findIndex((e) => e.id === etapa.id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= ordenadas.length) return;
    const reordenadas = [...ordenadas];
    [reordenadas[idx], reordenadas[targetIdx]] = [reordenadas[targetIdx], reordenadas[idx]];
    reorderEtapasMutation.mutate(reordenadas.map((e, i) => ({ id: e.id, ordem: i })));
  };

  const handleSaveEtapa = async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"] }) => {
    if (editEtapa) await updateEtapaMutation.mutateAsync({ id: editEtapa.id, data });
    else await insertEtapaMutation.mutateAsync(data);
  };

  const handleDeleteEtapa = (etapa: FunilEtapa) => {
    if (etapas.length <= 1) { toast.error("O funil precisa de ao menos uma coluna."); return; }
    if (confirm(`Excluir a coluna "${etapa.nome}"?`)) deleteEtapaMutation.mutate(etapa);
  };

  // ── Drag and Drop ──
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const targetEtapaId = over.id as string;
    const lead = leads.find((l) => l.id === leadId) as any;
    if (!lead || lead.etapa_id === targetEtapaId) return;
    const targetEtapa = etapasMap.get(targetEtapaId);
    // Perda sempre passa pela tela de detalhe (exige motivo).
    if (targetEtapa?.tipo === "perdido") return;
    moveEtapaMutation.mutate({ id: leadId, fromEtapaId: lead.etapa_id, toEtapaId: targetEtapaId });
  };

  const saveLead = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    insertMutation.mutate(form);
  };

  const etapasOrdenadas = useMemo(() => [...etapas].sort((a, b) => a.ordem - b.ordem), [etapas]);
  const loading = isLoading || etapasLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Funil Comercial" description="Pipeline de leads e conversão">
        <Button variant="outline" onClick={() => { setEditEtapa(null); setEtapaDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nova Coluna
        </Button>
        <Button onClick={() => { setForm(emptyLeadForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo Lead
        </Button>
      </PageHeader>

      {/* Metrics */}
      {!loading && <FunilMetrics leads={leads} produtos={produtos} etapas={etapas} />}

      {/* Filters */}
      <FunilFilters filters={filters} setFilters={setFilters} comerciais={comerciais} produtos={produtos} />

      {/* Lead Form Dialog */}
      <LeadFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        onSave={saveLead}
        isPending={insertMutation.isPending}
        produtos={produtos}
        comerciais={comerciais}
      />

      <FunilEtapaDialog
        open={etapaDialogOpen}
        onClose={() => { setEtapaDialogOpen(false); setEditEtapa(null); }}
        onSave={handleSaveEtapa}
        initialData={editEtapa}
      />

      {/* Pipeline columns with DnD — largura fixa, rolagem horizontal (não comprime) */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : etapasOrdenadas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <p className="text-sm">Nenhuma coluna criada no funil ainda.</p>
          <Button size="sm" onClick={() => { setEditEtapa(null); setEtapaDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Criar primeira coluna
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-2">
            <div ref={topScrollRef} className="w-full overflow-x-auto overflow-y-hidden" onScroll={() => syncScroll("top")}>
              <div style={{ width: boardWidth }} className="h-1" />
            </div>
            <div ref={boardScrollRef} className="w-full overflow-x-auto overflow-y-hidden pb-2" onScroll={() => syncScroll("board")}>
              <div className="flex w-max gap-4">
                {etapasOrdenadas.map((etapa, idx) => (
                  <FunilColumn
                    key={etapa.id}
                    etapa={etapa}
                    leads={getLeadsByEtapa(etapa.id)}
                    comerciaisMap={comerciaisMap}
                    onLeadClick={(lead) => { setSelectedLead(lead); setSheetOpen(true); }}
                    onDeleteLead={(lead) => {
                      if (confirm(`Excluir o lead "${lead.nome}"? Esta ação não pode ser desfeita.`)) {
                        deleteLeadMutation.mutate(lead.id);
                      }
                    }}
                    onEditEtapa={(e) => { setEditEtapa(e); setEtapaDialogOpen(true); }}
                    onDeleteEtapa={handleDeleteEtapa}
                    onMoveEtapa={handleMoveEtapa}
                    canMoveLeft={idx > 0}
                    canMoveRight={idx < etapasOrdenadas.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </DndContext>
      )}

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        lead={selectedLead}
        produtos={produtos}
        comerciais={comerciais}
        turmas={turmas}
        etapas={etapas}
        onDeleteLead={(id) => deleteLeadMutation.mutate(id)}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          if (selectedLead) queryClient.invalidateQueries({ queryKey: ["atividades", undefined, selectedLead.id] });
        }}
      />
    </div>
  );
};

export default Funil;
