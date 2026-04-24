import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

/**
 * Hook that provides data-level filtering for limited users.
 * 
 * - Users linked to a profissional see only records where `responsavel` matches.
 * - Users linked to a comercial see only records where `comercial_id` matches.
 * - Admins and users without any link see everything.
 */
export function useDataFilter() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  // Fetch profile with profissional_id and comercial_id
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, profissional_id, comercial_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user,
  });

  // If user has a linked profissional, get the profissional name
  const { data: profissional } = useQuery({
    queryKey: ["my-profissional", profile?.profissional_id],
    queryFn: async () => {
      if (!profile?.profissional_id) return null;
      const { data } = await supabase
        .from("profissionais")
        .select("id, nome")
        .eq("id", profile.profissional_id)
        .is("deleted_at", null)
        .single();
      return data;
    },
    enabled: !!profile?.profissional_id,
  });

  // If user has a linked comercial, get the comercial info
  const { data: comercial } = useQuery({
    queryKey: ["my-comercial", profile?.comercial_id],
    queryFn: async () => {
      if (!profile?.comercial_id) return null;
      const { data } = await supabase
        .from("comerciais")
        .select("id, nome")
        .eq("id", profile.comercial_id)
        .is("deleted_at", null)
        .single();
      return data;
    },
    enabled: !!profile?.comercial_id,
  });

  const isProfissional = !isAdmin && !!profile?.profissional_id;
  const isComercial = !isAdmin && !!profile?.comercial_id;
  const isLimitado = isProfissional || isComercial;
  const profissionalNome = profissional?.nome ?? null;
  const comercialId = comercial?.id ?? null;
  const comercialNome = comercial?.nome ?? null;
  const profileName = profile?.nome ?? null;

  /**
   * Filters records by `responsavel` field (for profissional-linked tables).
   * Profissionais see only their records. Comerciais see nothing. Admins/unrestricted see all.
   */
  function filterByResponsavel<T extends { responsavel?: string | null }>(records: T[]): T[] {
    if (isAdmin) return records;
    if (isProfissional && profissionalNome) {
      return records.filter(
        (r) => r.responsavel?.toLowerCase() === profissionalNome.toLowerCase()
      );
    }
    if (isComercial) return []; // Comercial shouldn't see profissional-linked data
    return records; // Unrestricted
  }

  /**
   * Filters records by `comercial_id` field (for vendedor-linked tables).
   * Comerciais see only their records. Profissionais see nothing. Admins/unrestricted see all.
   */
  function filterByComercial<T extends { comercial_id?: string | null }>(records: T[]): T[] {
    if (isAdmin) return records;
    if (isComercial && comercialId) {
      return records.filter((r) => r.comercial_id === comercialId);
    }
    if (isProfissional) return []; // Profissional shouldn't see comercial-linked data
    return records; // Unrestricted
  }

  /**
   * Filters records by `responsavel_id` field (for leads linked to vendedores).
   */
  function filterByResponsavelId<T extends { responsavel_id?: string | null }>(records: T[]): T[] {
    if (isAdmin) return records;
    if (isComercial && comercialId) {
      return records.filter((r) => r.responsavel_id === comercialId);
    }
    if (isProfissional) return []; // Profissional shouldn't see leads
    return records; // Unrestricted
  }

  return {
    isAdmin,
    isLimitado,
    isProfissional,
    isComercial,
    profissionalNome,
    comercialId,
    comercialNome,
    profileName,
    filterByResponsavel,
    filterByComercial,
    filterByResponsavelId,
  };
}
