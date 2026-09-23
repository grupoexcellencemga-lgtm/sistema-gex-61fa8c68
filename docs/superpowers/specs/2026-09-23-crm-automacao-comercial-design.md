# CRM comercial automatizado por produto e turma

## Objetivo

Organizar os funis comerciais por produto e ciclo de venda, movimentar oportunidades automaticamente a partir da conversa conduzida pela IA e chamar a equipe somente quando houver uma situação importante, sem perder protocolos, históricos ou compatibilidade com os funis existentes.

O primeiro uso será o Método OPEX. A mesma estrutura deverá servir depois para Instagram, e-books, eventos, escolas e outros produtos.

## Princípios aprovados

- A pasta representa um produto ou linha comercial, como `OPEX`.
- Cada funil dentro da pasta representa uma turma ou ciclo, como `Turma 23`, `Turma 24` e `Turma 25`.
- Apenas um funil de cada pasta recebe novos interessados por vez.
- O histórico de turmas encerradas permanece intacto.
- A IA realiza tarefas repetitivas; a equipe atua em decisões importantes, exceções e fechamento.
- A etapa comercial e o responsável pelo atendimento são informações independentes.
- Uma resposta da IA também fornece os dados internos usados pelo CRM; a movimentação não faz uma segunda chamada à Anthropic.
- Pedido humano, problema não resolvido, reclamação e falha repetida geram alerta urgente.
- Interesse, escolha de pagamento e acompanhamento normal geram destaque silencioso.

## Organização dos funis

### Pastas

A barra lateral terá pastas de apenas um nível. Cada funil pertence a uma pasta. A navegação oferece:

- busca por nome da pasta ou do funil;
- favoritos como atalhos no topo;
- grupo `Sem pasta` para funis antigos;
- contagem de funis em cada pasta;
- reordenação de pastas, funis e favoritos;
- criação de pasta e funil em ações separadas.

Favoritar não duplica o funil. O favorito referencia o mesmo funil mantido dentro de sua pasta.

### Ciclo das turmas

Cada funil de turma terá um estado:

- `preparacao`: pode ser configurado, mas não recebe leads novos;
- `recebendo_leads`: destino dos novos interessados da pasta;
- `encerrando`: não recebe novos interessados, mas preserva negociações ainda abertas;
- `encerrado`: somente consulta e histórico.

Haverá no máximo um funil `recebendo_leads` por pasta. Ao ativar a Turma 25, a Turma 24 deixa de receber contatos novos. Nenhum card antigo é movido automaticamente.

Quando um contato de uma turma encerrada voltar a demonstrar interesse, o contato e seu histórico permanecem únicos, o card antigo continua na turma anterior e uma nova oportunidade é criada na turma que estiver recebendo leads.

## Etapa comercial e responsabilidade

O Kanban representa somente a evolução comercial. Para OPEX, a configuração inicial será:

1. Entrada
2. Em contato
3. Interesse
4. Pagamento
5. Fechado
6. Perdido

Cada card exibe etiquetas independentes para responsabilidade e contexto, por exemplo:

- `IA conversando`;
- `Aguardando humano`;
- `Ana atendendo`;
- `Interesse alto`;
- `Pagamento à vista`;
- `Pagamento parcelado`;
- `Problema no pagamento`.

`Aguardando humano` não será uma coluna. O card permanece na etapa comercial correta e recebe destaque urgente.

## Motor de movimentação automática

### Destino por produto

O fluxo de automação será associado a uma pasta comercial. O fluxo iniciado pela palavra-chave OPEX, por exemplo, será associado à pasta OPEX. Quando uma oportunidade precisar ser criada, o sistema encontra o funil `recebendo_leads` dessa pasta.

Essa consulta é uma regra interna do GEx e não usa a Anthropic.

### Classificação na mesma resposta

Quando uma mensagem já precisar ser respondida pela IA, a saída estruturada incluirá os campos internos necessários:

```json
{
  "message": "Texto enviado ao cliente",
  "status": "PROBLEMA_PAGAMENTO",
  "etapa_comercial": "PAGAMENTO",
  "prioridade": "URGENTE",
  "forma_pagamento": "PARCELADO"
}
```

Somente `message` será enviado ao WhatsApp. Os outros campos atualizarão o CRM na mesma execução. Não haverá chamada adicional à IA apenas para mover o card.

Eventos determinísticos, como início do fluxo, envio do link, confirmação de recebimento do comprovante e encerramento da turma, serão tratados diretamente pelo sistema sem IA.

### Mapeamento por pasta

Cada pasta terá um conjunto configurável de regras que converte eventos e classificações em etapas, etiquetas e alertas. Para OPEX:

