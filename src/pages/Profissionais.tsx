import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { validateCPF, maskCPF, formatPhone, maskPhone } from "@/lib/utils";
import { ProfissionalFormDialog, emptyForm, type ProfissionalForm } from "@/components/profissionais/ProfissionalFormDialog";

const TIPO_LABELS: Record<string, string> = { mei: "MEI", clt: "CLT", autonomo: "Autônomo", convidado: "Convidado" };

const Profissionais = () => {
  const queryClient = useQueryClient();
  useRealtimeSync("profissionais", [["profissionais"]]);
  const { isAdmin } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterVinculo, setFilterVinculo] = useState("todos");
  const [form, setForm] = useState<ProfissionalForm>(emptyForm);
  const [cpfError, setCpfError] = useState("");

  const resetForm = () => { setForm(emptyForm); setEditing(null); setCpfError(""); };

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ["profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("*")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editing) {
        const { error } = await supabase.from("profissionais").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profissionais").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profissionais"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editing ? "Profissional atualizado" : "Profissional cadastrado" });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("profissionais_cpf_key")
        ? "CPF já cadastrado para outro profissional"
        : "Erro ao salvar";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profissionais").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profissionais"] });
      toast({ title: "Profissional excluído" });
    },
    onError: () => toast({ title: "Erro ao excluir. Verifique se há processos vinculados.", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.nome.trim()) {
      toast({ title: "Preencha o nome do profissional", variant: "destructive" });
      return;
    }
    if (!form.tipo_vinculo) {
      toast({ title: "Selecione o tipo de vínculo", variant: "destructive" });
      return;
    }
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length > 0 && !validateCPF(cpfDigits)) {
      setCpfError("CPF inválido");
      return;
    }
    setCpfError("");

    saveMutation.mutate({
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      telefone: form.telefone.replace(/\D/g, "") || null,
      especialidade: form.especialidade.trim() || null,
      cpf: cpfDigits || null,
      data_nascimento: form.data_nascimento || null,
      tipo_vinculo: form.tipo_vinculo,
      cnpj: form.tipo_vinculo === "mei" ? (form.cnpj.replace(/\D/g, "") || null) : null,
      chave_pix: form.chave_pix.trim() || null,
      chave_pix_tipo: form.chave_pix_tipo || null,
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      ativo: form.ativo,
    });
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      nome: p.nome,
      email: p.email || "",
      telefone: p.telefone ? maskPhone(p.telefone) : "",
      especialidade: p.especialidade || "",
      cpf: p.cpf ? maskCPF(p.cpf) : "",
      data_nascimento: p.data_nascimento || "",
      tipo_vinculo: p.tipo_vinculo || "autonomo",
      cnpj: p.cnpj || "",
      chave_pix: p.chave_pix || "",
      chave_pix_tipo: p.chave_pix_tipo || "",
      banco: p.banco || "",
      agencia: p.agencia || "",
      conta: p.conta || "",
      ativo: p.ativo,
    });
    setCpfError("");
    setDialogOpen(true);
  };

  const filtered = profissionais.filter((p: any) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.especialidade || "").toLowerCase().includes(search.toLowerCase());
    const matchVinculo = filterVinculo === "todos" || p.tipo_vinculo === filterVinculo;
    return matchSearch && matchVinculo;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profissionais" description="Cadastro de coachs e profissionais para processos individuais" />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar profissional..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterVinculo} onValueChange={setFilterVinculo}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="mei">MEI</SelectItem>
              <SelectItem value="clt">CLT</SelectItem>
              <SelectItem value="autonomo">Autônomo</SelectItem>
              <SelectItem value="convidado">Convidado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Profissional
        </Button>
      </div>

      <ProfissionalFormDialog
        open={dialogOpen}
        onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}
        form={form}
        setForm={setForm}
        onSave={handleSave}
        saving={saveMutation.isPending}
        editing={!!editing}
        isAdmin={isAdmin}
        cpfError={cpfError}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-sm">{p.cpf ? maskCPF(p.cpf) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TIPO_LABELS[p.tipo_vinculo] || p.tipo_vinculo || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{p.especialidade || "—"}</TableCell>
                  <TableCell className="text-sm">{p.telefone ? maskPhone(p.telefone) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.ativo ? "default" : "outline"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                          if (confirm("Excluir este profissional?")) deleteMutation.mutate(p.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum profissional cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profissionais;
