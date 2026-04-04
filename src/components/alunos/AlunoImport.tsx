import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  importDialogOpen: boolean;
  setImportDialogOpen: (v: boolean) => void;
  importPreview: any[] | null;
  setImportPreview: (v: any) => void;
  isImporting: boolean;
  onConfirmImport: () => void;
}

export const AlunoImport = ({ importDialogOpen, setImportDialogOpen, importPreview, setImportPreview, isImporting, onConfirmImport }: Props) => (
  <AlertDialog open={importDialogOpen} onOpenChange={(v) => { if (!v) { setImportDialogOpen(false); setImportPreview(null); } }}>
    <AlertDialogContent className="max-w-lg">
      <AlertDialogHeader>
        <AlertDialogTitle>Importar Alunos</AlertDialogTitle>
        <AlertDialogDescription>
          {importPreview?.length ?? 0} aluno(s) encontrado(s) na planilha. Deseja importar?
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="max-h-60 overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CPF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(importPreview ?? []).slice(0, 20).map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{r.nome}</TableCell>
                <TableCell className="text-xs">{r.email || "—"}</TableCell>
                <TableCell className="text-xs">{r.telefone || "—"}</TableCell>
                <TableCell className="text-xs">{r.cpf || "—"}</TableCell>
              </TableRow>
            ))}
            {(importPreview?.length ?? 0) > 20 && (
              <TableRow>
                <TableCell colSpan={4} className="text-xs text-center text-muted-foreground">
                  ... e mais {(importPreview?.length ?? 0) - 20} registro(s)
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirmImport} disabled={isImporting}>
          {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Importar {importPreview?.length ?? 0} aluno(s)
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