| Evento ou classificação | Etapa | Etiqueta | Alerta |
|---|---|---|---|
| Início do fluxo OPEX | Entrada | IA conversando | Nenhum |
| Conversa iniciada | Em contato | IA conversando | Nenhum |
| Interesse confirmado | Interesse | Interesse alto | Silencioso |
| Pix ou parcelado escolhido | Pagamento | Forma de pagamento | Silencioso |
| Problema de pagamento em tratamento | Pagamento | Problema no pagamento | Silencioso inicialmente |
| Problema não resolvido depois de duas tentativas | Pagamento | Aguardando humano | Urgente |
| Pedido explícito de pessoa | Etapa atual | Aguardando humano | Urgente |
| Comprovante recebido | Pagamento | Comprovante recebido | Urgente para conferência |
| Pagamento conferido por humano ou integração financeira | Fechado | Venda concluída | Nenhum |
| Desistência clara | Perdido | Desistiu | Nenhum |

As regras serão administradas nas configurações da pasta, sem exigir a inclusão repetitiva de um nó de CRM em cada trecho do construtor visual.

## Alertas

### Dois níveis

O destaque silencioso altera o card, a etiqueta e a prioridade visual sem interromper a equipe.

O alerta urgente cria uma solicitação persistente e executa:

1. card destacado em vermelho;
2. som diferente de nova mensagem comum;
3. pop-up com nome, pasta, funil, etapa, motivo e botão `Assumir conversa`;
4. notificação push para a equipe configurada no funil;
5. WhatsApp para o responsável principal se ninguém assumir em cinco minutos;
6. escalação para administrador após mais cinco minutos, totalizando dez minutos sem responsável.

Assumir, resolver ou cancelar a solicitação interrompe as escalações pendentes. Eventos duplicados para o mesmo protocolo e motivo atualizam o alerta existente em vez de criar vários alertas.

### Responsáveis

Cada pasta define:

- equipe que recebe o alerta imediato;
- responsável principal e seu número de WhatsApp;
- administradores de escalação;
- prazo inicial fixo de cinco minutos para o responsável e dez minutos para o administrador.

## Transferência humana

O atendimento terá estados explícitos:

- `ia_ativa`;
- `aguardando_humano`;
- `humano_atendendo`;
- `finalizado`.

Ao pedir uma pessoa, o cliente recebe a confirmação do encaminhamento, o atendimento passa para `aguardando_humano` e o alerta urgente é criado.

Enquanto ninguém tiver assumido, a automação pode reconhecer uma mudança clara de intenção que torne a transferência desnecessária. Quando isso ocorrer, o sistema cancela o alerta, volta para `ia_ativa` e continua no mesmo protocolo.

Depois que uma pessoa clicar em `Assumir`, a IA não responde nem movimenta a conversa automaticamente. Mensagens continuam chegando ao CRM e podem gerar etiquetas informativas para o atendente. A interface oferece `Devolver para IA`, que registra a ação e reativa a automação no ponto permitido pelo fluxo.

## Troca da forma de pagamento

Antes de alguém assumir, o cliente pode alternar entre à vista e parcelado quantas vezes precisar:

1. a IA retorna `ALTERAR_FORMA_PAGAMENTO`;
2. o mesmo protocolo é mantido;
3. o sistema solicita ou reconhece a nova opção;
4. envia somente os dados atuais configurados no fluxo;
5. atualiza a etiqueta do card;
6. volta a aguardar o comprovante.

Se houver solicitação humana pendente e a mudança de pagamento resolver a necessidade, o alerta é cancelado.

Depois que um humano assumir, a IA permanece desligada. A nova mensagem recebe a etiqueta `Quer alterar pagamento`, e a pessoa responsável decide responder diretamente ou devolver a conversa para a IA.

## Dados e compatibilidade

A implementação utilizará estas estruturas:

- tabela `funil_pastas` para produto, ordem, equipe e responsáveis de escalação;
- colunas `pasta_id`, `status_ciclo`, `recebe_novos_leads`, `favorito` e `ordem_na_pasta` em `funil_quadros`;
- coluna `pasta_funil_id` em `fluxos_bot` para associar a automação ao produto;
- tabela `funil_regras_automacao` para mapear evento ou classificação em etapa, etiqueta e prioridade;
- tabela `crm_alertas` para controlar alertas, assunção, resolução e escalações;
- tabela `funil_movimentacoes` para auditoria de mudanças automáticas e manuais.

Uma restrição única parcial em `funil_quadros` garantirá apenas um registro com `recebe_novos_leads = true` por pasta.

Funis atuais iniciarão no grupo `Sem pasta`. Cards, etapas, protocolos e mensagens existentes não serão migrados entre funis. As consultas atuais continuarão aceitando funis sem pasta durante a transição.

