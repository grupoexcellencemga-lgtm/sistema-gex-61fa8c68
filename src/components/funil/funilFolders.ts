export type StatusCiclo = "preparacao" | "recebendo_leads" | "encerrando" | "encerrado";

export type FunilPasta = {
  id: string;
  nome: string;
  ordem: number;
};

export type FunilQuadroOrganizado = {
  id: string;
  nome: string;
  ordem: number;
  pasta_id: string | null;
  ordem_na_pasta: number;
  favorito: boolean;
  status_ciclo: StatusCiclo;
  recebe_novos_leads: boolean;
  fixo?: boolean;
  canal?: string | null;
  created_at?: string | null;
};

export type FunnelNavigationGroup = {
  id: string;
  name: string;
  order: number;
  funnels: FunilQuadroOrganizado[];
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

const sortFunnels = (a: FunilQuadroOrganizado, b: FunilQuadroOrganizado) =>
  a.ordem_na_pasta - b.ordem_na_pasta || a.nome.localeCompare(b.nome, "pt-BR");

export function buildFunnelNavigation(
  folders: FunilPasta[],
  funnels: FunilQuadroOrganizado[],
  search: string,
) {
  const commercial = funnels.filter((f) => !f.fixo && !f.canal);
  const query = normalize(search);
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const matches = commercial.filter((funnel) => {
    if (!query) return true;
    const folderName = funnel.pasta_id ? folderById.get(funnel.pasta_id)?.nome ?? "" : "Sem pasta";
    return normalize(funnel.nome).includes(query) || normalize(folderName).includes(query);
  });

  const groups: FunnelNavigationGroup[] = folders
    .slice()
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((folder) => ({
      id: folder.id,
      name: folder.nome,
      order: folder.ordem,
      funnels: matches.filter((f) => f.pasta_id === folder.id).sort(sortFunnels),
    }))
    .filter((group) => group.funnels.length > 0 || !query);

  const ungrouped = matches.filter((f) => !f.pasta_id).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  if (ungrouped.length > 0) groups.push({ id: "unfiled", name: "Sem pasta", order: Number.MAX_SAFE_INTEGER, funnels: ungrouped });

  return {
    favorites: matches.filter((f) => f.favorito).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    groups,
  };
}

export function pickAvailableBoard(selectedId: string | null, funnels: FunilQuadroOrganizado[]) {
  const available = funnels.filter((f) => !f.fixo && !f.canal && f.status_ciclo !== "encerrado");
  if (selectedId && available.some((f) => f.id === selectedId)) return selectedId;
  return available.find((f) => f.recebe_novos_leads)?.id ?? available[0]?.id ?? null;
}
