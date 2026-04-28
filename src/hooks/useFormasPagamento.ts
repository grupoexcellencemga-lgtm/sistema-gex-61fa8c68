import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FormaPagamento = {
  id: string;
  nome: string;
  codigo: string;
  tipo: string;
  ativo: boolean;
  abre_taxa: boolean;
  abre_parcelas: boolean;
  ordem: number | null;
};

export function useFormasPagamento() {
  return useQuery({
    queryKey: ["formas_pagamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;

      return (data || []) as FormaPagamento[];
    },
  });
}

export function getFormaPagamentoLabel(
  codigo: string | null | undefined,
  formas: FormaPagamento[]
) {
  if (!codigo) return "—";

  const forma = formas.find((f) => f.codigo === codigo);
  return forma?.nome || codigo;
}

export function isFormaCredito(codigo: string | null | undefined) {
  return ["credito", "cartao", "cartao_credito"].includes(codigo || "");
}