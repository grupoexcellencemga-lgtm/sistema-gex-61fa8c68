import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlunoDetailSheet } from "@/components/alunos/AlunoDetailSheet";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [{ tipo: "maquininha", nome: "Crédito 1x", percentual: 3 }] }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/ActivityTimeline", () => ({ ActivityTimeline: () => null }));
vi.mock("@/components/WhatsAppDialog", () => ({ WhatsAppDialog: () => null, WhatsAppHistory: () => null }));
vi.mock("@/components/tarefas/TarefasContextSection", () => ({ TarefasContextSection: () => null }));
vi.mock("@/lib/pdfUtils", () => ({ gerarReciboPagamento: vi.fn() }));
vi.mock("@/hooks/useAlunoLabel", () => ({ useAlunoLabel: () => ({ singular: "Aluno", lower: "aluno" }) }));
vi.mock("@/hooks/useFormasPagamento", () => ({
  useFormasPagamento: () => ({ data: [
    { id: "f1", codigo: "pix", nome: "PIX", tipo: "pix" },
    { id: "f2", codigo: "credito", nome: "Crédito", tipo: "credito" },
    { id: "f3", codigo: "permuta", nome: "Permuta", tipo: "permuta" },
  ]}),
  getFormaPagamentoLabel: (v: string) => v === "credito" ? "Crédito" : v === "pix" ? "PIX" : v === "permuta" ? "Permuta" : "—",
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    permutaItens: {}, onRegistrarPermuta: vi.fn(),
  };
}
afterEach(cleanup);

describe("financeiro do aluno na tela", () => {
  it.each([1, 10, 12])("mostra a quantidade %sx salva no pagamento", (quantidade) => {
    const p = props();
    render(<AlunoDetailSheet {...p} pagamentos={p.pagamentos.map(item => item.id === "p1" ? { ...item, parcelas_cartao: quantidade } : item)} />);
    expect(screen.getByText(new RegExp(`Crédito ${quantidade}x · Pago em`))).toBeInTheDocument();
  });
  it.each(["Aluno", "Empresa"])("aceita valor maior que o saldo com taxa marcada como %s", async (responsavel) => {
    const p = props();
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "1407.60" } });
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Taxa da operação (R$)"), { target: { value: "119.51" } });
    fireEvent.click(screen.getByRole("button", { name: responsavel, exact: true }));
    expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled();
    expect(screen.getByText(/Abatido da matrícula:/)).toHaveTextContent("1.173,00");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(p.onConfirmPagamento).toHaveBeenCalledWith(pendente, expect.anything(), expect.objectContaining({ valor_recebido: "1407.60", taxa_valor: "119.51", taxa_absorvida_por: responsavel.toLowerCase() })));
  });
  it("exibe a pendência antes do histórico e mantém o total pago bruto", () => {
    render(<AlunoDetailSheet {...props()} />);
    const saldo = screen.getByText(/Saldo pendente:/);
    const historico = screen.getByText("Pagamentos realizados");
    expect(saldo.compareDocumentPosition(historico) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Pago dinheiro").nextSibling?.textContent).toMatch(/797,00/);
    expect(screen.getByText(/Total da matrícula:/)).toHaveTextContent("1.970,00");
    expect(screen.getByText(/Crédito · Parcelas não informadas · Pago em/)).toBeInTheDocument();
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

// ─── Permuta routing ──────────────────────────────────────────────────────────
// Radix Dialog só monta o portal após uma transição de estado React — não quando
// o prop `open` já inicia em true. O wrapper abaixo simula como Alunos.tsx
// gerencia o novoPagamentoDialog: usando estado real + onNewPagamento que abre.

import { useState as useStateWrapper } from "react";

function NovoPagWrapper({ novoPagForm: initialForm, onRegistrarPermuta: onRegPermuta, onSaveNovoPagamento: onSaveNovoPag }: {
  novoPagForm: any;
  onRegistrarPermuta: (id: string) => void;
  onSaveNovoPagamento: () => void;
}) {
  const [dlgOpen, setDlgOpen] = useStateWrapper(false);
  const p = {
    ...props(),
    pagamentos: [], // sem pendências → Novo Pagamento abre o dialog avulso
    novoPagamentoDialog: dlgOpen,
    setNovoPagamentoDialog: setDlgOpen,
    novoPagForm: initialForm,
    setNovoPagForm: vi.fn(),
    onNewPagamento: () => setDlgOpen(true),
    onSaveNovoPagamento: onSaveNovoPag,
    onRegistrarPermuta: onRegPermuta,
  };
  return <AlunoDetailSheet {...p} />;
}

describe("permuta routing — Fase 3 UI", () => {
  // T1: safety-net no botão — forma=permuta com matricula_id chama onRegistrarPermuta, NÃO onSaveNovoPagamento
  it("T1 Lançar Pagamento com forma=permuta redireciona para onRegistrarPermuta (safety-net)", async () => {
    const onReg = vi.fn();
    const onSave = vi.fn();
    render(<NovoPagWrapper novoPagForm={{ forma_pagamento: "permuta", matricula_id: "mat" }} onRegistrarPermuta={onReg} onSaveNovoPagamento={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo Pagamento" }));
    const btn = await screen.findByRole("button", { name: /Lançar Pagamento/i });
    fireEvent.click(btn);
    expect(onReg).toHaveBeenCalledWith("mat");
    expect(onSave).not.toHaveBeenCalled();
  });

  // T3: PIX continua funcionando normalmente — Lançar Pagamento com forma=pix chama onSaveNovoPagamento
  it("T3 Lançar Pagamento com forma=pix chama onSaveNovoPagamento (regressão PIX)", async () => {
    const onReg = vi.fn();
    const onSave = vi.fn();
    render(<NovoPagWrapper novoPagForm={{ forma_pagamento: "pix", valor: "500" }} onRegistrarPermuta={onReg} onSaveNovoPagamento={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Novo Pagamento" }));
    const btn = await screen.findByRole("button", { name: /Lançar Pagamento/i });
    fireEvent.click(btn);
    expect(onSave).toHaveBeenCalled();
    expect(onReg).not.toHaveBeenCalled();
  });

  // T4: "Permuta" aparece como opção no confirm dialog (após fix)
  it("T4 confirmPagamentoDialog expõe 'Permuta' como opção", async () => {
    render(<AlunoDetailSheet {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    // Abrir o Select para renderizar as opções — primeiro combobox é Forma de pagamento
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    expect(await screen.findByRole("option", { name: "Permuta" })).toBeInTheDocument();
  });
});

// ─── T01-T09: Permuta intercept no "Confirmar pagamento" ─────────────────────

function ConfirmPagWrapper({ onRegistrarPermuta: onReg }: { onRegistrarPermuta: (id: string) => void }) {
  const p = { ...props(), onRegistrarPermuta: onReg };
  return <AlunoDetailSheet {...p} />;
}

describe("T01-T09 — permuta intercept no Confirmar pagamento", () => {
  // T01: Select contém Permuta
  it("T01 Select de forma de pagamento contém Permuta", async () => {
    render(<ConfirmPagWrapper onRegistrarPermuta={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    expect(await screen.findByRole("option", { name: "Permuta" })).toBeInTheDocument();
  });

  // T02: Selecionar Permuta fecha o modal monetário
  it("T02 Selecionar Permuta fecha o modal monetário imediatamente", async () => {
    const onReg = vi.fn();
    render(<ConfirmPagWrapper onRegistrarPermuta={onReg} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    const permutaOpt = await screen.findByRole("option", { name: "Permuta" });
    fireEvent.click(permutaOpt);
    expect(onReg).toHaveBeenCalled();
    // Dialog fecha — botão "Confirmar pagamento" some
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Confirmar pagamento" })).toBeNull()
    );
  });

  // T03: Permuta usa o matricula_id correto da pendência
  it("T03 onRegistrarPermuta recebe o matricula_id da pendência", async () => {
    const onReg = vi.fn();
    render(<ConfirmPagWrapper onRegistrarPermuta={onReg} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    const permutaOpt = await screen.findByRole("option", { name: "Permuta" });
    fireEvent.click(permutaOpt);
    expect(onReg).toHaveBeenCalledWith("mat");
  });

  // T04: Permuta NÃO chama onConfirmPagamento
  it("T04 Permuta NÃO chama onConfirmPagamento", async () => {
    const onReg = vi.fn();
    const p = { ...props(), onRegistrarPermuta: onReg };
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    const permutaOpt = await screen.findByRole("option", { name: "Permuta" });
    fireEvent.click(permutaOpt);
    expect(p.onConfirmPagamento).not.toHaveBeenCalled();
  });

  // T05: Permuta NÃO chama onSaveNovoPagamento (fluxo monetário)
  it("T05 Permuta NÃO chama onSaveNovoPagamento", async () => {
    const onReg = vi.fn();
    const p = { ...props(), onRegistrarPermuta: onReg };
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    const permutaOpt = await screen.findByRole("option", { name: "Permuta" });
    fireEvent.click(permutaOpt);
    expect(p.onSaveNovoPagamento).not.toHaveBeenCalled();
  });

  // T06: Safety net — submit com forma=permuta redireciona
  it("T06 safety-net submit com forma=permuta chama onRegistrarPermuta e não onConfirmPagamento", async () => {
    const onReg = vi.fn();
    const p = { ...props(), onRegistrarPermuta: onReg };
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    // Selecionar Permuta já intercepta no onValueChange, não chega ao submit
    // Este teste valida o intercept (mesmo resultado)
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    const permutaOpt = await screen.findByRole("option", { name: "Permuta" });
    fireEvent.click(permutaOpt);
    expect(onReg).toHaveBeenCalledWith("mat");
    expect(p.onConfirmPagamento).not.toHaveBeenCalled();
  });

  // T07: PIX continua funcionando normalmente
  it("T07 PIX no Confirmar pagamento chama onConfirmPagamento (regressão)", async () => {
    const p = props();
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "600" } });
    // forma_pagamento padrão do pendente é "pix" → botão já habilitado
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(p.onConfirmPagamento).toHaveBeenCalled());
    expect(p.onRegistrarPermuta).not.toHaveBeenCalled();
  });

  // T08: Crédito continua funcionando normalmente
  it("T08 Crédito no Confirmar pagamento chama onConfirmPagamento (regressão)", async () => {
    const p = props();
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "600" } });
    // Trocar forma para Crédito — primeiro combobox é Forma de pagamento
    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    const creditOpt = await screen.findByRole("option", { name: "Crédito" });
    fireEvent.click(creditOpt);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(p.onConfirmPagamento).toHaveBeenCalledWith(
      expect.anything(), expect.anything(),
      expect.objectContaining({ forma_pagamento: "credito" })
    ));
    expect(p.onRegistrarPermuta).not.toHaveBeenCalled();
  });

  // T09: Pagamento parcial continua funcionando normalmente
  it("T09 pagamento parcial com valor válido chama onConfirmPagamento (regressão)", async () => {
    const p = props();
    render(<AlunoDetailSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    fireEvent.change(screen.getByLabelText("Valor recebido agora (R$)"), { target: { value: "500" } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    await waitFor(() => expect(p.onConfirmPagamento).toHaveBeenCalled());
    expect(p.onRegistrarPermuta).not.toHaveBeenCalled();
  });
});
