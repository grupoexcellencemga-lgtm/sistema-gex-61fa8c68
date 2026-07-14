import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, X, MessageCircle, Users, UserPlus, Check, UserRoundPlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MatriculaFormDialog } from "@/components/alunos/MatriculaFormDialog";
import { emptyMatriculaForm } from "@/components/alunos/alunosUtils";
import { calcTaxaMaquina } from "@/lib/taxaMaquina";
import { logActivity } from "@/components/ActivityTimeline";

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

  // Step 1: busca aluno
  const [buscaDialogOpen, setBuscaDialogOpen] = useState(false);
  const [buscaDialog, setBuscaDialog] = useState("");
  const [alunoSelecionado, setAlunoSelecionado] = useState<any>(null);

  // Criar novo aluno inline
  const [criarAlunoOpen, setCriarAlunoOpen] = useState(false);
  const [novoAlunoForm, setNovoAlunoForm] = useState({ nome: "", email: "", telefone: "" });

  const criarAlunoMutation = useMutation({
    mutationFn: async () => {
      if (!novoAlunoForm.nome.trim()) throw new Error("Nome é obrigatório.");
      const { data, error } = await supabase
        .from("alunos")
        .insert({
          nome: novoAlunoForm.nome.trim(),
          email: novoAlunoForm.email.trim() || null,
          telefone: novoAlunoForm.telefone.trim() || null,
        })
        .select("id, nome, email, telefone")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (aluno) => {
      queryClient.invalidateQueries({ queryKey: ["alunos-lista-basica"] });
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      setAlunoSelecionado(aluno);
      setCriarAlunoOpen(false);
      setNovoAlunoForm({ nome: "", email: "", telefone: "" });
      // Avança direto para o financeiro
      const produto = produtos.find((p: any) => p.id === turma.produto_id);
      setMatriculaForm({
        ...emptyMatriculaForm,
        turma_id: turma.id,
        produto_id: turma.produto_id || "",
        valor_total:
          produto?.valor !== null && produto?.valor !== undefined
            ? String(produto.valor)
            : "",
        data_inicio: turma.data_inicio || "",
        data_fim: turma.data_fim || "",
      });
      setBuscaDialogOpen(false);
      setMatriculaDialogOpen(true);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // Step 2: formulário financeiro
  const [matriculaDialogOpen, setMatriculaDialogOpen] = useState(false);
  const [matriculaForm, setMatriculaForm] = useState(emptyMatriculaForm);

  // ── Alunos na turma ──
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
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
      );
    },
  });

  // ── Alunos disponíveis (só carrega ao abrir o dialog de busca) ──
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
    enabled: buscaDialogOpen,
  });

  // ── Dados para o MatriculaFormDialog (só carrega ao abrir step 2) ──
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, valor")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: matriculaDialogOpen || buscaDialogOpen,
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("id, nome, banco")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: matriculaDialogOpen,
  });

  const { data: comerciais = [] } = useQuery({
    queryKey: ["comerciais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comerciais")
        .select("id, nome")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: matriculaDialogOpen,
  });

  // ── Filtro da lista de busca ──
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

  // ── handleProdutoChange para o MatriculaFormDialog ──
  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos.find((p: any) => p.id === produtoId);
    setMatriculaForm((prev) => ({
      ...prev,
      produto_id: produtoId,
      valor_total:
        produto?.valor !== null && produto?.valor !== undefined
          ? String(produto.valor)
          : prev.valor_total,
    }));
  };

  // ── Avança para o step 2 ao clicar "Próximo" ──
  const avancarParaFinanceiro = () => {
    if (!alunoSelecionado) return;
    const produto = produtos.find((p: any) => p.id === turma.produto_id);
    setMatriculaForm({
      ...emptyMatriculaForm,
      turma_id: turma.id,
      produto_id: turma.produto_id || "",
      valor_total:
        produto?.valor !== null && produto?.valor !== undefined
          ? String(produto.valor)
          : "",
      data_inicio: turma.data_inicio || "",
      data_fim: turma.data_fim || "",
    });
    setBuscaDialogOpen(false);
    setMatriculaDialogOpen(true);
  };

  // ── Mutation de criação da matrícula + pagamentos ──
  const insertMatricula = useMutation({
    mutationFn: async () => {
      if (!alunoSelecionado) throw new Error("Nenhum aluno selecionado.");

      const turmaDados = turma;
      const produtoIdResolvido =
        matriculaForm.produto_id || turmaDados?.produto_id || null;

      const produtoSelecionado = produtos.find(
        (p: any) => p.id === produtoIdResolvido,
      );

      const valorTotal =
        parseFloat(matriculaForm.valor_total) ||
        Number(produtoSelecionado?.valor || 0);

      const desconto = parseFloat(matriculaForm.desconto) || 0;
      const valorFinal = Math.max(valorTotal - desconto, 0);

      const dataInicioResolvida =
        matriculaForm.data_inicio || turmaDados?.data_inicio || null;
      const dataFimResolvida =
        matriculaForm.data_fim || turmaDados?.data_fim || null;
      const dataVencimentoResolvida =
        matriculaForm.data_vencimento ||
        dataInicioResolvida ||
        new Date().toISOString().split("T")[0];

      if (!produtoIdResolvido) {
        throw new Error("Selecione um produto ou uma turma vinculada a um produto.");
      }
      if (valorFinal <= 0) {
        throw new Error("Valor final inválido. Verifique o valor e o desconto.");
      }

      const { data: mat, error: matErr } = await supabase
        .from("matriculas")
        .insert({
          aluno_id: alunoSelecionado.id,
          produto_id: produtoIdResolvido,
          turma_id: turma.id,
          data_inicio: dataInicioResolvida,
          data_fim: dataFimResolvida,
          status: matriculaForm.status,
          observacoes: matriculaForm.observacoes || null,
          valor_total: valorTotal,
          desconto,
          valor_final: valorFinal,
        })
        .select("id")
        .single();

      if (matErr) throw matErr;

      // Upload de comprovantes
      const arquivos = Array.isArray(matriculaForm.comprovantes_files)
        ? matriculaForm.comprovantes_files
        : [];
      const novosComprovantes: Array<{ url: string; nome: string }> = [];
      for (const file of arquivos) {
        const ext = file.name.split(".").pop();
        const filePath = `${alunoSelecionado.id}/${mat.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("comprovantes_matriculas")
          .upload(filePath, file, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("comprovantes_matriculas")
            .getPublicUrl(filePath);
          novosComprovantes.push({ url: urlData.publicUrl, nome: file.name });
        }
      }
      if (novosComprovantes.length > 0) {
        await supabase
          .from("matriculas")
          .update({ comprovantes_urls: novosComprovantes } as any)
          .eq("id", mat.id);
      }

      // Gera pagamentos
      const isCartao = ["credito", "cartao_credito", "cartao"].includes(
        matriculaForm.forma_pagamento,
      );
      const isDebito = matriculaForm.forma_pagamento === "debito";
      const isLink = matriculaForm.forma_pagamento === "link";
      const temTaxaMaquina = isCartao || isDebito || isLink;
      const recebeIntegral = isCartao || isDebito || isLink;
      const numParcelas = recebeIntegral ? 1 : parseInt(matriculaForm.parcelas) || 1;
      const parcelasCliente = parseInt(matriculaForm.parcelas) || 1;
      const taxaCartao = temTaxaMaquina
        ? parseFloat(matriculaForm.taxa_cartao) || 0
        : 0;

      const taxaCalc = calcTaxaMaquina(
        valorFinal,
        temTaxaMaquina ? taxaCartao : 0,
        !!matriculaForm.repassar_taxa,
      );

      const valorBase = matriculaForm.repassar_taxa
        ? taxaCalc.valorCobrado
        : taxaCalc.valorLiquido;

      const valorParcela = valorBase / numParcelas;

      const rows = Array.from({ length: numParcelas }, (_, i) => {
        const d = new Date(dataVencimentoResolvida + "T12:00:00");
        if (!recebeIntegral) d.setMonth(d.getMonth() + i);
        return {
          aluno_id: alunoSelecionado.id,
          produto_id: produtoIdResolvido,
          matricula_id: mat.id,
          valor: Math.round(valorParcela * 100) / 100,
          forma_pagamento: matriculaForm.forma_pagamento || null,
          parcelas: recebeIntegral ? 1 : numParcelas,
          parcela_atual: recebeIntegral ? 1 : i + 1,
          parcelas_cartao: isCartao || isLink ? parcelasCliente : null,
          taxa_cartao: taxaCartao > 0 ? taxaCartao : null,
          data_vencimento: d.toISOString().split("T")[0],
          status: "pendente",
          conta_bancaria_id: matriculaForm.conta_bancaria_id || null,
        };
      });

      const { error: pagErr } = await supabase.from("pagamentos").insert(rows);
      if (pagErr) throw pagErr;

      // Comissão
      if (matriculaForm.comercial_id && valorFinal > 0) {
        const pct = Number(matriculaForm.percentual_comissao) || 5;
        await supabase.from("comissoes").insert({
          matricula_id: mat.id,
          comercial_id: matriculaForm.comercial_id,
          aluno_id: alunoSelecionado.id,
          produto_id: produtoIdResolvido,
          turma_id: turma.id,
          valor_matricula: valorFinal,
          percentual: pct,
          valor_comissao: Math.round(valorFinal * pct) / 100,
          status: "pendente",
        } as any);
        await supabase
          .from("matriculas")
          .update({ comercial_id: matriculaForm.comercial_id } as any)
          .eq("id", mat.id);
      }

      const produtoNome = produtoSelecionado?.nome || "Produto";
      await logActivity({
        tipo: "matricula",
        descricao: `Matrícula criada em ${produtoNome} — ${turma.nome}`,
        aluno_id: alunoSelecionado.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos-turma-tab", turma.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-contas"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-financeiro-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast.success("Matrícula criada com parcelas geradas automaticamente!");
      setMatriculaDialogOpen(false);
      setMatriculaForm(emptyMatriculaForm);
      setAlunoSelecionado(null);
      setBuscaDialog("");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // ── Filtro da tabela de alunos ──
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
        <Button
          size="sm"
          onClick={() => {
            setAlunoSelecionado(null);
            setBuscaDialog("");
            setBuscaDialogOpen(true);
          }}
        >
          <UserPlus className="h-4 w-4 mr-1" /> Adicionar aluno
        </Button>
      </div>

      {/* Step 1: busca do aluno */}
      <Dialog
        open={buscaDialogOpen}
        onOpenChange={(open) => {
          setBuscaDialogOpen(open);
          if (!open) {
            setAlunoSelecionado(null);
            setBuscaDialog("");
            setCriarAlunoOpen(false);
            setNovoAlunoForm({ nome: "", email: "", telefone: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar aluno à turma</DialogTitle>
            <DialogDescription>
              Busque um aluno cadastrado ou crie um novo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!criarAlunoOpen ? (
              <>
                <Command className="border rounded-md" shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar por nome, e-mail ou telefone..."
                    value={buscaDialog}
                    onValueChange={(v) => { setBuscaDialog(v); setAlunoSelecionado(null); }}
                  />
                  <CommandList className="max-h-60">
                    <CommandEmpty>
                      <div className="py-2 text-center text-sm text-muted-foreground">
                        Nenhum aluno encontrado.
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {alunosDisponiveis.slice(0, 50).map((a: any) => (
                        <CommandItem
                          key={a.id}
                          value={a.id}
                          onSelect={() => setAlunoSelecionado(a)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {alunoSelecionado?.id === a.id
                              ? <Check className="h-4 w-4 text-primary shrink-0" />
                              : <div className="w-4 shrink-0" />}
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{a.nome}</p>
                              {a.email && (
                                <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                              )}
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
                  disabled={!alunoSelecionado}
                  onClick={avancarParaFinanceiro}
                >
                  Próximo: Definir pagamento →
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setNovoAlunoForm({ nome: buscaDialog, email: "", telefone: "" });
                    setCriarAlunoOpen(true);
                  }}
                >
                  <UserRoundPlus className="h-4 w-4 mr-2" />
                  Criar novo aluno
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input
                      autoFocus
                      placeholder="Nome completo"
                      value={novoAlunoForm.nome}
                      onChange={(e) => setNovoAlunoForm((f) => ({ ...f, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={novoAlunoForm.email}
                      onChange={(e) => setNovoAlunoForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(44) 99999-9999"
                      value={novoAlunoForm.telefone}
                      onChange={(e) => setNovoAlunoForm((f) => ({ ...f, telefone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setCriarAlunoOpen(false); setNovoAlunoForm({ nome: "", email: "", telefone: "" }); }}
                  >
                    Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!novoAlunoForm.nome.trim() || criarAlunoMutation.isPending}
                    onClick={() => criarAlunoMutation.mutate()}
                  >
                    {criarAlunoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar e continuar →
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: formulário financeiro completo */}
      <MatriculaFormDialog
        open={matriculaDialogOpen}
        onOpenChange={(open) => {
          setMatriculaDialogOpen(open);
          if (!open) {
            setMatriculaForm(emptyMatriculaForm);
            setAlunoSelecionado(null);
          }
        }}
        editingMatriculaId={null}
        selectedAlunoNome={alunoSelecionado?.nome || ""}
        matriculaForm={matriculaForm}
        setMatriculaForm={setMatriculaForm}
        produtos={produtos}
        turmasFiltradas={[turma]}
        contasBancarias={contasBancarias}
        comerciais={comerciais}
        onSave={() => insertMatricula.mutate()}
        isSaving={insertMatricula.isPending}
        handleProdutoChange={handleProdutoChange}
      />

      {/* Busca na tabela */}
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
