import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  Panel,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Save, MessageSquare, GitBranch, Bot,
  UserCheck, Clock, CircleDot, Play, Loader2, Plus, Trash2, PanelLeftOpen, PanelLeftClose,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildEnumRoutes, validateFlowGraph } from "@/lib/fluxoValidation";

// ─── Types ───────────────────────────────────────────────────────────────────

type StartData    = { label: string; trigger: "message_received" | "keyword" | "outside_hours"; keywords: string };
type MessageData  = { label: string; text: string };
type OpcaoCondicao = { id: string; label: string; palavras: string };
type ConditionData = {
  label: string; pergunta?: string;
  field: "message" | "time" | "weekday"; operator: "contains" | "not_contains" | "equals" | "between";
  value?: string; no_value?: string; opcoes?: OpcaoCondicao[];
  sourceType?: "message" | "node_output" | "variable";
  sourceNodeId?: string; sourceField?: string; variableName?: string;
};
type StructuredFieldFE = { id: string; name: string; type: "text" | "enum"; required: boolean; options?: string[] };
type AIData = {
  label: string; model: string; prompt: string;
  structuredOutput?: { enabled: boolean; fields: StructuredFieldFE[] };
};
type AssignData   = { label: string; action: "queue" | "agent" };
type WaitData     = { label: string; value: number; unit: "s" | "min"; mode?: "timer" | "input"; save_to?: string };
type EndData      = { label: string };

// Cores hex para as opções de condição (usadas como inline style para evitar purge do Tailwind)
const OPCAO_CORES = ["#10b981","#f59e0b","#3b82f6","#8b5cf6","#f43f5e","#06b6d4","#f97316","#ec4899"];

// ─── Custom Nodes ─────────────────────────────────────────────────────────────

const base = "rounded-xl border-2 px-3 py-2 min-w-[160px] shadow-md text-xs font-semibold flex items-center gap-2 select-none";

