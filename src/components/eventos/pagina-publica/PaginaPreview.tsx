import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { Secao, Palestrante, AgendaItem, Depoimento, FaqItem, Beneficio, Garantia, SecaoEstilo } from "./types";

/* ─── Palette ─────────────────────────────────────────────── */
const P = {
  stone: "#F2EFE8",
  dark:  "#0B0B0B",
  gold:  "#B69A61",
  muted: "#88847C",
  body:  "#55524D",
} as const;

const MANROPE: React.CSSProperties = { fontFamily: "'Manrope', sans-serif" };

/* ─── Motion presets ───────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 as const },
  transition: { duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] },
});

const scaleXIn = {
  initial: { scaleX: 0 },
  whileInView: { scaleX: 1 },
  viewport: { once: true, amount: 0.5 as const },
  transition: { duration: 1.0, ease: [0.22, 1, 0.36, 1] },
  style: { transformOrigin: "left" as const },
};

/* ─── Helpers ─────────────────────────────────────────────── */
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

/* ─── Eyebrow helper ───────────────────────────────────────── */
function Eyebrow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {text}
      </span>
      <span style={{ height: "1px", width: "24px", backgroundColor: `${P.gold}66`, display: "inline-block" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO (default)
════════════════════════════════════════════════════════════════ */
export function SecaoHero({
  evento, dados, estilo, onInscrever,
}: { evento: any; dados: any; estilo?: SecaoEstilo; onInscrever: () => void }) {
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
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-3" style={{ textWrap: "balance" } as any}>
          {evento.nome}
        </h1>
        {dados?.subtitulo && <p className="text-lg text-white/80 mb-6 max-w-2xl">{dados.subtitulo}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-base px-8 shadow-lg" onClick={onInscrever}>
            {dados?.cta_texto || "Quero me inscrever"}
          </Button>
          {evento.valor > 0 && <span className="text-white text-lg font-semibold">{formatValor(evento.valor)}</span>}
          {!evento.pago && <span className="text-green-400 font-semibold text-lg">Gratuito</span>}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO EDITORIAL
════════════════════════════════════════════════════════════════ */
export function SecaoHeroEditorial({
  evento, dados, estilo, onInscrever,
}: { evento: any; dados: any; estilo?: SecaoEstilo; onInscrever: () => void }) {
  return (
    <section style={{ backgroundColor: P.stone, ...MANROPE, ...buildSectionStyle(estilo) }}>

      {/* Top editorial bar */}
      <div style={{ borderBottom: `1px solid ${P.dark}1A` }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex items-center justify-between px-6 md:px-[clamp(24px,4vw,72px)]"
          style={{ maxWidth: "1440px", paddingTop: "20px", paddingBottom: "20px" }}
        >
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: P.dark }}>
            {dados?.eyebrow || evento.nome}
          </span>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: P.muted }}>
            {evento.data ? formatDate(evento.data) : "EM BREVE"}
          </span>
        </motion.div>
      </div>

      {/* Main grid */}
      <div
        className="mx-auto grid lg:grid-cols-12 items-center gap-8 lg:gap-8 px-6 md:px-[clamp(24px,4vw,72px)]"
        style={{ maxWidth: "1440px", paddingTop: "clamp(48px,6vw,96px)", paddingBottom: "clamp(48px,6vw,96px)" }}
      >
        {/* Left: text */}
        <motion.div {...fadeUp(0)} className="lg:col-span-7 flex flex-col gap-6">
          <h1
            style={{
              color: P.dark,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "-0.05em",
              lineHeight: 0.92,
              fontSize: "clamp(40px,7vw,110px)",
              margin: 0,
            }}
          >
            {dados?.titulo_override || evento.nome}
          </h1>

          {dados?.subtitulo && (
            <p style={{ color: P.body, fontSize: "clamp(16px,1.4vw,19px)", lineHeight: 1.5, maxWidth: "500px", margin: 0 }}>
              {dados.subtitulo}
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-5" style={{ color: P.muted, fontSize: "13px" }}>
            {evento.data && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" style={{ color: P.gold }} />
                {formatDate(evento.data)}
              </span>
            )}
            {evento.local && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" style={{ color: P.gold }} />
                {evento.local}
              </span>
            )}
          </div>
        </motion.div>

        {/* Right: photo */}
        <motion.div
          className="lg:col-span-5"
          initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
          animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
          transition={{ duration: 0.95, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={{ aspectRatio: "4/5", overflow: "hidden", borderRadius: "2px", border: `1px solid ${P.dark}1A`, position: "relative" }}>
            {evento.banner_url ? (
              <img
                src={evento.banner_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.85) contrast(1.05)" }}
                className="hover:scale-[1.02] transition-transform duration-700"
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #E2DDD3 0%, #C8C4BC 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: P.muted, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" }}>Foto do evento</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Footer bar: supporting copy + meta + CTA */}
      <div style={{ borderTop: `1px solid ${P.dark}1A` }}>
        <motion.div
          {...fadeUp(0.2)}
          className="mx-auto grid lg:grid-cols-12 items-end gap-6 lg:gap-8 px-6 md:px-[clamp(24px,4vw,72px)]"
          style={{ maxWidth: "1440px", paddingTop: "clamp(28px,3vw,48px)", paddingBottom: "clamp(28px,3vw,48px)" }}
        >
          {/* Supporting copy */}
          <div className="lg:col-span-5">
            {dados?.subtitulo ? null : (
              <p style={{ color: P.body, fontSize: "clamp(15px,1.2vw,18px)", lineHeight: 1.5 }}>
                {evento.descricao || "Uma experiência de transformação pensada para você."}
              </p>
            )}
          </div>

          {/* Meta info */}
          <div className="lg:col-span-4 flex gap-6" style={{ borderLeft: `1px solid ${P.dark}14`, paddingLeft: "clamp(16px,2vw,32px)" }}>
            {evento.data && (
              <div>
                <span style={{ color: P.muted, fontSize: "10px", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>INÍCIO</span>
                <span style={{ color: P.dark, fontSize: "clamp(13px,1vw,16px)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{formatDate(evento.data)}</span>
              </div>
            )}
            {evento.local && (
              <div>
                <span style={{ color: P.muted, fontSize: "10px", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>LOCAL</span>
                <span style={{ color: P.dark, fontSize: "clamp(13px,1vw,16px)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{evento.local}</span>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="lg:col-span-3 flex justify-start lg:justify-end">
            <button
              onClick={onInscrever}
              className="group/cta w-full lg:w-auto"
              style={{
                backgroundColor: P.dark,
                color: P.stone,
                height: "58px",
                padding: "0 32px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: "2px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "24px",
                transition: "background-color 0.3s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = P.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = P.dark)}
            >
              <span>{dados?.cta_texto || "QUERO PARTICIPAR"}</span>
              <span style={{ display: "inline-block", transition: "transform 0.3s" }}>→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOBRE EDITORIAL (ExperienceSection)
════════════════════════════════════════════════════════════════ */
export function SecaoSobreEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  if (!dados?.texto) return null;
  return (
    <section
      style={{ backgroundColor: P.dark, color: P.stone, ...MANROPE, ...buildSectionStyle(estilo), paddingTop: "clamp(90px,14vw,200px)", paddingBottom: "clamp(90px,14vw,200px)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>

        {/* Grid: label + headline */}
        <div className="grid lg:grid-cols-12 gap-y-6 items-start">
          <motion.div {...fadeUp(0)} className="lg:col-span-3 flex items-center gap-3">
            <span style={{ color: `${P.stone}99`, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {dados.titulo_secao || "02 / A EXPERIÊNCIA"}
            </span>
            <span style={{ height: "1px", width: "40px", backgroundColor: `${P.stone}2B`, display: "inline-block" }} />
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="lg:col-span-9">
            <p style={{ fontWeight: 800, textTransform: "uppercase", color: P.stone, lineHeight: 0.92, letterSpacing: "-0.05em", fontSize: "clamp(32px,7.5vw,90px)", whiteSpace: "pre-line", margin: 0 }}>
              {dados.texto}
            </p>
          </motion.div>
        </div>

        {/* Animated horizontal rule */}
        <motion.div
          {...scaleXIn}
          style={{ ...scaleXIn.style, height: "1px", backgroundColor: `${P.stone}2B`, margin: "clamp(55px,8vw,110px) 0" }}
        />

        {/* Bottom: indicator + body text */}
        <motion.div {...fadeUp(0.15)} className="grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4">
            <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", display: "block" }}>
              UMA JORNADA DE DENTRO PARA FORA.
            </span>
          </div>
          {dados.imagem_url && (
            <div className="lg:col-span-8">
              <img src={dados.imagem_url} alt="" style={{ width: "100%", height: "clamp(240px,30vw,460px)", objectFit: "cover", filter: "saturate(0.6)", borderRadius: "2px" }} />
            </div>
          )}
        </motion.div>

      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BENEFÍCIOS EDITORIAL (CommunityExperienceSection)
════════════════════════════════════════════════════════════════ */
export function SecaoBeneficiosEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Beneficio[] = dados?.beneficios ?? [];
  if (!lista.length) return null;
  return (
    <section
      style={{ backgroundColor: P.stone, ...MANROPE, ...buildSectionStyle(estilo), paddingTop: "clamp(80px,9vw,150px)", paddingBottom: "clamp(90px,10vw,160px)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* LEFT: overlapping images */}
          <motion.div {...fadeUp(0)} className="lg:col-span-6">
            <div style={{ position: "relative", width: "100%", maxWidth: "540px", margin: "0 auto", aspectRatio: "4/4.5" }}>
              {/* Back image */}
              <div style={{ position: "absolute", top: 0, left: 0, width: "74%", aspectRatio: "4/5", borderRadius: "24px", overflow: "hidden", backgroundColor: "#E2DDD3", border: `1px solid ${P.dark}0D` }}>
                {dados.imagem_url ? (
                  <img src={dados.imagem_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9) contrast(1.03)" }} className="hover:scale-[1.02] transition-transform duration-700" />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, #E8E4DC 0%, #D8D3CA 100%)` }} />
                )}
              </div>
              {/* Front image */}
              <div style={{ position: "absolute", bottom: 0, right: 0, width: "70%", aspectRatio: "4/5", borderRadius: "24px", overflow: "hidden", backgroundColor: "#D4CFC6", border: `4px solid ${P.stone}`, zIndex: 10, boxShadow: "0 24px 48px rgba(11,11,11,0.12)" }}>
                {dados.imagem_url ? (
                  <img src={dados.imagem_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.8) contrast(1.05)", objectPosition: "center 30%" }} className="hover:scale-[1.02] transition-transform duration-700" />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, #CCC8BF 0%, #B8B4AB 100%)` }} />
                )}
              </div>
              {/* Decorative ring */}
              <div style={{ position: "absolute", bottom: "-16px", left: "-16px", width: "80px", height: "80px", borderRadius: "50%", border: `1px solid ${P.gold}25`, pointerEvents: "none" }} />
            </div>
          </motion.div>

          {/* RIGHT: eyebrow + title + benefit list */}
          <div className="lg:col-span-6 flex flex-col justify-center gap-8">
            <motion.div {...fadeUp(0)}>
              <Eyebrow text={dados.titulo_secao || "O QUE VOCÊ VAI VIVER"} />
            </motion.div>

            <motion.h2 {...fadeUp(0.1)} style={{ color: P.dark, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.04em", lineHeight: 0.95, fontSize: "clamp(32px,3.5vw,52px)", margin: 0 }}>
              {dados.titulo_secao || "O que você vai viver"}
            </motion.h2>

            <motion.div {...fadeUp(0.15)} className="flex flex-col gap-7">
              {lista.map((b, i) => (
                <motion.div key={b.id} {...fadeUp(0.1 + i * 0.08)} className="flex items-start gap-5 group">
                  {/* Circular icon */}
                  <div style={{ flexShrink: 0, width: "48px", height: "48px", borderRadius: "50%", backgroundColor: `${P.gold}1A`, border: `1px solid ${P.gold}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", lineHeight: 1, transition: "background-color 0.3s" }} className="group-hover:bg-[#B69A61]/30">
                    {b.icone}
                  </div>
                  <div style={{ flex: 1, paddingTop: "2px" }}>
                    <h3 style={{ color: P.dark, fontSize: "clamp(16px,1.3vw,20px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "6px" }}>{b.titulo}</h3>
                    <p style={{ color: P.body, fontSize: "clamp(13px,1vw,15px)", lineHeight: 1.55, margin: 0 }}>{b.texto}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PALESTRANTES EDITORIAL (JourneyLeaderSection)
════════════════════════════════════════════════════════════════ */
export function SecaoPalestrantesEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Palestrante[] = dados?.palestrantes ?? [];
  if (!lista.length) return null;
  const lider = lista[0];
  return (
    <section
      style={{ backgroundColor: P.stone, ...MANROPE, ...buildSectionStyle(estilo), paddingTop: "clamp(120px,12vw,190px)", paddingBottom: "clamp(130px,13vw,210px)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>

        {/* Section indicator */}
        <motion.div {...fadeUp(0)} className="flex items-center gap-3 mb-[clamp(60px,6vw,85px)]">
          <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>03</span>
          <span style={{ height: "1px", width: "32px", backgroundColor: `${P.dark}29`, display: "inline-block" }} />
          <span style={{ color: P.muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>QUEM CONDUZ</span>
        </motion.div>

        {/* Big headline name */}
        <motion.h2 {...fadeUp(0.1)} style={{ fontWeight: 800, textTransform: "uppercase", color: P.dark, lineHeight: 0.90, letterSpacing: "-0.052em", fontSize: "clamp(43px,8vw,112px)", marginBottom: "clamp(90px,12vw,160px)" }}>
          {lider.nome}
        </motion.h2>

        {/* Grid: photo 7/12 + bio 5/12 */}
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">

          {/* Photo — 7 cols */}
          <motion.div
            className="lg:col-span-7 relative group"
            initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
            whileInView={{ opacity: 1, clipPath: "inset(0 0 0 0)" }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{ width: "100%", aspectRatio: "4/5", overflow: "hidden", borderRadius: "2px", backgroundColor: "#E2DDD3" }}>
              {lider.foto_url ? (
                <img src={lider.foto_url} alt={lider.nome} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.88) contrast(1.02)" }} className="group-hover:scale-[1.015] transition-transform duration-700" />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: P.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Foto</span>
                </div>
              )}
            </div>
            {/* Vertical text label */}
            <div className="hidden lg:block absolute -left-10 top-1/2 -translate-y-1/2" style={{ writingMode: "vertical-rl", transform: "rotate(180deg) translateY(50%)", transformOrigin: "center" }}>
              <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: `${P.muted}99`, whiteSpace: "nowrap" }}>
                QUEM TRANSFORMA TRANSFORMA
              </span>
            </div>
          </motion.div>

          {/* Bio — 5 cols */}
          <motion.div {...fadeUp(0.25)} className="lg:col-span-5 flex flex-col gap-6 pt-2">
            <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", color: P.muted, textTransform: "uppercase", display: "block" }}>01</span>
            <h3 style={{ color: P.dark, fontWeight: 800, textTransform: "uppercase", fontSize: "clamp(36px,4vw,64px)", lineHeight: 0.89, letterSpacing: "-0.05em", margin: 0 }}>
              {lider.nome.split(" ").map((w, i) => (
                <span key={i}>{w}<br /></span>
              ))}
            </h3>
            <p style={{ color: P.gold, fontSize: "11px", fontWeight: 600, letterSpacing: "0.13em", textTransform: "uppercase", margin: 0 }}>
              {lider.cargo || "IDEALIZADORA & MENTORA"}
            </p>
            <div style={{ height: "1px", backgroundColor: `${P.dark}12`, maxWidth: "120px" }} />
            <p style={{ color: P.body, fontSize: "clamp(15px,1.3vw,19px)", lineHeight: 1.5, margin: 0 }}>{lider.bio}</p>

            {/* Other speakers */}
            {lista.length > 1 && (
              <div className="flex flex-wrap gap-4 pt-4" style={{ borderTop: `1px solid ${P.dark}12` }}>
                {lista.slice(1).map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nome} style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", filter: "saturate(0.8)" }} />
                    ) : (
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#C8C4BC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: P.muted, fontSize: "14px", fontWeight: 700 }}>{p.nome.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <p style={{ color: P.dark, fontSize: "13px", fontWeight: 700, margin: 0 }}>{p.nome}</p>
                      <p style={{ color: P.muted, fontSize: "11px", margin: 0 }}>{p.cargo}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Closing statement */}
        <motion.div {...fadeUp(0.1)} style={{ marginTop: "clamp(110px,15vw,180px)", paddingTop: "40px", borderTop: `1px solid ${P.dark}1A` }}>
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 lg:col-start-5">
              <p style={{ fontWeight: 700, textTransform: "uppercase", color: P.dark, lineHeight: 1.02, letterSpacing: "-0.04em", fontSize: "clamp(22px,2.8vw,44px)", margin: 0 }}>
                UMA JORNADA CONDUZIDA POR QUEM VIVE O QUE <span style={{ color: P.gold }}>ENSINA.</span>
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AGENDA EDITORIAL (JourneyMapSection)
════════════════════════════════════════════════════════════════ */
export function SecaoAgendaEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const lista: AgendaItem[] = dados?.itens ?? [];
  if (!lista.length) return null;
  const active = lista[activeIdx];
  return (
    <section
      style={{ backgroundColor: P.dark, color: P.stone, ...MANROPE, ...buildSectionStyle(estilo), paddingTop: "clamp(110px,11vw,180px)", paddingBottom: "clamp(120px,12vw,200px)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>

        {/* Section indicator */}
        <motion.div {...fadeUp(0)} className="flex items-center gap-3">
          <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>04</span>
          <span style={{ height: "1px", width: "32px", backgroundColor: `${P.stone}29`, display: "inline-block" }} />
          <span style={{ color: `${P.stone}99`, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            {dados.titulo_secao || "A PROGRAMAÇÃO"}
          </span>
        </motion.div>

        {/* Tab strip */}
        <motion.div {...fadeUp(0.1)} style={{ marginTop: "clamp(50px,5vw,80px)" }}>
          <div
            style={{ backgroundColor: "#151515", border: `1px solid ${P.stone}1A`, borderRadius: "4px", padding: "6px", overflowX: "auto" }}
            role="tablist"
          >
            <div className="flex items-center gap-1.5" style={{ minWidth: "320px" }}>
              {lista.map((item, i) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={i === activeIdx}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    flex: 1,
                    minHeight: "48px",
                    padding: "10px 16px",
                    borderRadius: "2px",
                    fontSize: "14px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    cursor: "pointer",
                    border: "none",
                    transition: "all 0.25s",
                    backgroundColor: i === activeIdx ? P.stone : "transparent",
                    color: i === activeIdx ? P.dark : `${P.stone}55`,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Content panel */}
        <motion.div {...fadeUp(0.15)} style={{ marginTop: "16px" }}>
          <div style={{ backgroundColor: "#151515", border: `1px solid ${P.stone}0D`, borderRadius: "4px", padding: "clamp(20px,4vw,60px)" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid lg:grid-cols-12 gap-8 lg:gap-14 items-center"
              >
                {/* Content */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      {String(activeIdx + 1).padStart(2, "0")} / {lista.length.toString().padStart(2, "0")}
                    </span>
                    <span style={{ height: "1px", width: "24px", backgroundColor: `${P.stone}29`, display: "inline-block" }} />
                    {active.hora_inicio && (
                      <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                        {active.hora_inicio}{active.hora_fim ? ` – ${active.hora_fim}` : ""}
                      </span>
                    )}
                  </div>

                  <h3 style={{ color: P.stone, fontWeight: 800, fontSize: "clamp(28px,4vw,64px)", letterSpacing: "-0.045em", lineHeight: 0.92, margin: 0, textTransform: "uppercase" }}>
                    {active.titulo}
                  </h3>

                  {active.descricao && (
                    <p style={{ color: `${P.stone}B0`, fontSize: "clamp(15px,1.3vw,19px)", lineHeight: 1.5, margin: 0 }}>
                      {active.descricao}
                    </p>
                  )}

                  {/* Topics as styled list if descricao has line breaks */}
                  <div style={{ borderTop: `1px solid ${P.stone}14`, paddingTop: "16px" }}>
                    <span style={{ color: `${P.stone}59`, fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                      NESTE MOMENTO
                    </span>
                    <div style={{ color: P.stone, fontSize: "clamp(11px,0.9vw,13px)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {active.titulo}
                    </div>
                  </div>
                </div>

                {/* Big number decoration */}
                <div className="lg:col-span-5 hidden lg:flex items-center justify-end">
                  <div style={{ fontSize: "clamp(80px,14vw,160px)", fontWeight: 900, color: `${P.stone}0D`, lineHeight: 1, letterSpacing: "-0.05em", userSelect: "none" }}>
                    {String(activeIdx + 1).padStart(2, "0")}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DEPOIMENTOS EDITORIAL (TestimonialsSection)
════════════════════════════════════════════════════════════════ */
export function SecaoDepoimentosEditorial({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const lista: Depoimento[] = dados?.depoimentos ?? [];
  if (!lista.length) return null;
  const current = lista[currentIdx];
  return (
    <section
      style={{ backgroundColor: P.stone, ...MANROPE, ...buildSectionStyle(estilo), paddingTop: "clamp(80px,9vw,150px)", paddingBottom: "clamp(90px,10vw,160px)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} className="flex flex-col items-start mb-[clamp(40px,5vw,70px)]">
          <Eyebrow text="PROVA SOCIAL" />
          <h2 style={{ color: P.dark, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.04em", lineHeight: 0.95, fontSize: "clamp(28px,4vw,48px)", margin: "8px 0 8px" }}>
            O que elas estão vivendo
          </h2>
          <p style={{ color: P.body, fontSize: "clamp(14px,1.2vw,17px)", margin: 0, maxWidth: "520px" }}>
            Depoimentos de quem decidiu viver essa transformação.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center relative">

          {/* Vertical text (desktop) */}
          <div className="hidden lg:flex lg:col-span-1 flex-col items-center justify-center h-full">
            <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: `${P.muted}70`, userSelect: "none", display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ width: "1px", height: "48px", backgroundColor: `${P.gold}40`, display: "inline-block" }} />
              DEPOIMENTOS
            </div>
          </div>

          {/* Photo */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                style={{ aspectRatio: "4/5", borderRadius: "20px", overflow: "hidden", backgroundColor: "#E2DDD3", border: `1px solid ${P.dark}0D`, boxShadow: "0 16px 40px rgba(11,11,11,0.08)", position: "relative" }}
                className="group"
              >
                {current.foto_url ? (
                  <img
                    src={current.foto_url}
                    alt={current.nome}
                    style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9) contrast(1.03)" }}
                    className="group-hover:scale-[1.03] transition-transform duration-700"
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: P.muted, fontSize: "11px", textTransform: "uppercase" }}>Foto</span>
                  </div>
                )}
                <div style={{ position: "absolute", bottom: "16px", left: "16px", backgroundColor: `${P.dark}CC`, backdropFilter: "blur(4px)", padding: "6px 12px", borderRadius: "2px", border: `1px solid rgba(255,255,255,0.1)` }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: P.stone }}>RELATO REAL</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Quote content */}
          <div className="lg:col-span-6 flex flex-col justify-between" style={{ minHeight: "320px" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <span style={{ fontSize: "64px", fontFamily: "Georgia, serif", color: P.gold, lineHeight: 1, display: "block", marginBottom: "-16px", userSelect: "none" }}>"</span>
                <blockquote style={{ color: P.dark, fontSize: "clamp(18px,2vw,26px)", lineHeight: 1.38, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
                  {current.texto.replace(/^["""''']|["""''']$/g, "")}
                </blockquote>
                <div style={{ borderTop: `1px solid ${P.dark}12`, paddingTop: "16px", maxWidth: "320px" }}>
                  <p style={{ color: P.dark, fontSize: "clamp(14px,1.1vw,17px)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.01em", margin: "0 0 2px" }}>{current.nome}</p>
                  <p style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>{current.cargo}</p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Thumbnails + nav */}
            {lista.length > 1 && (
              <div style={{ paddingTop: "32px", marginTop: "32px", borderTop: `1px solid ${P.dark}12`, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div className="flex items-center gap-3">
                  {lista.map((d, i) => (
                    <button
                      key={d.id}
                      onClick={() => setCurrentIdx(i)}
                      style={{
                        width: "48px", height: "56px", borderRadius: "6px", overflow: "hidden",
                        opacity: i === currentIdx ? 1 : 0.5,
                        outline: i === currentIdx ? `2px solid ${P.gold}` : "none",
                        outlineOffset: "2px",
                        transform: i === currentIdx ? "scale(1.05)" : "scale(1)",
                        transition: "all 0.2s",
                        cursor: "pointer",
                        backgroundColor: "#C8C4BC",
                        border: "none",
                        padding: 0,
                      }}
                      aria-label={`Ver depoimento de ${d.nome}`}
                    >
                      {d.foto_url && <img src={d.foto_url} alt={d.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentIdx((currentIdx - 1 + lista.length) % lista.length)}
                    style={{ width: "44px", height: "44px", borderRadius: "50%", border: `1px solid ${P.dark}33`, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: P.dark, transition: "all 0.2s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = P.dark; (e.currentTarget as HTMLButtonElement).style.color = P.stone; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = P.dark; }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentIdx((currentIdx + 1) % lista.length)}
                    style={{ width: "44px", height: "44px", borderRadius: "50%", border: `1px solid ${P.dark}33`, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: P.dark, transition: "all 0.2s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = P.dark; (e.currentTarget as HTMLButtonElement).style.color = P.stone; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = P.dark; }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GARANTIAS EDITORIAL (CommunityDecisionSection)
════════════════════════════════════════════════════════════════ */
export function SecaoGarantiasEditorial({ dados, estilo, onInscrever }: { dados: any; estilo?: SecaoEstilo; onInscrever?: () => void }) {
  const lista: Garantia[] = dados?.garantias ?? [];
  if (!lista.length) return null;
  return (
    <section
      style={{ backgroundColor: P.stone, ...MANROPE, ...buildSectionStyle(estilo), paddingTop: "clamp(80px,9vw,150px)", paddingBottom: "clamp(90px,10vw,160px)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>

        {/* Header */}
        <motion.div {...fadeUp(0)} className="text-center mb-[clamp(40px,6vw,72px)]" style={{ maxWidth: "820px", margin: "0 auto clamp(40px,6vw,72px)" }}>
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <span style={{ height: "1px", width: "24px", backgroundColor: `${P.gold}50`, display: "inline-block" }} />
            <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>INVESTIMENTO</span>
            <span style={{ height: "1px", width: "24px", backgroundColor: `${P.gold}50`, display: "inline-block" }} />
          </div>
          <h2 style={{ color: P.dark, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.04em", lineHeight: 0.95, fontSize: "clamp(28px,4vw,52px)", margin: 0 }}>
            {dados.titulo_secao || "Seu investimento para viver essa transformação"}
          </h2>
        </motion.div>

        {/* Card */}
        <motion.div
          {...fadeUp(0.15)}
          style={{ maxWidth: "1100px", margin: "0 auto", backgroundColor: "#FFFFFF", borderRadius: "24px", border: `1px solid ${P.dark}0D`, padding: "clamp(28px,5vw,60px)", boxShadow: "0 16px 40px rgba(11,11,11,0.04)", position: "relative" }}
        >
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">

            {/* Left: info + CTA */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div>
                <span style={{ display: "inline-block", backgroundColor: `${P.gold}1A`, color: P.gold, fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", padding: "4px 12px", borderRadius: "2px", marginBottom: "12px" }}>
                  INCLUÍDO NA JORNADA
                </span>
                <h3 style={{ color: P.dark, fontSize: "clamp(20px,2vw,26px)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0 }}>
                  {dados.titulo_secao || "A Jornada Completa"}
                </h3>
              </div>

              <div style={{ borderTop: `1px solid ${P.dark}0D`, borderBottom: `1px solid ${P.dark}0D`, padding: "clamp(16px,2vw,24px) 0" }}>
                <span style={{ color: P.muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                  {lista.length} BENEFÍCIOS INCLUSOS
                </span>
                <div style={{ color: P.dark, fontSize: "clamp(32px,4vw,52px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  {lista.length} itens
                </div>
              </div>

              {onInscrever && (
                <button
                  onClick={onInscrever}
                  style={{ backgroundColor: P.dark, color: P.stone, height: "60px", padding: "0 32px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", border: "none", borderRadius: "2px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", transition: "background-color 0.3s", width: "100%" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = P.gold)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = P.dark)}
                >
                  <span>{dados?.cta_texto || "QUERO FAZER PARTE"}</span>
                  <span>→</span>
                </button>
              )}
            </div>

            {/* Vertical divider */}
            <div className="hidden lg:block" style={{ position: "absolute", left: "50%", top: "48px", bottom: "48px", width: "1px", backgroundColor: `${P.dark}0D`, transform: "translateX(-50%)" }} />

            {/* Right: checklist */}
            <div className="lg:col-span-6 flex flex-col gap-5" style={{ borderTop: "1px solid", borderTopColor: `${P.dark}0D`, paddingTop: "24px" }} data-class="lg:border-t-0 lg:pt-0 lg:pl-6">
              <h4 style={{ color: P.dark, fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: P.gold, display: "inline-block" }} />
                O QUE ESTÁ INCLUSO
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                {lista.map((g) => (
                  <li key={g.id} className="flex items-start gap-3">
                    <div style={{ flexShrink: 0, width: "20px", height: "20px", borderRadius: "50%", backgroundColor: `${P.gold}26`, color: P.gold, display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px" }}>
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </div>
                    <span style={{ color: "#2B2B2B", fontSize: "clamp(13px,1vw,15px)", fontWeight: 500, lineHeight: 1.45 }}>{g.texto}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FAQ EDITORIAL (CommunityFinalSection)
════════════════════════════════════════════════════════════════ */
export function SecaoFaqEditorial({ dados, estilo, onInscrever }: { dados: any; estilo?: SecaoEstilo; onInscrever: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const lista: FaqItem[] = dados?.faqs ?? [];
  if (!lista.length) return null;
  return (
    <section
      style={{ backgroundColor: P.stone, ...MANROPE, ...buildSectionStyle(estilo), paddingTop: "clamp(80px,9vw,140px)", paddingBottom: "clamp(70px,8vw,120px)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "0 clamp(24px,4vw,72px)" }}>

        {/* Section indicator */}
        <motion.div {...fadeUp(0)} className="flex items-center gap-3">
          <span style={{ color: P.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>07</span>
          <span style={{ height: "1px", width: "32px", backgroundColor: `${P.dark}29`, display: "inline-block" }} />
          <span style={{ color: P.muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>DÚVIDAS & DECISÃO</span>
        </motion.div>

        {/* Headline */}
        <motion.div {...fadeUp(0.1)} style={{ marginTop: "clamp(40px,5vw,60px)" }}>
          <h2 style={{ color: P.dark, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.05em", lineHeight: 0.91, fontSize: "clamp(36px,8vw,80px)", margin: 0 }}>
            {dados.titulo_secao || "ANTES DE VOCÊ"} <span style={{ color: P.gold }}>DECIDIR.</span>
          </h2>
          <p style={{ color: "#66625C", fontSize: "clamp(15px,1.3vw,19px)", lineHeight: 1.5, marginTop: "12px", maxWidth: "480px" }}>
            "Talvez a resposta que falta para você tomar essa decisão esteja aqui."
          </p>
        </motion.div>

        {/* Full-width accordion */}
        <motion.div {...fadeUp(0.15)} style={{ marginTop: "clamp(50px,6vw,80px)", borderTop: `1px solid ${P.dark}29` }}>
          {lista.map((item, i) => (
            <div key={item.id} style={{ borderBottom: `1px solid ${P.dark}29` }}>
              <button
                onClick={() => setOpenId(openId === item.id ? null : item.id)}
                className="w-full text-left group"
                style={{ backgroundColor: "transparent", border: "none", cursor: "pointer", padding: "20px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}
              >
                <div className="flex items-start gap-6 lg:gap-8">
                  <span style={{ color: P.muted, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", paddingTop: "3px", minWidth: "24px" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ color: P.dark, fontWeight: 700, textTransform: "uppercase", fontSize: "clamp(14px,1.3vw,18px)", letterSpacing: "-0.03em", lineHeight: 1.25, transition: "color 0.2s" }} className="group-hover:text-[#B69A61]">
                    {item.pergunta}
                  </span>
                </div>
                <span style={{ color: P.dark, fontSize: "24px", fontWeight: 300, lineHeight: 1, flexShrink: 0, paddingLeft: "8px", transition: "color 0.2s" }} className="group-hover:text-[#B69A61]">
                  {openId === item.id ? "−" : "+"}
                </span>
              </button>
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: openId === item.id ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.3s ease",
                  overflow: "hidden",
                  opacity: openId === item.id ? 1 : 0,
                  paddingBottom: openId === item.id ? "20px" : 0,
                }}
              >
                <div style={{ overflow: "hidden", paddingLeft: "clamp(32px,4vw,56px)" }}>
                  <p style={{ color: P.body, fontSize: "clamp(13px,1vw,16px)", lineHeight: 1.55, margin: 0, maxWidth: "680px" }}>
                    {item.resposta}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA block */}
        <motion.div
          {...fadeUp(0.2)}
          style={{ marginTop: "clamp(80px,10vw,140px)", maxWidth: "1100px", margin: "clamp(80px,10vw,140px) auto 0", backgroundColor: "#EAE6DD", border: `1px solid ${P.dark}0F`, borderRadius: "24px", padding: "clamp(32px,6vw,80px)", textAlign: "center", boxShadow: "0 20px 50px rgba(11,11,11,0.04)" }}
        >
          <div style={{ width: "48px", height: "2px", backgroundColor: P.gold, margin: "0 auto 28px" }} />
          <h3 style={{ color: P.dark, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.04em", lineHeight: 0.98, fontSize: "clamp(26px,4vw,52px)", maxWidth: "800px", margin: "0 auto" }}>
            VOCÊ ESTÁ PRONTA PARA VIVER <span style={{ color: P.gold }}>UMA NOVA FASE?</span>
          </h3>
          <p style={{ color: P.body, fontSize: "clamp(15px,1.3vw,19px)", lineHeight: 1.5, marginTop: "20px", maxWidth: "600px", marginLeft: "auto", marginRight: "auto" }}>
            {dados.subtitulo || "Se existe dentro de você o desejo de crescer, fortalecer sua identidade e viver com mais propósito, esse é o seu próximo passo."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5" style={{ marginTop: "36px", maxWidth: "520px", margin: "36px auto 0" }}>
            <button
              onClick={onInscrever}
              style={{ backgroundColor: P.dark, color: P.stone, height: "62px", padding: "0 36px", fontSize: "13px", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", border: "none", borderRadius: "2px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", transition: "background-color 0.3s", width: "100%", maxWidth: "280px", boxShadow: "0 4px 16px rgba(11,11,11,0.12)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = P.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = P.dark)}
            >
              <span>{dados?.cta_texto || "QUERO PARTICIPAR"}</span>
              <span>→</span>
            </button>
          </div>
          <span style={{ color: P.muted, fontSize: "10px", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", display: "block", marginTop: "28px" }}>
            {dados?.eyebrow || "UMA JORNADA DE TRANSFORMAÇÃO"}
          </span>
        </motion.div>

      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SEÇÕES PADRÃO (não-editoriais)
════════════════════════════════════════════════════════════════ */
export function SecaoSobre({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  if (!dados?.texto) return null;
  return (
    <section className={`${sectionPadding(estilo)} px-6`} style={buildSectionStyle(estilo)}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Sobre o evento</h2>
        <div className={`gap-10 ${dados.imagem_url ? "grid md:grid-cols-2" : ""}`}>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{dados.texto}</p>
          {dados.imagem_url && <img src={dados.imagem_url} alt="" className="rounded-xl object-cover w-full aspect-video" />}
        </div>
      </div>
    </section>
  );
}

export function SecaoBeneficios({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Beneficio[] = dados?.beneficios ?? [];
  if (!lista.length) return null;
  const titulo = dados?.titulo_secao ?? "Por que participar?";
  return (
    <section className={`${sectionPadding(estilo)} px-6`} style={buildSectionStyle(estilo)}>
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

export function SecaoGarantias({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Garantia[] = dados?.garantias ?? [];
  if (!lista.length) return null;
  return (
    <section className={`${sectionPadding(estilo, "py-10")} px-6 bg-muted/20`} style={buildSectionStyle(estilo)}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-center gap-4">
          {lista.map((g) => (
            <div key={g.id} className="flex items-center gap-3 bg-background rounded-xl border px-5 py-3 shadow-sm">
              <span className="text-2xl">{g.icone}</span>
              <span className="text-sm font-medium">{g.texto}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoPalestrantes({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Palestrante[] = dados?.palestrantes ?? [];
  if (!lista.length) return null;
  return (
    <section className={`${sectionPadding(estilo)} px-6 bg-muted/30`} style={buildSectionStyle(estilo)}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">Palestrantes</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {lista.map((p) => (
            <div key={p.id} className="text-center space-y-3">
              {p.foto_url ? (
                <img src={p.foto_url} alt={p.nome} className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-border" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted mx-auto flex items-center justify-center text-2xl font-bold text-muted-foreground">{p.nome.charAt(0)}</div>
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

export function SecaoAgenda({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: AgendaItem[] = dados?.itens ?? [];
  if (!lista.length) return null;
  return (
    <section className={`${sectionPadding(estilo)} px-6`} style={buildSectionStyle(estilo)}>
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
                <span className="text-xs font-mono text-muted-foreground">{item.hora_inicio}{item.hora_fim ? ` → ${item.hora_fim}` : ""}</span>
                <p className="font-semibold mt-0.5">{item.titulo}</p>
                {item.descricao && <p className="text-sm text-muted-foreground mt-1">{item.descricao}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecaoDepoimentos({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: Depoimento[] = dados?.depoimentos ?? [];
  if (!lista.length) return null;
  return (
    <section className={`${sectionPadding(estilo)} px-6 bg-muted/30`} style={buildSectionStyle(estilo)}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8">O que dizem sobre nossos eventos</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {lista.map((dep) => (
            <div key={dep.id} className="bg-background rounded-xl border p-6 space-y-4">
              <p className="text-muted-foreground italic leading-relaxed">"{dep.texto}"</p>
              <div className="flex items-center gap-3">
                {dep.foto_url ? (
                  <img src={dep.foto_url} alt={dep.nome} className="w-10 h-10 rounded-full object-cover border" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">{dep.nome.charAt(0)}</div>
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

export function SecaoLocal({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  if (!dados?.endereco && !dados?.link_mapa) return null;
  return (
    <section className={`${sectionPadding(estilo)} px-6`} style={buildSectionStyle(estilo)}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Local</h2>
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            {dados.endereco && <p className="font-medium">{dados.endereco}</p>}
            {dados.link_mapa && (
              <a href={dados.link_mapa} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-600 hover:underline mt-1 inline-block">
                Ver no Google Maps →
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SecaoFaq({ dados, estilo }: { dados: any; estilo?: SecaoEstilo }) {
  const lista: FaqItem[] = dados?.faqs ?? [];
  const [aberto, setAberto] = useState<string | null>(null);
  if (!lista.length) return null;
  return (
    <section className={`${sectionPadding(estilo)} px-6 bg-muted/30`} style={buildSectionStyle(estilo)}>
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
                {aberto === faq.id ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {aberto === faq.id && (
                <div className="px-5 pb-4 text-muted-foreground text-sm leading-relaxed">{faq.resposta}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CTA
════════════════════════════════════════════════════════════════ */
export function SecaoCTA({ evento, onInscrever }: { evento: any; onInscrever: () => void }) {
  return (
    <section className="py-16 px-6 bg-amber-500 dark:bg-amber-600">
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h2 className="text-2xl font-bold text-black">Garanta sua vaga agora</h2>
        {evento.valor > 0 && <p className="text-3xl font-bold text-black">{formatValor(evento.valor)}</p>}
        {evento.limite_participantes && (
          <p className="text-sm text-black/70 flex items-center justify-center gap-1.5"><Users className="h-4 w-4" /> Vagas limitadas</p>
        )}
        <Button size="lg" className="bg-black hover:bg-black/80 text-white font-semibold text-base px-10" onClick={onInscrever}>
          Quero me inscrever
        </Button>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RENDER HELPER
════════════════════════════════════════════════════════════════ */
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
      if (dados?.variante === "editorial") return <SecaoGarantiasEditorial dados={dados} estilo={estilo} onInscrever={onInscrever} />;
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
    case "local":
      return <SecaoLocal dados={dados} estilo={estilo} />;
    case "faq":
      if (dados?.variante === "editorial") return <SecaoFaqEditorial dados={dados} estilo={estilo} onInscrever={onInscrever} />;
      return <SecaoFaq dados={dados} estilo={estilo} />;
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PÚBLICA FINAL
════════════════════════════════════════════════════════════════ */
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
        <SecaoHero evento={evento} dados={{ cta_texto: "Quero me inscrever" }} onInscrever={handleInscrever} />
      )}
      {ativas.map((secao) => (
        <div key={secao.id}>{renderSecao(secao, evento, handleInscrever)}</div>
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
