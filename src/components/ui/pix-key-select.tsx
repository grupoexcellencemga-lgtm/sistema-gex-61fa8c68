import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function PixKeySelect({ value, onChange, placeholder = "CNPJ, CPF, e-mail ou chave aleatória", className }: Props) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newDescricao, setNewDescricao] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: chaves = [] } = useQuery({
    queryKey: ["chaves_pix", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chaves_pix")
        .select("id, descricao, chave")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("descricao");
      if (error) throw error;
      return data as { id: string; descricao: string; chave: string }[];
    },
    enabled: !!empresaId,
  });

  const handleSaveNew = async () => {
    if (!value.trim() || !newDescricao.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("chaves_pix").insert({
        descricao: newDescricao.trim(),
        chave: value.trim(),
        ativo: true,
        empresa_id: empresaId,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["chaves_pix", empresaId] });
      toast.success("Chave PIX salva.");
      setAddingNew(false);
      setNewDescricao("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectChave = (chave: string) => {
    onChange(chave);
    setOpen(false);
  };

  return (
    <div className={cn("flex gap-1.5", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setAddingNew(false); setNewDescricao(""); } }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" type="button" title="Chaves PIX salvas">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1" align="end">
          {chaves.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">Nenhuma chave PIX salva.</div>
          ) : (
            <div className="max-h-44 overflow-y-auto">
              {chaves.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectChave(c.chave)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left",
                    value === c.chave && "bg-accent/50"
                  )}
                >
                  <span className="font-medium text-xs">{c.descricao}</span>
                  <span className="text-muted-foreground font-mono text-xs truncate w-full">{c.chave}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t mt-1 pt-1">
            {!addingNew ? (
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Salvar chave atual
              </button>
            ) : (
              <div className="px-2 py-1.5 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Salvar <span className="font-mono font-medium text-foreground">{value || "(vazio)"}</span> como:
                </p>
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    className="h-7 text-xs"
                    placeholder="Descrição (ex: PIX Principal)"
                    value={newDescricao}
                    onChange={e => setNewDescricao(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); handleSaveNew(); }
                      if (e.key === "Escape") { setAddingNew(false); setNewDescricao(""); }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!newDescricao.trim() || !value.trim() || saving}
                    onClick={handleSaveNew}
                    className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded disabled:opacity-50 flex items-center"
                  >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingNew(false); setNewDescricao(""); }}
                    className="text-xs px-1.5 py-1 rounded text-muted-foreground hover:bg-accent"
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
