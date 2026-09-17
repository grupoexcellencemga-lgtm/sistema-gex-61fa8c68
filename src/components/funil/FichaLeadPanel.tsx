import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  TEMPERATURA_LEAD,
  TIPOS_CLIENTE,
  TIPOS_CONTATO,
  ehTipoCliente,
  rotuloTipoContato,
  type FichaLead,
} from "./funilUtils";

interface Props {
  leadId: string;
  tipoContato: string | null;
  onTipoAlterado: (tipo: string) => void;
  /** Sem conversa no WhatsApp não há do que tirar uma ficha. */
  temConversa?: boolean;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="space-y-1">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function FichaLeadPanel({ leadId, tipoContato, onTipoAlterado, temConversa = true }: Props) {
  const queryClient = useQueryClient();

  const { data: registro, isLoading } = useQuery({
    queryKey: ["ficha-lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_ficha_ia")
        .select("ficha, atualizada_em")
        .eq("lead_id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data ? { ficha: data.ficha as unknown as FichaLead, atualizada_em: data.atualizada_em } : null;
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("atualizar-ficha-lead", {
        body: { leadId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.motivo ?? "não foi possível gerar a ficha");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ficha-lead", leadId] }),
    onError: (e: Error) => toast.error("Erro ao gerar a ficha: " + e.message),
  });

  const alterarTipo = useMutation({
    mutationFn: async (tipo: string) => {
      const { error } = await supabase.from("leads").update({ tipo_contato: tipo }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: (_, tipo) => {
      toast.success(`Contato marcado como ${rotuloTipoContato(tipo).toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["inicio-leads-aguardando"] });
      onTipoAlterado(tipo);
    },
    onError: (e: Error) => toast.error("Erro ao alterar o tipo: " + e.message),
  });

  const ficha = registro?.ficha;
  const tipoAtual = tipoContato ?? "lead";
  // Só sugere quando a IA acha que não é cliente e a equipe ainda não decidiu.
  const sugestao =
    ficha &&
    ficha.tipo_contato !== tipoAtual &&
    !TIPOS_CLIENTE.includes(ficha.tipo_contato) &&
    ehTipoCliente(tipoAtual)
      ? ficha.tipo_contato
      : null;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Label htmlFor={`tipo-contato-${leadId}`} className="text-xs text-muted-foreground">
            Tipo de contato
          </Label>
          <Select
            value={tipoAtual}
            onValueChange={(v) => alterarTipo.mutate(v)}
            disabled={alterarTipo.isPending}
          >
            <SelectTrigger id={`tipo-contato-${leadId}`} className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_CONTATO.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {ficha && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={gerar.isPending}
            onClick={() => gerar.mutate()}
          >
            {gerar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar ficha
          </Button>
        )}
      </div>

      {!ehTipoCliente(tipoAtual) && (
        <p className="text-xs text-muted-foreground">
          Não é cliente: este contato fica fora do painel de pendências, do alerta de atraso e do agente de vendas.
        </p>
      )}

      {sugestao && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-xs">
            A IA identificou este contato como <span className="font-medium">{rotuloTipoContato(sugestao).toLowerCase()}</span>.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 shrink-0 text-xs"
            disabled={alterarTipo.isPending}
            onClick={() => alterarTipo.mutate(sugestao)}
          >
            Confirmar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !ficha && !temConversa ? (
        <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">Este contato ainda não conversou pelo WhatsApp</p>
          <p className="text-xs text-muted-foreground">
            A ficha é feita a partir da conversa e aparece aqui sozinha quando a pessoa escrever.
          </p>
        </div>
      ) : !ficha ? (
        <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Ainda não há ficha deste contato</p>
            <p className="text-xs text-muted-foreground">
              A IA lê a conversa e resume o que a pessoa precisa, quando precisa e como ela é. As fichas se
              atualizam sozinhas a cada meia hora quando há conversa nova.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" disabled={gerar.isPending} onClick={() => gerar.mutate()}>
            {gerar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {gerar.isPending ? "Lendo a conversa..." : "Gerar agora"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px]", TEMPERATURA_LEAD[ficha.temperatura]?.classe)}>
                {TEMPERATURA_LEAD[ficha.temperatura]?.label ?? ficha.temperatura}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                Atualizada {formatDistanceToNow(new Date(registro!.atualizada_em), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            {ficha.resumo && <p className="text-sm leading-relaxed">{ficha.resumo}</p>}
          </div>

          {ficha.proximo_passo && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                <ArrowRight className="h-3.5 w-3.5" /> Próximo passo
              </p>
              <p className="mt-1 text-sm">{ficha.proximo_passo}</p>
            </div>
          )}

          {ficha.alertas.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Atenção
              </p>
              <div className="mt-1">
                <Lista itens={ficha.alertas} />
              </div>
            </div>
          )}

          {ficha.necessidade && <Secao titulo="O que busca">{ficha.necessidade}</Secao>}
          {ficha.dores.length > 0 && (
            <Secao titulo="Dores">
              <Lista itens={ficha.dores} />
            </Secao>
          )}
          {ficha.momento && <Secao titulo="Momento">{ficha.momento}</Secao>}
          {ficha.objecoes.length > 0 && (
            <Secao titulo="Objeções">
              <Lista itens={ficha.objecoes} />
            </Secao>
          )}
          {ficha.perfil && <Secao titulo="Como a pessoa é">{ficha.perfil}</Secao>}
          {ficha.interesses.length > 0 && (
            <Secao titulo="Interesses">
              <div className="flex flex-wrap gap-1.5">
                {ficha.interesses.map((i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] font-normal">
                    {i}
                  </Badge>
                ))}
              </div>
            </Secao>
          )}

          <p className="text-[11px] text-muted-foreground border-t pt-3">
            Resumo gerado pela IA a partir da conversa. Pode conter imprecisões — na dúvida, confira a conversa.
          </p>
        </div>
      )}
    </div>
  );
}
