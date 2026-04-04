import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { maskPhone } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telefone?: string;
  nome?: string;
  entidadeTipo?: string;
  entidadeId?: string;
  /** Extra variables for template interpolation */
  variaveis?: Record<string, string>;
}

export function WhatsAppDialog({ open, onOpenChange, telefone, nome, entidadeTipo, entidadeId, variaveis = {} }: Props) {
  const [phone, setPhone] = useState(telefone || "");
  const [mensagem, setMensagem] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  // Sync phone when prop changes
  if (telefone && phone !== telefone) setPhone(telefone);

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("categoria", { ascending: true });
      return data ?? [];
    },
    enabled: open,
  });

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tpl = templates.find((t: any) => t.id === templateId);
    if (!tpl) return;
    let msg = tpl.mensagem as string;
    const allVars = { nome: nome || "", ...variaveis };
    Object.entries(allVars).forEach(([key, value]) => {
      msg = msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    });
    setMensagem(msg);
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!phone.trim() || !mensagem.trim()) throw new Error("Telefone e mensagem são obrigatórios");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("enviar-whatsapp", {
        body: {
          telefone: phone.replace(/\D/g, ""),
          mensagem: mensagem.trim(),
          template_id: selectedTemplate || null,
          entidade_tipo: entidadeTipo || null,
          entidade_id: entidadeId || null,
          entidade_nome: nome || null,
        },
      });

      if (res.error) throw new Error(res.error.message || "Erro ao enviar");
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso!");
      setMensagem("");
      setSelectedTemplate("");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const categorias = [...new Set(templates.map((t: any) => t.categoria))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            {nome ? `Enviando para ${nome}` : "Envie uma mensagem via WhatsApp"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(44) 99999-0000"
            />
          </div>

          {templates.length > 0 && (
            <div>
              <Label>Template (opcional)</Label>
              <Select value={selectedTemplate} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((cat: string) => (
                    <div key={cat}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">{cat}</div>
                      {templates.filter((t: any) => t.categoria === cat).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Mensagem</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={5}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !phone.trim() || !mensagem.trim()}
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Mensagem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small history component for use inside detail sheets */
export function WhatsAppHistory({ entidadeTipo, entidadeId }: { entidadeTipo: string; entidadeId: string }) {
  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["whatsapp-mensagens", entidadeTipo, entidadeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_mensagens")
        .select("*")
        .eq("entidade_tipo", entidadeTipo)
        .eq("entidade_id", entidadeId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (mensagens.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem enviada.</p>;

  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {mensagens.map((m: any) => (
        <div key={m.id} className="text-xs border rounded p-2 space-y-1">
          <div className="flex justify-between">
            <span className="font-medium">{m.telefone}</span>
            <span className={m.status === "enviado" ? "text-primary" : "text-destructive"}>{m.status}</span>
          </div>
          <p className="text-muted-foreground line-clamp-2">{m.mensagem}</p>
          {m.erro && <p className="text-destructive">{m.erro}</p>}
          <p className="text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</p>
        </div>
      ))}
    </div>
  );
}
