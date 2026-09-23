export function buildEnumRoutes(
  values: string[],
): Array<{ id: string; label: string; palavras: string }> {
  return values.map((value) => ({
    id: `status_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
    label: value,
    palavras: value,
  }));
}

type FlowOutputField = {
  name: string;
  type?: string;
  options?: string[];
};

type FlowConditionOption = {
  id: string;
  label?: string;
  palavras?: string;
};

type FlowGraphNode = {
  id: string;
  type?: string;
  data?: {
    sourceType?: string;
    sourceNodeId?: string;
    sourceField?: string;
    opcoes?: FlowConditionOption[];
    structuredOutput?: { fields?: FlowOutputField[] };
  };
};

type FlowGraphEdge = {
  source: string;
  target: string;
  sourceHandle?: string | null;
};

export function validateFlowGraph(
  nodes: FlowGraphNode[],
  edges: FlowGraphEdge[],
): string[] {
  const errors: string[] = [];

  for (const node of nodes) {
    if (node.type !== "condition" || node.data?.sourceType !== "node_output") continue;
    const options = Array.isArray(node.data.opcoes) ? node.data.opcoes : [];
    if (options.length === 0) {
      errors.push(`A condição ${node.id} não possui rotas configuradas.`);
      continue;
    }

    const sourceNode = nodes.find((candidate) => candidate.id === node.data.sourceNodeId);
    const sourceFields = sourceNode?.data?.structuredOutput?.fields ?? [];
    const sourceField = sourceFields.find((field) => field.name === node.data.sourceField);
    if (!sourceNode || !sourceField) {
      errors.push(`A condição ${node.id} referencia uma saída de IA inexistente.`);
    } else if (sourceField.type === "enum" && Array.isArray(sourceField.options)) {
      const configuredValues = new Set(
        options.flatMap((option) =>
          String(option.palavras ?? "").split(",").map((value) => value.trim()).filter(Boolean)
        ),
      );
      for (const value of sourceField.options) {
        if (!configuredValues.has(value)) {
          errors.push(`A condição ${node.id} não possui rota para o valor "${value}".`);
        }
      }
    }

    for (const option of options) {
      const connected = edges.some((edge) =>
        edge.source === node.id &&
        edge.sourceHandle === option.id &&
        Boolean(edge.target)
      );
      if (!connected) {
        errors.push(`A rota "${option.label}" da condição ${node.id} não está conectada.`);
      }
    }
  }

  return errors;
}
