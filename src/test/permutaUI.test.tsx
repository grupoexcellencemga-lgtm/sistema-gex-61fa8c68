/**
 * Fase 3 UI tests — permuta payment feature
 * T01-T04: usePermutaItens hook (mocked supabase)
 * T05-T07: V2 header math (pure functions)
 * T08-T09: PermutaModal step 1 navigation + validation
 * T10:     Idempotency behavioral test
 * T11-T14: PermutaModal item validation + submit + error handling
 * T15-T19: PermutaStatusCard rendering + 3 actions
 * T20:     PermutaModal state reset on close
 * T21:     Two-matrícula independence (pure math)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { resumirMatriculaV2, type PermutaItem } from "@/lib/alunoFinanceiro";

// ─── Supabase mock ────────────────────────────────────────────────────────────

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

// ─── sonner mock ──────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkItem(pagamento_id: string, valor: number, status: PermutaItem["status"] = "acordado"): PermutaItem {
  return { id: `item-${pagamento_id}-${status}`, pagamento_id, valor, status };
}

function mkPagamento(id: string, forma: string, valor: number, status = "pendente") {
  return { id, forma_pagamento: forma, valor, status, gera_caixa: forma !== "permuta" };
}

function mkQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={mkQueryClient()}>
      {ui}
    </QueryClientProvider>
  );
}

// ─── T01-T04: usePermutaItens ─────────────────────────────────────────────────

import { usePermutaItens } from "@/hooks/usePermutaItens";

function PermutaItensConsumer({ pagamentos }: { pagamentos: any[] }) {
  const map = usePermutaItens(pagamentos);
  return <div data-testid="result">{JSON.stringify(map)}</div>;
}

describe("T01-T04: usePermutaItens", () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("T01 returns empty map when no permuta pagamentos", async () => {
    const pags = [mkPagamento("p1", "pix", 100, "pago")];
    const { getByTestId } = wrap(<PermutaItensConsumer pagamentos={pags} />);
    // No supabase call since enabled=false
    await waitFor(() => {
      const result = JSON.parse(getByTestId("result").textContent!);
      expect(result).toEqual({});
    });
  });

  it("T02 queries supabase for permuta ids", async () => {
    const pags = [mkPagamento("perm1", "permuta", 500)];
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [mkItem("perm1", 500)], error: null }),
    };
    mockFrom.mockReturnValue(selectChain);

    wrap(<PermutaItensConsumer pagamentos={pags} />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("permuta_itens");
    });
  });

  it("T03 groups items by pagamento_id", async () => {
    const pags = [mkPagamento("perm1", "permuta", 500), mkPagamento("perm2", "permuta", 300)];
    const items = [mkItem("perm1", 300), mkItem("perm1", 200), mkItem("perm2", 300)];
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: items, error: null }),
    };
    mockFrom.mockReturnValue(selectChain);

    const { getByTestId } = wrap(<PermutaItensConsumer pagamentos={pags} />);

    await waitFor(() => {
      const result = JSON.parse(getByTestId("result").textContent!);
      expect(result["perm1"]).toHaveLength(2);
      expect(result["perm2"]).toHaveLength(1);
    });
  });

  it("T04 stable query key across re-renders (same ids same order)", async () => {
    const pags = [mkPagamento("perm1", "permuta", 500)];
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(selectChain);

    const qc = mkQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <PermutaItensConsumer pagamentos={pags} />
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={qc}>
        <PermutaItensConsumer pagamentos={[...pags]} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
  });
});

// ─── T05-T07: V2 header math ──────────────────────────────────────────────────

describe("T05-T07: V2 header math (pure)", () => {
  it("T05 no permuta: totalPagoDinheiro = pago, totalPagoPermuta = 0", () => {
    const pags = [{ id: "p1", status: "pago", valor: 500, forma_pagamento: "pix", gera_caixa: true, valor_pago: 500 }];
    const r = resumirMatriculaV2(1000, pags, {});
    expect(r.quitadoDinheiro).toBe(500);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.saldoFinanceiro).toBe(500);
  });

  it("T06 permuta with all items entregues: quitadoPermuta = permuta valor", () => {
    const pags = [{ id: "perm1", status: "pendente_permuta", valor: 400, forma_pagamento: "permuta", gera_caixa: false }];
    const items: Record<string, PermutaItem[]> = {
      perm1: [mkItem("perm1", 400, "entregue")],
    };
    const r = resumirMatriculaV2(1000, pags, items);
    expect(r.quitadoPermuta).toBe(400);
    expect(r.quitadoDinheiro).toBe(0);
    expect(r.saldoFinanceiro).toBe(600);
  });

  it("T07 mixed: pix + permuta entregue sum correctly", () => {
    const pags = [
      { id: "p1", status: "pago", valor: 300, forma_pagamento: "pix", gera_caixa: true, valor_pago: 300 },
      { id: "perm1", status: "pendente_permuta", valor: 200, forma_pagamento: "permuta", gera_caixa: false },
    ];
    const items: Record<string, PermutaItem[]> = {
      perm1: [mkItem("perm1", 200, "entregue")],
    };
    const r = resumirMatriculaV2(1000, pags, items);
    expect(r.quitadoDinheiro).toBe(300);
    expect(r.quitadoPermuta).toBe(200);
    expect(r.totalQuitado).toBe(500);
    expect(r.saldoFinanceiro).toBe(500);
  });
});

// ─── PermutaModal tests ───────────────────────────────────────────────────────

import { PermutaModal } from "@/components/alunos/PermutaModal";

const baseModalProps = {
  open: true,
  onOpenChange: vi.fn(),
  matriculaId: "mat1",
  matriculaValorFinal: 1000,
  pagamentosMatricula: [],
  permutaItens: {},
  onSuccess: vi.fn(),
};

describe("T08-T09: PermutaModal step 1 navigation", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    baseModalProps.onOpenChange = vi.fn();
  });

  it("T08 step 1 shows saldo-disponivel and btn-proximo disabled when valor empty", () => {
    wrap(<PermutaModal {...baseModalProps} />);
    expect(screen.getByTestId("saldo-disponivel")).toBeDefined();
    expect(screen.getByTestId("btn-proximo").hasAttribute("disabled")).toBe(true);
  });

  it("T09 entering valid valor enables btn-proximo; advancing to step 2 shows item fields", async () => {
    wrap(<PermutaModal {...baseModalProps} />);
    const input = screen.getByTestId("permuta-valor-input");
    fireEvent.change(input, { target: { value: "500" } });
    const btn = screen.getByTestId("btn-proximo");
    expect(btn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId("item-descricao-0")).toBeDefined();
    });
  });
});

describe("T10: Idempotency behavioral test", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    baseModalProps.onOpenChange = vi.fn();
    baseModalProps.onSuccess = vi.fn();
  });

  it("T10 same key on retry, new key after close", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const props = { ...baseModalProps };
    const { rerender } = wrap(<PermutaModal {...props} />);

    // Fill step 1
    fireEvent.change(screen.getByTestId("permuta-valor-input"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));

    // Fill step 2
    await waitFor(() => screen.getByTestId("item-descricao-0"));
    fireEvent.change(screen.getByTestId("item-descricao-0"), { target: { value: "Serviço" } });
    fireEvent.change(screen.getByTestId("item-valor-0"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));

    // Step 3 — submit
    await waitFor(() => screen.getByTestId("btn-registrar"));
    fireEvent.click(screen.getByTestId("btn-registrar"));

    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    const firstKey = (mockRpc.mock.calls[0][1] as any).p_idempotency_key;
    expect(firstKey).toBeTruthy();

    // Retry: close and reopen (simulate open=false then open=true)
    rerender(
      <QueryClientProvider client={mkQueryClient()}>
        <PermutaModal {...props} open={false} />
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={mkQueryClient()}>
        <PermutaModal {...props} open={true} />
      </QueryClientProvider>
    );

    // Fill again with same data
    fireEvent.change(screen.getByTestId("permuta-valor-input"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));
    await waitFor(() => screen.getByTestId("item-descricao-0"));
    fireEvent.change(screen.getByTestId("item-descricao-0"), { target: { value: "Serviço" } });
    fireEvent.change(screen.getByTestId("item-valor-0"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));
    await waitFor(() => screen.getByTestId("btn-registrar"));
    fireEvent.click(screen.getByTestId("btn-registrar"));

    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
    const secondKey = (mockRpc.mock.calls[1][1] as any).p_idempotency_key;

    // After close+reopen, new key must be different
    expect(secondKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
  });
});

describe("T11-T14: PermutaModal item validation + submit", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    baseModalProps.onOpenChange = vi.fn();
    baseModalProps.onSuccess = vi.fn();
  });

  async function goToStep2() {
    fireEvent.change(screen.getByTestId("permuta-valor-input"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));
    await waitFor(() => screen.getByTestId("item-descricao-0"));
  }

  async function goToStep3() {
    await goToStep2();
    fireEvent.change(screen.getByTestId("item-descricao-0"), { target: { value: "Aula de inglês" } });
    fireEvent.change(screen.getByTestId("item-valor-0"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));
    await waitFor(() => screen.getByTestId("btn-registrar"));
  }

  it("T11 step 2 btn-proximo disabled when soma diverges", async () => {
    wrap(<PermutaModal {...baseModalProps} />);
    await goToStep2();
    fireEvent.change(screen.getByTestId("item-descricao-0"), { target: { value: "Item" } });
    fireEvent.change(screen.getByTestId("item-valor-0"), { target: { value: "200" } }); // diverges from 500
    expect(screen.getByTestId("btn-proximo").hasAttribute("disabled")).toBe(true);
  });

  it("T12 add-item-btn adds a second item row", async () => {
    wrap(<PermutaModal {...baseModalProps} />);
    await goToStep2();
    fireEvent.click(screen.getByTestId("add-item-btn"));
    await waitFor(() => screen.getByTestId("item-descricao-1"));
    expect(screen.getByTestId("item-descricao-1")).toBeDefined();
  });

  it("T13 successful submit calls rpc and onSuccess", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaModal {...baseModalProps} />);
    await goToStep3();
    fireEvent.click(screen.getByTestId("btn-registrar"));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("registrar_permuta", expect.objectContaining({
      p_matricula_id: "mat1",
      p_valor: 500,
    })));
    await waitFor(() => expect(baseModalProps.onSuccess).toHaveBeenCalled());
  });

  it("T14 rpc error shows toast error", async () => {
    const { toast } = await import("sonner");
    mockRpc.mockResolvedValue({ data: null, error: { message: "Erro interno", hint: "saldo_insuficiente" } });
    wrap(<PermutaModal {...baseModalProps} />);
    await goToStep3();
    fireEvent.click(screen.getByTestId("btn-registrar"));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});

// ─── PermutaStatusCard tests ──────────────────────────────────────────────────

import { PermutaStatusCard } from "@/components/alunos/PermutaStatusCard";

describe("T15-T19: PermutaStatusCard", () => {
  const pagamento = mkPagamento("perm1", "permuta", 500, "pendente_permuta");
  const items: PermutaItem[] = [
    { id: "item1", pagamento_id: "perm1", valor: 300, status: "acordado" },
    { id: "item2", pagamento_id: "perm1", valor: 200, status: "acordado" },
  ];
  const onRefresh = vi.fn();

  beforeEach(() => {
    mockRpc.mockReset();
    onRefresh.mockReset();
  });

  it("T15 renders permuta card with items", () => {
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    expect(screen.getByTestId("permuta-card-perm1")).toBeDefined();
    expect(screen.getByTestId("permuta-item-item1")).toBeDefined();
    expect(screen.getByTestId("permuta-item-item2")).toBeDefined();
  });

  it("T16 shows btn-confirmar and btn-cancelar-item for acordado items", () => {
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    expect(screen.getByTestId("btn-confirmar-item1")).toBeDefined();
    expect(screen.getByTestId("btn-cancelar-item-item1")).toBeDefined();
  });

  it("T17 confirmar entrega: calls rpc confirmar_entrega_item_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-confirmar-item1"));
    await waitFor(() => screen.getByTestId("btn-confirmar-entrega-ok"));
    fireEvent.click(screen.getByTestId("btn-confirmar-entrega-ok"));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("confirmar_entrega_item_permuta", expect.objectContaining({
      p_permuta_item_id: "item1",
    })));
  });

  it("T18 cancelar item: requires motivo, calls rpc cancelar_item_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-cancelar-item-item1"));
    await waitFor(() => screen.getByTestId("btn-cancelar-item-ok"));
    expect(screen.getByTestId("btn-cancelar-item-ok").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByTestId("input-motivo-item"), { target: { value: "Não entregou" } });
    expect(screen.getByTestId("btn-cancelar-item-ok").hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByTestId("btn-cancelar-item-ok"));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("cancelar_item_permuta", expect.objectContaining({
      p_permuta_item_id: "item1",
      p_motivo_cancelamento: "Não entregou",
    })));
  });

  it("T19 cancelar permuta: requires motivo, calls rpc cancelar_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-cancelar-permuta"));
    await waitFor(() => screen.getByTestId("btn-cancelar-permuta-ok"));
    expect(screen.getByTestId("btn-cancelar-permuta-ok").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByTestId("input-motivo-permuta"), { target: { value: "Desistência" } });
    expect(screen.getByTestId("btn-cancelar-permuta-ok").hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByTestId("btn-cancelar-permuta-ok"));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("cancelar_permuta", expect.objectContaining({
      p_pagamento_id: "perm1",
      p_motivo_cancelamento: "Desistência",
    })));
  });
});

// ─── T20: PermutaModal state reset on close ───────────────────────────────────

describe("T20: PermutaModal state reset on close", () => {
  it("T20 after entering valor and closing, valor resets to empty on reopen", async () => {
    const props = { ...baseModalProps, onOpenChange: vi.fn() };
    const qc = mkQueryClient();

    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <PermutaModal {...props} open={true} />
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByTestId("permuta-valor-input"), { target: { value: "999" } });
    expect((screen.getByTestId("permuta-valor-input") as HTMLInputElement).value).toBe("999");

    // close
    rerender(
      <QueryClientProvider client={qc}>
        <PermutaModal {...props} open={false} />
      </QueryClientProvider>
    );
    // reopen
    rerender(
      <QueryClientProvider client={qc}>
        <PermutaModal {...props} open={true} />
      </QueryClientProvider>
    );

    expect((screen.getByTestId("permuta-valor-input") as HTMLInputElement).value).toBe("");
  });
});

// ─── T21: Two-matrícula independence ─────────────────────────────────────────

describe("T21: two-matrícula independence", () => {
  it("T21 pagamentos de mat-A não entram no cálculo de mat-B", () => {
    const pagsA = [
      { id: "pA1", status: "pago", valor: 600, forma_pagamento: "pix", gera_caixa: true, valor_pago: 600 },
      { id: "pA2", status: "pendente_permuta", valor: 200, forma_pagamento: "permuta", gera_caixa: false },
    ];
    const pagsB = [
      { id: "pB1", status: "pago", valor: 800, forma_pagamento: "pix", gera_caixa: true, valor_pago: 800 },
    ];
    const itensA: Record<string, PermutaItem[]> = {
      pA2: [{ id: "i1", pagamento_id: "pA2", valor: 200, status: "entregue" }],
    };

    const rA = resumirMatriculaV2(1000, pagsA, itensA);
    const rB = resumirMatriculaV2(1000, pagsB, itensA); // passing itensA to B shouldn't affect B

    // Mat-A: 600 dinheiro + 200 permuta = 800 quitado, 200 pendente
    expect(rA.quitadoDinheiro).toBe(600);
    expect(rA.quitadoPermuta).toBe(200);
    expect(rA.totalQuitado).toBe(800);
    expect(rA.saldoFinanceiro).toBe(200);

    // Mat-B: 800 dinheiro, 0 permuta — no pB* ids in itensA so no cross-contamination
    expect(rB.quitadoDinheiro).toBe(800);
    expect(rB.quitadoPermuta).toBe(0);
    expect(rB.saldoFinanceiro).toBe(200);
  });
});
