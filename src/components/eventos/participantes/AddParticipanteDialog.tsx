import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Loader2, Search, CheckCircle2 } from "lucide-react";
import {
  formatPhone,
  formatCurrencyNullable as formatCurrency,
} from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evento: any;
  partForm: any;
  setPartForm: (fn: any) => void;
  alunoSearch: string;
  setAlunoSearch: (v: string) => void;
  selectedAlunoId: string | null;
  setSelectedAlunoId: (v: string | null) => void;
  alunosCadastrados: any[];
  onSave: () => void;
  isSaving: boolean;
}

export function AddParticipanteDialog({
  open,
  onOpenChange,
  evento,
  partForm,
  setPartForm,
  alunoSearch,
  setAlunoSearch,
  selectedAlunoId,
  setSelectedAlunoId,
  alunosCadastrados,
  onSave,
  isSaving,
}: Props) {
  const isPago = evento.pago;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Participante</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buscar aluno cadastrado</Label>
            <div className="relative">
              <Input
                value={alunoSearch}
                onChange={(e) => {
                  setAlunoSearch(e.target.value);
                  setSelectedAlunoId(null);
                }}
                placeholder="Digite o nome do aluno..."
              />
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            {alunoSearch.length >= 2 && !selectedAlunoId && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {alunosCadastrados
                  .filter((a: any) =>
                    a.nome.toLowerCase().includes(alunoSearch.toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((a: any) => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b last:border-b-0"
                      onClick={() => {
                        setSelectedAlunoId(a.id);
                        setAlunoSearch(a.nome);
                        setPartForm((f: any) => ({
                          ...f,
                          nome: a.nome,
                          email: a.email || "",
                          telefone: a.telefone ? formatPhone(a.telefone) : "",
                        }));
                      }}
                    >
                      <span className="font-medium">{a.nome}</span>
                      {a.email && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {a.email}
                        </span>
                      )}
                    </button>
                  ))}
                {alunosCadastrados.filter((a: any) =>
                  a.nome.toLowerCase().includes(alunoSearch.toLowerCase()),
                ).length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum aluno encontrado
                  </p>
                )}
              </div>
            )}
            {selectedAlunoId && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Aluno selecionado — campos
                preenchidos automaticamente
              </p>
            )}
          </div>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 border-t" />
            <span className="text-xs text-muted-foreground">
              ou preencha manualmente
            </span>
            <div className="flex-1 border-t" />
          </div>

          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={partForm.nome}
              onChange={(e) => {
                setPartForm((f: any) => ({ ...f, nome: e.target.value }));
                if (selectedAlunoId) {
                  setSelectedAlunoId(null);
                  setAlunoSearch("");
                }
              }}
              placeholder="Nome completo"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={partForm.email}
                onChange={(e) =>
                  setPartForm((f: any) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={partForm.telefone}
                onChange={(e) =>
                  setPartForm((f: any) => ({
                    ...f,
                    telefone: formatPhone(e.target.value),
                  }))
                }
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Input
              value={partForm.observacoes}
              onChange={(e) =>
                setPartForm((f: any) => ({
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
                  value={partForm.tipo_participante}
                  onValueChange={(v) =>
                    setPartForm((f: any) => ({
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
              {partForm.tipo_participante === "convidado" && (
                <div className="space-y-2">
                  <Label>Convidado(a) por</Label>
                  <Input
                    value={partForm.convidado_por}
                    onChange={(e) =>
                      setPartForm((f: any) => ({
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
          {isPago && (
            <p className="text-sm text-muted-foreground">
              Valor do evento: <strong>{formatCurrency(evento.valor)}</strong> —
              será atribuído automaticamente ao participante.
            </p>
          )}
          <Button onClick={onSave} disabled={isSaving} className="w-full">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Adicionar Participante
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
