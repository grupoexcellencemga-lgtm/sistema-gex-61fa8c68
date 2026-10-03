export const demoPriorities = [
  { id: 1, title: "12 leads aguardando resposta", detail: "4 há mais de 30 minutos", action: "Abrir CRM", tone: "warning" },
  { id: 2, title: "7 pagamentos vencidos", detail: "R$ 8.460 em aberto", action: "Ver financeiro", tone: "danger" },
  { id: 3, title: "4 propostas aguardando retorno", detail: "Potencial de R$ 18.900", action: "Revisar", tone: "info" },
  { id: 4, title: "3 tarefas atrasadas", detail: "2 comerciais e 1 operacional", action: "Ver tarefas", tone: "neutral" },
] as const;

export const demoAgenda = [
  { time: "09:00", title: "Reunião comercial", meta: "Time de vendas · Sala 2" },
  { time: "11:30", title: "Follow-up OPEX", meta: "Ana Carolina · WhatsApp" },
  { time: "14:00", title: "Demonstração GEx", meta: "Empresa Horizonte · Google Meet" },
  { time: "16:30", title: "Revisão financeira", meta: "Douglas + Financeiro" },
];

export const demoActivities = [
  { title: "Pagamento confirmado", meta: "Mariana Costa · R$ 1.250", time: "há 4 min" },
  { title: "Lead convertido", meta: "Rafael Lima · OPEX", time: "há 12 min" },
  { title: "Novo contato no WhatsApp", meta: "Juliana Martins", time: "há 18 min" },
  { title: "Tarefa concluída", meta: "Enviar proposta Empresa Horizonte", time: "há 31 min" },
];

export const demoKpis = [
  { label: "Receita", value: "R$ 128,4 mil", delta: "+18,6%", trend: "up" },
  { label: "Resultado", value: "R$ 74,9 mil", delta: "+12,1%", trend: "up" },
  { label: "Novos clientes", value: "38", delta: "+9 este mês", trend: "up" },
  { label: "Conversão", value: "24,8%", delta: "+3,2 p.p.", trend: "up" },
];
export const demoRevenueSeries = [
  { month: "Mai", revenue: 78, expenses: 36 },
  { month: "Jun", revenue: 86, expenses: 40 },
  { month: "Jul", revenue: 91, expenses: 38 },
  { month: "Ago", revenue: 103, expenses: 44 },
  { month: "Set", revenue: 112, expenses: 47 },
  { month: "Out", revenue: 128, expenses: 53 },
];

export const demoClients = [
  { id: "ana", name: "Ana Carolina", phone: "(44) 99912-3401", email: "ana@exemplo.com", product: "OPEX", status: "Ativo", total: "R$ 4.970", pending: "R$ 0" },
  { id: "mariana", name: "Mariana Costa", phone: "(44) 99821-4470", email: "mariana@exemplo.com", product: "Mentoria", status: "Ativo", total: "R$ 7.200", pending: "R$ 1.250" },
  { id: "rafael", name: "Rafael Lima", phone: "(44) 99703-5128", email: "rafael@exemplo.com", product: "Advanced", status: "Ativo", total: "R$ 3.200", pending: "R$ 800" },
  { id: "juliana", name: "Juliana Martins", phone: "(44) 99666-1180", email: "juliana@exemplo.com", product: "Comunidade", status: "Pendente", total: "R$ 1.997", pending: "R$ 1.997" },
  { id: "lucas", name: "Lucas Henrique", phone: "(44) 99144-7072", email: "lucas@exemplo.com", product: "OPEX", status: "Inativo", total: "R$ 2.970", pending: "R$ 0" },
];

