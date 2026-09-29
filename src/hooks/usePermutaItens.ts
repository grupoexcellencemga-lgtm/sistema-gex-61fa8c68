import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PermutaItem } from "@/lib/alunoFinanceiro";

export function usePermutaItens(pagamentos: any[]): Record<string, PermutaItem[]> {
  const permutaIds = pagamentos
    .filter((p) => p.forma_pagamento === "permuta" && p.id)
    .map((p) => p.id as string);

  const sortedIds = [...permutaIds].sort();

  const { data: rows = [] } = useQuery({
    queryKey: ["permuta-itens", sortedIds],
    enabled: permutaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permuta_itens")
        .select("*")
        .in("pagamento_id", permutaIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return rows.reduce<Record<string, PermutaItem[]>>((acc, item: any) => {
    const pid = item.pagamento_id as string;
    (acc[pid] ??= []).push(item as PermutaItem);
    return acc;
  }, {});
}
