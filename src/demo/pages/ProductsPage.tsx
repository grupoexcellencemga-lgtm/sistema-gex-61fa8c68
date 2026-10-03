import { Plus, Package, MoreHorizontal, ShoppingBag, TrendingUp } from "lucide-react";
import { demoProducts } from "@/demo/data";
import { PageIntro, Panel, PrimaryButton, StatusBadge } from "@/demo/components/DemoUI";

export default function ProductsPage() {
  return (
    <>
      <PageIntro title="Produtos" description="Seu catálogo comercial com preço, volume e receita em uma leitura rápida."
        actions={<PrimaryButton><Plus className="h-3.5 w-3.5" />Novo produto</PrimaryButton>} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[{ label: "Produtos ativos", value: "12", icon: Package }, { label: "Vendas no mês", value: "59", icon: ShoppingBag }, { label: "Receita atribuída", value: "R$ 167,9 mil", icon: TrendingUp }, { label: "Ticket médio", value: "R$ 2.846", icon: TrendingUp }].map((item) => <Panel key={item.label} className="p-5"><item.icon className="h-4 w-4 text-black/35" /><p className="text-2xl font-semibold tracking-[-0.04em] mt-4">{item.value}</p><p className="text-[10px] text-black/35 mt-1">{item.label}</p></Panel>)}
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {demoProducts.map((product) => (
          <Panel key={product.name} className="p-5 hover:-translate-y-0.5 transition-transform">
            <div className="flex items-start justify-between"><div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--demo-primary-soft)", color: "var(--demo-primary)" }}><Package className="h-4 w-4" /></div><MoreHorizontal className="h-4 w-4 text-black/25" /></div>
            <div className="mt-5"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{product.name}</h3><StatusBadge tone="success">Ativo</StatusBadge></div><p className="text-[10px] text-black/35 mt-1">{product.type}</p></div>
            <div className="mt-5 pt-4 border-t border-black/[0.05]"><p className="text-[10px] text-black/35">Valor</p><p className="text-xl font-semibold tracking-[-0.03em] mt-1">{product.price}</p></div>
            <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-black/[0.025] p-3"><p className="text-sm font-semibold">{product.sales}</p><p className="text-[9px] text-black/35 mt-1">vendas</p></div><div className="rounded-xl bg-black/[0.025] p-3"><p className="text-sm font-semibold">{product.revenue}</p><p className="text-[9px] text-black/35 mt-1">receita</p></div></div>
          </Panel>
        ))}
      </div>
    </>
  );
}
