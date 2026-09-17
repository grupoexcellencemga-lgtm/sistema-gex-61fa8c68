import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlunoDetailSheet } from "@/components/alunos/AlunoDetailSheet";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [{ tipo: "maquininha", nome: "Crédito 1x", percentual: 3 }] }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/ActivityTimeline", () => ({ ActivityTimeline: () => null }));
vi.mock("@/components/WhatsAppDialog", () => ({ WhatsAppDialog: () => null, WhatsAppHistory: () => null }));
vi.mock("@/components/tarefas/TarefasContextSection", () => ({ TarefasContextSection: () => null }));
vi.mock("@/lib/pdfUtils", () => ({ gerarReciboPagamento: vi.fn() }));
vi.mock("@/hooks/useAlunoLabel", () => ({ useAlunoLabel: () => ({ singular: "Aluno", lower: "aluno" }) }));
vi.mock("@/hooks/useFormasPagamento", () => ({
  useFormasPagamento: () => ({ data: [{ codigo: "pix", nome: "PIX" }, { codigo: "credito", nome: "Crédito", tipo: "credito" }] }),
  getFormaPagamentoLabel: (v: string) => v === "credito" ? "Crédito" : v === "pix" ? "PIX" : "—",
}));

const pendente = { id: "saldo", matricula_id: "mat", status: "pendente", valor: 1173, forma_pagamento: "pix", data_vencimento: "2026-08-20" };
const pagamentos = [
  { id: "p2", matricula_id: "mat", status: "pago", valor: 600, forma_pagamento: "pix", data_pagamento: "2026-08-27" },
  pendente,
  { id: "p1", matricula_id: "mat", status: "pago", valor: 197, forma_pagamento: "credito", taxa_valor: 5.3, taxa_absorvida_por: "empresa", data_pagamento: "2026-08-18" },
];

function props() {
  return {
    open: true, onOpenChange: vi.fn(), selectedAluno: { id: "aluno", nome: "Aluno de teste" }, initialTab: "financeiro",
    matriculas: [{ id: "mat", valor_final: 1970, produtos: { nome: "Curso de teste" }, turmas: { nome: "Turma 02" }, status: "ativo" }],
    pagamentos, contasBancarias: [], onEdit: vi.fn(), onDeleteAluno: vi.fn(), deleteAlunoDialogOpen: false,
    setDeleteAlunoDialogOpen: vi.fn(), deleteAlunoMutation: {}, onNewMatricula: vi.fn(), onEditMatricula: vi.fn(), onDeleteMatricula: vi.fn(),
    onNewPagamento: vi.fn(), onConfirmPagamento: vi.fn().mockResolvedValue(undefined), onDesfazerPagamento: vi.fn(), onEditPagamento: vi.fn(), onDeletePagamento: vi.fn(),
    parcelasDetailOpen: false, setParcelasDetailOpen: vi.fn(), selectedParcelas: [], setSelectedParcelas: vi.fn(),
    editPagamentoDialog: false, setEditPagamentoDialog: vi.fn(), editPagForm: {}, setEditPagForm: vi.fn(), onSavePagamento: vi.fn(), updatePagamentoIsPending: false,
    novoPagamentoDialog: false, setNovoPagamentoDialog: vi.fn(), novoPagForm: {}, setNovoPagForm: vi.fn(), onSaveNovoPagamento: vi.fn(), insertPagamentoIsPending: false,
  };
}
afterEach(cleanup);

describe("financeiro do aluno na tela", () => {
  it.each(["Aluno", "Empresa"])("aceita valor maior que o saldo com taxa marcada como %s", async (responsavel) => {
    const p = props();
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "1407.60" } });
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Taxa da operação (R$)"), { target: { value: "234.60" } });
    fireEvent.click(screen.getByRole("button", { name: responsavel, exact: true }));
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled();
    expect(screen.getByText(/Abatido da matrícula:/)).toHaveTextContent("1.173,00");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(p.onConfirmPagamento).toHaveBeenCalledWith(pendente, expect.anything(), expect.objectContaining({ valor_recebido: "1407.60", taxa_valor: "234.60", taxa_absorvida_por: responsavel.toLowerCase() })));
  });
  it("exibe a pendência antes do histórico e mantém o total pago bruto", () => {
    render(<AlunoDetailSheet {...props()} />);
    const saldo = screen.getByText(/Saldo pendente:/);
    const historico = screen.getByText("Pagamentos realizados");
    expect(saldo.compareDocumentPosition(historico) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Pago pelo aluno").nextSibling?.textContent).toMatch(/797,00/);
    expect(screen.getByText(/Total da matrícula:/)).toHaveTextContent("1.970,00");
    expect(screen.getByText(/Crédito · Pago em/)).toBeInTheDocument();
    expect(screen.getByText(/PIX · Pago em/)).toBeInTheDocument();
  });

  it("Novo Pagamento abate a pendência existente em vez de abrir um lançamento avulso", async () => {
    const p = props();
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo Pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "600" } });
    expect(screen.getByText(/ficará pendente/)).toHaveTextContent("573,00");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(p.onConfirmPagamento).toHaveBeenCalledWith(pendente, expect.anything(), expect.objectContaining({ valor_recebido: "600", forma_pagamento: "pix" })));
    expect(p.onNewPagamento).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-1", "1174"])("impede confirmar um valor inválido: %s", (valor) => {
    render(<AlunoDetailSheet {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: valor } });
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeDisabled();
  });

  it("calcula a taxa sobre os R$ 600 recebidos, não sobre o saldo de R$ 1.173", () => {
    render(<AlunoDetailSheet {...props()} pagamentos={[{ ...pendente, forma_pagamento: "credito" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "600" } });
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();
  });

  it("preserva o formulário se a gravação falhar", async () => {
    const p = props();
    p.onConfirmPagamento.mockRejectedValue(new Error("Falha de rede"));
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(p.onConfirmPagamento).toHaveBeenCalled());
    expect(screen.getByLabelText("Valor recebido agora (R$)")).toHaveValue(600);
  });
});
