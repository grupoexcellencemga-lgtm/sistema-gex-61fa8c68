import { describe, expect, it } from "vitest";

import {
  buildEnumRoutes,
  validateFlowGraph,
} from "@/lib/fluxoValidation";

describe("flow graph validation", () => {
  it("creates one stable condition route for every structured enum value", () => {
    expect(buildEnumRoutes([
      "COMPROVANTE_RECEBIDO",
      "AGUARDANDO_COMPROVANTE",
      "PROBLEMA_PAGAMENTO",
    ])).toEqual([
      { id: "status_comprovante_recebido", label: "COMPROVANTE_RECEBIDO", palavras: "COMPROVANTE_RECEBIDO" },
      { id: "status_aguardando_comprovante", label: "AGUARDANDO_COMPROVANTE", palavras: "AGUARDANDO_COMPROVANTE" },
      { id: "status_problema_pagamento", label: "PROBLEMA_PAGAMENTO", palavras: "PROBLEMA_PAGAMENTO" },
    ]);
  });

  it("rejects a node-output condition with no configured routes", () => {
    const errors = validateFlowGraph([
      {
        id: "ai",
        type: "ai",
        data: {
          structuredOutput: {
            enabled: true,
            fields: [{ id: "status", name: "status", type: "enum", required: true, options: ["PROBLEMA_PAGAMENTO"] }],
          },
        },
      },
      {
        id: "condition",
        type: "condition",
        data: { sourceType: "node_output", sourceNodeId: "ai", sourceField: "status" },
      },
    ], [{ id: "ai-condition", source: "ai", target: "condition" }]);

    expect(errors).toContain("A condição condition não possui rotas configuradas.");
  });

  it("rejects enum routes without an outgoing connection", () => {
    const nodes = [
      {
        id: "ai",
        type: "ai",
        data: {
          structuredOutput: {
            enabled: true,
            fields: [{ id: "status", name: "status", type: "enum", required: true, options: ["PROBLEMA_PAGAMENTO"] }],
          },
        },
      },
      {
        id: "condition",
        type: "condition",
        data: {
          sourceType: "node_output",
          sourceNodeId: "ai",
          sourceField: "status",
          opcoes: [{ id: "problem", label: "Problema", palavras: "PROBLEMA_PAGAMENTO" }],
        },
      },
    ];

    expect(validateFlowGraph(nodes, [{ id: "ai-condition", source: "ai", target: "condition" }]))
      .toContain('A rota "Problema" da condição condition não está conectada.');
  });
});
