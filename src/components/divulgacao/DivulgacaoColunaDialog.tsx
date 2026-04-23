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
import { Loader2 } from "lucide-react";

export interface DivulgacaoColuna {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  icone: string;
}

const CORES = [
  { value: "slate",  label: "Cinza",    bg: "bg-slate-400" },
  { value: "yellow", label: "Amarelo",  bg: "bg-yellow-400" },
  { value: "orange", label: "Laranja",  bg: "bg-orange-400" },
  { value: "blue",   label: "Azul",     bg: "bg-blue-400" },
  { value: "green",  label: "Verde",    bg: "bg-green-400" },
  { value: "red",    label: "Vermelho", bg: "bg-red-400" },
  { value: "purple", label: "Roxo",     bg: "bg-purple-400" },
  { value: "pink",   label: "Rosa",     bg: "bg-pink-400" },
  { value: "teal",   label: "Teal",     bg: "bg-teal-400" },
  { value: "indigo", label: "Índigo",   bg: "bg-indigo-400" },
];

const ICONES = ["📋", "🕐", "🚀", "✅", "⭐", "🔥", "💡", "📢", "🎯", "📌", "🏆", "⚡", "🔔", "📅", "💼", "🎨"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: { nome: string; cor: string; icone: string }) => Promise<void>;
  initialData?: DivulgacaoColuna | null;
}

export function DivulgacaoColunaDialog({ open, onClose, onSave, initialData }: Props) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("blue");
  const [icone, setIcone] = useState("📋");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(initialData?.nome ?? "");
      setCor(initialData?.cor ?? "blue");
      setIcone(initialData?.icone ?? "📋");
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    setLoading(true);
    try {
      await onSave({ nome: nome.trim(), cor, icone });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar coluna" : "Nova coluna"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label>Nome da coluna</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Em revisão, Aprovado..."
              className="mt-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div>
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ICONES.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcone(ic)}
                  className={`text-xl p-1.5 rounded-md border-2 transition-all ${
                    icone === ic
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-transparent hover:border-muted-foreground/30 hover:bg-muted"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Cor do cabeçalho</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {CORES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCor(c.value)}
                  title={c.label}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${c.bg} ${
                    cor === c.value
                      ? "border-foreground scale-125 shadow-md"
                      : "border-transparent hover:scale-110"
                  }`}
                />
              ))}
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
