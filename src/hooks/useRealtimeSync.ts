import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

// Mapeamento: tabela → prefixos de query key a invalidar.
// invalidateQueries com prefixo invalida todas as queries que começam com aquela chave.
const WATCHED: { table: string; keys: string[] }[] = [
  { table: "alunos",            keys: ["alunos"] },
  { table: "pagamentos",        keys: ["pagamentos", "aluno-pagamentos", "financeiro", "dashboard", "relatorios"] },
  { table: "turmas",            keys: ["turmas"] },
  { table: "eventos",           keys: ["eventos"] },
  { table: "leads",             keys: ["leads"] },
  { table: "profissionais",     keys: ["profissionais"] },
  { table: "inscricoes_evento", keys: ["inscricoes_evento", "inscricoes"] },
  { table: "chaves_pix",        keys: ["chaves_pix"] },
  { table: "tarefas",           keys: ["tarefas"] },
  { table: "notificacoes",      keys: ["notificacoes"] },
  { table: "checklist_itens",   keys: ["checklist_itens", "checklist"] },
  { table: "sessoes",           keys: ["sessoes"] },
];

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  useEffect(() => {
    if (!empresaId) return;

    const channel = supabase.channel(`realtime-sync-${empresaId}`);

    for (const { table, keys } of WATCHED) {
      // O Supabase aplica RLS na subscription — cada usuário só recebe
      // eventos de linhas que teria permissão de SELECT.
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          for (const key of keys) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId, queryClient]);
}
