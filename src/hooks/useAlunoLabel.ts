import { useEmpresa } from "@/contexts/EmpresaContext";

export function useAlunoLabel() {
  const { empresa } = useEmpresa();
  const isConsorcio = empresa?.modulos?.includes("consorcios-pipeline") ?? false;
  return {
    singular: isConsorcio ? "Cliente" : "Aluno",
    plural: isConsorcio ? "Clientes" : "Alunos",
    lower: isConsorcio ? "cliente" : "aluno",
    lowerPlural: isConsorcio ? "clientes" : "alunos",
  };
}
