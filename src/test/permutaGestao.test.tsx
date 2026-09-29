/**
 * permutaGestao.test.ts — gestão completa de permutas
 * T01: PermutaModal 2 etapas — sem step 3, btn-registrar no step 2
 * T02: PermutaStatusCard mostra btn-editar-permuta e btn-excluir-permuta
 * T03: PermutaStatusCard mostra btn-editar-item para itens não-cancelados
 * T04: handleEditarPermuta chama editar_permuta RPC
 * T05: handleExcluirPermuta chama excluir_permuta RPC
 * T06: handleEditarItem chama editar_item_permuta RPC
 * T07: handleExcluirItem acordado chama excluir_item_permuta
 * T08: handleExcluirItem entregue mostra dialog e chama excluir_item_permuta
 * T09: excluir_permuta requer motivo
 * T10: editar_permuta salva observação
 * T11: editar_item permite modificar descrição e valor
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { PermutaItem } from "@/lib/alunoFinanceiro";

// ─── Supabase mock ────────────────────────────────────────────────────────────

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mockRpc, from: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={mkQueryClient()}>{ui}</QueryClientProvider>
  );
}

function mkPagamento(id: string, valor = 500, status = "pendente_permuta", observacao?: string) {
  return { id, forma_pagamento: "permuta", valor, status, gera_caixa: false, observacao };
}

function mkItem(
  id: string,
  pagamento_id: string,
  valor: number,
  status: PermutaItem["status"] = "acordado",
  tipo = "servico",
  descricao = "Item teste",
): any {
  return { id, pagamento_id, valor, status, tipo, descricao, observacao: null };
}

// ─── Imports ──────────────────────────────────────────────────────────────────

import { PermutaModal } from "@/components/alunos/PermutaModal";
import { PermutaStatusCard } from "@/components/alunos/PermutaStatusCard";

// ─── PermutaModal tests ───────────────────────────────────────────────────────

const baseModalProps = {
  open: true,
  onOpenChange: vi.fn(),
  matriculaId: "mat1",
  matriculaValorFinal: 1000,
  pagamentosMatricula: [],
  permutaItens: {},
  onSuccess: vi.fn(),
};

describe("T01: PermutaModal sem step 3", () => {
  beforeEach(() => mockRpc.mockReset());

  it("T01a step 2 tem btn-registrar 'Lançar permuta' e não btn-proximo", async () => {
    wrap(<PermutaModal {...baseModalProps} />);
    // Avança para step 2
    fireEvent.change(screen.getByTestId("permuta-valor-input"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));
    await waitFor(() => screen.getByTestId("item-descricao-0"));

    // btn-registrar existe no step 2
    expect(screen.getByTestId("btn-registrar")).toBeDefined();
    // btn-proximo não existe mais no step 2
    expect(screen.queryByTestId("btn-proximo")).toBeNull();
  });

  it("T01b btn-registrar no step 2 está desabilitado antes de preencher itens", async () => {
    wrap(<PermutaModal {...baseModalProps} />);
    fireEvent.change(screen.getByTestId("permuta-valor-input"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));
    await waitFor(() => screen.getByTestId("item-descricao-0"));
    expect(screen.getByTestId("btn-registrar").hasAttribute("disabled")).toBe(true);
  });

  it("T01c btn-registrar habilita após preencher item válido", async () => {
    wrap(<PermutaModal {...baseModalProps} />);
    fireEvent.change(screen.getByTestId("permuta-valor-input"), { target: { value: "500" } });
    fireEvent.click(screen.getByTestId("btn-proximo"));
    await waitFor(() => screen.getByTestId("item-descricao-0"));
    fireEvent.change(screen.getByTestId("item-descricao-0"), { target: { value: "Aula de inglês" } });
    fireEvent.change(screen.getByTestId("item-valor-0"), { target: { value: "500" } });
    await waitFor(() =>
      expect(screen.getByTestId("btn-registrar").hasAttribute("disabled")).toBe(false)
    );
  });
});

// ─── PermutaStatusCard tests ──────────────────────────────────────────────────

describe("T02-T11: PermutaStatusCard gestão", () => {
  const pagamento = mkPagamento("perm1", 500, "pendente_permuta", "Acordo verbal");
  const items = [
    mkItem("item1", "perm1", 300, "acordado"),
    mkItem("item2", "perm1", 200, "acordado"),
  ];
  const onRefresh = vi.fn();

  beforeEach(() => {
    mockRpc.mockReset();
    onRefresh.mockReset();
  });

  it("T02 mostra btn-editar-permuta e btn-excluir-permuta no cabeçalho", () => {
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    expect(screen.getByTestId("btn-editar-permuta")).toBeDefined();
    expect(screen.getByTestId("btn-excluir-permuta")).toBeDefined();
  });

  it("T03 mostra btn-editar-item para itens não-cancelados", () => {
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    expect(screen.getByTestId("btn-editar-item-item1")).toBeDefined();
    expect(screen.getByTestId("btn-editar-item-item2")).toBeDefined();
  });

  it("T03b mostra btn-editar-item para item entregue", () => {
    const comEntregue = [
      mkItem("item1", "perm1", 300, "acordado"),
      mkItem("item3", "perm1", 200, "entregue"),
    ];
    wrap(<PermutaStatusCard pagamento={pagamento} itens={comEntregue} onRefresh={onRefresh} />);
    expect(screen.getByTestId("btn-editar-item-item3")).toBeDefined();
    expect(screen.getByTestId("btn-cancelar-item-item3")).toBeDefined();
  });

  it("T04 editar permuta: abre dialog e chama editar_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-editar-permuta"));
    await waitFor(() => screen.getByTestId("input-editar-obs-permuta"));
    const input = screen.getByTestId("input-editar-obs-permuta") as HTMLInputElement;
    // Pre-fill com observação existente
    expect(input.value).toBe("Acordo verbal");
    fireEvent.change(input, { target: { value: "Novo acordo" } });
    fireEvent.click(screen.getByTestId("btn-editar-permuta-ok"));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("editar_permuta", expect.objectContaining({
        p_pagamento_id: "perm1",
        p_observacao: "Novo acordo",
      }))
    );
  });

  it("T05 excluir permuta: abre dialog e chama excluir_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-excluir-permuta"));
    await waitFor(() => screen.getByTestId("btn-excluir-permuta-ok"));
    fireEvent.change(screen.getByTestId("input-motivo-permuta"), { target: { value: "Cancelado" } });
    fireEvent.click(screen.getByTestId("btn-excluir-permuta-ok"));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("excluir_permuta", expect.objectContaining({
        p_pagamento_id: "perm1",
        p_motivo: "Cancelado",
      }))
    );
  });

  it("T06 editar item: abre dialog pré-preenchido e chama editar_item_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const itemComDados = [mkItem("item1", "perm1", 300, "acordado", "servico", "Inglês básico")];
    wrap(<PermutaStatusCard pagamento={pagamento} itens={itemComDados} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-editar-item-item1"));
    await waitFor(() => screen.getByTestId("input-editar-desc"));
    const descInput = screen.getByTestId("input-editar-desc") as HTMLInputElement;
    expect(descInput.value).toBe("Inglês básico");
    fireEvent.change(descInput, { target: { value: "Inglês avançado" } });
    fireEvent.change(screen.getByTestId("input-editar-valor"), { target: { value: "350" } });
    fireEvent.click(screen.getByTestId("btn-editar-item-ok"));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("editar_item_permuta", expect.objectContaining({
        p_item_id: "item1",
        p_tipo: "servico",
        p_descricao: "Inglês avançado",
        p_valor: 350,
      }))
    );
  });

  it("T07 excluir item acordado: abre dialog e chama excluir_item_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-cancelar-item-item1"));
    await waitFor(() => screen.getByTestId("btn-cancelar-item-ok"));
    fireEvent.change(screen.getByTestId("input-motivo-item"), { target: { value: "Desistiu" } });
    fireEvent.click(screen.getByTestId("btn-cancelar-item-ok"));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("excluir_item_permuta", expect.objectContaining({
        p_item_id: "item1",
        p_motivo: "Desistiu",
      }))
    );
  });

  it("T08 excluir item entregue: também abre dialog e chama excluir_item_permuta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const comEntregue = [mkItem("item3", "perm1", 200, "entregue")];
    wrap(<PermutaStatusCard pagamento={pagamento} itens={comEntregue} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-cancelar-item-item3"));
    await waitFor(() => screen.getByTestId("btn-cancelar-item-ok"));
    fireEvent.change(screen.getByTestId("input-motivo-item"), { target: { value: "Estorno solicitado" } });
    fireEvent.click(screen.getByTestId("btn-cancelar-item-ok"));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("excluir_item_permuta", expect.objectContaining({
        p_item_id: "item3",
        p_motivo: "Estorno solicitado",
      }))
    );
  });

  it("T09 excluir permuta requer motivo — btn-ok desabilitado sem motivo", async () => {
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-excluir-permuta"));
    await waitFor(() => screen.getByTestId("btn-excluir-permuta-ok"));
    expect(screen.getByTestId("btn-excluir-permuta-ok").hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByTestId("input-motivo-permuta"), { target: { value: "Motivo" } });
    expect(screen.getByTestId("btn-excluir-permuta-ok").hasAttribute("disabled")).toBe(false);
  });

  it("T10 editar_permuta chama onRefresh após sucesso", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-editar-permuta"));
    await waitFor(() => screen.getByTestId("btn-editar-permuta-ok"));
    fireEvent.click(screen.getByTestId("btn-editar-permuta-ok"));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it("T11 editar_item btn-ok desabilitado sem descrição", async () => {
    wrap(<PermutaStatusCard pagamento={pagamento} itens={items} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("btn-editar-item-item1"));
    await waitFor(() => screen.getByTestId("input-editar-desc"));
    fireEvent.change(screen.getByTestId("input-editar-desc"), { target: { value: "" } });
    expect(screen.getByTestId("btn-editar-item-ok").hasAttribute("disabled")).toBe(true);
  });
});
