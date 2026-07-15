import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, Loader2, AlertTriangle, Clock, Volume2, VolumeX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { playNotificationSound, somNotificacaoLigado, definirSomNotificacao } from "@/lib/notificationSound";

const tipoIcons: Record<string, string> = {
  pagamento_vencido: "💰",
  novo_lead: "🎯",
  aniversario: "🎂",
  sessao_proxima: "📅",
  meta_atingida: "🏆",
  lead_sem_contato: "⏳",
  tarefa_atribuida: "✅",
};

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const [somLigado, setSomLigado] = useState(somNotificacaoLigado());

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notificacoes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Tarefas de checklist de EVENTO atrasadas/urgentes do usuário (ao vivo, sem cron).
  const hojeISO = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const { data: tarefasEvento = [] } = useQuery({
    queryKey: ["notif-tarefas-evento", user?.id, hojeISO],
    queryFn: async () => {
      if (!user) return [];
      const limite = new Date(Date.now() - 3 * 3_600_000 + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10); // hoje + 2 dias = janela "urgente"

      const { data: responsaveisData } = await (supabase as any)
        .from("tarefas_responsaveis")
        .select("tarefa_id")
        .eq("user_id", user.id);

      const tarefaIds = (responsaveisData || []).map((r: any) => r.tarefa_id);
      if (tarefaIds.length === 0) return [];

      const { data } = await (supabase as any)
        .from("tarefas")
        .select("id, titulo, data_vencimento, evento_id, eventos(nome)")
        .in("id", tarefaIds)
        .eq("status", "pendente")
        .not("evento_id", "is", null)
        .not("data_vencimento", "is", null)
        .lte("data_vencimento", limite)
        .order("data_vencimento", { ascending: true });
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const unreadCount = notifications.filter((n: any) => !n.lida).length;
  const badgeCount = unreadCount + tarefasEvento.length;

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notificacoes-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notificacoes", user.id] });
          setHasNew(true);
          playNotificationSound();
          setTimeout(() => setHasNew(false), 3000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("user_id", user.id)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes", user?.id] });
    },
  });

  const markOneRead = useCallback(async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notificacoes", user?.id] });
  }, [user, queryClient]);

  const handleClick = (notif: any) => {
    if (!notif.lida) markOneRead(notif.id);
    if (notif.link) navigate(notif.link);
    setOpen(false);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className={cn("h-5 w-5", hasNew && "animate-wiggle")} />
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notificações</h4>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={somLigado ? "Som ligado — clique para silenciar" : "Som desligado — clique para ativar"}
              onClick={() => {
                const novo = !somLigado;
                setSomLigado(novo);
                definirSomNotificacao(novo);
                if (novo) playNotificationSound(); // toca uma prévia ao ligar
              }}
            >
              {somLigado ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas
              </Button>
            )}
          </div>
        </div>
        {tarefasEvento.length > 0 && (
          <div className="border-b bg-amber-50/60 dark:bg-amber-950/20">
            <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Tarefas de evento
            </p>
            <div className="divide-y divide-amber-100 dark:divide-amber-900/40">
              {tarefasEvento.map((t: any) => {
                const atrasada = t.data_vencimento < hojeISO;
                return (
                  <button
                    key={t.id}
                    className="w-full text-left px-4 py-2 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
                    onClick={() => {
                      navigate(`/eventos?evento=${t.evento_id}`);
                      setOpen(false);
                    }}
                  >
                    <div className="flex gap-2">
                      {atrasada ? (
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{t.titulo}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {t.eventos?.nome || "Evento"} ·{" "}
                          <span className={atrasada ? "text-red-600 font-medium" : "text-amber-600"}>
                            {atrasada ? "atrasada" : "vence em breve"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: any) => (
                <button
                  key={n.id}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors",
                    !n.lida && "bg-primary/5"
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className="flex gap-2.5">
                    <span className="text-base mt-0.5">{tipoIcons[n.tipo] || "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", !n.lida && "font-semibold")}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {n.mensagem}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!n.lida && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
