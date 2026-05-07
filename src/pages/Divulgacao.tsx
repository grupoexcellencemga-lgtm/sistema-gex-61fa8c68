import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Brain,
  Check,
  Edit2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { LayoutGroup } from "framer-motion";
import { DivulgacaoColumn } from "@/components/divulgacao/DivulgacaoColumn";
import { DivulgacaoFilters } from "@/components/divulgacao/DivulgacaoFilters";
import { DivulgacaoFormDialog } from "@/components/divulgacao/DivulgacaoFormDialog";
import { DivulgacaoFileViewer } from "@/components/divulgacao/DivulgacaoFileViewer";
import { DivulgacaoColunaDialog } from "@/components/divulgacao/DivulgacaoColunaDialog";
import type { Divulgacao } from "@/components/divulgacao/DivulgacaoCard";
import type { DivulgacaoColuna } from "@/components/divulgacao/DivulgacaoColunaDialog";

type DivulgacaoQuadro = {
  id: string;
  nome: string;
  ordem: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const COLUNAS_PADRAO = [
  { nome: "Ideias", cor: "slate", icone: "💡" },
  { nome: "Em produção", cor: "orange", icone: "🎨" },
  { nome: "Agendado", cor: "blue", icone: "📅" },
  { nome: "Publicado", cor: "green", icone: "✅" },
];

const DivulgacaoPage = () => {
  const queryClient = useQueryClient();

  const [selectedQuadroId, setSelectedQuadroId] = useState<string | null>(null);
  const [newQuadroName, setNewQuadroName] = useState("");
  const [editingQuadroId, setEditingQuadroId] = useState<string | null>(null);
  const [editingQuadroName, setEditingQuadroName] = useState("");
  const [quadroDialogOpen, setQuadroDialogOpen] = useState(false);
  const [quadrosVisible, setQuadrosVisible] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Divulgacao | null>(null);
  const [defaultColunaId, setDefaultColunaId] = useState<string>("");

  const [viewerItem, setViewerItem] = useState<Divulgacao | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const [colunaDialogOpen, setColunaDialogOpen] = useState(false);
  const [editColuna, setEditColuna] = useState<DivulgacaoColuna | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingColunaId, setDraggingColunaId] = useState<string | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);

  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");

  const { data: quadros = [], isLoading: quadrosLoading } = useQuery<DivulgacaoQuadro[]>({
    queryKey: ["divulgacao-quadros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divulgacao_quadros")
        .select("*")
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DivulgacaoQuadro[];
    },
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

  useEffect(() => {
    const channel = supabase
      .channel("divulgacao-realtime-global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "divulgacao_quadros" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["divulgacao-quadros"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "divulgacao_colunas" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "divulgacoes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: colunas = [] } = useQuery<DivulgacaoColuna[]>({
    queryKey: ["divulgacao-colunas", selectedQuadroId],
    queryFn: async () => {
      if (!selectedQuadroId) return [];

      const { data, error } = await supabase
        .from("divulgacao_colunas")
        .select("*")
        .eq("quadro_id", selectedQuadroId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DivulgacaoColuna[];
    },
    enabled: !!selectedQuadroId,
  });

  const { data: items = [], isLoading } = useQuery<Divulgacao[]>({
    queryKey: ["divulgacoes", selectedQuadroId],
    queryFn: async () => {
      if (!selectedQuadroId) return [];

      const { data, error } = await supabase
        .from("divulgacoes")
        .select("*")
        .eq("quadro_id", selectedQuadroId)
        .order("coluna_id", { ascending: true, nullsFirst: false })
        .order("ordem", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Divulgacao[];
    },
    enabled: !!selectedQuadroId,
  });

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.responsavel_iniciais) set.add(i.responsavel_iniciais);
    });
    return Array.from(set).sort();
  }, [items]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const colunaA = a.coluna_id || "";
      const colunaB = b.coluna_id || "";

      if (colunaA !== colunaB) return colunaA.localeCompare(colunaB);

      const ordemA = Number(a.ordem ?? 999999);
      const ordemB = Number(b.ordem ?? 999999);

      if (ordemA !== ordemB) return ordemA - ordemB;

      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
  }, [items]);

  const filtered = useMemo(() => {
    return sortedItems.filter((item) => {
      if (
        search &&
        !item.titulo.toLowerCase().includes(search.toLowerCase()) &&
        !(item.descricao ?? "").toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      if (filterCategoria !== "todos" && item.categoria !== filterCategoria) return false;

      if (filterResponsavel !== "todos" && item.responsavel_iniciais !== filterResponsavel) {
        return false;
      }

      return true;
    });
  }, [sortedItems, search, filterCategoria, filterResponsavel]);

  const boardWidth = Math.max(colunas.length * 336, 1);

  const syncScroll = (from: "top" | "board") => {
    if (syncingScrollRef.current) return;

    const top = topScrollRef.current;
    const board = boardScrollRef.current;
    if (!top || !board) return;

    syncingScrollRef.current = true;

    if (from === "top") {
      board.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = board.scrollLeft;
    }

    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const createQuadroMutation = useMutation({
    mutationFn: async (name: string) => {
      const nome = name.trim() || "Novo quadro";
      const ordem = quadros.length;

      const { data: quadro, error } = await supabase
        .from("divulgacao_quadros")
        .insert([{ nome, ordem }])
        .select("id")
        .single();

      if (error) throw error;

      const colunasPadrao = COLUNAS_PADRAO.map((coluna, index) => ({
        ...coluna,
        quadro_id: quadro.id,
        ordem: index,
      }));

      const { error: colunasError } = await supabase
        .from("divulgacao_colunas")
        .insert(colunasPadrao);

      if (colunasError) throw colunasError;

      return quadro;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-quadros"] });
      queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
      setSelectedQuadroId(data.id);
      setNewQuadroName("");
      setQuadroDialogOpen(false);
      toast.success("Quadro criado!");
    },
    onError: (err: any) => toast.error("Erro ao criar quadro: " + (err?.message ?? err)),
  });

  const renameQuadroMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase
        .from("divulgacao_quadros")
        .update({ nome: nome.trim() || "Quadro sem nome", updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-quadros"] });
      setEditingQuadroId(null);
      setEditingQuadroName("");
      toast.success("Quadro renomeado!");
    },
    onError: (err: any) => toast.error("Erro ao renomear quadro: " + (err?.message ?? err)),
  });

  const deleteQuadroMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("divulgacao_quadros")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-quadros"] });
      queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });

      if (selectedQuadroId === id) {
        const nextQuadro = quadros.find((q) => q.id !== id);
        setSelectedQuadroId(nextQuadro?.id ?? null);
      }

      toast.success("Quadro removido!");
    },
    onError: (err: any) => toast.error("Erro ao remover quadro: " + (err?.message ?? err)),
  });

  const insertMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("divulgacoes").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success("Card criado!");
    },
    onError: (err: any) => toast.error("Erro ao criar card: " + (err?.message ?? err)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("divulgacoes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success("Card atualizado!");
    },
    onError: (err: any) => toast.error("Erro ao atualizar card: " + (err?.message ?? err)),
  });

  const reorderCardsMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; coluna_id: string | null; status: string; ordem: number }>) => {
      const results = await Promise.all(
        updates.map((update) =>
          supabase
            .from("divulgacoes")
            .update({
              coluna_id: update.coluna_id,
              status: update.status,
              ordem: update.ordem,
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", update.id)
        )
      );

      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
    },
    onError: (err: any) => toast.error("Erro ao reordenar cards: " + (err?.message ?? err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("divulgacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success("Card removido");
    },
    onError: (err: any) => toast.error("Erro ao remover card: " + (err?.message ?? err)),
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("divulgacoes")
        .update({ ativo, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success(ativo ? "Card ativado!" : "Card desativado!");
    },
    onError: (err: any) => toast.error("Erro ao alterar status do card: " + (err?.message ?? err)),
  });

  const insertColunaMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string; icone: string }) => {
      if (!selectedQuadroId) throw new Error("Selecione um quadro primeiro.");

      const ordem = colunas.length;
      const { error } = await supabase
        .from("divulgacao_colunas")
        .insert([{ ...data, ordem, quadro_id: selectedQuadroId }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
      toast.success("Coluna criada!");
    },
    onError: (err: any) => toast.error("Erro ao criar coluna: " + (err?.message ?? err)),
  });

  const updateColunaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("divulgacao_colunas")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
      toast.success("Coluna atualizada!");
    },
    onError: (err: any) => toast.error("Erro ao atualizar coluna: " + (err?.message ?? err)),
  });

  const reorderColunasMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; ordem: number }>) => {
      const results = await Promise.all(
        updates.map((update) =>
          supabase
            .from("divulgacao_colunas")
            .update({ ordem: update.ordem, updated_at: new Date().toISOString() })
            .eq("id", update.id)
        )
      );

      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
    },
    onError: (err: any) => toast.error("Erro ao mover coluna: " + (err?.message ?? err)),
  });

  const deleteColunaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("divulgacao_colunas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success("Coluna removida");
    },
    onError: (err: any) => toast.error("Erro ao remover coluna: " + (err?.message ?? err)),
  });

  const getFirstOrdem = (colunaId: string) => {
    const cardsDaColuna = sortedItems.filter((i) => i.coluna_id === colunaId);

    if (cardsDaColuna.length === 0) return 0;

    const min = cardsDaColuna.reduce(
      (acc, item) => Math.min(acc, Number(item.ordem ?? 0)),
      Number(cardsDaColuna[0]?.ordem ?? 0)
    );

    return min - 1;
  };

  const handleSave = async (formData: any) => {
    if (!selectedQuadroId) {
      toast.error("Crie ou selecione um quadro primeiro.");
      return;
    }

    const novaColuna = colunas.find((c) => c.id === formData.coluna_id);

    const payload = {
      titulo: formData.titulo,
      descricao: formData.descricao || null,
      categoria: formData.categoria,
      status: novaColuna?.nome ?? "",
      coluna_id: formData.coluna_id || null,
      quadro_id: selectedQuadroId,
      imagem_url: formData.imagem_url || null,
      responsavel_iniciais: formData.responsavel_iniciais || null,
      data: formData.data || null,
      arquivo_url: formData.arquivo_url || null,
      arquivo_tipo: formData.arquivo_tipo || null,
      arquivo_nome: formData.arquivo_nome || null,
      links: formData.links || [],
      updated_at: new Date().toISOString(),
    };

    if (editItem) {
      await updateMutation.mutateAsync({ id: editItem.id, data: payload });
    } else {
      await insertMutation.mutateAsync({
        ...payload,
        ordem: getFirstOrdem(formData.coluna_id),
      });
    }
  };

  const handleEdit = (d: Divulgacao) => {
    setEditItem(d);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Deseja remover este card?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleAtivo = (id: string, ativo: boolean) => {
    toggleAtivoMutation.mutate({ id, ativo });
  };

  const handleAdd = (colunaId: string) => {
    setEditItem(null);
    setDefaultColunaId(colunaId);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditItem(null);
  };

  const handleViewFile = (item: Divulgacao) => {
    setViewerItem(item);
    setViewerOpen(true);
  };

  const handleDropCard = useCallback(
    async (cardId: string, targetColunaId: string, targetIndex = 0) => {
      const card = sortedItems.find((i) => i.id === cardId);
      if (!card) return;

      const targetColuna = colunas.find((c) => c.id === targetColunaId);
      if (!targetColuna) return;

      const sourceColunaId = card.coluna_id || "";
      const targetCards = sortedItems.filter((i) => i.coluna_id === targetColunaId && i.id !== cardId);
      const safeIndex = Math.max(0, Math.min(targetIndex, targetCards.length));

      const reorderedTarget = [
        ...targetCards.slice(0, safeIndex),
        { ...card, coluna_id: targetColunaId, status: targetColuna.nome },
        ...targetCards.slice(safeIndex),
      ];

      const updates: Array<{ id: string; coluna_id: string | null; status: string; ordem: number }> =
        reorderedTarget.map((item, index) => ({
          id: item.id,
          coluna_id: targetColunaId,
          status: targetColuna.nome,
          ordem: index,
        }));

      if (sourceColunaId && sourceColunaId !== targetColunaId) {
        const sourceColuna = colunas.find((c) => c.id === sourceColunaId);
        const sourceCards = sortedItems.filter((i) => i.coluna_id === sourceColunaId && i.id !== cardId);

        sourceCards.forEach((item, index) => {
          updates.push({
            id: item.id,
            coluna_id: sourceColunaId,
            status: sourceColuna?.nome ?? item.status ?? "",
            ordem: index,
          });
        });
      }

      await reorderCardsMutation.mutateAsync(updates);
    },
    [sortedItems, colunas, reorderCardsMutation]
  );

  const handleDropColuna = async (targetColunaId: string) => {
    if (!draggingColunaId || draggingColunaId === targetColunaId) {
      setDraggingColunaId(null);
      return;
    }

    const origemIndex = colunas.findIndex((coluna) => coluna.id === draggingColunaId);
    const destinoIndex = colunas.findIndex((coluna) => coluna.id === targetColunaId);

    if (origemIndex < 0 || destinoIndex < 0) {
      setDraggingColunaId(null);
      return;
    }

    const novasColunas = [...colunas];
    const [colunaMovida] = novasColunas.splice(origemIndex, 1);
    novasColunas.splice(destinoIndex, 0, colunaMovida);

    await reorderColunasMutation.mutateAsync(
      novasColunas.map((coluna, index) => ({
        id: coluna.id,
        ordem: index,
      }))
    );

    setDraggingColunaId(null);
  };

  const handleSaveColuna = async (data: { nome: string; cor: string; icone: string }) => {
    if (editColuna) {
      await updateColunaMutation.mutateAsync({ id: editColuna.id, data });
    } else {
      await insertColunaMutation.mutateAsync(data);
    }
  };

  const handleEditColuna = (coluna: DivulgacaoColuna) => {
    setEditColuna(coluna);
    setColunaDialogOpen(true);
  };

  const handleDeleteColuna = (id: string) => {
    const count = items.filter((i) => i.coluna_id === id).length;
    const msg =
      count > 0
        ? `Esta coluna tem ${count} card(s). Os cards perderão o quadro mas não serão excluídos. Confirmar?`
        : "Deseja excluir esta coluna?";
    if (window.confirm(msg)) {
      deleteColunaMutation.mutate(id);
    }
  };

  const handleDeleteQuadro = (quadro: DivulgacaoQuadro) => {
    const msg =
      "Deseja remover este quadro?\n\nAs colunas e cards dele ficarão ocultos junto com o quadro, mas não serão apagados definitivamente do banco.";

    if (window.confirm(msg)) {
      deleteQuadroMutation.mutate(quadro.id);
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-7rem)] rounded-lg overflow-hidden border bg-card">
      {quadrosVisible && (
      <aside className="w-[280px] shrink-0 border-r bg-card flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold leading-tight">Quadros de Divulgação</h2>
            <p className="text-xs text-muted-foreground">Separe campanhas, perfis e projetos</p>
          </div>
        </div>

        <div className="p-3 border-b">
          <form
            onSubmit={(e) => {
              e.preventDefault();
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
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-1">
          {quadrosLoading ? (
            <p className="text-xs text-muted-foreground text-center p-4">Carregando quadros...</p>
          ) : quadros.length === 0 ? (
            <div className="text-center p-4 space-y-3">
              <Brain className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Crie o primeiro quadro de divulgação.</p>
              <Button size="sm" onClick={() => setQuadroDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Criar quadro
              </Button>
            </div>
          ) : (
            quadros.map((quadro) => (
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
                      renameQuadroMutation.mutate({ id: quadro.id, nome: editingQuadroName });
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
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingQuadroId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate" onClick={() => setSelectedQuadroId(quadro.id)}>
                      {quadro.nome}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => {
                        setEditingQuadroId(quadro.id);
                        setEditingQuadroName(quadro.nome);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => handleDeleteQuadro(quadro)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
      )}

      <main className="flex-1 min-w-0 flex flex-col bg-background">
        <PageHeader
          title={selectedQuadro ? selectedQuadro.nome : "Quadros de Divulgação"}
          description="Gerencie cards, campanhas, conteúdos e materiais por quadro"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuadrosVisible((v) => !v)}
            className="gap-1"
          >
            {quadrosVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            {quadrosVisible ? "Ocultar quadros" : "Mostrar quadros"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditColuna(null);
              setColunaDialogOpen(true);
            }}
            className="gap-1"
            disabled={!selectedQuadroId}
          >
            <Plus className="h-4 w-4" />
            Nova coluna
          </Button>
          <Button
            size="sm"
            onClick={() => handleAdd(colunas[0]?.id ?? "")}
            className="gap-1"
            disabled={!selectedQuadroId || colunas.length === 0}
          >
            <Plus className="h-4 w-4" />
            Novo card
          </Button>
        </PageHeader>

        <div className="px-4 md:px-6 py-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <DivulgacaoFilters
            search={search}
            onSearchChange={setSearch}
            categoria={filterCategoria}
            onCategoriaChange={setFilterCategoria}
            responsavel={filterResponsavel}
            onResponsavelChange={setFilterResponsavel}
            responsaveis={responsaveis}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
          {!selectedQuadroId ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
              <LayoutDashboard className="h-14 w-14 text-muted-foreground/30" />
              <p className="text-sm">Crie ou selecione um quadro de divulgação.</p>
              <Button size="sm" onClick={() => setQuadroDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Criar quadro
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : colunas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <p className="text-sm">Nenhuma coluna criada neste quadro ainda.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditColuna(null);
                  setColunaDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Criar primeira coluna
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                ref={topScrollRef}
                className="w-full overflow-x-auto overflow-y-hidden pb-1"
                onScroll={() => syncScroll("top")}
              >
                <div style={{ width: boardWidth }} className="h-1" />
              </div>

              <div
                ref={boardScrollRef}
                className="w-full overflow-x-auto overflow-y-hidden pb-4"
                onScroll={() => syncScroll("board")}
              >
                <LayoutGroup id={`divulgacao-colunas-${selectedQuadroId}`}>
                  <div className="flex w-max gap-4 min-h-[400px] group">
                    {colunas.map((col) => (
                    <DivulgacaoColumn
                      key={col.id}
                      coluna={col}
                      items={filtered.filter((i) => i.coluna_id === col.id)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onAdd={handleAdd}
                      onViewFile={handleViewFile}
                      onToggleAtivo={handleToggleAtivo}
                      onEditColuna={handleEditColuna}
                      onDeleteColuna={handleDeleteColuna}
                      onDropCard={handleDropCard}
                      draggingId={draggingId}
                      onDragStart={setDraggingId}
                      onDragEnd={() => setDraggingId(null)}
                      draggingColunaId={draggingColunaId}
                      onColumnDragStart={setDraggingColunaId}
                      onColumnDrop={handleDropColuna}
                      onColumnDragEnd={() => setDraggingColunaId(null)}
                    />
                    ))}
                  </div>
                </LayoutGroup>
              </div>
            </div>
          )}
        </div>
      </main>

      <Dialog open={quadroDialogOpen} onOpenChange={(v) => !v && setQuadroDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo quadro de divulgação</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newQuadroName}
              onChange={(e) => setNewQuadroName(e.target.value)}
              placeholder="Ex: Conteúdos Mércia"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuadroDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createQuadroMutation.mutate(newQuadroName)} disabled={createQuadroMutation.isPending}>
              Criar quadro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DivulgacaoFormDialog
        open={formOpen}
        onClose={handleCloseForm}
        onSave={handleSave}
        initialData={editItem}
        defaultColunaId={defaultColunaId}
        colunas={colunas}
      />

      <DivulgacaoFileViewer
        item={viewerItem}
        open={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setViewerItem(null);
        }}
      />

      <DivulgacaoColunaDialog
        open={colunaDialogOpen}
        onClose={() => {
          setColunaDialogOpen(false);
          setEditColuna(null);
        }}
        onSave={handleSaveColuna}
        initialData={editColuna}
      />
    </div>
  );
};

export default DivulgacaoPage;
