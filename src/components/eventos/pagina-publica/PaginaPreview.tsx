import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { Secao, Palestrante, AgendaItem, Depoimento, FaqItem, Beneficio, Garantia, SecaoEstilo } from "./types";

const formatValor = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function buildSectionStyle(estilo?: SecaoEstilo): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (estilo?.bg_color) style.backgroundColor = estilo.bg_color;
  return style;
}

const PADDING_CLASS: Record<string, string> = {
  none: "py-0",
  sm:   "py-8",
  md:   "py-16",
  lg:   "py-24",
};

function sectionPadding(estilo?: SecaoEstilo, fallback = "py-16") {
  if (!estilo?.padding || estilo.padding === "md") return fallback;
  return PADDING_CLASS[estilo.padding] ?? fallback;
}

/* ─── Hero ────────────────────────────────────────────────── */
export function SecaoHero({
  evento,
  dados,
  estilo,
  onInscrever,
}: {
  evento: any;
  dados: any;
  estilo?: SecaoEstilo;
  onInscrever: () => void;
}) {
  return (
    <section className="relative min-h-[60vh] flex items-end" style={buildSectionStyle(estilo)}>
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

/* ─── Hero Editorial ──────────────────────────────────────── */
export function SecaoHeroEditorial({
  evento,
  dados,
  estilo,
  onInscrever,
}: {
  evento: any;
  dados: any;
  estilo?: SecaoEstilo;
  onInscrever: () => void;
}) {
  const stone = "#F2EFE8";
  const dark = "#0B0B0B";
  const gold = "#B69A61";
  const muted = "#88847C";

  return (
    <section style={{ backgroundColor: stone, ...buildSectionStyle(estilo) }}>
      {/* Thin top rule */}
      <div style={{ height: "1px", backgroundColor: `${dark}1A` }} />

      {/* Main grid */}
      <div
        className="mx-auto grid md:grid-cols-12 items-center gap-8 md:gap-12 px-6 md:px-16"
        style={{ maxWidth: "1280px", paddingTop: "clamp(48px, 6vw, 96px)", paddingBottom: "clamp(48px, 6vw, 96px)" }}
      >
        {/* Left: text content */}
        <div className="md:col-span-7 flex flex-col gap-5">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5">
            <span style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {dados?.eyebrow || "EVENTO EXCLUSIVO"}
            </span>
            <span style={{ height: "1px", width: "24px", backgroundColor: `${gold}66`, display: "inline-block" }} />
          </div>

          {/* Headline */}
          <h1
            style={{
              color: dark,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "-0.04em",
              lineHeight: 0.92,
              fontSize: "clamp(36px, 5vw, 72px)",
              margin: 0,
            }}
          >
            {evento.nome}
          </h1>

          {/* Thin rule */}
          <div style={{ height: "1px", backgroundColor: `${dark}26`, maxWidth: "200px" }} />

          {/* Subtitle */}
          {dados?.subtitulo && (
            <p style={{ color: "#55524D", fontSize: "17px", lineHeight: 1.65, maxWidth: "480px", margin: 0 }}>
              {dados.subtitulo}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-5" style={{ color: muted, fontSize: "13px" }}>
            {evento.data && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" style={{ color: gold }} />
                {formatDate(evento.data)}
              </span>
            )}
            {evento.local && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" style={{ color: gold }} />
                {evento.local}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={onInscrever}
              className="group/cta"
              style={{
                backgroundColor: dark,
                color: stone,
                padding: "14px 28px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = gold)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = dark)}
            >
              {dados?.cta_texto || "Saiba mais"} →
            </button>
            {evento.valor > 0 && (
              <span style={{ color: muted, fontSize: "14px" }}>{formatValor(evento.valor)}</span>
            )}
            {!evento.pago && (
              <span style={{ color: gold, fontWeight: 600, fontSize: "14px" }}>Gratuito</span>
            )}
          </div>
        </div>

        {/* Right: photo */}
        <div className="md:col-span-5">
          <div style={{ aspectRatio: "4/5", overflow: "hidden", borderRadius: "4px", position: "relative" }}>
            {evento.banner_url ? (
              <img
                src={evento.banner_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9) contrast(1.03)" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(135deg, #E2DDD3 0%, #C8C4BC 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Foto do evento
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom info strip */}
      <div style={{ borderTop: `1px solid ${dark}1A`, borderBottom: `1px solid ${dark}1A` }}>
        <div
          className="mx-auto flex flex-wrap gap-8 px-6 md:px-16"
          style={{ maxWidth: "1280px", paddingTop: "14px", paddingBottom: "14px" }}
        >
          {evento.data && (
            <div>
              <span style={{ color: gold, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "10px", display: "block", marginBottom: "2px" }}>
                Data
              </span>
              <span style={{ color: muted, fontSize: "13px" }}>{formatDate(evento.data)}</span>
            </div>
          )}
          {evento.local && (
            <div>
              <span style={{ color: gold, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "10px", display: "block", marginBottom: "2px" }}>
                Local
              </span>
              <span style={{ color: muted, fontSize: "13px" }}>{evento.local}</span>
            </div>
          )}
          {evento.valor > 0 && (
            <div>
              <span style={{ color: gold, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "10px", display: "block", marginBottom: "2px" }}>
                Investimento
              </span>
              <span style={{ color: muted, fontSize: "13px" }}>{formatValor(evento.valor)}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Sobre Editorial (ExperienceSection) ────────────────── */
export function SecaoSobreEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  if (!dados?.texto) return null;
  const dark = "#0B0B0B", cream = "#F2EFE8", gold = "#B69A61";
  return (
    <section style={{ backgroundColor: dark, color: cream, ...buildSectionStyle(estilo), padding: "clamp(80px,10vw,160px) 0" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-3 flex items-center gap-3">
            <span style={{ color: `${cream}99`, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {dados.titulo_secao || "A EXPERIÊNCIA"}
            </span>
            <span style={{ height: "1px", width: "40px", backgroundColor: `${cream}2B`, display: "inline-block" }} />
          </div>
          <div className="md:col-span-9">
            <p style={{ fontWeight: 800, textTransform: "uppercase", color: cream, lineHeight: 0.92, letterSpacing: "-0.05em", fontSize: "clamp(32px,6vw,80px)", whiteSpace: "pre-line", margin: 0 }}>
              {dados.texto}
            </p>
          </div>
        </div>
        <div style={{ height: "1px", backgroundColor: `${cream}2B`, margin: "clamp(55px,8vw,110px) 0" }} />
        {dados.imagem_url && (
          <div className="grid md:grid-cols-12">
            <div className="md:col-span-9 md:col-start-4">
              <img src={dados.imagem_url} alt="" style={{ width: "100%", height: "clamp(260px,35vw,480px)", objectFit: "cover", filter: "saturate(0.6)" }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Benefícios Editorial (CommunityExperienceSection) ───── */
export function SecaoBeneficiosEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Beneficio[] = dados?.beneficios ?? [];
  if (!lista.length) return null;
  const stone = "#F2EFE8", dark = "#0B0B0B", gold = "#B69A61", muted = "#88847C";
  return (
    <section style={{ backgroundColor: stone, ...buildSectionStyle(estilo), padding: "clamp(80px,9vw,150px) 0" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
          <div className="md:col-span-7 flex flex-col gap-8">
            <div className="flex items-center gap-2.5">
              <span style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                {dados.titulo_secao || "O QUE VOCÊ VAI VIVER"}
              </span>
              <span style={{ height: "1px", width: "24px", backgroundColor: `${gold}66`, display: "inline-block" }} />
            </div>
            <div>
              {lista.map((b) => (
                <div key={b.id} style={{ borderTop: `1px solid ${dark}1A`, padding: "clamp(18px,2.5vw,28px) 0" }}>
                  <div className="flex items-start gap-4">
                    <span style={{ fontSize: "22px", minWidth: "28px", lineHeight: 1 }}>{b.icone}</span>
                    <div>
                      <h3 style={{ color: dark, fontWeight: 700, fontSize: "15px", letterSpacing: "-0.02em", marginBottom: "5px", textTransform: "uppercase" }}>{b.titulo}</h3>
                      <p style={{ color: muted, fontSize: "14px", lineHeight: 1.65, margin: 0 }}>{b.texto}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${dark}1A` }} />
            </div>
          </div>
          <div className="md:col-span-5 hidden md:block" style={{ position: "relative", height: "460px" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: "78%", height: "72%", backgroundColor: "#E2DDD3", borderRadius: "4px" }} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: "62%", height: "54%", backgroundColor: "#C8C4BC", borderRadius: "4px", border: `4px solid ${stone}` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Palestrantes Editorial (JourneyLeaderSection) ───────── */
export function SecaoPalestrantesEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Palestrante[] = dados?.palestrantes ?? [];
  if (!lista.length) return null;
  const lider = lista[0];
  const stone = "#F2EFE8", dark = "#0B0B0B", gold = "#B69A61", muted = "#88847C";
  return (
    <section style={{ backgroundColor: stone, ...buildSectionStyle(estilo), padding: "clamp(100px,12vw,190px) 0" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="flex items-center gap-3 mb-12">
          <span style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            03
          </span>
          <span style={{ height: "1px", width: "32px", backgroundColor: `${dark}29`, display: "inline-block" }} />
          <span style={{ color: muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            QUEM CONDUZ
          </span>
        </div>
        <h2 style={{ fontWeight: 800, textTransform: "uppercase", color: dark, lineHeight: 0.90, letterSpacing: "-0.05em", fontSize: "clamp(40px,7vw,100px)", maxWidth: "1100px", marginBottom: "clamp(60px,8vw,120px)" }}>
          {lider.nome}
        </h2>
        <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-start">
          <div className="md:col-span-5">
            {lider.foto_url ? (
              <img src={lider.foto_url} alt={lider.nome} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: "4px", filter: "saturate(0.85)" }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "3/4", backgroundColor: "#C8C4BC", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Foto</span>
              </div>
            )}
          </div>
          <div className="md:col-span-7 flex flex-col justify-center gap-6 pt-4">
            <div>
              <p style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                {lider.cargo || "LÍDER & MENTORA"}
              </p>
              <h3 style={{ color: dark, fontSize: "clamp(22px,2.5vw,32px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>{lider.nome}</h3>
            </div>
            <div style={{ height: "1px", backgroundColor: `${dark}1A`, maxWidth: "120px" }} />
            <p style={{ color: muted, fontSize: "16px", lineHeight: 1.7, margin: 0 }}>{lider.bio}</p>
            {lista.length > 1 && (
              <div className="flex flex-wrap gap-4 pt-2">
                {lista.slice(1).map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nome} style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", filter: "saturate(0.8)" }} />
                    ) : (
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#C8C4BC" }} />
                    )}
                    <div>
                      <p style={{ color: dark, fontSize: "13px", fontWeight: 700, margin: 0 }}>{p.nome}</p>
                      <p style={{ color: muted, fontSize: "11px", margin: 0 }}>{p.cargo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Agenda Editorial (JourneyMapSection) ────────────────── */
export function SecaoAgendaEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const lista: AgendaItem[] = dados?.itens ?? [];
  if (!lista.length) return null;
  const active = lista[activeIdx];
  const dark = "#0B0B0B", cream = "#F2EFE8", gold = "#B69A61", muted = "#88847C";
  return (
    <section style={{ backgroundColor: dark, color: cream, ...buildSectionStyle(estilo), padding: "clamp(80px,9vw,150px) 0" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="flex items-center gap-2.5 mb-12">
          <span style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            {dados.titulo_secao || "A JORNADA"}
          </span>
          <span style={{ height: "1px", width: "24px", backgroundColor: `${gold}66`, display: "inline-block" }} />
        </div>
        {/* Tab strip */}
        <div className="flex flex-wrap gap-1 mb-10" style={{ borderBottom: `1px solid ${cream}1A` }}>
          {lista.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setActiveIdx(i)}
              style={{
                padding: "8px 20px 10px",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: i === activeIdx ? cream : `${cream}66`,
                backgroundColor: "transparent",
                border: "none",
                borderBottom: i === activeIdx ? `2px solid ${gold}` : "2px solid transparent",
                cursor: "pointer",
                transition: "color 0.2s",
                marginBottom: "-1px",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
        {/* Active content */}
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
          <div className="md:col-span-7 flex flex-col gap-5">
            <div>
              <p style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                {active.hora_inicio && active.hora_fim ? `${active.hora_inicio} – ${active.hora_fim}` : active.hora_inicio || ""}
              </p>
              <h3 style={{ color: cream, fontWeight: 800, fontSize: "clamp(22px,3vw,38px)", letterSpacing: "-0.04em", lineHeight: 1.05, margin: 0, textTransform: "uppercase" }}>
                {active.titulo}
              </h3>
            </div>
            {active.descricao && (
              <p style={{ color: `${cream}CC`, fontSize: "15px", lineHeight: 1.7, borderLeft: `2px solid ${gold}`, paddingLeft: "16px", margin: 0 }}>
                {active.descricao}
              </p>
            )}
          </div>
          <div className="md:col-span-5 hidden md:flex items-center justify-end">
            <div style={{ fontSize: "clamp(80px,12vw,140px)", fontWeight: 900, color: `${cream}0D`, lineHeight: 1, letterSpacing: "-0.05em", userSelect: "none" }}>
              {String(activeIdx + 1).padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Depoimentos Editorial (TestimonialsSection) ─────────── */
export function SecaoDepoimentosEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const lista: Depoimento[] = dados?.depoimentos ?? [];
  if (!lista.length) return null;
  const current = lista[currentIdx];
  const stone = "#F2EFE8", dark = "#0B0B0B", gold = "#B69A61", muted = "#88847C";
  return (
    <section style={{ backgroundColor: stone, ...buildSectionStyle(estilo), padding: "clamp(80px,9vw,150px) 0" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="flex items-center gap-2.5 mb-12">
          <span style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            PROVA SOCIAL
          </span>
          <span style={{ height: "1px", width: "24px", backgroundColor: `${gold}66`, display: "inline-block" }} />
        </div>
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-center">
          {/* Photo */}
          <div className="md:col-span-5">
            <div style={{ aspectRatio: "4/5", borderRadius: "16px", overflow: "hidden", backgroundColor: "#E2DDD3", position: "relative" }}>
              {current.foto_url ? (
                <img src={current.foto_url} alt={current.nome} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9) contrast(1.03)" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: muted, fontSize: "11px", textTransform: "uppercase" }}>Foto</span>
                </div>
              )}
            </div>
          </div>
          {/* Quote */}
          <div className="md:col-span-6 flex flex-col gap-5">
            <span style={{ fontSize: "56px", fontFamily: "serif", color: gold, lineHeight: 1, display: "block", marginBottom: "-12px", userSelect: "none" }}>"</span>
            <blockquote style={{ color: dark, fontSize: "clamp(18px,2.2vw,26px)", lineHeight: 1.4, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
              {current.texto.replace(/^["""]|["""]$/g, "")}
            </blockquote>
            <div style={{ borderTop: `1px solid ${dark}1A`, paddingTop: "16px", maxWidth: "280px" }}>
              <p style={{ color: dark, fontSize: "16px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.01em", margin: "0 0 2px" }}>{current.nome}</p>
              <p style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>{current.cargo}</p>
            </div>
            {/* Thumbnail navigation */}
            {lista.length > 1 && (
              <div className="flex items-center gap-3 pt-2">
                {lista.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => setCurrentIdx(i)}
                    style={{
                      width: "44px", height: "52px", borderRadius: "6px", overflow: "hidden",
                      opacity: i === currentIdx ? 1 : 0.45,
                      outline: i === currentIdx ? `2px solid ${gold}` : "none",
                      outlineOffset: "2px",
                      transform: i === currentIdx ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.2s",
                      cursor: "pointer",
                      backgroundColor: "#C8C4BC",
                      border: "none",
                      padding: 0,
                    }}
                  >
                    {d.foto_url && <img src={d.foto_url} alt={d.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </button>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setCurrentIdx((currentIdx - 1 + lista.length) % lista.length)} style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${dark}33`, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: dark, fontSize: "16px" }}>‹</button>
                  <button onClick={() => setCurrentIdx((currentIdx + 1) % lista.length)} style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${dark}33`, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: dark, fontSize: "16px" }}>›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Garantias Editorial (CommunityDecisionSection) ─────── */
export function SecaoGarantiasEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Garantia[] = dados?.garantias ?? [];
  if (!lista.length) return null;
  const stone = "#F2EFE8", dark = "#0B0B0B", gold = "#B69A61", muted = "#88847C";
  return (
    <section style={{ backgroundColor: stone, ...buildSectionStyle(estilo), padding: "clamp(80px,9vw,150px) 0" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="flex items-center gap-2.5 mb-10">
          <span style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            INVESTIMENTO
          </span>
          <span style={{ height: "1px", width: "24px", backgroundColor: `${gold}66`, display: "inline-block" }} />
        </div>
        <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-start">
          <div className="md:col-span-6 flex flex-col gap-4">
            <h2 style={{ color: dark, fontWeight: 800, fontSize: "clamp(28px,3.5vw,48px)", letterSpacing: "-0.04em", lineHeight: 1.1, margin: 0 }}>
              {dados.titulo_secao || "Seu investimento para viver essa transformação"}
            </h2>
          </div>
          <div className="md:col-span-6">
            <div style={{ border: `1px solid ${dark}1A`, borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ backgroundColor: dark, padding: "clamp(24px,3vw,40px)" }}>
                <p style={{ color: `${stone}99`, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                  INCLUÍDO NA JORNADA
                </p>
                <div style={{ color: stone, fontSize: "clamp(28px,3.5vw,42px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
                  {lista.length} benefícios
                </div>
              </div>
              <div style={{ backgroundColor: `${stone}`, padding: "clamp(20px,2.5vw,32px)" }}>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  {lista.map((g) => (
                    <li key={g.id} className="flex items-start gap-3">
                      <span style={{ color: gold, fontSize: "16px", lineHeight: 1.4, minWidth: "20px" }}>{g.icone}</span>
                      <span style={{ color: dark, fontSize: "14px", lineHeight: 1.5 }}>{g.texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ Editorial (CommunityFinalSection) ───────────────── */
export function SecaoFaqEditorial({ dados, estilo, onInscrever }: { dados: any; estilo?: SecaoEstilo; onInscrever: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const lista: FaqItem[] = dados?.faqs ?? [];
  if (!lista.length) return null;
  const stone = "#F2EFE8", dark = "#0B0B0B", gold = "#B69A61", muted = "#88847C";
  return (
    <section style={{ backgroundColor: stone, ...buildSectionStyle(estilo), padding: "clamp(80px,9vw,150px) 0" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-start">
          {/* Left: label + CTA */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <div className="flex items-center gap-2.5">
              <span style={{ color: gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>DÚVIDAS FREQUENTES</span>
              <span style={{ height: "1px", width: "20px", backgroundColor: `${gold}66`, display: "inline-block" }} />
            </div>
            <h2 style={{ color: dark, fontWeight: 800, fontSize: "clamp(28px,3vw,44px)", letterSpacing: "-0.04em", lineHeight: 1.05, margin: 0 }}>
              {dados.titulo_secao || "Perguntas & Respostas"}
            </h2>
            <button
              onClick={onInscrever}
              style={{ alignSelf: "flex-start", marginTop: "8px", backgroundColor: dark, color: stone, padding: "13px 24px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = gold)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = dark)}
            >
              {dados?.cta_texto || "QUERO PARTICIPAR"} →
            </button>
          </div>
          {/* Right: accordion */}
          <div className="md:col-span-8">
            {lista.map((item, i) => (
              <div key={item.id} style={{ borderTop: `1px solid ${dark}1A` }}>
                <button
                  onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  className="w-full text-left flex items-start gap-4 py-5"
                  style={{ backgroundColor: "transparent", border: "none", cursor: "pointer" }}
                >
                  <span style={{ color: gold, fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", minWidth: "28px", paddingTop: "2px" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ color: dark, fontSize: "clamp(14px,1.5vw,17px)", fontWeight: 600, flex: 1, letterSpacing: "-0.01em" }}>{item.pergunta}</span>
                  <span style={{ color: muted, fontSize: "18px", lineHeight: 1, transition: "transform 0.2s", transform: openId === item.id ? "rotate(45deg)" : "none" }}>+</span>
                </button>
                {openId === item.id && (
                  <div style={{ paddingLeft: "44px", paddingBottom: "20px" }}>
                    <p style={{ color: muted, fontSize: "15px", lineHeight: 1.7, margin: 0 }}>{item.resposta}</p>
                  </div>
                )}
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${dark}1A` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Sobre ───────────────────────────────────────────────── */
export function SecaoSobre({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  if (!dados?.texto) return null;
  return (
    <section
      className={`${sectionPadding(estilo)} px-6`}
      style={buildSectionStyle(estilo)}
    >
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

/* ─── Benefícios ──────────────────────────────────────────── */
export function SecaoBeneficios({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Beneficio[] = dados?.beneficios ?? [];
  if (!lista.length) return null;
  const titulo = dados?.titulo_secao ?? "Por que participar?";
  return (
    <section
      className={`${sectionPadding(estilo)} px-6`}
      style={buildSectionStyle(estilo)}
    >
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-10 text-center">{titulo}</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
          {lista.map((b) => (
            <div key={b.id} className="flex flex-col items-center text-center">
              <span className="text-4xl mb-3">{b.icone}</span>
              <h3 className="font-semibold text-base mb-1">{b.titulo}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Garantias ───────────────────────────────────────────── */
export function SecaoGarantias({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Garantia[] = dados?.garantias ?? [];
  if (!lista.length) return null;
  return (
    <section
      className={`${sectionPadding(estilo, "py-10")} px-6 bg-muted/20`}
      style={buildSectionStyle(estilo)}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-center gap-4">
          {lista.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 bg-background rounded-xl border px-5 py-3 shadow-sm"
            >
              <span className="text-2xl">{g.icone}</span>
              <span className="text-sm font-medium">{g.texto}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Palestrantes ────────────────────────────────────────── */
export function SecaoPalestrantes({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Palestrante[] = dados?.palestrantes ?? [];
  if (!lista.length) return null;
  return (
    <section
      className={`${sectionPadding(estilo)} px-6 bg-muted/30`}
      style={buildSectionStyle(estilo)}
    >
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

/* ─── Agenda ──────────────────────────────────────────────── */
export function SecaoAgenda({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: AgendaItem[] = dados?.itens ?? [];
  if (!lista.length) return null;
  return (
    <section
      className={`${sectionPadding(estilo)} px-6`}
      style={buildSectionStyle(estilo)}
    >
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

/* ─── Depoimentos ─────────────────────────────────────────── */
export function SecaoDepoimentos({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Depoimento[] = dados?.depoimentos ?? [];
  if (!lista.length) return null;
  return (
    <section
      className={`${sectionPadding(estilo)} px-6 bg-muted/30`}
      style={buildSectionStyle(estilo)}
    >
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

/* ─── Local ───────────────────────────────────────────────── */
export function SecaoLocal({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  if (!dados?.endereco && !dados?.link_mapa) return null;
  return (
    <section
      className={`${sectionPadding(estilo)} px-6`}
      style={buildSectionStyle(estilo)}
    >
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

/* ─── FAQ ─────────────────────────────────────────────────── */
export function SecaoFaq({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: FaqItem[] = dados?.faqs ?? [];
  const [aberto, setAberto] = useState<string | null>(null);
  if (!lista.length) return null;
  return (
    <section
      className={`${sectionPadding(estilo)} px-6 bg-muted/30`}
      style={buildSectionStyle(estilo)}
    >
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

/* ─── CTA ─────────────────────────────────────────────────── */
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

/* ─── Render helper ───────────────────────────────────────── */
export function renderSecao(secao: Secao, evento: any, onInscrever: () => void) {
  const { tipo, dados, estilo } = secao;
  switch (tipo) {
    case "hero":
      if (dados?.variante === "editorial")
        return <SecaoHeroEditorial evento={evento} dados={dados} estilo={estilo} onInscrever={onInscrever} />;
      return <SecaoHero evento={evento} dados={dados} estilo={estilo} onInscrever={onInscrever} />;
    case "sobre":
      if (dados?.variante === "editorial") return <SecaoSobreEditorial dados={dados} estilo={estilo} />;
      return <SecaoSobre dados={dados} estilo={estilo} />;
    case "beneficios":
      if (dados?.variante === "editorial") return <SecaoBeneficiosEditorial dados={dados} estilo={estilo} />;
      return <SecaoBeneficios dados={dados} estilo={estilo} />;
    case "garantias":
      if (dados?.variante === "editorial") return <SecaoGarantiasEditorial dados={dados} estilo={estilo} />;
      return <SecaoGarantias dados={dados} estilo={estilo} />;
    case "palestrantes":
      if (dados?.variante === "editorial") return <SecaoPalestrantesEditorial dados={dados} estilo={estilo} />;
      return <SecaoPalestrantes dados={dados} estilo={estilo} />;
    case "agenda":
      if (dados?.variante === "editorial") return <SecaoAgendaEditorial dados={dados} estilo={estilo} />;
      return <SecaoAgenda dados={dados} estilo={estilo} />;
    case "depoimentos":
      if (dados?.variante === "editorial") return <SecaoDepoimentosEditorial dados={dados} estilo={estilo} />;
      return <SecaoDepoimentos dados={dados} estilo={estilo} />;
    case "local":        return <SecaoLocal dados={dados} estilo={estilo} />;
    case "faq":
      if (dados?.variante === "editorial") return <SecaoFaqEditorial dados={dados} estilo={estilo} onInscrever={onInscrever} />;
      return <SecaoFaq dados={dados} estilo={estilo} />;
    default:             return null;
  }
}

/* ─── PaginaPreview (página pública final) ────────────────── */
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
      {ativas.map((secao) => (
        <div key={secao.id}>
          {renderSecao(secao, evento, handleInscrever)}
        </div>
      ))}
      {evento.status !== "finalizado" && evento.status !== "cancelado" && (
        <SecaoCTA evento={evento} onInscrever={handleInscrever} />
      )}
      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        {new Date().getFullYear()} · Grupo Excellence
      </footer>
    </div>
  );
}
