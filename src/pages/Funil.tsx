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
import { FunilSidebar } from "@/components/funil/FunilSidebar";
import { pickAvailableBoard, type FunilPasta, type FunilQuadroOrganizado } from "@/components/funil/funilFolders";
import { AgentesBotSection } from "@/components/configuracoes/AgentesBotSection";
import { usePermissions } from "@/hooks/usePermissions";

type FunilQuadro = FunilQuadroOrganizado;

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
  const { canAccess } = usePermissions();
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
  const [crmView, setCrmView] = useState<"conversas" | "oportunidades" | "agentes">("conversas");
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

  const { data: pastas = [], isLoading: pastasLoading } = useQuery<FunilPasta[]>({
    queryKey: ["funil-pastas", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("funil_pastas").select("id, nome, ordem").eq("empresa_id", empresaId!).is("deleted_at", null).order("ordem");
      if (error) throw error;
      return (data || []) as FunilPasta[];
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (crmView !== "agentes" && quadros.length > 0) {
      const eligible = quadros.filter(q => crmView === "conversas" ? q.fixo || q.canal : !q.fixo && !q.canal);
      if (!eligible.some(q => q.id === selectedQuadroId)) {
        setSelectedQuadroId(crmView === "oportunidades" ? pickAvailableBoard(selectedQuadroId, eligible) : eligible[0]?.id ?? null);
      }
    }
  }, [quadros, selectedQuadroId, crmView]);

  const selectedQuadro = useMemo(
    () => quadros.find((q) => q.id === selectedQuadroId) ?? null,
    [quadros, selectedQuadroId]
  );

  type FunilCardRow = LeadRow & { funil_card_id: string };

  const isInboxQuadro = !!(selectedQuadro?.fixo || selectedQuadro?.canal);

  const { data: cards = [], isLoading } = useQuery<FunilCardRow[]>({
    queryKey: ["funil-cards", selectedQuadroId],
    queryFn: async () => {
      if (!selectedQuadroId || isInboxQuadro) return [];
      const { data, error } = await (supabase as any)
        .from("funil_cards")
        .select("id, etapa_id, leads(*)")
        .eq("quadro_id", selectedQuadroId)
        .eq("status", "ativo");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c.leads,
        etapa_id: c.etapa_id,
        funil_card_id: c.id,
      })) as FunilCardRow[];
    },
    enabled: !!selectedQuadroId && !!empresaId && !isInboxQuadro,
    refetchInterval: 30000,
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

  const quadroLeads = cards;

  const filteredLeads = useMemo(() => {
    return cards.filter((l) => {
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
  }, [cards, debouncedSearch, filters]);

  const getLeadsByEtapa = (etapaId: string) => filteredLeads.filter((l) => l.etapa_id === etapaId);

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
    mutationFn: async ({ nome, pastaId }: { nome: string; pastaId: string | null }) => {
      const ordem = quadros.length;
      const ordemNaPasta = quadros.filter((q) => q.pasta_id === pastaId).length;
      const { data: quadro, error } = await (supabase as any)
        .from("funil_quadros")
        .insert({ nome: nome.trim(), ordem, empresa_id: empresaId, pasta_id: pastaId, ordem_na_pasta: ordemNaPasta, status_ciclo: "preparacao" })
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
          // Check existing phones from DB to avoid duplicates on import
          const { data: existingLeads } = await (supabase as any)
            .from("leads").select("telefone").eq("empresa_id", empresaId!).not("telefone", "is", null);
          const existingPhones = new Set(
            (existingLeads || []).map((l: any) => l.telefone?.trim())
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
              const { data: newLeads } = await (supabase as any).from("leads").insert(
                novos.map((c) => ({
                  nome: c.nome.trim(),
                  telefone: c.telefone?.trim() || null,
                  email: c.email?.trim() || null,
                  etapa_id: primeiraEtapa.id,
                  empresa_id: empresaId,
                }))
              ).select("id");
              if (newLeads?.length) {
                await (supabase as any).from("funil_cards").insert(
                  newLeads.map((l: any) => ({
                    lead_id: l.id,
                    quadro_id: quadro.id,
                    etapa_id: primeiraEtapa.id,
                    empresa_id: empresaId,
                  }))
                );
              }
            }
          }
        }
      }

      return { id: quadro.id as string, importResult };
    },
    onSuccess: ({ id, importResult }) => {
      queryClient.invalidateQueries({ queryKey: ["funil-quadros"] });
      queryClient.invalidateQueries({ queryKey: ["funil-etapas", id] });
      queryClient.invalidateQueries({ queryKey: ["funil-cards", id] });
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

  const createPastaMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await (supabase as any).from("funil_pastas").insert({ nome, ordem: pastas.length, empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-pastas"] }); toast.success("Pasta criada"); },
    onError: (err: any) => toast.error("Erro ao criar pasta: " + err.message),
  });

  const renamePastaMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await (supabase as any).from("funil_pastas").update({ nome: nome.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-pastas"] }); toast.success("Pasta renomeada"); },
    onError: (err: any) => toast.error("Erro ao renomear pasta: " + err.message),
  });

  const reorderPastasMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        (supabase as any).from("funil_pastas").update({ ordem: index }).eq("id", id)
      );
      const results = await Promise.all(updates);
      for (const { error } of results) {
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funil-pastas"] }),
    onError: (err: any) => toast.error("Erro ao reordenar pastas: " + err.message),
  });

  const updateQuadroOrganizationMutation = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Record<string, unknown> }) => {
      const { error } = await (supabase as any).from("funil_quadros").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funil-quadros"] }),
    onError: (err: any) => toast.error("Erro ao organizar funil: " + err.message),
  });

  const activateQuadroMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("ativar_funil_recebedor", { p_quadro_id: id });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-quadros"] }); toast.success("Esta turma agora recebe os novos leads"); },
    onError: (err: any) => toast.error("Não foi possível ativar a turma: " + err.message),
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

      // Block if there are active cards in this quadro
      const { count: cardCount } = await (supabase as any)
        .from("funil_cards")
        .select("id", { count: "exact", head: true })
        .eq("quadro_id", quadro.id)
        .eq("status", "ativo");
      if ((cardCount ?? 0) > 0) throw new Error(`Mova os ${cardCount} lead(s) deste quadro antes de excluí-lo.`);

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

  // ── Mutations: leads / funil_cards ──
  const insertMutation = useMutation({
    mutationFn: async (data: LeadForm) => {
      if (!data.etapa_id) throw new Error("Selecione uma coluna no funil antes de cadastrar.");
      const { data: newLead, error } = await supabase.from("leads").insert({
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
      } as any).select("id").single();
      if (error) throw error;
      const { error: cardErr } = await (supabase as any).from("funil_cards").insert({
        lead_id: newLead.id,
        quadro_id: selectedQuadroId,
        etapa_id: data.etapa_id,
        empresa_id: empresaId,
      });
      if (cardErr) throw cardErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funil-cards", selectedQuadroId] });
      toast.success("Lead cadastrado");
      setDialogOpen(false);
      setForm(emptyLeadForm);
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const moveEtapaMutation = useMutation({
    mutationFn: async ({ id, fromEtapaId, toEtapaId, leadId }: { id: string; fromEtapaId: string; toEtapaId: string; leadId: string }) => {
      // id = funil_card_id
      const { error } = await (supabase as any).from("funil_cards").update({ etapa_id: toEtapaId }).eq("id", id);
      if (error) throw error;
      await logActivity({
        tipo: "avanco_etapa",
        descricao: `Lead movido de ${etapasMap.get(fromEtapaId)?.nome || fromEtapaId} para ${etapasMap.get(toEtapaId)?.nome || toEtapaId}`,
        lead_id: leadId,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-cards", selectedQuadroId] }); toast.success("Lead movido"); },
    onError: (err: Error) => toast.error("Erro ao mover: " + err.message),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (funil_card_id: string) => {
      // Remove the card from this funnel
      const { error } = await (supabase as any).from("funil_cards").delete().eq("id", funil_card_id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funil-cards", selectedQuadroId] }); toast.success("Lead removido do funil"); },
    onError: (err: Error) => toast.error("Erro ao excluir: " + err.message),
  });

  // ── Mutations: etapas (colunas) ──
  const insertEtapaMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string; meta_valor: number | null; quadro_id: string }) => {
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
    mutationFn: async ({ id, data }: { id: string; data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string; meta_valor: number | null } }) => {
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
      const emUso = cards.filter((c) => c.etapa_id === etapa.id).length;
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

  const handleSaveEtapa = async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string; meta_valor: number | null }) => {
    if (editEtapa) await updateEtapaMutation.mutateAsync({ id: editEtapa.id, data });
    else await insertEtapaMutation.mutateAsync({ ...data, quadro_id: selectedQuadroId! });
  };

  const handleDeleteEtapa = (etapa: FunilEtapa) => {
    if (etapas.length <= 1) { toast.error("O funil precisa de ao menos uma coluna."); return; }
    deleteEtapaMutation.mutate(etapa);
  };

  const handleBotToggleAll = async (etapaId: string, ativar: boolean) => {
    const leadIds = cards
      .filter((c) => c.etapa_id === etapaId)
      .map((c) => c.id);
    if (!leadIds.length) return;
    const { error } = await supabase
      .from("leads")
      .update({ bot_ativo: ativar } as any)
      .in("id", leadIds);
    if (error) { toast.error("Erro ao atualizar bot"); return; }
    queryClient.invalidateQueries({ queryKey: ["funil-cards", selectedQuadroId] });
    toast.success(ativar ? `Bot ativado para ${leadIds.length} lead${leadIds.length !== 1 ? "s" : ""}` : `Bot desativado para ${leadIds.length} lead${leadIds.length !== 1 ? "s" : ""}`);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.funil_card_id === event.active.id) ?? null;
    setActiveLead(card);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;
    const cardId = active.id as string; // funil_card_id
    const targetEtapaId = over.id as string;
    const card = cards.find((c) => c.funil_card_id === cardId);
    if (!card || card.etapa_id === targetEtapaId) return;
    moveEtapaMutation.mutate({ id: cardId, fromEtapaId: card.etapa_id, toEtapaId: targetEtapaId, leadId: card.id });
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
          queryClient.invalidateQueries({ queryKey: ["funil-cards", selectedQuadroId] });
          if (selectedLead) queryClient.invalidateQueries({ queryKey: ["atividades", undefined, selectedLead.id] });
        }}
      />

      <section className="rounded-xl border bg-card overflow-hidden">
        <header className="px-4 pt-3 border-b">
          <h1 className="text-xl font-semibold tracking-tight">CRM comercial</h1>
          <p className="sr-only">Atendimento, oportunidades e supervisão da IA</p>
          <nav aria-label="Áreas do CRM" className="flex gap-6 mt-2">
            {([ ["conversas", "Conversas"], ["oportunidades", "Oportunidades"], ["agentes", "Agentes"] ] as const).map(([view, label]) => (
              <button key={view} type="button" aria-current={crmView === view ? "page" : undefined} onClick={() => setCrmView(view)} className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", crmView === view ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </nav>
        </header>
      <div className="flex overflow-hidden bg-card" style={crmView === "conversas" ? undefined : { height: 'calc(100dvh - 9rem)', minHeight: '500px' }}>
        {/* Sidebar — lista de quadros */}
        {crmView === "oportunidades" && (
        <div className={cn("shrink-0 flex relative transition-all duration-200", quadrosVisible ? "w-[320px]" : "w-0")}>
          {/* Toggle handle — always visible on the right edge */}
          <button
            onClick={() => setQuadrosVisible((v) => !v)}
            title={quadrosVisible ? "Retrair quadros" : "Expandir quadros"}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center",
              "h-12 w-4 rounded-r-md border border-l-0 bg-card hover:bg-muted transition-colors shadow-sm",
              quadrosVisible ? "right-[-16px]" : "right-[-16px]"
            )}
          >
            {quadrosVisible
              ? <PanelLeftClose className="h-3 w-3 text-muted-foreground" />
              : <PanelLeftOpen className="h-3 w-3 text-muted-foreground" />}
          </button>

          {quadrosVisible && (
          <FunilSidebar
            folders={pastas}
            funnels={quadros}
            selectedId={selectedQuadroId}
            loading={quadrosLoading || pastasLoading}
            onSelect={setSelectedQuadroId}
            onCreateFolder={(name) => createPastaMutation.mutate(name)}
            onCreateFunnel={(name, folderId) => createQuadroMutation.mutate({ nome: name, pastaId: folderId })}
            onToggleFavorite={(funnel) => updateQuadroOrganizationMutation.mutate({ id: funnel.id, changes: { favorito: !funnel.favorito } })}
            onActivate={(funnel) => activateQuadroMutation.mutate(funnel.id)}
            onMove={(funnel, folderId) => updateQuadroOrganizationMutation.mutate({ id: funnel.id, changes: { pasta_id: folderId, recebe_novos_leads: false, status_ciclo: funnel.recebe_novos_leads ? "encerrando" : funnel.status_ciclo } })}
            onRename={(funnel, name) => renameQuadroMutation.mutate({ id: funnel.id, nome: name })}
            onRenameFolder={(folder, name) => renamePastaMutation.mutate({ id: folder.id, nome: name })}
            onReorderFolders={(ids) => reorderPastasMutation.mutate(ids)}
            onDelete={(funnel) => deleteQuadroMutation.mutate(funnel)}
            createOptions={(
              <div className="space-y-2">
                <button type="button" onClick={() => setImportOpen((v) => !v)} className="flex w-full items-center gap-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
                  {importOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <Users className="h-3.5 w-3.5" /> Importar contatos do evento/turma
                </button>
                {importOpen && <div className="space-y-2">
                  <div className="flex gap-1">{(["evento", "turma"] as const).map((tipo) => <button key={tipo} type="button" onClick={() => { setImportTipo(tipo); setImportEventoId(""); setImportTurmaId(""); }} className={cn("flex-1 rounded border py-1 text-xs", importTipo === tipo ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{tipo === "evento" ? "Evento" : "Turma"}</button>)}</div>
                  {importTipo === "evento" ? <select value={importEventoId} onChange={(e) => setImportEventoId(e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-xs"><option value="">Selecione o evento...</option>{(eventosImport as { id: string; nome: string }[]).map((ev) => <option key={ev.id} value={ev.id}>{ev.nome}</option>)}</select> : <select value={importTurmaId} onChange={(e) => setImportTurmaId(e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-xs"><option value="">Selecione a turma...</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.produtos?.nome ? `${t.produtos.nome} · ${t.nome}` : t.nome}</option>)}</select>}
                  {((importTipo === "evento" && importEventoId) || (importTipo === "turma" && importTurmaId)) && <p className="text-[11px] text-muted-foreground">{previewFetching ? "Contando..." : previewCount != null ? `${previewCount} contato${previewCount !== 1 ? "s" : ""} encontrado${previewCount !== 1 ? "s" : ""}` : ""}</p>}
                </div>}
              </div>
            )}
          />
          )}
        </div>
        )}

        {/* Área principal */}
        <main className={cn("flex-1 min-w-0 flex flex-col bg-background", crmView !== "conversas" && "overflow-auto")}>
          {crmView === "agentes" ? <div className="p-5">{canAccess("configuracoes") ? <AgentesBotSection /> : <p className="text-sm text-muted-foreground">Você precisa de acesso às configurações para gerenciar os agentes.</p>}</div> : (
          <div className={crmView === "conversas" ? "flex flex-col flex-1 min-h-0" : "p-6 space-y-6 min-h-full"}>
            {crmView === "conversas" ? (
              <div className="flex gap-2 items-center px-4 py-2 border-b flex-wrap bg-card">
                <span className="text-xs font-medium text-muted-foreground mr-2">Canal de entrada</span>
                {quadros.filter(q => q.fixo || q.canal).map(q => {
                  const selected = q.id === selectedQuadroId;
                  const instagram = q.canal === "instagram";
                  const whatsapp = q.canal === "whatsapp";
                  return (
                    <button key={q.id} type="button" aria-pressed={selected} onClick={() => setSelectedQuadroId(q.id)} className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      instagram ? "text-pink-700 dark:text-pink-300" : whatsapp ? "text-green-700 dark:text-green-300" : "text-muted-foreground",
                      selected
                        ? instagram ? "border-pink-300 bg-pink-50 dark:border-pink-700 dark:bg-pink-950/40" : whatsapp ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/40" : "border-primary/30 bg-primary/10"
                        : instagram ? "border-transparent hover:bg-pink-50 dark:hover:bg-pink-950/40" : whatsapp ? "border-transparent hover:bg-green-50 dark:hover:bg-green-950/40" : "border-transparent hover:bg-muted"
                    )}>
                      {instagram ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white" aria-hidden="true"><Instagram className="h-4 w-4" /></span>
                      ) : whatsapp ? (
                        <svg viewBox="0 0 24 24" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                          <path d="M21 11.5a9 9 0 0 1-13.3 8L3 21l1.5-4.7A9 9 0 1 1 21 11.5Z" />
                          <path d="m8.2 6.9 1.5 2.9-1.1 1.1c.9 1.9 2.1 3.1 4 4l1.1-1.1 2.9 1.5c-.3 1.6-1.3 2.1-2.5 1.8-4.1-1.1-7.1-4.1-8.2-8.2-.3-1.2.2-2.2 1.8-2.5Z" />
                        </svg>
                      ) : <MessageSquare className="h-5 w-5" aria-hidden="true" />}
                      {instagram ? "Instagram" : whatsapp ? "WhatsApp" : q.nome}
                    </button>
                  );
                })}
              </div>
            ) : (
            <PageHeader
              title={selectedQuadro?.nome || "Funil Comercial"}
              description={isInboxQuadro ? "Mensagens recebidas e conversas ativas" : "Oportunidades e etapas de venda"}
            >
              {selectedQuadroId && !isInboxQuadro && (
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
            )}

            {!selectedQuadroId ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <LayoutDashboard className="h-12 w-12 opacity-20" />
                <p className="text-sm">Selecione ou crie um quadro de funil na barra lateral.</p>
              </div>
            ) : isInboxQuadro ? (
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
                              onDeleteLead={(lead) => deleteLeadMutation.mutate((lead as any).funil_card_id ?? lead.id)}
                              onEditEtapa={(e) => { setEditEtapa(e); setEtapaDialogOpen(true); }}
                              onDeleteEtapa={handleDeleteEtapa}
                              onMoveEtapa={handleMoveEtapa}
                              canMoveLeft={idx > 0}
                              canMoveRight={idx < etapasOrdenadas.length - 1}
                              onBotToggleAll={handleBotToggleAll}
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
          )}
        </main>
      </div>
      </section>
    </>
  );
};

export default Funil;
