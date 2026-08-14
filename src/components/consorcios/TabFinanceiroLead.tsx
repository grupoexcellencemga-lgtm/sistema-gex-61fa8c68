import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Plus, Check, Receipt, User, X, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsorcioLead } from "@/lib/consorcios";
import type { FunilEtapa } from "@/components/funil/funilUtils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contrato {
  id: string;
  lead_id: string;
  empresa_id: string;
  data_inicio: string;
  valor_credito: number;
  taxa_admin: number;
  prazo: number;
  valor_parcela: number;
  status: "ativo" | "encerrado" | "cancelado";
  responsavel_id: string | null;
  comissao_pct: number;
  comissao_valor: number | null;
  comissao_paga: boolean;
  comissao_data_pagamento: string | null;
  observacoes: string | null;
}

interface Parcela {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  status: "pendente" | "pago" | "vencido" | "cancelado";
  forma_pagamento: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FORMAS = [
  { id: "pix", label: "PIX" },
  { id: "boleto", label: "Boleto" },
  { id: "ted", label: "TED/DOC" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao_debito", label: "Débito" },
  { id: "cartao_credito", label: "Crédito" },
];

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

function fmtMes(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "").toUpperCase();
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function resolveStatus(p: Parcela, hoje: string): "pago" | "pendente" | "vencido" | "cancelado" {
  if (p.status === "pago" || p.status === "cancelado") return p.status;
  return p.data_vencimento < hoje ? "vencido" : "pendente";
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pago:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    pendente: "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400",
    vencido:  "bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400",
    cancelado:"bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400",
    ativo:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    encerrado:"bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400",
  };
  const lbl: Record<string, string> = {
    pago:"Pago", pendente:"Pendente", vencido:"Vencido",
    cancelado:"Cancelado", ativo:"Ativo", encerrado:"Encerrado",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", cls[status] ?? "bg-slate-100 text-slate-600")}>
      {lbl[status] ?? status}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type PFilter = "todas" | "pendente" | "vencido" | "pago";

export function TabFinanceiroLead({
  lead, etapa, comerciais, empresaId,
}: {
  lead: ConsorcioLead;
  etapa: FunilEtapa | undefined;
  comerciais: Array<{ id: string; nome: string }>;
  empresaId: string;
}) {
  const qc = useQueryClient();
  const isGanho = etapa?.tipo === "ganho";
  const hoje = new Date().toISOString().slice(0, 10);

  const [showForm, setShowForm] = useState(false);
  const [pFilter, setPFilter] = useState<PFilter>("todas");

  // Inline "receber parcela" state
  const [pagandoId, setPagandoId]   = useState<string | null>(null);
  const [pgData,    setPgData]      = useState(hoje);
  const [pgForma,   setPgForma]     = useState("pix");

  // ── Create-contract form ──
  const [form, setForm] = useState({
    data_inicio:    hoje,
    valor_credito:  lead.valor_credito?.toString() ?? "",
    taxa_admin:     "15",
    prazo:          lead.prazo?.toString() ?? "",
    responsavel_id: lead.responsavel_id ?? "",
    comissao_pct:   "30",
    observacoes:    "",
  });

  const credito     = parseFloat(form.valor_credito.replace(",", ".")) || 0;
  const taxa        = parseFloat(form.taxa_admin)   || 0;
  const prazo       = parseInt(form.prazo)          || 0;
  const comissaoPct = parseFloat(form.comissao_pct) || 0;
  const totalAdmin  = credito * (taxa / 100);
  const parcMensal  = prazo > 0 ? (credito + totalAdmin) / prazo : 0;
  const comissaoVal = totalAdmin * (comissaoPct / 100);

  // ── Queries ──
  const { data: contrato, isLoading: cLoading } = useQuery<Contrato | null>({
    queryKey: ["consorcio-contrato", lead.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("consorcios_contratos")
        .select("*")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as Contrato | null;
    },
    enabled: !!lead.id,
  });

  const { data: parcelas = [], isLoading: pLoading } = useQuery<Parcela[]>({
    queryKey: ["consorcio-parcelas", contrato?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("consorcios_parcelas")
        .select("*")
        .eq("contrato_id", contrato!.id)
        .order("numero_parcela", { ascending: true });
      if (error) throw error;
      return data as Parcela[];
    },
    enabled: !!contrato?.id,
  });

  const parcelasR = useMemo(() =>
    parcelas.map((p) => ({ ...p, status: resolveStatus(p, hoje) })),
  [parcelas, hoje]);

  const counts = useMemo(() => ({
    pago:     parcelasR.filter((p) => p.status === "pago").length,
    pendente: parcelasR.filter((p) => p.status === "pendente").length,
    vencido:  parcelasR.filter((p) => p.status === "vencido").length,
  }), [parcelasR]);

  const totalRecebido = useMemo(() =>
    parcelasR.filter((p) => p.status === "pago").reduce((s, p) => s + (p.valor_pago ?? p.valor), 0),
  [parcelasR]);

  const filtradas = useMemo(() =>
    pFilter === "todas" ? parcelasR : parcelasR.filter((p) => p.status === pFilter),
  [parcelasR, pFilter]);

  // ── Mutations ──
  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!credito || !prazo) throw new Error("Preencha crédito e prazo");
      const { data: c, error } = await (supabase as any)
        .from("consorcios_contratos")
        .insert({
          lead_id:       lead.id,
          empresa_id:    empresaId,
          data_inicio:   form.data_inicio,
          valor_credito: credito,
          taxa_admin:    taxa,
          prazo,
          valor_parcela: parcMensal,
          responsavel_id: form.responsavel_id || null,
          comissao_pct:  comissaoPct,
          comissao_valor: comissaoVal || null,
          observacoes:   form.observacoes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const parcs = Array.from({ length: prazo }, (_, i) => ({
        contrato_id:    c.id,
        lead_id:        lead.id,
        empresa_id:     empresaId,
        numero_parcela: i + 1,
        valor:          parcMensal,
        data_vencimento: addMonths(form.data_inicio, i + 1),
        status:         "pendente",
      }));
      const { error: pErr } = await (supabase as any).from("consorcios_parcelas").insert(parcs);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcio-contrato", lead.id] });
      qc.invalidateQueries({ queryKey: ["consorcios-contratos-all"] });
      setShowForm(false);
      toast.success("Contrato criado e parcelas geradas");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const receberMutation = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await (supabase as any)
        .from("consorcios_parcelas")
        .update({ status: "pago", data_pagamento: pgData, forma_pagamento: pgForma, valor_pago: valor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcio-parcelas", contrato?.id] });
      qc.invalidateQueries({ queryKey: ["consorcios-contratos-all"] });
      setPagandoId(null);
      toast.success("Pagamento registrado");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const comissaoMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("consorcios_contratos")
        .update({ comissao_paga: true, comissao_data_pagamento: hoje })
        .eq("id", contrato!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcio-contrato", lead.id] });
      qc.invalidateQueries({ queryKey: ["consorcios-contratos-all"] });
      toast.success("Comissão marcada como paga");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // ── Loading ──
  if (cLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── No contract — form ──
  if (!contrato && showForm) {
    return (
      <div className="px-5 py-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Registrar Contrato</h3>
          <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Data início</Label>
            <Input type="date" className="h-8 text-xs" value={form.data_inicio}
              onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Crédito (R$)</Label>
            <Input className="h-8 text-xs" placeholder="200000" value={form.valor_credito}
              onChange={(e) => setForm((f) => ({ ...f, valor_credito: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Taxa admin (%)</Label>
            <Input className="h-8 text-xs" placeholder="15" value={form.taxa_admin}
              onChange={(e) => setForm((f) => ({ ...f, taxa_admin: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prazo (meses)</Label>
            <Input className="h-8 text-xs" placeholder="60" value={form.prazo}
              onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} />
          </div>
        </div>

        {parcMensal > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-muted-foreground">Taxa total</div>
              <div className="text-sm font-semibold">{fmtBRL(totalAdmin)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Parcela mensal</div>
              <div className="text-sm font-bold text-primary">{fmtBRL(parcMensal)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Total do contrato</div>
              <div className="text-sm font-semibold">{fmtBRL(credito + totalAdmin)}</div>
            </div>
          </div>
        )}

        <div className="border-t pt-3 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comissão</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <Select value={form.responsavel_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v === "none" ? "" : v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {comerciais.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comissão (% da taxa)</Label>
              <Input className="h-8 text-xs" placeholder="30" value={form.comissao_pct}
                onChange={(e) => setForm((f) => ({ ...f, comissao_pct: e.target.value }))} />
            </div>
          </div>
          {comissaoVal > 0 && (
            <p className="text-xs text-muted-foreground">
              Comissão total: <span className="font-semibold text-foreground">{fmtBRL(comissaoVal)}</span>
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          <Button size="sm" disabled={criarMutation.isPending || !credito || !prazo}
            onClick={() => criarMutation.mutate()}>
            {criarMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Criar e gerar {prazo || "?"} parcelas
          </Button>
        </div>
      </div>
    );
  }

  // ── No contract — empty state ──
  if (!contrato) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
        <Receipt className="h-10 w-10 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
        {isGanho ? (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Registrar Contrato
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground/70">
            Disponível quando o lead estiver em uma etapa <strong>Ganho</strong>.
          </p>
        )}
      </div>
    );
  }

  // ── Contract view ──
  const responsavelNome = comerciais.find((c) => c.id === contrato.responsavel_id)?.nome;
  const pct = parcelas.length > 0 ? (counts.pago / parcelas.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Contrato */}
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contrato</span>
            <StatusBadge status={contrato.status} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <div className="text-[10px] text-muted-foreground">Crédito</div>
              <div className="font-semibold">{fmtBRL(contrato.valor_credito)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Taxa admin ({contrato.taxa_admin}%)</div>
              <div className="font-semibold">{fmtBRL(contrato.valor_credito * (contrato.taxa_admin / 100))}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Prazo</div>
              <div className="font-semibold">{contrato.prazo} meses</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Parcela mensal</div>
              <div className="font-bold text-primary">{fmtBRL(contrato.valor_parcela)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Início</div>
              <div className="font-semibold">{fmtDate(contrato.data_inicio)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Recebido</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRL(totalRecebido)}</div>
            </div>
          </div>
          {parcelas.length > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{counts.pago}/{parcelas.length} parcelas pagas</span>
                <span>{Math.round(pct)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Comissão */}
        {(contrato.comissao_valor ?? 0) > 0 && (
          <div className={cn(
            "rounded-xl border p-4 space-y-2",
            contrato.comissao_paga
              ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
              : "bg-muted/20"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comissão</span>
              {contrato.comissao_paga
                ? <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><Check className="h-3 w-3" />Paga</span>
                : <StatusBadge status="pendente" />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {responsavelNome && (
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{responsavelNome}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-0.5">
                  {contrato.comissao_pct}% da taxa ={" "}
                  <span className="font-semibold text-foreground">{fmtBRL(contrato.comissao_valor!)}</span>
                </div>
                {contrato.comissao_paga && contrato.comissao_data_pagamento && (
                  <div className="text-[10px] text-emerald-600 mt-0.5">
                    Paga em {fmtDate(contrato.comissao_data_pagamento)}
                  </div>
                )}
              </div>
              {!contrato.comissao_paga && (
                <Button size="sm" variant="outline" className="shrink-0"
                  disabled={comissaoMutation.isPending}
                  onClick={() => comissaoMutation.mutate()}>
                  {comissaoMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Check className="h-3.5 w-3.5 mr-1" />Marcar paga</>}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Parcelas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parcelas ({parcelas.length})
            </span>
            <div className="flex gap-1">
              {(["todas","pendente","vencido","pago"] as PFilter[]).map((f) => (
                <button key={f} onClick={() => setPFilter(f)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                    pFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}>
                  {f === "todas" ? "Todas"
                    : f === "pendente" ? `Pend. ${counts.pendente}`
                    : f === "vencido"  ? `Venc. ${counts.vencido}`
                    :                    `Pagas ${counts.pago}`}
                </button>
              ))}
            </div>
          </div>

          {pLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {filtradas.map((p) => (
                <div key={p.id} className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
                  p.status === "pago"    ? "bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40"
                  : p.status === "vencido" ? "bg-red-50/40 border-red-100 dark:bg-red-950/20 dark:border-red-900/40"
                  :                         "bg-muted/30 border-border/50"
                )}>
                  <span className="w-6 text-[10px] font-bold text-muted-foreground shrink-0">
                    #{p.numero_parcela}
                  </span>
                  <span className="text-xs font-medium w-14 shrink-0 text-muted-foreground">
                    {fmtMes(p.data_vencimento)}
                  </span>
                  <span className="font-semibold flex-1 text-sm">{fmtBRL(p.valor)}</span>
                  <StatusBadge status={p.status} />
                  {p.status === "pago" && p.data_pagamento && (
                    <span className="text-[10px] text-muted-foreground hidden sm:block">
                      {fmtDate(p.data_pagamento)}
                    </span>
                  )}

                  {/* Receber inline */}
                  {p.status !== "pago" && p.status !== "cancelado" && (
                    pagandoId === p.id ? (
                      <div className="flex items-center gap-1 ml-auto" onPointerDown={(e) => e.stopPropagation()}>
                        <Input type="date" value={pgData} onChange={(e) => setPgData(e.target.value)}
                          className="h-6 text-[10px] w-28 px-1.5" />
                        <Select value={pgForma} onValueChange={setPgForma}>
                          <SelectTrigger className="h-6 text-[10px] w-20 px-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMAS.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-6 px-2 text-[10px]"
                          disabled={receberMutation.isPending}
                          onClick={() => receberMutation.mutate({ id: p.id, valor: p.valor })}>
                          {receberMutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Check className="h-3 w-3" />}
                        </Button>
                        <button onClick={() => setPagandoId(null)}
                          className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted transition-colors"
                        onClick={() => { setPagandoId(p.id); setPgData(hoje); setPgForma("pix"); }}>
                        <TrendingUp className="h-3 w-3" />
                        Receber
                      </button>
                    )
                  )}
                </div>
              ))}
              {filtradas.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma parcela neste filtro.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
