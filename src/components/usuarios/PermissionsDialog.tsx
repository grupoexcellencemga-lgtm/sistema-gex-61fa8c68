import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfissionais } from "@/hooks/useProfissionais";
import { ALL_PAGES, ROLE_DEFAULTS, type PageKey } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";


interface PermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: string | null;
  userProfissionalId: string | null;
  userComercialId: string | null;
}

export function PermissionsDialog({
  open, onClose, userId, userName, userRole,
  userProfissionalId, userComercialId,
}: PermissionsDialogProps) {
  const queryClient = useQueryClient();
  const { data: profissionais = [] } = useProfissionais();
  const { data: comerciais = [] } = useQuery({
    queryKey: ["comerciais-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("comerciais")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const [permChecked, setPermChecked] = useState<Record<string, boolean>>({});
  const [linkedProfissionalId, setLinkedProfissionalId] = useState("none");
  const [linkedComercialId, setLinkedComercialId] = useState("none");
  const [selectedRole, setSelectedRole] = useState<string>(userRole ?? "");

  // Password reset state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setLinkedProfissionalId(userProfissionalId ?? "none");
    setLinkedComercialId(userComercialId ?? "none");
    setSelectedRole(userRole ?? "");
    setPermChecked({});
    setShowResetPassword(false);
    setNewPassword("");
    setConfirmPassword("");
  }, [userId, userProfissionalId, userComercialId, userRole]);

  const { data: userPerms = [] } = useQuery({
    queryKey: ["user-permissions-edit", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_permissions")
        .select("page_key, allowed")
        .eq("user_id", userId);
      return data ?? [];
    },
    enabled: !!userId && open,
  });

  const getEffectivePerms = (): Record<string, boolean> => {
    const defaults = ROLE_DEFAULTS[selectedRole ?? ""] ?? ["dashboard", "configuracoes"];
    const overrides = new Map(userPerms.map((p: any) => [p.page_key, p.allowed]));
    const result: Record<string, boolean> = {};
    ALL_PAGES.forEach((p) => {
      if (p.key === "usuarios") return;
      result[p.key] = overrides.has(p.key) ? overrides.get(p.key)! : defaults.includes(p.key);
    });
    return result;
  };

  const effectivePerms = getEffectivePerms();

  const saveAll = useMutation({
    mutationFn: async () => {
      const profId = linkedProfissionalId === "none" ? null : linkedProfissionalId;
      const comId = linkedComercialId === "none" ? null : linkedComercialId;

      const { error: profError } = await supabase
        .from("profiles")
        .update({ profissional_id: profId, comercial_id: comId } as any)
        .eq("user_id", userId);
      if (profError) throw profError;

      // Update role
      if (selectedRole) {
        await supabase.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: selectedRole as any });
        if (roleError) throw roleError;
      }

      const defaults = ROLE_DEFAULTS[selectedRole ?? ""] ?? ["dashboard", "configuracoes"];
      await supabase.from("user_permissions").delete().eq("user_id", userId);

      const overrides: { user_id: string; page_key: string; allowed: boolean }[] = [];
      for (const page of ALL_PAGES) {
        if (page.key === "usuarios") continue;
        const isDefault = defaults.includes(page.key);
        const isChecked = permChecked[page.key] ?? effectivePerms[page.key] ?? false;
        if (isChecked !== isDefault) {
          overrides.push({ user_id: userId, page_key: page.key, allowed: isChecked });
        }
      }
      if (overrides.length > 0) {
        const { error } = await supabase.from("user_permissions").insert(overrides);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso");
      queryClient.invalidateQueries({ queryKey: ["adm-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions-edit", userId] });
      onClose();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!newPassword || newPassword.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres");
      if (newPassword !== confirmPassword) throw new Error("As senhas não coincidem");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("admin-reset-password", {
        body: { target_user_id: userId, new_password: newPassword },
      });

      if (res.error) throw new Error(res.error.message || "Erro ao redefinir senha");
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso");
      setShowResetPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações — {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Role selector */}
          <div>
            <Label className="text-sm font-medium">Tipo de Acesso</Label>
            <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); setPermChecked({}); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo de acesso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">ADM Master</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="comercial">Vendedor / Comercial</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="suporte">Suporte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Profissional Vinculado</Label>
            <Select value={linkedProfissionalId} onValueChange={setLinkedProfissionalId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {linkedProfissionalId !== "none"
                ? "Verá apenas processos, turmas e eventos deste profissional."
                : "Sem vínculo de profissional."}
            </p>
          </div>

          {/* Comercial link */}
          <div>
            <Label className="text-sm font-medium">Vendedor Vinculado</Label>
            <Select value={linkedComercialId} onValueChange={setLinkedComercialId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {comerciais.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {linkedComercialId !== "none"
                ? "Verá apenas leads, matrículas e comissões deste vendedor."
                : "Sem vínculo de vendedor."}
            </p>
          </div>

          {/* Module permissions */}
          <div>
            <Label className="text-sm font-medium">Permissões por Módulo</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-[35vh] overflow-y-auto">
              {ALL_PAGES.filter((p) => p.key !== "usuarios").map((page) => {
                const checked = permChecked[page.key] ?? effectivePerms[page.key] ?? false;
                return (
                  <label
                    key={page.key}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setPermChecked((prev) => ({ ...prev, [page.key]: !!v }))
                      }
                    />
                    {page.label}
                  </label>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Password reset section */}
          <div>
            {!showResetPassword ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowResetPassword(true)}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Redefinir Senha
              </Button>
            ) : (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Redefinir Senha</Label>
                <div>
                  <Label className="text-xs">Nova senha</Label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <Label className="text-xs">Confirmar nova senha</Label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive mt-1">As senhas não coincidem</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => resetPassword.mutate()}
                    disabled={
                      resetPassword.isPending ||
                      !newPassword ||
                      newPassword.length < 6 ||
                      newPassword !== confirmPassword
                    }
                  >
                    {resetPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Nova Senha
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowResetPassword(false);
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => saveAll.mutate()}
              disabled={saveAll.isPending}
            >
              {saveAll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Configurações
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
