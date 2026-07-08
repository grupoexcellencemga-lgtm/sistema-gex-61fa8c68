# Integração Google Agenda ao vivo (OAuth / API)

Objetivo: trocar o espelho por **link iCal** (atraso + cores manuais) pela **API do Google Calendar**, que dá:

- ⚡ Atualização **ao vivo** (sem esperar o Google republicar o iCal).
- 🎨 **Cores automáticas sempre**, inclusive categorias novas (vêm no `colorId`).
- 📅 Opção de espelhar **todas as agendas** (ROSELI, MÉRCIA, ANA GABRIELA, COMERCIAL, MARKETING, OPEX Turma 21, ADVANCED 2, LUME), cada uma com sua cor.

> ⚠️ **Segurança:** os valores gerados abaixo (Client Secret e Refresh Token) são sigilosos.
> **Não cole no chat.** Cole diretamente nos *Secrets* do Supabase (passo 4). Trate-os como senha.

---

## Passo 1 — Criar projeto e ativar a API (Google Cloud Console)

1. Acesse https://console.cloud.google.com/ (logado com **grupoexcellencemga@gmail.com**).
2. No topo, crie um projeto novo: **"Sistema GEx"** → Criar.
3. Menu → **APIs e serviços → Biblioteca** → procure **"Google Calendar API"** → **Ativar**.

## Passo 2 — Tela de consentimento OAuth

1. **APIs e serviços → Tela de permissão OAuth**.
2. Tipo de usuário: **Externo** → Criar.
3. Preencha só o obrigatório: nome do app ("Sistema GEx"), e-mail de suporte e de contato = o seu.
4. **Escopos**: pode pular (Salvar e continuar).
5. **Usuários de teste**: adicione o seu e-mail. Salvar.
6. **IMPORTANTE:** volte na Tela de permissão e clique em **"Publicar app" → Confirmar**
   (deixar em "Teste" faz o acesso **expirar a cada 7 dias**; publicado, não expira).
   Se aparecer aviso de "app não verificado", tudo bem — é seu app, só seu uso.

## Passo 3 — Criar as credenciais OAuth

1. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
2. Tipo de aplicativo: **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, adicione exatamente:
   `https://developers.google.com/oauthplayground`
4. Criar. Anote o **Client ID** e o **Client Secret** (vamos usar já).

## Passo 4 — Gerar o Refresh Token (OAuth Playground)

1. Acesse https://developers.google.com/oauthplayground/
2. Clique na **engrenagem** (canto superior direito) → marque **"Use your own OAuth credentials"**
   → cole o **Client ID** e **Client Secret** do passo 3 → feche.
3. Na coluna esquerda (Step 1), no campo "Input your own scopes", cole:
   `https://www.googleapis.com/auth/calendar.readonly`
   → **Authorize APIs**.
4. Faça login com **grupoexcellencemga@gmail.com** e conceda o acesso (clique em avançar/permitir
   nos avisos de app não verificado).
5. De volta ao Playground (Step 2), clique **"Exchange authorization code for tokens"**.
6. Copie o **Refresh token** que aparecer (começa com `1//...`).

## Passo 5 — Colocar os 3 segredos no Supabase

No painel do Supabase (projeto **Sistema GEx ATT**) → **Edge Functions → Secrets** (ou
Project Settings → Edge Functions), crie **exatamente** estes 3 segredos:

| Nome do secret | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID do passo 3 |
| `GOOGLE_CLIENT_SECRET` | Client Secret do passo 3 |
| `GOOGLE_REFRESH_TOKEN` | Refresh token do passo 4 |

## Passo 6 — Me avise "pronto"

Quando os 3 secrets estiverem salvos, eu:
- Escrevo a nova Edge Function `sync-google-api` (usa o refresh token → access token → lê os
  eventos **com cor** de todas as agendas escolhidas).
- Testo de ponta a ponta comparando com o seu Google.
- Troco a rotina (cron) para usar a API. O espelho por iCal fica de backup.

Nada quebra durante o processo — só ligo a nova fonte quando estiver validada.
