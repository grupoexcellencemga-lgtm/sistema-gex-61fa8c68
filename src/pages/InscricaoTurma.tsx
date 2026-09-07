import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarDays, MapPin, CheckCircle2, GraduationCap } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { toast } from "sonner";

const InscricaoTurma = () => {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [searchParams] = useSearchParams();
  const utmSource = searchParams.get("utm_source") ?? undefined;
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", observacoes: "" });
  const [submitted, setSubmitted] = useState(false);

  const { data: turma, isLoading, error } = useQuery({
    queryKey: ["inscricao-turma", turmaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("turmas")
        .select("id, nome, cidade, modalidade, data_inicio, data_fim, status, empresa_id, produtos(nome, valor)")
        .eq("id", turmaId)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!turmaId,
  });

  const inscrever = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const { error } = await (supabase as any).from("inscricoes_turmas").insert({
        turma_id: turmaId,
        empresa_id: turma?.empresa_id ?? null,
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        observacoes: form.observacoes.trim() || null,
        utm_source: utmSource ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast.error(e.message || "Erro ao realizar inscrição"),
  });

  const encerrada = turma?.status === "finalizada" || turma?.status === "cancelada";
  const produto = turma?.produtos;
  const valor = produto?.valor ? Number(produto.valor) : null;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error || !turma) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-2">
        <p className="text-xl font-semibold">Turma não encontrada</p>
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
        <h1 className="text-2xl font-bold">Inscrição realizada!</h1>
        <p className="text-muted-foreground">
          Seu interesse na turma <strong>{turma.nome}</strong> foi registrado.
          Em breve entraremos em contato com mais informações.
        </p>
        {turma.data_inicio && (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> Início: {formatDate(turma.data_inicio)}
          </p>
        )}
        {turma.cidade && (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <MapPin className="h-4 w-4" /> {turma.cidade} · {turma.modalidade}
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground pt-4">
          Grupo Excellence · Sistema GEx
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Cabeçalho */}
      <div className="bg-primary text-primary-foreground py-10 px-4 text-center">
        <p className="text-sm uppercase tracking-widest opacity-80 mb-2">Inscrição</p>
        <h1 className="text-3xl font-bold max-w-xl mx-auto leading-tight">{turma.nome}</h1>
        {produto?.nome && (
          <p className="mt-2 text-sm opacity-90 flex items-center justify-center gap-1.5">
            <GraduationCap className="h-4 w-4" /> {produto.nome}
          </p>
        )}
        {turma.data_inicio && (
          <p className="mt-2 text-sm opacity-80 flex items-center justify-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> Início em {formatDate(turma.data_inicio)}
          </p>
        )}
        {turma.cidade && (
          <p className="mt-1 text-sm opacity-80 flex items-center justify-center gap-1.5">
            <MapPin className="h-4 w-4" /> {turma.cidade} · {turma.modalidade}
          </p>
        )}
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          {encerrada ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center space-y-2">
              <p className="font-semibold text-lg">Turma encerrada</p>
              <p className="text-sm text-muted-foreground">
                Esta turma já foi encerrada. Fique de olho nas próximas!
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-lg">Preencha seus dados</h2>
                {valor && valor > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Investimento: <span className="font-semibold text-foreground">R$ {valor.toFixed(2).replace(".", ",")}</span>
                  </p>
                )}
              </div>

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
                <Label>Como ficou sabendo desta turma?</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Instagram, indicação, WhatsApp..."
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
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                  : "Quero me inscrever"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Após o envio, nossa equipe entrará em contato com as próximas etapas.
              </p>
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

export default InscricaoTurma;
