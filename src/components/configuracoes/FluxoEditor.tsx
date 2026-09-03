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
  UserCheck, Clock, CircleDot, Play, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type StartData    = { label: string; trigger: "message_received" | "keyword" | "outside_hours"; keywords: string };
type MessageData  = { label: string; text: string };
type ConditionData = { label: string; field: "message" | "time" | "weekday"; operator: "contains" | "not_contains" | "equals" | "between"; value: string };
type AIData       = { label: string; model: string; prompt: string };
type AssignData   = { label: string; action: "queue" | "agent" };
type WaitData     = { label: string; value: number; unit: "s" | "min" };
type EndData      = { label: string };

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
  return (
    <div className={cn(base, "border-blue-500 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300", selected && "ring-2 ring-blue-400 ring-offset-1")}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[130px]">{data.label || "Mensagem"}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  );
}

function ConditionNode({ data, selected }: { data: ConditionData; selected?: boolean }) {
  return (
    <div className={cn(base, "border-amber-500 bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 relative pb-6", selected && "ring-2 ring-amber-400 ring-offset-1")}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3 !border-2 !border-white" />
      <GitBranch className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[130px]">{data.label || "Condição"}</span>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "28%" }} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="no"  style={{ left: "72%" }} className="!bg-rose-500 !w-3 !h-3 !border-2 !border-white" />
      <span className="absolute bottom-1.5 left-[20%] text-[10px] font-bold text-emerald-600">Sim</span>
      <span className="absolute bottom-1.5 left-[64%] text-[10px] font-bold text-rose-500">Não</span>
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
    case "condition": return { label: "Condição",    field: "message", operator: "contains", value: "" };
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
          <SelectContent>
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
      </div>
    </div>
  );

  if (node.type === "condition") return (
    <div className="space-y-3">
      {LabelField}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Campo</Label>
        <Select value={d.field} onValueChange={(v) => up({ field: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="message">Conteúdo da mensagem</SelectItem>
            <SelectItem value="time">Horário atual</SelectItem>
            <SelectItem value="weekday">Dia da semana</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Operador</Label>
        <Select value={d.operator} onValueChange={(v) => up({ operator: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contains">Contém</SelectItem>
            <SelectItem value="not_contains">Não contém</SelectItem>
            <SelectItem value="equals">Igual a</SelectItem>
            <SelectItem value="between">Entre (ex: 08:00-18:00)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {d.field === "time" ? "Intervalo (ex: 08:00-18:00)" : "Palavras-chave"}
        </Label>
        <Input
          value={d.value ?? ""}
          onChange={(e) => up({ value: e.target.value })}
          className="h-8 text-sm"
          placeholder={d.field === "time" ? "08:00-18:00" : "preço, quanto custa, valor"}
        />
        {d.field === "message" && (
          <p className="text-[11px] text-muted-foreground">Separe múltiplas palavras com vírgula. Basta uma coincidir.</p>
        )}
      </div>
      <div className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground mb-1">Saídas:</p>
        <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Sim — condição verdadeira</p>
        <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Não — condição falsa</p>
      </div>
    </div>
  );

  if (node.type === "ai") return (
    <div className="space-y-3">
      {LabelField}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Modelo</Label>
        <Select value={d.model} onValueChange={(v) => up({ model: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="claude-haiku-4-5-20251001">Haiku 4.5 (rápido e econômico)</SelectItem>
            <SelectItem value="claude-sonnet-4-6">Sonnet 4.6 (mais inteligente)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Prompt do sistema</Label>
        <Textarea value={d.prompt ?? ""} onChange={(e) => up({ prompt: e.target.value })} rows={6} className="text-sm resize-none" placeholder="Você é um assistente virtual da empresa..." />
      </div>
    </div>
  );

  if (node.type === "assign") return (
    <div className="space-y-3">
      {LabelField}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Ação</Label>
        <Select value={d.action} onValueChange={(v) => up({ action: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="queue">Colocar na fila de atendimento</SelectItem>
            <SelectItem value="agent">Atribuir a agente específico</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (node.type === "wait") return (
    <div className="space-y-3">
      {LabelField}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Tempo de espera</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            max={d.unit === "s" ? 3600 : 1440}
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
            <SelectContent>
              <SelectItem value="s">Segundos</SelectItem>
              <SelectItem value="min">Minutos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

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
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const nodeCounter = useRef(1);
  const [canais, setCanais] = useState<{ id: string; nome: string }[]>([]);

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
    if (!fluxoId) return;
    supabase.from("fluxos_bot").select("*").eq("id", fluxoId).single().then(({ data }) => {
      if (!data) return;
      setNome(data.nome);
      setAtivo(data.ativo);
      setCanalIds(data.canal_ids ?? []);
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
    setSaving(true);
    try {
      const payload = {
        empresa_id: empresaId,
        nome,
        ativo,
        canal_ids: canalIds,
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
      {/* Top bar */}
      <div className="h-14 border-b flex items-center gap-3 px-4 shrink-0 bg-card">
        <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />Voltar
        </Button>
        <div className="w-px h-6 bg-border shrink-0" />
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-44 h-8 text-sm font-medium"
          placeholder="Nome do fluxo"
        />
        <div className="flex items-center gap-1.5">
          <Switch checked={ativo} onCheckedChange={setAtivo} />
          <span className="text-sm text-muted-foreground">{ativo ? "Ativo" : "Inativo"}</span>
        </div>
        <div className="w-px h-6 bg-border shrink-0" />
        <div className="flex items-center gap-1.5 flex-wrap">
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
          {canais.length === 0 && <span className="text-xs text-muted-foreground italic">Nenhum canal encontrado</span>}
        </div>
        <Button size="sm" onClick={salvar} disabled={saving} className="gap-1.5 ml-auto shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar fluxo
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Toolbox */}
        <div className="w-44 shrink-0 border-r bg-card p-3 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Arraste os nós</p>
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
