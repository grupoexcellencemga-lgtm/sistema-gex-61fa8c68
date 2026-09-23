import { describe, expect, it } from "vitest";
import { buildFunnelNavigation, pickAvailableBoard, type FunilPasta, type FunilQuadroOrganizado } from "@/components/funil/funilFolders";

const pastas: FunilPasta[] = [
  { id: "opex", nome: "OPEX", ordem: 1 },
  { id: "ebooks", nome: "E-books", ordem: 2 },
];

const quadros: FunilQuadroOrganizado[] = [
  { id: "t24", nome: "Turma 24", ordem: 0, pasta_id: "opex", ordem_na_pasta: 2, favorito: false, status_ciclo: "encerrando", recebe_novos_leads: false },
  { id: "t25", nome: "Turma 25", ordem: 0, pasta_id: "opex", ordem_na_pasta: 1, favorito: true, status_ciclo: "recebendo_leads", recebe_novos_leads: true },
  { id: "ebook", nome: "Liderança", ordem: 0, pasta_id: "ebooks", ordem_na_pasta: 0, favorito: false, status_ciclo: "preparacao", recebe_novos_leads: false },
  { id: "legacy", nome: "Funil antigo", ordem: 3, pasta_id: null, ordem_na_pasta: 0, favorito: true, status_ciclo: "preparacao", recebe_novos_leads: false },
];

describe("organização de funis por produto e turma", () => {
  it("ordena pastas e funis, separa favoritos e preserva os antigos em Sem pasta", () => {
    const result = buildFunnelNavigation(pastas, quadros, "");

    expect(result.favorites.map((q) => q.id)).toEqual(["legacy", "t25"]);
    expect(result.groups.map((g) => g.name)).toEqual(["OPEX", "E-books", "Sem pasta"]);
    expect(result.groups[0].funnels.map((q) => q.id)).toEqual(["t25", "t24"]);
    expect(result.groups[2].funnels.map((q) => q.id)).toEqual(["legacy"]);
  });

  it("encontra uma turma pelo nome da pasta ou do próprio funil", () => {
    expect(buildFunnelNavigation(pastas, quadros, "opex").groups.flatMap((g) => g.funnels).map((q) => q.id)).toEqual(["t25", "t24"]);
    expect(buildFunnelNavigation(pastas, quadros, "liderança").groups.flatMap((g) => g.funnels).map((q) => q.id)).toEqual(["ebook"]);
  });

  it("mantém a seleção visível ou escolhe o primeiro funil disponível", () => {
    expect(pickAvailableBoard("t24", quadros)).toBe("t24");
    expect(pickAvailableBoard("apagado", quadros)).toBe("t25");
    expect(pickAvailableBoard(null, [])).toBeNull();
  });
});
