import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, CreditCard, Link2, Percent, Info } from "lucide-react";
import { toast } from "sonner";

interface Taxa {
  id: string;
  tipo: string;
  nome: string;
  percentual: number;
  ordem: number;
}

export const TaxasSection = () => {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: taxas = [], isLoading } = useQuery({
    queryKey: ["taxas_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taxas_sistema")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as Taxa[];
    },
  });

  const maquininha = taxas.filter(t => t.tipo === "maquininha");
  const link = taxas.filter(t => t.tipo === "link");
  const imposto = taxas.filter(t => t.tipo === "imposto");

  const getEditValue = (taxa: Taxa) => {
    if (editValues[taxa.id] !== undefined) return editValues[taxa.id];
    return formatPercent(taxa.percentual);
  };

  const handleChange = (id: string, value: string) => {
    // Allow only numbers, comma and dot
    const clean = value.replace(/[^0-9.,]/g, "");
    setEditValues(prev => ({ ...prev, [id]: clean }));
  };

  const parsePercent = (value: string): number => {
    const clean = value.replace(",", ".");
    return parseFloat(clean) || 0;
  };

  const formatPercent = (value: number): string => {
    return value.toFixed(2).replace(".", ",");
  };

  const hasChanges = () => {
    return Object.keys(editValues).some(id => {
      const taxa = taxas.find(t => t.id === id);
      if (!taxa) return false;
      return parsePercent(editValues[id]) !== taxa.percentual;
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(editValues)
        .filter(([id, val]) => {
          const taxa = taxas.find(t => t.id === id);
          return taxa && parsePercent(val) !== taxa.percentual;
        })
        .map(([id, val]) =>
          supabase
            .from("taxas_sistema")
            .update({ percentual: parsePercent(val) })
            .eq("id", id)
        );
      
      if (updates.length === 0) {
        toast.info("Nenhuma alteração detectada");
        setSaving(false);
        return;
      }

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;

      await queryClient.refetchQueries({ queryKey: ["taxas_sistema"] });
      setEditValues({});
      toast.success(`${updates.length} taxa(s) atualizada(s) com sucesso`);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tabela de Taxas da Maquininha</h3>
          <p className="text-sm text-muted-foreground">Taxas aplicadas nos cálculos financeiros de todo o sistema</p>
        </div>
        {hasChanges() && (
          <Button onClick={saveAll} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações
          </Button>
        )}
      </div>

      {/* Taxas Maquininha */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Taxas Maquininha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {maquininha.map(taxa => (
              <div key={taxa.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium min-w-[90px]">{taxa.nome}</span>
                <div className="flex items-center gap-1 ml-auto">
                  <Input
                    value={getEditValue(taxa)}
                    onChange={e => handleChange(taxa.id, e.target.value)}
                    className="w-[80px] h-8 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Taxas Link */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Taxas Link
            </CardTitle>
            <Badge variant="outline" className="text-xs gap-1">
              <Info className="h-3 w-3" />
              Boleto usa mesma tabela
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {link.map(taxa => (
              <div key={taxa.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <span className="text-sm font-medium min-w-[50px]">{taxa.nome}</span>
                <div className="flex items-center gap-1 ml-auto">
                  <Input
                    value={getEditValue(taxa)}
                    onChange={e => handleChange(taxa.id, e.target.value)}
                    className="w-[80px] h-8 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Imposto Padrão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Imposto Padrão sobre Entradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {imposto.map(taxa => (
              <div key={taxa.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <span className="text-sm font-medium">{taxa.nome}</span>
                <div className="flex items-center gap-1">
                  <Input
                    value={getEditValue(taxa)}
                    onChange={e => handleChange(taxa.id, e.target.value)}
                    className="w-[80px] h-8 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Este imposto será preenchido automaticamente nos lançamentos de entrada, mas poderá ser editado manualmente em cada lançamento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
