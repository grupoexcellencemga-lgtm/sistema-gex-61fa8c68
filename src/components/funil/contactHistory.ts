type ClosedProtocol = { id: string; lead_id: string; finalizado_em: string | null; iniciado_em: string };

export function groupClosedProtocols<T extends ClosedProtocol>(protocols: T[]) {
  const groups = new Map<string, T[]>();
  const sorted = [...protocols].sort((a, b) => (b.finalizado_em || b.iniciado_em).localeCompare(a.finalizado_em || a.iniciado_em) || b.id.localeCompare(a.id));
  for (const protocol of sorted) {
    const history = groups.get(protocol.lead_id);
    if (history) history.push(protocol);
    else groups.set(protocol.lead_id, [protocol]);
  }
  return [...groups.values()].map(history => ({ latest: history[0], history }));
}

export async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await query(from, from + 499);
    if (error) throw new Error(error.message);
    result.push(...(data || []));
    if (!data || data.length < 500) return result;
  }
}
