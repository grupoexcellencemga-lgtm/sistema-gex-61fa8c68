import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { formatPhone, formatCPF } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/PageHeader";
import { PaginationControls, paginate } from "@/components/Pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  GraduationCap,
  Loader2,
  MapPin,
  Route,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

const PAGE_SIZE = 20;

type StatusConfig = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color: string;
};

const statusConfig: Record<string, StatusConfig> = {
  ativo: { label: "Em andamento", variant: "secondary", color: "text-primary" },
  aberto: { label: "Em andamento", variant: "secondary", color: "text-primary" },
  concluido: { label: "Concluído", variant: "default", color: "text-success" },
  finalizado: { label: "Finalizado", variant: "default", color: "text-success" },
  cancelado: { label: "Cancelado", variant: "destructive", color: "text-destructive" },
  pausado: { label: "Pausado", variant: "outline", color: "text-warning" },
  pendente: { label: "Pendente", variant: "outline", color: "text-warning" },
  presente: { label: "Presente", variant: "default", color: "text-success" },
  inscrito: { label: "Inscrito", variant: "secondary", color: "text-primary" },
  ausente: { label: "Não compareceu", variant: "outline", color: "text-muted-foreground" },
  pago: { label: "Pago", variant: "default", color: "text-success" },
  parcial: { label: "Parcial", variant: "outline", color: "text-warning" },
};

const onlyDigits = (value?: string | null) => (value || "").replace(/\D/g, "");
const normalizeText = (value?: string | null) => (value || "").trim().toLowerCase();
const normalizeEmail = (value?: string | null) => normalizeText(value);
const normalizeTipo = (value?: string | null) => normalizeText(value) || "evento";

const getEventoLabel = (tipo?: string | null) => {
  const normalized = normalizeTipo(tipo);
  if (normalized.includes("workshop")) return "Workshop";
  if (normalized.includes("palestra")) return "Palestra";
  if (normalized.includes("imers")) return "Imersão";
  if (normalized.includes("aula")) return "Aula";
  if (normalized.includes("evento")) return "Evento";
  return tipo || "Evento";
};

const getEntryDate = (entry: any) => entry.dataInicio || entry.data || entry.created_at || "";

