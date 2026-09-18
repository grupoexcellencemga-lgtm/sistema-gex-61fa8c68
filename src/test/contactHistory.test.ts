import { describe, expect, it } from "vitest";
import { groupClosedProtocols, readAll } from "@/components/funil/contactHistory";
const protocol = (id: string, lead_id: string, date: string) => ({ id, lead_id, finalizado_em: date, iniciado_em: date });
describe("protocolos finalizados por pessoa", () => {
  it("exibe uma pessoa uma vez com o último protocolo primeiro e os antigos preservados", () => {
    const groups = groupClosedProtocols([protocol("1", "a", "2026-09-01"), protocol("2", "b", "2026-09-02"), protocol("3", "a", "2026-09-03")]);
    expect(groups.map(g => g.latest.id)).toEqual(["3", "2"]);
    expect(groups[0].history.map(p => p.id)).toEqual(["3", "1"]);
  });
  it("move a pessoa ao topo quando outro protocolo é encerrado", () => {
    const groups = groupClosedProtocols([protocol("1", "a", "2026-09-01"), protocol("2", "b", "2026-09-02"), protocol("3", "a", "2026-09-04")]);
    expect(groups[0].latest.lead_id).toBe("a");
    expect(groups[0].history).toHaveLength(2);
  });
  it("não mistura leads distintos nem altera a lista original", () => {
    const items = [protocol("1", "a", "2026-09-01"), protocol("2", "b", "2026-09-02")];
    expect(groupClosedProtocols(items)).toHaveLength(2);
    expect(items[0].id).toBe("1");
  });
  it("carrega todas as páginas", async () => {
    const records = Array.from({ length: 503 }, (_, id) => ({ id }));
    expect(await readAll((from, to) => Promise.resolve({ data: records.slice(from, to + 1), error: null }))).toEqual(records);
  });
  it("propaga falhas de acesso", async () => {
    await expect(readAll(() => Promise.resolve({ data: null, error: { message: "Sem acesso" } }))).rejects.toThrow("Sem acesso");
  });
});
