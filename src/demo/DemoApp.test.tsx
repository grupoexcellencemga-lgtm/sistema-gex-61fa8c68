import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DemoApp from "@/demo/DemoApp";
import { DEMO_BRAND_STORAGE_KEY } from "@/demo/theme";

function renderDemo(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DemoApp />
    </MemoryRouter>,
  );
}

describe("GEx Demo", () => {
  beforeEach(() => {
    localStorage.removeItem(DEMO_BRAND_STORAGE_KEY);
  });

  it("abre a central operacional sem autenticação", () => {
    renderDemo("/demo");
    expect(screen.getByText("Bom dia, Douglas")).toBeInTheDocument();
    expect(screen.getByText("Prioridades do dia")).toBeInTheDocument();
  });
  it("abre o CRM como central comercial e não só como kanban", () => {
    renderDemo("/demo/crm");
    expect(screen.getByText("Central comercial")).toBeInTheDocument();
    expect(screen.getByText("Caixa de entrada")).toBeInTheDocument();
    expect(screen.getByText("Oportunidades")).toBeInTheDocument();
    expect(screen.getByText("Agentes")).toBeInTheDocument();
  });

  it("abre a personalização white label", () => {
    renderDemo("/demo/configuracoes");
    expect(screen.getByText("Identidade da empresa")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Empresa Modelo")).toBeInTheDocument();
    expect(screen.getAllByText("Powered by GEx").length).toBeGreaterThanOrEqual(1);
  });
});
