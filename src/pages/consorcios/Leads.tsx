import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MessageCircle,
  Loader2,
  LayoutGrid,
  ArrowUpDown,
} from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useDebounce } from "@/hooks/useDebounce";
import { Link } from "react-router-dom";
import {
  ConsorcioLead,
  ETAPA_LIST,
  SEGMENTOS,
  ORIGENS,
  formatCurrency,
  whatsappHref,
  fmtDate,
  type EtapaConsorcio,
  type Segmento,
} from "@/lib/consorcios";

// ── Etapa badge ───────────────────────────────────────────────────────────────

const ETAPA_COLORS: Record<EtapaConsorcio, string> = {
  novo_lead: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  em_contato: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  reuniao_agendada: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  proposta_enviada: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  contrato_fechado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function EtapaBadge({ etapa }: { etapa: EtapaConsorcio | null }) {
  if (!etapa) return <span className="text-[11px] text-muted-foreground">—</span>;
  const label = ETAPA_LIST.find((e) => e.id === etapa)?.label ?? etapa;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
        ETAPA_COLORS[etapa] ?? "bg-slate-100 text-slate-700"
      )}
    >
      {label}
    </span>
  );
}

// ── Leads page ────────────────────────────────────────────────────────────────

type SortField = "created_at" | "nome" | "valor_credito";

const Leads = () => {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [segmentoFilter, setSegmentoFilter] = useState<Segmento | "todos">("todos");
  const [etapaFilter, setEtapaFilter] = useState<EtapaConsorcio | "todos">("todos");
  const [responsavelFilter, setResponsavelFilter] = useState("todos");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: leads = [], isLoading } = useQuery<ConsorcioLead[]>({
    queryKey: ["consorcios-leads", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("consorcios_leads")
        .select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ConsorcioLead[];
    },
    enabled: !!empresaId,
  });

  const { data: comerciais = [] } = useQuery<Array<{ id: string; nome: string }>>({
    queryKey: ["comerciais-consorcios", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comerciais")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const comerciaisMap = useMemo(
    () => new Map(comerciais.map((c) => [c.id, c.nome])),
    [comerciais]
  );

  const filtered = useMemo(() => {
    let result = leads.filter((l) => {
      if (
        debouncedSearch &&
        !l.nome.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
        !l.telefone?.includes(debouncedSearch) &&
        !l.email?.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
        !l.cpf_cnpj?.includes(debouncedSearch)
      )
        return false;
      if (segmentoFilter !== "todos" && l.segmento !== segmentoFilter) return false;
      if (etapaFilter !== "todos" && l.etapa !== etapaFilter) return false;
      if (responsavelFilter === "sem" && l.responsavel_id) return false;
      if (
        responsavelFilter !== "todos" &&
        responsavelFilter !== "sem" &&
        l.responsavel_id !== responsavelFilter
      )
        return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortField === "nome") {
        va = a.nome.toLowerCase();
        vb = b.nome.toLowerCase();
      } else if (sortField === "valor_credito") {
        va = a.valor_credito ?? 0;
        vb = b.valor_credito ?? 0;
      } else {
        va = a.created_at;
        vb = b.created_at;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, debouncedSearch, segmentoFilter, etapaFilter, responsavelFilter, sortField, sortAsc]);

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("consorcios_leads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcios-leads"] });
      toast.success("Lead excluído");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc((p) => !p);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown
        className={cn(
          "h-3 w-3 transition-opacity",
          sortField === field ? "opacity-100 text-primary" : "opacity-40"
        )}
      />
    </button>
  );

  const totalValor = filtered.reduce((acc, l) => acc + (l.valor_credito ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads — Consórcio"
        description={`${filtered.length} lead${filtered.length !== 1 ? "s" : ""}${totalValor > 0 ? ` · ${formatCurrency(totalValor)} em valor` : ""}`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link to="/consorcios/pipeline">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Pipeline
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/consorcios/pipeline">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Link>
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 w-56"
            placeholder="Buscar por nome, tel, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select
          value={segmentoFilter}
          onValueChange={(v) => setSegmentoFilter(v as Segmento | "todos")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos segmentos</SelectItem>
            {SEGMENTOS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.emoji} {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={etapaFilter}
          onValueChange={(v) => setEtapaFilter(v as EtapaConsorcio | "todos")}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as etapas</SelectItem>
            {ETAPA_LIST.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos responsáveis</SelectItem>
            <SelectItem value="sem">Sem responsável</SelectItem>
            {comerciais.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nenhum lead encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3">
                    <SortBtn field="nome">Nome</SortBtn>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Segmento</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">
                    <SortBtn field="valor_credito">Valor Crédito</SortBtn>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Origem</th>
                  <th className="text-left px-4 py-3">Etapa</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Responsável</th>
                  <th className="text-left px-4 py-3 hidden xl:table-cell">
                    <SortBtn field="created_at">Data</SortBtn>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const seg = SEGMENTOS.find((s) => s.id === lead.segmento);
                  const origem = ORIGENS.find((o) => o.id === lead.origem);
                  return (
                    <tr
                      key={lead.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium leading-tight">{lead.nome}</div>
                        {lead.telefone && (
                          <a
                            href={whatsappHref(lead.telefone)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-green-600 hover:text-green-700 mt-0.5"
                          >
                            <MessageCircle className="h-3 w-3 shrink-0" />
                            {lead.telefone}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {seg && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                              seg.className
                            )}
                          >
                            {seg.emoji} {seg.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {lead.valor_credito ? (
                          <span className="font-medium">
                            {formatCurrency(lead.valor_credito)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {lead.prazo && (
                          <span className="text-muted-foreground text-xs ml-1">
                            / {lead.prazo}m
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {origem?.label ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <EtapaBadge etapa={lead.etapa} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {lead.responsavel_id
                          ? comerciaisMap.get(lead.responsavel_id) ?? "—"
                          : "—"}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                        {fmtDate(lead.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive h-7 px-2"
                          onClick={() => {
                            if (confirm(`Excluir "${lead.nome}"?`))
                              deleteLeadMutation.mutate(lead.id);
                          }}
                        >
                          ×
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leads;
