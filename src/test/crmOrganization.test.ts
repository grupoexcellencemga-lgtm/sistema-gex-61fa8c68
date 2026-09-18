import { describe, expect, it } from "vitest";
import { matchesCrmQueue, crmResponsibility } from "@/components/funil/crmOrganization";

describe("organização do CRM", () => {
  it("separa permissão da IA da fila humana", () => {
    const lead = { status_atendimento: "fila", bot_ativo: true };
    expect(matchesCrmQueue(lead, "ia")).toBe(true);
    expect(matchesCrmQueue(lead, "fila")).toBe(false);
    expect(crmResponsibility(lead)).toBe("IA autorizada");
  });
  it("mostra conversas próprias e prioriza novas mensagens humanas", () => {
    const lead = { status_atendimento: "ativo", atendente_id: "ana", ultima_mensagem_direcao: "entrada" };
    expect(matchesCrmQueue(lead, "minhas", "ana")).toBe(true);
    expect(matchesCrmQueue(lead, "minhas", "outra")).toBe(false);
    expect(matchesCrmQueue(lead, "fila", "ana")).toBe(true);
    expect(crmResponsibility(lead, { ana: "Ana" })).toBe("Com Ana");
  });
  it("não perde atendimento em outro estado nem inclui finalizados", () => {
    expect(matchesCrmQueue({ status_atendimento: "em_atendimento" }, "todos")).toBe(true);
    expect(matchesCrmQueue({ status_atendimento: "finalizado", bot_ativo: true }, "ia")).toBe(false);
  });
});
