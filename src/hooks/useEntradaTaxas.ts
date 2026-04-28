import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaxaCalc {
  taxaNome: string;
  taxaPercentual: number;
  valorTaxa: number;
  impostoPercentual: number;
  valorImposto: number;
  valorBruto: number;
  valorLiquido: number;
  repassarTaxa: boolean;
  valorCobradoCliente: number;
  showTaxa: boolean;
  showParcelas: boolean;
}

export function useEntradaTaxas(
  formaPagamento: string,
  valorBruto: number,
  parcelas: number,
  impostoManual: number,
  repassarTaxa: boolean
): TaxaCalc {
  const { data: taxas = [] } = useQuery({
    queryKey: ["taxas_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taxas_sistema")
        .select("*")
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas_pagamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
  });

  return useMemo(() => {
    const formaAtual = formasPagamento.find(
      (f: any) => f.codigo === formaPagamento
    );

    const isCredito =
      ["credito", "cartao", "cartao_credito"].includes(formaPagamento) ||
      formaAtual?.tipo === "credito";

    const isDebito =
      formaPagamento === "debito" || formaAtual?.tipo === "debito";

    const isLink = formaPagamento === "link" || formaAtual?.tipo === "link";

    const isBoleto =
      formaPagamento === "boleto" || formaAtual?.tipo === "boleto";

    const showTaxa =
      !!formaAtual?.abre_taxa || isCredito || isDebito || isLink || isBoleto;

    const showParcelas =
      !!formaAtual?.abre_parcelas || isCredito || isLink || isBoleto;

    let taxaNome = "";
    let taxaPercentual = 0;

    if (showTaxa && taxas.length > 0) {
      if (isDebito) {
        const found = taxas.find(
          (t: any) => t.tipo === "maquininha" && t.nome === "Débito"
        );

        if (found) {
          taxaNome = "Débito";
          taxaPercentual = Number(found.percentual);
        }
      } else if (isCredito) {
        const nome = parcelas === 1 ? "Crédito 1x" : `Crédito ${parcelas}x`;

        const found = taxas.find(
          (t: any) => t.tipo === "maquininha" && t.nome === nome
        );

        if (found) {
          taxaNome = found.nome;
          taxaPercentual = Number(found.percentual);
        }
      } else if (isLink || isBoleto) {
        const nome = `${parcelas}x`;

        const found = taxas.find(
          (t: any) => t.tipo === "link" && t.nome === nome
        );

        if (found) {
          taxaNome = `${isBoleto ? "Boleto" : "Link"} ${found.nome}`;
          taxaPercentual = Number(found.percentual);
        }
      }
    }

    const valorTaxa =
      valorBruto > 0 ? Math.round(valorBruto * taxaPercentual) / 100 : 0;

    const impostoPercentual = impostoManual;

    const valorImposto =
      valorBruto > 0 ? Math.round(valorBruto * impostoPercentual) / 100 : 0;

    const valorCobradoCliente =
      repassarTaxa && showTaxa ? valorBruto + valorTaxa : valorBruto;

    const valorLiquido = repassarTaxa
      ? valorBruto - valorImposto
      : valorBruto - valorTaxa - valorImposto;

    return {
      taxaNome,
      taxaPercentual,
      valorTaxa,
      impostoPercentual,
      valorImposto,
      valorBruto,
      valorLiquido: Math.max(0, valorLiquido),
      repassarTaxa,
      valorCobradoCliente,
      showTaxa,
      showParcelas,
    };
  }, [
    formaPagamento,
    valorBruto,
    parcelas,
    impostoManual,
    repassarTaxa,
    taxas,
    formasPagamento,
  ]);
}

export function getDefaultImposto(taxas: any[]): number {
  const imp = taxas.find((t: any) => t.tipo === "imposto");
  return imp ? Number(imp.percentual) : 9.5;
}