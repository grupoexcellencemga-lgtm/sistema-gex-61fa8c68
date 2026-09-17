import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDuracao } from "@/components/funil/funilUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  MessageSquareText,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

type Revisao = Database["public"]["Views"]["v_respostas_sombra_revisao"]["Row"];
type Filtro = "pendentes" | "boa" | "ruim" | "todas";

const TAMANHO_PAGINA = 20;
// Amostra a partir da qual a taxa de aprovação começa a dizer algo. Abaixo
// disso, dois ou três casos mudam o percentual inteiro.
const AMOSTRA_MINIMA = 30;

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "pendentes", rotulo: "Pendentes" },
  { valor: "boa", rotulo: "Aprovadas" },
  { valor: "ruim", rotulo: "Reprovadas" },
  { valor: "todas", rotulo: "Todas" },
];

interface FerramentaIntencionada {
  nome: string;
  input?: Record<string, unknown> | null;
}

function descreverFerramenta(f: FerramentaIntencionada): string {
  const i = f.input ?? {};
  switch (f.nome) {
    case "criar_tarefa":
      return `Criaria tarefa: ${i.titulo ?? "sem título"}`;
    case "registrar_nota":
      return `Anotaria: ${i.nota ?? ""}`;
    case "pontuar_lead":
      return `Daria nota ${i.score ?? "?"} ao lead${i.motivo ? ` — ${i.motivo}` : ""}`;
    case "mover_etapa":
      return `Moveria para "${i.etapa ?? "?"}"`;
    case "atualizar_lead":
      return `Atualizaria ${Object.keys(i).join(", ") || "dados do lead"}`;
    case "solicitar_handoff":
      return `Passaria para um consultor${i.resumo ? ` — ${i.resumo}` : ""}`;
    default:
      return f.nome;
  }
}

