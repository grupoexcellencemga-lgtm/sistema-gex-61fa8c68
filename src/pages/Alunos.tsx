import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { maskPhone, maskCPF, formatPhone, formatCPF, validateCPF, exportToCSV } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Eye, Pencil, Loader2, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PaginationControls, paginate } from "@/components/Pagination";
import { logActivity } from "@/components/ActivityTimeline";
import { AlunoForm, emptyForm, emptyMatriculaForm, PAGE_SIZE, formatDate, formatCurrency } from "@/components/alunos/alunosUtils";
import { AlunoFormDialog } from "@/components/alunos/AlunoFormDialog";
import { MatriculaFormDialog } from "@/components/alunos/MatriculaFormDialog";
import { AlunoDetailSheet } from "@/components/alunos/AlunoDetailSheet";
import { AlunoImport } from "@/components/alunos/AlunoImport";

const Alunos = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [selectedAluno, setSelectedAluno] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AlunoForm>(emptyForm);

  const [matriculaDialogOpen, setMatriculaDialogOpen] = useState(false);
  const [matriculaForm, setMatriculaForm] = useState(emptyMatriculaForm);
  const [editingMatriculaId, setEditingMatriculaId] = useState<string | null>(null);
  const [parcelasDetailOpen, setParcelasDetailOpen] = useState(false);
  const [selectedParcelas, setSelectedParcelas] = useState<any[]>([]);
  const [editPagamentoDialog, setEditPagamentoDialog] = useState(false);
  const [editingPagamento, setEditingPagamento] = useState<any>(null);
  const [editPagForm, setEditPagForm] = useState({ valor: "", data_vencimento: "", forma_pagamento: "", conta_bancaria_id: "" });
  const [novoPagamentoDialog, setNovoPagamentoDialog] = useState(false);
  const [novoPagForm, setNovoPagForm] = useState({ matricula_id: "", produto_id: "", valor: "", data_vencimento: "", forma_pagamento: "", conta_bancaria_id: "", parcelas_cartao: "", taxa_cartao: "" });

  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [deleteAlunoDialogOpen, setDeleteAlunoDialogOpen] = useState(false);

  // ── Queries ──
  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["alunos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome, valor").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("id, nome, produto_id").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("id, nome, banco").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: comerciais = [] } = useQuery({
    queryKey: ["comerciais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas", selectedAluno?.id],
    queryFn: async () => {
      if (!selectedAluno) return [];
      const { data, error } = await supabase.from("matriculas").select("*, produtos(nome), turmas(nome)").eq("aluno_id", selectedAluno.id).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAluno,
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos-aluno", selectedAluno?.id],
    queryFn: async () => {
      if (!selectedAluno) return [];
      const { data, error } = await supabase.from("pagamentos").select("*, produtos(nome), contas_bancarias(nome)").eq("aluno_id", selectedAluno.id).is("deleted_at", null).order("data_vencimento", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAluno,
  });

  // ── Mutations ──
  const insertMutation = useMutation({
    mutationFn: async (data: AlunoForm) => {
      const { error } = await supabase.from("alunos").insert({
        nome: data.nome, email: data.email || null, telefone: data.telefone || null,
        cpf: data.cpf || null, sexo: data.sexo || null, data_nascimento: data.data_nascimento || null,
      });
      if (error) throw error;
      // Send welcome email if has email
      if (data.email) {
        supabase.functions.invoke("enviar-email", {
          body: { to: data.email, template_nome: "boas_vindas", variaveis: { nome: data.nome, empresa: "Nossa Empresa", email: data.email } },
        }).catch(() => {});
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["alunos"] }); toast.success("Aluno cadastrado"); setDialogOpen(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AlunoForm }) => {
      const { error } = await supabase.from("alunos").update({
        nome: data.nome, email: data.email || null, telefone: data.telefone || null,
        cpf: data.cpf || null, sexo: data.sexo || null, data_nascimento: data.data_nascimento || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      toast.success("Aluno atualizado");
      setDialogOpen(false);
      if (selectedAluno && editingId === selectedAluno.id) setSelectedAluno({ ...selectedAluno, ...form });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const insertMatricula = useMutation({
    mutationFn: async () => {
      const valorTotal = parseFloat(matriculaForm.valor_total) || 0;
      const desconto = parseFloat(matriculaForm.desconto) || 0;
      const valorFinal = valorTotal - desconto;
      const { data: mat, error: matErr } = await supabase.from("matriculas").insert({
        aluno_id: selectedAluno.id, produto_id: matriculaForm.produto_id || null,
        turma_id: matriculaForm.turma_id || null, data_inicio: matriculaForm.data_inicio || null,
        data_fim: matriculaForm.data_fim || null, status: matriculaForm.status,
        observacoes: matriculaForm.observacoes || null, valor_total: valorTotal, desconto, valor_final: valorFinal,
      }).select("id").single();
      if (matErr) throw matErr;

      if (valorFinal > 0 && matriculaForm.data_vencimento) {
        const isCartao = matriculaForm.forma_pagamento === "cartao";
        const isLinkBoleto = ["link", "boleto"].includes(matriculaForm.forma_pagamento);
        const numParcelas = isCartao ? 1 : (parseInt(matriculaForm.parcelas) || 1);
        const parcelasCliente = parseInt(matriculaForm.parcelas) || 1;
        const taxaCartao = (isCartao || isLinkBoleto) ? (parseFloat(matriculaForm.taxa_cartao) || 0) : 0;
        // Se repassar taxa, o valor cobrado do cliente inclui a taxa
        const valorBase = matriculaForm.repassar_taxa && (isCartao || isLinkBoleto) && taxaCartao > 0
          ? valorFinal + Math.round(valorFinal * taxaCartao) / 100
          : valorFinal;
        const valorParcela = valorBase / numParcelas;
        const rows = Array.from({ length: numParcelas }, (_, i) => {
          const d = new Date(matriculaForm.data_vencimento + "T12:00:00");
          if (!isCartao) d.setMonth(d.getMonth() + i);
          return {
            aluno_id: selectedAluno.id, produto_id: matriculaForm.produto_id || null,
            matricula_id: mat.id, valor: Math.round(valorParcela * 100) / 100,
            forma_pagamento: matriculaForm.forma_pagamento || null,
            parcelas: isCartao ? 1 : numParcelas, parcela_atual: isCartao ? 1 : i + 1,
            parcelas_cartao: isCartao ? parcelasCliente : null,
            taxa_cartao: taxaCartao > 0 ? taxaCartao : null,
            data_vencimento: d.toISOString().split("T")[0], status: "pendente",
            conta_bancaria_id: matriculaForm.conta_bancaria_id || null,
          };
        });
        const { error: pagErr } = await supabase.from("pagamentos").insert(rows);
        if (pagErr) throw pagErr;
      }

      if (matriculaForm.comercial_id && valorFinal > 0) {
        const pctComissao = Number(matriculaForm.percentual_comissao) || 5;
        const valorComissao = Math.round(valorFinal * pctComissao) / 100;
        await supabase.from("comissoes").insert({
          matricula_id: mat.id, comercial_id: matriculaForm.comercial_id,
          aluno_id: selectedAluno.id, produto_id: matriculaForm.produto_id || null,
          turma_id: matriculaForm.turma_id || null, valor_matricula: valorFinal,
          percentual: pctComissao, valor_comissao: valorComissao, status: "pendente",
        } as any);
        await supabase.from("matriculas").update({ comercial_id: matriculaForm.comercial_id } as any).eq("id", mat.id);
      }

      const produtoNome = produtos.find((p: any) => p.id === matriculaForm.produto_id)?.nome || "Produto";
      const turmaNome = turmas.find((t: any) => t.id === matriculaForm.turma_id)?.nome;
      await logActivity({ tipo: "matricula", descricao: `Matrícula criada em ${produtoNome}${turmaNome ? ` — ${turmaNome}` : ""} (${formatCurrency(valorFinal)})`, aluno_id: selectedAluno.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-aluno", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["atividades", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      toast.success("Matrícula criada com parcelas geradas automaticamente!");
      setMatriculaDialogOpen(false);
      setMatriculaForm(emptyMatriculaForm);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updatePagamentoStatus = useMutation({
    mutationFn: async ({ id, status, valorPago, valor, produtoNome }: { id: string; status: string; valorPago?: number; valor?: number; produtoNome?: string }) => {
      const update: any = { status };
      if (status === "pago") { update.data_pagamento = new Date().toISOString().split("T")[0]; if (valorPago !== undefined) update.valor_pago = valorPago; }
      if (status === "pendente") { update.data_pagamento = null; update.valor_pago = 0; }
      const { error } = await supabase.from("pagamentos").update(update).eq("id", id);
      if (error) throw error;
      if (status === "pago" && selectedAluno) {
        await logActivity({ tipo: "pagamento", descricao: `Pagamento de ${formatCurrency(valor || valorPago || 0)} confirmado${produtoNome ? ` (${produtoNome})` : ""}`, aluno_id: selectedAluno.id });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-aluno", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-contas"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-financeiro-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });
      queryClient.invalidateQueries({ queryKey: ["atividades", selectedAluno?.id] });
      setSelectedParcelas(prev => prev.map(p => p.id === variables.id ? { ...p, status: variables.status, data_pagamento: variables.status === "pago" ? new Date().toISOString().split("T")[0] : null, valor_pago: variables.status === "pago" ? (variables.valorPago || 0) : 0 } : p));
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deletePagamento = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("pagamentos").update({ deleted_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pagamentos-aluno", selectedAluno?.id] }); queryClient.invalidateQueries({ queryKey: ["pagamentos"] }); toast.success("Pagamento excluído"); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const insertPagamento = useMutation({
    mutationFn: async () => {
      if (!selectedAluno) return;
      const valor = parseFloat(novoPagForm.valor) || 0;
      if (valor <= 0) throw new Error("Valor deve ser maior que zero");
      if (!novoPagForm.data_vencimento) throw new Error("Data de vencimento é obrigatória");
      const isCartao = novoPagForm.forma_pagamento === "cartao";
      const taxaCartao = isCartao ? (parseFloat(novoPagForm.taxa_cartao) || 0) : 0;
      const parcelasCartao = isCartao ? (parseInt(novoPagForm.parcelas_cartao) || 1) : null;
      const { error } = await supabase.from("pagamentos").insert({
        aluno_id: selectedAluno.id, produto_id: novoPagForm.produto_id || null,
        matricula_id: novoPagForm.matricula_id || null, valor,
        forma_pagamento: novoPagForm.forma_pagamento || null,
        data_vencimento: novoPagForm.data_vencimento, status: "pendente",
        conta_bancaria_id: novoPagForm.conta_bancaria_id || null,
        parcelas: 1, parcela_atual: 1, parcelas_cartao: parcelasCartao,
        taxa_cartao: taxaCartao > 0 ? taxaCartao : null,
      });
      if (error) throw error;
      const matNome = matriculas.find((m: any) => m.id === novoPagForm.matricula_id)?.produtos?.nome;
      await logActivity({ tipo: "pagamento", descricao: `Pagamento avulso de ${formatCurrency(valor)} lançado${matNome ? ` (${matNome})` : ""}`, aluno_id: selectedAluno.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-aluno", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["atividades", selectedAluno?.id] });
      toast.success("Pagamento lançado com sucesso!");
      setNovoPagamentoDialog(false);
      setNovoPagForm({ matricula_id: "", produto_id: "", valor: "", data_vencimento: "", forma_pagamento: "", conta_bancaria_id: "", parcelas_cartao: "", taxa_cartao: "" });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMatricula = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pagamentos").update({ deleted_at: new Date().toISOString() }).eq("matricula_id", id);
      await supabase.from("comissoes").update({ deleted_at: new Date().toISOString() }).eq("matricula_id", id);
      const { error } = await supabase.from("matriculas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-aluno", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-contas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes-contas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas-financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-financeiro-turmas"] });
      toast.success("Matrícula excluída");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMatricula = useMutation({
    mutationFn: async () => {
      if (!editingMatriculaId) return;
      const valorTotal = parseFloat(matriculaForm.valor_total) || 0;
      const desconto = parseFloat(matriculaForm.desconto) || 0;
      const { error } = await supabase.from("matriculas").update({
        produto_id: matriculaForm.produto_id || null, turma_id: matriculaForm.turma_id || null,
        data_inicio: matriculaForm.data_inicio || null, data_fim: matriculaForm.data_fim || null,
        status: matriculaForm.status, observacoes: matriculaForm.observacoes || null,
        valor_total: valorTotal, desconto, valor_final: valorTotal - desconto,
      }).eq("id", editingMatriculaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matriculas", selectedAluno?.id] });
      toast.success("Matrícula atualizada");
      setMatriculaDialogOpen(false); setEditingMatriculaId(null); setMatriculaForm(emptyMatriculaForm);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updatePagamento = useMutation({
    mutationFn: async () => {
      if (!editingPagamento) return;
      const { error } = await supabase.from("pagamentos").update({
        valor: parseFloat(editPagForm.valor) || 0, data_vencimento: editPagForm.data_vencimento || null,
        forma_pagamento: editPagForm.forma_pagamento || null, conta_bancaria_id: editPagForm.conta_bancaria_id || null,
      }).eq("id", editingPagamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-aluno", selectedAluno?.id] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      toast.success("Pagamento atualizado");
      setEditPagamentoDialog(false); setEditingPagamento(null);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteAlunoMutation = useMutation({
    mutationFn: async (alunoId: string) => {
      const { data: mats } = await supabase.from("matriculas").select("id").eq("aluno_id", alunoId).is("deleted_at", null);
      const matIds = (mats || []).map((m: any) => m.id);
      if (matIds.length > 0) { await supabase.from("comissoes").update({ deleted_at: new Date().toISOString() }).in("matricula_id", matIds); await supabase.from("pagamentos").update({ deleted_at: new Date().toISOString() }).in("matricula_id", matIds); }
      await supabase.from("pagamentos").update({ deleted_at: new Date().toISOString() }).eq("aluno_id", alunoId);
      await supabase.from("matriculas").update({ deleted_at: new Date().toISOString() }).eq("aluno_id", alunoId);
      await supabase.from("inscricoes_eventos").delete().eq("aluno_id", alunoId);
      await supabase.from("presencas").delete().eq("aluno_id", alunoId);
      await supabase.from("atividades").delete().eq("aluno_id", alunoId);
      const { error } = await supabase.from("alunos").update({ deleted_at: new Date().toISOString() }).eq("id", alunoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-contas"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes-contas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas-financeiro"] });
      queryClient.invalidateQueries({ queryKey: ["pagamentos-financeiro-turmas"] });
      toast.success("Aluno e todos os dados relacionados foram excluídos");
      setSheetOpen(false); setSelectedAluno(null); setDeleteAlunoDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  // ── Helpers ──
  const filtered = alunos.filter((a) => {
    if (debouncedSearch && !a.nome.toLowerCase().includes(debouncedSearch.toLowerCase()) && !(a.email || "").toLowerCase().includes(debouncedSearch.toLowerCase()) && !(a.cpf || "").includes(debouncedSearch)) return false;
    return true;
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (aluno: any) => {
    setForm({ nome: aluno.nome, email: aluno.email || "", telefone: formatPhone(aluno.telefone), cpf: formatCPF((aluno as any).cpf), sexo: aluno.sexo || "", data_nascimento: aluno.data_nascimento || "" });
    setEditingId(aluno.id); setDialogOpen(true); setSheetOpen(false);
  };

  const [cpfWarning, setCpfWarning] = useState("");

  const saveAluno = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (form.cpf && !validateCPF(form.cpf)) {
      setCpfWarning("CPF inválido — os dígitos verificadores não conferem.");
      toast.warning("CPF inválido, mas o cadastro será realizado mesmo assim.");
    } else {
      setCpfWarning("");
    }
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else insertMutation.mutate(form);
  };

  const updateField = (field: keyof AlunoForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const openEditMatricula = (m: any) => {
    setEditingMatriculaId(m.id);
    setMatriculaForm({
      produto_id: m.produto_id || "", turma_id: m.turma_id || "",
      data_inicio: m.data_inicio || "", data_fim: m.data_fim || "",
      status: m.status || "ativo", observacoes: m.observacoes || "",
      valor_total: String(m.valor_total || ""), desconto: String(m.desconto || ""),
      parcelas: "1", forma_pagamento: "", data_vencimento: "", conta_bancaria_id: "", comercial_id: "", percentual_comissao: "5", taxa_cartao: "", repassar_taxa: false,
    });
    setMatriculaDialogOpen(true);
  };

  const openEditPagamento = (p: any) => {
    setEditingPagamento(p);
    setEditPagForm({ valor: String(p.valor || ""), data_vencimento: p.data_vencimento || "", forma_pagamento: p.forma_pagamento || "", conta_bancaria_id: p.conta_bancaria_id || "" });
    setEditPagamentoDialog(true);
  };

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos.find((p: any) => p.id === produtoId);
    setMatriculaForm(prev => ({ ...prev, produto_id: produtoId, turma_id: "", valor_total: produto?.valor ? String(produto.valor) : prev.valor_total }));
  };

  const turmasFiltradas = matriculaForm.produto_id ? turmas.filter(t => t.produto_id === matriculaForm.produto_id) : turmas;

  // ── Import ──
  const COLUMN_MAP: Record<string, string> = {
    nome: "nome", name: "nome", "Nome": "nome", "NOME": "nome",
    email: "email", "Email": "email", "E-mail": "email", "EMAIL": "email", "e-mail": "email",
    telefone: "telefone", "Telefone": "telefone", "TELEFONE": "telefone", phone: "telefone", celular: "telefone", "Celular": "telefone",
    cpf: "cpf", "CPF": "cpf",
    sexo: "sexo", "Sexo": "sexo", "SEXO": "sexo", genero: "sexo", "Gênero": "sexo",
    data_nascimento: "data_nascimento", "Data Nascimento": "data_nascimento", "Data de Nascimento": "data_nascimento", "data de nascimento": "data_nascimento", nascimento: "data_nascimento", "Nascimento": "data_nascimento",
    cidade: "cidade", "Cidade": "cidade", "CIDADE": "cidade",
  };

  const normalizeDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === "number") { const d = new Date(Math.round((val - 25569) * 86400 * 1000)); return d.toISOString().split("T")[0]; }
    const s = String(val).trim();
    const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    return null;
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        if (jsonRows.length === 0) { toast.error("Planilha vazia."); return; }
        const mapped = jsonRows.map((row) => {
          const result: any = {};
          Object.entries(row).forEach(([key, val]) => { const mk = COLUMN_MAP[key.trim()]; if (mk) result[mk] = val; });
          if (result.data_nascimento) result.data_nascimento = normalizeDate(result.data_nascimento);
          return result;
        }).filter((r) => r.nome && String(r.nome).trim());
        if (mapped.length === 0) { toast.error("Nenhum registro válido encontrado. Verifique se a coluna 'Nome' existe."); return; }
        setImportPreview(mapped);
        setImportDialogOpen(true);
      } catch (err: any) { toast.error("Erro ao ler arquivo: " + err.message); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setIsImporting(true);
    try {
      const rows = importPreview.map((r) => ({
        nome: String(r.nome).trim(), email: r.email ? String(r.email).trim() : null,
        telefone: r.telefone ? String(r.telefone).trim() : null, cpf: r.cpf ? String(r.cpf).trim() : null,
        sexo: r.sexo ? String(r.sexo).trim() : null, data_nascimento: r.data_nascimento || null,
        cidade: r.cidade ? String(r.cidade).trim() : null,
      }));
      const { data: existingAlunos } = await supabase.from("alunos").select("id, nome, email, telefone, cpf, sexo, data_nascimento, cidade").is("deleted_at", null);
      const existing = existingAlunos || [];
      const byCpf = new Map<string, any>();
      const byNome = new Map<string, any>();
      existing.forEach((a) => { if (a.cpf) byCpf.set(a.cpf.replace(/\D/g, ""), a); byNome.set(a.nome.toLowerCase().trim(), a); });
      const toInsert: typeof rows = [];
      const toUpdate: { id: string; data: Record<string, any> }[] = [];
      let skipped = 0;
      for (const row of rows) {
        const cpfClean = row.cpf?.replace(/\D/g, "") || "";
        const nomeClean = row.nome.toLowerCase().trim();
        const match = (cpfClean && byCpf.get(cpfClean)) || byNome.get(nomeClean);
        if (match) {
          const updates: Record<string, any> = {};
          if (!match.email && row.email) updates.email = row.email;
          if (!match.telefone && row.telefone) updates.telefone = row.telefone;
          if (!match.cpf && row.cpf) updates.cpf = row.cpf;
          if (!match.sexo && row.sexo) updates.sexo = row.sexo;
          if (!match.data_nascimento && row.data_nascimento) updates.data_nascimento = row.data_nascimento;
          if (!match.cidade && row.cidade) updates.cidade = row.cidade;
          if (Object.keys(updates).length > 0) toUpdate.push({ id: match.id, data: updates });
          else skipped++;
        } else { toInsert.push(row); }
      }
      const batchSize = 100;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const { error } = await supabase.from("alunos").insert(toInsert.slice(i, i + batchSize));
        if (error) throw error;
      }
      for (const upd of toUpdate) { await supabase.from("alunos").update(upd.data).eq("id", upd.id); }
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      const msgs: string[] = [];
      if (toInsert.length > 0) msgs.push(`${toInsert.length} novo(s)`);
      if (toUpdate.length > 0) msgs.push(`${toUpdate.length} atualizado(s)`);
      if (skipped > 0) msgs.push(`${skipped} já existente(s)`);
      toast.success(`Importação concluída: ${msgs.join(", ")}`);
      setImportDialogOpen(false); setImportPreview(null);
    } catch (err: any) { toast.error("Erro na importação: " + err.message); }
    finally { setIsImporting(false); }
  };

  const isSaving = insertMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader title="Alunos" description="Gerencie o cadastro de alunos do Grupo Excellence">
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" id="import-alunos-input" onChange={handleImportFile} />
        <Button variant="outline" size="sm" onClick={() => document.getElementById("import-alunos-input")?.click()}>
          <Upload className="h-4 w-4 mr-2" />Importar
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered.map(a => ({ nome: a.nome, email: a.email || "", telefone: formatPhone(a.telefone), cpf: formatCPF((a as any).cpf) })), "alunos", [{ key: "nome", label: "Nome" }, { key: "email", label: "Email" }, { key: "telefone", label: "Telefone" }, { key: "cpf", label: "CPF" }])}>
          <Download className="h-4 w-4 mr-2" />Exportar CSV
        </Button>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Aluno</Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="py-3 text-sm text-muted-foreground">
          Para matricular aluno e lançar pagamentos, clique em <span className="font-medium text-foreground">Ficha</span> na linha do aluno.
        </CardContent>
      </Card>

      <AlunoFormDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setCpfWarning(""); }} editingId={editingId} form={form} updateField={updateField} onSave={saveAluno} isSaving={isSaving} cpfWarning={cpfWarning} />

      <MatriculaFormDialog
        open={matriculaDialogOpen} onOpenChange={setMatriculaDialogOpen}
        editingMatriculaId={editingMatriculaId} selectedAlunoNome={selectedAluno?.nome || ""}
        matriculaForm={matriculaForm} setMatriculaForm={setMatriculaForm}
        produtos={produtos} turmasFiltradas={turmasFiltradas}
        contasBancarias={contasBancarias} comerciais={comerciais}
        onSave={() => editingMatriculaId ? updateMatricula.mutate() : insertMatricula.mutate()}
        isSaving={insertMatricula.isPending || updateMatricula.isPending}
        handleProdutoChange={handleProdutoChange}
      />

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, email ou CPF..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="w-[160px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginate(filtered, page, PAGE_SIZE).map((aluno) => (
                  <TableRow key={aluno.id} className="transition-snappy hover:bg-secondary/50">
                    <TableCell>
                      <div><p className="font-medium text-sm">{aluno.nome}</p><p className="text-xs text-muted-foreground">{aluno.email}</p></div>
                    </TableCell>
                    <TableCell className="text-sm">{formatPhone(aluno.telefone)}</TableCell>
                    <TableCell className="text-sm">{formatCPF((aluno as any).cpf)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedAluno(aluno); setSheetOpen(true); }}>
                          <Eye className="h-4 w-4 mr-1.5" />Ficha
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(aluno)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum aluno encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      <AlunoDetailSheet
        open={sheetOpen} onOpenChange={setSheetOpen}
        selectedAluno={selectedAluno} matriculas={matriculas} pagamentos={pagamentos}
        contasBancarias={contasBancarias}
        onEdit={openEdit}
        onDeleteAluno={() => setDeleteAlunoDialogOpen(true)}
        deleteAlunoDialogOpen={deleteAlunoDialogOpen} setDeleteAlunoDialogOpen={setDeleteAlunoDialogOpen}
        deleteAlunoMutation={deleteAlunoMutation}
        onNewMatricula={() => { setEditingMatriculaId(null); setMatriculaForm(emptyMatriculaForm); setMatriculaDialogOpen(true); }}
        onEditMatricula={openEditMatricula}
        onDeleteMatricula={(id) => deleteMatricula.mutate(id)}
        onNewPagamento={() => { setNovoPagForm({ matricula_id: "", produto_id: "", valor: "", data_vencimento: "", forma_pagamento: "", conta_bancaria_id: "", parcelas_cartao: "", taxa_cartao: "" }); setNovoPagamentoDialog(true); }}
        onConfirmPagamento={(p, fees) => updatePagamentoStatus.mutate({ id: p.id, status: "pago", valorPago: fees.total, valor: Number(p.valor), produtoNome: p.produtos?.nome })}
        onDesfazerPagamento={(p) => updatePagamentoStatus.mutate({ id: p.id, status: "pendente" })}
        onEditPagamento={openEditPagamento}
        onDeletePagamento={(id) => deletePagamento.mutate(id)}
        parcelasDetailOpen={parcelasDetailOpen} setParcelasDetailOpen={setParcelasDetailOpen}
        selectedParcelas={selectedParcelas} setSelectedParcelas={setSelectedParcelas}
        editPagamentoDialog={editPagamentoDialog} setEditPagamentoDialog={setEditPagamentoDialog}
        editPagForm={editPagForm} setEditPagForm={setEditPagForm}
        onSavePagamento={() => updatePagamento.mutate()} updatePagamentoIsPending={updatePagamento.isPending}
        novoPagamentoDialog={novoPagamentoDialog} setNovoPagamentoDialog={setNovoPagamentoDialog}
        novoPagForm={novoPagForm} setNovoPagForm={setNovoPagForm}
        onSaveNovoPagamento={() => insertPagamento.mutate()} insertPagamentoIsPending={insertPagamento.isPending}
      />

      <AlunoImport
        importDialogOpen={importDialogOpen} setImportDialogOpen={setImportDialogOpen}
        importPreview={importPreview} setImportPreview={setImportPreview}
        isImporting={isImporting} onConfirmImport={confirmImport}
      />
    </div>
  );
};

export default Alunos;
