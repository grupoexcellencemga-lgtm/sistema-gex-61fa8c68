import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/components/ActivityTimeline";
import type { LeadRow, ProdutoSelect, ComercialSelect, TurmaSelect } from "@/types";

import { LeadForm, emptyLeadForm, etapas, etapaOrder, etapaLabels } from "@/components/funil/funilUtils";
import { FunilMetrics } from "@/components/funil/FunilMetrics";
import { FunilFilters } from "@/components/funil/FunilFilters";
import { FunilColumn } from "@/components/funil/FunilColumn";
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

  const getLeadsByEtapa = (etapa: string) => filteredLeads.filter((l) => l.etapa === etapa);

  // ── Mutations ──
  const insertMutation = useMutation({
    mutationFn: async (data: LeadForm) => {
      const { error } = await supabase.from("leads").insert({
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        cidade: data.cidade || null,
        produto_interesse: data.produto_interesse || null,
        origem: data.origem ? data.origem.toLowerCase() : null,
        observacoes: data.observacoes || null,
        responsavel_id: data.responsavel_id && data.responsavel_id !== "none" ? data.responsavel_id : null,
        etapa: "lead",
      });
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
    mutationFn: async ({ id, fromEtapa, toEtapa }: { id: string; fromEtapa: string; toEtapa: string }) => {
      const { error } = await supabase.from("leads").update({ etapa: toEtapa }).eq("id", id);
      if (error) throw error;
      await logActivity({
        tipo: "avanco_etapa",
        descricao: `Lead movido de ${etapaLabels[fromEtapa] || fromEtapa} para ${etapaLabels[toEtapa] || toEtapa}`,
        lead_id: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead movido");
    },
    onError: (err: Error) => toast.error("Erro ao mover: " + err.message),
  });

  // ── Drag and Drop ──
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const targetEtapa = over.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.etapa === targetEtapa) return;
    // Don't allow dropping into "perdido" via drag
    if (targetEtapa === "perdido") return;
    moveEtapaMutation.mutate({ id: leadId, fromEtapa: lead.etapa, toEtapa: targetEtapa });
  };

  const saveLead = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    insertMutation.mutate(form);
  };

  const activeEtapas = etapas.filter((e) => e.key !== "perdido");
  const perdidos = getLeadsByEtapa("perdido");

  return (
    <div className="space-y-6">
      <PageHeader title="Funil Comercial" description="Pipeline de leads e conversão">
        <Button onClick={() => { setForm(emptyLeadForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Novo Lead
        </Button>
      </PageHeader>

      {/* Metrics */}
      {!isLoading && <FunilMetrics leads={leads} produtos={produtos} />}

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

      {/* Pipeline columns with DnD */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-x-visible md:pb-0">
            {activeEtapas.map((etapa) => (
              <FunilColumn
                key={etapa.key}
                etapa={etapa}
                leads={getLeadsByEtapa(etapa.key)}
                comerciaisMap={comerciaisMap}
                onLeadClick={(lead) => { setSelectedLead(lead); setSheetOpen(true); }}
              />
            ))}
          </div>
        </DndContext>
      )}

      {/* Lost leads section */}
      {perdidos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-destructive">Leads Perdidos ({perdidos.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {perdidos.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-secondary/50"
                  onClick={() => { setSelectedLead(lead); setSheetOpen(true); }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.produto_interesse}{lead.origem ? ` · ${lead.origem}` : ""}
                    </p>
                    {lead.motivo_perda && (
                      <p className="text-xs text-destructive/70 truncate mt-0.5">{lead.motivo_perda}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        lead={selectedLead}
        produtos={produtos}
        comerciais={comerciais}
        turmas={turmas}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          if (selectedLead) queryClient.invalidateQueries({ queryKey: ["atividades", undefined, selectedLead.id] });
        }}
      />
    </div>
  );
};

export default Funil;
