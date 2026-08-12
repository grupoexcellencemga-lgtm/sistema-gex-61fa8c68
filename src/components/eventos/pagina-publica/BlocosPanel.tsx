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
  onSelect: (tipo: SecaoTipo) => void;
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
            <div key={tpl.nome} className="space-y-1">
              <button
                className="w-full rounded-lg border overflow-hidden hover:border-cyan-400 hover:shadow-md transition-all group"
                onClick={() => onSelect(tpl.tipo)}
                title={`Adicionar ${tpl.nome}`}
              >
                <div className="aspect-[16/9] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  {tpl.thumbnail}
                </div>
              </button>
              <p className="text-xs text-muted-foreground pl-0.5">{tpl.nome}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
