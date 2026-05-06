import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DivulgacaoColumn } from "@/components/divulgacao/DivulgacaoColumn";
import { DivulgacaoFilters } from "@/components/divulgacao/DivulgacaoFilters";
import { DivulgacaoFormDialog } from "@/components/divulgacao/DivulgacaoFormDialog";
import { DivulgacaoFileViewer } from "@/components/divulgacao/DivulgacaoFileViewer";
import { DivulgacaoColunaDialog } from "@/components/divulgacao/DivulgacaoColunaDialog";
import type { Divulgacao } from "@/components/divulgacao/DivulgacaoCard";
import type { DivulgacaoColuna } from "@/components/divulgacao/DivulgacaoColunaDialog";

const DivulgacaoPage = () => {
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Divulgacao | null>(null);
  const [defaultColunaId, setDefaultColunaId] = useState<string>("");

  const [viewerItem, setViewerItem] = useState<Divulgacao | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const [colunaDialogOpen, setColunaDialogOpen] = useState(false);
  const [editColuna, setEditColuna] = useState<DivulgacaoColuna | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");

  const { data: colunas = [] } = useQuery<DivulgacaoColuna[]>({
    queryKey: ["divulgacao-colunas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divulgacao_colunas")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DivulgacaoColuna[];
    },
  });

  const { data: items = [], isLoading } = useQuery<Divulgacao[]>({
    queryKey: ["divulgacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divulgacoes")
        .select("*")
        .order("coluna_id", { ascending: true, nullsFirst: false })
        .order("ordem", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Divulgacao[];
    },
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
        .update({ ativo } as any)
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
      const ordem = colunas.length;
      const { error } = await supabase
        .from("divulgacao_colunas")
        .insert([{ ...data, ordem }]);
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
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacao-colunas"] });
      toast.success("Coluna atualizada!");
    },
    onError: (err: any) => toast.error("Erro ao atualizar coluna: " + (err?.message ?? err)),
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

  const getNextOrdem = (colunaId: string) => {
    const cardsDaColuna = sortedItems.filter((i) => i.coluna_id === colunaId);
    const max = cardsDaColuna.reduce((acc, item) => Math.max(acc, Number(item.ordem ?? 0)), -1);
    return max + 1;
  };

  const handleSave = async (formData: any) => {
    const novaColuna = colunas.find((c) => c.id === formData.coluna_id);

    const payload = {
      titulo: formData.titulo,
      descricao: formData.descricao || null,
      categoria: formData.categoria,
      status: novaColuna?.nome ?? "",
      coluna_id: formData.coluna_id || null,
      imagem_url: formData.imagem_url || null,
      responsavel_iniciais: formData.responsavel_iniciais || null,
      data: formData.data || null,
      arquivo_url: formData.arquivo_url || null,
      arquivo_tipo: formData.arquivo_tipo || null,
      arquivo_nome: formData.arquivo_nome || null,
      links: formData.links || [],
    };

    if (editItem) {
      await updateMutation.mutateAsync({ id: editItem.id, data: payload });
    } else {
      await insertMutation.mutateAsync({
        ...payload,
        ordem: getNextOrdem(formData.coluna_id),
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Divulgação"
        description="Gerencie comunicados, campanhas, eventos e treinamentos"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditColuna(null);
            setColunaDialogOpen(true);
          }}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Nova coluna
        </Button>
        <Button
          size="sm"
          onClick={() => handleAdd(colunas[0]?.id ?? "")}
          className="gap-1"
          disabled={colunas.length === 0}
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

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : colunas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <p className="text-sm">Nenhuma coluna criada ainda.</p>
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
          <div className="flex gap-4 h-full min-h-[400px] snap-x snap-mandatory md:snap-none overflow-x-auto pb-4 group">
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
              />
            ))}
          </div>
        )}
      </div>

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