As ações automáticas serão idempotentes: receber novamente o mesmo evento não criará dois cards, dois alertas ou duas movimentações iguais.

## Interface

### Barra lateral

- pastas recolhíveis;
- busca global;
- favoritos;
- estados visuais `Preparação`, `Recebendo leads`, `Encerrando` e `Encerrado`;
- menu para mover, ordenar, favoritar, ativar e encerrar um funil.

### Kanban

- etapa comercial como coluna;
- etiquetas de IA, humano, interesse, pagamento e problema;
- indicador do número comercial;
- tempo na etapa;
- destaque urgente persistente;
- filtros por responsável, prioridade e forma de pagamento.

### Atendimento

- pop-up urgente com `Assumir conversa`;
- ação `Devolver para IA`;
- motivo da transferência visível;
- histórico indicando se cada mudança foi feita pela IA, por regra interna ou por usuário.

## Controle de custo

- Reutilizar a chamada que já responde ao cliente para retornar a classificação estruturada.
- Não chamar a IA para localizar a turma ativa, criar cards, mover etapas ou emitir alertas.
- Reduzir o prompt fixo do agente sem remover regras de segurança.
- Usar cache de prompt quando suportado.
- Enviar somente o histórico necessário.
- Registrar tokens e custo estimado por fluxo e pasta.
- Permitir alertas de orçamento mensal sem interromper silenciosamente o atendimento.

## Falhas e segurança operacional

- Sem funil ativo na pasta: manter a conversa, criar alerta administrativo e não enviar o lead a uma turma encerrada.
- Duas turmas ativas por erro concorrente: restrição no banco impede a segunda ativação.
- Classificação ausente ou inválida: manter a etapa atual e encaminhar para revisão humana quando necessário.
- Falha ao mover o card: a resposta ao cliente não é duplicada; o evento interno fica pendente para nova tentativa.
- Falha no push ou WhatsApp de escalação: o alerta permanece visível no CRM e a falha é registrada.
- Humano assumiu durante uma resposta da IA: a verificação final de responsabilidade impede o envio tardio da resposta automática.
- Pagamento informado sem comprovante: nunca concluir a venda automaticamente apenas pela afirmação do cliente.

## Entrega em fases

### Fase 1 — Organização por produto e turma

- pastas, busca, favoritos e grupo `Sem pasta`;
- estados das turmas;
- ativação exclusiva do funil que recebe leads;
- roteamento de novas oportunidades para a turma ativa.

### Fase 2 — Movimentação comercial automática

- associação entre fluxo e pasta;
- saída estruturada comercial na chamada existente;
- regras de etapa e etiquetas por pasta;
- auditoria de mudanças automáticas e manuais.

### Fase 3 — Atendimento humano prioritário

- estados de atendimento;
- alerta silencioso e urgente;
- som, pop-up, push e ação `Assumir`;
- escalação por WhatsApp após cinco minutos;
- ação `Devolver para IA`.

### Fase 4 — Flexibilidade e controle

- retomada antes de alguém assumir;
- alternância entre Pix e parcelado no mesmo protocolo;
- painel de consumo de IA;
- limites e alertas de orçamento.

Cada fase será publicada e validada antes da próxima. A primeira implantação preservará todos os funis e dados existentes.

## Validação

Os testes devem cobrir:

- somente uma turma recebendo leads em cada pasta;
- novo contato OPEX entrando na turma ativa;
- contato antigo criando nova oportunidade sem perder o card anterior;
- classificação estruturada movendo o card sem segunda chamada à IA;
- pedido humano criando um único alerta urgente;
- pop-up, som e push chegando à equipe correta;
- escalação após cinco minutos e cancelamento após `Assumir`;
- mensagem concorrente não permitindo resposta da IA depois que um humano assumir;
- troca repetida entre Pix e parcelado no mesmo protocolo;
- retorno à IA somente antes de alguém assumir ou por ação explícita do atendente;
- funis antigos funcionando no grupo `Sem pasta`;
- falhas de integração preservando mensagens e histórico.

O teste de aceitação do OPEX deve reproduzir uma venda completa: entrada na turma ativa, avanço pelas etapas, escolha e troca de pagamento, problema no link, pedido humano, alerta urgente, assunção pela gestora e encerramento do protocolo.

## Fora do escopo inicial

- pastas dentro de pastas;
- transferência automática de cards antigos ao ativar nova turma;
- confirmação bancária sem integração financeira;
- resposta simultânea de IA e humano;
- automação do site do ChatGPT para substituir uma API oficial;
- criação de uma segunda chamada de IA apenas para classificar ou mover o lead.
