import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DivulgacaoColumn } from "@/components/divulgacao/DivulgacaoColumn";
import { DivulgacaoFilters } from "@/components/divulgacao/DivulgacaoFilters";
import { DivulgacaoFormDialog } from "@/components/divulgacao/DivulgacaoFormDialog";
import type { Divulgacao } from "@/components/divulgacao/DivulgacaoCard";

const COLUMNS = [
  { key: "Em breve", label: "Em breve", icon: "🕐", color: "text-yellow-500" },
  { key: "Em andamento", label: "Em andamento", icon: "🚀", color: "text-blue-500" },
  { key: "Concluído", label: "Concluído", icon: "✅", color: "text-green-500" },
];

const DivulgacaoPage = () => {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Divulgacao | null>(null);
  const [defaultStatus, setDefaultStatus] = useState("Em breve");

  // Filters
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");

  // Fetch
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["divulgacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divulgacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Divulgacao[];
    },
  });

  // Unique responsaveis for filter
  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => { if (i.responsavel_iniciais) set.add(i.responsavel_iniciais); });
    return Array.from(set).sort();
  }, [items]);

  // Filter logic
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search && !item.titulo.toLowerCase().includes(search.toLowerCase()) &&
        !(item.descricao ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategoria !== "todos" && item.categoria !== filterCategoria) return false;
      if (filterResponsavel !== "todos" && item.responsavel_iniciais !== filterResponsavel) return false;
      return true;
    });
  }, [items, search, filterCategoria, filterResponsavel]);

  // Insert mutation
  const insertMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("divulgacoes").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success("Divulgação criada com sucesso!");
    },
    onError: () => toast.error("Erro ao criar divulgação"),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("divulgacoes").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success("Divulgação atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar divulgação"),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("divulgacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["divulgacoes"] });
      toast.success("Divulgação removida");
    },
    onError: () => toast.error("Erro ao remover divulgação"),
  });

  const handleSave = async (formData: any) => {
    const payload = {
      titulo: formData.titulo,
      descricao: formData.descricao || null,
      categoria: formData.categoria,
      status: formData.status,
      imagem_url: formData.imagem_url || null,
      responsavel_iniciais: formData.responsavel_iniciais || null,
      data: formData.data || null,
    };
    if (editItem) {
      await updateMutation.mutateAsync({ id: editItem.id, data: payload });
    } else {
      await insertMutation.mutateAsync(payload);
    }
  };

  const handleEdit = (d: Divulgacao) => {
    setEditItem(d);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Deseja remover esta divulgação?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = (status: string) => {
    setEditItem(null);
    setDefaultStatus(status);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditItem(null);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Divulgação"
        description="Gerencie comunicados, campanhas, eventos e treinamentos"
      >
        <Button size="sm" onClick={() => handleAdd("Em breve")} className="gap-1">
          <Plus className="h-4 w-4" />
          Novo card
        </Button>
      </PageHeader>

      {/* Filters */}
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

      {/* Kanban Board */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : (
          <div className="flex gap-4 h-full min-h-[400px] snap-x snap-mandatory md:snap-none overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <DivulgacaoColumn
                key={col.key}
                column={col}
                items={filtered.filter((i) => i.status === col.key)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <DivulgacaoFormDialog
        open={formOpen}
        onClose={handleCloseForm}
        onSave={handleSave}
        initialData={editItem}
        defaultStatus={defaultStatus}
      />
    </div>
  );
};

export default DivulgacaoPage;
