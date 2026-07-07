import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, CalendarDays, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function GoogleAgendaSection() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");

  const { data: cfg, isLoading } = useQuery({
    queryKey: ["google-agenda-config"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("google_agenda_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (cfg?.ical_url) setUrl(cfg.ical_url);
  }, [cfg?.ical_url]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = { ical_url: url.trim(), ativo: true, updated_at: new Date().toISOString() };
      if (cfg?.id) {
        const { error } = await (supabase as any).from("google_agenda_config").update(payload).eq("id", cfg.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("google_agenda_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-agenda-config"] });
      toast.success("Link salvo");
    },
    onError: (e: any) => toast.error("Erro (só admin configura): " + e.message),
  });

  const sincronizar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-google-agenda");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["google-agenda-config"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-google"] });
      toast.success(`${d.importados} evento(s) do Google importado(s)`);
    },
    onError: (e: any) => toast.error("Erro ao sincronizar: " + e.message),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Espelho do Google Agenda
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cole o link secreto (formato iCal) da sua agenda do Google. Os eventos aparecerão na tela Agenda do GEx.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Link secreto iCal do Google</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            />
            <p className="text-[11px] text-muted-foreground">
              Google Agenda → Configurações → selecione a agenda → "Endereço secreto no formato iCal" → Copiar.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => salvar.mutate()} disabled={!url.trim() || salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar link
            </Button>
            <Button
              variant="outline"
              onClick={() => sincronizar.mutate()}
              disabled={!cfg?.ical_url || sincronizar.isPending}
            >
              {sincronizar.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar agora
            </Button>
          </div>

          {isLoading ? null : cfg?.ultima_sync && (
            <div className="text-xs flex items-center gap-2 pt-1">
              {cfg.ultimo_erro ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-destructive">Último erro: {cfg.ultimo_erro}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-muted-foreground">
                    Última sincronização: {new Date(cfg.ultima_sync).toLocaleString("pt-BR")}
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Dica: use uma agenda de equipe compartilhada como fonte. O espelho é somente leitura — editar é sempre no Google.
      </p>
    </div>
  );
}
