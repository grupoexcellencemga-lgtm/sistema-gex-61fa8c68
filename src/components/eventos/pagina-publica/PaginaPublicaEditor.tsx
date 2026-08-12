import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Link2,
  Upload,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ImageIcon,
  ExternalLink,
  X,
  Settings2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Secao, SecaoTipo, SECAO_LABELS, SECAO_ICONS } from "./types";
import { SecaoEditor } from "./SecaoEditor";
import { PaginaPreview } from "./PaginaPreview";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const SECOES_DISPONIVEIS: SecaoTipo[] = [
  "hero", "sobre", "palestrantes", "agenda", "depoimentos", "local", "faq",
];

const DEFAULT_DADOS: Record<SecaoTipo, any> = {
  hero:         { subtitulo: "", cta_texto: "Quero me inscrever" },
  sobre:        { texto: "", imagem_url: "" },
  palestrantes: { palestrantes: [] },
  agenda:       { itens: [] },
  depoimentos:  { depoimentos: [] },
  local:        { endereco: "", link_mapa: "" },
  faq:          { faqs: [] },
};

export function PaginaPublicaEditor({
  evento,
  open,
  onClose,
}: {
  evento: any;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [addingSecao, setAddingSecao] = useState(false);

  const [localEvento, setLocalEvento] = useState<any>(evento);
  const [localSecoes, setLocalSecoes] = useState<Secao[]>(() =>
    Array.isArray(evento.pagina_secoes)
      ? [...evento.pagina_secoes].sort((a, b) => a.ordem - b.ordem)
      : []
  );

  // Sync when the dialog reopens with fresh data
  useEffect(() => {
    if (open) {
      setLocalEvento(evento);
      setLocalSecoes(
        Array.isArray(evento.pagina_secoes)
          ? [...evento.pagina_secoes].sort((a, b) => a.ordem - b.ordem)
          : []
      );
    }
  }, [open, evento.id]);

  const salvar = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await (supabase as any)
        .from("eventos")
        .update(patch)
        .eq("id", evento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evento-pagina-publica", evento.id] });
      queryClient.invalidateQueries({ queryKey: ["evento-operacao", evento.id] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const updateSlug = (slug: string) => {
    const v = slug || null;
    setLocalEvento((e: any) => ({ ...e, slug: v }));
    salvar.mutate({ slug: v });
  };

  const setAtiva = (v: boolean) => {
    if (v && !localEvento?.slug) {
      toast.error("Defina o slug (URL) antes de publicar.");
      return;
    }
    setLocalEvento((e: any) => ({ ...e, pagina_publica_ativa: v }));
    salvar.mutate({ pagina_publica_ativa: v });
    toast.success(v ? "Página publicada!" : "Página despublicada.");
  };

  const updateLinkPagamento = (link: string) => {
    const v = link || null;
    setLocalEvento((e: any) => ({ ...e, link_pagamento: v }));
    salvar.mutate({ link_pagamento: v });
  };

  const uploadBanner = async (file: File) => {
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${evento.id}/banner.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("evento-banners")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("evento-banners").getPublicUrl(path);
      const url = urlData.publicUrl;
      setLocalEvento((e: any) => ({ ...e, banner_url: url }));
      await salvar.mutateAsync({ banner_url: url });
      toast.success("Banner enviado!");
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const atualizarSecoes = (novas: Secao[]) => {
    const reordenadas = novas.map((s, i) => ({ ...s, ordem: i }));
    setLocalSecoes(reordenadas);
    salvar.mutate({ pagina_secoes: reordenadas });
  };

  const adicionarSecao = (tipo: SecaoTipo) => {
    const nova: Secao = {
      id: crypto.randomUUID(),
      tipo,
      ativo: true,
      ordem: localSecoes.length,
      dados: { ...DEFAULT_DADOS[tipo] },
    };
    atualizarSecoes([...localSecoes, nova]);
    setAddingSecao(false);
  };

  const removerSecao = (id: string) =>
    atualizarSecoes(localSecoes.filter((s) => s.id !== id));

  const moverSecao = (id: string, dir: -1 | 1) => {
    const idx = localSecoes.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const novas = [...localSecoes];
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= novas.length) return;
    [novas[idx], novas[alvo]] = [novas[alvo], novas[idx]];
    atualizarSecoes(novas);
  };

  const atualizarSecao = (id: string, dados: any) =>
    atualizarSecoes(localSecoes.map((s) => (s.id === id ? { ...s, dados } : s)));

  const toggleSecao = (id: string) =>
    atualizarSecoes(localSecoes.map((s) => (s.id === id ? { ...s, ativo: !s.ativo } : s)));

  const slugGerado = slugify(evento.nome || "");
  const linkPublico = localEvento?.slug
    ? `${window.location.origin}/e/${localEvento.slug}`
    : null;

  const secoesUsadas = localSecoes.map((s) => s.tipo);
  const secoesDisponiveis = SECOES_DISPONIVEIS.filter(
    (t) => t === "faq" || t === "depoimentos" || !secoesUsadas.includes(t)
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[96vw] sm:w-[96vw] sm:h-[92vh] sm:max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden [&>button:last-child]:hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-background shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Globe className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{evento.nome}</p>
              <p className="text-xs text-muted-foreground">Editor de página pública</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {localEvento.pagina_publica_ativa ? "Publicada" : "Rascunho"}
              </span>
              {localEvento.pagina_publica_ativa && (
                <Badge className="bg-green-600 text-white text-xs">Ao vivo</Badge>
              )}
              <Switch
                checked={!!localEvento.pagina_publica_ativa}
                onCheckedChange={setAtiva}
              />
            </div>

            {linkPublico && (
              <Button variant="outline" size="sm" asChild>
                <a href={linkPublico} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver ao vivo
                </a>
              </Button>
            )}

            {salvar.isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Split view ─────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — Editor */}
          <div className="w-[360px] shrink-0 border-r overflow-y-auto bg-muted/10">
            <div className="p-4 space-y-5">

              {/* Configurações */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" /> Configurações
                </h3>

                {/* Slug */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Link2 className="h-3 w-3" /> URL da página
                  </Label>
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-muted-foreground bg-muted border rounded-md px-2 h-8 flex items-center shrink-0">
                      /e/
                    </span>
                    <Input
                      className="flex-1 h-8 text-sm"
                      defaultValue={localEvento?.slug ?? ""}
                      onBlur={(e) => updateSlug(e.target.value)}
                      placeholder={slugGerado}
                    />
                  </div>
                  {!localEvento?.slug && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => updateSlug(slugGerado)}
                    >
                      Gerar automático
                    </Button>
                  )}
                  {localEvento?.slug && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {window.location.origin}/e/{localEvento.slug}
                    </p>
                  )}
                </div>

                {/* Banner */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3" /> Banner
                  </Label>
                  {localEvento?.banner_url ? (
                    <div className="relative rounded-lg overflow-hidden border aspect-[3/1]">
                      <img
                        src={localEvento.banner_url}
                        alt="Banner"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-1.5 right-1.5 shadow text-xs h-7"
                        onClick={() => fileRef.current?.click()}
                      >
                        Trocar
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed rounded-lg aspect-[3/1] flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      {uploadingBanner ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5" />
                          <span className="text-xs">Enviar banner</span>
                          <span className="text-[10px] opacity-70">JPG · PNG · WebP · máx 5 MB</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBanner(f);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Link de pagamento */}
                {evento.pago && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Link de pagamento</Label>
                    <Input
                      className="h-8 text-sm"
                      defaultValue={localEvento?.link_pagamento ?? ""}
                      placeholder="https://asaas.com/... ou Sicoob..."
                      onBlur={(e) => updateLinkPagamento(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Após inscrever, o participante vai para este link.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t" />

              {/* Seções */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Seções
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setAddingSecao((v) => !v)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </div>

                {addingSecao && (
                  <div className="border rounded-lg p-2.5 bg-background">
                    <p className="text-[11px] text-muted-foreground mb-2 font-medium">
                      Escolha o tipo:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {secoesDisponiveis.map((tipo) => (
                        <Button
                          key={tipo}
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => adicionarSecao(tipo)}
                        >
                          {SECAO_ICONS[tipo]} {SECAO_LABELS[tipo]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {localSecoes.length === 0 && !addingSecao && (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <Globe className="h-7 w-7 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Adicione seções para montar a landing page.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  {localSecoes.map((secao, idx) => (
                    <div
                      key={secao.id}
                      className={`border rounded-lg overflow-hidden transition-opacity bg-background ${
                        !secao.ativo ? "opacity-50" : ""
                      }`}
                    >
                      {/* Cabeçalho da seção */}
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/40">
                        <span className="text-sm">{SECAO_ICONS[secao.tipo]}</span>
                        <span className="text-xs font-medium flex-1">
                          {SECAO_LABELS[secao.tipo]}
                        </span>
                        {!secao.ativo && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            Oculta
                          </Badge>
                        )}
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moverSecao(secao.id, -1)}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moverSecao(secao.id, 1)}
                            disabled={idx === localSecoes.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title={secao.ativo ? "Ocultar seção" : "Mostrar seção"}
                            onClick={() => toggleSecao(secao.id)}
                          >
                            {secao.ativo ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => removerSecao(secao.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* Editor */}
                      <div className="p-2.5">
                        <SecaoEditor
                          secao={secao}
                          evento={localEvento}
                          onChange={(dados) => atualizarSecao(secao.id, dados)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Live Preview */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-background">
            {/* Preview label */}
            <div className="sticky top-0 z-10 bg-black/70 text-white text-[11px] text-center py-1 backdrop-blur-sm">
              Prévia ao vivo — como o visitante verá a página
            </div>
            <PaginaPreview
              evento={localEvento}
              secoes={localSecoes}
              onInscrever={() => {}}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
