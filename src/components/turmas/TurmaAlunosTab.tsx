import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, X, MessageCircle, Users } from "lucide-react";

// Remove acentos para busca tolerante ("joao" acha "João").
const normalizar = (v?: string | null) =>
  (v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const whatsappLink = (phone?: string | null) => {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  if (!clean) return null;
  return `https://wa.me/55${clean}`;
};

export function TurmaAlunosTab({ turma }: { turma: any }) {
  const [busca, setBusca] = useState("");

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["alunos-turma-tab", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("aluno_id, alunos(id, nome, email, telefone)")
        .eq("turma_id", turma.id)
        .is("deleted_at", null);
      if (error) throw error;

      const mapa = new Map<string, any>();
      (data || []).forEach((m: any) => {
        const a = m.alunos;
        if (a?.id && !mapa.has(a.id)) mapa.set(a.id, a);
      });
      return Array.from(mapa.values()).sort((a: any, b: any) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
      );
    },
  });

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    const digitos = busca.replace(/\D/g, "");
    if (!termo && !digitos) return alunos;
    return alunos.filter((a: any) => {
      const nomeOk = termo && normalizar(a.nome).includes(termo);
      const emailOk = termo && normalizar(a.email).includes(termo);
      const telOk =
        digitos.length > 0 && (a.telefone || "").replace(/\D/g, "").includes(digitos);
      return nomeOk || emailOk || telOk;
    });
  }, [alunos, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold">
          {isLoading
            ? "Carregando alunos..."
            : busca && filtrados.length !== alunos.length
              ? `${filtrados.length} de ${alunos.length} aluno(s) na turma`
              : `${alunos.length} aluno(s) na turma`}
        </span>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="h-9 pl-8 pr-8"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="w-16 text-center">WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((a: any) => {
                  const wa = whatsappLink(a.telefone);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{a.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.email || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.telefone || "—"}</TableCell>
                      <TableCell className="text-center">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex">
                            <MessageCircle className="h-4 w-4 text-emerald-600 hover:text-emerald-700" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {alunos.length === 0
                        ? "Nenhum aluno matriculado nesta turma."
                        : "Nenhum aluno encontrado com essa busca."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
