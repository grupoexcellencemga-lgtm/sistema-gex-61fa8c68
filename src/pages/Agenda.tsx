import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { CalendarioMes } from "@/components/agenda/CalendarioMes";
import {
  AgendaItem,
  AgendaTipo,
  TIPO_CONFIG,
  NOMES_MES,
  hojeISO,
} from "@/components/agenda/agendaUtils";

const Agenda = () => {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [ref, setRef] = useState(() => {
    const h = new Date(Date.now() - 3 * 3_600_000);
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [tiposAtivos, setTiposAtivos] = useState<Record<AgendaTipo, boolean>>({
    evento: true,
    turma: true,
    tarefa: true,
    google: true,
  });

  // Janela do mês visível (com folga p/ dias vizinhos que aparecem na grade)
  const inicio = new Date(ref.getFullYear(), ref.getMonth() - 1, 20)
    .toISOString()
    .slice(0, 10);
  const fim = new Date(ref.getFullYear(), ref.getMonth() + 2, 10)
    .toISOString()
    .slice(0, 10);

  const { data: eventos = [], isLoading: l1 } = useQuery({
    queryKey: ["agenda-eventos", inicio, fim, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id, nome, data")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .not("data", "is", null)
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: encontros = [], isLoading: l2 } = useQuery({
    queryKey: ["agenda-encontros", inicio, fim, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encontros")
        .select("id, turma_id, data, sessao_numero, turmas(nome)")
        .eq("empresa_id", empresaId!)
        .not("data", "is", null)
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: tarefas = [], isLoading: l3 } = useQuery({
    queryKey: ["agenda-tarefas", inicio, fim, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("id, titulo, data_vencimento, status, evento_id")
        .eq("empresa_id", empresaId!)
        .not("data_vencimento", "is", null)
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: googleEventos = [] } = useQuery({
    queryKey: ["agenda-google", inicio, fim, empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("google_agenda_eventos")
        .select("id, titulo, data, hora, cor")
        .eq("empresa_id", empresaId!)
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const hoje = hojeISO();

  const itens: AgendaItem[] = useMemo(() => {
    const lista: AgendaItem[] = [];
    if (tiposAtivos.evento) {
      eventos.forEach((e: any) =>
        lista.push({
          id: e.id,
          tipo: "evento",
          titulo: e.nome,
          data: e.data,
          url: `/eventos?evento=${e.id}`,
        }),
      );
    }
    if (tiposAtivos.turma) {
      encontros.forEach((s: any) =>
        lista.push({
          id: s.id,
          tipo: "turma",
          titulo: `${s.turmas?.nome || "Turma"} — Sessão ${s.sessao_numero}`,
          data: s.data,
          url: `/turmas?turma=${s.turma_id}&tab=presenca`,
        }),
      );
    }
    if (tiposAtivos.tarefa) {
      tarefas.forEach((t: any) =>
        lista.push({
          id: t.id,
          tipo: "tarefa",
          titulo: t.titulo,
          data: t.data_vencimento,
          url: t.evento_id ? `/eventos?evento=${t.evento_id}` : `/tarefas`,
          concluida: t.status === "concluida",
          atrasada:
            t.status === "pendente" &&
            !!t.data_vencimento &&
            t.data_vencimento < hoje,
        }),
      );
    }
    if (tiposAtivos.google) {
      googleEventos.forEach((g: any) =>
        lista.push({
          id: g.id,
          tipo: "google",
          titulo: g.hora ? `${g.hora} ${g.titulo}` : g.titulo,
          data: g.data,
          url: "", // espelho do Google é só visualização
          cor: g.cor || undefined,
        }),
      );
    }
    return lista;
  }, [eventos, encontros, tarefas, googleEventos, tiposAtivos, hoje]);

  const isLoading = l1 || l2 || l3;
  const irMes = (delta: number) =>
    setRef((r) => new Date(r.getFullYear(), r.getMonth() + delta, 1));
  const irHoje = () => {
    const h = new Date(Date.now() - 3 * 3_600_000);
    setRef(new Date(h.getFullYear(), h.getMonth(), 1));
  };

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Eventos, sessões de turma e tarefas do mês num só lugar"
      />

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={irHoje}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => irMes(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => irMes(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-1">
            {NOMES_MES[ref.getMonth()]} de {ref.getFullYear()}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(Object.keys(TIPO_CONFIG) as AgendaTipo[]).map((tipo) => {
            const cfg = TIPO_CONFIG[tipo];
            const ativo = tiposAtivos[tipo];
            return (
              <button
                key={tipo}
                onClick={() =>
                  setTiposAtivos((p) => ({ ...p, [tipo]: !p[tipo] }))
                }
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${ativo ? "bg-secondary" : "opacity-50"}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <CalendarioMes
          mesRef={ref}
          itens={itens}
          onItemClick={(item) => {
            if (item.url) navigate(item.url);
          }}
        />
      )}
    </div>
  );
};

export default Agenda;