function StartNode({ data, selected }: { data: StartData; selected?: boolean }) {
  return (
    <div className={cn(base, "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300", selected && "ring-2 ring-emerald-400 ring-offset-1")}>
      <Play className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[130px]">{data.label || "Início"}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function MessageNode({ data, selected }: { data: MessageData; selected?: boolean }) {
  const hasText = !!data.text?.trim();
  return (
    <div className={cn(
      "rounded-xl border-2 px-3 py-2 min-w-[160px] max-w-[220px] shadow-md text-xs select-none",
      "border-blue-500 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300",
      selected && "ring-2 ring-blue-400 ring-offset-1"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 font-semibold">
        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{data.label || "Mensagem"}</span>
      </div>
      {hasText && (
        <p className="mt-1.5 text-[10px] leading-snug text-blue-500 dark:text-blue-400 line-clamp-2 border-t border-blue-200 dark:border-blue-800 pt-1">
          {data.text}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function ConditionNode({ data, selected }: { data: ConditionData; selected?: boolean }) {
  const d = data as any;
  const hasPergunta = !!d.pergunta?.trim();
  const hasOpcoes = Array.isArray(d.opcoes) && d.opcoes.length > 0;
  const hasValue   = !!d.value?.trim();
  const hasNoValue = !!d.no_value?.trim();
  const opcoes: OpcaoCondicao[] = hasOpcoes ? d.opcoes : [];
  const n = opcoes.length;

  return (
    <div className={cn(
      "rounded-xl border-2 px-3 py-2 min-w-[180px] max-w-[230px] shadow-md text-xs select-none",
      "border-amber-500 bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300",
      "relative pb-7",
      selected && "ring-2 ring-amber-400 ring-offset-1"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />

      <div className="flex items-center gap-2 font-semibold">
        <GitBranch className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{d.label || "Condição"}</span>
      </div>

      {hasPergunta && (
        <p className="mt-1.5 text-[10px] leading-snug italic text-amber-600 dark:text-amber-400 line-clamp-2 border-t border-amber-200 dark:border-amber-800 pt-1">
          {d.pergunta}
        </p>
      )}

      {hasOpcoes ? (
        <div className="mt-1.5 space-y-0.5 border-t border-amber-200 dark:border-amber-800 pt-1">
          {opcoes.map((op, i) => (
            <div key={op.id} className="flex items-center gap-1 text-[10px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: OPCAO_CORES[i % OPCAO_CORES.length] }} />
              <span className="truncate font-medium" style={{ color: OPCAO_CORES[i % OPCAO_CORES.length] }}>{op.label}</span>
            </div>
          ))}
        </div>
      ) : (hasValue || hasNoValue) && (
        <div className="mt-1.5 space-y-0.5 border-t border-amber-200 dark:border-amber-800 pt-1">
          {hasValue && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate text-emerald-700 dark:text-emerald-400">{d.value}</span>
            </div>
          )}
          {hasNoValue && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="truncate text-rose-600 dark:text-rose-400">{d.no_value}</span>
            </div>
          )}
        </div>
      )}

      {/* Handles dinâmicos para múltiplas opções */}
      {hasOpcoes ? opcoes.map((op, i) => {
        const pct = Math.round((i + 1) * 100 / (n + 1));
        const cor = OPCAO_CORES[i % OPCAO_CORES.length];
        const shortLabel = op.label.length > 5 ? op.label.slice(0, 5) : op.label;
        return (
          <span key={op.id}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={op.id}
              style={{ left: `${pct}%`, background: cor, border: "2px solid white" }}
              className="!w-3 !h-3"
            />
            <span
              className="absolute bottom-1.5 text-[9px] font-bold"
              style={{ left: `${pct}%`, transform: "translateX(-50%)", color: cor }}
            >
              {shortLabel}
            </span>
          </span>
        );
      }) : (
        <>
          <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "28%" }} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white" />
          <Handle type="source" position={Position.Bottom} id="no"  style={{ left: "72%" }} className="!bg-rose-500 !w-3 !h-3 !border-2 !border-white" />
          <span className="absolute bottom-1.5 left-[18%] text-[10px] font-bold text-emerald-600">Sim</span>
          <span className="absolute bottom-1.5 left-[63%] text-[10px] font-bold text-rose-500">Não</span>
        </>
      )}
    </div>
  );
}

function AINode({ data, selected }: { data: AIData; selected?: boolean }) {
  return (
    <div className={cn(base, "border-violet-500 bg-violet-50 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300", selected && "ring-2 ring-violet-400 ring-offset-1")}>
      <Handle type="target" position={Position.Top} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
      <Bot className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[130px]">{data.label || "IA (Claude)"}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function AssignNode({ data, selected }: { data: AssignData; selected?: boolean }) {
  return (
    <div className={cn(base, "border-orange-500 bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300", selected && "ring-2 ring-orange-400 ring-offset-1")}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
      <UserCheck className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[130px]">{data.label || "Atribuir"}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function WaitNode({ data, selected }: { data: WaitData; selected?: boolean }) {
  return (
    <div className={cn(base, "border-slate-400 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300", selected && "ring-2 ring-slate-400 ring-offset-1")}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white" />
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[130px]">{data.label || `Aguardar ${data.value}${data.unit ?? "s"}`}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function EndNode({ data, selected }: { data: EndData; selected?: boolean }) {
  return (
    <div className={cn(base, "border-rose-500 bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300", selected && "ring-2 ring-rose-400 ring-offset-1")}>
      <Handle type="target" position={Position.Top} className="!bg-rose-500 !w-3 !h-3 !border-2 !border-white" />
      <CircleDot className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[130px]">{data.label || "Fim"}</span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode as any,
  message: MessageNode as any,
  condition: ConditionNode as any,
  ai: AINode as any,
  assign: AssignNode as any,
  wait: WaitNode as any,
  end: EndNode as any,
};

// ─── Toolbox ──────────────────────────────────────────────────────────────────

const TOOLBOX = [
  { type: "start",     label: "Início",      Icon: Play,         cls: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" },
  { type: "message",   label: "Mensagem",    Icon: MessageSquare,cls: "border-blue-400    bg-blue-50    dark:bg-blue-950/60    text-blue-700    dark:text-blue-300"    },
  { type: "condition", label: "Condição",    Icon: GitBranch,    cls: "border-amber-400  bg-amber-50   dark:bg-amber-950/60   text-amber-700   dark:text-amber-300"   },
  { type: "ai",        label: "IA (Claude)", Icon: Bot,          cls: "border-violet-400 bg-violet-50  dark:bg-violet-950/60  text-violet-700  dark:text-violet-300"  },
  { type: "assign",    label: "Atribuir",    Icon: UserCheck,    cls: "border-orange-400 bg-orange-50  dark:bg-orange-950/60  text-orange-700  dark:text-orange-300"  },
  { type: "wait",      label: "Aguardar",    Icon: Clock,        cls: "border-slate-400  bg-slate-50   dark:bg-slate-800/60   text-slate-600   dark:text-slate-300"   },
  { type: "end",       label: "Fim",         Icon: CircleDot,    cls: "border-rose-400   bg-rose-50    dark:bg-rose-950/60    text-rose-700    dark:text-rose-300"    },
];

function defaultData(type: string): Record<string, unknown> {
  switch (type) {
    case "start":     return { label: "Início",      trigger: "message_received", keywords: "" };
    case "message":   return { label: "Mensagem",    text: "" };
    case "condition": return { label: "Condição",    pergunta: "", field: "message", operator: "contains", value: "", no_value: "" };
    case "ai":        return { label: "IA (Claude)", model: "claude-haiku-4-5-20251001", prompt: "" };
    case "assign":    return { label: "Atribuir",    action: "queue" };
    case "wait":      return { label: "Aguardar 30s", value: 30, unit: "s" };
    case "end":       return { label: "Fim" };
    default:          return { label: type };
  }
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function NodeConfigPanel({ node, onUpdate }: { node: Node; onUpdate: (id: string, patch: Record<string, unknown>) => void }) {
  const d = node.data as any;
  const up = (patch: Record<string, unknown>) => onUpdate(node.id, patch);
  const { getNodes } = useReactFlow();

  const LabelField = (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Rótulo do nó</Label>
      <Input value={d.label ?? ""} onChange={(e) => up({ label: e.target.value })} className="h-8 text-sm" />
    </div>
  );

  if (node.type === "start") return (
    <div className="space-y-3">
      {LabelField}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Gatilho</Label>
        <Select value={d.trigger} onValueChange={(v) => up({ trigger: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent position="popper" className="z-[9999]">
            <SelectItem value="message_received">Qualquer mensagem recebida</SelectItem>
            <SelectItem value="keyword">Palavra-chave específica</SelectItem>
            <SelectItem value="outside_hours">Fora do horário comercial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {d.trigger === "keyword" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Palavras-chave (vírgula)</Label>
          <Input value={d.keywords ?? ""} onChange={(e) => up({ keywords: e.target.value })} className="h-8 text-sm" placeholder="oi, olá, ajuda" />
        </div>
      )}
    </div>
  );

  if (node.type === "message") return (
    <div className="space-y-3">
      {LabelField}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Texto da mensagem</Label>
        <Textarea value={d.text ?? ""} onChange={(e) => up({ text: e.target.value })} rows={5} className="text-sm resize-none" placeholder="Olá! Como posso ajudar?" />
        <p className="text-[11px] text-muted-foreground">
          Variáveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code> <code className="bg-muted px-1 rounded">{"{telefone}"}</code>
        </p>
      </div>
    </div>
  );

  if (node.type === "condition") {
    const sourceType = (d.sourceType as string) ?? "message";
    const hasOpcoes = Array.isArray(d.opcoes) && d.opcoes.length > 0;
    const opcoes: OpcaoCondicao[] = d.opcoes ?? [];

    // Nós AI com structured output ativo — para o seletor de fonte
    const aiNodes = getNodes().filter(n => n.type === "ai" && (n.data as any).structuredOutput?.enabled);
    const sourceAiNode = aiNodes.find(n => n.id === d.sourceNodeId);
    const sourceAiFields: StructuredFieldFE[] = (sourceAiNode?.data as any)?.structuredOutput?.fields ?? [];

    const addOpcao = () => {
      const nova: OpcaoCondicao = { id: `opt_${Date.now()}`, label: `Opção ${opcoes.length + 1}`, palavras: "" };
      up({ opcoes: [...opcoes, nova] });
    };
    const removeOpcao = (id: string) => up({ opcoes: opcoes.filter((o) => o.id !== id) });
    const updateOpcao = (id: string, patch: Partial<OpcaoCondicao>) =>
      up({ opcoes: opcoes.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
    const switchToOpcoes = () => up({
      opcoes: [
        { id: "opt_yes", label: "Sim", palavras: d.value ?? "" },
        { id: "opt_no",  label: "Não", palavras: d.no_value ?? "" },
      ],
      value: undefined, no_value: undefined,
    });

    // Bloco de opções reutilizado por todos os sourceTypes
    const OpoesBlock = (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {sourceType === "message" ? "Opções de resposta" : "Rotas (valor → rota)"}
        </Label>
        <p className="text-[11px] text-muted-foreground">
          {sourceType === "message"
            ? "Avaliadas em ordem. A última sem palavras = padrão."
            : "Coloque o valor exato nos campos. A última sem valor = padrão."}
        </p>
        {opcoes.map((op, i) => {
          const cor = OPCAO_CORES[i % OPCAO_CORES.length];
          return (
            <div key={op.id} className="rounded-md border p-2 space-y-1.5" style={{ borderColor: cor + "60" }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                <Input value={op.label} onChange={(e) => updateOpcao(op.id, { label: e.target.value })} className="h-7 text-xs flex-1" placeholder="Nome da rota" />
                {opcoes.length > 2 && (
                  <button type="button" onClick={() => removeOpcao(op.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Input
                value={op.palavras}
                onChange={(e) => updateOpcao(op.id, { palavras: e.target.value })}
                className="h-7 text-xs"
                placeholder={i === opcoes.length - 1
                  ? "Deixar vazio = padrão (qualquer valor)"
                  : sourceType === "message" ? "sim, 1, quero (vírgula)" : "VALOR_EXATO"}
              />
            </div>
          );
        })}
        <button type="button" onClick={addOpcao} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground border border-dashed rounded-md py-1.5 hover:border-amber-400 hover:text-amber-600 transition-colors">
          <Plus className="h-3 w-3" /> Adicionar rota
        </button>
      </div>
    );

    return (
      <div className="space-y-3">
        {LabelField}

        {/* Tipo de fonte */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">O que avaliar</Label>
          <Select value={sourceType} onValueChange={(v) => up({ sourceType: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" className="z-[9999]">
              <SelectItem value="message">Mensagem do usuário</SelectItem>
              <SelectItem value="node_output">Saída de um nó IA</SelectItem>
              <SelectItem value="variable">Variável do fluxo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <hr className="border-border" />

        {sourceType === "message" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pergunta do bot (opcional)</Label>
              <Textarea value={d.pergunta ?? ""} onChange={(e) => up({ pergunta: e.target.value })} rows={3} className="text-sm resize-none" placeholder="Ex: Como posso ajudar? Responda 1, 2 ou 3." />
              <p className="text-[11px] text-muted-foreground">Se preenchido, o bot envia e aguarda resposta antes de avaliar.</p>
            </div>
            <hr className="border-border" />
            {!hasOpcoes ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Campo avaliado</Label>
                  <Select value={d.field ?? "message"} onValueChange={(v) => up({ field: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]">
                      <SelectItem value="message">Conteúdo da mensagem</SelectItem>
                      <SelectItem value="time">Horário atual</SelectItem>
                      <SelectItem value="weekday">Dia da semana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Operador</Label>
                  <Select value={d.operator ?? "contains"} onValueChange={(v) => up({ operator: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]">
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="not_contains">Não contém</SelectItem>
                      <SelectItem value="equals">Igual a</SelectItem>
                      <SelectItem value="between">Entre (ex: 08:00-18:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <hr className="border-border" />
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Palavras para <span className="text-emerald-600">Sim</span>
                  </Label>
                  <Input value={d.value ?? ""} onChange={(e) => up({ value: e.target.value })} className="h-8 text-sm" placeholder={d.field === "time" ? "08:00-18:00" : "sim, 1, quero, aceito"} />
                  <p className="text-[11px] text-muted-foreground">Separe com vírgula. Basta uma coincidir.</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    Palavras para <span className="text-rose-500">Não</span>
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Input value={d.no_value ?? ""} onChange={(e) => up({ no_value: e.target.value })} className="h-8 text-sm" placeholder="não, 2, nope, cancelar" />
                </div>
                <button type="button" onClick={switchToOpcoes} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground border border-dashed rounded-md py-1.5 hover:border-amber-400 hover:text-amber-600 transition-colors">
                  <Plus className="h-3 w-3" /> Adicionar mais opções
                </button>
              </>
            ) : OpoesBlock}
          </>
        )}

        {sourceType === "node_output" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nó IA de origem</Label>
              {aiNodes.length === 0 ? (
                <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">Nenhum nó IA com saída estruturada ativa encontrado.</p>
              ) : (
                <Select
                  value={d.sourceNodeId ?? ""}
                  onValueChange={(v) => up({ sourceNodeId: v, sourceField: undefined, opcoes: [] })}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar nó" /></SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]">
                    {aiNodes.map(n => (
                      <SelectItem key={n.id} value={n.id}>{(n.data as any).label ?? n.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {d.sourceNodeId && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Campo da saída</Label>
                {sourceAiFields.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Nenhum campo configurado nesse nó.</p>
                ) : (
                  <Select
                    value={d.sourceField ?? ""}
                    onValueChange={(v) => {
                      const field = sourceAiFields.find((item) => item.name === v);
                      up({
                        sourceField: v,
                        opcoes: field?.type === "enum"
                          ? buildEnumRoutes(field.options ?? [])
                          : d.opcoes ?? [],
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecionar campo" /></SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]">
                      {sourceAiFields.map(f => (
                        <SelectItem key={f.id} value={f.name}>{f.name} ({f.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <hr className="border-border" />
            {OpoesBlock}
          </>
        )}

        {sourceType === "variable" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome da variável</Label>
              <Input value={d.variableName ?? ""} onChange={(e) => up({ variableName: e.target.value })} className="h-8 text-sm" placeholder="Ex: forma_pagamento" />
              <p className="text-[11px] text-muted-foreground">Nome da variável salva por um nó Aguardar (save_to).</p>
            </div>
            <hr className="border-border" />
            {OpoesBlock}
          </>
        )}
      </div>
    );
  }

  if (node.type === "ai") {
    const soCfg = d.structuredOutput as { enabled?: boolean; fields?: StructuredFieldFE[] } | undefined;
    const soEnabled = soCfg?.enabled ?? false;
    const soFields: StructuredFieldFE[] = soCfg?.fields ?? [];

    const upSO = (patch: Partial<{ enabled: boolean; fields: StructuredFieldFE[] }>) =>
      up({ structuredOutput: { ...(soCfg ?? {}), ...patch } });

    const addField = () => upSO({ fields: [...soFields, { id: `f_${Date.now()}`, name: "", type: "text", required: true }] });
    const removeField = (id: string) => upSO({ fields: soFields.filter(f => f.id !== id) });
    const updateField = (id: string, patch: Partial<StructuredFieldFE>) =>
      upSO({ fields: soFields.map(f => f.id === id ? { ...f, ...patch } : f) });

    return (
      <div className="space-y-3">
        {LabelField}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Modelo</Label>
          <Select value={d.model} onValueChange={(v) => up({ model: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent position="popper" className="z-[9999]">
              <SelectItem value="claude-haiku-4-5-20251001">Haiku 4.5 (rápido e econômico)</SelectItem>
              <SelectItem value="claude-sonnet-4-6">Sonnet 4.6 (mais inteligente)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Prompt do sistema</Label>
          <Textarea value={d.prompt ?? ""} onChange={(e) => up({ prompt: e.target.value })} rows={5} className="text-sm resize-none" placeholder="Você é um assistente virtual da empresa..." />
          <p className="text-[11px] text-muted-foreground">Variáveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code> <code className="bg-muted px-1 rounded">{"{telefone}"}</code></p>
        </div>

        <hr className="border-border" />

        {/* Saída estruturada */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-semibold">Saída estruturada</Label>
            <p className="text-[11px] text-muted-foreground">IA retorna JSON; só "message" vai ao WhatsApp</p>
          </div>
          <Switch checked={soEnabled} onCheckedChange={(v) => upSO({ enabled: v, fields: soFields })} />
        </div>

        {soEnabled && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded p-2">
              Configure os campos que a IA deve retornar além da mensagem. Os valores ficam disponíveis para nós Condição.
            </p>
            {soFields.map(f => (
              <div key={f.id} className="rounded-md border p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={f.name}
                    onChange={(e) => updateField(f.id, { name: e.target.value })}
                    className="h-7 text-xs flex-1"
                    placeholder="nome_campo (ex: status)"
                  />
                  <Select value={f.type} onValueChange={(v) => updateField(f.id, { type: v as "text" | "enum" })}>
                    <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]">
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="enum">Enum</SelectItem>
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => removeField(f.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {f.type === "enum" && (
                  <Input
                    value={(f.options ?? []).join(", ")}
                    onChange={(e) => updateField(f.id, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    className="h-7 text-xs"
                    placeholder="VALOR1, VALOR2, VALOR3"
                  />
                )}
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} className="h-3 w-3 rounded" />
                  Campo obrigatório (falha → ATENDIMENTO_HUMANO)
                </label>
              </div>
            ))}
            <button type="button" onClick={addField} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground border border-dashed rounded-md py-1.5 hover:border-primary hover:text-primary transition-colors">
              <Plus className="h-3 w-3" /> Adicionar campo
            </button>
          </div>
        )}
      </div>
    );
  }

  if (node.type === "assign") return (
    <div className="space-y-3">
      {LabelField}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Ação</Label>
        <Select value={d.action} onValueChange={(v) => up({ action: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent position="popper" className="z-[9999]">
            <SelectItem value="queue">Colocar na fila de atendimento</SelectItem>
            <SelectItem value="agent">Atribuir a agente específico</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (node.type === "wait") {
    const mode = d.mode ?? "timer";
    return (
      <div className="space-y-3">
        {LabelField}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Modo de espera</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => up({ mode: "timer", label: `Aguardar ${d.value ?? 30}${d.unit ?? "s"}` })}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors",
                mode === "timer"
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-input hover:bg-muted text-muted-foreground"
              )}
            >
              <Clock className="h-4 w-4" />
              Aguardar tempo
            </button>
            <button
              type="button"
              onClick={() => up({ mode: "input", label: "Aguardar resposta" })}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors",
                mode === "input"
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-input hover:bg-muted text-muted-foreground"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Aguardar resposta
            </button>
          </div>
        </div>

        {mode === "timer" && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tempo de espera</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={d.unit === "s" ? 3600 : d.unit === "min" ? 1440 : 72}
                value={d.value ?? 30}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value));
                  up({ value: v, label: `Aguardar ${v}${d.unit ?? "s"}` });
                }}
                className="h-8 text-sm w-24"
              />
              <Select
                value={d.unit ?? "s"}
                onValueChange={(u) => up({ unit: u, label: `Aguardar ${d.value ?? 30}${u}` })}
              >
                <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="z-[9999]">
                  <SelectItem value="s">Segundos</SelectItem>
                  <SelectItem value="min">Minutos</SelectItem>
                  <SelectItem value="h">Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {mode === "input" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
              O fluxo ficará pausado até a pessoa enviar qualquer mensagem. Só então avança para o próximo nó.
            </p>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Salvar resposta em</Label>
              <Select
                value={d.save_to ?? "none"}
                onValueChange={(v) => up({ save_to: v === "none" ? undefined : v })}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="z-[9999]">
                  <SelectItem value="none">Não salvar</SelectItem>
                  <SelectItem value="nome">Nome do lead</SelectItem>
                  <SelectItem value="email">E-mail do lead</SelectItem>
                  <SelectItem value="cidade">Cidade (variável {"{cidade}"})</SelectItem>
                  <SelectItem value="profissao">Profissão (variável {"{profissao}"})</SelectItem>
                </SelectContent>
              </Select>
              {d.save_to && (
                <p className="text-xs text-muted-foreground">
                  Use <code className="bg-muted px-1 rounded">{`{${d.save_to}}`}</code> nas mensagens seguintes para usar o valor salvo.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div className="space-y-3">{LabelField}</div>;
}

// ─── Editor Inner ─────────────────────────────────────────────────────────────

type Props = {
  fluxoId: string | null;
  onBack: () => void;
  empresaId: string;
};

function FluxoEditorInner({ fluxoId, onBack, empresaId }: Props) {
  const { screenToFlowPosition } = useReactFlow();

  const [nome, setNome] = useState("Novo Fluxo");
  const [ativo, setAtivo] = useState(true);
  const [canalIds, setCanalIds] = useState<string[]>([]);
  const [pastaFunilId, setPastaFunilId] = useState("");
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const nodeCounter = useRef(1);
  const [canais, setCanais] = useState<{ id: string; nome: string }[]>([]);
  const [pastasFunil, setPastasFunil] = useState<{ id: string; nome: string }[]>([]);
  const [toolboxOpen, setToolboxOpen] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : true);

  // RLS filtra pela empresa do usuário; mostra só canais WhatsApp ativos (suporte Evolution API)
  useEffect(() => {
    supabase
      .from("canais_crm")
      .select("id, nome")
      .eq("tipo", "whatsapp")
      .eq("ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (!error && data) setCanais(data as { id: string; nome: string }[]);
      });
  }, []);

  useEffect(() => {
    (supabase as any).from("funil_pastas").select("id, nome").eq("empresa_id", empresaId).is("deleted_at", null).order("ordem")
      .then(({ data, error }: any) => { if (!error && data) setPastasFunil(data); });
  }, [empresaId]);

  useEffect(() => {
    if (!fluxoId) return;
    supabase.from("fluxos_bot").select("*").eq("id", fluxoId).single().then(({ data }) => {
      if (!data) return;
      setNome(data.nome);
      setAtivo(data.ativo);
      setCanalIds(data.canal_ids ?? []);
      setPastaFunilId((data as any).pasta_funil_id ?? "");
      const fluxo = data.fluxo_json as any;
      if (fluxo?.nodes?.length) setNodes(fluxo.nodes);
      if (fluxo?.edges?.length) setEdges(fluxo.edges);
      const maxId = Math.max(0, ...(fluxo?.nodes ?? []).map((n: any) => parseInt(n.id.replace("n", "")) || 0));
      nodeCounter.current = maxId + 1;
    });
  }, [fluxoId]);

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) => addEdge({
      ...conn,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }, eds));
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  function updateNodeData(id: string, patch: Record<string, unknown>) {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...patch } } as Node : prev);
  }

  function onDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData("nodeType", type);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData("nodeType");
    if (!type) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = `n${nodeCounter.current++}`;
    setNodes((nds) => [...nds, { id, type, position, data: defaultData(type) }]);
  }

  async function salvar() {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    if (canalIds.length === 0) return toast.error("Selecione ao menos um canal");
    const graphErrors = validateFlowGraph(nodes, edges);
    if (graphErrors.length > 0) {
      return toast.error(graphErrors[0], {
        description: "Conecte todas as rotas antes de salvar o fluxo.",
      });
    }
    setSaving(true);
    try {
      const payload = {
        empresa_id: empresaId,
        nome,
        ativo,
        canal_ids: canalIds,
        pasta_funil_id: pastaFunilId || null,
        fluxo_json: { nodes, edges },
        updated_at: new Date().toISOString(),
      };
      if (fluxoId) {
        const { error } = await supabase.from("fluxos_bot").update(payload).eq("id", fluxoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fluxos_bot").insert(payload);
        if (error) throw error;
      }
      toast.success("Fluxo salvo!");
      onBack();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function toggleCanal(id: string) {
    setCanalIds((ids) => ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  }

  return createPortal(
    <div className="fixed inset-0 bg-background flex flex-col" style={{ zIndex: 9999 }}>
      {/* Top bar — mobile: 2 rows; desktop: 1 row */}
      <div className="border-b shrink-0 bg-card">
        {/* Linha principal */}
        <div className="h-12 flex items-center gap-2 px-3">
          <Button variant="ghost" size="sm" className="gap-1.5 shrink-0 px-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            title={toolboxOpen ? "Ocultar painel de nós" : "Mostrar painel de nós"}
            onClick={() => setToolboxOpen((v) => !v)}
          >
            {toolboxOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <div className="w-px h-6 bg-border shrink-0" />
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="flex-1 min-w-0 max-w-44 h-8 text-sm font-medium"
            placeholder="Nome do fluxo"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <span className="text-xs text-muted-foreground hidden sm:inline">{ativo ? "Ativo" : "Inativo"}</span>
          </div>
          <Button size="sm" onClick={salvar} disabled={saving} className="gap-1.5 ml-auto shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="hidden sm:inline">Salvar fluxo</span>
            <span className="sm:hidden">Salvar</span>
          </Button>
        </div>
        {/* Linha secundária: canais + CRM */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pb-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            CRM:
            <select value={pastaFunilId} onChange={(e) => setPastaFunilId(e.target.value)} className="h-7 max-w-44 rounded-md border border-input bg-background px-2 text-xs text-foreground">
              <option value="">Sem automação</option>
              {pastasFunil.map((pasta) => <option key={pasta.id} value={pasta.id}>{pasta.nome}</option>)}
            </select>
          </label>
          <div className="w-px h-4 bg-border shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Canais:</span>
          {canais.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleCanal(c.id)}
              className={cn(
                "px-2 py-0.5 rounded border text-xs font-medium transition-colors",
                canalIds.includes(c.id)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-muted"
              )}
            >{c.nome}</button>
          ))}
          {canais.length === 0 && <span className="text-xs text-muted-foreground italic">Nenhum canal</span>}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Toolbox */}
        {toolboxOpen && (
          <div className="w-40 shrink-0 border-r bg-card p-3 space-y-1.5 overflow-y-auto">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Nós</p>
            {TOOLBOX.map(({ type, label, Icon, cls }) => (
              <div
                key={type}
                draggable
                onDragStart={(e) => onDragStart(e, type)}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-semibold",
                  "cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none",
                  cls
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </div>
            ))}
            <div className="pt-3 border-t text-[10px] text-muted-foreground space-y-1">
              <p>• Arraste nós para o canvas</p>
              <p>• Conecte puxando as bolinhas</p>
              <p>• Clique num nó para configurar</p>
              <p>• Delete para remover selecionado</p>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          className="flex-1 min-w-0 min-h-0"
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            defaultEdgeOptions={{
              animated: false,
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              style: { stroke: "#94a3b8", strokeWidth: 2 },
            }}
          >
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-8 bg-card border rounded-xl px-6 py-4 text-sm text-muted-foreground text-center shadow-sm max-w-xs">
                  <p className="font-medium text-foreground mb-1">Canvas vazio</p>
                  <p>Arraste nós da coluna esquerda para começar a montar o fluxo.</p>
                  <p className="mt-2 text-xs">Comece pelo nó <strong>Início</strong> 🟢</p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Config panel */}
        {selectedNode && (
          <div className="w-64 shrink-0 border-l bg-card overflow-y-auto">
            <div className="p-3 border-b flex items-center justify-between">
              <p className="text-xs font-semibold">Configurar nó</p>
              <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <div className="p-3 space-y-3">
              <NodeConfigPanel node={selectedNode} onUpdate={updateNodeData} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function FluxoEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FluxoEditorInner {...props} />
    </ReactFlowProvider>
  );
}
