import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaxaCalc } from "@/hooks/useEntradaTaxas";
import { formatCurrency } from "./financeiroUtils";

const PARCELAS_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  formaPagamento: string;
  onFormaPagamentoChange: (v: string) => void;
  parcelas: number;
  onParcelasChange: (v: number) => void;
  impostoPercentual: number;
  onImpostoChange: (v: number) => void;
  repassarTaxa: boolean;
  onRepassarTaxaChange: (v: boolean) => void;
  calc: TaxaCalc;
  /** For boleto: show 1º vencimento field */
  dataVencimento?: string;
  onDataVencimentoChange?: (v: string) => void;
  /** All taxas for displaying rate next to parcelas */
  taxas?: any[];
}

export const EntradaTaxaFields = ({
  formaPagamento, onFormaPagamentoChange,
  parcelas, onParcelasChange,
  impostoPercentual, onImpostoChange,
  repassarTaxa, onRepassarTaxaChange,
  calc,
  dataVencimento, onDataVencimentoChange,
  taxas = [],
}: Props) => {
  const isBoleto = formaPagamento === "boleto";

  // Build parcela options with rate hints
  const getParcelaLabel = (n: number) => {
    let tipo = "";
    let nome = "";
    if (formaPagamento === "cartao") {
      tipo = "maquininha";
      nome = n === 1 ? "Crédito 1x" : `Crédito ${n}x`;
    } else {
      tipo = "link";
      nome = `${n}x`;
    }
    const found = taxas.find((t: any) => t.tipo === tipo && t.nome === nome);
    const rate = found ? Number(found.percentual).toFixed(2).replace(".", ",") + "%" : "";
    return `${n}x${rate ? ` — ${rate}` : ""}`;
  };

  return (
    <div className="space-y-3">
      {/* Forma de pagamento */}
      <div className="space-y-1">
        <Label className="text-xs">Forma de pagamento</Label>
        <Select value={formaPagamento} onValueChange={(v) => { onFormaPagamentoChange(v); if (!["cartao_credito", "link", "boleto"].includes(v)) onParcelasChange(1); }}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="debito">Débito</SelectItem>
            <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
            <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
            <SelectItem value="link">Link de Pagamento</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Parcelas for cartao/link/boleto */}
      {calc.showParcelas && (
        <div className="space-y-1">
          <Label className="text-xs">Parcelas</Label>
          <Select value={String(parcelas)} onValueChange={(v) => onParcelasChange(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARCELAS_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>{getParcelaLabel(n)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Data 1º vencimento for boleto */}
      {isBoleto && onDataVencimentoChange && (
        <div className="space-y-1">
          <Label className="text-xs">Data do 1º vencimento</Label>
          <Input type="date" value={dataVencimento || ""} onChange={(e) => onDataVencimentoChange(e.target.value)} />
        </div>
      )}

      {/* Imposto */}
      <div className="space-y-1">
        <Label className="text-xs">Imposto (%)</Label>
        <Input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={impostoPercentual}
          onChange={(e) => onImpostoChange(parseFloat(e.target.value) || 0)}
          className="w-32"
        />
      </div>

      {/* Repassar taxa toggle */}
      {calc.showTaxa && calc.taxaPercentual > 0 && (
        <div className="flex items-center gap-2">
          <Switch checked={repassarTaxa} onCheckedChange={onRepassarTaxaChange} />
          <Label className="text-sm cursor-pointer font-medium">Repassar taxa ao cliente</Label>
        </div>
      )}

      {/* Summary card */}
      {calc.valorBruto > 0 && (
        <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor bruto</span>
            <span className="font-medium">{formatCurrency(calc.valorBruto)}</span>
          </div>
          {calc.showTaxa && calc.taxaPercentual > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa ({calc.taxaNome} — {calc.taxaPercentual.toFixed(2).replace(".", ",")}%)</span>
                <span className="font-medium text-destructive">- {formatCurrency(calc.valorTaxa)}</span>
              </div>
              {repassarTaxa && (
                <div className="flex justify-between text-primary">
                  <span className="text-xs">↳ Taxa repassada ao cliente</span>
                  <span className="text-xs font-medium">Cobrar {formatCurrency(calc.valorCobradoCliente)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Imposto ({calc.impostoPercentual.toFixed(1).replace(".", ",")}%)</span>
            <span className="font-medium text-destructive">- {formatCurrency(calc.valorImposto)}</span>
          </div>
          <div className="border-t pt-1 flex justify-between font-semibold">
            <span>Valor líquido</span>
            <span className="text-emerald-600">{formatCurrency(calc.valorLiquido)}</span>
          </div>
          {!repassarTaxa && calc.showTaxa && calc.taxaPercentual > 0 && (
            <p className="text-xs text-muted-foreground">Taxa absorvida pela empresa</p>
          )}
        </div>
      )}
    </div>
  );
};
