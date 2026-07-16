import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { ETAPA_CORES, ETAPA_CORES_LIST, TIPO_ETAPA_LABELS, type FunilEtapa } from "./funilUtils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string }) => Promise<void>;
  initialData?: FunilEtapa | null;
}

export function FunilEtapaDialog({ open, onClose, onSave, initialData }: Props) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("slate");
  const [tipo, setTipo] = useState<FunilEtapa["tipo"]>("em_andamento");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(initialData?.nome ?? "");
      setCor(initialData?.cor ?? "slate");
      setTipo(initialData?.tipo ?? "em_andamento");
      setObservacoes(initialData?.observacoes ?? "");
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    setLoading(true);
    try {
      await onSave({ nome: nome.trim(), cor, tipo, observacoes });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar coluna do funil" : "Nova coluna do funil"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label>Nome da coluna</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Qualificando, Proposta enviada..."
              className="mt-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {ETAPA_CORES_LIST.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  title={c}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${ETAPA_CORES[c].dot} ${
                    cor === c ? "border-foreground scale-125 shadow-md" : "border-transparent hover:scale-110"
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>O que essa coluna representa</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as FunilEtapa["tipo"])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_ETAPA_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Usado nas métricas e no dashboard (conversão, perdidos, pipeline em aberto) —
              não muda o que aparece na coluna, só como ela conta nos números.
            </p>
          </div>

          <div>
            <Label>Observações da coluna</Label>
            <div className="mt-1">
              <RichTextEditor
                key={initialData?.id ?? "new"}
                value={observacoes}
                onChange={setObservacoes}
                placeholder="Critérios, instruções, detalhes desta etapa..."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !nome.trim()}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initialData ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
