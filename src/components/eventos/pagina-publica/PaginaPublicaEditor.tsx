import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Link2, Upload, Plus, Loader2, ImageIcon,
  ExternalLink, X, Settings2, ChevronLeft, Layers,
  Eye, EyeOff, Trash2, ChevronUp, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { Secao, SecaoTipo } from "./types";
import { SECAO_LABELS, SECAO_ICONS } from "./types";
import { SecaoEditor } from "./SecaoEditor";
import { PaginaPublicaCanvas } from "./PaginaPublicaCanvas";

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

type DrawerMode = "section" | "settings" | "add" | null;

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

  const [localEvento, setLocalEvento] = useState<any>(evento);
  const [localSecoes, setLocalSecoes] = useState<Secao[]>(() =>
    Array.isArray(evento.pagina_secoes)
      ? [...evento.pagina_secoes].sort((a, b) => a.ordem - b.ordem)
      : []
  );

  // Drawer state
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null);
  const [activeSecaoId, setActiveSecaoId] = useState<string | null>(null);
  const [addAtIndex, setAddAtIndex] = useState<number>(0);

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

  /* ── Section operations ─────────────────────────────── */

  const atualizarSecoes = (novas: Secao[]) => {
    const reordenadas = novas.map((s, i) => ({ ...s, ordem: i }));
    setLocalSecoes(reordenadas);
    salvar.mutate({ pagina_secoes: reordenadas });
  };

  const adicionarSecao = (tipo: SecaoTipo, atIndex: number) => {
    const nova: Secao = {
      id: crypto.randomUUID(),
      tipo,
      ativo: true,
      ordem: atIndex,
      dados: { ...DEFAULT_DADOS[tipo] },
    };
    const copia = [...localSecoes];
    copia.splice(atIndex, 0, nova);
    atualizarSecoes(copia);
    // Open editor for new section
    setActiveSecaoId(nova.id);
    setDrawerMode("section");
  };

  const removerSecao = (id: string) => {
    atualizarSecoes(localSecoes.filter((s) => s.id !== id));
    if (activeSecaoId === id) {
      setActiveSecaoId(null);
      setDrawerMode(null);
    }
  };

  const moverSecao = (id: string, dir: -1 | 1) => {
    const sorted = [...localSecoes].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= sorted.length) return;
    [sorted[idx], sorted[alvo]] = [sorted[alvo], sorted[idx]];
    atualizarSecoes(sorted);
  };

  const toggleSecao = (id: string) =>
    atualizarSecoes(localSecoes.map((s) => (s.id === id ? { ...s, ativo: !s.ativo } : s)));

  const atualizarSecao = (id: string, dados: any) =>
    atualizarSecoes(localSecoes.map((s) => (s.id === id ? { ...s, dados } : s)));

  /* ── Global settings ────────────────────────────────── */

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

  /* ── Derived ────────────────────────────────────────── */

  const slugGerado = slugify(evento.nome || "");
  const linkPublico = localEvento?.slug
    ? `${window.location.origin}/e/${localEvento.slug}`
    : null;

  const activeSecao = activeSecaoId
    ? localSecoes.find((s) => s.id === activeSecaoId) ?? null
    : null;

  const secoesUsadas = localSecoes.map((s) => s.tipo);
  const secoesDisponiveis = SECOES_DISPONIVEIS.filter(
    (t) => t === "faq" || t === "depoimentos" || !secoesUsadas.includes(t)
  );

  const closeDrawer = () => {
    setDrawerMode(null);
    setActiveSecaoId(null);
  };

  const handleSelectSecao = (id: string) => {
    setActiveSecaoId(id);
    setDrawerMode("section");
  };

  const handleAddSecao = (atIndex: number) => {
    setAddAtIndex(atIndex);
    setDrawerMode("add");
    setActiveSecaoId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[96vw] sm:w-[96vw] sm:h-[92vh] sm:max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden [&>button:last-child]:hidden">

        <DialogTitle className="sr-only">Editor de página pública — {evento.nome}</DialogTitle>
        {/* ── Top bar ───────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0">
          {/* Left */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Globe className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-sm truncate">{evento.nome}</span>
            {localEvento.pagina_publica_ativa && (
              <Badge className="bg-green-600 text-white text-xs shrink-0">Ao vivo</Badge>
            )}
            {salvar.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            )}
          </div>

          {/* Center actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={drawerMode === "settings" ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => drawerMode === "settings" ? closeDrawer() : (setDrawerMode("settings"), setActiveSecaoId(null))}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configurações
            </Button>
            <Button
              variant={drawerMode === "add" ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => drawerMode === "add" ? closeDrawer() : handleAddSecao(localSecoes.length)}
            >
              <Layers className="h-3.5 w-3.5" />
              Seções
            </Button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {localEvento.pagina_publica_ativa ? "Publicada" : "Rascunho"}
            </span>
            <Switch
              checked={!!localEvento.pagina_publica_ativa}
              onCheckedChange={setAtiva}
            />
            {linkPublico && (
              <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                <a href={linkPublico} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver ao vivo
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Body: Canvas + Drawer ─────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto bg-background">
            <PaginaPublicaCanvas
              evento={localEvento}
              secoes={localSecoes}
              activeSecaoId={activeSecaoId}
              onSelectSecao={handleSelectSecao}
              onMoveSecao={moverSecao}
              onRemoveSecao={removerSecao}
              onToggleSecao={toggleSecao}
              onAddSecao={handleAddSecao}
            />
          </div>

          {/* Right Drawer */}
          {drawerMode && (
            <div className="w-[340px] shrink-0 border-l flex flex-col bg-background overflow-hidden">
              {/* Drawer header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeDrawer}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold flex-1">
                  {drawerMode === "settings" && "Configurações"}
                  {drawerMode === "add" && "Adicionar bloco"}
                  {drawerMode === "section" && activeSecao && (
                    <span className="flex items-center gap-1.5">
                      <span>{SECAO_ICONS[activeSecao.tipo]}</span>
                      {SECAO_LABELS[activeSecao.tipo]}
                    </span>
                  )}
                </span>
                {drawerMode === "section" && activeSecao && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      title={activeSecao.ativo ? "Ocultar" : "Mostrar"}
                      onClick={() => toggleSecao(activeSecao.id)}
                    >
                      {activeSecao.ativo ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Remover seção"
                      onClick={() => removerSecao(activeSecao.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Settings panel ── */}
                {drawerMode === "settings" && (
                  <div className="p-4 space-y-5">
                    {/* Slug */}
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1.5 font-semibold">
                        <Link2 className="h-3.5 w-3.5" /> URL da página
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
                      {!localEvento?.slug ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={() => updateSlug(slugGerado)}
                        >
                          Gerar automático
                        </Button>
                      ) : (
                        <p className="text-[11px] text-muted-foreground truncate break-all">
                          {window.location.origin}/e/{localEvento.slug}
                        </p>
                      )}
                    </div>

                    <div className="border-t" />

                    {/* Banner */}
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1.5 font-semibold">
                        <ImageIcon className="h-3.5 w-3.5" /> Banner do evento
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
                            className="absolute bottom-2 right-2 shadow text-xs h-7"
                            onClick={() => fileRef.current?.click()}
                          >
                            Trocar imagem
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="w-full border-2 border-dashed rounded-lg aspect-[3/1] flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          {uploadingBanner ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-5 w-5" />
                              <span className="text-sm">Enviar banner</span>
                              <span className="text-xs opacity-60">JPG · PNG · WebP · máx 5 MB</span>
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
                      <>
                        <div className="border-t" />
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">Link de pagamento</Label>
                          <Input
                            className="h-8 text-sm"
                            defaultValue={localEvento?.link_pagamento ?? ""}
                            placeholder="https://asaas.com/... ou Sicoob..."
                            onBlur={(e) => updateLinkPagamento(e.target.value)}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Após inscrever, o participante é redirecionado para este link.
                          </p>
                        </div>
                      </>
                    )}

                    <div className="border-t" />

                    {/* Publicação */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> Publicação
                      </Label>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                        <div>
                          <p className="text-sm font-medium">
                            {localEvento.pagina_publica_ativa ? "Página ao vivo" : "Rascunho"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {localEvento.pagina_publica_ativa
                              ? "Visível para qualquer pessoa com o link"
                              : "Somente você pode ver"}
                          </p>
                        </div>
                        <Switch
                          checked={!!localEvento.pagina_publica_ativa}
                          onCheckedChange={setAtiva}
                        />
                      </div>
                      {linkPublico && (
                        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                          <a href={linkPublico} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" /> Ver página ao vivo
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Add section picker ── */}
                {drawerMode === "add" && (
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Escolha o tipo de bloco para adicionar
                      {addAtIndex < localSecoes.length ? ` na posição ${addAtIndex + 1}` : " ao final"}.
                    </p>
                    <div className="space-y-1.5">
                      {secoesDisponiveis.map((tipo) => (
                        <button
                          key={tipo}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border bg-muted/10 hover:bg-primary/5 hover:border-primary/40 transition-colors text-left"
                          onClick={() => {
                            adicionarSecao(tipo, addAtIndex);
                          }}
                        >
                          <span className="text-xl">{SECAO_ICONS[tipo]}</span>
                          <div>
                            <p className="text-sm font-medium">{SECAO_LABELS[tipo]}</p>
                            <p className="text-xs text-muted-foreground">{SECAO_DESCRIPTIONS[tipo]}</p>
                          </div>
                        </button>
                      ))}
                      {secoesDisponiveis.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Todos os tipos de seção já estão na página.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Section editor ── */}
                {drawerMode === "section" && activeSecao && (
                  <div className="p-4 space-y-4">
                    {/* Move controls */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground flex-1">
                        Posição {localSecoes.sort((a,b)=>a.ordem-b.ordem).findIndex(s=>s.id===activeSecao.id)+1} de {localSecoes.length}
                      </span>
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => moverSecao(activeSecao.id, -1)}
                        disabled={localSecoes.sort((a,b)=>a.ordem-b.ordem).findIndex(s=>s.id===activeSecao.id) === 0}
                      >
                        <ChevronUp className="h-3.5 w-3.5" /> Subir
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => moverSecao(activeSecao.id, 1)}
                        disabled={localSecoes.sort((a,b)=>a.ordem-b.ordem).findIndex(s=>s.id===activeSecao.id) === localSecoes.length-1}
                      >
                        Descer <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="border-t" />
                    <SecaoEditor
                      secao={activeSecao}
                      evento={localEvento}
                      onChange={(dados) => atualizarSecao(activeSecao.id, dados)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SECAO_DESCRIPTIONS: Record<SecaoTipo, string> = {
  hero:         "Capa principal com banner, título e botão de inscrição",
  sobre:        "Texto descritivo do evento com imagem opcional",
  palestrantes: "Grade com foto, nome, cargo e bio de cada palestrante",
  agenda:       "Programação com horários e atividades do dia",
  depoimentos:  "Avaliações e relatos de participantes anteriores",
  local:        "Endereço e link para o Google Maps",
  faq:          "Perguntas frequentes em formato accordion",
};
