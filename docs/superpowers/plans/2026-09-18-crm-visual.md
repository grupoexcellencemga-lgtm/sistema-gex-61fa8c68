# Organização visual do CRM GEX — Implementation Plan

**Goal:** Implementar a proposta aprovada com Conversas, Oportunidades e Agentes, sem ativar atendimento automático.

**Architecture:** Reutilizar Funil e AgentesBotSection. Separar seleção de canal de seleção de quadro comercial. CrmInbox ganha filas por responsabilidade e ficha lateral recolhível, preservando histórico, protocolos e ações existentes.

**Tech Stack:** React, Tailwind, React Query, Supabase e Vitest.

- [ ] Criar classificação testada das filas de atendimento e responsabilidade.
- [ ] Adicionar navegação principal única; quadros comerciais somente em Oportunidades; seleção de canal em Conversas; configuração existente em Agentes.
- [ ] Implementar filas Precisa de você, IA autorizada, Minhas conversas, Todos e Finalizadas com contagens e responsável explícito.
- [ ] Mostrar ficha lateral recolhível e reforçar pausa ao assumir atendimento; preservar modos atuais dos agentes.
- [ ] Validar testes, compilação, interface publicada e navegação entre as três áreas.

Limite: esta entrega organiza a interface existente; coordenação completa de agentes, campanhas, agenda automática e confirmação de pagamentos continuam no plano de evolução anterior. IA autorizada indica permissão por conversa, sem afirmar execução quando o agente está em sombra.
