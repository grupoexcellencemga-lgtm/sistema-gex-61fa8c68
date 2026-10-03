# GEx Demo v2

Versão comercial isolada do GEx para apresentações a empresas.

## Objetivo

- Demonstrar o GEx sem expor dados do Grupo Excellence.
- Mostrar cada módulo com uma experiência visual adequada ao seu trabalho.
- Permitir personalização imediata de nome, logo e cores da empresa.
- Manter a produção atual intacta enquanto o novo produto evolui.

## Isolamento

A rota `/demo` usa dados fictícios definidos em `src/demo/data.ts`.
O bootstrap em `src/main.tsx` carrega `DemoRoot` diretamente quando a URL começa com `/demo`, evitando carregar o App autenticado e o cliente Supabase.

Nenhuma ação da Demo envia WhatsApp, e-mail, PIX, cobrança, webhook ou alteração ao banco real.
## Rotas

- `/demo` — central operacional do dia.
- `/demo/dashboard` — visão analítica do negócio.
- `/demo/clientes` — clientes e perfil 360.
- `/demo/crm` — conversas, oportunidades, agentes e desempenho.
- `/demo/produtos` — catálogo comercial.
- `/demo/agenda` — calendário unificado.
- `/demo/tarefas` — gestão de execução.
- `/demo/financeiro` — caixa e movimentações.
- `/demo/ia` — agentes, fluxos e consumo.
- `/demo/turmas` — hub de turmas.
- `/demo/eventos` — calendário e operação de eventos.
- `/demo/relatorios` — visão de BI.
- `/demo/configuracoes` — identidade e white label.

## Verificação

```bash
npm run verify:demo
```

A verificação da Demo executa lint específico, testes específicos e build de produção.
