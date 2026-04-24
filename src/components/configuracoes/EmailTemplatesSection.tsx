import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";

const categoriaColors: Record<string, string> = {
  boas_vindas: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  matricula: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cobranca: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  pagamento: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  sessao: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  aniversario: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  geral: "bg-muted text-muted-foreground",
};

interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  categoria: string;
  variaveis: string[];
  ativo: boolean;
}

export function EmailTemplatesSection() {
  const queryClient = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [editAssunto, setEditAssunto] = useState("");
  const [editCorpo, setEditCorpo] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("categoria", { ascending: true });
      if (error) throw error;
      return (data || []) as EmailTemplate[];
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async () => {
      if (!editTemplate) return;
      const { error } = await supabase
        .from("email_templates")
        .update({ assunto: editAssunto, corpo_html: editCorpo } as any)
        .eq("id", editTemplate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      setEditTemplate(null);
      toast.success("Template atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const toggleTemplate = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ ativo } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
    },
  });

  const openEdit = (t: EmailTemplate) => {
    setEditTemplate(t);
    setEditAssunto(t.assunto);
    setEditCorpo(t.corpo_html);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" /> Templates de Email (Resend)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {(templates || []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{t.assunto}</span>
                      <Badge variant="secondary" className={`text-xs ${categoriaColors[t.categoria] || categoriaColors.geral}`}>
                        {t.categoria}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Variáveis: {t.variaveis?.join(", ") || "nenhuma"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Switch
                      checked={t.ativo}
                      onCheckedChange={(v) => toggleTemplate.mutate({ id: t.id, ativo: v })}
                    />
                    <Button size="icon" variant="ghost" onClick={() => setPreviewTemplate(t)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTemplate} onOpenChange={() => setEditTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template: {editTemplate?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Assunto</Label>
              <Input value={editAssunto} onChange={(e) => setEditAssunto(e.target.value)} />
            </div>
            <div>
              <Label>Corpo HTML</Label>
              <Textarea
                value={editCorpo}
                onChange={(e) => setEditCorpo(e.target.value)}
                className="min-h-[300px] font-mono text-xs"
              />
            </div>
            {editTemplate?.variaveis && editTemplate.variaveis.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {editTemplate.variaveis.map((v) => `{{${v}}}`).join(", ")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTemplate(null)}>Cancelar</Button>
            <Button onClick={() => updateTemplate.mutate()} disabled={updateTemplate.isPending}>
              {updateTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.nome}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <div
              className="bg-white"
              dangerouslySetInnerHTML={{ __html: previewTemplate?.corpo_html || "" }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
