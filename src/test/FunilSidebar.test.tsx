import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FunilSidebar } from "@/components/funil/FunilSidebar";

const folders = [{ id: "opex", nome: "OPEX", ordem: 0 }];
const funnels = [
  { id: "t25", nome: "Turma 25", ordem: 0, pasta_id: "opex", ordem_na_pasta: 0, favorito: true, status_ciclo: "recebendo_leads" as const, recebe_novos_leads: true },
  { id: "old", nome: "Funil antigo", ordem: 1, pasta_id: null, ordem_na_pasta: 0, favorito: false, status_ciclo: "preparacao" as const, recebe_novos_leads: false },
];

describe("barra lateral dos funis", () => {
  it("mostra favoritos, pasta, estado da turma e Sem pasta", () => {
    render(<FunilSidebar folders={folders} funnels={funnels} selectedId="t25" onSelect={vi.fn()} onCreateFolder={vi.fn()} onCreateFunnel={vi.fn()} onToggleFavorite={vi.fn()} onActivate={vi.fn()} onMove={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Favoritos")).toBeInTheDocument();
    expect(screen.getAllByText("OPEX").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recebendo leads").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem pasta").length).toBeGreaterThan(0);
  });

  it("filtra pelo nome da pasta", () => {
    render(<FunilSidebar folders={folders} funnels={funnels} selectedId={null} onSelect={vi.fn()} onCreateFolder={vi.fn()} onCreateFunnel={vi.fn()} onToggleFavorite={vi.fn()} onActivate={vi.fn()} onMove={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Buscar produto ou turma..."), { target: { value: "opex" } });
    expect(screen.getAllByText("Turma 25").length).toBeGreaterThan(0);
    expect(screen.queryByText("Funil antigo")).not.toBeInTheDocument();
  });
});
