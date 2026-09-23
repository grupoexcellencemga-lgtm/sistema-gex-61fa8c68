export type ConversationRow = {
  id: string;
  direcao: string;
  conteudo: string | null;
  created_at: string;
};

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: any;
};

export type StructuredField = {
  name: string;
  type: "text" | "enum";
  required?: boolean;
  options?: string[];
};

const CLAUDE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function attachMediaToLatestUserMessage(
  messages: ClaudeMessage[],
  media: {
    base64: string;
    mimeType: string;
    caption?: string | null;
    name?: string | null;
  },
): boolean {
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
  if (lastUserIndex < 0) return false;

  const currentContent = messages[lastUserIndex].content;
  const isPlaceholder = typeof currentContent === "string" && /^\[(?:mídia|midia|imagem|documento|arquivo)\]$/i.test(currentContent.trim());
  const textContent = typeof currentContent === "string" && !isPlaceholder
    ? currentContent
    : (media.caption ?? media.name ?? "Arquivo enviado");
  const mime = media.mimeType.toLowerCase();

  if (CLAUDE_IMAGE_MIME_TYPES.includes(mime)) {
    messages[lastUserIndex].content = [
      { type: "image", source: { type: "base64", media_type: mime, data: media.base64 } },
      { type: "text", text: textContent },
    ];
    return true;
  }

  if (mime === "application/pdf") {
    messages[lastUserIndex].content = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: media.base64 },
        title: media.name ?? "Documento enviado",
      },
      { type: "text", text: textContent },
    ];
    return true;
  }

  if (mime.startsWith("text/") || mime === "application/json") {
    const bytes = Uint8Array.from(atob(media.base64), (char) => char.charCodeAt(0));
    const documentText = new TextDecoder().decode(bytes).slice(0, 100_000);
    messages[lastUserIndex].content = `${textContent}\n\n[Conteúdo do arquivo]\n${documentText}`;
    return true;
  }

  return false;
}

export function buildClaudeMessages(
  rows: ConversationRow[],
  current: { currentMessageId?: string; currentMessage: string },
): ClaudeMessage[] {
  const chronological = [...rows]
    .filter((row) => typeof row.conteudo === "string" && row.conteudo.trim().length > 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const hasCurrent = current.currentMessageId
    ? chronological.some((row) => row.id === current.currentMessageId)
    : chronological.some((row) =>
        row.direcao !== "saida" && row.conteudo?.trim() === current.currentMessage.trim()
      );

  if (!hasCurrent && current.currentMessage.trim()) {
    chronological.push({
      id: current.currentMessageId ?? "__current__",
      direcao: "entrada",
      conteudo: current.currentMessage.trim(),
      created_at: new Date(8640000000000000).toISOString(),
    });
  }

  const messages: ClaudeMessage[] = [];
  for (const row of chronological) {
    const role: ClaudeMessage["role"] = row.direcao === "saida" ? "assistant" : "user";
    const content = row.conteudo!.trim();
    const previous = messages[messages.length - 1];
    if (previous?.role === role && typeof previous.content === "string") {
      previous.content = `${previous.content}\n\n${content}`;
    } else {
      messages.push({ role, content });
    }
  }

  if (messages[0]?.role === "assistant") {
    messages.unshift({ role: "user", content: "Considere o histórico recente a seguir." });
  }

  if (messages.length === 0 && current.currentMessage.trim()) {
    messages.push({ role: "user", content: current.currentMessage.trim() });
  }

  return messages;
}

export function parseStructuredAiOutput(
  rawText: string,
  fields: StructuredField[],
): { ok: true; output: Record<string, string> } | { ok: false; error: string } {
  const cleaned = rawText
    .replace(/\`\`\`json\s*/gi, "")
    .replace(/\`\`\`\s*/g, "")
    .trim();
  const jsonText = extractFirstJsonObject(cleaned);
  if (!jsonText) return { ok: false, error: "Resposta não contém um objeto JSON válido" };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "Resposta contém JSON inválido" };
  }

  if (typeof parsed.message !== "string" || !parsed.message.trim()) {
    return { ok: false, error: 'Campo "message" é obrigatório e deve ser texto' };
  }

  const output: Record<string, string> = { message: parsed.message.trim() };
  for (const field of fields) {
    const value = parsed[field.name];
    if (field.required && (typeof value !== "string" || !value.trim())) {
      return { ok: false, error: `Campo "${field.name}" é obrigatório e deve ser texto` };
    }
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") {
      return { ok: false, error: `Campo "${field.name}" deve ser texto` };
    }
    if (field.type === "enum" && field.options?.length && !field.options.includes(value)) {
      return { ok: false, error: `Campo "${field.name}" possui um valor não permitido` };
    }
    output[field.name] = value;
  }

  return { ok: true, output };
}

function extractFirstJsonObject(value: string): string | null {
  const start = value.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < value.length; i++) {
    const char = value[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return value.slice(start, i + 1);
  }
  return null;
}

export function resolveConditionRoute(
  options: Array<{ id: string; palavras?: string }>,
  subject: string,
  exactMatch = false,
): string | null {
  const normalizedSubject = subject.toLowerCase().trim();
  let catchAll: string | null = null;
  for (const option of options) {
    const words = (option.palavras ?? "")
      .split(",")
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean);
    if (words.length === 0) {
      catchAll ??= option.id;
      continue;
    }
    const matches = exactMatch
      ? words.some((word) => normalizedSubject === word)
      : words.some((word) => normalizedSubject.includes(word));
    if (matches) return option.id;
  }
  return catchAll;
}
