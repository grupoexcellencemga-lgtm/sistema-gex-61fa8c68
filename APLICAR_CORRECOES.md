# Status das Correções do Sistema GEx

## ✅ TODAS AS CORREÇÕES JÁ FORAM APLICADAS

As correções abaixo foram aplicadas diretamente no banco de dados e nas Edge Functions do projeto ativo `nsxigkgfvbzhpxrpwvhw` (Sistema GEx ATT).

---

## O que foi corrigido

1. **Aba Divulgação — criação de cards em nova coluna** ✅
   - Criada a tabela `divulgacao_colunas` no banco
   - Adicionadas as colunas `coluna_id`, `arquivo_url`, `arquivo_tipo`, `arquivo_nome` na tabela `divulgacoes`
   - Migration aplicada em 23/04/2026

2. **Desligar/ativar cards nas abas** ✅
   - Adicionado campo `ativo` na tabela `divulgacoes`
   - Botão de olho 👁️ nos cards para ativar/desativar funcionando
   - Cards inativos aparecem em cinza com badge "Inativo"

3. **Senha dos usuários** ✅
   - Edge Function `admin-reset-password` implantada no projeto `nsxigkgfvbzhpxrpwvhw`
   - Edge Function `admin-delete-user` implantada no projeto `nsxigkgfvbzhpxrpwvhw`

4. **Coluna `updated_at` na tabela `divulgacao_colunas`** ✅
   - Adicionada coluna `updated_at` com trigger de auto-atualização

5. **`supabase/config.toml`** ✅
   - Corrigido para apontar para o projeto correto `nsxigkgfvbzhpxrpwvhw`

---

## Para rodar o projeto localmente

```bash
cd "C:\Users\User\OneDrive\Desktop\sistema-gex-61fa8c68-main"
bun run dev
```

## Se precisar reimplantar as Edge Functions

```bash
npx supabase login
npx supabase link --project-ref nsxigkgfvbzhpxrpwvhw
npx supabase functions deploy admin-reset-password --project-ref nsxigkgfvbzhpxrpwvhw
npx supabase functions deploy admin-delete-user --project-ref nsxigkgfvbzhpxrpwvhw
```

---

## Resumo das mudanças de código

| Arquivo | O que mudou |
|---|---|
| `supabase/migrations/20260423000001_fix_divulgacao_sistema.sql` | Migration com tabelas/colunas faltantes |
| `src/integrations/supabase/types.ts` | Tipos para `divulgacao_colunas` e novos campos |
| `src/components/divulgacao/DivulgacaoCard.tsx` | Botão ativar/desativar (ícone de olho) |
| `src/components/divulgacao/DivulgacaoColumn.tsx` | Prop `onToggleAtivo` para os cards |
| `src/pages/Divulgacao.tsx` | Mutation `toggleAtivoMutation` e handler |
| `supabase/config.toml` | ID do projeto corrigido para `nsxigkgfvbzhpxrpwvhw` |
