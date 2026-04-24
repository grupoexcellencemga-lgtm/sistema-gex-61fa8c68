import { Database } from "@/integrations/supabase/types";

// ─── Row types (direct from Supabase) ───
export type AlunoRow = Database["public"]["Tables"]["alunos"]["Row"];
export type MatriculaRow = Database["public"]["Tables"]["matriculas"]["Row"];
export type PagamentoRow = Database["public"]["Tables"]["pagamentos"]["Row"];
export type ComissaoRow = Database["public"]["Tables"]["comissoes"]["Row"];
export type ProcessoIndividualRow = Database["public"]["Tables"]["processos_individuais"]["Row"];
export type ProcessoEmpresarialRow = Database["public"]["Tables"]["processos_empresariais"]["Row"];
export type ProdutoRow = Database["public"]["Tables"]["produtos"]["Row"];
export type TurmaRow = Database["public"]["Tables"]["turmas"]["Row"];
export type ProfissionalRow = Database["public"]["Tables"]["profissionais"]["Row"];
export type ComercialRow = Database["public"]["Tables"]["comerciais"]["Row"];
export type ContaBancariaRow = Database["public"]["Tables"]["contas_bancarias"]["Row"];
export type DespesaRow = Database["public"]["Tables"]["despesas"]["Row"];
export type EventoRow = Database["public"]["Tables"]["eventos"]["Row"];
export type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
export type AtividadeRow = Database["public"]["Tables"]["atividades"]["Row"];
export type CategoriaDespesaRow = Database["public"]["Tables"]["categorias_despesas"]["Row"];
export type ContaPagarRow = Database["public"]["Tables"]["contas_a_pagar"]["Row"];
export type ReceitaAvulsaRow = Database["public"]["Tables"]["receitas_avulsas"]["Row"];
export type ReembolsoRow = Database["public"]["Tables"]["reembolsos"]["Row"];
export type PagamentoProcessoRow = Database["public"]["Tables"]["pagamentos_processo"]["Row"];
export type PagamentoProcessoEmpresarialRow = Database["public"]["Tables"]["pagamentos_processo_empresarial"]["Row"];
export type PagamentoProfissionalRow = Database["public"]["Tables"]["pagamentos_profissional"]["Row"];
export type ParticipanteEventoRow = Database["public"]["Tables"]["participantes_eventos"]["Row"];
export type EncontroRow = Database["public"]["Tables"]["encontros"]["Row"];
export type PresencaRow = Database["public"]["Tables"]["presencas"]["Row"];
export type FechamentoMensalRow = Database["public"]["Tables"]["fechamentos_mensais"]["Row"];
export type TransferenciaEntreContasRow = Database["public"]["Tables"]["transferencias_entre_contas"]["Row"];
export type MetaRow = Database["public"]["Tables"]["metas"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MindmapRow = Database["public"]["Tables"]["mindmaps"]["Row"];
export type InscricaoEventoRow = Database["public"]["Tables"]["inscricoes_eventos"]["Row"];

// ─── Insert types ───
export type AlunoInsert = Database["public"]["Tables"]["alunos"]["Insert"];
export type MatriculaInsert = Database["public"]["Tables"]["matriculas"]["Insert"];
export type PagamentoInsert = Database["public"]["Tables"]["pagamentos"]["Insert"];
export type ProcessoIndividualInsert = Database["public"]["Tables"]["processos_individuais"]["Insert"];
export type ProcessoEmpresarialInsert = Database["public"]["Tables"]["processos_empresariais"]["Insert"];

// ─── Update types ───
export type AlunoUpdate = Database["public"]["Tables"]["alunos"]["Update"];
export type ProcessoIndividualUpdate = Database["public"]["Tables"]["processos_individuais"]["Update"];
export type ProcessoEmpresarialUpdate = Database["public"]["Tables"]["processos_empresariais"]["Update"];

// ─── Composite / "with relations" types ───
export interface MatriculaWithRelations extends MatriculaRow {
  produtos?: ProdutoRow | null;
  turmas?: TurmaRow | null;
  alunos?: AlunoRow | null;
  comerciais?: ComercialRow | null;
}

export interface PagamentoWithRelations extends PagamentoRow {
  alunos?: AlunoRow | null;
  produtos?: ProdutoRow | null;
  matriculas?: MatriculaRow | null;
  contas_bancarias?: ContaBancariaRow | null;
}

export interface ComissaoWithRelations extends ComissaoRow {
  comerciais?: ComercialRow | null;
  alunos?: AlunoRow | null;
  produtos?: ProdutoRow | null;
  turmas?: TurmaRow | null;
  matriculas?: MatriculaRow | null;
  contas_bancarias?: ContaBancariaRow | null;
}

export interface DespesaWithRelations extends DespesaRow {
  categorias_despesas?: CategoriaDespesaRow | null;
  contas_bancarias?: ContaBancariaRow | null;
  turmas?: TurmaRow | null;
  produtos?: ProdutoRow | null;
  eventos?: EventoRow | null;
}

export interface ProcessoIndividualWithRelations extends ProcessoIndividualRow {
  profissionais?: ProfissionalRow | null;
  comerciais?: ComercialRow | null;
  contas_bancarias?: ContaBancariaRow | null;
  alunos?: AlunoRow | null;
}

export interface ProcessoEmpresarialWithRelations extends ProcessoEmpresarialRow {
  profissionais?: ProfissionalRow | null;
  comerciais?: ComercialRow | null;
  contas_bancarias?: ContaBancariaRow | null;
  alunos?: AlunoRow | null;
}

// ─── Additional composite types ───
export type TarefaRow = Database["public"]["Tables"]["tarefas"]["Row"];
export type TaxaSistemaRow = Database["public"]["Tables"]["taxas_sistema"]["Row"];
export type WhatsappTemplateRow = Database["public"]["Tables"]["whatsapp_templates"]["Row"];

export interface PagamentoWithFullRelations extends PagamentoRow {
  alunos?: Pick<AlunoRow, "nome"> | null;
  produtos?: Pick<ProdutoRow, "nome"> | null;
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
  matriculas?: (Pick<MatriculaRow, "turma_id"> & { turmas?: Pick<TurmaRow, "nome"> | null }) | null;
}

export interface PagamentoProcessoWithBank extends PagamentoProcessoRow {
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

export interface PagamentoProcessoEmpWithBank extends PagamentoProcessoEmpresarialRow {
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

export interface PagamentoProfissionalWithBank extends PagamentoProfissionalRow {
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

export interface EventoWithProduto extends EventoRow {
  produtos?: Pick<ProdutoRow, "nome"> | null;
}

export interface ParticipanteWithBank extends ParticipanteEventoRow {
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

export interface MatriculaWithAluno extends MatriculaRow {
  alunos?: Pick<AlunoRow, "nome"> | null;
}

export interface ReceitaAvulsaWithBank extends ReceitaAvulsaRow {
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

export interface ReembolsoWithRelations extends ReembolsoRow {
  categorias_despesas?: Pick<CategoriaDespesaRow, "nome"> | null;
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

export interface ContaPagarWithBank extends ContaPagarRow {
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

export interface ProcessoEmpWithBank extends ProcessoEmpresarialRow {
  contas_bancarias?: Pick<ContaBancariaRow, "nome"> | null;
}

// ─── Dashboard types ───
export interface DashboardMetrics {
  total_alunos_mes: number;
  total_matriculas_mes: number;
  receita_paga: number;
  receitas_avulsas: number;
  total_despesas: number;
  pagamentos_pendentes: number;
  pagamentos_vencidos: number;
  pagamentos_vencidos_count: number;
  comissoes_pendentes: number;
  processos_ativos: number;
  eventos_mes: number;
  matriculas_por_produto: { name: string; alunos: number }[];
  alunos_por_cidade: { name: string; value: number }[];
  despesas_por_categoria: { name: string; value: number }[];
  comissoes_por_vendedor: { name: string; pago: number; pendente: number }[];
  metas_ativas: MetaRow[];
}

// ─── Partial select types used in dropdowns ───
export type ProdutoSelect = Pick<ProdutoRow, "id" | "nome" | "valor">;
export type ComercialSelect = Pick<ComercialRow, "id" | "nome">;
export type TurmaSelect = Pick<TurmaRow, "id" | "nome" | "produto_id">;
export type ProfissionalSelect = Pick<ProfissionalRow, "id" | "nome">;
export type ProfileSelect = Pick<ProfileRow, "user_id" | "nome">;
