import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Search, Eye } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PaginationControls } from "@/components/Pagination";
import { useDebounce } from "@/hooks/useDebounce";

const ACOES = ["criar", "editar", "excluir", "avançar_etapa", "pagar", "cancelar"];
const TABELAS = ["alunos", "matriculas", "pagamentos", "leads", "despesas", "comissoes", "processos_individuais", "processos_empresariais", "produtos", "turmas", "eventos"];

const ACAO_COLORS: Record<string, string> = {
  criar: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  editar: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  excluir: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pagar: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const TABELA_LABELS: Record<string, string> = {
  alunos: "Alunos",
  matriculas: "Matrículas",
  pagamentos: "Pagamentos",
  leads: "Leads",
  despesas: "Despesas",
  comissoes: "Comissões",
  processos_individuais: "Processo Individual",
  processos_empresariais: "Processo Empresarial",
  produtos: "Produtos",
  turmas: "Turmas",
  eventos: "Eventos",
  comerciais: "Vendedores",
  profissionais: "Profissionais",
  receitas_avulsas: "Receitas Avulsas",
  contas_a_pagar: "Contas a Pagar",
  metas: "Metas",
  tarefas: "Tarefas",
};

const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  nome: "Nome",
  email: "E-mail",
  telefone: "Telefone",
  cpf: "CPF",
  cidade: "Cidade",
  sexo: "Sexo",
  data_nascimento: "Data de Nascimento",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  deleted_at: "Excluído em",
  status: "Status",
  valor: "Valor",
  valor_total: "Valor Total",
  valor_final: "Valor Final",
  valor_pago: "Valor Pago",
  valor_comissao: "Valor Comissão",
  valor_meta: "Valor da Meta",
  valor_atual: "Valor Atual",
  desconto: "Desconto",
  parcelas: "Parcelas",
  forma_pagamento: "Forma de Pagamento",
  data_pagamento: "Data do Pagamento",
  data_vencimento: "Data de Vencimento",
  data_inicio: "Data de Início",
  data_fim: "Data de Fim",
  data_finalizacao: "Data de Finalização",
  data: "Data",
  produto_id: "Produto",
  turma_id: "Turma",
  aluno_id: "Aluno",
  comercial_id: "Vendedor",
  profissional_id: "Profissional",
  responsavel: "Responsável",
  responsavel_id: "Responsável",
  responsavel_tipo: "Tipo de Responsável",
  cliente_nome: "Nome do Cliente",
  cliente_email: "E-mail do Cliente",
  cliente_telefone: "Telefone do Cliente",
  empresa_nome: "Nome da Empresa",
  observacoes: "Observações",
  descricao: "Descrição",
  titulo: "Título",
  tipo: "Tipo",
  tipo_vinculo: "Tipo de Vínculo",
  etapa: "Etapa",
  origem: "Origem",
  produto_interesse: "Produto de Interesse",
  modalidade: "Modalidade",
  local: "Local",
  limite_participantes: "Limite de Participantes",
  sessoes: "Sessões",
  sessoes_realizadas: "Sessões Realizadas",
  percentual: "Percentual (%)",
  percentual_comissao: "% Comissão",
  taxa_cartao: "Taxa do Cartão",
  ativo: "Ativo",
  pago: "Pago",
  comunidade: "Comunidade",
  conta_bancaria_id: "Conta Bancária",
  categoria_id: "Categoria",
  matricula_id: "Matrícula",
  duracao: "Duração",
  chave_pix: "Chave PIX",
  chave_pix_tipo: "Tipo da Chave PIX",
  banco: "Banco",
  agencia: "Agência",
  conta: "Conta",
  cnpj: "CNPJ",
  periodo_inicio: "Período Início",
  periodo_fim: "Período Fim",
  prioridade: "Prioridade",
  lida: "Lida",
};

const HIDDEN_FIELDS = ["id", "created_at", "updated_at", "deleted_at", "user_id", "autor_id", "_nomes"];

const UUID_FIELDS = [
  "produto_id", "turma_id", "aluno_id", "comercial_id", "profissional_id",
  "conta_bancaria_id", "categoria_id", "matricula_id", "responsavel_id",
  "lead_id", "processo_id", "despesa_id",
];

const PAGE_SIZE = 25;

type AuditLog = {
  id: string;
  user_id: string | null;
  user_nome: string | null;
  acao: string;
  tabela: string;
  registro_id: string | null;
  registro_nome: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  created_at: string;
};

