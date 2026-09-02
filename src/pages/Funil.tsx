import { useState, useMemo, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, pointerWithin } from "@dnd-kit/core";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Check, Edit2, Trash2, X, ChevronDown, ChevronRight, Users, MessageSquare, Instagram } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/components/ActivityTimeline";
import { cn } from "@/lib/utils";
import type { LeadRow, ProdutoSelect, ComercialSelect, TurmaSelect } from "@/types";

import { LeadForm, emptyLeadForm, type FunilEtapa } from "@/components/funil/funilUtils";
import { FunilMetrics } from "@/components/funil/FunilMetrics";
import { LeadCard } from "@/components/funil/LeadCard";
import { FunilFilters } from "@/components/funil/FunilFilters";
import { FunilColumn } from "@/components/funil/FunilColumn";
import { FunilEtapaDialog } from "@/components/funil/FunilEtapaDialog";
import { LeadFormDialog } from "@/components/funil/LeadFormDialog";
import { LeadDetailSheet } from "@/components/funil/LeadDetailSheet";
import { CrmInbox } from "@/components/funil/CrmInbox";

type FunilQuadro = {
  id: string;
  nome: string;
  ordem: number;
  fixo?: boolean;
  canal?: string | null;
  created_at?: string | null;
};

const ETAPAS_PADRAO: Array<{ nome: string; cor: string; tipo: FunilEtapa["tipo"] }> = [
  { nome: "Novo Lead", cor: "slate", tipo: "em_andamento" },
  { nome: "Em contato", cor: "blue", tipo: "em_andamento" },
  { nome: "Proposta enviada", cor: "orange", tipo: "em_andamento" },
  { nome: "Convertido", cor: "green", tipo: "ganho" },
  { nome: "Perdido", cor: "red", tipo: "perdido" },
];

interface Filters {
  search: string;
  responsavel_id: string;
  produto_interesse: string;
  origem: string;
  cidade: string;
  data: string;
}

const defaultFilters: Filters = {
  search: "", responsavel_id: "todos", produto_interesse: "todos", origem: "todos", cidade: "todos", data: "",
};

