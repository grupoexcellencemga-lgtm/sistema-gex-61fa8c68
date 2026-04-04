import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Settings2, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CreateUserDialog } from "@/components/usuarios/CreateUserDialog";
import { PermissionsDialog } from "@/components/usuarios/PermissionsDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const tipoLabels: Record<string, string> = {
  admin: "ADM Master",
  profissional: "Profissional",
  comercial: "Vendedor / Comercial",
  financeiro: "Financeiro",
  suporte: "Suporte",
};

const UsuariosADM = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [deleteUser, setDeleteUser] = useState<{ user_id: string; nome: string } | null>(null);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["adm-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");
      const { data: profissionais } = await supabase.from("profissionais").select("id, nome").is("deleted_at", null);
      const { data: comerciais } = await supabase.from("comerciais").select("id, nome").is("deleted_at", null);

      return (profiles ?? []).map((p: any) => {
        const role = roles?.find((r: any) => r.user_id === p.user_id)?.role ?? null;
        const prof = profissionais?.find((pr: any) => pr.id === p.profissional_id);
        const com = comerciais?.find((c: any) => c.id === p.comercial_id);
        return {
          ...p,
          role,
          profissional_nome: prof?.nome ?? null,
          comercial_nome: com?.nome ?? null,
        };
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("user_permissions").delete().eq("user_id", userId);
      await supabase.from("user_roles").delete().eq("user_id", userId);

      const res = await supabase.functions.invoke("admin-delete-user", {
        body: { target_user_id: userId },
      });
      if (res.error) throw new Error(res.error.message || "Erro ao excluir usuário");
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["adm-users"] });
      setDeleteUser(null);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const editUser = usuarios.find((u: any) => u.user_id === editUserId);

  return (
    <div>
      <PageHeader title="Usuários ADM" description="Gerencie a equipe administrativa e seus acessos">
        <CreateUserDialog />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tipo de Acesso</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                            {u.nome?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{u.nome}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {tipoLabels[u.role] ?? "Sem perfil"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.profissional_nome && (
                        <span className="text-sm">
                          <span className="text-muted-foreground text-xs">Prof: </span>
                          {u.profissional_nome}
                        </span>
                      )}
                      {u.comercial_nome && (
                        <span className="text-sm">
                          <span className="text-muted-foreground text-xs">Vend: </span>
                          {u.comercial_nome}
                        </span>
                      )}
                      {!u.profissional_nome && !u.comercial_nome && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.user_id !== currentUser?.id && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditUserId(u.user_id)}
                          >
                            <Settings2 className="h-4 w-4 mr-1" />Configurar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteUser({ user_id: u.user_id, nome: u.nome })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editUser && (
        <PermissionsDialog
          open={!!editUserId}
          onClose={() => setEditUserId(null)}
          userId={editUser.user_id}
          userName={editUser.nome}
          userRole={editUser.role}
          userProfissionalId={editUser.profissional_id}
          userComercialId={editUser.comercial_id}
        />
      )}

      <AlertDialog open={!!deleteUser} onOpenChange={(v) => { if (!v) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deleteUser?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.user_id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsuariosADM;