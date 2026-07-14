import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, X, MessageCircle, Users, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";

// Remove acentos para busca tolerante ("joao" acha "João").
const normalizar = (v?: string | null) =>
  (v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const whatsappLink = (phone?: string | null) => {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (!clean) return null;
  return `https://wa.me/55${clean}`;
};

export function TurmaAlunosTab({ turma }: { turma: any }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [buscaDialog, setBuscaDialog] = useState("");
  const [alunoSelecionado, setAlunoSelecionado] = useState<any>(null);

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["alunos-turma-tab", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("aluno_id, alunos(id, nome, email, telefone)")
        .eq("turma_id", turma.id)
        .is("deleted_at", null);
      if (error) throw error;

      const mapa = new Map<string, any>();
      (data || []).forEach((m: any) => {
        const a = m.alunos;
        if (a?.id && !mapa.has(a.id)) mapa.set(a.id, a);
      });
      return Array.from(mapa.values()).sort((a: any, b: any) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
      );
    },
  });

  // Todos os alunos cadastrados (para o dialog de busca)
  const { data: todosAlunos = [] } = useQuery({
    queryKey: ["alunos-lista-basica"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, email, telefone")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: dialogOpen,
  });

  const alunosJaMatriculados = useMemo(
    () => new Set(alunos.map((a: any) => a.id)),
    [alunos],
  );

  const alunosDisponiveis = useMemo(() => {
    const termo = normalizar(buscaDialog);
    const digitos = buscaDialog.replace(/\D/g, "");
    return todosAlunos.filter((a: any) => {
      if (alunosJaMatriculados.has(a.id)) return false;
      if (!termo && !digitos) return true;
      const nomeOk = termo && normalizar(a.nome).includes(termo);
      const emailOk = termo && normalizar(a.email).includes(termo);
      const telOk = digitos.length > 0 && (a.telefone || "").replace(/\D/g, "").includes(digitos);
      return nomeOk || emailOk || telOk;
    });
  }, [todosAlunos, alunosJaMatriculados, buscaDialog]);

  const adicionarMutation = useMutation({
    mutationFn: async (alunoId: string) => {
      const { error } = await supabase.from("matriculas").insert({
        aluno_id: alunoId,
        turma_id: turma.id,
        produto_id: turma.produto_id || null,
        status: "ativo",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos-turma-tab", turma.id] });
      toast.success("Aluno adicionado à turma");
      setDialogOpen(false);
      setAlunoSelecionado(null);
      setBuscaDialog("");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    const digitos = busca.replace(/\D/g, "");
    if (!termo && !digitos) return alunos;
    return alunos.filter((a: any) => {
      const nomeOk = termo && normalizar(a.nome).includes(termo);
      const emailOk = termo && normalizar(a.email).includes(termo);
      const telOk =
        digitos.length > 0 && (a.telefone || "").replace(/\D/g, "").includes(digitos);
      return nomeOk || emailOk || telOk;
    });
  }, [alunos, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">
            {isLoading
              ? "Carregando alunos..."
              : busca && filtrados.length !== alunos.length
                ? `${filtrados.length} de ${alunos.length} aluno(s) na turma`
                : `${alunos.length} aluno(s) na turma`}
          </span>
        </div>
        <Button size="sm" onClick={() => { setAlunoSelecionado(null); setBuscaDialog(""); setDialogOpen(true); }}>
          <UserPlus className="h-4 w-4 mr-1" /> Adicionar aluno
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setAlunoSelecionado(null); setBuscaDialog(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar aluno à turma</DialogTitle>
            <DialogDescription>Busque e selecione um aluno já cadastrado no sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Command className="border rounded-md" shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={buscaDialog}
                onValueChange={setBuscaDialog}
              />
              <CommandList className="max-h-60">
                <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                <CommandGroup>
                  {alunosDisponiveis.slice(0, 50).map((a: any) => (
                    <CommandItem
                      key={a.id}
                      value={a.id}
                      onSelect={() => setAlunoSelecionado(a)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {alunoSelecionado?.id === a.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                        {alunoSelecionado?.id !== a.id && <div className="w-4 shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{a.nome}</p>
                          {a.email && <p className="text-xs text-muted-foreground truncate">{a.email}</p>}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {alunoSelecionado && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                Selecionado: <span className="font-semibold">{alunoSelecionado.nome}</span>
              </div>
            )}
            <Button
              className="w-full"
              disabled={!alunoSelecionado || adicionarMutation.isPending}
              onClick={() => alunoSelecionado && adicionarMutation.mutate(alunoSelecionado.id)}
            >
              {adicionarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar adição
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="h-9 pl-8 pr-8"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-16 text-center">WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((a: any) => {
                  const wa = whatsappLink(a.telefone);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{a.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.email || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.telefone || "—"}</TableCell>
                      <TableCell className="text-center">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex">
                            <MessageCircle className="h-4 w-4 text-emerald-600 hover:text-emerald-700" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {alunos.length === 0
                        ? "Nenhum aluno matriculado nesta turma."
                        : "Nenhum aluno encontrado com essa busca."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
