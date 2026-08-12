import { useState } from "react";
import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SecaoTipo } from "./types";

/* ─── Thumbnail components ────────────────────────────────── */

function ThumbHero() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex flex-col items-end justify-end p-2 overflow-hidden rounded-sm">
      <div className="w-full">
        <div className="h-1.5 bg-white/70 rounded-full mb-1 w-3/4" />
        <div className="h-1 bg-white/40 rounded-full mb-2.5 w-1/2" />
        <div className="h-4 bg-amber-400 rounded-full w-1/3" />
      </div>
    </div>
  );
}

function ThumbSobre() {
  return (
    <div className="w-full h-full p-2.5 bg-white dark:bg-zinc-900">
      <div className="h-2 bg-zinc-700 dark:bg-zinc-300 rounded-full mb-2 w-2/5" />
      <div className="grid grid-cols-2 gap-2 h-[calc(100%-20px)]">
        <div className="space-y-1 pt-0.5">
          {[100, 90, 80, 70, 85].map((w, i) => (
            <div key={i} className={`h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full`} style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="bg-zinc-200 dark:bg-zinc-700 rounded-md" />
      </div>
    </div>
  );
}

function ThumbBeneficios() {
  return (
    <div className="w-full h-full p-2.5 bg-white dark:bg-zinc-900">
      <div className="h-1.5 bg-zinc-700 dark:bg-zinc-300 rounded-full mb-2.5 w-2/5 mx-auto" />
      <div className="grid grid-cols-3 gap-2">
        {["✅", "🎯", "🚀"].map((icon, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-base leading-none">{icon}</span>
            <div className="h-1 bg-zinc-400 rounded-full w-full" />
            <div className="h-0.5 bg-zinc-300 dark:bg-zinc-600 rounded-full w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbGarantias() {
  return (
    <div className="w-full h-full p-2.5 bg-zinc-50 dark:bg-zinc-800 flex flex-col justify-center">
      <div className="flex flex-col gap-1.5">
        {[["✅", "Online e ao vivo"], ["🔒", "Acesso garantido"], ["📜", "Certificado incluso"]].map(([icon, text], i) => (
          <div key={i} className="flex items-center gap-1.5 bg-white dark:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-600 px-1.5 py-0.5">
            <span className="text-xs leading-none">{icon}</span>
            <div className="h-1 bg-zinc-400 rounded-full flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbPalestrantes() {
  return (
    <div className="w-full h-full p-2.5 bg-zinc-50 dark:bg-zinc-800">
      <div className="h-1.5 bg-zinc-700 dark:bg-zinc-300 rounded-full mb-3 w-2/5" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            <div className="h-1 bg-zinc-500 dark:bg-zinc-400 rounded-full w-full" />
            <div className="h-0.5 bg-zinc-300 dark:bg-zinc-600 rounded-full w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbAgenda() {
  return (
    <div className="w-full h-full p-2.5 bg-white dark:bg-zinc-900">
      <div className="h-1.5 bg-zinc-700 dark:bg-zinc-300 rounded-full mb-3 w-2/5" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="space-y-0.5 flex-1">
              <div className="h-1 bg-zinc-500 dark:bg-zinc-400 rounded-full" />
              <div className="h-0.5 bg-zinc-300 dark:bg-zinc-600 rounded-full w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbDepoimentos() {
  return (
    <div className="w-full h-full p-2 bg-zinc-50 dark:bg-zinc-800">
      <div className="h-1.5 bg-zinc-700 dark:bg-zinc-300 rounded-full mb-2 w-2/5 mx-auto" />
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="border border-zinc-200 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 p-1.5 space-y-1">
            <div className="h-0.5 bg-zinc-300 dark:bg-zinc-500 rounded-full" />
            <div className="h-0.5 bg-zinc-300 dark:bg-zinc-500 rounded-full w-3/4" />
            <div className="h-0.5 bg-zinc-300 dark:bg-zinc-500 rounded-full w-1/2" />
            <div className="flex items-center gap-1 pt-0.5">
              <div className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-500 shrink-0" />
              <div className="h-0.5 bg-zinc-400 dark:bg-zinc-400 rounded-full flex-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbFaq() {
  return (
    <div className="w-full h-full p-2.5 bg-zinc-50 dark:bg-zinc-800">
      <div className="h-1.5 bg-zinc-700 dark:bg-zinc-300 rounded-full mb-2 w-2/5" />
      <div className="grid grid-cols-2 gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-600 rounded px-1.5 py-1 bg-white dark:bg-zinc-700">
            <div className="h-1 bg-zinc-400 dark:bg-zinc-400 rounded-full flex-1" />
            <div className="text-zinc-400 text-[8px] leading-none">›</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThumbHeroEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#F2EFE8" }}>
      <div style={{ height: "1px", backgroundColor: "rgba(11,11,11,0.15)" }} />
      <div className="flex gap-1.5 p-2" style={{ height: "calc(100% - 7px)" }}>
        {/* Left: text */}
        <div className="flex flex-col justify-center gap-1 flex-1">
          <div style={{ height: "1px", width: "18px", backgroundColor: "#B69A61" }} />
          <div style={{ height: "3px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "100%" }} />
          <div style={{ height: "3px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "85%" }} />
          <div style={{ height: "3px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "65%" }} />
          <div style={{ height: "0.5px", backgroundColor: "rgba(11,11,11,0.2)", margin: "2px 0" }} />
          <div style={{ height: "1.5px", backgroundColor: "#88847C", borderRadius: "1px", width: "100%", opacity: 0.5 }} />
          <div style={{ height: "1.5px", backgroundColor: "#88847C", borderRadius: "1px", width: "70%", opacity: 0.5 }} />
          <div style={{ height: "6px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "42%", marginTop: "3px" }} />
        </div>
        {/* Right: photo */}
        <div style={{ width: "38%", backgroundColor: "#C8C4BC", borderRadius: "2px", flexShrink: 0, aspectRatio: "4/5" }} />
      </div>
      <div style={{ borderTop: "0.5px solid rgba(11,11,11,0.15)", height: "6px", display: "flex", alignItems: "center", gap: "6px", padding: "0 8px" }}>
        <div style={{ height: "1.5px", width: "22px", backgroundColor: "#B69A61", borderRadius: "1px" }} />
        <div style={{ height: "1.5px", width: "16px", backgroundColor: "#88847C", borderRadius: "1px", opacity: 0.5 }} />
      </div>
    </div>
  );
}

function ThumbSobreEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#0B0B0B" }}>
      <div className="flex gap-1.5 p-2 h-full items-start">
        <div style={{ width: "28%", paddingTop: "3px" }}>
          <div style={{ height: "1px", backgroundColor: "rgba(242,239,232,0.2)", width: "100%" }} />
          <div style={{ height: "1.5px", backgroundColor: "rgba(242,239,232,0.35)", borderRadius: "1px", width: "80%", marginTop: "3px" }} />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <div style={{ height: "4px", backgroundColor: "#F2EFE8", borderRadius: "1px", width: "100%" }} />
          <div style={{ height: "4px", backgroundColor: "#F2EFE8", borderRadius: "1px", width: "90%" }} />
          <div style={{ height: "4px", backgroundColor: "#F2EFE8", borderRadius: "1px", width: "75%" }} />
          <div style={{ height: "4px", backgroundColor: "#B69A61", borderRadius: "1px", width: "60%", marginTop: "2px" }} />
          <div style={{ height: "4px", backgroundColor: "#F2EFE8", borderRadius: "1px", width: "85%", marginTop: "1px" }} />
        </div>
      </div>
    </div>
  );
}

function ThumbBeneficiosEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#F2EFE8" }}>
      <div className="flex gap-1.5 p-2 h-full">
        <div className="flex-1 flex flex-col gap-1.5">
          <div style={{ height: "1px", width: "18px", backgroundColor: "#B69A61" }} />
          {[0,1,2].map(i => (
            <div key={i} style={{ borderTop: "0.5px solid rgba(11,11,11,0.15)", paddingTop: "3px" }}>
              <div className="flex gap-1 items-center">
                <div style={{ width: "6px", height: "6px", backgroundColor: "#B69A61", borderRadius: "1px", flexShrink: 0 }} />
                <div style={{ height: "1.5px", backgroundColor: "#0B0B0B", borderRadius: "1px", flex: 1 }} />
              </div>
              <div style={{ height: "1px", backgroundColor: "#88847C", borderRadius: "1px", width: "90%", marginTop: "2px", opacity: 0.5 }} />
            </div>
          ))}
        </div>
        <div style={{ width: "36%", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: "85%", height: "65%", backgroundColor: "#E2DDD3", borderRadius: "2px" }} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: "70%", height: "50%", backgroundColor: "#C8C4BC", borderRadius: "2px" }} />
        </div>
      </div>
    </div>
  );
}

function ThumbPalestrantesEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#F2EFE8" }}>
      <div className="p-2 h-full flex flex-col gap-1">
        <div style={{ height: "1.5px", backgroundColor: "#B69A61", width: "16px" }} />
        <div style={{ height: "3px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "100%" }} />
        <div style={{ height: "3px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "75%" }} />
        <div className="flex gap-1.5 flex-1 mt-1">
          <div style={{ width: "42%", backgroundColor: "#C8C4BC", borderRadius: "2px" }} />
          <div className="flex-1 flex flex-col gap-1 pt-0.5">
            <div style={{ height: "1px", backgroundColor: "#B69A61", width: "24px" }} />
            {[100,90,80,70].map((w,i) => (
              <div key={i} style={{ height: "1px", backgroundColor: "#88847C", borderRadius: "1px", width: `${w}%`, opacity: 0.6 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbAgendaEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#0B0B0B" }}>
      <div className="p-2 h-full flex flex-col gap-1.5">
        <div style={{ height: "1px", width: "18px", backgroundColor: "#B69A61" }} />
        <div className="flex gap-1" style={{ borderBottom: "0.5px solid rgba(242,239,232,0.15)", paddingBottom: "3px" }}>
          {["01","02","03","04"].map((n,i) => (
            <div key={n} style={{ padding: "1px 3px", fontSize: "6px", fontWeight: 700, color: i===0 ? "#F2EFE8" : "rgba(242,239,232,0.3)", borderBottom: i===0 ? "1.5px solid #B69A61" : "1.5px solid transparent" }}>
              {n}
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 flex-1">
          <div className="flex-1 flex flex-col gap-1 pt-0.5">
            <div style={{ height: "1px", backgroundColor: "#B69A61", width: "60%" }} />
            <div style={{ height: "2.5px", backgroundColor: "#F2EFE8", borderRadius: "1px", width: "100%" }} />
            <div style={{ height: "2.5px", backgroundColor: "#F2EFE8", borderRadius: "1px", width: "80%" }} />
            <div style={{ height: "1px", backgroundColor: "rgba(242,239,232,0.4)", borderRadius: "1px", width: "90%", borderLeft: "1.5px solid #B69A61", paddingLeft: "2px", marginTop: "2px" }} />
          </div>
          <div style={{ width: "28%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 900, color: "rgba(242,239,232,0.06)", lineHeight: 1 }}>01</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbDepoimentosEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#F2EFE8" }}>
      <div className="flex gap-1.5 p-2 h-full">
        <div style={{ width: "42%", backgroundColor: "#C8C4BC", borderRadius: "8px" }} />
        <div className="flex-1 flex flex-col gap-1 justify-center">
          <div style={{ height: "1px", width: "18px", backgroundColor: "#B69A61" }} />
          <div style={{ fontSize: "10px", color: "#B69A61", lineHeight: 1, marginBottom: "-1px" }}>"</div>
          {[100,90,80,70,55].map((w,i) => (
            <div key={i} style={{ height: "1px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: `${w}%`, opacity: 0.7 }} />
          ))}
          <div style={{ borderTop: "0.5px solid rgba(11,11,11,0.2)", paddingTop: "2px", marginTop: "2px" }}>
            <div style={{ height: "1.5px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "55%" }} />
            <div style={{ height: "1px", backgroundColor: "#B69A61", borderRadius: "1px", width: "40%", marginTop: "1px" }} />
          </div>
          <div className="flex gap-1 mt-1">
            {[0,1,2].map(i => (
              <div key={i} style={{ width: "8px", height: "10px", borderRadius: "2px", backgroundColor: i===0 ? "#C8C4BC" : "#E2DDD3", outline: i===0 ? "1px solid #B69A61" : "none" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbGarantiasEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#F2EFE8" }}>
      <div className="p-2 h-full flex gap-1.5">
        <div className="flex-1 flex flex-col gap-1 justify-center">
          <div style={{ height: "1px", width: "18px", backgroundColor: "#B69A61" }} />
          <div style={{ height: "2.5px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "100%" }} />
          <div style={{ height: "2.5px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "80%" }} />
          <div style={{ height: "2.5px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "60%" }} />
        </div>
        <div style={{ width: "44%", display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ backgroundColor: "#0B0B0B", padding: "4px 5px", borderRadius: "2px 2px 0 0" }}>
            <div style={{ height: "2px", backgroundColor: "#B69A61", borderRadius: "1px", width: "70%" }} />
            <div style={{ height: "3px", backgroundColor: "#F2EFE8", borderRadius: "1px", width: "90%", marginTop: "2px" }} />
          </div>
          <div style={{ backgroundColor: "#E8E5DE", padding: "3px 5px", flex: 1, borderRadius: "0 0 2px 2px" }}>
            {[0,1,2,3].map(i => (
              <div key={i} className="flex gap-1 items-center" style={{ marginBottom: "2px" }}>
                <div style={{ width: "4px", height: "4px", backgroundColor: "#B69A61", borderRadius: "50%", flexShrink: 0 }} />
                <div style={{ height: "1px", backgroundColor: "#0B0B0B", borderRadius: "1px", flex: 1, opacity: 0.5 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbFaqEditorial() {
  return (
    <div className="w-full h-full overflow-hidden rounded-sm" style={{ backgroundColor: "#F2EFE8" }}>
      <div className="flex gap-1.5 p-2 h-full">
        <div style={{ width: "35%" }} className="flex flex-col gap-1 justify-center">
          <div style={{ height: "1px", width: "16px", backgroundColor: "#B69A61" }} />
          <div style={{ height: "2px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "100%" }} />
          <div style={{ height: "2px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "75%" }} />
          <div style={{ height: "5px", backgroundColor: "#0B0B0B", borderRadius: "1px", width: "55%", marginTop: "3px" }} />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ borderTop: "0.5px solid rgba(11,11,11,0.15)", paddingTop: "2px", display: "flex", gap: "3px", alignItems: "center" }}>
              <div style={{ width: "8px", height: "1px", backgroundColor: "#B69A61" }} />
              <div style={{ height: "1.5px", backgroundColor: "#0B0B0B", borderRadius: "1px", flex: 1, opacity: 0.6 }} />
              <div style={{ color: "#88847C", fontSize: "6px", lineHeight: 1 }}>+</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ThumbLocal() {
  return (
    <div className="w-full h-full p-2.5 bg-white dark:bg-zinc-900 flex flex-col justify-center">
      <div className="h-1.5 bg-zinc-700 dark:bg-zinc-300 rounded-full mb-3 w-1/3" />
      <div className="flex items-start gap-2">
        <div className="w-4 h-4 rounded-full bg-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1">
          <div className="h-1 bg-zinc-500 dark:bg-zinc-400 rounded-full" />
          <div className="h-1 bg-cyan-400 rounded-full w-3/4" />
        </div>
      </div>
    </div>
  );
}

/* ─── Template definitions ────────────────────────────────── */

interface BlocoTemplate {
  tipo: SecaoTipo;
  nome: string;
  categoria: string;
  thumbnail: React.ReactNode;
  initialDados?: Record<string, any>;
}

const CATEGORIAS = [
  { id: "Headers",     label: "Headers" },
  { id: "Sobre",       label: "Sobre" },
  { id: "Benefícios",  label: "Benefícios" },
  { id: "Equipes",     label: "Equipes" },
  { id: "Depoimentos", label: "Depoimentos" },
  { id: "Programação", label: "Programação" },
  { id: "Dúvidas",     label: "Dúvidas" },
  { id: "Garantias",   label: "Garantias" },
  { id: "Local",       label: "Local" },
];

const TEMPLATES: BlocoTemplate[] = [
  { tipo: "hero",         nome: "Header_01",      categoria: "Headers",     thumbnail: <ThumbHero /> },
  { tipo: "hero",         nome: "Header_02",      categoria: "Headers",     thumbnail: <ThumbHeroEditorial />, initialDados: { variante: "editorial", subtitulo: "", cta_texto: "Saiba mais", eyebrow: "EVENTO EXCLUSIVO" } },
  { tipo: "sobre",        nome: "Sobre_02",        categoria: "Sobre",       thumbnail: <ThumbSobreEditorial />, initialDados: { variante: "editorial", titulo_secao: "A EXPERIÊNCIA", texto: "NÃO É SOBRE\nPARTICIPAR\nDE ENCONTROS.\n\nÉ SOBRE A MULHER\nQUE VOCÊ VAI\nSE TORNAR.", imagem_url: "" } },
  { tipo: "beneficios",   nome: "Benefício_02",    categoria: "Benefícios",  thumbnail: <ThumbBeneficiosEditorial />, initialDados: { variante: "editorial", titulo_secao: "O QUE VOCÊ VAI VIVER", beneficios: [{ id: crypto.randomUUID(), icone: "📅", titulo: "6 meses de jornada", texto: "Uma experiência contínua e intencional para promover crescimento e transformação." }, { id: crypto.randomUUID(), icone: "👥", titulo: "3 encontros mensais", texto: "Encontros presenciais e online para fortalecer conexão e aprendizado." }, { id: crypto.randomUUID(), icone: "✨", titulo: "Consultoria exclusiva", texto: "Uma experiência para fortalecer sua imagem e a forma como você se posiciona." }] } },
  { tipo: "palestrantes", nome: "Equipe_02",       categoria: "Equipes",     thumbnail: <ThumbPalestrantesEditorial />, initialDados: { variante: "editorial", palestrantes: [] } },
  { tipo: "agenda",       nome: "Programação_02",  categoria: "Programação", thumbnail: <ThumbAgendaEditorial />, initialDados: { variante: "editorial", titulo_secao: "A JORNADA", itens: [] } },
  { tipo: "depoimentos",  nome: "Depoimento_02",   categoria: "Depoimentos", thumbnail: <ThumbDepoimentosEditorial />, initialDados: { variante: "editorial", depoimentos: [] } },
  { tipo: "garantias",    nome: "Garantias_02",    categoria: "Garantias",   thumbnail: <ThumbGarantiasEditorial />, initialDados: { variante: "editorial", titulo_secao: "Seu investimento para viver essa transformação", garantias: [{ id: crypto.randomUUID(), icone: "✅", texto: "6 meses de desenvolvimento e transformação" }, { id: crypto.randomUUID(), icone: "✅", texto: "3 encontros mensais" }, { id: crypto.randomUUID(), icone: "✅", texto: "2 encontros presenciais" }, { id: crypto.randomUUID(), icone: "✅", texto: "Consultoria Imagem de Excelência" }] } },
  { tipo: "faq",          nome: "Dúvidas_02",      categoria: "Dúvidas",     thumbnail: <ThumbFaqEditorial />, initialDados: { variante: "editorial", titulo_secao: "Perguntas & Respostas", cta_texto: "QUERO PARTICIPAR", faqs: [] } },
  { tipo: "sobre",        nome: "Sobre_01",        categoria: "Sobre",       thumbnail: <ThumbSobre /> },
  { tipo: "beneficios",   nome: "Benefício_01",    categoria: "Benefícios",  thumbnail: <ThumbBeneficios /> },
  { tipo: "garantias",    nome: "Garantias_01",    categoria: "Garantias",   thumbnail: <ThumbGarantias /> },
  { tipo: "palestrantes", nome: "Equipe_01",       categoria: "Equipes",     thumbnail: <ThumbPalestrantes /> },
  { tipo: "agenda",       nome: "Programação_01",  categoria: "Programação", thumbnail: <ThumbAgenda /> },
  { tipo: "depoimentos",  nome: "Depoimento_01",   categoria: "Depoimentos", thumbnail: <ThumbDepoimentos /> },
  { tipo: "faq",          nome: "Dúvidas_01",      categoria: "Dúvidas",     thumbnail: <ThumbFaq /> },
  { tipo: "local",        nome: "Local_01",         categoria: "Local",       thumbnail: <ThumbLocal /> },
];

/* ─── BlocosPanel ─────────────────────────────────────────── */

interface Props {
  onClose: () => void;
  onSelect: (tipo: SecaoTipo, initialDados?: Record<string, any>) => void;
}

export function BlocosPanel({ onClose, onSelect }: Props) {
  const [categoriaAtiva, setCategoriaAtiva] = useState("Headers");
  const [busca, setBusca] = useState("");

  const templatesFiltrados = busca
    ? TEMPLATES.filter(
        (t) =>
          t.nome.toLowerCase().includes(busca.toLowerCase()) ||
          t.categoria.toLowerCase().includes(busca.toLowerCase())
      )
    : TEMPLATES.filter((t) => t.categoria === categoriaAtiva);

  return (
    <div className="w-[400px] shrink-0 border-r flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <span className="font-semibold text-sm flex-1">Blocos</span>
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="h-7 pl-8 text-xs"
            placeholder={`Buscar em "${busca || categoriaAtiva}"...`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body: categories + thumbnails */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category list */}
        {!busca && (
          <div className="w-[140px] shrink-0 border-r overflow-y-auto py-3">
            <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Blocos Gerais
            </p>
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-none transition-colors ${
                  categoriaAtiva === cat.id
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                onClick={() => { setCategoriaAtiva(cat.id); setBusca(""); }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Thumbnail grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {templatesFiltrados.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum bloco encontrado.</p>
          )}
          {templatesFiltrados.map((tpl) => (
            <button
              key={tpl.nome}
              className="w-full text-left group/card"
              onClick={() => onSelect(tpl.tipo, tpl.initialDados)}
              title={`Adicionar ${tpl.nome}`}
            >
              <div className="rounded-lg border overflow-hidden group-hover/card:border-cyan-400 group-hover/card:shadow-md transition-all">
                <div className="aspect-[16/9] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  {tpl.thumbnail}
                </div>
              </div>
              <p className="text-xs text-muted-foreground pl-0.5 mt-1 group-hover/card:text-foreground transition-colors">{tpl.nome}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