const Funil = () => {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const debouncedSearch = useDebounce(filters.search, 300);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyLeadForm);
  const [etapaDialogOpen, setEtapaDialogOpen] = useState(false);
  const [editEtapa, setEditEtapa] = useState<FunilEtapa | null>(null);

  // Quadros
  const [selectedQuadroId, setSelectedQuadroId] = useState<string | null>(null);
  const [newQuadroName, setNewQuadroName] = useState("");
  const [editingQuadroId, setEditingQuadroId] = useState<string | null>(null);
  const [editingQuadroName, setEditingQuadroName] = useState("");
  const [quadrosVisible, setQuadrosVisible] = useState(true);

  // Import contacts state
  const [importOpen, setImportOpen] = useState(false);
  const [importTipo, setImportTipo] = useState<"evento" | "turma">("evento");
  const [importEventoId, setImportEventoId] = useState("");
  const [importTurmaId, setImportTurmaId] = useState("");

  const [activeLead, setActiveLead] = useState<LeadRow | null>(null);

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // ── Queries ──
  const { data: quadros = [], isLoading: quadrosLoading } = useQuery<FunilQuadro[]>({
    queryKey: ["funil-quadros", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_quadros")
        .select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as FunilQuadro[];
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (!selectedQuadroId && quadros.length > 0) {
      setSelectedQuadroId(quadros[0].id);
    }
  }, [quadros, selectedQuadroId]);

  const selectedQuadro = useMemo(
    () => quadros.find((q) => q.id === selectedQuadroId) ?? null,
    [quadros, selectedQuadroId]
  );

  const { data: leads = [], isLoading } = useQuery<LeadRow[]>({
    queryKey: ["leads", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("empresa_id", empresaId!).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: etapas = [], isLoading: etapasLoading } = useQuery<FunilEtapa[]>({
    queryKey: ["funil-etapas", selectedQuadroId],
    queryFn: async () => {
      if (!selectedQuadroId) return [];
      const { data, error } = await (supabase as any)
        .from("funil_etapas")
        .select("*")
        .eq("quadro_id", selectedQuadroId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as FunilEtapa[];
    },
    enabled: !!selectedQuadroId,
  });

  const { data: allEtapas = [] } = useQuery<FunilEtapa[]>({
    queryKey: ["funil-etapas-all", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_etapas")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as FunilEtapa[];
    },
    enabled: !!empresaId,
  });

  const { data: produtos = [] } = useQuery<ProdutoSelect[]>({
    queryKey: ["produtos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome, valor").eq("empresa_id", empresaId!).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: comerciais = [] } = useQuery<ComercialSelect[]>({
    queryKey: ["comerciais-funil", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("id, nome").eq("empresa_id", empresaId!).eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: turmas = [] } = useQuery<TurmaSelect[]>({
    queryKey: ["turmas-funil", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("turmas").select("id, nome, produto_id, produtos(nome)").eq("empresa_id", empresaId!).is("deleted_at", null);
      if (error) throw error;
      return (data || []).sort((a: TurmaSelect, b: TurmaSelect) => {
        const pa = a.produtos?.nome ?? "";
        const pb = b.produtos?.nome ?? "";
        return pa.localeCompare(pb, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
      });
    },
    enabled: !!empresaId,
  });

  const { data: eventosImport = [] } = useQuery({
    queryKey: ["eventos-funil-import", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("eventos")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(100);
      return (data || []) as { id: string; nome: string }[];
    },
    enabled: !!empresaId,
  });

  const { data: previewCount, isFetching: previewFetching } = useQuery({
    queryKey: ["funil-import-preview", importTipo, importEventoId, importTurmaId],
    queryFn: async () => {
      if (importTipo === "evento" && importEventoId) {
        const { count } = await (supabase as any)
          .from("participantes_eventos")
          .select("id", { count: "exact", head: true })
          .eq("evento_id", importEventoId);
        return count ?? 0;
      }
      if (importTipo === "turma" && importTurmaId) {
        const { count } = await (supabase as any)
          .from("matriculas")
          .select("id", { count: "exact", head: true })
          .eq("turma_id", importTurmaId)
          .is("deleted_at", null);
        return count ?? 0;
      }
      return null;
    },
    enabled: importOpen && ((importTipo === "evento" && !!importEventoId) || (importTipo === "turma" && !!importTurmaId)),
  });

  const comerciaisMap = useMemo(() => new Map(comerciais.map((c) => [c.id, c.nome])), [comerciais]);
  const etapasMap = useMemo(() => new Map(etapas.map((e) => [e.id, e])), [etapas]);

  // Leads do quadro selecionado (via etapa_id pertencente ao quadro)
  const currentEtapaIds = useMemo(() => new Set(etapas.map((e) => e.id)), [etapas]);
  const quadroLeads = useMemo(
    () => leads.filter((l: any) => currentEtapaIds.has(l.etapa_id)),
    [leads, currentEtapaIds]
  );

  const filteredLeads = useMemo(() => {
    return quadroLeads.filter((l) => {
      if (debouncedSearch && !l.nome.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      if (filters.responsavel_id !== "todos") {
        if (filters.responsavel_id === "sem") { if (l.responsavel_id) return false; }
        else if (l.responsavel_id !== filters.responsavel_id) return false;
      }
      if (filters.produto_interesse !== "todos" && l.produto_interesse !== filters.produto_interesse) return false;
      if (filters.origem !== "todos" && l.origem !== filters.origem) return false;
      if (filters.cidade !== "todos" && l.cidade !== filters.cidade) return false;
      if (filters.data && l.created_at.slice(0, 10) !== filters.data) return false;
      return true;
    });
  }, [quadroLeads, debouncedSearch, filters]);

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

  // ── Mutations: quadros ──
  const createQuadroMutation = useMutation({
    mutationFn: async (nome: string) => {
      const ordem = quadros.length;
      const { data: quadro, error } = await (supabase as any)
        .from("funil_quadros")
        .insert({ nome: nome.trim(), ordem, empresa_id: empresaId })
        .select("id")
        .single();
      if (error) throw error;

      await Promise.all(
        ETAPAS_PADRAO.map((e, i) =>
          (supabase as any).from("funil_etapas").insert({ ...e, quadro_id: quadro.id, ordem: i, observacoes: null, empresa_id: empresaId })
        )
      );

      // Import contacts if configured
      let importResult = { novos: 0, pulados: 0 };
      if (importOpen && (importEventoId || importTurmaId)) {
        let contacts: Array<{ nome: string; telefone?: string; email?: string }> = [];

        if (importTipo === "evento" && importEventoId) {
          const { data } = await (supabase as any)
            .from("participantes_eventos")
            .select("nome, telefone, email")
            .eq("evento_id", importEventoId);
          contacts = (data || []).filter((p: any) => p.nome?.trim());
        } else if (importTipo === "turma" && importTurmaId) {
          const { data } = await (supabase as any)
            .from("matriculas")
            .select("alunos(nome, telefone, email)")
            .eq("turma_id", importTurmaId)
            .is("deleted_at", null);
          contacts = (data || [])
            .map((m: any) => m.alunos)
            .filter((a: any) => a?.nome?.trim());
        }

        if (contacts.length > 0) {
          const existingPhones = new Set(
            (leads as any[]).filter((l) => l.telefone).map((l) => l.telefone?.trim())
          );
          const novos = contacts.filter(
            (c) => !c.telefone?.trim() || !existingPhones.has(c.telefone.trim())
          );
          importResult.pulados = contacts.length - novos.length;
          importResult.novos = novos.length;

          if (novos.length > 0) {
            const { data: primeiraEtapa } = await (supabase as any)
              .from("funil_etapas")
              .select("id")
              .eq("quadro_id", quadro.id)
              .eq("ordem", 0)
              .single();

            if (primeiraEtapa?.id) {
              await (supabase as any).from("leads").insert(
                novos.map((c) => ({
                  nome: c.nome.trim(),
                  telefone: c.telefone?.trim() || null,
                  email: c.email?.trim() || null,
                  etapa_id: primeiraEtapa.id,
                  empresa_id: empresaId,
                }))
              );
            }
          }
        }
      }

      return { id: quadro.id as string, importResult };
    },
    onSuccess: ({ id, importResult }) => {
      queryClient.invalidateQueries({ queryKey: ["funil-quadros"] });
      queryClient.invalidateQueries({ queryKey: ["funil-etapas", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setNewQuadroName("");
      setImportOpen(false);
      setImportEventoId("");
      setImportTurmaId("");
      setSelectedQuadroId(id);
      if (importResult.novos > 0 || importResult.pulados > 0) {
        const msg = `Quadro criado · ${importResult.novos} lead${importResult.novos !== 1 ? "s" : ""} importado${importResult.novos !== 1 ? "s" : ""}${importResult.pulados > 0 ? ` · ${importResult.pulados} já existia${importResult.pulados !== 1 ? "m" : ""} e foi${importResult.pulados !== 1 ? "ram" : ""} ignorado${importResult.pulados !== 1 ? "s" : ""}` : ""}`;
        toast.success(msg);
      } else {
        toast.success("Quadro criado");
      }
    },
    onError: (err: any) => toast.error("Erro ao criar quadro: " + err.message),
  });

  const renameQuadroMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await (supabase as any).from("funil_quadros").update({ nome: nome.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funil-quadros"] });
      setEditingQuadroId(null);
      toast.success("Quadro renomeado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteQuadroMutation = useMutation({
    mutationFn: async (quadro: FunilQuadro) => {
      const { data: quadroEtapas, error: etapasErr } = await (supabase as any)
        .from("funil_etapas").select("id").eq("quadro_id", quadro.id);
      if (etapasErr) throw etapasErr;

      const etapaIdsList = (quadroEtapas || []).map((e: any) => e.id as string);
      const quadroEtapaIds = new Set(etapaIdsList);

      // Block if there are active (visible) leads
      const leadCount = leads.filter((l: any) => quadroEtapaIds.has(l.etapa_id)).length;
      if (leadCount > 0) throw new Error(`Mova os ${leadCount} lead(s) deste quadro antes de excluí-lo.`);

      if (etapaIdsList.length > 0) {
        // Fetch all leads in these etapas (including soft-deleted)
        const { data: allLeads } = await (supabase as any)
          .from("leads").select("id").in("etapa_id", etapaIdsList);
        const leadIds = (allLeads || []).map((l: any) => l.id as string);

        if (leadIds.length > 0) {
          await (supabase as any).from("tarefas").update({ lead_id: null }).in("lead_id", leadIds);
          await (supabase as any).from("atividades").delete().in("lead_id", leadIds);
          await (supabase as any).from("leads").delete().in("id", leadIds);
        }

        const { error: delEtapasErr } = await (supabase as any)
          .from("funil_etapas").delete().eq("quadro_id", quadro.id);
        if (delEtapasErr) throw delEtapasErr;
      }

      const { error } = await (supabase as any).from("funil_quadros").delete().eq("id", quadro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funil-quadros"] });
      queryClient.invalidateQueries({ queryKey: ["funil-etapas"] });
      setSelectedQuadroId(null);
      toast.success("Quadro excluído");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // ── Mutations: leads ──
  const insertMutation = useMutation({
    mutationFn: async (data: LeadForm) => {
      if (!data.etapa_id) throw new Error("Selecione uma coluna no funil antes de cadastrar.");
      const { error } = await supabase.from("leads").insert({
        empresa_id: empresaId,
        nome: data.nome,
        email: data.email || null,
        telefone: data.telefone || null,
        cidade: data.cidade || null,
        produto_interesse: data.produto_interesse || null,
        origem: data.origem ? data.origem.toLowerCase() : null,
        observacoes: data.observacoes || null,
        responsavel_id: data.responsavel_id && data.responsavel_id !== "none" ? data.responsavel_id : null,
        etapa_id: data.etapa_id,
        valor: data.valor ? Number(data.valor) : null,
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead movido"); },
    onError: (err: Error) => toast.error("Erro ao mover: " + err.message),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead excluído"); },
    onError: (err: Error) => toast.error("Erro ao excluir: " + err.message),
  });

  // ── Mutations: etapas (colunas) ──
  const insertEtapaMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string; quadro_id: string }) => {
      const ordem = etapas.length;
      const { error } = await (supabase as any).from("funil_etapas").insert({ ...data, ordem, empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funil-etapas", selectedQuadroId] });
      queryClient.invalidateQueries({ queryKey: ["funil-etapas-all"] });
      toast.success("Coluna criada");
    },
    onError: (err: any) => toast.error("Erro ao criar coluna: " + err.message),
  });

  const updateEtapaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string } }) => {
      const { error } = await (supabase as any).from("funil_etapas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funil-etapas", selectedQuadroId] });
      queryClient.invalidateQueries({ queryKey: ["funil-etapas-all"] });
      toast.success("Coluna atualizada");
    },
    onError: (err: any) => toast.error("Erro ao atualizar coluna: " + err.message),
  });

  const deleteEtapaMutation = useMutation({
    mutationFn: async (etapa: FunilEtapa) => {
      const emUso = quadroLeads.filter((l: any) => l.etapa_id === etapa.id).length;
      if (emUso > 0) throw new Error(`Mova os ${emUso} lead(s) desta coluna antes de excluí-la.`);
      const { error } = await (supabase as any).from("funil_etapas").delete().eq("id", etapa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funil-etapas", selectedQuadroId] });
      queryClient.invalidateQueries({ queryKey: ["funil-etapas-all"] });
      toast.success("Coluna excluída");
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funil-etapas", selectedQuadroId] });
      queryClient.invalidateQueries({ queryKey: ["funil-etapas-all"] });
    },
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

  const handleSaveEtapa = async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string }) => {
    if (editEtapa) await updateEtapaMutation.mutateAsync({ id: editEtapa.id, data });
    else await insertEtapaMutation.mutateAsync({ ...data, quadro_id: selectedQuadroId! });
  };

  const handleDeleteEtapa = (etapa: FunilEtapa) => {
    if (etapas.length <= 1) { toast.error("O funil precisa de ao menos uma coluna."); return; }
    deleteEtapaMutation.mutate(etapa);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find((l) => l.id === event.active.id) ?? null;
    setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const targetEtapaId = over.id as string;
    const lead = leads.find((l) => l.id === leadId) as any;
    if (!lead || lead.etapa_id === targetEtapaId) return;
    moveEtapaMutation.mutate({ id: leadId, fromEtapaId: lead.etapa_id, toEtapaId: targetEtapaId });
  };

  const saveLead = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.etapa_id) { toast.error("Selecione uma coluna no funil"); return; }
    insertMutation.mutate(form);
  };

  const etapasOrdenadas = useMemo(() => [...etapas].sort((a, b) => a.ordem - b.ordem), [etapas]);
  const loading = isLoading || etapasLoading;

  return (
    <>
      {/* Modais fora do layout para não quebrar o flex */}
      <LeadFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        onSave={saveLead}
        isPending={insertMutation.isPending}
        produtos={produtos}
        comerciais={comerciais}
        quadros={quadros}
        allEtapas={allEtapas}
      />
      <FunilEtapaDialog
        open={etapaDialogOpen}
        onClose={() => { setEtapaDialogOpen(false); setEditEtapa(null); }}
        onSave={handleSaveEtapa}
        initialData={editEtapa}
      />
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

      <div className="flex h-full min-h-[calc(100vh-7rem)] rounded-lg overflow-hidden border bg-card">
        {/* Sidebar — lista de quadros */}
        {quadrosVisible && (
          <aside className="w-[240px] shrink-0 border-r bg-card flex flex-col">
            <div className="p-4 border-b flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold leading-tight">Quadros do Funil</h2>
                <p className="text-xs text-muted-foreground">Cada quadro tem seu pipeline</p>
              </div>
            </div>

            <div className="p-3 border-b space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newQuadroName.trim()) return;
                  createQuadroMutation.mutate(newQuadroName);
                }}
                className="flex gap-2"
              >
                <Input
                  value={newQuadroName}
                  onChange={(e) => setNewQuadroName(e.target.value)}
                  placeholder="Nome do quadro..."
                  className="h-9 text-sm"
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={createQuadroMutation.isPending}>
                  {createQuadroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </form>

              {/* Import contacts toggle */}
              <button
                type="button"
                onClick={() => setImportOpen((v) => !v)}
                className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
              >
                {importOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Users className="h-3.5 w-3.5" />
                Importar contatos do evento/turma
              </button>

              {importOpen && (
                <div className="space-y-2 pt-1">
                  {/* Tipo toggle */}
                  <div className="flex gap-1">
                    {(["evento", "turma"] as const).map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => { setImportTipo(tipo); setImportEventoId(""); setImportTurmaId(""); }}
                        className={cn(
                          "flex-1 py-1 text-xs rounded border transition-colors",
                          importTipo === tipo ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted/50"
                        )}
                      >
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Source select */}
                  {importTipo === "evento" ? (
                    <select
                      value={importEventoId}
                      onChange={(e) => setImportEventoId(e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Selecione o evento...</option>
                      {(eventosImport as { id: string; nome: string }[]).map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.nome}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={importTurmaId}
                      onChange={(e) => setImportTurmaId(e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Selecione a turma...</option>
                      {turmas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.produtos?.nome ? `${t.produtos.nome} · ${t.nome}` : t.nome}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Preview count */}
                  {((importTipo === "evento" && importEventoId) || (importTipo === "turma" && importTurmaId)) && (
                    <p className="text-[11px] text-muted-foreground">
                      {previewFetching
                        ? "Contando..."
                        : previewCount != null
                          ? `${previewCount} contato${previewCount !== 1 ? "s" : ""} encontrado${previewCount !== 1 ? "s" : ""}`
                          : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-1">
              {quadrosLoading ? (
                <p className="text-xs text-muted-foreground text-center p-4">Carregando...</p>
              ) : (
                <>
                  {/* Fixed CRM boards */}
                  {quadros.filter((q) => q.fixo).map((quadro) => (
                    <div
                      key={quadro.id}
                      onClick={() => setSelectedQuadroId(quadro.id)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer transition-colors",
                        selectedQuadroId === quadro.id
                          ? "bg-primary/15 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {quadro.canal === "whatsapp" ? (
                        <MessageSquare className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <Instagram className="h-4 w-4 text-pink-600 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{quadro.nome}</span>
                    </div>
                  ))}

                  {/* Separator if there are both fixed and normal */}
                  {quadros.some((q) => q.fixo) && quadros.some((q) => !q.fixo) && (
                    <div className="border-t my-1" />
                  )}

                  {/* Normal boards */}
                  {quadros.filter((q) => !q.fixo).length === 0 && !quadros.some((q) => q.fixo) && (
                    <div className="text-center p-6 space-y-2">
                      <LayoutDashboard className="h-8 w-8 mx-auto text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Crie o primeiro quadro de funil.</p>
                    </div>
                  )}
                  {quadros.filter((q) => !q.fixo).map((quadro) => (
                    <div
                      key={quadro.id}
                      className={cn(
                        "flex items-center gap-1 px-2 py-2 rounded-md text-sm cursor-pointer group transition-colors",
                        selectedQuadroId === quadro.id
                          ? "bg-primary/15 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {editingQuadroId === quadro.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editingQuadroName.trim()) renameQuadroMutation.mutate({ id: quadro.id, nome: editingQuadroName });
                          }}
                          className="flex items-center gap-1 flex-1"
                        >
                          <Input
                            value={editingQuadroName}
                            onChange={(e) => setEditingQuadroName(e.target.value)}
                            className="h-7 text-xs"
                            autoFocus
                          />
                          <Button type="submit" size="icon" variant="ghost" className="h-7 w-7">
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingQuadroId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      ) : (
                        <>
                          <span className="flex-1 truncate" onClick={() => setSelectedQuadroId(quadro.id)}>
                            {quadro.nome}
                          </span>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => { setEditingQuadroId(quadro.id); setEditingQuadroName(quadro.nome); }}
                            title="Renomear"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={() => deleteQuadroMutation.mutate(quadro)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </aside>
        )}

        {/* Área principal */}
        <main className="flex-1 min-w-0 flex flex-col bg-background overflow-auto">
          <div className="p-6 space-y-6 min-h-full">
            <PageHeader
              title={selectedQuadro?.nome || "Funil Comercial"}
              description={selectedQuadro?.fixo ? "Mensagens recebidas e conversas ativas" : "Pipeline de leads e conversão"}
            >
              <Button variant="outline" size="sm" onClick={() => setQuadrosVisible((v) => !v)} className="gap-1">
                {quadrosVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                {quadrosVisible ? "Ocultar" : "Quadros"}
              </Button>
              {selectedQuadroId && !selectedQuadro?.fixo && (
                <>
                  <Button variant="outline" onClick={() => { setEditEtapa(null); setEtapaDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />Nova Coluna
                  </Button>
                  <Button onClick={() => {
                    const primeiraEtapa = [...etapas].sort((a, b) => a.ordem - b.ordem)[0];
                    setForm({ ...emptyLeadForm, quadro_id: selectedQuadroId || "", etapa_id: primeiraEtapa?.id || "" });
                    setDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />Novo Lead
                  </Button>
                </>
              )}
            </PageHeader>

            {!selectedQuadroId ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <LayoutDashboard className="h-12 w-12 opacity-20" />
                <p className="text-sm">Selecione ou crie um quadro de funil na barra lateral.</p>
              </div>
            ) : selectedQuadro?.fixo ? (
              <CrmInbox
                quadroId={selectedQuadroId}
                etapas={etapas}
                canal={(selectedQuadro.canal as "whatsapp" | "instagram") ?? "whatsapp"}
                onLeadClick={(lead) => { setSelectedLead(lead); setSheetOpen(true); }}
              />
            ) : (
              <>
                {!loading && <FunilMetrics leads={quadroLeads} produtos={produtos} etapas={etapas} dataFiltro={filters.data || undefined} />}
                <FunilFilters filters={filters} setFilters={setFilters} comerciais={comerciais} produtos={produtos} />

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : etapasOrdenadas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <p className="text-sm">Nenhuma coluna criada neste funil.</p>
                    <Button size="sm" onClick={() => { setEditEtapa(null); setEtapaDialogOpen(true); }}>
                      <Plus className="h-4 w-4 mr-1" />Criar primeira coluna
                    </Button>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="space-y-2">
                      <div ref={topScrollRef} className="w-full overflow-x-auto overflow-y-hidden shrink-0" onScroll={() => syncScroll("top")}>
                        <div style={{ width: boardWidth }} className="h-1" />
                      </div>
                      <div
                        ref={boardScrollRef}
                        className="w-full overflow-x-auto pb-2"
                        style={{ height: "calc(100svh - 26rem)", minHeight: "280px" }}
                        onScroll={() => syncScroll("board")}
                      >
                        <div className="flex w-max gap-4 h-full">
                          {etapasOrdenadas.map((etapa, idx) => (
                            <FunilColumn
                              key={etapa.id}
                              etapa={etapa}
                              leads={getLeadsByEtapa(etapa.id)}
                              comerciaisMap={comerciaisMap}
                              onLeadClick={(lead) => { setSelectedLead(lead); setSheetOpen(true); }}
                              onDeleteLead={(lead) => deleteLeadMutation.mutate(lead.id)}
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
                    <DragOverlay dropAnimation={null}>
                      {activeLead && (
                        <LeadCard
                          lead={activeLead}
                          comercialNome={activeLead.responsavel_id ? comerciaisMap.get(activeLead.responsavel_id) : undefined}
                          onClick={() => {}}
                          isOverlay
                        />
                      )}
                    </DragOverlay>
                  </DndContext>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Funil;