const Jornada = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterVinculo, setFilterVinculo] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterProduto, setFilterProduto] = useState("all");
  const [filterTurma, setFilterTurma] = useState("all");
  const [expandedAluno, setExpandedAluno] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["jornada-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["jornada-matriculas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("*, produtos(nome), turmas(nome, cidade)")
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["jornada-pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*").is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: processos = [] } = useQuery({
    queryKey: ["jornada-processos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_individuais")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pagamentosProcesso = [] } = useQuery({
    queryKey: ["jornada-pagamentos-processo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos_processo").select("processo_id, valor").is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: participantesEventos = [] } = useQuery({
    queryKey: ["jornada-participantes-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participantes_eventos")
        .select("*, eventos(id, nome, data, tipo, local, valor, produto_id, turma_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: inscricoesEventos = [] } = useQuery({
    queryKey: ["jornada-inscricoes-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes_eventos")
        .select("*, eventos(id, nome, data, tipo, local, valor, produto_id, turma_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const pgtoProcessoMap = useMemo(() => {
    const map: Record<string, number> = {};
    pagamentosProcesso.forEach((pg: any) => {
      map[pg.processo_id] = (map[pg.processo_id] || 0) + Number(pg.valor || 0);
    });
    return map;
  }, [pagamentosProcesso]);

  const pessoasWithJourney = useMemo(() => {
    const pessoaMap: Record<string, any> = {};
    const emailMap: Record<string, string> = {};
    const phoneMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};

    alunos.forEach((aluno: any) => {
      pessoaMap[aluno.id] = { ...aluno, tipoPessoa: "aluno", vinculo: "aluno", jornada: [] };

      const email = normalizeEmail(aluno.email);
      const phone = onlyDigits(aluno.telefone);
      const name = normalizeText(aluno.nome);

      if (email) emailMap[email] = aluno.id;
      if (phone) phoneMap[phone] = aluno.id;
      if (name) nameMap[name] = aluno.id;
    });

    const findAlunoIdByContato = (item: any) => {
      const email = normalizeEmail(item.email);
      const phone = onlyDigits(item.telefone);
      const name = normalizeText(item.nome);

      if (email && emailMap[email]) return emailMap[email];
      if (phone && phoneMap[phone]) return phoneMap[phone];
      if (name && nameMap[name]) return nameMap[name];
      return null;
    };

    const getLeadKey = (item: any) => {
      const email = normalizeEmail(item.email);
      const phone = onlyDigits(item.telefone);
      const name = normalizeText(item.nome);
      if (email) return `lead-email-${email}`;
      if (phone) return `lead-phone-${phone}`;
      if (name) return `lead-name-${name}`;
      return `lead-sem-contato-${item.id}`;
    };

    const getOrCreateLead = (item: any) => {
      const key = getLeadKey(item);
      if (!pessoaMap[key]) {
        pessoaMap[key] = {
          id: key,
          nome: item.nome || "Lead sem nome",
          email: item.email || null,
          telefone: item.telefone || null,
          cpf: item.cpf || null,
          tipoPessoa: "lead",
          vinculo: "lead",
          origem: "Evento / Workshop",
          created_at: item.created_at,
          jornada: [],
        };
      }
      return pessoaMap[key];
    };

    const addEventoNaJornada = (pessoa: any, item: any, source: "participante" | "inscricao") => {
      const evento = item.eventos;
      const eventoData = evento?.data || item.created_at;
      const alreadyAdded = pessoa.jornada.some((entry: any) =>
        entry.tipo === "evento" && entry.titulo === (evento?.nome || "Evento") && entry.dataInicio === eventoData
      );
      if (alreadyAdded) return;

      const status = source === "participante"
        ? item.presenca ? "presente" : "inscrito"
        : "inscrito";

      pessoa.jornada.push({
        id: `${source}-evento-${item.id}`,
        tipo: "evento",
        categoria: getEventoLabel(evento?.tipo),
        titulo: evento?.nome || "Evento",
        subtitulo: source === "participante"
          ? item.presenca ? "Presença confirmada" : "Inscrito no evento"
          : "Inscrição realizada no evento",
        cidade: evento?.local || "—",
        dataInicio: eventoData,
        dataFim: null,
        status,
        eventoTipo: normalizeTipo(evento?.tipo),
        pagamento: Number(item.valor || 0) > 0 ? {
          total: Number(item.valor || 0),
          pago: item.status_pagamento === "pago" ? Number(item.valor || 0) : 0,
          parcelas: 1,
          parcelasPagas: item.status_pagamento === "pago" ? 1 : 0,
          status: item.status_pagamento || "pendente",
        } : null,
      });
    };

    matriculas.forEach((m: any) => {
      if (!pessoaMap[m.aluno_id]) return;

      const matPagamentos = pagamentos.filter((p: any) => p.matricula_id === m.id || (p.aluno_id === m.aluno_id && p.produto_id === m.produto_id));
      const totalPago = matPagamentos.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
      const totalValor = matPagamentos.reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
      const parcelasPagas = matPagamentos.filter((p: any) => p.status === "pago").length;
      const totalParcelas = matPagamentos.length;

      pessoaMap[m.aluno_id].jornada.push({
        id: `matricula-${m.id}`,
        tipo: "matricula",
        categoria: "Curso / Turma",
        titulo: m.produtos?.nome || "Matrícula",
        subtitulo: m.turmas?.nome || "Sem turma vinculada",
        cidade: m.turmas?.cidade || "—",
        dataInicio: m.data_inicio,
        dataFim: m.data_fim,
        status: m.status || "pendente",
        certificado: m.status === "concluido",
        pagamento: {
          total: totalValor || Number(m.valor_total || 0),
          pago: totalPago,
          parcelas: totalParcelas,
          parcelasPagas,
          status: totalParcelas === 0 ? "pendente" : parcelasPagas === totalParcelas ? "pago" : totalPago > 0 ? "parcial" : "pendente",
        },
      });
    });

    processos.forEach((p: any) => {
      if (!p.aluno_id || !pessoaMap[p.aluno_id]) return;

      const recebido = pgtoProcessoMap[p.id] || 0;
      const total = Number(p.valor_total || 0);

      pessoaMap[p.aluno_id].jornada.push({
        id: `processo-${p.id}`,
        tipo: "processo",
        categoria: "Processo Individual",
        titulo: "Processo Individual",
        subtitulo: p.responsavel ? `Responsável: ${p.responsavel}` : "Processo vinculado ao aluno",
        cidade: "—",
        dataInicio: p.data_inicio || p.created_at,
        dataFim: p.data_finalizacao || p.data_fim,
        status: p.status || "aberto",
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

    participantesEventos.forEach((participante: any) => {
      const alunoId = findAlunoIdByContato(participante);
      const pessoa = alunoId && pessoaMap[alunoId] ? pessoaMap[alunoId] : getOrCreateLead(participante);
      addEventoNaJornada(pessoa, participante, "participante");
    });

    inscricoesEventos.forEach((inscricao: any) => {
      const alunoId = inscricao.aluno_id && pessoaMap[inscricao.aluno_id]
        ? inscricao.aluno_id
        : findAlunoIdByContato(inscricao);
      const pessoa = alunoId && pessoaMap[alunoId] ? pessoaMap[alunoId] : getOrCreateLead(inscricao);
      addEventoNaJornada(pessoa, inscricao, "inscricao");
    });

    return Object.values(pessoaMap).map((pessoa: any) => ({
      ...pessoa,
      jornada: pessoa.jornada.sort((a: any, b: any) => String(getEntryDate(b)).localeCompare(String(getEntryDate(a)))),
    }));
  }, [alunos, matriculas, pagamentos, processos, pgtoProcessoMap, participantesEventos, inscricoesEventos]);

  const allProdutos = useMemo(() => {
    const set = new Set<string>();
    pessoasWithJourney.forEach((aluno: any) => {
      aluno.jornada.forEach((item: any) => {
        if (item.tipo === "matricula" || item.tipo === "processo") set.add(item.titulo);
      });
    });
    return Array.from(set).sort();
  }, [pessoasWithJourney]);

  const allTurmas = useMemo(() => {
    const set = new Set<string>();
    pessoasWithJourney.forEach((aluno: any) => {
      aluno.jornada.forEach((item: any) => {
        if (item.tipo === "matricula" && item.subtitulo && item.subtitulo !== "Sem turma vinculada") set.add(item.subtitulo);
      });
    });
    return Array.from(set).sort();
  }, [pessoasWithJourney]);

  const filtered = useMemo(() => {
    return pessoasWithJourney.filter((aluno: any) => {
      const termo = debouncedSearch.toLowerCase();
      const matchesSearch = !termo
        || normalizeText(aluno.nome).includes(termo)
        || normalizeEmail(aluno.email).includes(termo)
        || onlyDigits(aluno.telefone).includes(onlyDigits(termo));
      if (!matchesSearch) return false;

      if (filterVinculo !== "all" && aluno.vinculo !== filterVinculo) return false;
      if (filterTipo !== "all" && !aluno.jornada.some((item: any) => item.tipo === filterTipo)) return false;
      if (filterProduto !== "all" && !aluno.jornada.some((item: any) => item.titulo === filterProduto)) return false;
      if (filterTurma !== "all" && !aluno.jornada.some((item: any) => item.subtitulo === filterTurma)) return false;

      return true;
    });
  }, [pessoasWithJourney, debouncedSearch, filterVinculo, filterTipo, filterProduto, filterTurma]);

  const getFilteredJornada = (aluno: any) => {
    let jornada = [...aluno.jornada];
    if (filterTipo !== "all") jornada = jornada.filter((item: any) => item.tipo === filterTipo);
    if (filterProduto !== "all") jornada = jornada.filter((item: any) => item.titulo === filterProduto);
    if (filterTurma !== "all") jornada = jornada.filter((item: any) => item.subtitulo === filterTurma);
    return jornada;
  };

  const metrics = useMemo(() => {
    const totalPessoas = pessoasWithJourney.length;
    const totalAlunos = pessoasWithJourney.filter((p: any) => p.vinculo === "aluno").length;
    const totalLeads = pessoasWithJourney.filter((p: any) => p.vinculo === "lead").length;
    const totalEventos = pessoasWithJourney.reduce((sum: number, p: any) => sum + p.jornada.filter((i: any) => i.tipo === "evento").length, 0);
    const totalMatriculas = pessoasWithJourney.reduce((sum: number, p: any) => sum + p.jornada.filter((i: any) => i.tipo === "matricula").length, 0);

    return { totalPessoas, totalAlunos, totalLeads, totalEventos, totalMatriculas };
  }, [pessoasWithJourney]);

  const getEntryIcon = (tipo: string, certificado?: boolean) => {
    if (certificado) return <Award className="h-4 w-4 text-success" />;
    if (tipo === "evento") return <Calendar className="h-4 w-4 text-primary" />;
    if (tipo === "processo") return <UserCheck className="h-4 w-4 text-primary" />;
    return <GraduationCap className="h-4 w-4 text-primary" />;
  };

  const pagamentoColor: Record<string, string> = {
    pago: "text-success",
    parcial: "text-warning",
    pendente: "text-destructive",
  };

  return (
    <div>
      <PageHeader
        title="Jornada da Pessoa"
        description="Veja alunos e leads de eventos em uma única linha do tempo: eventos, workshops, cursos, turmas e processos."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pessoas</p><p className="text-2xl font-bold">{metrics.totalPessoas}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Alunos</p><p className="text-2xl font-bold">{metrics.totalAlunos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Leads de eventos</p><p className="text-2xl font-bold">{metrics.totalLeads}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Eventos / matrículas</p><p className="text-2xl font-bold">{metrics.totalEventos + metrics.totalMatriculas}</p></CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pessoa por nome, email ou telefone..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={filterVinculo} onValueChange={(value) => { setFilterVinculo(value); setPage(1); }}>
              <SelectTrigger className="w-full xl:w-44"><SelectValue placeholder="Vínculo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aluno">Alunos</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={(value) => { setFilterTipo(value); setPage(1); }}>
              <SelectTrigger className="w-full xl:w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="matricula">Cursos / Turmas</SelectItem>
                <SelectItem value="evento">Eventos / Workshops</SelectItem>
                <SelectItem value="processo">Processos Ind.</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterProduto} onValueChange={(value) => { setFilterProduto(value); setPage(1); }}>
              <SelectTrigger className="w-full xl:w-52"><SelectValue placeholder="Filtrar por produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os produtos</SelectItem>
                {allProdutos.map((produto) => <SelectItem key={produto} value={produto}>{produto}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTurma} onValueChange={(value) => { setFilterTurma(value); setPage(1); }}>
              <SelectTrigger className="w-full xl:w-52"><SelectValue placeholder="Filtrar por turma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as turmas</SelectItem>
                {allTurmas.map((turma) => <SelectItem key={turma} value={turma}>{turma}</SelectItem>)}
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
            const jornada = getFilteredJornada(aluno);
            const isExpanded = expandedAluno === aluno.id;
            const cursos = aluno.jornada.filter((item: any) => item.tipo === "matricula").length;
            const eventos = aluno.jornada.filter((item: any) => item.tipo === "evento").length;
            const processosAluno = aluno.jornada.filter((item: any) => item.tipo === "processo").length;
            const concluidos = aluno.jornada.filter((item: any) => ["concluido", "finalizado", "presente"].includes(item.status)).length;

            return (
              <Card key={aluno.id} className="transition-snappy">
                <CardContent className="p-0">
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-snappy rounded-t-lg"
                    onClick={() => setExpandedAluno((prev) => prev === aluno.id ? null : aluno.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        {aluno.vinculo === "lead" ? <UserPlus className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{aluno.nome}</p>
                          <Badge variant={aluno.vinculo === "lead" ? "outline" : "secondary"} className="text-[10px] h-5">
                            {aluno.vinculo === "lead" ? "Lead" : "Aluno"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {aluno.email || "Sem email"}{aluno.telefone ? ` · ${formatPhone(aluno.telefone)}` : ""}{aluno.cpf ? ` · ${formatCPF(aluno.cpf)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-2 text-xs">
                        {cursos > 0 && <Badge variant="outline" className="text-xs"><GraduationCap className="h-3 w-3 mr-1" />{cursos} curso{cursos !== 1 && "s"}</Badge>}
                        {eventos > 0 && <Badge variant="outline" className="text-xs"><Calendar className="h-3 w-3 mr-1" />{eventos} evento{eventos !== 1 && "s"}</Badge>}
                        {processosAluno > 0 && <Badge variant="outline" className="text-xs"><UserCheck className="h-3 w-3 mr-1" />{processosAluno} proc.</Badge>}
                        <Badge variant="secondary" className="text-xs">{aluno.jornada.length} registro{aluno.jornada.length !== 1 && "s"}</Badge>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t pt-4">
                      {jornada.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                          <Route className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm font-medium">Esta pessoa ainda não tem registros na jornada.</p>
                          <p className="text-xs text-muted-foreground mt-1">Quando ela participar de eventos, workshops, cursos ou processos, tudo aparecerá aqui.</p>
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {jornada.map((item: any, index: number) => {
                            const sc = statusConfig[item.status] || statusConfig.pendente;
                            const pagamento = item.pagamento;
                            const pagPct = pagamento?.total > 0 ? Math.min(100, Math.round((pagamento.pago / pagamento.total) * 100)) : 0;

                            return (
                              <div key={item.id} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                                    ["concluido", "finalizado", "presente", "pago"].includes(item.status) ? "border-success bg-success/10" :
                                    item.status === "cancelado" ? "border-destructive bg-destructive/10" :
                                    "border-primary bg-primary/10"
                                  }`}>
                                    {getEntryIcon(item.tipo, item.certificado)}
                                  </div>
                                  {index < jornada.length - 1 && <div className="w-0.5 flex-1 my-1 bg-border" />}
                                </div>

                                <div className="flex-1 pb-6">
                                  <div className="rounded-lg border p-4 hover:bg-secondary/30 transition-snappy">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="font-semibold text-sm">{item.titulo}</h4>
                                          <Badge variant="outline" className="text-xs font-normal">{item.categoria}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{item.subtitulo}</p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {item.certificado && <Badge variant="outline" className="text-xs bg-success/5 text-success border-success/20"><Award className="h-3 w-3 mr-1" />Certificado</Badge>}
                                        <Badge variant={sc.variant}>{sc.label}</Badge>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                                      <div className="flex items-center gap-1.5 text-muted-foreground">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>{formatDate(item.dataInicio)}{item.dataFim ? ` – ${formatDate(item.dataFim)}` : ""}</span>
                                      </div>
                                      {item.cidade && item.cidade !== "—" && (
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                          <MapPin className="h-3.5 w-3.5" /><span>{item.cidade}</span>
                                        </div>
                                      )}
                                      {item.tipo === "processo" && (
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                          <UserCheck className="h-3.5 w-3.5" />
                                          <span>Sessões: {item.sessoesRealizadas}/{item.sessoes}</span>
                                        </div>
                                      )}
                                      {pagamento?.total > 0 && (
                                        <div className="flex items-center gap-1.5">
                                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className={pagamentoColor[pagamento.status] || ""}>
                                            {formatCurrency(pagamento.pago)} / {formatCurrency(pagamento.total)}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {pagamento?.total > 0 && (
                                      <div className="mt-3">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="text-muted-foreground">Pagamento</span>
                                          <span className={`font-medium ${pagamentoColor[pagamento.status] || ""}`}>{pagPct}%</span>
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
                <p className="text-sm text-muted-foreground">Nenhuma pessoa encontrada</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Jornada;
