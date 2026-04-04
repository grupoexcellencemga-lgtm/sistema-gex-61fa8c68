import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfissionais } from "@/hooks/useProfissionais";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TipoAcesso = "admin" | "profissional" | "comercial";

export function CreateUserDialog() {
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

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso>("profissional");
  const [profissionalId, setProfissionalId] = useState("");
  const [comercialId, setComercialId] = useState("");

  const createUser = useMutation({
    mutationFn: async () => {
      if (!senha || senha.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres");
      if (senha !== confirmarSenha) throw new Error("As senhas não coincidem");

      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Erro ao criar usuário");

      const role = tipoAcesso === "admin" ? "admin" : tipoAcesso === "comercial" ? "comercial" : "profissional";
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: data.user.id,
        role: role as any,
      });
      if (roleError) throw roleError;

      if (tipoAcesso === "profissional" && profissionalId) {
        await supabase
          .from("profiles")
          .update({ profissional_id: profissionalId } as any)
          .eq("user_id", data.user.id);
      } else if (tipoAcesso === "comercial" && comercialId) {
        await supabase
          .from("profiles")
          .update({ comercial_id: comercialId } as any)
          .eq("user_id", data.user.id);
      }
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["adm-users"] });
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const resetForm = () => {
    setNome("");
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    setTipoAcesso("profissional");
    setProfissionalId("");
    setComercialId("");
  };

  const canSubmit =
    nome && email && senha && senha.length >= 6 && senha === confirmarSenha &&
    (tipoAcesso === "admin" ||
     (tipoAcesso === "profissional" && profissionalId) ||
     (tipoAcesso === "comercial" && comercialId));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Novo Usuário</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cadastrar Novo Usuário</DialogTitle></DialogHeader>
        <div className="grid gap-4 mt-4">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>Senha</Label>
            <PasswordInput value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <Label>Confirmar Senha</Label>
            <PasswordInput value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} placeholder="Repita a senha" />
            {confirmarSenha && senha !== confirmarSenha && (
              <p className="text-xs text-destructive mt-1">As senhas não coincidem</p>
            )}
          </div>
          <div>
            <Label>Tipo de Acesso</Label>
            <Select value={tipoAcesso} onValueChange={(v) => setTipoAcesso(v as TipoAcesso)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">ADM Master (acesso total)</SelectItem>
                <SelectItem value="profissional">Profissional (vinculado a profissional)</SelectItem>
                <SelectItem value="comercial">Vendedor / Comercial (vinculado a vendedor)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipoAcesso === "profissional" && (
            <div>
              <Label>Profissional Vinculado</Label>
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                <SelectContent>
                  {profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Este usuário verá apenas processos, turmas e eventos vinculados a este profissional.
              </p>
            </div>
          )}
          {tipoAcesso === "comercial" && (
            <div>
              <Label>Vendedor Vinculado</Label>
              <Select value={comercialId} onValueChange={setComercialId}>
                <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>
                  {comerciais.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Este usuário verá apenas leads, matrículas e comissões vinculadas a este vendedor.
              </p>
            </div>
          )}
          <Button
            className="w-full"
            onClick={() => createUser.mutate()}
            disabled={!canSubmit || createUser.isPending}
          >
            {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar Usuário
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
