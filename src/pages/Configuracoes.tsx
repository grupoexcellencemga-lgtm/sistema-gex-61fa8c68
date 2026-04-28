import { useState, useEffect } from "react";
import { EmailTemplatesSection } from "@/components/configuracoes/EmailTemplatesSection";
import { TaxasSection } from "@/components/configuracoes/TaxasSection";
import { CategoriasSection } from "@/components/configuracoes/CategoriasSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { maskPhone } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sun, Moon, Monitor, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface DadosEmpresa {
  nome: string;
  email: string;
  telefone: string;
  whatsapp_url?: string;
  whatsapp_token?: string;
  whatsapp_instancia?: string;
}

interface ConfigRow {
  id: string;
  user_id: string;
  notif_pagamento_vencido: boolean;
  notif_novo_cadastro: boolean;
  notif_aniversarios: boolean;
  notif_sessoes: boolean;
  notif_leads_inativos: boolean;
  tema: string;
  dados_empresa: DadosEmpresa;
}

const defaultConfig: Omit<ConfigRow, "id" | "user_id"> = {
  notif_pagamento_vencido: true,
  notif_novo_cadastro: true,
  notif_aniversarios: true,
  notif_sessoes: true,
  notif_leads_inativos: true,
  tema: "system",
  dados_empresa: {
    nome: "",
    email: "",
    telefone: "",
  },
};

