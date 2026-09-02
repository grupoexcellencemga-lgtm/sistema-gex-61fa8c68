import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, LogOut, Loader2, Wifi, WifiOff, QrCode, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Instance = {
  instanceName: string;
  status: string;
  ownerJid: string | null;
  profileName: string | null;
};

type SaveDialog = {
  open: boolean;
  instancia: string;
  nome: string;
  identificador: string;
};

export function WhatsAppManagerSection() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [qrMap, setQrMap] = useState<Record<string, string | null>>({});
  const [saveDialog, setSaveDialog] = useState<SaveDialog | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchInstances = useCallback(async () => {
    try {
      setFetchError(null);
      const { data, error } = await supabase.functions.invoke("gerenciar-instancia", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Normalize: Evolution API v2 may return flat objects or nested {instance:{...}}
      const raw: unknown[] = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      const list: Instance[] = raw
        .filter(Boolean)
        .map((item: any) => {
          // Evolution API v2 flat format: { name, connectionStatus, ownerJid, ... }
          if (item?.name) {
            return {
              instanceName: item.name,
              status: item.connectionStatus ?? item.status ?? item.state ?? "disconnected",
              ownerJid: item.ownerJid ?? null,
              profileName: item.profileName ?? null,
            };
          }
          // Evolution API v1 nested format: { instance: { instanceName, status } }
          if (item?.instance?.instanceName) {
            return { instanceName: item.instance.instanceName, status: item.instance.status ?? "disconnected", ownerJid: null, profileName: null };
          }
          return null;
        })
        .filter(Boolean) as Instance[];
      setInstances(list);
      // Fetch QR for disconnected instances
      list.forEach(async (inst) => {
        const name = inst.instanceName;
        const status = inst.status;
        if (status === "open" || status === "connected") {
          setQrMap(prev => { const n = { ...prev }; delete n[name]; return n; });
          return;
        }
        try {
          const { data: qrData } = await supabase.functions.invoke("gerenciar-instancia", {
            body: { action: "qrcode", instancia: name },
          });
          const b64 = qrData?.data?.base64 || qrData?.data?.qrcode?.base64 || null;
          if (b64) setQrMap(prev => ({ ...prev, [name]: b64 }));
        } catch {}
      });
    } catch (err: any) {
      const msg = err.message ?? String(err);
      setFetchError(msg);
      toast.error("Erro ao listar instâncias: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 12000);
    return () => clearInterval(interval);
  }, [fetchInstances]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerenciar-instancia", {
        body: { action: "create", nome: newName.trim() },
      });
      if (error) throw error;
      toast.success(`Instância "${newName}" criada — escaneie o QR code`);
      setNewName("");
      setShowNewForm(false);
      await fetchInstances();
    } catch (err: any) {
      toast.error("Erro ao criar: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(instancia: string) {
    try {
      const { error } = await supabase.functions.invoke("gerenciar-instancia", {
        body: { action: "delete", instancia },
      });
      if (error) throw error;
      toast.success("Instância removida");
      setInstances(prev => prev.filter(i => i.instanceName !== instancia));
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  }

  async function handleLogout(instancia: string) {
    try {
      const { error } = await supabase.functions.invoke("gerenciar-instancia", {
        body: { action: "logout", instancia },
      });
      if (error) throw error;
      toast.success("Desconectado");
      await fetchInstances();
    } catch (err: any) {
      toast.error("Erro ao desconectar: " + err.message);
    }
  }

  async function handleSaveToCrm() {
    if (!saveDialog || !empresaId) return;
    if (!saveDialog.nome.trim() || !saveDialog.identificador.trim()) {
      toast.error("Preencha nome e número");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("canais_crm").insert({
        empresa_id: empresaId,
        tipo: "whatsapp",
        nome: saveDialog.nome.trim(),
        identificador: saveDialog.identificador.trim(),
        evolution_url: "http://2.25.125.70:8080",
        evolution_instancia: saveDialog.instancia,
        ativo: true,
      });
      if (error) throw error;

      await supabase.functions.invoke("gerenciar-instancia", {
        body: { action: "set_webhook", instancia: saveDialog.instancia },
      });

      queryClient.invalidateQueries({ queryKey: ["canais_crm"] });
      toast.success("Canal salvo no CRM e webhook configurado!");
      setSaveDialog(null);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function statusInfo(status: string) {
    if (status === "open" || status === "connected") {
      return { label: "Conectado", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <Wifi className="h-3 w-3" /> };
    }
    if (status === "connecting") {
      return { label: "Conectando...", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: <Loader2 className="h-3 w-3 animate-spin" /> };
    }
    return { label: "Desconectado", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: <WifiOff className="h-3 w-3" /> };
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Gerenciador WhatsApp
          </CardTitle>
          <CardDescription>
            Instâncias da Evolution API — crie, conecte e monitore sem sair do sistema.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchInstances} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowNewForm(v => !v)}>
            <Plus className="h-4 w-4 mr-1" /> Nova instância
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showNewForm && (
          <div className="flex gap-2 p-3 border rounded-lg bg-muted/30 items-center">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome (ex: gex-vendas)"
              className="flex-1"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>Cancelar</Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-medium mb-1">Erro ao conectar com a Evolution API</p>
            <p className="font-mono text-xs break-all">{fetchError}</p>
          </div>
        ) : instances.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma instância encontrada. Crie uma nova acima.
          </p>
        ) : (
          <div className="space-y-3">
            {instances.map((inst) => {
              const name = inst.instanceName;
              const status = inst.status;
              const info = statusInfo(status);
              const isConnected = status === "open" || status === "connected";
              const qr = qrMap[name];

              return (
                <div key={name} className="border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-sm">{name}</p>
                        {inst.ownerJid && (
                          <p className="text-xs text-muted-foreground">
                            {inst.ownerJid.replace("@s.whatsapp.net", "")}
                            {inst.profileName ? ` · ${inst.profileName}` : ""}
                          </p>
                        )}
                      </div>
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium", info.cls)}>
                        {info.icon}
                        {info.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isConnected && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setSaveDialog({ open: true, instancia: name, nome: "", identificador: "" })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                            Usar no CRM
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => handleLogout(name)} title="Desconectar"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(name)} title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {!isConnected && qr && (
                    <div className="flex flex-col items-center gap-2 pt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <QrCode className="h-3.5 w-3.5" />
                        Abra o WhatsApp → Aparelhos conectados → Conectar aparelho
                      </p>
                      <img
                        src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                        alt="QR Code WhatsApp"
                        className="w-48 h-48 border rounded-xl shadow-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">Atualiza automaticamente a cada 12s</p>
                    </div>
                  )}

                  {!isConnected && !qr && status !== "connecting" && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      Carregando QR code...
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {saveDialog && (
        <Dialog open={saveDialog.open} onOpenChange={v => !v && setSaveDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Adicionar ao CRM</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Instância: <strong>{saveDialog.instancia}</strong>
              </p>
              <div>
                <Label>Nome amigável</Label>
                <Input
                  value={saveDialog.nome}
                  onChange={e => setSaveDialog(p => p ? { ...p, nome: e.target.value } : p)}
                  placeholder="Ex: WhatsApp Vendas"
                  autoFocus
                />
              </div>
              <div>
                <Label>Número (com DDI, ex: 5544999990000)</Label>
                <Input
                  value={saveDialog.identificador}
                  onChange={e => setSaveDialog(p => p ? { ...p, identificador: e.target.value } : p)}
                  placeholder="5544999990000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialog(null)}>Cancelar</Button>
              <Button onClick={handleSaveToCrm} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar e configurar webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
