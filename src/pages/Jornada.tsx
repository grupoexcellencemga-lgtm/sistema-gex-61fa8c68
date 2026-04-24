import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, formatCPF } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, GraduationCap, Calendar, MapPin, CreditCard, Award, ChevronDown, ChevronUp, Loader2, UserCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PaginationControls, paginate } from "@/components/Pagination";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  ativo: { label: "Em Andamento", variant: "secondary", color: "text-primary" },
  concluido: { label: "Concluído", variant: "default", color: "text-success" },
  cancelado: { label: "Cancelado", variant: "destructive", color: "text-destructive" },
  pendente: { label: "Pendente", variant: "outline", color: "text-warning" },
  aberto: { label: "Em Andamento", variant: "secondary", color: "text-primary" },
  finalizado: { label: "Finalizado", variant: "default", color: "text-success" },
  pausado: { label: "Pausado", variant: "outline", color: "text-warning" },
};
import { formatDate, formatCurrency } from "@/lib/formatters";

const PAGE_SIZE = 20;

const Jornada = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterProduto, setFilterProduto] = useState("all");
  const [filterTurma, setFilterTurma] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [expandedAluno, setExpandedAluno] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["jornada-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["jornada-matriculas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matriculas").select("*, produtos(nome), turmas(nome, cidade)").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["jornada-pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: processos = [] } = useQuery({
    queryKey: ["jornada-processos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processos_individuais").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcesso = [] } = useQuery({
    queryKey: ["jornada-pagamentos-processo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos_processo").select("processo_id, valor").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  // Map processo payments
  const pgtoProcessoMap = useMemo(() => {
    const map: Record<string, number> = {};
    pagamentosProcesso.forEach((pg: any) => {
      map[pg.processo_id] = (map[pg.processo_id] || 0) + Number(pg.valor || 0);
    });
    return map;
  }, [pagamentosProcesso]);

  // Build unified journey entries
  const alunosWithJourney = useMemo(() => {
    // Start with alunos that have matrículas or processos
    const alunoMap: Record<string, any> = {};

    // Add all alunos
    alunos.forEach((aluno: any) => {
      alunoMap[aluno.id] = { ...aluno, etapas: [], processosIndividuais: [] };
    });

    // Add matrícula etapas
    matriculas.forEach((m: any) => {
      if (!alunoMap[m.aluno_id]) return;
      const matPagamentos = pagamentos.filter((p: any) => p.aluno_id === m.aluno_id && p.produto_id === m.produto_id);
      const totalPago = matPagamentos.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
      const totalValor = matPagamentos.reduce((s: number, p: any) => s + Number(p.valor), 0);
      const parcelasPagas = matPagamentos.filter((p: any) => p.status === "pago").length;
      const totalParcelas = matPagamentos.length;

      alunoMap[m.aluno_id].etapas.push({
        id: m.id,
        tipo: "matricula",
        produto: m.produtos?.nome || "—",
        turma: m.turmas?.nome || "—",
        cidade: m.turmas?.cidade || "—",
        dataInicio: m.data_inicio,
        dataFim: m.data_fim,
        status: m.status,
        certificado: m.status === "concluido",
        pagamento: {
          total: totalValor,
          pago: totalPago,
          parcelas: totalParcelas,
          parcelasPagas,
          status: totalParcelas === 0 ? "pendente" : parcelasPagas === totalParcelas ? "pago" : totalPago > 0 ? "parcial" : "pendente",
        },
      });
    });

    // Add processos individuais linked to alunos
    processos.forEach((p: any) => {
      if (p.aluno_id && alunoMap[p.aluno_id]) {
        const recebido = pgtoProcessoMap[p.id] || 0;
        const total = Number(p.valor_total || 0);
        alunoMap[p.aluno_id].processosIndividuais.push({
          id: p.id,
          tipo: "processo_individual",
          produto: "Processo Individual",
          responsavel: p.responsavel,
          turma: p.responsavel,
          cidade: "—",
          dataInicio: p.data_inicio,
          dataFim: p.data_finalizacao || p.data_fim,
          status: p.status,
          certificado: false,
          sessoes: Number(p.sessoes || 1),
          sessoesRealizadas: Number(p.sessoes_realizadas || 0),
          pagamento: {
            total,
            pago: recebido,
            parcelas: Number(p.parcelas || 1),
            parcelasPagas: recebido >= total && total > 0 ? Number(p.parcelas || 1) : 0,
            status: total === 0 ? "pendente" : recebido >= total ? "pago" : recebido > 0 ? "parcial" : "pendente",
          },
        });
      }
    });

    // Create entries for processos without aluno_id (standalone clients)
    const standaloneProcessos = processos.filter((p: any) => !p.aluno_id);
    const standaloneByClient: Record<string, any> = {};
    standaloneProcessos.forEach((p: any) => {
      const key = `standalone-${p.cliente_nome}`;
      if (!standaloneByClient[key]) {
        standaloneByClient[key] = {
          id: key,
          nome: p.cliente_nome,
          email: p.cliente_email,
          telefone: p.cliente_telefone,
          cpf: p.cpf,
          isStandalone: true,
          etapas: [],
          processosIndividuais: [],
        };
      }
      const recebido = pgtoProcessoMap[p.id] || 0;
      const total = Number(p.valor_total || 0);
      standaloneByClient[key].processosIndividuais.push({
        id: p.id,
        tipo: "processo_individual",
        produto: "Processo Individual",
        responsavel: p.responsavel,
        turma: p.responsavel,
        cidade: "—",
        dataInicio: p.data_inicio,
        dataFim: p.data_finalizacao || p.data_fim,
        status: p.status,
        certificado: false,
        sessoes: Number(p.sessoes || 1),
        sessoesRealizadas: Number(p.sessoes_realizadas || 0),
        pagamento: {
          total,
          pago: recebido,
          parcelas: Number(p.parcelas || 1),
          parcelasPagas: recebido >= total && total > 0 ? Number(p.parcelas || 1) : 0,
          status: total === 0 ? "pendente" : recebido >= total ? "pago" : recebido > 0 ? "parcial" : "pendente",
        },
      });
    });

    // Combine all entries, filter to those with at least 1 etapa or processo
    const allEntries = [
      ...Object.values(alunoMap).filter((a: any) => a.etapas.length > 0 || a.processosIndividuais.length > 0),
      ...Object.values(standaloneByClient),
    ];

    return allEntries;
  }, [alunos, matriculas, pagamentos, processos, pgtoProcessoMap]);

  const allProdutos = useMemo(() => {
    const set = new Set<string>();
    alunosWithJourney.forEach((a: any) => {
      a.etapas.forEach((e: any) => set.add(e.produto));
      if (a.processosIndividuais.length > 0) set.add("Processo Individual");
    });
    return Array.from(set).sort();
  }, [alunosWithJourney]);

  const allTurmas = useMemo(() => {
    const set = new Set<string>();
    alunosWithJourney.forEach((a: any) => {
      a.etapas.forEach((e: any) => set.add(e.turma));
    });
    return Array.from(set).sort();
  }, [alunosWithJourney]);

  const filtered = alunosWithJourney.filter((aluno: any) => {
    if (debouncedSearch && !aluno.nome.toLowerCase().includes(debouncedSearch.toLowerCase()) && !(aluno.email || "").toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    
    const allEtapas = [...aluno.etapas, ...aluno.processosIndividuais];
    
    if (filterTipo === "matricula" && aluno.etapas.length === 0) return false;
    if (filterTipo === "processo" && aluno.processosIndividuais.length === 0) return false;
    
    if (filterProduto !== "all") {
      if (filterProduto === "Processo Individual") {
        if (aluno.processosIndividuais.length === 0) return false;
      } else {
        if (!aluno.etapas.some((e: any) => e.produto === filterProduto)) return false;
      }
    }
    if (filterTurma !== "all" && !aluno.etapas.some((e: any) => e.turma === filterTurma)) return false;
    return true;
  });

  const getFilteredEtapas = (aluno: any) => {
    let etapas = [...aluno.etapas];
    let procs = [...aluno.processosIndividuais];

    if (filterProduto !== "all") {
      if (filterProduto === "Processo Individual") {
        etapas = [];
      } else {
        etapas = etapas.filter((e: any) => e.produto === filterProduto);
        procs = [];
      }
    }
    if (filterTurma !== "all") {
      etapas = etapas.filter((e: any) => e.turma === filterTurma);
    }
    if (filterTipo === "matricula") procs = [];
    if (filterTipo === "processo") etapas = [];

    return [...etapas, ...procs];
  };

  const pagamentoColor: Record<string, string> = { pago: "text-success", parcial: "text-warning", pendente: "text-destructive" };

  return (
    <div>
      <PageHeader title="Jornada do Aluno" description="Acompanhe a trajetória de cada aluno nos produtos e processos individuais" />

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="matricula">Matrículas</SelectItem>
                <SelectItem value="processo">Processos Ind.</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterProduto} onValueChange={setFilterProduto}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filtrar por produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {allProdutos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTurma} onValueChange={setFilterTurma}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filtrar por turma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {allTurmas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
      <div className="space-y-4">
          {paginate(filtered, page, PAGE_SIZE).map((aluno: any) => {
            const allEtapas = getFilteredEtapas(aluno);
            const isExpanded = expandedAluno === aluno.id;
            const concluidos = [...aluno.etapas, ...aluno.processosIndividuais].filter((e: any) => e.status === "concluido" || e.status === "finalizado").length;
            const emAndamento = [...aluno.etapas, ...aluno.processosIndividuais].filter((e: any) => e.status === "ativo" || e.status === "aberto").length;
            const certificados = aluno.etapas.filter((e: any) => e.certificado).length;
            const totalItems = aluno.etapas.length + aluno.processosIndividuais.length;

            return (
              <Card key={aluno.id} className="transition-snappy">
                <CardContent className="p-0">
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-snappy rounded-t-lg"
                    onClick={() => setExpandedAluno(prev => prev === aluno.id ? null : aluno.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${aluno.isStandalone ? "bg-accent/20" : "bg-primary/10"}`}>
                        {aluno.isStandalone ? <UserCheck className="h-5 w-5 text-accent-foreground" /> : <GraduationCap className="h-5 w-5 text-primary" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{aluno.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {aluno.email}{aluno.telefone ? ` · ${formatPhone(aluno.telefone)}` : ""}
                          {aluno.cpf ? ` · ${formatCPF(aluno.cpf)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-3 text-xs">
                        {certificados > 0 && <span className="flex items-center gap-1 text-success"><Award className="h-3.5 w-3.5" />{certificados} cert.</span>}
                        {concluidos > 0 && <span className="text-muted-foreground">{concluidos} concluído{concluidos !== 1 && "s"}</span>}
                        {emAndamento > 0 && <span className="text-primary">{emAndamento} em andamento</span>}
                        {aluno.processosIndividuais.length > 0 && (
                          <Badge variant="outline" className="text-xs border-accent/30">
                            <UserCheck className="h-3 w-3 mr-1" />{aluno.processosIndividuais.length} proc. ind.
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">{totalItems} item{totalItems !== 1 && "s"}</Badge>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t pt-4 space-y-0">
                      {allEtapas.map((etapa: any, i: number) => {
                        const sc = statusConfig[etapa.status] || statusConfig.pendente;
                        const pagPct = etapa.pagamento.total > 0 ? Math.round((etapa.pagamento.pago / etapa.pagamento.total) * 100) : 0;
                        const isProcesso = etapa.tipo === "processo_individual";

                        return (
                          <div key={etapa.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                                etapa.status === "concluido" || etapa.status === "finalizado" ? "border-success bg-success/10" :
                                etapa.status === "ativo" || etapa.status === "aberto" ? "border-primary bg-primary/10" :
                                etapa.status === "cancelado" ? "border-destructive bg-destructive/10" :
                                "border-border bg-secondary"
                              }`}>
                                {isProcesso
                                  ? <UserCheck className={`h-4 w-4 ${sc.color}`} />
                                  : etapa.certificado
                                    ? <Award className="h-4 w-4 text-success" />
                                    : <GraduationCap className={`h-4 w-4 ${sc.color}`} />
                                }
                              </div>
                              {i < allEtapas.length - 1 && <div className={`w-0.5 flex-1 my-1 ${
                                etapa.status === "concluido" || etapa.status === "finalizado" ? "bg-success/40" : "bg-border"
                              }`} />}
                            </div>

                            <div className="flex-1 pb-6">
                              <div className="rounded-lg border p-4 hover:bg-secondary/30 transition-snappy">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                      {isProcesso ? "Processo Individual" : etapa.produto}
                                      {isProcesso && (
                                        <Badge variant="outline" className="text-xs font-normal">Coach: {etapa.responsavel}</Badge>
                                      )}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      {isProcesso ? `Responsável: ${etapa.responsavel}` : etapa.turma}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {etapa.certificado && (
                                      <Badge variant="outline" className="text-xs bg-success/5 text-success border-success/20">
                                        <Award className="h-3 w-3 mr-1" />Certificado
                                      </Badge>
                                    )}
                                    <Badge variant={sc.variant}>{sc.label}</Badge>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{formatDate(etapa.dataInicio)} – {formatDate(etapa.dataFim)}</span>
                                  </div>
                                  {!isProcesso && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <MapPin className="h-3.5 w-3.5" /><span>{etapa.cidade}</span>
                                    </div>
                                  )}
                                  {isProcesso && (
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                      <UserCheck className="h-3.5 w-3.5" />
                                      <span>Sessões: {etapa.sessoesRealizadas}/{etapa.sessoes}</span>
                                    </div>
                                  )}
                                  {etapa.pagamento.total > 0 && (
                                    <>
                                      <div className="flex items-center gap-1.5">
                                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className={pagamentoColor[etapa.pagamento.status] || ""}>
                                          {formatCurrency(etapa.pagamento.pago)} / {formatCurrency(etapa.pagamento.total)}
                                        </span>
                                      </div>
                                      {!isProcesso && (
                                        <div className="text-muted-foreground">{etapa.pagamento.parcelasPagas}/{etapa.pagamento.parcelas} parcelas</div>
                                      )}
                                    </>
                                  )}
                                </div>
                                {etapa.pagamento.total > 0 && (
                                  <div className="mt-3">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className="text-muted-foreground">Pagamento</span>
                                      <span className={`font-medium ${pagamentoColor[etapa.pagamento.status] || ""}`}>{pagPct}%</span>
                                    </div>
                                    <Progress value={pagPct} className="h-1.5" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <GraduationCap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum aluno ou cliente encontrado</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Jornada;