function tempoRelativo(iso: string | null) {
  if (!iso) return "";
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

function Bolha({
  rotulo,
  detalhe,
  children,
  destaque,
}: {
  rotulo: string;
  detalhe?: string;
  children: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        destaque ? "border-primary/40 bg-primary/5" : "bg-muted/30"
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span
          className={cn(
            "text-[11px] font-medium uppercase tracking-wide",
            destaque ? "text-primary" : "text-muted-foreground"
          )}
        >
          {rotulo}
        </span>
        {detalhe && <span className="text-[11px] text-muted-foreground">{detalhe}</span>}
      </div>
      <div className="text-sm whitespace-pre-wrap break-words">{children}</div>
    </div>
  );
}

function ContextoConversa({ leadId, ate }: { leadId: string; ate: string | null }) {
  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["revisao-contexto", leadId, ate],
    queryFn: async () => {
      let q = supabase
        .from("mensagens_crm")
        .select("id, conteudo, direcao, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(8);
      // A mensagem avaliada já aparece no card; o contexto é o que veio antes.
      if (ate) q = q.lt("created_at", ate);
      const { data } = await q;
      return (data ?? []).reverse();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando conversa...
      </div>
    );
  }

  if (mensagens.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Não há mensagens anteriores.</p>;
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
      {mensagens.map((m) => (
        <div
          key={m.id}
          className={cn("flex", m.direcao === "saida" ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[85%] rounded-md px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words",
              m.direcao === "saida" ? "bg-primary/10" : "bg-background border"
            )}
          >
            {m.conteudo || <span className="italic text-muted-foreground">[mídia]</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CardRevisao({ item }: { item: Revisao }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [mostrarContexto, setMostrarContexto] = useState(false);
  const [editandoNota, setEditandoNota] = useState(false);
  const [nota, setNota] = useState(item.avaliacao_nota ?? "");

  const ferramentas = (Array.isArray(item.ferramentas) ? item.ferramentas : []) as unknown as FerramentaIntencionada[];

  const avaliar = useMutation({
    mutationFn: async ({ avaliacao, comentario }: { avaliacao: "boa" | "ruim"; comentario: string }) => {
      const { error } = await supabase
        .from("respostas_sombra")
        .update({
          avaliacao,
          avaliacao_nota: comentario.trim() || null,
          avaliado_em: new Date().toISOString(),
          avaliado_por: user?.id ?? null,
        })
        .eq("id", item.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditandoNota(false);
      queryClient.invalidateQueries({ queryKey: ["revisao-ia"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar a avaliação: " + e.message),
  });

  const atrasoHumano =
    item.entrada_em && item.resposta_humana_em
      ? Math.max(
          0,
          Math.floor(
            (new Date(item.resposta_humana_em).getTime() - new Date(item.entrada_em).getTime()) / 60000
          )
        )
      : null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.lead_nome || "Lead sem nome"}</p>
          <p className="text-[11px] text-muted-foreground">
            {tempoRelativo(item.entrada_em ?? item.created_at)}
            {item.agente_nome ? ` · ${item.agente_nome}` : ""}
          </p>
        </div>
        {item.avaliacao && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px]",
              item.avaliacao === "boa"
                ? "border-green-300 text-green-700 dark:border-green-800 dark:text-green-400"
                : "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400"
            )}
          >
            {item.avaliacao === "boa" ? "Aprovada" : "Reprovada"}
          </Badge>
        )}
      </div>

      <Bolha rotulo="Cliente">
        {item.mensagem_entrada || <span className="italic text-muted-foreground">[mídia]</span>}
      </Bolha>

      <Bolha rotulo="A IA responderia" destaque>
        {item.resposta_ia}
        {ferramentas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ferramentas.map((f, idx) => (
              <span
                key={idx}
                className="inline-block rounded border border-dashed border-primary/30 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {descreverFerramenta(f)}
              </span>
            ))}
          </div>
        )}
      </Bolha>

      {item.resposta_humana ? (
        <Bolha
          rotulo="Vocês responderam"
          detalhe={atrasoHumano !== null ? `${formatDuracao(atrasoHumano)} depois` : undefined}
        >
          {item.resposta_humana}
        </Bolha>
      ) : (
        <p className="text-xs text-muted-foreground px-1">
          Ainda sem resposta de vocês para esta mensagem.
        </p>
      )}

      {item.avaliacao_nota && !editandoNota && (
        <p className="text-xs border-l-2 pl-2 text-muted-foreground">
          <span className="font-medium text-foreground">Comentário:</span> {item.avaliacao_nota}
        </p>
      )}

      {editandoNota && (
        <div className="space-y-2">
          <Textarea
            id={`nota-${item.id}`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="O que estava errado? Como você teria respondido?"
            className="text-sm min-h-[72px]"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditandoNota(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={avaliar.isPending}
              onClick={() => avaliar.mutate({ avaliacao: "ruim", comentario: nota })}
            >
              {avaliar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar reprovação
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setMostrarContexto((v) => !v)}
        >
          {mostrarContexto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {mostrarContexto ? "Ocultar conversa" : "Ver conversa anterior"}
        </Button>

        {!editandoNota && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              disabled={avaliar.isPending}
              onClick={() => {
                setNota(item.avaliacao_nota ?? "");
                setEditandoNota(true);
              }}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Reprovar
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={avaliar.isPending || item.avaliacao === "boa"}
              onClick={() => avaliar.mutate({ avaliacao: "boa", comentario: item.avaliacao_nota ?? "" })}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Aprovar
            </Button>
          </div>
        )}
      </div>

      {mostrarContexto && item.lead_id && (
        <ContextoConversa leadId={item.lead_id} ate={item.entrada_em ?? item.created_at} />
      )}
    </div>
  );
}

export function RevisaoRespostasIA() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [filtro, setFiltro] = useState<Filtro>("pendentes");
  const [limite, setLimite] = useState(TAMANHO_PAGINA);

  const { data: resumo } = useQuery({
    queryKey: ["revisao-ia", "resumo", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("respostas_sombra")
        .select("avaliacao, tokens_entrada, tokens_saida")
        .eq("empresa_id", empresaId!);
      const linhas = data ?? [];
      const boas = linhas.filter((l) => l.avaliacao === "boa").length;
      const ruins = linhas.filter((l) => l.avaliacao === "ruim").length;
      const comTokens = linhas.filter((l) => l.tokens_entrada != null);
      const mediaEntrada = comTokens.length
        ? Math.round(comTokens.reduce((s, l) => s + (l.tokens_entrada ?? 0), 0) / comTokens.length)
        : null;
      return {
        total: linhas.length,
        boas,
        ruins,
        pendentes: linhas.length - boas - ruins,
        mediaEntrada,
      };
    },
    enabled: !!empresaId,
  });

  const { data: itens = [], isLoading, isFetching } = useQuery({
    queryKey: ["revisao-ia", "lista", empresaId, filtro, limite],
    queryFn: async () => {
      let q = supabase
        .from("v_respostas_sombra_revisao")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: false })
        .range(0, limite - 1);
      if (filtro === "pendentes") q = q.is("avaliacao", null);
      else if (filtro !== "todas") q = q.eq("avaliacao", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Revisao[];
    },
    enabled: !!empresaId,
    placeholderData: (anterior) => anterior,
  });

  const avaliadas = (resumo?.boas ?? 0) + (resumo?.ruins ?? 0);
  const taxa = avaliadas > 0 ? Math.round(((resumo?.boas ?? 0) / avaliadas) * 100) : null;
  const progresso = Math.min(100, Math.round((avaliadas / AMOSTRA_MINIMA) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Revisão do agente
        </CardTitle>
        <CardDescription>
          Em modo sombra o agente escreve a resposta que daria, mas não envia nada. Compare com o que
          vocês responderam e marque se a IA acertou — é assim que se decide, com dados, se ela está
          pronta para atender.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Aprovação</p>
            <p className="text-2xl font-semibold tabular-nums">
              {taxa !== null ? `${taxa}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {resumo?.boas ?? 0} aprovadas · {resumo?.ruins ?? 0} reprovadas
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Amostra</p>
            <p className="text-2xl font-semibold tabular-nums">
              {avaliadas}
              <span className="text-sm font-normal text-muted-foreground"> / {AMOSTRA_MINIMA}</span>
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {avaliadas >= AMOSTRA_MINIMA
                ? "Amostra suficiente para decidir"
                : `Faltam ${AMOSTRA_MINIMA - avaliadas} para uma conclusão confiável`}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Aguardando revisão</p>
            <p className="text-2xl font-semibold tabular-nums">{resumo?.pendentes ?? 0}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {resumo?.mediaEntrada
                ? `~${resumo.mediaEntrada.toLocaleString("pt-BR")} tokens por avaliação`
                : "de um total de " + (resumo?.total ?? 0)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar respostas">
          {FILTROS.map((f) => (
            <Button
              key={f.valor}
              size="sm"
              role="tab"
              aria-selected={filtro === f.valor}
              variant={filtro === f.valor ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => {
                setFiltro(f.valor);
                setLimite(TAMANHO_PAGINA);
              }}
            >
              {f.rotulo}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : itens.length === 0 ? (
          <div className="text-center py-10 space-y-2 text-muted-foreground">
            <MessageSquareText className="h-10 w-10 mx-auto opacity-20" />
            <p className="text-sm">
              {filtro === "pendentes"
                ? "Nada para revisar agora."
                : "Nenhuma resposta nesta categoria."}
            </p>
            {filtro === "pendentes" && (
              <p className="text-xs">
                O agente em modo sombra gera novas respostas conforme os clientes escrevem.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map((item) => (
              <CardRevisao key={item.id} item={item} />
            ))}
            {itens.length >= limite && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => setLimite((l) => l + TAMANHO_PAGINA)}
                >
                  {isFetching && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
