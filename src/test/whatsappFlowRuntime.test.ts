import { describe, expect, it } from "vitest";

import {
  attachMediaToLatestUserMessage,
  buildFlowOperationalContext,
  buildClaudeMessages,
  buildStructuredResponseTool,
  parseStructuredAiObject,
  parseStructuredAiOutput,
  resolveConditionRoute,
  shouldEnsureFunnelOpportunity,
  type ConversationRow,
  type StructuredField,
} from "../../supabase/functions/_shared/whatsapp-flow-runtime";

describe("WhatsApp flow runtime", () => {
  it("roteia oportunidade apenas quando uma sessão nova está ligada a uma pasta", () => {
    expect(shouldEnsureFunnelOpportunity(true, "pasta-opex")).toBe(true);
    expect(shouldEnsureFunnelOpportunity(false, "pasta-opex")).toBe(false);
    expect(shouldEnsureFunnelOpportunity(true, null)).toBe(false);
  });

  it("builds Claude history from the newest protocol messages and keeps the current message last", () => {
    const rows: ConversationRow[] = [
      { id: "current", direcao: "entrada", conteudo: "O link não deu certo", created_at: "2026-09-23T15:09:57Z" },
      { id: "link", direcao: "saida", conteudo: "Use este link: https://pagamento.test", created_at: "2026-09-23T15:09:30Z" },
      { id: "choice", direcao: "entrada", conteudo: "2", created_at: "2026-09-23T15:09:20Z" },
    ];

    expect(buildClaudeMessages(rows, {
      currentMessageId: "current",
      currentMessage: "O link não deu certo",
    })).toEqual([
      { role: "user", content: "2" },
      { role: "assistant", content: "Use este link: https://pagamento.test" },
      { role: "user", content: "O link não deu certo" },
    ]);
  });

  it("appends the inbound message when it is not yet present in the queried history", () => {
    const rows: ConversationRow[] = [
      { id: "answer", direcao: "saida", conteudo: "Envie o comprovante", created_at: "2026-09-23T15:09:30Z" },
    ];

    expect(buildClaudeMessages(rows, {
      currentMessageId: "current",
      currentMessage: "não está dando certo o link",
    })).toEqual([
      { role: "user", content: "Considere o histórico recente a seguir." },
      { role: "assistant", content: "Envie o comprovante" },
      { role: "user", content: "não está dando certo o link" },
    ]);
  });

  it("merges consecutive messages from the same role instead of dropping them", () => {
    const rows: ConversationRow[] = [
      { id: "2", direcao: "entrada", conteudo: "Ele mostra erro 404", created_at: "2026-09-23T15:10:00Z" },
      { id: "1", direcao: "entrada", conteudo: "O link não abre", created_at: "2026-09-23T15:09:59Z" },
    ];

    expect(buildClaudeMessages(rows, {
      currentMessageId: "2",
      currentMessage: "Ele mostra erro 404",
    })).toEqual([
      { role: "user", content: "O link não abre\n\nEle mostra erro 404" },
    ]);
  });

  it("attaches an image to the latest user message for Claude vision", () => {
    const messages = [{ role: "user" as const, content: "[Imagem]" }];

    expect(attachMediaToLatestUserMessage(messages, {
      base64: "aW1hZ2U=",
      mimeType: "image/jpeg",
      caption: "Comprovante",
    })).toBe(true);
    expect(messages[0].content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "aW1hZ2U=" } },
      { type: "text", text: "Comprovante" },
    ]);
  });

  it("attaches a PDF as a document block instead of a text placeholder", () => {
    const messages = [{ role: "user" as const, content: "[Documento]" }];

    expect(attachMediaToLatestUserMessage(messages, {
      base64: "cGRm",
      mimeType: "application/pdf",
      name: "comprovante.pdf",
    })).toBe(true);
    expect(messages[0].content).toEqual([
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: "cGRm" },
        title: "comprovante.pdf",
      },
      { type: "text", text: "comprovante.pdf" },
    ]);
  });

  it("accepts JSON inside a markdown fence and returns only validated fields", () => {
    const fields: StructuredField[] = [{
      name: "status",
      type: "enum",
      required: true,
      options: ["PROBLEMA_PAGAMENTO", "ATENDIMENTO_HUMANO"],
    }];

    expect(parseStructuredAiOutput(
      '```json\n{"message":"Vamos resolver.","status":"PROBLEMA_PAGAMENTO"}\n```',
      fields,
    )).toEqual({
      ok: true,
      output: { message: "Vamos resolver.", status: "PROBLEMA_PAGAMENTO" },
    });
  });

  it("builds a forced Claude tool with the configured enum values", () => {
    const fields: StructuredField[] = [{
      name: "status",
      type: "enum",
      required: true,
      options: ["PROBLEMA_PAGAMENTO", "ATENDIMENTO_HUMANO"],
    }];

    expect(buildStructuredResponseTool(fields)).toEqual({
      name: "structured_response",
      description: "Retorna a mensagem ao cliente e os campos internos do fluxo.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          message: { type: "string", description: "Texto que será enviado ao cliente." },
          status: { type: "string", enum: ["PROBLEMA_PAGAMENTO", "ATENDIMENTO_HUMANO"] },
        },
        required: ["message", "status"],
      },
    });
  });

  it("validates the object returned by the forced Claude tool", () => {
    const fields: StructuredField[] = [{
      name: "status",
      type: "enum",
      required: true,
      options: ["PROBLEMA_PAGAMENTO"],
    }];

    expect(parseStructuredAiObject({
      message: "Segue o link novamente: https://pagamento.test",
      status: "PROBLEMA_PAGAMENTO",
    }, fields)).toEqual({
      ok: true,
      output: {
        message: "Segue o link novamente: https://pagamento.test",
        status: "PROBLEMA_PAGAMENTO",
      },
    });
  });

  it("adds current flow links to the AI context and ignores placeholders", () => {
    expect(buildFlowOperationalContext([
      { type: "message", data: { text: "Pague em https://www.asaas.com/c/link-atual" } },
      { type: "message", data: { text: "[LINK DE PAGAMENTO]" } },
      { type: "condition", data: { pergunta: "https://nao-deve-entrar.test" } },
    ])).toBe(
      "[DADOS OPERACIONAIS ATUAIS DO FLUXO]\n" +
      "Links configurados: https://www.asaas.com/c/link-atual\n" +
      "Estes dados são atuais e têm prioridade sobre valores antigos do histórico. Reutilize-os quando o cliente pedir o reenvio.",
    );
  });

  it("rejects an unknown enum value instead of forwarding it to a condition", () => {
    const fields: StructuredField[] = [{
      name: "status",
      type: "enum",
      required: true,
      options: ["PROBLEMA_PAGAMENTO", "ATENDIMENTO_HUMANO"],
    }];

    expect(parseStructuredAiOutput(
      '{"message":"Pagamento confirmado.","status":"COMPROVANTE_RECEBIDO"}',
      fields,
    )).toEqual({
      ok: false,
      error: 'Campo "status" possui um valor não permitido',
    });
  });

  it("does not use the last condition route as an implicit fallback", () => {
    const options = [
      { id: "problem", palavras: "PROBLEMA_PAGAMENTO" },
      { id: "paid", palavras: "COMPROVANTE_RECEBIDO" },
    ];

    expect(resolveConditionRoute(options, "STATUS_INVENTADO", true)).toBeNull();
  });

  it("evaluates explicit routes before a catch-all route", () => {
    const options = [
      { id: "fallback", palavras: "" },
      { id: "problem", palavras: "PROBLEMA_PAGAMENTO" },
    ];

    expect(resolveConditionRoute(options, "PROBLEMA_PAGAMENTO", true)).toBe("problem");
    expect(resolveConditionRoute(options, "STATUS_INVENTADO", true)).toBe("fallback");
  });
});
