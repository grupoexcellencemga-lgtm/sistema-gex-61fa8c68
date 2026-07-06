import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getComprovantesParticipante,
  normalizarTexto,
  normalizarTelefone,
} from "./participantesUtils";

interface Options {
  evento: any;
  currentUserName: string | null;
  encontrarAlunoDoParticipante: (participante: any) => any;
  selectedParticipante: any;
  setSelectedParticipante: (fn: any) => void;
  setPartDetailOpen: (v: boolean) => void;
  setIsEditingParticipante: (v: boolean) => void;
  setAddParticipanteOpen: (v: boolean) => void;
  resetPartForm: () => void;
}

export function useParticipantesActions({
  evento,
  currentUserName,
  encontrarAlunoDoParticipante,
  selectedParticipante,
  setSelectedParticipante,
  setPartDetailOpen,
  setIsEditingParticipante,
  setAddParticipanteOpen,
  resetPartForm,
}: Options) {
  const queryClient = useQueryClient();
  const [uploadingComprovante, setUploadingComprovante] = useState(false);

  const addParticipanteMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("participantes_eventos").insert({
        evento_id: evento.id,
        nome: data.nome.trim(),
        email: data.email.trim() || null,
        telefone: data.telefone.replace(/\D/g, "") || null,
        observacoes: data.observacoes.trim() || null,
        valor: evento.pago ? evento.valor || 0 : 0,
        status_pagamento: evento.pago ? "pendente" : "gratuito",
        tipo_participante: data.tipo_participante || null,
        convidado_por:
          data.tipo_participante === "convidado"
            ? data.convidado_por.trim() || null
            : null,
        adicionado_por_nome: currentUserName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      queryClient.invalidateQueries({
        queryKey: ["all_participantes_eventos"],
      });
      toast.success("Participante adicionado");
      setAddParticipanteOpen(false);
      resetPartForm();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteParticipanteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("participantes_eventos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      queryClient.invalidateQueries({
        queryKey: ["all_participantes_eventos"],
      });
      toast.success("Participante removido");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("participantes_eventos")
        .update({
          status_pagamento: data.status_pagamento,
          forma_pagamento: data.forma_pagamento || null,
          data_pagamento: data.data_pagamento || null,
          valor: data.valor,
          conta_bancaria_id: data.conta_bancaria_id || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      toast.success("Pagamento atualizado");
      setPartDetailOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateParticipanteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("participantes_eventos")
        .update({
          nome: data.nome,
          email: data.email,
          telefone: data.telefone,
          observacoes: data.observacoes,
          tipo_participante: data.tipo_participante,
          convidado_por: data.convidado_por,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      toast.success("Participante atualizado");
      setIsEditingParticipante(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const virarAlunoMutation = useMutation({
    mutationFn: async (participante: any) => {
      const alunoExistente = encontrarAlunoDoParticipante(participante);

      if (alunoExistente) {
        return { criado: false, aluno: alunoExistente };
      }

      const telefone = normalizarTelefone(participante.telefone) || null;
      const email = normalizarTexto(participante.email) || null;

      const { data: alunoCriado, error } = await supabase
        .from("alunos")
        .insert({
          nome: participante.nome.trim(),
          email,
          telefone,
        })
        .select("id, nome, email, telefone")
        .single();

      if (error) throw error;

      await supabase.from("atividades").insert({
        tipo: "cadastro",
        descricao: `Aluno criado a partir do evento "${evento.nome}". Participante convertido: ${participante.nome}.`,
        aluno_id: alunoCriado.id,
      });

      return { criado: true, aluno: alunoCriado };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      queryClient.invalidateQueries({ queryKey: ["alunos-evento"] });

      if (result.criado) {
        toast.success("Participante convertido em aluno");
      } else {
        toast.info("Este participante já está cadastrado como aluno");
      }
    },
    onError: (err: any) =>
      toast.error("Erro ao converter participante: " + err.message),
  });

  const togglePresencaMutation = useMutation({
    mutationFn: async ({ id, presenca }: { id: string; presenca: boolean }) => {
      const { error } = await supabase
        .from("participantes_eventos")
        .update({
          presenca,
          presenca_marcada_em: presenca ? new Date().toISOString() : null,
          presenca_marcada_por: presenca ? currentUserName : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] }),
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const uploadComprovantes = async (files: File[]) => {
    if (!files.length || !selectedParticipante) return;

    setUploadingComprovante(true);

    try {
      const comprovantesAtuais =
        getComprovantesParticipante(selectedParticipante);
      const novosComprovantes: Array<{ url: string; nome: string }> = [];

      for (const file of files) {
        const ext = file.name.split(".").pop();
        const filePath = `${selectedParticipante.id}/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("comprovantes_eventos")
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("comprovantes_eventos")
          .getPublicUrl(filePath);

        novosComprovantes.push({ url: urlData.publicUrl, nome: file.name });
      }

      const comprovantes_urls = [...comprovantesAtuais, ...novosComprovantes];
      const primeiroComprovante = comprovantes_urls[0] || null;

      const { error: updateError } = await (supabase as any)
        .from("participantes_eventos")
        .update({
          comprovante_url: primeiroComprovante?.url || null,
          comprovantes_urls,
        })
        .eq("id", selectedParticipante.id);

      if (updateError) throw updateError;

      setSelectedParticipante((prev: any) => ({
        ...prev,
        comprovante_url: primeiroComprovante?.url || null,
        comprovantes_urls,
      }));

      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      toast.success("Comprovante(s) anexado(s)!");
    } catch (err: any) {
      toast.error("Erro ao enviar comprovante: " + err.message);
    } finally {
      setUploadingComprovante(false);
    }
  };

  const deleteComprovante = async (indexToRemove?: number) => {
    if (!selectedParticipante) return;

    try {
      const atuais = getComprovantesParticipante(selectedParticipante);
      const comprovantes_urls =
        typeof indexToRemove === "number"
          ? atuais.filter((_: any, index: number) => index !== indexToRemove)
          : [];

      const primeiroComprovante = comprovantes_urls[0] || null;

      await (supabase as any)
        .from("participantes_eventos")
        .update({
          comprovante_url: primeiroComprovante?.url || null,
          comprovantes_urls,
        })
        .eq("id", selectedParticipante.id);

      setSelectedParticipante((prev: any) => ({
        ...prev,
        comprovante_url: primeiroComprovante?.url || null,
        comprovantes_urls,
      }));

      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      toast.success("Comprovante removido");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  };

  return {
    addParticipanteMutation,
    deleteParticipanteMutation,
    updatePaymentMutation,
    updateParticipanteMutation,
    virarAlunoMutation,
    togglePresencaMutation,
    uploadingComprovante,
    uploadComprovantes,
    deleteComprovante,
  };
}
