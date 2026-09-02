import { useState, useEffect } from "react";
import { EmailTemplatesSection } from "@/components/configuracoes/EmailTemplatesSection";
import { TaxasSection } from "@/components/configuracoes/TaxasSection";
import { FormasPagamentoSection } from "@/components/configuracoes/FormasPagamentoSection";
import { CategoriasSection } from "@/components/configuracoes/CategoriasSection";
import { ChecklistTemplatesSection } from "@/components/configuracoes/ChecklistTemplatesSection";
import { ChecklistAreaResponsaveisSection } from "@/components/configuracoes/ChecklistAreaResponsaveisSection";
import { GoogleAgendaSection } from "@/components/configuracoes/GoogleAgendaSection";
import { CanaisCrmSection } from "@/components/configuracoes/CanaisCrmSection";
import { WhatsAppManagerSection } from "@/components/configuracoes/WhatsAppManagerSection";
import { EmpresaIdentidadeSection } from "@/components/configuracoes/EmpresaIdentidadeSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  User,
  Building2,
  Palette,
  Bell,
  Mail,
  Tags,
  CreditCard,
  Percent,
  ListChecks,
  CalendarClock,
  Paintbrush,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

interface DadosEmpresa {
  nome: string;
  email: string;
  telefone: string;
  whatsapp_url?: string;
  whatsapp_token?: string;
  whatsapp_instancia?: string;
  whatsapp_notificacao_numero?: string;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "perfil";

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

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
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");

  const [notifConfig, setNotifConfig] = useState(defaultConfig);
  const [empresa, setEmpresa] = useState<DadosEmpresa>({
    nome: "",
    email: "",
    telefone: "",
    whatsapp_url: "",
    whatsapp_token: "",
    whatsapp_instancia: "",
    whatsapp_notificacao_numero: "",
  });

  useEffect(() => {
    if (!profile) return;
    setNome((profile as any).nome || "");
    setSobrenome((profile as any).sobrenome || "");
    setTelefone(profile.telefone ? maskPhone(profile.telefone) : "");
  }, [profile]);

  useEffect(() => {
    if (!config) return;

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
      whatsapp_notificacao_numero: de.whatsapp_notificacao_numero || "",
    });

    setTheme(config.tema || "system");
  }, [config, setTheme]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          nome,
          telefone: telefone || null,
          sobrenome: sobrenome || null,
        } as any)
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
    upsertConfig.mutate(
      {
        dados_empresa: empresa as any,
      },
      {
        onSuccess: () => toast.success("Dados da empresa atualizados"),
      }
    );
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
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Organize preferências, empresa, integrações e regras do sistema"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="w-full max-w-full overflow-x-auto overflow-y-hidden pb-2">
          <TabsList className="inline-flex w-max min-w-max whitespace-nowrap">
            <TabsTrigger value="perfil" className="gap-1.5 shrink-0">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>

            <TabsTrigger value="identidade" className="gap-1.5 shrink-0">
              <Paintbrush className="h-4 w-4" />
              Identidade Visual
            </TabsTrigger>

            <TabsTrigger value="empresa" className="gap-1.5 shrink-0">
              <Building2 className="h-4 w-4" />
              Empresa
            </TabsTrigger>

            <TabsTrigger value="whatsapp" className="gap-1.5 shrink-0">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>

            <TabsTrigger value="aparencia" className="gap-1.5 shrink-0">
              <Palette className="h-4 w-4" />
              Aparência
            </TabsTrigger>

            <TabsTrigger value="notificacoes" className="gap-1.5 shrink-0">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>

            <TabsTrigger value="emails" className="gap-1.5 shrink-0">
              <Mail className="h-4 w-4" />
              Emails
            </TabsTrigger>

            <TabsTrigger value="categorias" className="gap-1.5 shrink-0">
              <Tags className="h-4 w-4" />
              Categorias
            </TabsTrigger>

            <TabsTrigger value="formas-pagamento" className="gap-1.5 shrink-0">
              <CreditCard className="h-4 w-4" />
              Formas de Pagamento
            </TabsTrigger>

            <TabsTrigger value="taxas" className="gap-1.5 shrink-0">
              <Percent className="h-4 w-4" />
              Taxas
            </TabsTrigger>

            <TabsTrigger value="checklists" className="gap-1.5 shrink-0">
              <ListChecks className="h-4 w-4" />
              Checklists de Eventos
            </TabsTrigger>

            <TabsTrigger value="google-agenda" className="gap-1.5 shrink-0">
              <CalendarClock className="h-4 w-4" />
              Google Agenda
            </TabsTrigger>

            <TabsTrigger value="canais-crm" className="gap-1.5 shrink-0">
              <Radio className="h-4 w-4" />
              Canais & CRM
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="perfil" className="max-w-2xl space-y-6">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nome</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João" />
                    </div>
                    <div>
                      <Label>Sobrenome</Label>
                      <Input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} placeholder="Silva" />
                    </div>
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
        </TabsContent>

        <TabsContent value="empresa" className="max-w-2xl space-y-6">
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
        </TabsContent>

        <TabsContent value="whatsapp" className="max-w-2xl space-y-6">
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

              <div>
                <Label>Número para receber notificações de inscrição</Label>
                <Input
                  value={empresa.whatsapp_notificacao_numero || ""}
                  onChange={(e) =>
                    setEmpresa((p) => ({
                      ...p,
                      whatsapp_notificacao_numero: e.target.value,
                    }))
                  }
                  placeholder="67999999999 (com DDD, sem +55)"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Quando alguém se inscrever em um evento, você receberá uma mensagem neste número.
                </p>
              </div>

              <Button onClick={saveEmpresa} disabled={upsertConfig.isPending}>
                {upsertConfig.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar Configuração WhatsApp
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aparencia" className="max-w-2xl space-y-6">
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
        </TabsContent>

        <TabsContent value="notificacoes" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notificações</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {notifItems.map((item, i) => (
                <div key={item.key}>
                  {i > 0 && <Separator className="mb-4" />}

                  <div className="flex items-center justify-between gap-4">
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
        </TabsContent>

        <TabsContent value="emails" className="max-w-5xl space-y-6">
          <EmailTemplatesSection />
        </TabsContent>

        <TabsContent value="categorias" className="max-w-5xl space-y-6">
          <CategoriasSection />
        </TabsContent>

        <TabsContent value="formas-pagamento" className="max-w-5xl space-y-6">
          <FormasPagamentoSection />
        </TabsContent>

        <TabsContent value="taxas" className="max-w-5xl space-y-6">
          <TaxasSection />
        </TabsContent>

        <TabsContent value="checklists" className="max-w-5xl space-y-6">
          <ChecklistAreaResponsaveisSection />
          <ChecklistTemplatesSection />
        </TabsContent>

        <TabsContent value="google-agenda" className="max-w-5xl space-y-6">
          <GoogleAgendaSection />
        </TabsContent>

        <TabsContent value="identidade" className="max-w-2xl space-y-6">
          <EmpresaIdentidadeSection />
        </TabsContent>

        <TabsContent value="canais-crm" className="max-w-3xl space-y-6">
          <WhatsAppManagerSection />
          <CanaisCrmSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
