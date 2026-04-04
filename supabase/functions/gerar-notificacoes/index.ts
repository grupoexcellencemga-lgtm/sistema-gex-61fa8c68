import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Helper to send email via enviar-email function
    const sendEmail = async (to: string, templateNome: string, variaveis: Record<string, string>) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/enviar-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ to, template_nome: templateNome, variaveis }),
        });
        const data = await res.json();
        return data;
      } catch (e) {
        console.error("Email send error:", e);
        return null;
      }
    };

    // Get empresa config for email variables
    const { data: anyConfig } = await supabase
      .from("configuracoes_usuario")
      .select("dados_empresa")
      .limit(1)
      .maybeSingle();
    const empresaNome = (anyConfig?.dados_empresa as any)?.nome || "Nossa Empresa";

    const hoje = new Date();
    const hojeStr = hoje.toISOString().split("T")[0];
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().split("T")[0];
    const tresDiasAtras = new Date(hoje);
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    // Get all users with their configs
    const { data: profiles } = await supabase.from("profiles").select("user_id, nome");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: configs } = await supabase.from("configuracoes_usuario").select("*");

    const configMap = new Map((configs || []).map((c: any) => [c.user_id, c]));
    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

    const adminAndFinanceiroIds = (profiles || [])
      .filter((p: any) => {
        const role = roleMap.get(p.user_id);
        return role === "admin" || role === "financeiro" || !role;
      })
      .map((p: any) => p.user_id);

    const notifications: any[] = [];

    const shouldNotify = (userId: string, configKey: string) => {
      const cfg = configMap.get(userId);
      if (!cfg) return true; // default is true
      return (cfg as any)[configKey] !== false;
    };

    // 1. Pagamentos vencidos
    const { data: vencidos } = await supabase
      .from("pagamentos")
      .select("id, aluno_id, valor, data_vencimento")
      .is("deleted_at", null)
      .eq("status", "pendente")
      .lt("data_vencimento", hojeStr);

    if (vencidos && vencidos.length > 0) {
      // Check we haven't already sent today
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("tipo", "pagamento_vencido")
        .gte("created_at", hojeStr + "T00:00:00Z")
        .limit(1);

      if (!existing || existing.length === 0) {
        for (const uid of adminAndFinanceiroIds) {
          if (shouldNotify(uid, "notif_pagamento_vencido")) {
            notifications.push({
              user_id: uid,
              tipo: "pagamento_vencido",
              titulo: `${vencidos.length} pagamento(s) vencido(s)`,
              mensagem: `Existem ${vencidos.length} pagamentos pendentes com vencimento passado.`,
              link: "/financeiro",
            });
          }
        }

        // Send overdue payment emails to each aluno
        const alunoIds = [...new Set(vencidos.map((v: any) => v.aluno_id))];
        const { data: alunosVencidos } = await supabase
          .from("alunos")
          .select("id, nome, email")
          .in("id", alunoIds)
          .is("deleted_at", null);

        for (const aluno of alunosVencidos || []) {
          if (!aluno.email) continue;
          const alunoVencidos = vencidos.filter((v: any) => v.aluno_id === aluno.id);
          const totalValor = alunoVencidos.reduce((s: number, v: any) => s + (v.valor || 0), 0);
          const dataVenc = alunoVencidos[0]?.data_vencimento || "";
          await sendEmail(aluno.email, "pagamento_vencido", {
            nome: aluno.nome,
            valor: totalValor.toFixed(2).replace(".", ","),
            data_vencimento: dataVenc ? new Date(dataVenc + "T12:00:00Z").toLocaleDateString("pt-BR") : "",
            empresa: empresaNome,
          });
        }
      }
    }

    // 1b. Lembrete de pagamento 3 dias antes
    const tresDiasDepois = new Date(hoje);
    tresDiasDepois.setDate(tresDiasDepois.getDate() + 3);
    const tresDiasDepoisStr = tresDiasDepois.toISOString().split("T")[0];

    const { data: proxVencimentos } = await supabase
      .from("pagamentos")
      .select("id, aluno_id, valor, data_vencimento")
      .is("deleted_at", null)
      .eq("status", "pendente")
      .eq("data_vencimento", tresDiasDepoisStr);

    if (proxVencimentos && proxVencimentos.length > 0) {
      const { data: existingLembrete } = await supabase
        .from("emails_enviados")
        .select("id")
        .eq("assunto", "Lembrete: pagamento próximo do vencimento")
        .gte("created_at", hojeStr + "T00:00:00Z")
        .limit(1);

      if (!existingLembrete || existingLembrete.length === 0) {
        const alunoIds = [...new Set(proxVencimentos.map((v: any) => v.aluno_id))];
        const { data: alunosLembrete } = await supabase
          .from("alunos")
          .select("id, nome, email")
          .in("id", alunoIds)
          .is("deleted_at", null);

        for (const aluno of alunosLembrete || []) {
          if (!aluno.email) continue;
          const alunoPag = proxVencimentos.filter((v: any) => v.aluno_id === aluno.id);
          const totalValor = alunoPag.reduce((s: number, v: any) => s + (v.valor || 0), 0);
          await sendEmail(aluno.email, "lembrete_pagamento", {
            nome: aluno.nome,
            valor: totalValor.toFixed(2).replace(".", ","),
            data_vencimento: new Date(tresDiasDepoisStr + "T12:00:00Z").toLocaleDateString("pt-BR"),
            empresa: empresaNome,
          });
        }
      }
    }

    // 2. Aniversários de amanhã (also today for email)
    const { data: alunos } = await supabase
      .from("alunos")
      .select("id, nome, email, data_nascimento")
      .is("deleted_at", null)
      .not("data_nascimento", "is", null);

    // Birthday emails for TODAY
    const aniversariantesHoje = (alunos || []).filter((a: any) => {
      if (!a.data_nascimento) return false;
      const dn = new Date(a.data_nascimento + "T12:00:00Z");
      return dn.getMonth() === hoje.getMonth() && dn.getDate() === hoje.getDate();
    });

    for (const aluno of aniversariantesHoje) {
      if (!aluno.email) continue;
      await sendEmail(aluno.email, "aniversario", {
        nome: aluno.nome,
        empresa: empresaNome,
      });
    }

    // Birthday notifications for TOMORROW
    const aniversariantes = (alunos || []).filter((a: any) => {
      if (!a.data_nascimento) return false;
      const dn = new Date(a.data_nascimento + "T12:00:00Z");
      return dn.getMonth() === amanha.getMonth() && dn.getDate() === amanha.getDate();
    });

    if (aniversariantes.length > 0) {
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("tipo", "aniversario")
        .gte("created_at", hojeStr + "T00:00:00Z")
        .limit(1);

      if (!existing || existing.length === 0) {
        const nomes = aniversariantes.map((a: any) => a.nome).slice(0, 3).join(", ");
        for (const uid of adminAndFinanceiroIds) {
          if (shouldNotify(uid, "notif_aniversarios")) {
            notifications.push({
              user_id: uid,
              tipo: "aniversario",
              titulo: `🎂 Aniversário amanhã`,
              mensagem: `${aniversariantes.length} aniversariante(s) amanhã: ${nomes}${aniversariantes.length > 3 ? "..." : ""}`,
              link: "/aniversarios",
            });
          }
        }
      }
    }

    // 3. Leads sem interação há 3+ dias
    const { data: leadsInativos } = await supabase
      .from("leads")
      .select("id, nome, responsavel_id, updated_at")
      .is("deleted_at", null)
      .not("etapa", "in", "(matricula,perdido)")
      .lt("updated_at", tresDiasAtras.toISOString());

    if (leadsInativos && leadsInativos.length > 0) {
      // Group by responsavel_id
      const byResponsavel = new Map<string, any[]>();
      for (const lead of leadsInativos) {
        const key = lead.responsavel_id || "unassigned";
        if (!byResponsavel.has(key)) byResponsavel.set(key, []);
        byResponsavel.get(key)!.push(lead);
      }

      // Get comercial->user mappings
      const { data: profilesComerciais } = await supabase
        .from("profiles")
        .select("user_id, comercial_id")
        .not("comercial_id", "is", null);

      const comercialToUser = new Map(
        (profilesComerciais || []).map((p: any) => [p.comercial_id, p.user_id])
      );

      for (const [respId, leadsGroup] of byResponsavel) {
        const targetUserId = respId === "unassigned" ? null : comercialToUser.get(respId);
        const targetUsers = targetUserId ? [targetUserId] : adminAndFinanceiroIds;
        
        for (const uid of targetUsers) {
          if (shouldNotify(uid, "notif_leads_inativos")) {
            notifications.push({
              user_id: uid,
              tipo: "lead_sem_contato",
              titulo: `${leadsGroup.length} lead(s) sem contato`,
              mensagem: `Leads sem interação há 3+ dias: ${leadsGroup.map((l: any) => l.nome).slice(0, 3).join(", ")}`,
              link: "/funil",
            });
          }
        }
      }
    }

    // 4. Sessões amanhã
    const amanhaInicio = new Date(hoje); amanhaInicio.setDate(amanhaInicio.getDate() + 1); amanhaInicio.setHours(0,0,0,0);
    const amanhaFim = new Date(amanhaInicio); amanhaFim.setHours(23,59,59,999);

    const { data: sessoesAmanha } = await supabase
      .from("sessoes_processo")
      .select("id, data_hora, profissional_id")
      .is("deleted_at", null)
      .eq("status", "agendada")
      .gte("data_hora", amanhaInicio.toISOString())
      .lte("data_hora", amanhaFim.toISOString());

    // Get profissional->user mappings
    const { data: profilesProf } = await supabase
      .from("profiles")
      .select("user_id, profissional_id")
      .not("profissional_id", "is", null);

    const profToUser = new Map((profilesProf || []).map((p: any) => [p.profissional_id, p.user_id]));

    if (sessoesAmanha && sessoesAmanha.length > 0) {
      for (const sessao of sessoesAmanha) {
        if (sessao.profissional_id) {
          const targetUserId = profToUser.get(sessao.profissional_id);
          if (targetUserId && shouldNotify(targetUserId, "notif_sessoes")) {
            // Verifica duplicada
            const { data: existing } = await supabase.from("notificacoes").select("id").eq("tipo", "sessao_amanha").like("link", `%${sessao.id}%`).limit(1);
            if (!existing || existing.length === 0) {
              notifications.push({
                user_id: targetUserId,
                tipo: "sessao_amanha",
                titulo: "Sessão amanhã",
                mensagem: `Sessão agendada para amanhã às ${new Date(sessao.data_hora).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})}.`,
                link: `/agenda?sessao=${sessao.id}`,
              });
            }
          }
        }
      }
    }

    // 5. Sessão em 1 hora
    const daqui1HoraInicio = new Date(hoje); daqui1HoraInicio.setMinutes(daqui1HoraInicio.getMinutes() + 50);
    const daqui1HoraFim = new Date(hoje); daqui1HoraFim.setMinutes(daqui1HoraFim.getMinutes() + 70);

    const { data: sessoes1Hora } = await supabase
      .from("sessoes_processo")
      .select("id, data_hora, profissional_id")
      .is("deleted_at", null)
      .eq("status", "agendada")
      .gte("data_hora", daqui1HoraInicio.toISOString())
      .lte("data_hora", daqui1HoraFim.toISOString());

    if (sessoes1Hora && sessoes1Hora.length > 0) {
      for (const sessao of sessoes1Hora) {
        if (sessao.profissional_id) {
          const targetUserId = profToUser.get(sessao.profissional_id);
          if (targetUserId && shouldNotify(targetUserId, "notif_sessoes")) {
             const { data: existing } = await supabase.from("notificacoes").select("id").eq("tipo", "sessao_1hora").like("link", `%${sessao.id}%`).limit(1);
             if (!existing || existing.length === 0) {
              notifications.push({
                user_id: targetUserId,
                tipo: "sessao_1hora",
                titulo: "Sessão em breve",
                mensagem: `Sua sessão começa em cerca de 1 hora!`,
                link: `/agenda?sessao=${sessao.id}`,
              });
             }
          }
        }
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error } = await supabase.from("notificacoes").insert(notifications);
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ success: true, generated: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
