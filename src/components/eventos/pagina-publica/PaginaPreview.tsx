import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { Secao, Palestrante, AgendaItem, Depoimento, FaqItem } from "./types";

const formatValor = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SecaoHero({
  evento,
  dados,
  onInscrever,
}: {
  evento: any;
  dados: any;
  onInscrever: () => void;
}) {
  return (
    <section className="relative min-h-[60vh] flex items-end">
      {evento.banner_url ? (
        <div className="absolute inset-0">
          <img src={evento.banner_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-amber-800 to-stone-900" />
      )}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-12 pt-24">
        <div className="flex flex-wrap gap-3 mb-4">
          {evento.data && (
            <span className="inline-flex items-center gap-1.5 text-sm text-white/80 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(evento.data)}
            </span>
          )}
          {evento.local && (
            <span className="inline-flex items-center gap-1.5 text-sm text-white/80 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
              <MapPin className="h-3.5 w-3.5" /> {evento.local}
            </span>
          )}
        </div>
        <h1
          className="text-4xl md:text-5xl font-bold text-white leading-tight mb-3"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          {evento.nome}
        </h1>
        {dados?.subtitulo && (
          <p className="text-lg text-white/80 mb-6 max-w-2xl">{dados.subtitulo}</p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-base px-8 shadow-lg"
            onClick={onInscrever}
          >
            {dados?.cta_texto || "Quero me inscrever"}
          </Button>
          {evento.valor > 0 && (
            <span className="text-white text-lg font-semibold">{formatValor(evento.valor)}</span>
          )}
          {!evento.pago && (
            <span className="text-green-400 font-semibold text-lg">Gratuito</span>
          )}
        </div>
      </div>
    </section>
  );
}

export function SecaoSobre({ dados }: { dados: any }) {
  if (!dados?.texto) return null;
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Sobre o evento</h2>
        <div className={`gap-10 ${dados.imagem_url ? "grid md:grid-cols-2" : ""}`}>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{dados.texto}</p>
          {dados.imagem_url && (
            <img
              src={dados.imagem_url}
              alt=""
              className="rounded-xl object-cover w-full aspect-video"
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function SecaoPalestrantes({ dados }: { dados: any }) {
  const lista: Palestrante[] = dados?.palestrantes ?? [];
  if (!lista.length) return null;
  return (
    <section className="py-16 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">Palestrantes</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {lista.map((p) => (
            <div key={p.id} className="text-center space-y-3">
              {p.foto_url ? (
                <img
                  src={p.foto_url}
                  alt={p.nome}
                  className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted mx-auto flex items-center justify-center text-2xl font-bold text-muted-foreground">
                  {p.nome.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-semibold">{p.nome}</p>
                {p.cargo && <p className="text-sm text-muted-foreground">{p.cargo}</p>}
              </div>
              {p.bio && <p className="text-sm text-muted-foreground">{p.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoAgenda({ dados }: { dados: any }) {
  const lista: AgendaItem[] = dados?.itens ?? [];
  if (!lista.length) return null;
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">Programação</h2>
        <div className="space-y-0">
          {lista.map((item, idx) => (
            <div key={item.id} className="flex gap-4 relative">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                {idx < lista.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="pb-6">
                <span className="text-xs font-mono text-muted-foreground">
                  {item.hora_inicio}
                  {item.hora_fim ? ` → ${item.hora_fim}` : ""}
                </span>
                <p className="font-semibold mt-0.5">{item.titulo}</p>
                {item.descricao && (
                  <p className="text-sm text-muted-foreground mt-1">{item.descricao}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoDepoimentos({ dados }: { dados: any }) {
  const lista: Depoimento[] = dados?.depoimentos ?? [];
  if (!lista.length) return null;
  return (
    <section className="py-16 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">O que dizem sobre nossos eventos</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {lista.map((dep) => (
            <div key={dep.id} className="bg-background rounded-xl border p-6 space-y-4">
              <p className="text-muted-foreground italic leading-relaxed">"{dep.texto}"</p>
              <div className="flex items-center gap-3">
                {dep.foto_url ? (
                  <img
                    src={dep.foto_url}
                    alt={dep.nome}
                    className="w-10 h-10 rounded-full object-cover border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {dep.nome.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{dep.nome}</p>
                  {dep.cargo && <p className="text-xs text-muted-foreground">{dep.cargo}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoLocal({ dados }: { dados: any }) {
  if (!dados?.endereco && !dados?.link_mapa) return null;
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Local</h2>
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            {dados.endereco && <p className="font-medium">{dados.endereco}</p>}
            {dados.link_mapa && (
              <a
                href={dados.link_mapa}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-600 hover:underline mt-1 inline-block"
              >
                Ver no Google Maps →
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SecaoFaq({ dados }: { dados: any }) {
  const lista: FaqItem[] = dados?.faqs ?? [];
  const [aberto, setAberto] = useState<string | null>(null);
  if (!lista.length) return null;
  return (
    <section className="py-16 px-6 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">Perguntas frequentes</h2>
        <div className="space-y-2">
          {lista.map((faq) => (
            <div key={faq.id} className="border rounded-lg bg-background overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left font-medium hover:bg-muted/30 transition-colors"
                onClick={() => setAberto(aberto === faq.id ? null : faq.id)}
              >
                {faq.pergunta}
                {aberto === faq.id ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {aberto === faq.id && (
                <div className="px-5 pb-4 text-muted-foreground text-sm leading-relaxed">
                  {faq.resposta}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoCTA({
  evento,
  onInscrever,
}: {
  evento: any;
  onInscrever: () => void;
}) {
  return (
    <section className="py-16 px-6 bg-amber-500 dark:bg-amber-600">
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h2 className="text-2xl font-bold text-black">Garanta sua vaga agora</h2>
        {evento.valor > 0 && (
          <p className="text-3xl font-bold text-black">{formatValor(evento.valor)}</p>
        )}
        {evento.limite_participantes && (
          <p className="text-sm text-black/70 flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4" /> Vagas limitadas
          </p>
        )}
        <Button
          size="lg"
          className="bg-black hover:bg-black/80 text-white font-semibold text-base px-10"
          onClick={onInscrever}
        >
          Quero me inscrever
        </Button>
      </div>
    </section>
  );
}

export function PaginaPreview({
  evento,
  secoes,
  onInscrever,
}: {
  evento: any;
  secoes: Secao[];
  onInscrever?: () => void;
}) {
  const handleInscrever = onInscrever ?? (() => {});
  const ativas = secoes.filter((s) => s.ativo).sort((a, b) => a.ordem - b.ordem);
  const temHero = ativas.some((s) => s.tipo === "hero");

  return (
    <div className="min-h-screen bg-background">
      {!temHero && (
        <SecaoHero
          evento={evento}
          dados={{ cta_texto: "Quero me inscrever" }}
          onInscrever={handleInscrever}
        />
      )}
      {ativas.map((secao) => {
        switch (secao.tipo) {
          case "hero":
            return (
              <SecaoHero
                key={secao.id}
                evento={evento}
                dados={secao.dados}
                onInscrever={handleInscrever}
              />
            );
          case "sobre":
            return <SecaoSobre key={secao.id} dados={secao.dados} />;
          case "palestrantes":
            return <SecaoPalestrantes key={secao.id} dados={secao.dados} />;
          case "agenda":
            return <SecaoAgenda key={secao.id} dados={secao.dados} />;
          case "depoimentos":
            return <SecaoDepoimentos key={secao.id} dados={secao.dados} />;
          case "local":
            return <SecaoLocal key={secao.id} dados={secao.dados} />;
          case "faq":
            return <SecaoFaq key={secao.id} dados={secao.dados} />;
          default:
            return null;
        }
      })}
      {evento.status !== "finalizado" && evento.status !== "cancelado" && (
        <SecaoCTA evento={evento} onInscrever={handleInscrever} />
      )}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        {new Date().getFullYear()} · Grupo Excellence
      </footer>
    </div>
  );
}
