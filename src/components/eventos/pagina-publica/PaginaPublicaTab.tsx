import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Link2, Upload, Plus, ChevronUp, ChevronDown,
  Trash2, Eye, Loader2, ImageIcon, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Secao, SecaoTipo, SECAO_LABELS, SECAO_ICONS } from "./types";
import { SecaoEditor } from "./SecaoEditor";

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

export function PaginaPublicaTab({ evento }: { evento: any }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [addingSecao, setAddingSecao] = useState(false);

  const { data: eventoAtual } = useQuery({
    queryKey: ["evento-pagina-publica", evento.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eventos")
        .select("id, nome, slug, pagina_publica_ativa, pagina_secoes, banner_url, link_pagamento, pago")
        .eq("id", evento.id)
        .single();
      if (error) throw error;
      return data;
    },
    initialData: { ...evento, pagina_secoes: evento.pagina_secoes ?? [] },
  });

  const secoes: Secao[] = Array.isArray(eventoAtual?.pagina_secoes)
    ? [...eventoAtual.pagina_secoes].sort((a, b) => a.ordem - b.ordem)
    : [];

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
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const setSlug = (slug: string) => salvar.mutate({ slug: slug || null });
  const setAtiva = (v: boolean) => {
    if (v && !eventoAtual?.slug) {
      toast.error("Defina o slug antes de publicar.");
      return;
    }
    salvar.mutate({ pagina_publica_ativa: v });
    toast.success(v ? "Página publicada!" : "Página despublicada.");
  };
  const setLinkPagamento = (link: string) => salvar.mutate({ link_pagamento: link || null });

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
      await salvar.mutateAsync({ banner_url: urlData.publicUrl });
      toast.success("Banner enviado!");
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const atualizarSecoes = (novas: Secao[]) => {
    const reordenadas = novas.map((s, i) => ({ ...s, ordem: i }));
    salvar.mutate({ pagina_secoes: reordenadas });
  };

  const adicionarSecao = (tipo: SecaoTipo) => {
    const nova: Secao = {
      id: crypto.randomUUID(),
      tipo,
      ativo: true,
      ordem: secoes.length,
      dados: { ...DEFAULT_DADOS[tipo] },
    };
    atualizarSecoes([...secoes, nova]);
    setAddingSecao(false);
  };

  const removerSecao = (id: string) => {
    atualizarSecoes(secoes.filter((s) => s.id !== id));
  };

  const moverSecao = (id: string, dir: -1 | 1) => {
    const idx = secoes.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const novas = [...secoes];
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= novas.length) return;
    [novas[idx], novas[alvo]] = [novas[alvo], novas[idx]];
    atualizarSecoes(novas);
  };

  const atualizarSecao = (id: string, dados: any) => {
    atualizarSecoes(secoes.map((s) => (s.id === id ? { ...s, dados } : s)));
  };

  const toggleSecao = (id: string) => {
    atualizarSecoes(secoes.map((s) => (s.id === id ? { ...s, ativo: !s.ativo } : s)));
  };

  const slugGerado = slugify(evento.nome || "");
  const linkPublico = eventoAtual?.slug
    ? `${window.location.origin}/e/${eventoAtual.slug}`
    : null;

  const secoesUsadas = secoes.map((s) => s.tipo);
  const secoesDisponiveis = SECOES_DISPONIVEIS.filter(
    (t) => t === "faq" || t === "depoimentos" || !secoesUsadas.includes(t)
  );

  return (
    <div className="space-y-6">

      {/* Status */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {eventoAtual?.pagina_publica_ativa ? "Página publicada" : "Página não publicada"}
            </p>
            {linkPublico && (
              <a
                href={linkPublico}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                {linkPublico} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {eventoAtual?.pagina_publica_ativa && (
            <Badge variant="default" className="bg-green-600 text-white text-xs">Ao vivo</Badge>
          )}
          <Switch
            checked={!!eventoAtual?.pagina_publica_ativa}
            onCheckedChange={setAtiva}
          />
        </div>
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Slug (URL da página)
        </Label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
            /e/
          </div>
          <Input
            className="flex-[3]"
            value={eventoAtual?.slug ?? ""}
            onChange={(e) => {/* controlled below */}}
            onBlur={(e) => setSlug(e.target.value)}
            placeholder={slugGerado}
          />
          {!eventoAtual?.slug && (
            <Button variant="outline" size="sm" onClick={() => setSlug(slugGerado)}>
              Gerar automático
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Ex: liderança-executiva-setembro-2026
        </p>
      </div>

      {/* Banner */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" /> Banner do evento
        </Label>
        {eventoAtual?.banner_url ? (
          <div className="relative rounded-lg overflow-hidden border aspect-[3/1]">
            <img
              src={eventoAtual.banner_url}
              alt="Banner"
              className="w-full h-full object-cover"
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-2 right-2 shadow"
              onClick={() => fileRef.current?.click()}
            >
              Trocar imagem
            </Button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed rounded-lg aspect-[3/1] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            {uploadingBanner
              ? <Loader2 className="h-6 w-6 animate-spin" />
              : <><Upload className="h-6 w-6" /><span className="text-sm">Clique para enviar o banner</span><span className="text-xs">JPG, PNG ou WebP · máx 5 MB</span></>
            }
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
          <Label>Link de pagamento</Label>
          <Input
            defaultValue={eventoAtual?.link_pagamento ?? ""}
            placeholder="https://... (Asaas, Sicoob, Mercado Pago, etc.)"
            onBlur={(e) => setLinkPagamento(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Após a inscrição, o participante é redirecionado para este link.
          </p>
        </div>
      )}

      {/* Seções */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Seções da página</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddingSecao((v) => !v)}
          >
            <Plus className="h-4 w-4 mr-1" /> Adicionar seção
          </Button>
        </div>

        {/* Picker de seção */}
        {addingSecao && (
          <div className="border rounded-lg p-3 bg-muted/20">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Escolha o tipo de seção:</p>
            <div className="flex flex-wrap gap-2">
              {secoesDisponiveis.map((tipo) => (
                <Button
                  key={tipo}
                  size="sm"
                  variant="secondary"
                  onClick={() => adicionarSecao(tipo)}
                >
                  {SECAO_ICONS[tipo]} {SECAO_LABELS[tipo]}
                </Button>
              ))}
            </div>
          </div>
        )}

        {secoes.length === 0 && !addingSecao && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma seção ainda.</p>
            <p className="text-xs mt-1">Adicione seções para montar a landing page do evento.</p>
          </div>
        )}

        <div className="space-y-2">
          {secoes.map((secao, idx) => (
            <div key={secao.id} className={`border rounded-lg overflow-hidden transition-opacity ${!secao.ativo ? "opacity-50" : ""}`}>
              {/* Header da seção */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                <span className="text-base">{SECAO_ICONS[secao.tipo]}</span>
                <span className="text-sm font-medium flex-1">{SECAO_LABELS[secao.tipo]}</span>
                {!secao.ativo && <Badge variant="outline" className="text-xs">Oculta</Badge>}
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moverSecao(secao.id, -1)} disabled={idx === 0}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moverSecao(secao.id, 1)} disabled={idx === secoes.length - 1}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleSecao(secao.id)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removerSecao(secao.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {/* Editor da seção */}
              <div className="p-3">
                <SecaoEditor
                  secao={secao}
                  evento={eventoAtual}
                  onChange={(dados) => atualizarSecao(secao.id, dados)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      {linkPublico && (
        <Button variant="outline" className="w-full" asChild>
          <a href={linkPublico} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" /> Ver página pública
          </a>
        </Button>
      )}
    </div>
  );
}
