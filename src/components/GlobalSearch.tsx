import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Search, Users, UserCheck, Calendar, Package, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAlunoLabel } from "@/hooks/useAlunoLabel";

interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  route: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const { plural: alunoPlural } = useAlunoLabel();

  const [alunos, setAlunos] = useState<SearchResult[]>([]);
  const [leads, setLeads] = useState<SearchResult[]>([]);
  const [eventos, setEventos] = useState<SearchResult[]>([]);
  const [produtos, setProdutos] = useState<SearchResult[]>([]);
  const [turmas, setTurmas] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2 || !empresaId) {
      setAlunos([]); setLeads([]); setEventos([]); setProdutos([]); setTurmas([]);
      return;
    }
    setLoading(true);
    const pattern = `%${term}%`;

    const [aRes, lRes, eRes, pRes, tRes] = await Promise.all([
      supabase.from("alunos").select("id, nome, email, cpf").eq("empresa_id", empresaId).is("deleted_at", null)
        .or(`nome.ilike.${pattern},email.ilike.${pattern},cpf.ilike.${pattern}`)
        .limit(5),
      supabase.from("leads").select("id, nome, email").eq("empresa_id", empresaId).is("deleted_at", null)
        .or(`nome.ilike.${pattern},email.ilike.${pattern}`)
        .limit(5),
      supabase.from("eventos").select("id, nome, data").eq("empresa_id", empresaId)
        .is("deleted_at", null).ilike("nome", pattern)
        .limit(5),
      supabase.from("produtos").select("id, nome, tipo").eq("empresa_id", empresaId)
        .is("deleted_at", null).ilike("nome", pattern)
        .limit(5),
      supabase.from("turmas").select("id, nome, cidade").eq("empresa_id", empresaId)
        .is("deleted_at", null).ilike("nome", pattern)
        .limit(5),
    ]);

    setAlunos((aRes.data || []).map((a) => ({ id: a.id, label: a.nome, subtitle: a.email || a.cpf || undefined, route: "/alunos" })));
    setLeads((lRes.data || []).map((l) => ({ id: l.id, label: l.nome, subtitle: l.email || undefined, route: "/funil" })));
    setEventos((eRes.data || []).map((e) => ({ id: e.id, label: e.nome, subtitle: e.data || undefined, route: "/eventos" })));
    setProdutos((pRes.data || []).map((p) => ({ id: p.id, label: p.nome, subtitle: p.tipo || undefined, route: "/produtos" })));
    setTurmas((tRes.data || []).map((t) => ({ id: t.id, label: t.nome, subtitle: t.cidade || undefined, route: "/turmas" })));
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { search(debouncedQuery); }, [debouncedQuery, search]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.route);
  };

  const hasResults = alunos.length + leads.length + eventos.length + produtos.length + turmas.length > 0;

  const groups: { heading: string; icon: React.ReactNode; items: SearchResult[] }[] = [
    { heading: alunoPlural, icon: <Users className="h-4 w-4 mr-2 text-muted-foreground" />, items: alunos },
    { heading: "Leads", icon: <UserCheck className="h-4 w-4 mr-2 text-muted-foreground" />, items: leads },
    { heading: "Eventos", icon: <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />, items: eventos },
    { heading: "Produtos", icon: <Package className="h-4 w-4 mr-2 text-muted-foreground" />, items: produtos },
    { heading: "Turmas", icon: <GraduationCap className="h-4 w-4 mr-2 text-muted-foreground" />, items: turmas },
  ];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative h-9 w-9 sm:w-64 sm:justify-start sm:px-3 text-muted-foreground"
      >
        <Search className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline-flex">Buscar...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-auto">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={`Buscar ${alunoPlural.toLowerCase()}, leads, eventos...`} value={query} onValueChange={setQuery} />
        <CommandList>
          {!loading && !hasResults && debouncedQuery.length >= 2 && (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          )}
          {!loading && debouncedQuery.length < 2 && (
            <CommandEmpty>Digite pelo menos 2 caracteres...</CommandEmpty>
          )}
          {groups.map((group) =>
            group.items.length > 0 ? (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem key={item.id} value={`${item.label} ${item.subtitle || ""}`} onSelect={() => handleSelect(item)}>
                    {group.icon}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.subtitle && <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
