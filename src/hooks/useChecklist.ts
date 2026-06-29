import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import type { ChecklistExecucaoRow, ChecklistItemRow } from "@/types";

const HISTORY_DAYS = 14;

export function useChecklist(targetUserId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const usuarioId = targetUserId || user?.id;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sinceStr = format(subDays(new Date(), HISTORY_DAYS - 1), "yyyy-MM-dd");

  useRealtimeSync("checklist_itens", [["checklist-itens", usuarioId]]);
  useRealtimeSync("checklist_execucoes", [["checklist-execucoes", usuarioId]]);

  const { data: itens = [], isLoading: loadingItens } = useQuery({
    queryKey: ["checklist-itens", usuarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_itens")
        .select("*")
        .eq("usuario_id", usuarioId!)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChecklistItemRow[];
    },
    enabled: !!usuarioId,
  });

  const diarias = useMemo(() => itens.filter((i) => i.tipo === "diaria"), [itens]);
  const esporadicas = useMemo(() => itens.filter((i) => i.tipo === "esporadica"), [itens]);

  const { data: execucoes = [], isLoading: loadingExec } = useQuery({
    queryKey: ["checklist-execucoes", usuarioId],
    queryFn: async () => {
      if (!itens.length) return [] as ChecklistExecucaoRow[];
      const { data, error } = await supabase
        .from("checklist_execucoes")
        .select("*")
        .in("item_id", itens.map((i) => i.id))
        .gte("data", sinceStr)
        .order("data", { ascending: true });
      if (error) throw error;
      return data as ChecklistExecucaoRow[];
    },
    enabled: itens.length > 0,
  });

  const todayMap = useMemo(() => {
    const map = new Map<string, ChecklistExecucaoRow>();
    execucoes.filter((e) => e.data === todayStr).forEach((e) => map.set(e.item_id, e));
    return map;
  }, [execucoes, todayStr]);

  const esporadicaStatusMap = useMemo(() => {
    const map = new Map<string, ChecklistExecucaoRow>();
    execucoes.forEach((e) => {
      if (e.concluido) map.set(e.item_id, e);
    });
    return map;
  }, [execucoes]);

  const historyByItem = useMemo(() => {
    const map = new Map<string, ChecklistExecucaoRow[]>();
    execucoes.forEach((e) => {
      const list = map.get(e.item_id) || [];
      list.push(e);
      map.set(e.item_id, list);
    });
    return map;
  }, [execucoes]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["checklist-execucoes", usuarioId] });
  };

  const toggleDiaria = useMutation({
    mutationFn: async ({ itemId, concluido }: { itemId: string; concluido: boolean }) => {
      const { error } = await supabase.from("checklist_execucoes").upsert(
        {
          item_id: itemId,
          data: todayStr,
          concluido,
          concluido_em: concluido ? new Date().toISOString() : null,
          concluido_por: concluido ? user?.id : null,
        },
        { onConflict: "item_id,data" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleEsporadica = useMutation({
    mutationFn: async ({ itemId, concluido }: { itemId: string; concluido: boolean }) => {
      const existing = execucoes.find((e) => e.item_id === itemId);
      const payload = {
        concluido,
        concluido_em: concluido ? new Date().toISOString() : null,
        concluido_por: concluido ? user?.id : null,
      };
      if (existing) {
        const { error } = await supabase.from("checklist_execucoes").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("checklist_execucoes")
          .insert({ item_id: itemId, data: todayStr, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return {
    isLoading: loadingItens || loadingExec,
    diarias,
    esporadicas,
    todayMap,
    esporadicaStatusMap,
    historyByItem,
    historyDays: HISTORY_DAYS,
    toggleDiaria,
    toggleEsporadica,
  };
}
