import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

type Artigo = {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  agente_id: string | null;
  created_at: string;
};

const CATEGORIAS = [
  { value: "faq", label: "FAQ" },
  { value: "objecao", label: "Objeção" },
  { value: "metodologia", label: "Metodologia" },
  { value: "diferencial", label: "Diferencial" },
  { value: "script", label: "Script" },
  { value: "outro", label: "Outro" },
] as const;

const CATEGORIA_COLORS: Record<string, string> = {
  faq: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  objecao: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  metodologia: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  diferencial: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",
  script: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  outro: "bg-muted text-muted-foreground",
};

const FORM_DEFAULT = { titulo: "", conteudo: "", categoria: "faq" };

type Props = {
  open: boolean;
  onClose: () => void;
  agenteId: string;
  agenteNome: string;
};

export function BaseConhecimentoDialog({ open, onClose, agenteId, agenteNome }: Props) {
  const { empresaId } = useEmpresa();
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: artigos = [], isLoading } = useQuery<Artigo[]>({
    queryKey: ["base_conhecimento", agenteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("base_conhecimento")
        .select("id, titulo, conteudo, categoria, agente_id, created_at")
        .eq("empresa_id", empresaId!)
        .eq("agente_id", agenteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!empresaId,
  });

  const indexar = async (id: string, conteudo: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/indexar-conhecimento`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ id, conteudo }),
        }
      );
    } catch (err) {
      console.error("Erro ao indexar embedding:", err);
    }
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim() || !form.conteudo.trim()) throw new Error("Preencha título e conteúdo.");
      if (editId) {
        const { error } = await supabase
          .from("base_conhecimento")
          .update({ titulo: form.titulo, conteudo: form.conteudo, categoria: form.categoria, updated_at: new Date().toISOString() })
          .eq("id", editId);
        if (error) throw error;
        await indexar(editId, form.conteudo);
        return editId;
      } else {
        const { data, error } = await supabase
          .from("base_conhecimento")
          .insert({ empresa_id: empresaId, agente_id: agenteId, titulo: form.titulo, conteudo: form.conteudo, categoria: form.categoria })
          .select("id")
          .single();
        if (error) throw error;
        await indexar(data.id, form.conteudo);
        return data.id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["base_conhecimento", agenteId] });
      toast.success(editId ? "Artigo atualizado e indexado." : "Artigo criado e indexado.");
      setFormOpen(false);
      setEditId(null);
      setForm(FORM_DEFAULT);
    },
    onError: (err: any) => toast.error(err.message ?? "Erro ao salvar."),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("base_conhecimento")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["base_conhecimento", agenteId] });
      toast.success("Artigo removido.");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover artigo."),
  });

  const openNew = () => {
    setEditId(null);
    setForm(FORM_DEFAULT);
    setFormOpen(true);
  };

  const openEdit = (a: Artigo) => {
    setEditId(a.id);
    setForm({ titulo: a.titulo, conteudo: a.conteudo, categoria: a.categoria });
    setFormOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Base de Conhecimento — {agenteNome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo artigo
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando...
              </div>
            )}
            {!isLoading && artigos.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhum artigo cadastrado. Clique em "Novo artigo" para começar.
              </div>
            )}
            {artigos.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-medium text-sm">{a.titulo}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORIA_COLORS[a.categoria] ?? CATEGORIA_COLORS.outro}`}>
                      {CATEGORIAS.find(c => c.value === a.categoria)?.label ?? a.categoria}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.conteudo}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de formulário */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) { setFormOpen(false); setEditId(null); setForm(FORM_DEFAULT); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Como lidar com a objeção de preço"
                value={form.titulo}
                onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Textarea
                placeholder="Descreva o conhecimento que o bot deve usar ao responder sobre este tema..."
                className="min-h-[140px] resize-y"
                value={form.conteudo}
                onChange={(e) => setForm(f => ({ ...f, conteudo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditId(null); setForm(FORM_DEFAULT); }}>
              Cancelar
            </Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editId ? "Salvar alterações" : "Criar e indexar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover artigo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">O artigo será removido da base de conhecimento e deixará de ser utilizado pelo bot.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && excluir.mutate(deleteId)}
              disabled={excluir.isPending}
            >
              {excluir.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
