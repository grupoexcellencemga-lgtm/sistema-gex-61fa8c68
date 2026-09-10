import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Bot, Clock, Loader2, Zap, Workflow, BookOpen, BarChart2, Users, Link2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FluxoEditor } from "./FluxoEditor";
import { FluxoSessoesPanel } from "./FluxoSessoesPanel";
import { FluxoRelatorioCard } from "./FluxoRelatorioCard";
import { BaseConhecimentoDialog } from "./BaseConhecimentoDialog";
import { BotIARelatorioCard } from "./BotIARelatorioCard";
import { BotLeadsRelatorioCard } from "./BotLeadsRelatorioCard";

type Canal = {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  identificador: string;
};

type AgenteBot = {
  id: string;
  nome: string;
  instrucao: string;
  modelo: string;
  ativo: boolean;
  ativo_24h: boolean;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
  tempo_espera_minutos: number;
  canais_ids: string[];
  max_mensagens_contexto: number;
  followup_ativo: boolean;
  followup_intervalo_horas: number;
  followup_max_tentativas: number;
  followup_mensagens: string[];
};

type FluxoBot = {
  id: string;
  nome: string;
  ativo: boolean;
  canal_ids: string[];
  created_at: string;
  palavra_chave: string | null;
};

const MODELOS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (rápido e econômico)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanceado)" },
];

const DIAS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const emptyAgente: Omit<AgenteBot, "id"> = {
  nome: "",
  instrucao: "",
  modelo: "claude-haiku-4-5-20251001",
  ativo: true,
  ativo_24h: false,
  horario_inicio: "08:00",
  horario_fim: "18:00",
  dias_semana: [1, 2, 3, 4, 5],
  tempo_espera_minutos: 5,
  canais_ids: [],
  max_mensagens_contexto: 20,
  followup_ativo: false,
  followup_intervalo_horas: 24,
  followup_max_tentativas: 3,
  followup_mensagens: [
    "Oi! Tudo bem? Ainda posso te ajudar com informações sobre nossos cursos 😊",
    "Oi! Só passando para ver se ainda tem interesse. Qualquer dúvida, estou aqui!",
    "Olá! Última mensagem da minha parte — se quiser saber mais no futuro, é só chamar. Até logo! 👋",
  ],
};