// Extrai o mapa de nomes resolvidos do campo _nomes (injetado pelo trigger)
function getNomes(data: Record<string, unknown> | null): Record<string, string> {
  if (!data || !data._nomes) return {};
  return data._nomes as Record<string, string>;
}

// Formata valores para exibição legível
function formatValue(key: string, value: unknown, nomes: Record<string, string>): string {
  if (value === null || value === undefined) return "—";
  if (value === true) return "Sim";
  if (value === false) return "Não";

  const strVal = String(value);

  // UUID fields — check if we have a resolved name from the trigger
  if (UUID_FIELDS.includes(key) && typeof value === "string" && value.length === 36 && value.includes("-")) {
    const resolvedKey = `${key}__nome`;
    if (nomes[resolvedKey]) {
      return nomes[resolvedKey];
    }
    return `ref: ${value.substring(0, 8)}...`;
  }

  // Valores monetários
  if (key.startsWith("valor") || key === "desconto" || key === "taxa_cartao") {
    const num = Number(value);
    if (!isNaN(num)) return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }

  // Percentual
  if (key === "percentual" || key === "percentual_comissao") {
    return `${value}%`;
  }

  // Datas ISO
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(strVal)) {
    try {
      if (strVal.length === 10) {
        return format(new Date(strVal + "T12:00:00"), "dd/MM/yyyy");
      }
      return format(new Date(strVal), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return strVal;
    }
  }

  // Status
  if (key === "status") {
    const statusMap: Record<string, string> = {
      ativo: "Ativo", pago: "Pago", pendente: "Pendente", cancelado: "Cancelado",
      concluido: "Concluído", vencido: "Vencido", aberto: "Aberto",
      finalizado: "Finalizado", pausado: "Pausado",
    };
    return statusMap[strVal] || strVal;
  }

  if (key === "etapa") {
    const etapaMap: Record<string, string> = {
      lead: "Lead", contato: "Contato", negociacao: "Negociação",
      matricula: "Matrícula", perdido: "Perdido",
    };
    return etapaMap[strVal] || strVal;
  }

  if (key === "sexo") {
    const sexoMap: Record<string, string> = {
      masculino: "Masculino", feminino: "Feminino", outro: "Outro",
    };
    return sexoMap[strVal] || strVal;
  }

  if (key === "modalidade") {
    return strVal === "presencial" ? "Presencial" : strVal === "online" ? "Online" : strVal;
  }

  if (key === "tipo" && ["curso", "comunidade", "evento"].includes(strVal)) {
    return strVal.charAt(0).toUpperCase() + strVal.slice(1);
  }

  if (key === "forma_pagamento") {
    const formaMap: Record<string, string> = {
      pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão de Crédito",
      cartao_debito: "Cartão de Débito", transferencia: "Transferência",
      boleto: "Boleto", cheque: "Cheque", permuta: "Permuta",
      recorrencia_cartao: "Recorrência no Cartão",
    };
    return formaMap[strVal] || strVal;
  }

  return strVal;
}

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function Auditoria() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filtroTabela, setFiltroTabela] = useState("todas");
  const [filtroAcao, setFiltroAcao] = useState("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState("7");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", debouncedSearch, filtroTabela, filtroAcao, filtroPeriodo, page],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (filtroTabela !== "todas") query = query.eq("tabela", filtroTabela);
      if (filtroAcao !== "todas") query = query.eq("acao", filtroAcao);

      if (filtroPeriodo !== "todos") {
        const dias = parseInt(filtroPeriodo);
        query = query.gte("created_at", subDays(new Date(), dias).toISOString());
      }

      if (debouncedSearch) {
        query = query.or(`user_nome.ilike.%${debouncedSearch}%,registro_nome.ilike.%${debouncedSearch}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: (data ?? []) as AuditLog[], total: count ?? 0 };
    },
  });

  const logs = data?.logs ?? [];

  function getActionSummary(log: AuditLog): string {
    const tabela = TABELA_LABELS[log.tabela] || log.tabela;
    const nome = log.registro_nome || "";
    const acaoMap: Record<string, string> = {
      criar: `Cadastrou ${tabela.toLowerCase()}`,
      editar: `Editou ${tabela.toLowerCase()}`,
      excluir: `Excluiu ${tabela.toLowerCase()}`,
      pagar: `Registrou pagamento em ${tabela.toLowerCase()}`,
      avançar_etapa: `Avançou etapa em ${tabela.toLowerCase()}`,
      cancelar: `Cancelou ${tabela.toLowerCase()}`,
    };
    const acao = acaoMap[log.acao] || log.acao;
    return nome ? `${acao}: ${nome}` : acao;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoria" description="Registro de todas as ações no sistema" />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por usuário ou registro..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filtroTabela} onValueChange={(v) => { setFiltroTabela(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tabela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as tabelas</SelectItem>
            {TABELAS.map((t) => <SelectItem key={t} value={t}>{TABELA_LABELS[t] || t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroAcao} onValueChange={(v) => { setFiltroAcao(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas ações</SelectItem>
            {ACOES.map((a) => <SelectItem key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroPeriodo} onValueChange={(v) => { setFiltroPeriodo(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="todos">Todo período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum registro de auditoria encontrado.</p>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: "140px" }}>Data/Hora</TableHead>
                  <TableHead style={{ width: "130px" }}>Usuário</TableHead>
                  <TableHead style={{ width: "90px" }}>Ação</TableHead>
                  <TableHead>O que aconteceu</TableHead>
                  <TableHead style={{ width: "50px" }} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[130px]">{log.user_nome || "Sistema"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={ACAO_COLORS[log.acao] || ""}>{log.acao}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getActionSummary(log)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {Math.ceil((data?.total ?? 0) / PAGE_SIZE) > 1 && (
            <PaginationControls currentPage={page} totalItems={data?.total ?? 0} pageSize={PAGE_SIZE} onPageChange={setPage} />
          )}
        </>
      )}

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Auditoria</DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Usuário</span>
                  <p className="font-medium">{selectedLog.user_nome || "Sistema"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Ação</span>
                  <p><Badge variant="secondary" className={ACAO_COLORS[selectedLog.acao] || ""}>{selectedLog.acao}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Módulo</span>
                  <p className="font-medium">{TABELA_LABELS[selectedLog.tabela] || selectedLog.tabela}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Registro</span>
                  <p className="font-medium">{selectedLog.registro_nome || "—"}</p>
                </div>
              </div>

              {(selectedLog.dados_anteriores || selectedLog.dados_novos) && (
                <DiffView before={selectedLog.dados_anteriores} after={selectedLog.dados_novos} acao={selectedLog.acao} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiffView({ before, after, acao }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null; acao: string }) {
  const filterFields = (data: Record<string, unknown>) =>
    Object.entries(data).filter(([key]) => !HIDDEN_FIELDS.includes(key));

  // Get resolved names from the _nomes field injected by the trigger
  const nomes = getNomes(after) || getNomes(before) || {};

  if (acao === "criar" && after) {
    const fields = filterFields(after);
    return (
      <div>
        <h4 className="text-sm font-semibold mb-3 text-emerald-600">Dados do Cadastro</h4>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] text-xs">Campo</TableHead>
                <TableHead className="text-xs">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="text-xs font-medium text-muted-foreground py-2">{getFieldLabel(key)}</TableCell>
                  <TableCell className="text-xs py-2">{formatValue(key, value, nomes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (acao === "excluir" && before) {
    const fields = filterFields(before);
    return (
      <div>
        <h4 className="text-sm font-semibold mb-3 text-red-600">Dados Excluídos</h4>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] text-xs">Campo</TableHead>
                <TableHead className="text-xs">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="text-xs font-medium text-muted-foreground py-2">{getFieldLabel(key)}</TableCell>
                  <TableCell className="text-xs py-2">{formatValue(key, value, nomes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (before && after) {
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const changes = allKeys
      .filter((k) => !HIDDEN_FIELDS.includes(k))
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

    if (changes.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma alteração detectada.</p>;

    return (
      <div>
        <h4 className="text-sm font-semibold mb-3">Alterações ({changes.length} {changes.length === 1 ? "campo" : "campos"})</h4>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px] text-xs">Campo</TableHead>
                <TableHead className="text-xs">Antes</TableHead>
                <TableHead className="text-xs">Depois</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((key) => (
                <TableRow key={key}>
                  <TableCell className="text-xs font-medium text-muted-foreground py-2">{getFieldLabel(key)}</TableCell>
                  <TableCell className="text-xs py-2">
                    <span className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">
                      {formatValue(key, before[key], nomes)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                      {formatValue(key, after[key], nomes)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return null;
}
