import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MessageSquare, Instagram, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Canal = {
  id: string;
  tipo: "whatsapp" | "instagram";
  nome: string;
  identificador: string;
  evolution_url: string | null;
  evolution_token: string | null;
  evolution_instancia: string | null;
  ativo: boolean;
};

const emptyWhatsapp: Omit<Canal, "id"> = {
  tipo: "whatsapp",
  nome: "",
  identificador: "",
  evolution_url: "",
  evolution_token: "",
  evolution_instancia: "",
  ativo: true,
};

const emptyInstagram: Omit<Canal, "id"> = {
  tipo: "instagram",
  nome: "",
  identificador: "",
  evolution_url: null,
  evolution_token: null,
  evolution_instancia: null,
  ativo: true,
};

export function CanaisCrmSection() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<{ open: boolean; tipo: "whatsapp" | "instagram"; canal: Omit<Canal, "id"> & { id?: string } } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: canais = [], isLoading } = useQuery({
    queryKey: ["canais_crm", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canais_crm")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at");
      if (error) throw error;
      return data as Canal[];
    },
    enabled: !!empresaId,
  });

  const whatsapps = canais.filter((c) => c.tipo === "whatsapp");
  const instagrams = canais.filter((c) => c.tipo === "instagram");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("canais_crm").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canais_crm"] });
      toast.success("Canal removido");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("canais_crm").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["canais_crm"] }),
  });

  function openNew(tipo: "whatsapp" | "instagram") {
    setDialog({ open: true, tipo, canal: tipo === "whatsapp" ? { ...emptyWhatsapp } : { ...emptyInstagram } });
  }

  function openEdit(canal: Canal) {
    setDialog({ open: true, tipo: canal.tipo, canal: { ...canal } });
  }

  async function handleSave() {
    if (!dialog || !empresaId) return;
    const { canal } = dialog;
    if (!canal.nome.trim() || !canal.identificador.trim()) {
      toast.error("Preencha nome e identificador");
      return;
    }
    setSaving(true);
    try {
      let savedId = canal.id;
      if (canal.id) {
        const { error } = await supabase.from("canais_crm").update({
          nome: canal.nome,
          identificador: canal.identificador,
          evolution_url: canal.evolution_url,
          evolution_token: canal.evolution_token,
          evolution_instancia: canal.evolution_instancia,
          ativo: canal.ativo,
        }).eq("id", canal.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("canais_crm").insert({
          empresa_id: empresaId,
          tipo: canal.tipo,
          nome: canal.nome,
          identificador: canal.identificador,
          evolution_url: canal.evolution_url,
          evolution_token: canal.evolution_token,
          evolution_instancia: canal.evolution_instancia,
          ativo: canal.ativo,
        }).select("id").single();
        if (error) throw error;
        savedId = inserted.id;
      }
      queryClient.invalidateQueries({ queryKey: ["canais_crm"] });

      // Para WhatsApp, configura o webhook automaticamente na Evolution API
      if (canal.tipo === "whatsapp" && canal.evolution_instancia && savedId) {
        const { error: webhookErr } = await supabase.functions.invoke("configurar-webhook", {
          body: { canal_id: savedId },
        });
        if (webhookErr) {
          toast.warning("Canal salvo, mas falha ao configurar webhook: " + webhookErr.message);
        } else {
          toast.success((canal.id ? "Canal atualizado" : "Canal adicionado") + " — webhook configurado");
        }
      } else {
        toast.success(canal.id ? "Canal atualizado" : "Canal adicionado");
      }

      setDialog(null);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message ?? "tente novamente"));
    } finally {
      setSaving(false);
    }
  }

  function setField(field: string, value: string | boolean) {
    if (!dialog) return;
    setDialog({ ...dialog, canal: { ...dialog.canal, [field]: value } });
  }

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* WhatsApp */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              Números de WhatsApp
            </CardTitle>
            <CardDescription>
              Configure os números conectados via Evolution API. Mensagens recebidas entrarão no CRM.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => openNew("whatsapp")}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar número
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {whatsapps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum número cadastrado ainda.
            </p>
          )}
          {whatsapps.map((canal) => (
            <div key={canal.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Switch
                  checked={canal.ativo}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: canal.id, ativo: v })}
                />
                <div>
                  <p className="font-medium text-sm">{canal.nome}</p>
                  <p className="text-xs text-muted-foreground">{canal.identificador}</p>
                </div>
                <Badge variant={canal.ativo ? "default" : "secondary"} className="text-xs">
                  {canal.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(canal)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(canal.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Instagram */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5 text-pink-600" />
              Perfis do Instagram
            </CardTitle>
            <CardDescription>
              Adicione seus perfis do Instagram para receber mensagens diretas no CRM.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => openNew("instagram")}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar perfil
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {instagrams.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum perfil cadastrado ainda.
            </p>
          )}
          {instagrams.map((canal) => (
            <div key={canal.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Switch
                  checked={canal.ativo}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: canal.id, ativo: v })}
                />
                <div>
                  <p className="font-medium text-sm">{canal.nome}</p>
                  <p className="text-xs text-muted-foreground">@{canal.identificador}</p>
                </div>
                <Badge variant={canal.ativo ? "default" : "secondary"} className="text-xs">
                  {canal.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(canal)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(canal.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Dialog */}
      {dialog && (
        <Dialog open={dialog.open} onOpenChange={(v) => !v && setDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialog.canal.id ? "Editar" : "Adicionar"}{" "}
                {dialog.tipo === "whatsapp" ? "número de WhatsApp" : "perfil do Instagram"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Nome amigável</Label>
                <Input
                  value={dialog.canal.nome}
                  onChange={(e) => setField("nome", e.target.value)}
                  placeholder={dialog.tipo === "whatsapp" ? "Ex: WhatsApp Vendas" : "Ex: Instagram Principal"}
                />
              </div>
              <div>
                <Label>{dialog.tipo === "whatsapp" ? "Número (com DDI, ex: 5544999990000)" : "Usuário (@username)"}</Label>
                <Input
                  value={dialog.canal.identificador}
                  onChange={(e) => setField("identificador", e.target.value)}
                  placeholder={dialog.tipo === "whatsapp" ? "5544999990000" : "grupoexcellence"}
                />
              </div>
              {dialog.tipo === "whatsapp" && (
                <>
                  <Separator />
                  <p className="text-sm font-medium text-muted-foreground">Configuração da Evolution API</p>
                  <div>
                    <Label>URL da API</Label>
                    <Input
                      value={dialog.canal.evolution_url || ""}
                      onChange={(e) => setField("evolution_url", e.target.value)}
                      placeholder="http://2.25.125.70:8080"
                    />
                  </div>
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={dialog.canal.evolution_token || ""}
                      onChange={(e) => setField("evolution_token", e.target.value)}
                      placeholder="sua-api-key"
                    />
                  </div>
                  <div>
                    <Label>Nome da instância</Label>
                    <Input
                      value={dialog.canal.evolution_instancia || ""}
                      onChange={(e) => setField("evolution_instancia", e.target.value)}
                      placeholder="Ex: gex-vendas"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
