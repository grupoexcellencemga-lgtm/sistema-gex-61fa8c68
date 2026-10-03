import { useRef } from "react";
import { Building2, Upload, RotateCcw, Palette, ShieldCheck, Globe2, Mail, Smartphone } from "lucide-react";
import { useDemoBrand } from "@/demo/DemoBrandContext";
import { PageIntro, Panel, PanelHeader, SecondaryButton } from "@/demo/components/DemoUI";

export default function SettingsPage() {
  const { brand, updateBrand, resetBrand } = useDemoBrand();
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = (file?: File) => {
    if (!file || !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => updateBrand({ logoDataUrl: String(reader.result ?? "") });
    reader.readAsDataURL(file);
  };

  return (
    <>
      <PageIntro title="Configurações" description="A Demo já está preparada para mostrar a identidade de cada empresa."
        actions={<SecondaryButton onClick={resetBrand}><RotateCcw className="h-3.5 w-3.5" />Restaurar identidade</SecondaryButton>} />
      <div className="grid xl:grid-cols-[1fr_420px] gap-5 items-start">
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Identidade da empresa" eyebrow="White label" />
            <div className="p-5 md:p-6 space-y-6">
              <div><label className="text-[10px] font-semibold text-black/45">Nome da empresa</label><input value={brand.name} onChange={(e) => updateBrand({ name: e.target.value })} className="mt-2 h-10 w-full rounded-xl border border-black/[0.08] px-3 text-xs outline-none focus:border-[var(--demo-primary)]" /></div>
              <div>
                <label className="text-[10px] font-semibold text-black/45">Logo</label>
                <div className="mt-2 flex items-center gap-4"><div className="h-16 w-16 rounded-2xl bg-black/[0.025] border border-black/[0.06] flex items-center justify-center overflow-hidden">{brand.logoDataUrl ? <img src={brand.logoDataUrl} alt="Logo" className="h-full w-full object-contain p-1.5" /> : <Building2 className="h-6 w-6 text-black/20" />}</div><div><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} /><button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-black/[0.08] text-[10px] font-semibold flex items-center gap-2"><Upload className="h-3.5 w-3.5" />Escolher imagem</button><p className="text-[9px] text-black/30 mt-1.5">PNG, JPG, SVG ou WebP · até 2 MB</p></div></div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="text-[10px] font-semibold text-black/45">Cor principal</label><div className="mt-2 flex gap-2"><input type="color" value={brand.primary} onChange={(e) => updateBrand({ primary: e.target.value })} className="h-10 w-12 rounded-lg border border-black/[0.08] bg-white p-1" /><input value={brand.primary} onChange={(e) => updateBrand({ primary: e.target.value })} className="h-10 flex-1 rounded-xl border border-black/[0.08] px-3 text-xs font-mono outline-none" /></div></div>
                <div><label className="text-[10px] font-semibold text-black/45">Cor secundária</label><div className="mt-2 flex gap-2"><input type="color" value={brand.secondary} onChange={(e) => updateBrand({ secondary: e.target.value })} className="h-10 w-12 rounded-lg border border-black/[0.08] bg-white p-1" /><input value={brand.secondary} onChange={(e) => updateBrand({ secondary: e.target.value })} className="h-10 flex-1 rounded-xl border border-black/[0.08] px-3 text-xs font-mono outline-none" /></div></div>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-black/[0.06] p-4 cursor-pointer"><div><p className="text-xs font-semibold">Exibir “Powered by GEx”</p><p className="text-[9px] text-black/35 mt-1">Pode ser removido em uma oferta white label completa.</p></div><input type="checkbox" checked={brand.poweredByGex} onChange={(e) => updateBrand({ poweredByGex: e.target.checked })} className="h-4 w-4 accent-[var(--demo-primary)]" /></label>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Recursos de marca" eyebrow="Preparado para evoluir" />
            <div className="p-5 grid sm:grid-cols-2 gap-3">
              {[{ icon: Globe2, title: "Domínio próprio", text: "Ex.: app.suaempresa.com.br", status: "Roadmap" }, { icon: Mail, title: "E-mails personalizados", text: "Remetente e templates por empresa", status: "Roadmap" }, { icon: Smartphone, title: "Páginas públicas", text: "Inscrições e formulários com a marca", status: "Base pronta" }, { icon: ShieldCheck, title: "Isolamento por empresa", text: "Dados e permissões separados", status: "Auditar RLS" }].map((item) => <div key={item.title} className="rounded-xl border border-black/[0.055] p-4"><item.icon className="h-4 w-4 text-black/40" /><p className="text-xs font-semibold mt-3">{item.title}</p><p className="text-[9px] text-black/35 mt-1">{item.text}</p><span className="inline-flex mt-3 text-[9px] font-semibold px-2 py-1 rounded-full bg-black/[0.04] text-black/45">{item.status}</span></div>)}
            </div>
          </Panel>
        </div>

        <Panel className="xl:sticky xl:top-[92px] overflow-hidden">
          <PanelHeader title="Pré-visualização" eyebrow="Atualiza em tempo real" action={<Palette className="h-4 w-4 text-black/30" />} />
          <div className="p-5 bg-[#f4f5f7]">
            <div className="rounded-2xl overflow-hidden bg-white border border-black/[0.06] shadow-sm">
              <div className="h-14 px-4 bg-[#151619] text-white flex items-center gap-3"><div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">{brand.logoDataUrl ? <img src={brand.logoDataUrl} alt="" className="h-full w-full object-contain p-1" /> : <Building2 className="h-4 w-4" style={{ color: "var(--demo-primary)" }} />}</div><div><p className="text-[10px] font-semibold">{brand.name || "Sua empresa"}</p><p className="text-[8px] text-white/35">Sistema de gestão</p></div></div>
              <div className="p-4"><div className="flex gap-2 mb-4"><span className="h-7 px-2.5 rounded-lg text-[8px] text-white font-semibold flex items-center" style={{ background: "var(--demo-primary)" }}>Novo cliente</span><span className="h-7 px-2.5 rounded-lg text-[8px] bg-black/[0.04] text-black/45 flex items-center">Financeiro</span></div><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-black/[0.05] p-3"><p className="text-[7px] text-black/30">Receita</p><p className="text-sm font-semibold mt-1">R$ 128 mil</p><div className="mt-3 h-1.5 rounded-full" style={{ background: "var(--demo-primary-soft)" }}><div className="h-full w-4/5 rounded-full" style={{ background: "var(--demo-primary)" }} /></div></div><div className="rounded-xl border border-black/[0.05] p-3"><p className="text-[7px] text-black/30">Clientes</p><p className="text-sm font-semibold mt-1">268</p><div className="mt-3 flex gap-1">{[1,2,3,4].map((i) => <span key={i} className="h-5 w-5 rounded-full" style={{ background: i === 4 ? "var(--demo-primary)" : "var(--demo-primary-soft)" }} />)}</div></div></div></div>
              {brand.poweredByGex && <div className="px-4 py-2.5 border-t border-black/[0.05] text-[7px] text-black/25 text-center">Powered by GEx</div>}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