export function AgentesBotSection() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  // Agente IA dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgenteBot | null>(null);
  const [form, setForm] = useState<Omit<AgenteBot, "id">>(emptyAgente);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);


  // Fluxo editor: null = hidden, '' = new, uuid = editing
  const [editingFluxo, setEditingFluxo] = useState<string | null>(null);
  const [deleteFluxoId, setDeleteFluxoId] = useState<string | null>(null);

  // Base de Conhecimento
  const [baseConhecimentoAgente, setBaseConhecimentoAgente] = useState<AgenteBot | null>(null);

  // Configurar link (palavra_chave) do fluxo
  const [linkFluxo, setLinkFluxo] = useState<FluxoBot | null>(null);
  const [linkPalavra, setLinkPalavra] = useState("");
  const [copiado, setCopiado] = useState(false);

  const salvarPalavraChave = useMutation({
    mutationFn: async ({ id, palavra_chave }: { id: string; palavra_chave: string }) => {
      const { error } = await supabase
        .from("fluxos_bot")
        .update({ palavra_chave: palavra_chave.trim().toUpperCase() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fluxos-bot", empresaId] });
      toast.success("Link configurado!");
      setLinkFluxo(null);
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const { data: agentes = [], isLoading: loadingAgentes } = useQuery<AgenteBot[]>({
    queryKey: ["agentes-bot", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agentes_bot")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AgenteBot[];
    },
    enabled: !!empresaId,
  });

  const { data: fluxos = [], isLoading: loadingFluxos } = useQuery<FluxoBot[]>({
    queryKey: ["fluxos-bot", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxos_bot")
        .select("id, nome, ativo, canal_ids, created_at, palavra_chave")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FluxoBot[];
    },
    enabled: !!empresaId,
  });

  const { data: canais = [] } = useQuery<Canal[]>({
    queryKey: ["canais-crm-list-config", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("canais_crm")
        .select("id, nome, tipo, ativo, identificador")
        .eq("tipo", "whatsapp")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []) as Canal[];
    },
    enabled: !!empresaId,
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("agentes_bot")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agentes-bot", empresaId] }),
    onError: () => toast.error("Erro ao atualizar agente"),
  });

  const toggleFluxoAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("fluxos_bot")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fluxos-bot", empresaId] }),
    onError: () => toast.error("Erro ao atualizar fluxo"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agentes_bot").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agentes-bot", empresaId] });
      toast.success("Agente removido");
      setDeleteId(null);
    },
    onError: () => toast.error("Erro ao remover agente"),
  });

  const deleteFluxoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fluxos_bot").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fluxos-bot", empresaId] });
      toast.success("Fluxo removido");
      setDeleteFluxoId(null);
    },
    onError: () => toast.error("Erro ao remover fluxo"),
  });

  function openEdit(a: AgenteBot) {
    setEditing(a);
    setForm({
      nome: a.nome,
      instrucao: a.instrucao,
      modelo: a.modelo,
      ativo: a.ativo,
      ativo_24h: a.ativo_24h,
      horario_inicio: a.horario_inicio,
      horario_fim: a.horario_fim,
      dias_semana: a.dias_semana,
      tempo_espera_minutos: a.tempo_espera_minutos,
      canais_ids: a.canais_ids,
      max_mensagens_contexto: a.max_mensagens_contexto,
      followup_ativo: a.followup_ativo ?? false,
      followup_intervalo_horas: a.followup_intervalo_horas ?? 24,
      followup_max_tentativas: a.followup_max_tentativas ?? 3,
      followup_mensagens: a.followup_mensagens?.length ? a.followup_mensagens : emptyAgente.followup_mensagens,
    });
    setDialogOpen(true);
  }

  async function salvar() {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    if (!form.instrucao.trim()) return toast.error("Instrução do bot obrigatória");
    if (form.canais_ids.length === 0) return toast.error("Selecione ao menos um canal");
    setSaving(true);
    try {
      const payload = {
        ...form,
        empresa_id: empresaId,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from("agentes_bot").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Agente atualizado!");
      } else {
        const { error } = await supabase.from("agentes_bot").insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
        toast.success("Agente criado!");
      }
      queryClient.invalidateQueries({ queryKey: ["agentes-bot", empresaId] });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function toggleDia(dia: number) {
    setForm((f) => ({
      ...f,
      dias_semana: f.dias_semana.includes(dia)
        ? f.dias_semana.filter((d) => d !== dia)
        : [...f.dias_semana, dia],
    }));
  }

  function toggleCanal(id: string) {
    setForm((f) => ({
      ...f,
      canais_ids: f.canais_ids.includes(id)
        ? f.canais_ids.filter((c) => c !== id)
        : [...f.canais_ids, id],
    }));
  }

  const isLoadingAgentes = loadingAgentes;
  const isLoadingFluxos = loadingFluxos;

  // Full-screen FluxoEditor overlay
  if (editingFluxo !== null) {
    return (
      <FluxoEditor
        fluxoId={editingFluxo || null}
        empresaId={empresaId!}
        onBack={() => {
          setEditingFluxo(null);
          queryClient.invalidateQueries({ queryKey: ["fluxos-bot", empresaId] });
        }}
      />
    );
  }

  return (
    <>
      <Tabs defaultValue="agentes-ia" className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="agentes-ia" className="gap-1.5">
            <Bot className="h-4 w-4" />
            Agentes IA
          </TabsTrigger>
          <TabsTrigger value="bots-fluxo" className="gap-1.5">
            <Workflow className="h-4 w-4" />
            Bots com Fluxo
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart2 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-1.5">
            <Users className="h-4 w-4" />
            Leads atendidos
          </TabsTrigger>
        </TabsList>

        {/* ── Aba: Agentes IA ── */}
        <TabsContent value="agentes-ia" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Agentes IA
                  </CardTitle>
                  <CardDescription>
                    Bots com IA (Claude) que respondem automaticamente usando linguagem natural.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => { setEditing(null); setForm(emptyAgente); setDialogOpen(true); }}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Novo Agente IA
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingAgentes ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : agentes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <Bot className="h-10 w-10 mx-auto opacity-20" />
                  <p className="text-sm">Nenhum agente IA configurado.</p>
                  <p className="text-xs">Crie um agente para automatizar o atendimento com IA.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agentes.map((a) => (
                    <div key={a.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                      <div className={cn(
                        "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        a.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{a.nome}</p>
                          <Badge variant={a.ativo ? "default" : "secondary"} className="text-[10px]">
                            {a.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                            Agente IA
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {MODELOS.find(m => m.value === a.modelo)?.label.split(" ")[1] ?? a.modelo}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.instrucao}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {a.ativo_24h ? "24h" : `${a.horario_inicio}–${a.horario_fim}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Assume em {a.tempo_espera_minutos}min
                          </span>
                          {canais.filter(c => a.canais_ids.includes(c.id)).map(c => (
                            <Badge key={c.id} variant="outline" className="text-[10px] py-0">{c.nome}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={a.ativo}
                          onCheckedChange={(v) => toggleAtivo.mutate({ id: a.id, ativo: v })}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Base de Conhecimento"
                          onClick={() => setBaseConhecimentoAgente(a)}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Bots com Fluxo ── */}
        <TabsContent value="bots-fluxo" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    Bots com Fluxo
                  </CardTitle>
                  <CardDescription>
                    Fluxos visuais condicionais com mensagens e nós arrastáveis para atendimento automático.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setEditingFluxo("")}
                  size="sm"
                  className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                  Novo Fluxo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingFluxos ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : fluxos.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <Workflow className="h-10 w-10 mx-auto opacity-20" />
                  <p className="text-sm">Nenhum bot com fluxo configurado.</p>
                  <p className="text-xs">Crie um fluxo visual para automação condicional do atendimento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fluxos.map((f) => (
                    <div key={f.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                      <div className={cn(
                        "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        f.ativo ? "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400" : "bg-muted text-muted-foreground"
                      )}>
                        <Workflow className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{f.nome}</p>
                          <Badge variant={f.ativo ? "default" : "secondary"} className="text-[10px]">
                            {f.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-violet-400 text-violet-600 dark:text-violet-400">
                            Bot com Fluxo
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {canais.filter(c => (f.canal_ids ?? []).includes(c.id)).map(c => (
                            <Badge key={c.id} variant="outline" className="text-[10px] py-0">{c.nome}</Badge>
                          ))}
                          {(f.canal_ids ?? []).length === 0 && (
                            <span className="text-xs text-muted-foreground italic">Nenhum canal vinculado</span>
                          )}
                        </div>
                        {f.palavra_chave && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-mono">
                              wa.me/…?text={f.palavra_chave}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={f.ativo}
                          onCheckedChange={(v) => toggleFluxoAtivo.mutate({ id: f.id, ativo: v })}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Configurar link do site"
                          onClick={() => { setLinkFluxo(f); setLinkPalavra(f.palavra_chave ?? ""); setCopiado(false); }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingFluxo(f.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteFluxoId(f.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <FluxoSessoesPanel />
        </TabsContent>

        {/* ── Aba: Analytics ── */}
        <TabsContent value="analytics" className="space-y-6">
          <BotIARelatorioCard />
          <FluxoRelatorioCard />
        </TabsContent>

        {/* ── Aba: Leads atendidos ── */}
        <TabsContent value="leads">
          <BotLeadsRelatorioCard />
        </TabsContent>
      </Tabs>

      {/* Dialog criar/editar Agente IA */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Agente" : "Novo Agente IA"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>Nome do agente</Label>
              <Input
                placeholder="Ex: Atendente IA Excellence"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Instrução (prompt do sistema)</Label>
              <Textarea
                placeholder="Ex: Você é um assistente virtual da Grupo Excellence. Responda dúvidas sobre cursos e matrículas de forma educada e objetiva. Se não souber responder, diga que um atendente irá ajudar em breve."
                value={form.instrucao}
                onChange={(e) => setForm((f) => ({ ...f, instrucao: e.target.value }))}
                rows={18}
                className="resize-y font-mono text-xs leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Define o comportamento e personalidade do bot.</p>
                <p className="text-xs text-muted-foreground">{form.instrucao.length} caracteres</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Modelo de IA</Label>
              <Select value={form.modelo} onValueChange={(v) => setForm((f) => ({ ...f, modelo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Canais vinculados</Label>
              <p className="text-xs text-muted-foreground">O bot só atua em conversas dos canais selecionados.</p>
              {canais.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum canal WhatsApp ativo encontrado. Configure em Canais &amp; CRM.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {canais.map((c) => (
                    <label key={c.id} className={cn(
                      "flex items-center gap-2 p-2.5 rounded-md border cursor-pointer transition-colors",
                      form.canais_ids.includes(c.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}>
                      <Checkbox
                        checked={form.canais_ids.includes(c.id)}
                        onCheckedChange={() => toggleCanal(c.id)}
                      />
                      <span className="text-sm">{c.nome}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Tempo de espera antes de assumir</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={form.tempo_espera_minutos}
                  onChange={(e) => setForm((f) => ({ ...f, tempo_espera_minutos: Number(e.target.value) }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">minutos sem atendente humano</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Horário de funcionamento</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.ativo_24h}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, ativo_24h: v }))}
                  />
                  <span className="text-sm">24 horas</span>
                </div>
              </div>

              {!form.ativo_24h && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="time"
                        value={form.horario_inicio}
                        onChange={(e) => setForm((f) => ({ ...f, horario_inicio: e.target.value }))}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fim</Label>
                      <Input
                        type="time"
                        value={form.horario_fim}
                        onChange={(e) => setForm((f) => ({ ...f, horario_fim: e.target.value }))}
                        className="w-32"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Dias da semana</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {DIAS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDia(d.value)}
                          className={cn(
                            "px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                            form.dias_semana.includes(d.value)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input hover:bg-muted"
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Mensagens de contexto</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  max={50}
                  value={form.max_mensagens_contexto}
                  onChange={(e) => setForm((f) => ({ ...f, max_mensagens_contexto: Number(e.target.value) }))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">mensagens enviadas ao bot como histórico</span>
              </div>
            </div>

            <Separator />

            {/* ─── Follow-up ─── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Follow-up automático</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O bot analisa o contexto e decide se vale enviar uma mensagem de retorno ao lead silencioso.
                  </p>
                </div>
                <Switch
                  checked={form.followup_ativo}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, followup_ativo: v }))}
                />
              </div>

              {form.followup_ativo && (
                <div className="space-y-4 pl-1">
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Intervalo entre tentativas</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          value={form.followup_intervalo_horas}
                          onChange={(e) => setForm((f) => ({ ...f, followup_intervalo_horas: Number(e.target.value) }))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">horas</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Máximo de tentativas</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={form.followup_max_tentativas}
                          onChange={(e) => setForm((f) => ({ ...f, followup_max_tentativas: Number(e.target.value) }))}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">envios</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Tom de referência das mensagens</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            followup_mensagens: [...f.followup_mensagens, ""],
                          }))
                        }
                      >
                        + adicionar
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O Claude usa essas mensagens como referência de tom para gerar o follow-up contextualizado.
                    </p>
                    <div className="space-y-2">
                      {form.followup_mensagens.map((msg, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="mt-2 text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                          <Input
                            value={msg}
                            onChange={(e) =>
                              setForm((f) => {
                                const msgs = [...f.followup_mensagens];
                                msgs[i] = e.target.value;
                                return { ...f, followup_mensagens: msgs };
                              })
                            }
                            placeholder={`Mensagem de referência ${i + 1}`}
                            className="text-sm"
                          />
                          {form.followup_mensagens.length > 1 && (
                            <button
                              type="button"
                              className="mt-2 text-destructive hover:text-destructive/80 text-xs shrink-0"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  followup_mensagens: f.followup_mensagens.filter((_, j) => j !== i),
                                }))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar Agente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar delete Agente */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover agente?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Base de Conhecimento */}
      {baseConhecimentoAgente && (
        <BaseConhecimentoDialog
          open={!!baseConhecimentoAgente}
          onClose={() => setBaseConhecimentoAgente(null)}
          agenteId={baseConhecimentoAgente.id}
          agenteNome={baseConhecimentoAgente.nome}
        />
      )}

      {/* Configurar link wa.me do fluxo */}
      <Dialog open={!!linkFluxo} onOpenChange={(o) => { if (!o) setLinkFluxo(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link do site — {linkFluxo?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Palavra-chave (gatilho)</Label>
              <Input
                placeholder="Ex: CURSO, EVENTO, ORCAMENTO"
                value={linkPalavra}
                onChange={(e) => { setLinkPalavra(e.target.value.toUpperCase()); setCopiado(false); }}
              />
              <p className="text-xs text-muted-foreground">
                Quando o lead clicar no botão do site e enviar esta mensagem, este fluxo será iniciado automaticamente.
              </p>
            </div>

            {linkPalavra.trim() && (() => {
              const canal = canais.find(c => (linkFluxo?.canal_ids ?? []).includes(c.id));
              const numero = canal?.identificador?.replace(/\D/g, "") || "55449XXXXXXX";
              const link = `https://wa.me/${numero}?text=${encodeURIComponent(linkPalavra.trim())}`;
              return (
                <div className="space-y-1.5">
                  <Label>Link gerado</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted rounded px-3 py-2 break-all font-mono">
                      {link}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2000);
                      }}
                    >
                      {copiado ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cole este link no botão do seu site. Quando clicado, abre o WhatsApp com a mensagem "{linkPalavra.trim()}" pré-preenchida.
                  </p>
                  {!canal?.identificador && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠ Substitua <code>55449XXXXXXX</code> pelo número do WhatsApp do canal.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkFluxo(null)}>Cancelar</Button>
            <Button
              onClick={() => linkFluxo && salvarPalavraChave.mutate({ id: linkFluxo.id, palavra_chave: linkPalavra })}
              disabled={salvarPalavraChave.isPending}
            >
              {salvarPalavraChave.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar delete Fluxo */}
      <Dialog open={!!deleteFluxoId} onOpenChange={() => setDeleteFluxoId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover fluxo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFluxoId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteFluxoId && deleteFluxoMutation.mutate(deleteFluxoId)}
              disabled={deleteFluxoMutation.isPending}
            >
              {deleteFluxoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
