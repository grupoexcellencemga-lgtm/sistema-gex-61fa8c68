import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";

export const useProfissionais = () => {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  return useQuery({
    queryKey: ["profissionais", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome, especialidade, ativo")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });
};
