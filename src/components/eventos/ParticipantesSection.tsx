import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Receipt } from "lucide-react";
import { formatPhone } from "@/lib/formatters";
import { toast } from "sonner";
import { EventoMetricsDialog } from "./EventoMetricsDialog";
import { EventoDespesasTab } from "./EventoDespesasTab";
import { EventoImport } from "./EventoImport";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import {
  exportParticipantes,
  normalizarTexto,
  normalizarTelefone,
} from "./participantes/participantesUtils";
import { useParticipantesActions } from "./participantes/useParticipantesActions";
import { ParticipantesHeader } from "./participantes/ParticipantesHeader";
import { ParticipantesTable } from "./participantes/ParticipantesTable";
import { AddParticipanteDialog } from "./participantes/AddParticipanteDialog";
import { ParticipanteDetailDialog } from "./participantes/ParticipanteDetailDialog";

interface Props {
  evento: any;
  onBack: () => void;
  onEditEvento: (e: any) => void;
  currentUserName: string | null;
  produtos: any[];
  turmas: any[];
}

const emptyPartForm = {
  nome: "",
  email: "",
  telefone: "",
  observacoes: "",
  tipo_participante: "",
  convidado_por: "",
};

export function ParticipantesSection({
  evento,
  onBack,
  onEditEvento,
  currentUserName,
  produtos,
  turmas,
}: Props) {
  const { data: formasPagamento = [] } = useFormasPagamento();

  const [addParticipanteOpen, setAddParticipanteOpen] = useState(false);
  const [partForm, setPartForm] = useState({ ...emptyPartForm });
  const [alunoSearch, setAlunoSearch] = useState("");
  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(null);

  const [selectedParticipante, setSelectedParticipante] = useState<any>(null);
  const [partDetailOpen, setPartDetailOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    status_pagamento: "pendente",
    forma_pagamento: "",
    data_pagamento: "",
    valor: "",
    conta_bancaria_id: "",
  });
  const [editPartForm, setEditPartForm] = useState({ ...emptyPartForm });
  const [isEditingParticipante, setIsEditingParticipante] = useState(false);

  const [metricsOpen, setMetricsOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Queries
  const { data: participantes = [] } = useQuery({
    queryKey: ["participantes_eventos", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participantes_eventos")
        .select("*")
        .eq("evento_id", evento.id)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("id, nome")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: alunosCadastrados = [] } = useQuery({
    queryKey: ["alunos-evento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, email, telefone")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const encontrarAlunoDoParticipante = useCallback(
    (participante: any) => {
      const email = normalizarTexto(participante?.email);
      const telefone = normalizarTelefone(participante?.telefone);
      const nome = normalizarTexto(participante?.nome);

      return alunosCadastrados.find((aluno: any) => {
        const alunoEmail = normalizarTexto(aluno.email);
        const alunoTelefone = normalizarTelefone(aluno.telefone);
        const alunoNome = normalizarTexto(aluno.nome);

        if (email && alunoEmail && email === alunoEmail) return true;
        if (telefone && alunoTelefone && telefone === alunoTelefone)
          return true;

        // Quando o participante não tem telefone nem e-mail, evita duplicar pelo nome exato.
        if (!email && !telefone && nome && alunoNome && nome === alunoNome) {
          return true;
        }

        return false;
      });
    },
    [alunosCadastrados],
  );

  const {
    addParticipanteMutation,
    deleteParticipanteMutation,
    updatePaymentMutation,
    updateParticipanteMutation,
    virarAlunoMutation,
    togglePresencaMutation,
    uploadingComprovante,
    uploadComprovantes,
    deleteComprovante,
  } = useParticipantesActions({
    evento,
    currentUserName,
    encontrarAlunoDoParticipante,
    selectedParticipante,
    setSelectedParticipante,
    setPartDetailOpen,
    setIsEditingParticipante,
    setAddParticipanteOpen,
    resetPartForm: () => setPartForm({ ...emptyPartForm }),
  });

  // Helpers
  const openParticipanteDetail = (p: any) => {
    setSelectedParticipante(p);
    setPayForm({
      status_pagamento: p.status_pagamento || "pendente",
      forma_pagamento: p.forma_pagamento || "",
      data_pagamento: p.data_pagamento || "",
      valor: p.valor != null ? String(p.valor) : String(evento?.valor || 0),
      conta_bancaria_id: p.conta_bancaria_id || "",
    });
    setEditPartForm({
      nome: p.nome || "",
      email: p.email || "",
      telefone: p.telefone ? formatPhone(p.telefone) : "",
      observacoes: p.observacoes || "",
      tipo_participante: p.tipo_participante || "",
      convidado_por: p.convidado_por || "",
    });
    setIsEditingParticipante(false);
    setPartDetailOpen(true);
  };

  const saveParticipanteEdit = () => {
    if (!selectedParticipante || !editPartForm.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateParticipanteMutation.mutate({
      id: selectedParticipante.id,
      data: {
        nome: editPartForm.nome.trim(),
        email: editPartForm.email.trim() || null,
        telefone: editPartForm.telefone.replace(/\D/g, "") || null,
        observacoes: editPartForm.observacoes.trim() || null,
        tipo_participante: editPartForm.tipo_participante || null,
        convidado_por:
          editPartForm.tipo_participante === "convidado"
            ? editPartForm.convidado_por.trim() || null
            : null,
      },
    });
  };

  const savePayment = () => {
    if (!selectedParticipante) return;
    updatePaymentMutation.mutate({
      id: selectedParticipante.id,
      data: {
        status_pagamento: payForm.status_pagamento,
        forma_pagamento: payForm.forma_pagamento || null,
        data_pagamento: payForm.data_pagamento || null,
        valor: payForm.valor ? parseFloat(payForm.valor) : 0,
        conta_bancaria_id: payForm.conta_bancaria_id || null,
      },
    });
  };

  const saveParticipante = () => {
    if (!partForm.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    addParticipanteMutation.mutate(partForm);
  };

  const openAdd = () => {
    setPartForm({ ...emptyPartForm });
    setAlunoSearch("");
    setSelectedAlunoId(null);
    setAddParticipanteOpen(true);
  };

  return (
    <div className="space-y-6">
      <ParticipantesHeader
        evento={evento}
        participantes={participantes}
        produtos={produtos}
        turmas={turmas}
        onBack={onBack}
        onEditEvento={onEditEvento}
        onImportFile={setImportFile}
        onExport={() =>
          exportParticipantes(participantes, evento, formasPagamento)
        }
        onOpenMetrics={() => setMetricsOpen(true)}
        onOpenAdd={openAdd}
      />

      {importFile && (
        <EventoImport
          eventoId={evento.id}
          eventoNome={evento.nome}
          isPago={evento.pago}
          valorEvento={evento.valor}
          currentUserName={currentUserName}
          file={importFile}
          onClose={() => setImportFile(null)}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="participantes" className="w-full">
        <TabsList>
          <TabsTrigger value="participantes" className="gap-1">
            <Users className="h-4 w-4" /> Participantes
          </TabsTrigger>
          <TabsTrigger value="despesas" className="gap-1">
            <Receipt className="h-4 w-4" /> Despesas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participantes">
          <ParticipantesTable
            evento={evento}
            participantes={participantes}
            encontrarAlunoDoParticipante={encontrarAlunoDoParticipante}
            virarAlunoPending={virarAlunoMutation.isPending}
            onOpenDetail={openParticipanteDetail}
            onEdit={(p) => {
              openParticipanteDetail(p);
              setIsEditingParticipante(true);
            }}
            onDelete={(id) => deleteParticipanteMutation.mutate(id)}
            onVirarAluno={(p) => virarAlunoMutation.mutate(p)}
            onTogglePresenca={(id, presenca) =>
              togglePresencaMutation.mutate({ id, presenca })
            }
          />
        </TabsContent>

        <TabsContent value="despesas">
          <EventoDespesasTab
            eventoId={evento.id}
            eventoProdutoId={evento.produto_id}
            eventoTurmaId={evento.turma_id}
          />
        </TabsContent>
      </Tabs>

      <ParticipanteDetailDialog
        open={partDetailOpen}
        onOpenChange={(o) => {
          setPartDetailOpen(o);
          if (!o) setIsEditingParticipante(false);
        }}
        evento={evento}
        participante={selectedParticipante}
        isEditing={isEditingParticipante}
        setIsEditing={setIsEditingParticipante}
        editPartForm={editPartForm}
        setEditPartForm={setEditPartForm}
        payForm={payForm}
        setPayForm={setPayForm}
        formasPagamento={formasPagamento}
        contasBancarias={contasBancarias}
        alunoVinculado={
          selectedParticipante
            ? encontrarAlunoDoParticipante(selectedParticipante)
            : null
        }
        onVirarAluno={(p) => virarAlunoMutation.mutate(p)}
        virarAlunoPending={virarAlunoMutation.isPending}
        onSaveEdit={saveParticipanteEdit}
        savingEdit={updateParticipanteMutation.isPending}
        onSavePayment={savePayment}
        savingPayment={updatePaymentMutation.isPending}
        uploadingComprovante={uploadingComprovante}
        onUploadComprovantes={uploadComprovantes}
        onDeleteComprovante={deleteComprovante}
      />

      <AddParticipanteDialog
        open={addParticipanteOpen}
        onOpenChange={setAddParticipanteOpen}
        evento={evento}
        partForm={partForm}
        setPartForm={setPartForm}
        alunoSearch={alunoSearch}
        setAlunoSearch={setAlunoSearch}
        selectedAlunoId={selectedAlunoId}
        setSelectedAlunoId={setSelectedAlunoId}
        alunosCadastrados={alunosCadastrados}
        onSave={saveParticipante}
        isSaving={addParticipanteMutation.isPending}
      />

      <EventoMetricsDialog
        open={metricsOpen}
        onOpenChange={setMetricsOpen}
        participantes={participantes}
        evento={evento}
      />
    </div>
  );
}
