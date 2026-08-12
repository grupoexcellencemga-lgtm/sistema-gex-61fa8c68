import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Secao, Palestrante, AgendaItem, Depoimento, FaqItem, Beneficio, Garantia } from "./types";

interface Props {
  secao: Secao;
  evento: any;
  onChange: (dados: any) => void;
}

function UploadFoto({
  value,
  onChange,
  path,
}: {
  value: string;
  onChange: (url: string) => void;
  path: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const upload = async (file: File) => {
    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const { error } = await supabase.storage
        .from("evento-banners")
        .upload(`${path}.${ext}`, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("evento-banners").getPublicUrl(`${path}.${ext}`);
      onChange(data.publicUrl);
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {value && (
        <img src={value} alt="" className="h-10 w-10 rounded-full object-cover border" />
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => ref.current?.click()}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
        {value ? "Trocar foto" : "Enviar foto"}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function SecaoEditor({ secao, evento, onChange }: Props) {
  const d = secao.dados;

  /* ── Hero ─────────────────────────────────────────────── */
  if (secao.tipo === "hero") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Subtítulo</Label>
          <Input
            value={d.subtitulo ?? ""}
            onChange={(e) => onChange({ ...d, subtitulo: e.target.value })}
            placeholder="Ex: Uma imersão transformadora para líderes"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Texto do botão de inscrição</Label>
          <Input
            value={d.cta_texto ?? "Quero me inscrever"}
            onChange={(e) => onChange({ ...d, cta_texto: e.target.value })}
            placeholder="Quero me inscrever"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Título, data, local e valor vêm automaticamente do cadastro do evento.
        </p>
      </div>
    );
  }

  /* ── Sobre ─────────────────────────────────────────────── */
  if (secao.tipo === "sobre") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Textarea
            value={d.texto ?? ""}
            onChange={(e) => onChange({ ...d, texto: e.target.value })}
            placeholder="Descreva o evento, o que o participante vai aprender, para quem é indicado..."
            rows={5}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Imagem lateral (opcional)</Label>
          <Input
            value={d.imagem_url ?? ""}
            onChange={(e) => onChange({ ...d, imagem_url: e.target.value })}
            placeholder="URL da imagem"
          />
        </div>
      </div>
    );
  }

  /* ── Benefícios ────────────────────────────────────────── */
  if (secao.tipo === "beneficios") {
    const lista: Beneficio[] = d.beneficios ?? [];
    const add = () =>
      onChange({ ...d, beneficios: [...lista, { id: crypto.randomUUID(), icone: "✅", titulo: "", texto: "" }] });
    const remove = (id: string) =>
      onChange({ ...d, beneficios: lista.filter((b) => b.id !== id) });
    const update = (id: string, patch: Partial<Beneficio>) =>
      onChange({ ...d, beneficios: lista.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">Título da seção</Label>
          <Input
            value={d.titulo_secao ?? ""}
            onChange={(e) => onChange({ ...d, titulo_secao: e.target.value })}
            placeholder="Por que participar?"
          />
        </div>
        <div className="border-t" />
        {lista.map((b) => (
          <div key={b.id} className="border rounded-md p-3 space-y-2 bg-background">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    className="w-16 text-center text-lg"
                    value={b.icone}
                    onChange={(e) => update(b.id, { icone: e.target.value })}
                    placeholder="✅"
                    maxLength={4}
                  />
                  <Input
                    className="flex-1"
                    value={b.titulo}
                    onChange={(e) => update(b.id, { titulo: e.target.value })}
                    placeholder="Título do benefício"
                  />
                </div>
                <Textarea
                  value={b.texto}
                  onChange={(e) => update(b.id, { texto: e.target.value })}
                  placeholder="Descrição curta do benefício"
                  rows={2}
                />
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(b.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar benefício
        </Button>
      </div>
    );
  }

  /* ── Garantias ────────────────────────────────────────── */
  if (secao.tipo === "garantias") {
    const lista: Garantia[] = d.garantias ?? [];
    const add = () =>
      onChange({ ...d, garantias: [...lista, { id: crypto.randomUUID(), icone: "🔒", texto: "" }] });
    const remove = (id: string) =>
      onChange({ ...d, garantias: lista.filter((g) => g.id !== id) });
    const update = (id: string, patch: Partial<Garantia>) =>
      onChange({ ...d, garantias: lista.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Selos de garantia ou prova social exibidos em destaque.
        </p>
        {lista.map((g) => (
          <div key={g.id} className="flex items-center gap-2">
            <Input
              className="w-16 text-center text-lg"
              value={g.icone}
              onChange={(e) => update(g.id, { icone: e.target.value })}
              placeholder="🔒"
              maxLength={4}
            />
            <Input
              className="flex-1"
              value={g.texto}
              onChange={(e) => update(g.id, { texto: e.target.value })}
              placeholder="Ex: 100% online e ao vivo"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(g.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar garantia
        </Button>
      </div>
    );
  }

  /* ── Palestrantes ─────────────────────────────────────── */
  if (secao.tipo === "palestrantes") {
    const lista: Palestrante[] = d.palestrantes ?? [];
    const add = () =>
      onChange({ ...d, palestrantes: [...lista, { id: crypto.randomUUID(), nome: "", cargo: "", bio: "", foto_url: "" }] });
    const remove = (id: string) =>
      onChange({ ...d, palestrantes: lista.filter((p) => p.id !== id) });
    const update = (id: string, patch: Partial<Palestrante>) =>
      onChange({ ...d, palestrantes: lista.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

    return (
      <div className="space-y-4">
        {lista.map((p) => (
          <div key={p.id} className="border rounded-md p-3 space-y-2 bg-background">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input value={p.nome} onChange={(e) => update(p.id, { nome: e.target.value })} placeholder="Nome do palestrante" />
                <Input value={p.cargo} onChange={(e) => update(p.id, { cargo: e.target.value })} placeholder="Cargo / especialidade" />
                <Textarea value={p.bio} onChange={(e) => update(p.id, { bio: e.target.value })} placeholder="Mini bio" rows={2} />
                <UploadFoto
                  value={p.foto_url}
                  onChange={(url) => update(p.id, { foto_url: url })}
                  path={`${evento?.id}/palestrantes/${p.id}`}
                />
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(p.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar palestrante
        </Button>
      </div>
    );
  }

  /* ── Agenda ───────────────────────────────────────────── */
  if (secao.tipo === "agenda") {
    const lista: AgendaItem[] = d.itens ?? [];
    const add = () =>
      onChange({ ...d, itens: [...lista, { id: crypto.randomUUID(), hora_inicio: "", hora_fim: "", titulo: "", descricao: "" }] });
    const remove = (id: string) =>
      onChange({ ...d, itens: lista.filter((i) => i.id !== id) });
    const update = (id: string, patch: Partial<AgendaItem>) =>
      onChange({ ...d, itens: lista.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

    return (
      <div className="space-y-3">
        {lista.map((item) => (
          <div key={item.id} className="border rounded-md p-3 space-y-2 bg-background">
            <div className="flex items-center gap-2">
              <Input
                className="w-24"
                value={item.hora_inicio}
                onChange={(e) => update(item.id, { hora_inicio: e.target.value })}
                placeholder="09:00"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                className="w-24"
                value={item.hora_fim}
                onChange={(e) => update(item.id, { hora_fim: e.target.value })}
                placeholder="10:00"
              />
              <Input
                className="flex-1"
                value={item.titulo}
                onChange={(e) => update(item.id, { titulo: e.target.value })}
                placeholder="Título da atividade"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              value={item.descricao}
              onChange={(e) => update(item.id, { descricao: e.target.value })}
              placeholder="Descrição (opcional)"
            />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar atividade
        </Button>
      </div>
    );
  }

  /* ── Depoimentos ──────────────────────────────────────── */
  if (secao.tipo === "depoimentos") {
    const lista: Depoimento[] = d.depoimentos ?? [];
    const add = () =>
      onChange({ ...d, depoimentos: [...lista, { id: crypto.randomUUID(), nome: "", cargo: "", texto: "", foto_url: "" }] });
    const remove = (id: string) =>
      onChange({ ...d, depoimentos: lista.filter((dep) => dep.id !== id) });
    const update = (id: string, patch: Partial<Depoimento>) =>
      onChange({ ...d, depoimentos: lista.map((dep) => (dep.id === id ? { ...dep, ...patch } : dep)) });

    return (
      <div className="space-y-3">
        {lista.map((dep) => (
          <div key={dep.id} className="border rounded-md p-3 space-y-2 bg-background">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input value={dep.nome} onChange={(e) => update(dep.id, { nome: e.target.value })} placeholder="Nome" />
                <Input value={dep.cargo} onChange={(e) => update(dep.id, { cargo: e.target.value })} placeholder="Cargo / empresa" />
                <Textarea value={dep.texto} onChange={(e) => update(dep.id, { texto: e.target.value })} placeholder="Depoimento" rows={3} />
                <UploadFoto
                  value={dep.foto_url}
                  onChange={(url) => update(dep.id, { foto_url: url })}
                  path={`${evento?.id}/depoimentos/${dep.id}`}
                />
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(dep.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar depoimento
        </Button>
      </div>
    );
  }

  /* ── Local ────────────────────────────────────────────── */
  if (secao.tipo === "local") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Endereço completo</Label>
          <Input
            value={d.endereco ?? ""}
            onChange={(e) => onChange({ ...d, endereco: e.target.value })}
            placeholder="Rua, número, bairro, cidade"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Link do Google Maps</Label>
          <Input
            value={d.link_mapa ?? ""}
            onChange={(e) => onChange({ ...d, link_mapa: e.target.value })}
            placeholder="https://maps.google.com/..."
          />
        </div>
      </div>
    );
  }

  /* ── FAQ ──────────────────────────────────────────────── */
  if (secao.tipo === "faq") {
    const lista: FaqItem[] = d.faqs ?? [];
    const add = () =>
      onChange({ ...d, faqs: [...lista, { id: crypto.randomUUID(), pergunta: "", resposta: "" }] });
    const remove = (id: string) =>
      onChange({ ...d, faqs: lista.filter((f) => f.id !== id) });
    const update = (id: string, patch: Partial<FaqItem>) =>
      onChange({ ...d, faqs: lista.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

    return (
      <div className="space-y-3">
        {lista.map((faq) => (
          <div key={faq.id} className="border rounded-md p-3 space-y-2 bg-background">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input value={faq.pergunta} onChange={(e) => update(faq.id, { pergunta: e.target.value })} placeholder="Pergunta" />
                <Textarea value={faq.resposta} onChange={(e) => update(faq.id, { resposta: e.target.value })} placeholder="Resposta" rows={2} />
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(faq.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
        </Button>
      </div>
    );
  }

  return null;
}
