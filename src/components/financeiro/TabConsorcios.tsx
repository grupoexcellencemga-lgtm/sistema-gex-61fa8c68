import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Check, DollarSign, TrendingUp, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Parcela {
  id: string;
  contrato_id: string;
  lead_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  status: "pendente" | "pago" | "vencido" | "cancelado";
  forma_pagamento: string | null;
}

interface Contrato {
  id: string;
  lead_id: string;
  valor_credito: number;
  taxa_admin: number;
  prazo: number;
  valor_parcela: number;
  status: string;
  responsavel_id: string | null;
  comissao_pct: number;
  comissao_valor: number | null;
  comissao_paga: boolean;
  comissao_data_pagamento: string | null;
}

interface LeadRow { id: string; nome: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

const FORMAS = [
  { id: "pix", label: "PIX" },
  { id: "boleto", label: "Boleto" },
  { id: "ted", label: "TED/DOC" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao_debito", label: "Débito" },
  { id: "cartao_credito", label: "Crédito" },
];

const hoje = new Date().toISOString().slice(0, 10);
const mesAtual = hoje.slice(0, 7);

function resolveStatus(p: Parcela, now: string): string {
  if (p.status === "pago" || p.status === "cancelado") return p.status;
  return p.data_vencimento < now ? "vencido" : "pendente";
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pago:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    pendente: "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400",
    vencido:  "bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400",
    cancelado:"bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400",
    ativo:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
  const lbl: Record<string, string> = {
    pago:"Pago", pendente:"Pendente", vencido:"Vencido",
    cancelado:"Cancelado", ativo:"Ativo",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap", cls[status] ?? "bg-slate-100 text-slate-600")}>
      {lbl[status] ?? status}
    </span>
  );
}

type PFilter = "todas" | "pendente" | "vencido" | "pago";

// ── Component ─────────────────────────────────────────────────────────────────

// converte string numérica do Supabase para number
const n = (v: any): number => Number(v) || 0;

export function TabConsorcios() {
  const { empresas } = useEmpresa();
  const qc = useQueryClient();

  // IDs das empresas que têm módulo de consórcio (isolamento: só dados de consórcio)
  const consorcioIds = useMemo(
    () => empresas.filter((e) => e.modulos.includes("consorcios-pipeline" as any)).map((e) => e.id),
    [empresas],
  );

  const [pFilter, setPFilter] = useState<PFilter>("todas");
  const [mesFiltro, setMesFiltro] = useState<string>("todos");
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [pgData,   setPgData]    = useState(hoje);
  const [pgForma,  setPgForma]   = useState("pix");

  // ── Queries — filtradas pelas empresas de consórcio do grupo ──

  const { data: leads = [] } = useQuery<LeadRow[]>({
    queryKey: ["consorcio-leads-names-all", consorcioIds],
    queryFn: async () => {
      if (!consorcioIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("consorcios_leads").select("id, nome")
        .in("empresa_id", consorcioIds).is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: consorcioIds.length > 0,
  });
  const leadsMap = useMemo(() => new Map(leads.map((l) => [l.id, l.nome])), [leads]);

  const { data: contratos = [], isLoading: cLoad } = useQuery<Contrato[]>({
    queryKey: ["consorcio-contratos-financeiro-all", consorcioIds],
    queryFn: async () => {
      if (!consorcioIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("consorcios_contratos").select("*")
        .in("empresa_id", consorcioIds).is("deleted_at", null);
      if (error) throw error;
      // Converte NUMERIC (string) para number
      return (data ?? []).map((c: any) => ({
        ...c,
        valor_credito:  n(c.valor_credito),
        taxa_admin:     n(c.taxa_admin),
        valor_parcela:  n(c.valor_parcela),
        comissao_pct:   n(c.comissao_pct),
        comissao_valor: c.comissao_valor != null ? n(c.comissao_valor) : null,
      })) as Contrato[];
    },
    enabled: consorcioIds.length > 0,
  });

  const { data: parcelas = [], isLoading: pLoad } = useQuery<Parcela[]>({
    queryKey: ["consorcio-parcelas-financeiro-all", consorcioIds],
    queryFn: async () => {
      if (!consorcioIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("consorcios_parcelas").select("*")
        .in("empresa_id", consorcioIds);
      if (error) throw error;
      // Converte NUMERIC (string) para number
      return (data ?? []).map((p: any) => ({
        ...p,
        valor:      n(p.valor),
        valor_pago: p.valor_pago != null ? n(p.valor_pago) : null,
      })) as Parcela[];
    },
    enabled: consorcioIds.length > 0,
  });

  const parcelasR = useMemo(() =>
    parcelas.map((p) => ({ ...p, status: resolveStatus(p, hoje) })),
  [parcelas]);

  // ── Meses disponíveis ──
  const meses = useMemo(() => {
    const s = new Set(parcelas.map((p) => p.data_vencimento.slice(0, 7)));
    return Array.from(s).sort();
  }, [parcelas]);

  // ── Filtered ──
  const filtradas = useMemo(() => {
    let r = parcelasR;
    if (pFilter !== "todas") r = r.filter((p) => p.status === pFilter);
    if (mesFiltro !== "todos") r = r.filter((p) => p.data_vencimento.startsWith(mesFiltro));
    return r;
  }, [parcelasR, pFilter, mesFiltro]);

  // ── Metrics ──
  const totalAdmin = useMemo(() =>
    contratos.reduce((s, c) => s + c.valor_credito * (c.taxa_admin / 100), 0),
  [contratos]);

  const recebidoMes = useMemo(() =>
    parcelasR
      .filter((p) => p.status === "pago" && p.data_pagamento?.startsWith(mesAtual))
      .reduce((s, p) => s + (p.valor_pago ?? p.valor), 0),
  [parcelasR]);

  const vencidas = useMemo(() => parcelasR.filter((p) => p.status === "vencido"), [parcelasR]);
  const pendentes = useMemo(() => parcelasR.filter((p) => p.status === "pendente"), [parcelasR]);

  const comissoesPendentes = useMemo(() =>
    contratos.filter((c) => !c.comissao_paga && (c.comissao_valor ?? 0) > 0),
  [contratos]);

  // ── Mutation: receber ──
  const receberMutation = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await (supabase as any)
        .from("consorcios_parcelas")
        .update({ status: "pago", data_pagamento: pgData, forma_pagamento: pgForma, valor_pago: valor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcio-parcelas-financeiro-all"] });
      qc.invalidateQueries({ queryKey: ["consorcios-contratos-all"] });
      qc.invalidateQueries({ queryKey: ["consorcio-parcelas"] });
      setPagandoId(null);
      toast.success("Pagamento registrado");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (cLoad || pLoad) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Contratos ativos</span>
          </div>
          <div className="text-2xl font-bold">{contratos.filter((c) => c.status === "ativo").length}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Taxa admin total</span>
          </div>
          <div className="text-xl font-bold">{fmtBRL(totalAdmin)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground font-medium">Recebido este mês</span>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(recebidoMes)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground font-medium">Vencidas</span>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{vencidas.length}</div>
          {vencidas.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {fmtBRL(vencidas.reduce((s, p) => s + p.valor, 0))}
            </div>
          )}
        </div>
      </div>

      {/* Comissões pendentes */}
      {comissoesPendentes.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {comissoesPendentes.length} comissão(ões) a pagar
            </span>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {comissoesPendentes.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="font-medium text-foreground">{leadsMap.get(c.lead_id) ?? "—"}</span>
                <span>{fmtBRL(c.comissao_valor!)}</span>
              </div>
            ))}
            {comissoesPendentes.length > 5 && (
              <p className="text-muted-foreground">+{comissoesPendentes.length - 5} mais</p>
            )}
          </div>
        </div>
      )}

      {/* Parcelas table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Parcelas</span>

          {/* Status filter */}
          <div className="flex gap-1">
            {(["todas","pendente","vencido","pago"] as PFilter[]).map((f) => (
              <button key={f} onClick={() => setPFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  pFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}>
                {f === "todas" ? "Todas"
                  : f === "pendente" ? `Pendentes (${pendentes.length})`
                  : f === "vencido"  ? `Vencidas (${vencidas.length})`
                  :                    "Pagas"}
              </button>
            ))}
          </div>

          {/* Month filter */}
          <Select value={mesFiltro} onValueChange={setMesFiltro}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Mês..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os meses</SelectItem>
              {meses.map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(m + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="ml-auto text-xs text-muted-foreground">{filtradas.length} parcela(s)</span>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2.5 font-medium">Cliente</th>
                  <th className="text-left px-3 py-2.5 font-medium">Parc.</th>
                  <th className="text-left px-3 py-2.5 font-medium">Vencto.</th>
                  <th className="text-right px-3 py-2.5 font-medium">Valor</th>
                  <th className="text-left px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                      Nenhuma parcela neste filtro.
                    </td>
                  </tr>
                ) : filtradas.map((p) => {
                  const leadNome = leadsMap.get(p.lead_id) ?? "—";
                  return (
                    <tr key={p.id} className={cn(
                      "hover:bg-muted/20 transition-colors",
                      p.status === "vencido" && "bg-red-50/40 dark:bg-red-950/10"
                    )}>
                      <td className="px-3 py-2 font-medium max-w-[180px] truncate">{leadNome}</td>
                      <td className="px-3 py-2 text-muted-foreground">#{p.numero_parcela}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(p.data_vencimento)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtBRL(p.valor)}</td>
                      <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                      <td className="px-3 py-2">
                        {p.status !== "pago" && p.status !== "cancelado" && (
                          pagandoId === p.id ? (
                            <div className="flex items-center gap-1">
                              <Input type="date" value={pgData} onChange={(e) => setPgData(e.target.value)}
                                className="h-7 text-xs w-32 px-2" />
                              <Select value={pgForma} onValueChange={setPgForma}>
                                <SelectTrigger className="h-7 text-xs w-24 px-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {FORMAS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button size="sm" className="h-7 px-2 text-xs"
                                disabled={receberMutation.isPending}
                                onClick={() => receberMutation.mutate({ id: p.id, valor: p.valor })}>
                                {receberMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </Button>
                              <button onClick={() => setPagandoId(null)}
                                className="text-muted-foreground hover:text-foreground text-xs px-1">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setPagandoId(p.id); setPgData(hoje); setPgForma("pix"); }}
                              className="text-xs text-primary hover:underline whitespace-nowrap">
                              Registrar
                            </button>
                          )
                        )}
                        {p.status === "pago" && p.data_pagamento && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {fmtDate(p.data_pagamento)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
