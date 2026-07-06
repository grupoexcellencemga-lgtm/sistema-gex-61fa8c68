import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatPhone } from "@/lib/formatters";

interface Props {
  evento: any;
  editPartForm: any;
  setEditPartForm: (fn: any) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function ParticipanteEditForm({
  evento,
  editPartForm,
  setEditPartForm,
  onCancel,
  onSave,
  isSaving,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nome *</Label>
        <Input
          value={editPartForm.nome}
          onChange={(e) =>
            setEditPartForm((f: any) => ({ ...f, nome: e.target.value }))
          }
          placeholder="Nome completo"
        />
      </div>
      <div className="space-y-2">
        <Label>E-mail</Label>
        <Input
          type="email"
          value={editPartForm.email}
          onChange={(e) =>
            setEditPartForm((f: any) => ({ ...f, email: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input
          value={editPartForm.telefone}
          onChange={(e) =>
            setEditPartForm((f: any) => ({
              ...f,
              telefone: formatPhone(e.target.value),
            }))
          }
          placeholder="(00) 00000-0000"
          maxLength={15}
        />
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Input
          value={editPartForm.observacoes}
          onChange={(e) =>
            setEditPartForm((f: any) => ({
              ...f,
              observacoes: e.target.value,
            }))
          }
        />
      </div>
      {evento.comunidade && (
        <>
          <div className="space-y-2">
            <Label>Tipo de participante</Label>
            <Select
              value={editPartForm.tipo_participante}
              onValueChange={(v) =>
                setEditPartForm((f: any) => ({
                  ...f,
                  tipo_participante: v,
                  convidado_por: v !== "convidado" ? "" : f.convidado_por,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comunidade">Comunidade</SelectItem>
                <SelectItem value="convidado">Convidado(a)</SelectItem>
                <SelectItem value="divulgacao">Divulgação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {editPartForm.tipo_participante === "convidado" && (
            <div className="space-y-2">
              <Label>Convidado(a) por</Label>
              <Input
                value={editPartForm.convidado_por}
                onChange={(e) =>
                  setEditPartForm((f: any) => ({
                    ...f,
                    convidado_por: e.target.value,
                  }))
                }
                placeholder="Nome de quem convidou"
              />
            </div>
          )}
        </>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="flex-1" onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar Dados
        </Button>
      </div>
    </div>
  );
}
