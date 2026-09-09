import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Loader2, Handshake, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { formatPhone } from "@/lib/utils";

type SessaoRow = {
  lead_id: string;
  agente_id: string | null;
  iniciado_em: string;
  houve_handoff: boolean;
  score_inicial: number | null;
  score_final: number | null;
  agentes_bot: { id: string; nome: string } | null;
};

type Lead = {
  id: string;
  nome: string | null;
  contato_id: string;
  lead_score: number | null;
  etapa: { nome: string; cor: string | null } | null;
};

type Row = {
  lead: Lead;
  agente: string;
  agenteId: string | null;
  ultimaSessao: string;
  totalSessoes: number;
  houve_handoff: boolean;
  scoreInicial: number | null;
  scoreFinal: number | null;
};

const PERIODOS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "0", label: "Todos" },
];

function ScoreDelta({ ini, fim }: { ini: number | null; fim: number | null }) {
  if (ini == null && fim == null) return <span className="text-muted-foreground text-xs">—</span>;
  const score = fim ?? ini;
  if (ini == null || fim == null) return <span className="text-xs">{score}</span>;
  const delta = fim - ini;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color = delta > 0 ? "text-green-600 dark:text-green-400" : delta < 0 ? "text-red-500" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />{fim}
    </span>
  );
}

export function BotLeadsRelatorioCard() {
  const { empresaId } = useEmpresa();
  const [periodo, setPeriodo] = useState("30");
  const [filtroAgente, setFiltroAgente] = useState("todos");
  const [busca, setBusca] = useState("");

  const since = periodo !== "0"
    ? new Date(Date.now() - Number(periodo) * 86_400_000).toISOString()
    : null;

  const { data: sessoes = [], isLoading: loadingSessoes } = useQuery<SessaoRow[]>({
    queryKey: ["bot-leads-relatorio-sessoes", empresaId, periodo],
    queryFn: async () => {
      let q = supabase
        .from("conversas_ia")
        .select("lead_id, agente_id, iniciado_em, houve_handoff, score_inicial, score_final, agentes_bot(id, nome)")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("iniciado_em", { ascending: false });
      if (since) q = q.gte("iniciado_em", since);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SessaoRow[];
    },
    enabled: !!empresaId,
  });

  const leadIds = [...new Set(sessoes.map((s) => s.lead_id))];

  const { data: leads = [], isLoading: loadingLeads } = useQuery<Lead[]>({
    queryKey: ["bot-leads-relatorio-leads", leadIds.join(",")],
    queryFn: async () => {
      if (!leadIds.length) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, contato_id, lead_score, etapas_funil(nome, cor)")
        .in("id", leadIds)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).map((l: any) => ({
        id: l.id,
        nome: l.nome,
        contato_id: l.contato_id,
        lead_score: l.lead_score,
        etapa: l.etapas_funil ?? null,
      })) as Lead[];
    },
    enabled: leadIds.length > 0,
  });

  // Agrupa por lead
  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const rowsMap = new Map<string, Row>();

  for (const s of sessoes) {
    const lead = leadMap.get(s.lead_id);
    if (!lead) continue;
    if (!rowsMap.has(s.lead_id)) {
      rowsMap.set(s.lead_id, {
        lead,
        agente: (s.agentes_bot as any)?.nome ?? "—",
        agenteId: s.agente_id,
        ultimaSessao: s.iniciado_em,
        totalSessoes: 1,
        houve_handoff: s.houve_handoff,
        scoreInicial: s.score_inicial,
        scoreFinal: s.score_final ?? lead.lead_score,
      });
    } else {
      const row = rowsMap.get(s.lead_id)!;
      row.totalSessoes++;
      if (s.houve_handoff) row.houve_handoff = true;
    }
  }

  const agentes = [...new Map(
    sessoes
      .filter((s) => s.agentes_bot)
      .map((s) => [(s.agentes_bot as any).id, (s.agentes_bot as any).nome])
  ).entries()].map(([id, nome]) => ({ id, nome }));

  let rows = [...rowsMap.values()];
  if (filtroAgente !== "todos") rows = rows.filter((r) => r.agenteId === filtroAgente);
  if (busca.trim()) {
    const q = busca.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.lead.nome?.toLowerCase().includes(q) ||
        r.lead.contato_id?.includes(q)
    );
  }

  const isLoading = loadingSessoes || loadingLeads;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Leads Atendidos pelo Bot
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agentes.length > 1 && (
              <Select value={filtroAgente} onValueChange={setFiltroAgente}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Todos os agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="text-xs">Todos os agentes</SelectItem>
                  {agentes.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {/* busca */}
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum lead encontrado no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2 pr-3 font-medium">Lead</th>
                  <th className="text-left pb-2 pr-3 font-medium">Agente</th>
                  <th className="text-left pb-2 pr-3 font-medium">Etapa</th>
                  <th className="text-center pb-2 pr-3 font-medium">Sessões</th>
                  <th className="text-center pb-2 pr-3 font-medium">Score</th>
                  <th className="text-center pb-2 font-medium">Handoff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((r) => (
                  <tr key={r.lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-foreground truncate max-w-[140px]">
                        {r.lead.nome || formatPhone(r.lead.contato_id)}
                      </p>
                      {r.lead.nome && (
                        <p className="text-muted-foreground text-[10px]">{formatPhone(r.lead.contato_id)}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[100px]">{r.agente}</td>
                    <td className="py-2 pr-3">
                      {r.lead.etapa ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5"
                          style={r.lead.etapa.cor ? { borderColor: r.lead.etapa.cor, color: r.lead.etapa.cor } : {}}
                        >
                          {r.lead.etapa.nome}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-center text-muted-foreground">{r.totalSessoes}</td>
                    <td className="py-2 pr-3 text-center">
                      <ScoreDelta ini={r.scoreInicial} fim={r.scoreFinal} />
                    </td>
                    <td className="py-2 text-center">
                      {r.houve_handoff ? (
                        <Handshake className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-muted-foreground mt-3 text-right">{rows.length} lead{rows.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
