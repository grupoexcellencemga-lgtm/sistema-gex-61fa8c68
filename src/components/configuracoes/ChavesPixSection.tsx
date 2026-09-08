import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

type ChavePix = {
  id: string;
  descricao: string;
  chave: string;
  ativo: boolean;
};

const emptyForm = { descricao: "", chave: "", ativo: true };

export function ChavesPixSection() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: chaves = [], isLoading } = useQuery({
    queryKey: ["chaves_pix", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chaves_pix")
        .select("id, descricao, chave, ativo")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("descricao");
      if (error) throw error;
      return data as ChavePix[];
    },
    enabled: !!empresaId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.descricao.trim() || !form.chave.trim()) throw new Error("Preencha descrição e chave.");
      if (editingId) {
        const { error } = await (supabase as any)
          .from("chaves_pix")
          .update({ descricao: form.descricao.trim(), chave: form.chave.trim(), ativo: form.ativo })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("chaves_pix")
          .insert({ descricao: form.descricao.trim(), chave: form.chave.trim(), ativo: form.ativo, empresa_id: empresaId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chaves_pix", empresaId] });
      toast.success(editingId ? "Chave PIX atualizada." : "Chave PIX cadastrada.");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("chaves_pix")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chaves_pix", empresaId] });
      toast.success("Chave PIX removida.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: ChavePix) => {
    setEditingId(c.id);
    setForm({ descricao: c.descricao, chave: c.chave, ativo: c.ativo });
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Chaves PIX
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie as chaves PIX que aparecem nos links de inscrição de turmas e eventos.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nova chave
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : chaves.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma chave PIX cadastrada. Clique em "Nova chave" para adicionar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chaves.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{c.chave}</TableCell>
                    <TableCell>
                      <Badge variant={c.ativo ? "default" : "secondary"}>
                        {c.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => deleteMutation.mutate(c.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Chave PIX" : "Nova Chave PIX"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: PIX Principal, PIX ASAAS..."
                value={form.descricao}
                onChange={(e) => setForm(p => ({ ...p, descricao: e.target.value }))}
              />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input
                placeholder="CNPJ, CPF, e-mail, telefone ou chave aleatória"
                value={form.chave}
                onChange={(e) => setForm(p => ({ ...p, chave: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm(p => ({ ...p, ativo: v }))}
                id="ativo"
              />
              <Label htmlFor="ativo">Ativa</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.descricao.trim() || !form.chave.trim()}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
