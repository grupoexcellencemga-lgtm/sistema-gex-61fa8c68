import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaxaCalc } from "@/hooks/useEntradaTaxas";
import { formatCurrency } from "./financeiroUtils";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";

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
  dataVencimento?: string;
  onDataVencimentoChange?: (v: string) => void;
  taxas?: any[];
}

export const EntradaTaxaFields = ({
  formaPagamento,
  onFormaPagamentoChange,
  parcelas,
  onParcelasChange,
  impostoPercentual,
  onImpostoChange,
  repassarTaxa,
  onRepassarTaxaChange,
  calc,
  dataVencimento,
  onDataVencimentoChange,
  taxas = [],
}: Props) => {
  const { data: formasPagamento = [], isLoading: formasLoading } =
    useFormasPagamento();

  const formaAtual = formasPagamento.find((f) => f.codigo === formaPagamento);

  const isBoleto =
    formaPagamento === "boleto" || formaAtual?.tipo === "boleto";

  const isCredito =
    ["credito", "cartao", "cartao_credito"].includes(formaPagamento) ||
    formaAtual?.tipo === "credito";

  const isLink = formaPagamento === "link" || formaAtual?.tipo === "link";

  const getParcelaLabel = (n: number) => {
    let tipoTaxa = "";
    let nomeTaxa = "";

    if (isCredito) {
      tipoTaxa = "maquininha";
      nomeTaxa = n === 1 ? "Crédito 1x" : `Crédito ${n}x`;
    } else if (isLink || isBoleto) {
      tipoTaxa = "link";
      nomeTaxa = `${n}x`;
    }

    const found = taxas.find(
      (t: any) => t.tipo === tipoTaxa && t.nome === nomeTaxa
    );

    const rate = found
      ? Number(found.percentual).toFixed(2).replace(".", ",") + "%"
      : "";

    return `${n}x${rate ? ` — ${rate}` : ""}`;
  };

  const handleFormaPagamentoChange = (v: string) => {
    const forma = formasPagamento.find((f) => f.codigo === v);

    onFormaPagamentoChange(v);

    if (!forma?.abre_parcelas) {
      onParcelasChange(1);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Forma de pagamento</Label>

        <Select value={formaPagamento} onValueChange={handleFormaPagamentoChange}>
          <SelectTrigger>
            <SelectValue
              placeholder={formasLoading ? "Carregando..." : "Selecione"}
            />
          </SelectTrigger>

          <SelectContent>
            {formasPagamento.map((forma) => (
              <SelectItem key={forma.id} value={forma.codigo}>
                {forma.nome}
              </SelectItem>
            ))}

            {formasPagamento.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Nenhuma forma cadastrada
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {calc.showParcelas && (
        <div className="space-y-1">
          <Label className="text-xs">Parcelas</Label>

          <Select
            value={String(parcelas)}
            onValueChange={(v) => onParcelasChange(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {PARCELAS_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {getParcelaLabel(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isBoleto && onDataVencimentoChange && (
        <div className="space-y-1">
          <Label className="text-xs">Data do 1º vencimento</Label>
          <Input
            type="date"
            value={dataVencimento || ""}
            onChange={(e) => onDataVencimentoChange(e.target.value)}
          />
        </div>
      )}

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

      {calc.showTaxa && calc.taxaPercentual > 0 && (
        <div className="flex items-center gap-2">
          <Switch checked={repassarTaxa} onCheckedChange={onRepassarTaxaChange} />
          <Label className="text-sm cursor-pointer font-medium">
            Repassar taxa ao cliente
          </Label>
        </div>
      )}

      {calc.valorBruto > 0 && (
        <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor bruto</span>
            <span className="font-medium">{formatCurrency(calc.valorBruto)}</span>
          </div>

          {calc.showTaxa && calc.taxaPercentual > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Taxa ({calc.taxaNome} —{" "}
                  {calc.taxaPercentual.toFixed(2).replace(".", ",")}%)
                </span>
                <span className="font-medium text-destructive">
                  - {formatCurrency(calc.valorTaxa)}
                </span>
              </div>

              {repassarTaxa && (
                <div className="flex justify-between text-primary">
                  <span className="text-xs">↳ Taxa repassada ao cliente</span>
                  <span className="text-xs font-medium">
                    Cobrar {formatCurrency(calc.valorCobradoCliente)}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Imposto ({calc.impostoPercentual.toFixed(1).replace(".", ",")}%)
            </span>
            <span className="font-medium text-destructive">
              - {formatCurrency(calc.valorImposto)}
            </span>
          </div>

          <div className="border-t pt-1 flex justify-between font-semibold">
            <span>Valor líquido</span>
            <span className="text-emerald-600">
              {formatCurrency(calc.valorLiquido)}
            </span>
          </div>

          {!repassarTaxa && calc.showTaxa && calc.taxaPercentual > 0 && (
            <p className="text-xs text-muted-foreground">
              Taxa absorvida pela empresa
            </p>
          )}
        </div>
      )}
    </div>
  );
};