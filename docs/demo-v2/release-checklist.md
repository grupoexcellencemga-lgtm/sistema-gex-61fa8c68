# Checklist de release — GEx Demo v2

Data da validação: 03/10/2026

## Segurança e isolamento

- [x] Worktree separado em `C:\Projetos\sistema-gex-demo`.
- [x] Branch exclusiva `demo-v2`.
- [x] Pasta original e alterações locais da Júlia/OPEX preservadas.
- [x] Dados da Demo 100% fictícios.
- [x] Bootstrap `/demo` separado do App autenticado/Supabase.
- [x] Nenhum envio real de WhatsApp, e-mail, PIX, cobrança ou webhook.
- [x] Botão Restaurar Demo funcional.
- [x] Auditoria de RLS/multiempresa documentada.

## Interface

- [x] Início operacional.
- [x] Dashboard analítico.
- [x] Clientes com perfil 360.
- [x] CRM com Conversas, Oportunidades, Agentes e Desempenho.
- [x] Produtos.
- [x] Agenda.
- [x] Tarefas.
- [x] Financeiro.
- [x] IA e consumo estimado.
- [x] Turmas.
- [x] Eventos.
- [x] Relatórios.
- [x] Configurações/white label.
## Verificações realizadas

- [x] Build base anterior à Demo passou.
- [x] Dívida da base registrada: lint global com 2.184 problemas preexistentes.
- [x] Dívida da base registrada: 5 testes preexistentes falhando em 2 arquivos.
- [x] `lint:demo`: 0 erros, 0 warnings.
- [x] `test:demo`: 3/3 testes passando.
- [x] Build de produção após implementação passou.
- [x] 13/13 rotas verificadas em desktop sem overflow global.
- [x] 13/13 rotas verificadas em 390 px sem overflow global.
- [x] Browser runtime: 0 page errors.
- [x] White label persistiu entre rotas e resetou corretamente.
- [x] Screenshots desktop e mobile salvos em `docs/demo-v2/screenshots`.

## Antes de SaaS real

- [ ] Corrigir isolamento RLS das tabelas apontadas em `multiempresa-audit.md`.
- [ ] Revisar permissões de funções `SECURITY DEFINER` apontadas pelo Security Advisor.
- [ ] Criar testes automatizados Empresa A × Empresa B.
- [ ] Só então conectar clientes externos reais ao banco multiempresa.

Esses itens não bloqueiam a Demo comercial atual, porque ela não usa dados reais nem o banco de produção.