export const demoClientTimeline = [
  { title: "Pagamento confirmado", detail: "Parcela 3/4 · R$ 1.250", date: "Hoje, 09:18" },
  { title: "Conversa no WhatsApp", detail: "Dúvida sobre próxima etapa respondida pela Júlia", date: "Ontem, 16:42" },
  { title: "Tarefa concluída", detail: "Enviar material de boas-vindas", date: "01/10, 14:10" },
  { title: "Cliente criado", detail: "Convertido a partir do CRM comercial", date: "26/09, 11:32" },
];
export const demoConversations = [
  { id: "ana", name: "Ana Carolina", channel: "WhatsApp", preview: "Tenho uma dúvida sobre o OPEX...", time: "2 min", unread: 2, owner: "Júlia IA", stage: "Proposta enviada", value: "R$ 4.970", source: "Instagram", product: "OPEX" },
  { id: "mariana", name: "Mariana Costa", channel: "Instagram", preview: "Pode me explicar como funciona?", time: "8 min", unread: 1, owner: "Douglas", stage: "Em contato", value: "R$ 7.200", source: "Instagram", product: "Mentoria" },
  { id: "rafael", name: "Rafael Lima", channel: "WhatsApp", preview: "Vou analisar e te retorno hoje.", time: "14 min", unread: 0, owner: "Júlia IA", stage: "Follow-up", value: "R$ 3.200", source: "Indicação", product: "Advanced" },
  { id: "juliana", name: "Juliana Martins", channel: "WhatsApp", preview: "Qual é a próxima turma?", time: "31 min", unread: 0, owner: "Amanda", stage: "Novo lead", value: "R$ 1.997", source: "Evento", product: "Comunidade" },
];

export const demoChat = [
  { from: "lead", text: "Oi, vi o conteúdo de vocês e queria entender melhor como funciona o OPEX.", time: "10:14" },
  { from: "agent", text: "Oi Ana, tudo bem? O OPEX é uma experiência focada em inteligência emocional e performance. Posso te explicar as próximas datas e como funciona a inscrição.", time: "10:14" },
  { from: "lead", text: "Pode sim. E queria saber se ainda tem vaga para a próxima turma.", time: "10:16" },
  { from: "agent", text: "Claro. Vou consultar a turma disponível para te passar a informação correta.", time: "10:16" },
];

export const demoPipeline = [
  { stage: "Novo lead", total: "R$ 19,1 mil", items: [{ name: "Juliana Martins", product: "Comunidade", value: "R$ 1.997" }, { name: "Henrique Souza", product: "OPEX", value: "R$ 4.970" }] },
  { stage: "Em contato", total: "R$ 24,8 mil", items: [{ name: "Mariana Costa", product: "Mentoria", value: "R$ 7.200" }, { name: "Paulo Mendes", product: "Advanced", value: "R$ 3.200" }] },
  { stage: "Proposta enviada", total: "R$ 31,4 mil", items: [{ name: "Ana Carolina", product: "OPEX", value: "R$ 4.970" }, { name: "Empresa Horizonte", product: "Treinamento", value: "R$ 12.500" }] },
  { stage: "Fechamento", total: "R$ 16,7 mil", items: [{ name: "Rafael Lima", product: "Advanced", value: "R$ 3.200" }, { name: "Clínica Essenza", product: "Treinamento", value: "R$ 8.900" }] },
];
export const demoTransactions = [
  { date: "03/10", name: "Ana Carolina", category: "OPEX", type: "Entrada", value: "+ R$ 1.250", status: "Confirmado" },
  { date: "03/10", name: "Google Workspace", category: "Software", type: "Saída", value: "- R$ 890", status: "Pago" },
  { date: "02/10", name: "Empresa Horizonte", category: "Treinamento", type: "Entrada", value: "+ R$ 6.250", status: "Confirmado" },
  { date: "02/10", name: "Comissão Amanda", category: "Comissão", type: "Saída", value: "- R$ 780", status: "Pago" },
  { date: "01/10", name: "Mariana Costa", category: "Mentoria", type: "Entrada", value: "+ R$ 1.200", status: "Confirmado" },
];

