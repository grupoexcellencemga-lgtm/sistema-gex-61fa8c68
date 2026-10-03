# Auditoria multiempresa — 03/10/2026

## Estado encontrado

O banco atual já possui `empresa_id` em dezenas de tabelas e RLS habilitado na maior parte da estrutura. Isso é uma boa base, mas **a produção ainda não está pronta para receber empresas externas no mesmo banco**.

A consulta de metadados confirmou RLS ativo nas tabelas centrais com `empresa_id`, incluindo alunos, leads, matrículas, pagamentos, turmas, eventos, CRM e agentes.

## Bloqueios encontrados

Algumas políticas atuais ainda permitem acesso amplo entre usuários autenticados, sem filtrar por empresa. Exemplos confirmados:

- `alunos`: SELECT autenticado com condição `true`.
- `leads`: SELECT autenticado com condição `true`.
- `tarefas`: ALL autenticado com condição `true`.
- `consorcios_leads`: ALL para qualquer usuário autenticado.
- `inscricoes_eventos`, `presencas` e `whatsapp_mensagens`: SELECT autenticado com condição `true`.
- `empresas`: qualquer usuário autenticado pode ler todas as empresas ativas.
## Supabase Security Advisor

O advisor também sinalizou pontos que devem ser tratados antes do SaaS real:

- 18 funções `SECURITY DEFINER` executáveis pelo papel `anon`.
- 34 funções `SECURITY DEFINER` executáveis por usuários autenticados.
- 12 funções com `search_path` mutável.
- proteção contra senhas vazadas desabilitada.
- extensão `pg_trgm` instalada no schema `public`.

Referências de correção:

- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Decisão desta branch

Nenhuma política da produção foi alterada automaticamente. A Demo é isolada e não depende desse banco. O endurecimento de RLS deve virar uma etapa própria, com migrations versionadas e testes explícitos de Empresa A × Empresa B antes de qualquer onboarding SaaS real.
