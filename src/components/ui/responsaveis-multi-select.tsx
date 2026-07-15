import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
}

export function ResponsaveisMultiSelect({
  profissionais,
  selectedIds,
  onChange,
  placeholder = "Selecionar responsáveis...",
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
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
      </PopoverContent>
    </Popover>
  );
}