export const demoDueItems = [
  { label: "Comissão Rafael", date: "Hoje", value: "R$ 780", kind: "Pagar" },
  { label: "Parcela Mariana Costa", date: "Hoje", value: "R$ 1.250", kind: "Receber" },
  { label: "Aluguel", date: "05/10", value: "R$ 4.200", kind: "Pagar" },
  { label: "Empresa Horizonte", date: "06/10", value: "R$ 6.250", kind: "Receber" },
];

export const demoAccounts = [
  { name: "Sicoob", value: "R$ 71.450", delta: "+ R$ 8.300" },
  { name: "Itaú", value: "R$ 48.200", delta: "+ R$ 2.190" },
  { name: "Caixa", value: "R$ 8.800", delta: "- R$ 890" },
];

export const demoProducts = [
  { name: "OPEX", type: "Programa", price: "R$ 4.970", sales: 18, revenue: "R$ 68,4 mil", active: true },
  { name: "Mentoria Excellence", type: "Mentoria", price: "R$ 7.200", sales: 7, revenue: "R$ 39,6 mil", active: true },
  { name: "Advanced", type: "Treinamento", price: "R$ 3.200", sales: 11, revenue: "R$ 28,8 mil", active: true },
  { name: "Comunidade", type: "Comunidade", price: "R$ 1.997", sales: 23, revenue: "R$ 31,1 mil", active: true },
];
export const demoClasses = [
  { name: "OPEX Maringá · Outubro", product: "OPEX", date: "10–11 out", students: 38, capacity: 50, progress: 76, status: "Em preparação", revenue: "R$ 94,3 mil" },
  { name: "Advanced · Turma 08", product: "Advanced", date: "18 out", students: 26, capacity: 35, progress: 63, status: "Inscrições abertas", revenue: "R$ 52,8 mil" },
  { name: "Mentoria · Ciclo 04", product: "Mentoria", date: "Toda terça", students: 14, capacity: 16, progress: 42, status: "Em andamento", revenue: "R$ 86,4 mil" },
];

export const demoEvents = [
  { day: "04", month: "OUT", name: "Café com Propósito", time: "09:00", place: "Maringá", registrations: 70, checklist: 92, status: "Pronto" },
  { day: "09", month: "OUT", name: "Workshop Eleva-te", time: "18:00", place: "Baln. Piçarras", registrations: 96, checklist: 72, status: "Em preparação" },
  { day: "12", month: "OUT", name: "OPEX Experience", time: "08:00", place: "Maringá", registrations: 58, checklist: 64, status: "Em preparação" },
  { day: "24", month: "OUT", name: "Decifre e Influencie Pessoas", time: "17:30", place: "Grupo Excellence", registrations: 41, checklist: 48, status: "Planejado" },
];

export const demoAgents = [
  { name: "Júlia", role: "Gerente Comercial", status: "Ativa", conversations: 142, conversion: "26,4%", handoffs: 7, cost: "R$ 18,72" },
  { name: "OPEX", role: "Especialista de produto", status: "Ativo", conversations: 61, conversion: "31,1%", handoffs: 3, cost: "R$ 7,44" },
  { name: "Financeiro", role: "Cobrança e pagamentos", status: "Ativo", conversations: 38, conversion: "—", handoffs: 5, cost: "R$ 4,18" },
  { name: "Pós-venda", role: "Sucesso do cliente", status: "Pausado", conversations: 19, conversion: "—", handoffs: 1, cost: "R$ 1,92" },
];

export const demoTasks = [
  { stage: "A fazer", items: ["Enviar proposta Clínica Essenza", "Revisar roteiro OPEX", "Confirmar fornecedores"] },
  { stage: "Em andamento", items: ["Configurar automação de follow-up", "Fechar relatório setembro"] },
  { stage: "Aguardando", items: ["Aprovação Empresa Horizonte", "Retorno gráfica"] },
  { stage: "Concluído", items: ["Lista de presença OPEX", "Pagamento comissão Amanda"] },
];
