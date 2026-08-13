import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

export function EmpresaIdentidadeSection() {
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();

  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#C8860A");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!empresa) return;
    setNome(empresa.nome);
    setCor(empresa.cor_primaria);
    setLogoUrl(empresa.logo_url ?? "");
  }, [empresa?.id]);

  const handleLogoUpload = async (file: File) => {
    if (!empresa) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${empresa.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("empresas-logos")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("empresas-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!empresa) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("empresas")
        .update({
          nome: nome.trim(),
          cor_primaria: cor,
          logo_url: logoUrl || null,
        })
        .eq("id", empresa.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["all-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["user-empresa"] });
      toast.success("Identidade visual atualizada");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!empresa) return (
    <p className="text-sm text-muted-foreground">Nenhuma empresa selecionada.</p>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Identidade Visual — {empresa.nome}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Nome */}
        <div className="space-y-1.5">
          <Label>Nome da empresa</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: GEx Educação"
          />
        </div>

        {/* Cor primária */}
        <div className="space-y-1.5">
          <Label>Cor primária</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-10 w-14 rounded-md border cursor-pointer p-0.5 bg-transparent"
            />
            <Input
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              placeholder="#C8860A"
              className="w-32 font-mono text-sm"
              maxLength={7}
            />
            <div
              className="h-10 flex-1 rounded-md border"
              style={{ background: cor }}
              title="Prévia da cor"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Essa cor aparece no menu lateral, botões e destaques do sistema.
          </p>
        </div>

        {/* Logo */}
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {/* Prévia */}
            <div className="h-20 w-20 rounded-lg border bg-muted/40 flex items-center justify-center shrink-0 overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="logo"
                  className="h-full w-full object-contain p-1"
                  onError={() => setLogoUrl("")}
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                )}
                {uploading ? "Enviando..." : "Escolher imagem"}
              </Button>
              {logoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive text-xs"
                  onClick={() => setLogoUrl("")}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remover logo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                PNG, JPG, SVG ou WebP — máx. 5 MB
              </p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || uploading}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar Identidade
        </Button>
      </CardContent>
    </Card>
  );
}
