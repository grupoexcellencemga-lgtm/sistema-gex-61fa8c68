import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarDays, MapPin, CheckCircle2, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { toast } from "sonner";

const Inscricao = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const [searchParams] = useSearchParams();
  const utmSource = searchParams.get("utm_source") ?? undefined;
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", observacoes: "" });
  const [submitted, setSubmitted] = useState(false);

  const { data: evento, isLoading, error } = useQuery({
    queryKey: ["inscricao-evento", eventoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eventos")
        .select("id, nome, data, local, descricao, pago, valor, limite_participantes, tipo, status, pergunta_inscricao, asaas_link_pagamento")
        .eq("id", eventoId)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventoId,
  });

  const { data: totalInscritos = 0 } = useQuery({
    queryKey: ["inscricao-total", eventoId],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("participantes_eventos")
        .select("id", { count: "exact", head: true })
        .eq("evento_id", eventoId);
      return count ?? 0;
    },
    enabled: !!eventoId,
  });

  const inscrever = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const { error } = await (supabase as any).from("participantes_eventos").insert({
        evento_id: eventoId,
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        observacoes: form.observacoes.trim() || null,
        tipo_participante: "inscricao_online",
        status_pagamento: evento?.pago ? "pendente" : "gratuito",
        presenca: false,
        comprovantes_urls: [],
        utm_source: utmSource ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast.error(e.message || "Erro ao realizar inscrição"),
  });

  const vagas = evento?.limite_participantes
    ? Math.max(evento.limite_participantes - totalInscritos, 0)
    : null;
  const esgotado = vagas !== null && vagas === 0;
  const encerrado = evento?.status === "finalizado" || evento?.status === "cancelado";

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error || !evento) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <p className="text-xl font-semibold">Evento não encontrado</p>
        <p className="text-muted-foreground text-sm">Verifique o link e tente novamente.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold">Inscrição confirmada!</h1>
        <p className="text-muted-foreground">
          Você está inscrito em <strong>{evento.nome}</strong>.
          {evento.pago && !evento.asaas_link_pagamento && " Em breve entraremos em contato com as informações de pagamento."}
        </p>
        {evento.data && (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> {formatDate(evento.data)}
          </p>
        )}
        {evento.local && (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <MapPin className="h-4 w-4" /> {evento.local}
          </p>
        )}
        {evento.pago && evento.asaas_link_pagamento && (
          <div className="pt-2 space-y-2">
            <p className="text-sm font-medium">Agora realize o pagamento para garantir sua vaga:</p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => window.open(evento.asaas_link_pagamento, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Pagar agora
            </Button>
            <p className="text-xs text-muted-foreground">Você será redirecionado para o ambiente seguro de pagamento.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Banner de cabeçalho */}
      <div className="bg-primary text-primary-foreground py-10 px-4 text-center">
        <p className="text-sm uppercase tracking-widest opacity-80 mb-2">Inscrição</p>
        <h1 className="text-3xl font-bold max-w-xl mx-auto leading-tight">{evento.nome}</h1>
        {evento.data && (
          <p className="mt-3 text-sm opacity-80 flex items-center justify-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> {formatDate(evento.data)}
          </p>
        )}
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          {evento.descricao && (
            <p className="text-muted-foreground text-sm text-center">{evento.descricao}</p>
          )}

          {(esgotado || encerrado) ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center space-y-2">
              <p className="font-semibold text-lg">{encerrado ? "Evento encerrado" : "Vagas esgotadas"}</p>
              <p className="text-sm text-muted-foreground">
                {encerrado
                  ? "Este evento já foi encerrado."
                  : "Todas as vagas foram preenchidas. Fique de olho nos próximos eventos!"}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-lg">Preencha seus dados</h2>

              <div className="space-y-1">
                <Label>Nome completo *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1">
                <Label>WhatsApp</Label>
                <Input
                  type="tel"
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-1">
                <Label>{evento.pergunta_inscricao || "Como ficou sabendo deste evento?"}</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder={evento.pergunta_inscricao ? "" : "Instagram, indicação, WhatsApp..."}
                  rows={2}
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => inscrever.mutate()}
                disabled={inscrever.isPending || !form.nome.trim()}
              >
                {inscrever.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Inscrevendo...</>
                  : "Confirmar inscrição"}
              </Button>

              {evento.pago && (
                <p className="text-xs text-muted-foreground text-center">
                  Após a inscrição entraremos em contato com as informações de pagamento.
                </p>
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground pb-6">
            Grupo Excellence · Sistema GEx
          </p>
        </div>
      </div>
    </div>
  );
};

export default Inscricao;