const Configuracoes = () => {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: !!user,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["configuracoes_usuario", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("configuracoes_usuario")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        dados_empresa: (data.dados_empresa || {
          nome: "",
          email: "",
          telefone: "",
        }) as unknown as DadosEmpresa,
      } as ConfigRow;
    },
    enabled: !!user,
  });

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [profileInit, setProfileInit] = useState(false);

  const [notifConfig, setNotifConfig] = useState(defaultConfig);
  const [empresa, setEmpresa] = useState<DadosEmpresa>({
    nome: "",
    email: "",
    telefone: "",
    whatsapp_url: "",
    whatsapp_token: "",
    whatsapp_instancia: "",
  });
  const [configInit, setConfigInit] = useState(false);

  if (profile && !profileInit) {
    setNome(profile.nome || "");
    setTelefone(profile.telefone ? maskPhone(profile.telefone) : "");
    setProfileInit(true);
  }

  useEffect(() => {
    if (config && !configInit) {
      setNotifConfig({
        notif_pagamento_vencido: config.notif_pagamento_vencido,
        notif_novo_cadastro: config.notif_novo_cadastro,
        notif_aniversarios: config.notif_aniversarios,
        notif_sessoes: config.notif_sessoes,
        notif_leads_inativos: config.notif_leads_inativos,
        tema: config.tema || "system",
        dados_empresa: (config.dados_empresa as any) || {
          nome: "",
          email: "",
          telefone: "",
        },
      });

      const de = (config.dados_empresa as any) || {};

      setEmpresa({
        nome: de.nome || "",
        email: de.email || "",
        telefone: de.telefone || "",
        whatsapp_url: de.whatsapp_url || "",
        whatsapp_token: de.whatsapp_token || "",
        whatsapp_instancia: de.whatsapp_instancia || "",
      });

      setTheme(config.tema || "system");
      setConfigInit(true);
    }
  }, [config, configInit, setTheme]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          nome,
          telefone: telefone || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Perfil atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const upsertConfig = useMutation({
    mutationFn: async (partial: Partial<typeof notifConfig>) => {
      if (!user) return;

      const merged = {
        ...notifConfig,
        ...partial,
      };

      const payload = {
        user_id: user.id,
        notif_pagamento_vencido: merged.notif_pagamento_vencido,
        notif_novo_cadastro: merged.notif_novo_cadastro,
        notif_aniversarios: merged.notif_aniversarios,
        notif_sessoes: merged.notif_sessoes,
        notif_leads_inativos: merged.notif_leads_inativos,
        tema: merged.tema,
        dados_empresa: merged.dados_empresa as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase
          .from("configuracoes_usuario")
          .update(payload as any)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_usuario")
          .insert(payload as any);

        if (error) throw error;
      }

      setNotifConfig(merged);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["configuracoes_usuario"],
      });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const toggleNotif = (key: string, value: boolean) => {
    upsertConfig.mutate({
      [key]: value,
    } as any);
  };

  const handleThemeChange = (tema: string) => {
    setTheme(tema);
    upsertConfig.mutate({ tema });
  };

  const saveEmpresa = () => {
    upsertConfig.mutate({
      dados_empresa: empresa as any,
    });

    toast.success("Dados da empresa atualizados");
  };

  const isLoading = profileLoading || configLoading;

  const notifItems = [
    {
      key: "notif_pagamento_vencido",
      label: "Alertas de pagamento vencido",
      desc: "Receber notificações quando um pagamento vencer",
    },
    {
      key: "notif_novo_cadastro",
      label: "Novos cadastros",
      desc: "Notificar quando um novo aluno se cadastrar",
    },
    {
      key: "notif_aniversarios",
      label: "Aniversários",
      desc: "Notificar aniversários de alunos",
    },
    {
      key: "notif_sessoes",
      label: "Sessões próximas",
      desc: "Notificar sessões de processos agendadas",
    },
    {
      key: "notif_leads_inativos",
      label: "Leads sem contato",
      desc: "Notificar leads sem interação há 3+ dias",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Configurações gerais do sistema"
      />

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meu Perfil</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <Label>Nome</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>

                <div>
                  <Label>Email</Label>
                  <Input value={profile?.email || ""} disabled className="opacity-60" />
                </div>

                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={telefone}
                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                    placeholder="(44) 99999-0000"
                  />
                </div>

                <Button
                  onClick={() => updateProfile.mutate()}
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar Alterações
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações da Empresa</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <Label>Nome da empresa</Label>
              <Input
                value={empresa.nome}
                onChange={(e) =>
                  setEmpresa((p) => ({
                    ...p,
                    nome: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Email principal</Label>
              <Input
                value={empresa.email}
                onChange={(e) =>
                  setEmpresa((p) => ({
                    ...p,
                    email: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Telefone</Label>
              <Input
                value={empresa.telefone}
                onChange={(e) =>
                  setEmpresa((p) => ({
                    ...p,
                    telefone: maskPhone(e.target.value),
                  }))
                }
              />
            </div>

            <Button onClick={saveEmpresa} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar Dados
            </Button>
          </CardContent>
        </Card>

        {/* Aparência */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aparência</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Tema</p>
                <p className="text-xs text-muted-foreground">
                  Escolha o tema do sistema
                </p>
              </div>

              <Select value={notifConfig.tema} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="light">
                    <span className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5" />
                      Claro
                    </span>
                  </SelectItem>

                  <SelectItem value="dark">
                    <span className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5" />
                      Escuro
                    </span>
                  </SelectItem>

                  <SelectItem value="system">
                    <span className="flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5" />
                      Sistema
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notificações</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {notifItems.map((item, i) => (
              <div key={item.key}>
                {i > 0 && <Separator className="mb-4" />}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>

                  <Switch
                    checked={(notifConfig as any)[item.key]}
                    onCheckedChange={(v) => toggleNotif(item.key, v)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* WhatsApp Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Integração WhatsApp
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <Label>URL da API (Evolution API ou Z-API)</Label>
              <Input
                value={empresa.whatsapp_url || ""}
                onChange={(e) =>
                  setEmpresa((p) => ({
                    ...p,
                    whatsapp_url: e.target.value,
                  }))
                }
                placeholder="https://api.evolution.exemplo.com"
              />
            </div>

            <div>
              <Label>API Key / Token</Label>
              <Input
                type="password"
                value={empresa.whatsapp_token || ""}
                onChange={(e) =>
                  setEmpresa((p) => ({
                    ...p,
                    whatsapp_token: e.target.value,
                  }))
                }
                placeholder="Seu token de autenticação"
              />
            </div>

            <div>
              <Label>Instância / ID da Sessão</Label>
              <Input
                value={empresa.whatsapp_instancia || ""}
                onChange={(e) =>
                  setEmpresa((p) => ({
                    ...p,
                    whatsapp_instancia: e.target.value,
                  }))
                }
                placeholder="nome-da-instancia"
              />
            </div>

            <Button onClick={saveEmpresa} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar Configuração WhatsApp
            </Button>
          </CardContent>
        </Card>

        {/* Email Templates */}
        <EmailTemplatesSection />

        {/* Categorias Financeiras */}
        <Separator className="my-8" />
        <CategoriasSection />

        {/* Taxas e Impostos */}
        <Separator className="my-8" />
        <TaxasSection />
      </div>
    </div>
  );
};

export default Configuracoes;