import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, CreditCard, DollarSign } from "lucide-react";
import { formatPhone } from "@/lib/formatters";
import { ParticipanteEditForm } from "./ParticipanteEditForm";
import { ParticipanteComprovantes } from "./ParticipanteComprovantes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evento: any;
  participante: any;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  editPartForm: any;
  setEditPartForm: (fn: any) => void;
  payForm: any;
  setPayForm: (fn: any) => void;
  formasPagamento: any[];
  contasBancarias: any[];
  alunoVinculado: any;
  onVirarAluno: (p: any) => void;
  virarAlunoPending: boolean;
  onSaveEdit: () => void;
  savingEdit: boolean;
  onSavePayment: () => void;
  savingPayment: boolean;
  uploadingComprovante: boolean;
  onUploadComprovantes: (files: File[]) => void;
  onDeleteComprovante: (index?: number) => void;
}

export function ParticipanteDetailDialog({
  open,
  onOpenChange,
  evento,
  participante,
  isEditing,
  setIsEditing,
  editPartForm,
  setEditPartForm,
  payForm,
  setPayForm,
  formasPagamento,
  contasBancarias,
  alunoVinculado,
  onVirarAluno,
  virarAlunoPending,
  onSaveEdit,
  savingEdit,
  onSavePayment,
  savingPayment,
  uploadingComprovante,
  onUploadComprovantes,
  onDeleteComprovante,
}: Props) {
  const isPago = evento.pago;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {participante?.nome}
          </DialogTitle>
          <DialogDescription>
            Informações do participante e pagamento
          </DialogDescription>
        </DialogHeader>
        {participante && (
          <div className="space-y-4">
            {isEditing ? (
              <ParticipanteEditForm
                evento={evento}
                editPartForm={editPartForm}
                setEditPartForm={setEditPartForm}
                onCancel={() => setIsEditing(false)}
                onSave={onSaveEdit}
                isSaving={savingEdit}
              />
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    Dados do participante
                  </span>
                  <Button
                    variant={alunoVinculado ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!!alunoVinculado || virarAlunoPending}
                    onClick={() => onVirarAluno(participante)}
                  >
                    {virarAlunoPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : null}
                    {alunoVinculado ? "Já é aluno" : "Virar aluno"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail:</span>
                  <p className="font-medium break-all">
                    {participante.email || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-medium">
                    {participante.telefone
                      ? formatPhone(participante.telefone)
                      : "—"}
                  </p>
                </div>
                {evento.comunidade && (
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>
                    <p className="font-medium">
                      {participante.tipo_participante === "comunidade"
                        ? "Comunidade"
                        : participante.tipo_participante === "convidado"
                          ? "Convidado(a)"
                          : participante.tipo_participante === "divulgacao"
                            ? "Divulgação"
                            : "—"}
                    </p>
                  </div>
                )}
                {evento.comunidade &&
                  participante.tipo_participante === "convidado" &&
                  participante.convidado_por && (
                    <div>
                      <span className="text-muted-foreground">
                        Convidado(a) por:
                      </span>
                      <p className="font-medium">
                        {participante.convidado_por}
                      </p>
                    </div>
                  )}
                {participante.observacoes && (
                  <div>
                    <span className="text-muted-foreground">Observações:</span>
                    <p className="font-medium">{participante.observacoes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Informações de Pagamento
              </h3>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payForm.valor}
                  onChange={(e) =>
                    setPayForm((f: any) => ({ ...f, valor: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status do pagamento</Label>
                <Select
                  value={payForm.status_pagamento}
                  onValueChange={(v) =>
                    setPayForm((f: any) => ({ ...f, status_pagamento: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="gratuito">Gratuito</SelectItem>
                    <SelectItem value="permuta">Permuta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {payForm.status_pagamento === "pago" && (
                <>
                  <div className="space-y-2">
                    <Label>Forma de pagamento</Label>
                    <Select
                      value={payForm.forma_pagamento}
                      onValueChange={(v) =>
                        setPayForm((f: any) => ({ ...f, forma_pagamento: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {formasPagamento.length === 0 ? (
                          <SelectItem value="nenhuma_forma_pagamento" disabled>
                            Nenhuma forma cadastrada
                          </SelectItem>
                        ) : (
                          formasPagamento.map((forma: any) => (
                            <SelectItem key={forma.id} value={forma.codigo}>
                              {forma.nome}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data do pagamento</Label>
                    <Input
                      type="date"
                      value={payForm.data_pagamento}
                      onChange={(e) =>
                        setPayForm((f: any) => ({
                          ...f,
                          data_pagamento: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conta Bancária</Label>
                    <Select
                      value={payForm.conta_bancaria_id}
                      onValueChange={(v) =>
                        setPayForm((f: any) => ({
                          ...f,
                          conta_bancaria_id: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar banco..." />
                      </SelectTrigger>
                      <SelectContent>
                        {contasBancarias.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <Button
              className="w-full"
              onClick={onSavePayment}
              disabled={savingPayment}
            >
              {savingPayment && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Salvar Pagamento
            </Button>

            {isPago && (
              <ParticipanteComprovantes
                participante={participante}
                uploading={uploadingComprovante}
                onUpload={onUploadComprovantes}
                onDelete={onDeleteComprovante}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
