import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Profissional {
  id: string;
  nome: string;
}

interface Props {
  profissionais: Profissional[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  onAddNew?: (nome: string) => Promise<{ id: string; nome: string } | null>;
}

export function ResponsaveisMultiSelect({
  profissionais,
  selectedIds,
  onChange,
  placeholder = "Selecionar responsáveis...",
  className,
  onAddNew,
}: Props) {
  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  const handleSaveNew = async () => {
    if (!newNome.trim() || !onAddNew) return;
    setAddingLoading(true);
    try {
      const result = await onAddNew(newNome.trim());
      if (result) onChange([...selectedIds, result.id]);
      setNewNome("");
      setAddingNew(false);
    } finally {
      setAddingLoading(false);
    }
  };

  const selectedNames = profissionais.filter(p => selectedIds.includes(p.id)).map(p => p.nome);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-9 text-left font-normal", className)}
        >
          {selectedNames.length === 0 ? (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1 py-0.5">
              {selectedNames.map((name) => (
                <Badge key={name} variant="secondary" className="text-xs font-normal">
                  {name}
                </Badge>
              ))}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        <div className="max-h-52 overflow-y-auto">
          {profissionais.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum profissional cadastrado</div>
          ) : (
            profissionais.map((p) => {
              const selected = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                    selected && "bg-accent/50"
                  )}
                >
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border shrink-0",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  )}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <span>{p.nome}</span>
                </button>
              );
            })
          )}
        </div>
        {onAddNew && (
          <div className="border-t mt-1 pt-1">
            {!addingNew ? (
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar pessoa
              </button>
            ) : (
              <div className="flex gap-1 px-2 py-1">
                <input
                  autoFocus
                  className="flex-1 text-sm border rounded px-2 py-1 min-w-0 bg-background"
                  placeholder="Nome..."
                  value={newNome}
                  onChange={e => setNewNome(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); handleSaveNew(); }
                    if (e.key === "Escape") { setAddingNew(false); setNewNome(""); }
                  }}
                />
                <button
                  type="button"
                  disabled={!newNome.trim() || addingLoading}
                  onClick={handleSaveNew}
                  className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50 flex items-center gap-1"
                >
                  {addingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingNew(false); setNewNome(""); }}
                  className="text-xs px-1.5 py-1 rounded text-muted-foreground hover:bg-accent"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
