import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Crown,
  Shield,
  User,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Empresa {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  cor_primaria: string;
  modulos: string[];
  ativo: boolean;
}

interface MembroEmpresa {
  id: string;
  user_id: string;
  papel: "admin_master" | "admin" | "colaborador";
  created_at: string;
  profiles: { email: string; nome?: string } | null;
}

const PAPEL_ICONS = {
  admin_master: Crown,
  admin: Shield,
  colaborador: User,
};

const PAPEL_LABELS = {
  admin_master: "Admin Master",
  admin: "Admin",
  colaborador: "Colaborador",
};

// ── EmpresaCard ───────────────────────────────────────────────────────────────

function EmpresaCard({ empresa }: { empresa: Empresa }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPapel, setAddPapel] = useState<"admin" | "colaborador">("colaborador");

  const { data: membros = [], isLoading: membrosLoading } = useQuery<MembroEmpresa[]>({
    queryKey: ["empresa-membros", empresa.id],
    queryFn: async () => {
      // user_empresa + auth.users não tem join direto; usamos RPC ou duas queries
      const { data, error } = await (supabase as any)
        .from("user_empresa")
        .select("id, user_id, papel, created_at")
        .eq("empresa_id", empresa.id)
        .order("created_at");
      if (error) throw error;

      // Busca os e-mails via admin API (apenas admin_master tem acesso)
      const userIds: string[] = (data ?? []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: userData } = await (supabase as any).rpc("get_users_by_ids", {
        user_ids: userIds,
      });

      const emailMap = new Map<string, string>(
        (userData ?? []).map((u: any) => [u.id, u.email])
      );

      return (data ?? []).map((r: any) => ({
        ...r,
        profiles: { email: emailMap.get(r.user_id) ?? r.user_id },
      })) as MembroEmpresa[];
    },
    enabled: expanded,
  });

  const addMembroMutation = useMutation({
    mutationFn: async () => {
      if (!addEmail.trim()) throw new Error("E-mail obrigatório");

      // Resolve o user_id pelo e-mail via RPC
      const { data: userData, error: userErr } = await (supabase as any).rpc(
        "get_user_id_by_email",
        { p_email: addEmail.trim().toLowerCase() }
      );
      if (userErr || !userData) throw new Error("Usuário não encontrado com esse e-mail");

      const { error } = await (supabase as any).from("user_empresa").upsert(
        { user_id: userData, empresa_id: empresa.id, papel: addPapel },
        { onConflict: "user_id,empresa_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-membros", empresa.id] });
      toast.success("Membro adicionado");
      setAddEmail("");
      setAddOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const removeMembroMutation = useMutation({
    mutationFn: async (membroId: string) => {
      const { error } = await (supabase as any)
        .from("user_empresa")
        .delete()
        .eq("id", membroId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-membros", empresa.id] });
      toast.success("Membro removido");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header da empresa */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="h-8 w-8 rounded-lg shrink-0"
          style={{ backgroundColor: empresa.cor_primaria }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{empresa.nome}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {empresa.slug}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {empresa.modulos.length} módulo{empresa.modulos.length !== 1 ? "s" : ""} ativos
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="gap-1.5 shrink-0"
        >
          <Users className="h-4 w-4" />
          Membros
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Módulos */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {empresa.modulos.slice(0, 8).map((m) => (
          <span
            key={m}
            className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground"
          >
            {m}
          </span>
        ))}
        {empresa.modulos.length > 8 && (
          <span className="text-[10px] text-muted-foreground px-1">
            +{empresa.modulos.length - 8} mais
          </span>
        )}
      </div>

      {/* Membros (expanded) */}
      {expanded && (
        <>
          <Separator />
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Membros</span>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar
              </Button>
            </div>

            {membrosLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : membros.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum membro atribuído ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {membros.map((m) => {
                  const Icon = PAPEL_ICONS[m.papel] ?? User;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/40"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm truncate">
                        {m.profiles?.email ?? m.user_id}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {PAPEL_LABELS[m.papel]}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Remover este membro?"))
                            removeMembroMutation.mutate(m.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dialog: adicionar membro */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar membro — {empresa.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>E-mail do usuário</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select
                value={addPapel}
                onValueChange={(v) => setAddPapel(v as "admin" | "colaborador")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (gerencia a empresa)</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMembroMutation.mutate()}
              disabled={addMembroMutation.isPending}
            >
              {addMembroMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Empresas page ─────────────────────────────────────────────────────────────

const Empresas = () => {
  const { data: empresas = [], isLoading } = useQuery<Empresa[]>({
    queryKey: ["empresas-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("empresas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Gestão de Empresas"
        description="Admin Master — gerencie empresas e atribua membros"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="h-4 w-4 text-primary" />
          Admin Master
        </div>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {empresas.map((emp) => (
            <EmpresaCard key={emp.id} empresa={emp} />
          ))}
          {empresas.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">
              Nenhuma empresa cadastrada. Execute a migration SQL primeiro.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-dashed p-5 space-y-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          Como atribuir um Admin Master
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Execute este SQL no Supabase substituindo o e-mail e o slug da empresa:
        </p>
        <pre className="text-[11px] bg-muted rounded p-3 overflow-x-auto font-mono text-muted-foreground">
{`INSERT INTO public.user_empresa (user_id, empresa_id, papel)
SELECT u.id, e.id, 'admin_master'
FROM auth.users u, public.empresas e
WHERE u.email = 'seu@email.com'
  AND e.slug   = 'gex'
ON CONFLICT (user_id, empresa_id) DO UPDATE SET papel = 'admin_master';`}
        </pre>
      </div>
    </div>
  );
};

export default Empresas;
