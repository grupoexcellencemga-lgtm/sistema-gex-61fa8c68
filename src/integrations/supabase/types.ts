export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          cidade: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          id: string
          nome: string
          sexo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome: string
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      atividades: {
        Row: {
          aluno_id: string | null
          autor_id: string | null
          created_at: string
          descricao: string
          id: string
          lead_id: string | null
          tipo: string
        }
        Insert: {
          aluno_id?: string | null
          autor_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          lead_id?: string | null
          tipo: string
        }
        Update: {
          aluno_id?: string | null
          autor_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          lead_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          registro_id: string | null
          registro_nome: string | null
          tabela: string
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id?: string | null
          registro_nome?: string | null
          tabela: string
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          registro_id?: string | null
          registro_nome?: string | null
          tabela?: string
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: []
      }
      categorias_despesas: {
        Row: {
          ativo: boolean | null
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      checklist_template_items: {
        Row: {
          ancora: string
          area: string
          deleted_at: string | null
          fase: string
          id: string
          nome_tarefa: string
          obrigatoria: boolean
          offset_unidade: string
          offset_valor: number
          prioridade: string
          template_id: string
        }
        Insert: {
          ancora?: string
          area?: string
          deleted_at?: string | null
          fase?: string
          id?: string
          nome_tarefa: string
          obrigatoria?: boolean
          offset_unidade?: string
          offset_valor?: number
          prioridade?: string
          template_id: string
        }
        Update: {
          ancora?: string
          area?: string
          deleted_at?: string | null
          fase?: string
          id?: string
          nome_tarefa?: string
          obrigatoria?: boolean
          offset_unidade?: string
          offset_valor?: number
          prioridade?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          ativo: boolean
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          tipo_evento: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          tipo_evento: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          tipo_evento?: string
          versao?: number
        }
        Relationships: []
      }
      comerciais: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          chave_pix: string | null
          chave_pix_tipo: string | null
          cnpj: string | null
          conta: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          tipo_vinculo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          chave_pix?: string | null
          chave_pix_tipo?: string | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          chave_pix?: string | null
          chave_pix_tipo?: string | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          aluno_id: string
          comercial_id: string
          conta_bancaria_id: string | null
          created_at: string
          data_pagamento: string | null
          deleted_at: string | null
          despesa_id: string | null
          forma_pagamento: string | null
          id: string
          matricula_id: string
          observacoes: string | null
          percentual: number
          produto_id: string | null
          status: string
          turma_id: string | null
          updated_at: string
          valor_comissao: number
          valor_matricula: number
          valor_pago: number
        }
        Insert: {
          aluno_id: string
          comercial_id: string
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          deleted_at?: string | null
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          matricula_id: string
          observacoes?: string | null
          percentual?: number
          produto_id?: string | null
          status?: string
          turma_id?: string | null
          updated_at?: string
          valor_comissao?: number
          valor_matricula?: number
          valor_pago?: number
        }
        Update: {
          aluno_id?: string
          comercial_id?: string
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          deleted_at?: string | null
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          matricula_id?: string
          observacoes?: string | null
          percentual?: number
          produto_id?: string | null
          status?: string
          turma_id?: string | null
          updated_at?: string
          valor_comissao?: number
          valor_matricula?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_comercial_id_fkey"
            columns: ["comercial_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_usuario: {
        Row: {
          created_at: string
          dados_empresa: Json | null
          id: string
          notif_aniversarios: boolean
          notif_leads_inativos: boolean
          notif_novo_cadastro: boolean
          notif_pagamento_vencido: boolean
          notif_sessoes: boolean
          tema: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados_empresa?: Json | null
          id?: string
          notif_aniversarios?: boolean
          notif_leads_inativos?: boolean
          notif_novo_cadastro?: boolean
          notif_pagamento_vencido?: boolean
          notif_sessoes?: boolean
          tema?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados_empresa?: Json | null
          id?: string
          notif_aniversarios?: boolean
          notif_leads_inativos?: boolean
          notif_novo_cadastro?: boolean
          notif_pagamento_vencido?: boolean
          notif_sessoes?: boolean
          tema?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contas_a_pagar: {
        Row: {
          categoria: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          deleted_at: string | null
          descricao: string
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          observacoes: string | null
          recorrente: boolean
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          deleted_at?: string | null
          descricao: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          recorrente?: boolean
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          deleted_at?: string | null
          descricao?: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          recorrente?: boolean
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_a_pagar_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          numero_conta: string | null
          saldo_inicial: number
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          numero_conta?: string | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          numero_conta?: string | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          categoria_id: string | null
          comprovante_url: string | null
          comprovantes_urls: Json
          conta_bancaria_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          evento_id: string | null
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          nota_nome: string | null
          nota_url: string | null
          observacoes: string | null
          produto_id: string | null
          recorrente: boolean
          turma_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao: string
          evento_id?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          nota_nome?: string | null
          nota_url?: string | null
          observacoes?: string | null
          produto_id?: string | null
          recorrente?: boolean
          turma_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          evento_id?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          nota_nome?: string | null
          nota_url?: string | null
          observacoes?: string | null
          produto_id?: string | null
          recorrente?: boolean
          turma_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgacao_colunas: {
        Row: {
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
          quadro_id: string | null
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          quadro_id?: string | null
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          quadro_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgacao_colunas_quadro_id_fkey"
            columns: ["quadro_id"]
            isOneToOne: false
            referencedRelation: "divulgacao_quadros"
            referencedColumns: ["id"]
          },
        ]
      }
      divulgacao_quadros: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      divulgacoes: {
        Row: {
          arquivo_nome: string | null
          arquivo_tipo: string | null
          arquivo_url: string | null
          arquivos: Json
          ativo: boolean
          categoria: string
          coluna_id: string | null
          created_at: string
          data: string | null
          descricao: string | null
          id: string
          imagem_url: string | null
          link_url: string | null
          link_urls: Json
          links: Json
          ordem: number
          quadro_id: string | null
          responsavel_iniciais: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          arquivos?: Json
          ativo?: boolean
          categoria: string
          coluna_id?: string | null
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          link_urls?: Json
          links?: Json
          ordem?: number
          quadro_id?: string | null
          responsavel_iniciais?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tipo?: string | null
          arquivo_url?: string | null
          arquivos?: Json
          ativo?: boolean
          categoria?: string
          coluna_id?: string | null
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          link_url?: string | null
          link_urls?: Json
          links?: Json
          ordem?: number
          quadro_id?: string | null
          responsavel_iniciais?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgacoes_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "divulgacao_colunas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divulgacoes_quadro_id_fkey"
            columns: ["quadro_id"]
            isOneToOne: false
            referencedRelation: "divulgacao_quadros"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          assunto: string
          ativo: boolean
          categoria: string
          corpo_html: string
          created_at: string
          id: string
          nome: string
          updated_at: string
          variaveis: string[] | null
        }
        Insert: {
          assunto: string
          ativo?: boolean
          categoria?: string
          corpo_html: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Update: {
          assunto?: string
          ativo?: boolean
          categoria?: string
          corpo_html?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Relationships: []
      }
      emails_enviados: {
        Row: {
          assunto: string
          created_at: string
          destinatario: string
          erro: string | null
          id: string
          metadata: Json | null
          status: string
          template_id: string | null
        }
        Insert: {
          assunto: string
          created_at?: string
          destinatario: string
          erro?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          template_id?: string | null
        }
        Update: {
          assunto?: string
          created_at?: string
          destinatario?: string
          erro?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_enviados_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      encontros: {
        Row: {
          created_at: string
          data: string | null
          descricao: string | null
          id: string
          sessao_numero: number
          turma_id: string
        }
        Insert: {
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          sessao_numero: number
          turma_id: string
        }
        Update: {
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          sessao_numero?: number
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encontros_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_materiais: {
        Row: {
          created_at: string
          deleted_at: string | null
          evento_id: string
          id: string
          nome: string
          quantidade: number
          separado: boolean
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          evento_id: string
          id?: string
          nome: string
          quantidade?: number
          separado?: boolean
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          evento_id?: string
          id?: string
          nome?: string
          quantidade?: number
          separado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evento_materiais_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_status_history: {
        Row: {
          alterado_por: string | null
          created_at: string
          evento_id: string
          id: string
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string
          evento_id: string
          id?: string
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string
          evento_id?: string
          id?: string
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_status_history_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          checklist_template_id: string | null
          checklist_template_versao: number | null
          comunidade: boolean
          created_at: string
          data: string | null
          deleted_at: string | null
          descricao: string | null
          id: string
          limite_participantes: number | null
          local: string | null
          nome: string
          pago: boolean
          produto_id: string | null
          responsavel: string | null
          status: string
          tipo: string | null
          turma_id: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          comunidade?: boolean
          created_at?: string
          data?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          limite_participantes?: number | null
          local?: string | null
          nome: string
          pago?: boolean
          produto_id?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string | null
          turma_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          comunidade?: boolean
          created_at?: string
          data?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          limite_participantes?: number | null
          local?: string | null
          nome?: string
          pago?: boolean
          produto_id?: string | null
          responsavel?: string | null
          status?: string
          tipo?: string | null
          turma_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_mensais: {
        Row: {
          ano: number
          conta_bancaria_id: string
          created_at: string
          id: string
          mes: number
          saldo_fechamento: number
        }
        Insert: {
          ano: number
          conta_bancaria_id: string
          created_at?: string
          id?: string
          mes: number
          saldo_fechamento?: number
        }
        Update: {
          ano?: number
          conta_bancaria_id?: string
          created_at?: string
          id?: string
          mes?: number
          saldo_fechamento?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_mensais_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          abre_parcelas: boolean | null
          abre_taxa: boolean | null
          ativo: boolean | null
          codigo: string
          created_at: string | null
          deleted_at: string | null
          id: string
          nome: string
          ordem: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          abre_parcelas?: boolean | null
          abre_taxa?: boolean | null
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          abre_parcelas?: boolean | null
          abre_taxa?: boolean | null
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      funil_etapas: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_agenda_config: {
        Row: {
          ativo: boolean
          ical_url: string | null
          id: string
          ultima_sync: string | null
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          ical_url?: string | null
          id?: string
          ultima_sync?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          ical_url?: string | null
          id?: string
          ultima_sync?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      google_agenda_cores: {
        Row: {
          chave: string
          cor: string
          updated_at: string | null
        }
        Insert: {
          chave: string
          cor: string
          updated_at?: string | null
        }
        Update: {
          chave?: string
          cor?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      google_agenda_eventos: {
        Row: {
          atualizado_em: string
          cor: string | null
          data: string
          data_fim: string | null
          dia_inteiro: boolean
          hora: string | null
          id: string
          titulo: string
          uid: string | null
        }
        Insert: {
          atualizado_em?: string
          cor?: string | null
          data: string
          data_fim?: string | null
          dia_inteiro?: boolean
          hora?: string | null
          id?: string
          titulo: string
          uid?: string | null
        }
        Update: {
          atualizado_em?: string
          cor?: string | null
          data?: string
          data_fim?: string | null
          dia_inteiro?: boolean
          hora?: string | null
          id?: string
          titulo?: string
          uid?: string | null
        }
        Relationships: []
      }
      inscricoes_eventos: {
        Row: {
          aluno_id: string
          created_at: string
          evento_id: string
          id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          evento_id: string
          id?: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          evento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_eventos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cidade: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          etapa_id: string
          id: string
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          produto_interesse: string | null
          responsavel_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          etapa_id: string
          id?: string
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          produto_interesse?: string | null
          responsavel_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          etapa_id?: string
          id?: string
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          produto_interesse?: string | null
          responsavel_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "funil_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          comercial_id: string | null
          comprovante_url: string | null
          comprovantes_urls: Json
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          desconto: number | null
          id: string
          observacoes: string | null
          percentual_comissao: number | null
          produto_id: string | null
          status: string
          turma_id: string | null
          updated_at: string
          valor_final: number | null
          valor_total: number | null
        }
        Insert: {
          aluno_id: string
          comercial_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          desconto?: number | null
          id?: string
          observacoes?: string | null
          percentual_comissao?: number | null
          produto_id?: string | null
          status?: string
          turma_id?: string | null
          updated_at?: string
          valor_final?: number | null
          valor_total?: number | null
        }
        Update: {
          aluno_id?: string
          comercial_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          desconto?: number | null
          id?: string
          observacoes?: string | null
          percentual_comissao?: number | null
          produto_id?: string | null
          status?: string
          turma_id?: string | null
          updated_at?: string
          valor_final?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_comercial_id_fkey"
            columns: ["comercial_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          created_at: string
          deleted_at: string | null
          descricao: string | null
          id: string
          periodo_fim: string
          periodo_inicio: string
          responsavel_id: string | null
          responsavel_tipo: string | null
          tipo: string
          titulo: string
          updated_at: string
          valor_atual: number
          valor_meta: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          periodo_fim: string
          periodo_inicio: string
          responsavel_id?: string | null
          responsavel_tipo?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          valor_atual?: number
          valor_meta: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          responsavel_id?: string | null
          responsavel_tipo?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          valor_atual?: number
          valor_meta?: number
        }
        Relationships: []
      }
      mindmaps: {
        Row: {
          created_at: string
          deleted_at: string | null
          edges: Json
          id: string
          nodes: Json
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          edges?: Json
          id?: string
          nodes?: Json
          nome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          edges?: Json
          id?: string
          nodes?: Json
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      movimentacoes_contas: {
        Row: {
          conta_bancaria_id: string | null
          conta_origem_id: string
          conta_origem_tipo: string
          created_at: string
          data: string
          deleted_at: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          conta_origem_id: string
          conta_origem_tipo: string
          created_at?: string
          data?: string
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          conta_bancaria_id?: string | null
          conta_origem_id?: string
          conta_origem_tipo?: string
          created_at?: string
          data?: string
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_contas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          aluno_id: string
          conta_bancaria_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          deleted_at: string | null
          forma_pagamento: string | null
          id: string
          juros: number | null
          matricula_id: string | null
          multa: number | null
          parcela_atual: number | null
          parcelas: number | null
          parcelas_cartao: number | null
          produto_id: string | null
          status: string
          taxa_cartao: number | null
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          aluno_id: string
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          matricula_id?: string | null
          multa?: number | null
          parcela_atual?: number | null
          parcelas?: number | null
          parcelas_cartao?: number | null
          produto_id?: string | null
          status?: string
          taxa_cartao?: number | null
          updated_at?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          aluno_id?: string
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          matricula_id?: string | null
          multa?: number | null
          parcela_atual?: number | null
          parcelas?: number | null
          parcelas_cartao?: number | null
          produto_id?: string | null
          status?: string
          taxa_cartao?: number | null
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_processo: {
        Row: {
          conta_bancaria_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          processo_id: string
          taxa_cartao: number | null
          tipo: string
          valor: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          processo_id: string
          taxa_cartao?: number | null
          tipo?: string
          valor?: number
        }
        Update: {
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          processo_id?: string
          taxa_cartao?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_processo_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_processo_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_individuais"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_processo_empresarial: {
        Row: {
          conta_bancaria_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          processo_id: string
          taxa_cartao: number | null
          tipo: string
          valor: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          processo_id: string
          taxa_cartao?: number | null
          tipo?: string
          valor?: number
        }
        Update: {
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          processo_id?: string
          taxa_cartao?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_processo_empresarial_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_processo_empresarial_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_empresariais"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_profissional: {
        Row: {
          conta_bancaria_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          despesa_id: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          processo_id: string
          profissional_id: string
          valor: number
        }
        Insert: {
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          processo_id: string
          profissional_id: string
          valor?: number
        }
        Update: {
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          processo_id?: string
          profissional_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_profissional_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_profissional_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_profissional_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_individuais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_profissional_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes_eventos: {
        Row: {
          adicionado_por_nome: string | null
          adicionado_por_user_id: string | null
          comprovante_url: string | null
          comprovantes_urls: Json
          conta_bancaria_id: string | null
          convidado_por: string | null
          created_at: string
          data_pagamento: string | null
          email: string | null
          evento_id: string
          forma_pagamento: string | null
          id: string
          nome: string
          observacoes: string | null
          presenca: boolean
          presenca_marcada_em: string | null
          presenca_marcada_por: string | null
          status_pagamento: string
          telefone: string | null
          tipo_participante: string | null
          valor: number | null
        }
        Insert: {
          adicionado_por_nome?: string | null
          adicionado_por_user_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          conta_bancaria_id?: string | null
          convidado_por?: string | null
          created_at?: string
          data_pagamento?: string | null
          email?: string | null
          evento_id: string
          forma_pagamento?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          presenca?: boolean
          presenca_marcada_em?: string | null
          presenca_marcada_por?: string | null
          status_pagamento?: string
          telefone?: string | null
          tipo_participante?: string | null
          valor?: number | null
        }
        Update: {
          adicionado_por_nome?: string | null
          adicionado_por_user_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          conta_bancaria_id?: string | null
          convidado_por?: string | null
          created_at?: string
          data_pagamento?: string | null
          email?: string | null
          evento_id?: string
          forma_pagamento?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          presenca?: boolean
          presenca_marcada_em?: string | null
          presenca_marcada_por?: string | null
          status_pagamento?: string
          telefone?: string | null
          tipo_participante?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participantes_eventos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          aluno_id: string
          created_at: string
          encontro_id: string
          id: string
          observacoes: string | null
          status: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          encontro_id: string
          id?: string
          observacoes?: string | null
          status?: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          encontro_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: false
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_empresariais: {
        Row: {
          aluno_id: string | null
          cnpj: string | null
          comercial_id: string | null
          conta_bancaria_id: string | null
          contato_nome: string | null
          created_at: string
          data_fim: string | null
          data_finalizacao: string | null
          data_inicio: string | null
          deleted_at: string | null
          empresa_email: string | null
          empresa_nome: string
          empresa_telefone: string | null
          forma_pagamento: string | null
          id: string
          motivo_cancelamento: string | null
          observacoes: string | null
          parcelas: number
          percentual_comissao: number | null
          percentual_empresa: number
          percentual_profissional: number
          profissional_id: string | null
          proposta_url: string | null
          responsavel: string
          sessoes: number | null
          sessoes_realizadas: number
          status: string
          updated_at: string
          valor_entrada: number | null
          valor_total: number
        }
        Insert: {
          aluno_id?: string | null
          cnpj?: string | null
          comercial_id?: string | null
          conta_bancaria_id?: string | null
          contato_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_finalizacao?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          empresa_email?: string | null
          empresa_nome: string
          empresa_telefone?: string | null
          forma_pagamento?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcelas?: number
          percentual_comissao?: number | null
          percentual_empresa?: number
          percentual_profissional?: number
          profissional_id?: string | null
          proposta_url?: string | null
          responsavel: string
          sessoes?: number | null
          sessoes_realizadas?: number
          status?: string
          updated_at?: string
          valor_entrada?: number | null
          valor_total?: number
        }
        Update: {
          aluno_id?: string | null
          cnpj?: string | null
          comercial_id?: string | null
          conta_bancaria_id?: string | null
          contato_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_finalizacao?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          empresa_email?: string | null
          empresa_nome?: string
          empresa_telefone?: string | null
          forma_pagamento?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcelas?: number
          percentual_comissao?: number | null
          percentual_empresa?: number
          percentual_profissional?: number
          profissional_id?: string | null
          proposta_url?: string | null
          responsavel?: string
          sessoes?: number | null
          sessoes_realizadas?: number
          status?: string
          updated_at?: string
          valor_entrada?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "processos_empresariais_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_empresariais_comercial_id_fkey"
            columns: ["comercial_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_empresariais_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_empresariais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_individuais: {
        Row: {
          aluno_id: string | null
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string | null
          comercial_id: string | null
          conta_bancaria_id: string | null
          cpf: string | null
          created_at: string
          data_fim: string | null
          data_finalizacao: string | null
          data_inicio: string | null
          data_nascimento: string | null
          deleted_at: string | null
          forma_pagamento: string | null
          id: string
          motivo_cancelamento: string | null
          observacoes: string | null
          parcelas: number
          percentual_comissao: number | null
          percentual_empresa: number
          percentual_profissional: number
          profissional_id: string | null
          responsavel: string
          sessoes: number | null
          sessoes_realizadas: number
          status: string
          updated_at: string
          valor_entrada: number | null
          valor_total: number
        }
        Insert: {
          aluno_id?: string | null
          cliente_email?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          comercial_id?: string | null
          conta_bancaria_id?: string | null
          cpf?: string | null
          created_at?: string
          data_fim?: string | null
          data_finalizacao?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcelas?: number
          percentual_comissao?: number | null
          percentual_empresa?: number
          percentual_profissional?: number
          profissional_id?: string | null
          responsavel: string
          sessoes?: number | null
          sessoes_realizadas?: number
          status?: string
          updated_at?: string
          valor_entrada?: number | null
          valor_total?: number
        }
        Update: {
          aluno_id?: string | null
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          comercial_id?: string | null
          conta_bancaria_id?: string | null
          cpf?: string | null
          created_at?: string
          data_fim?: string | null
          data_finalizacao?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          forma_pagamento?: string | null
          id?: string
          motivo_cancelamento?: string | null
          observacoes?: string | null
          parcelas?: number
          percentual_comissao?: number | null
          percentual_empresa?: number
          percentual_profissional?: number
          profissional_id?: string | null
          responsavel?: string
          sessoes?: number | null
          sessoes_realizadas?: number
          status?: string
          updated_at?: string
          valor_entrada?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "processos_individuais_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_individuais_comercial_id_fkey"
            columns: ["comercial_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_individuais_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_individuais_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          created_at: string
          deleted_at: string | null
          descricao: string | null
          duracao: string | null
          id: string
          nome: string
          parcelas_cartao: number | null
          responsavel: string | null
          tipo: string
          updated_at: string
          valor: number | null
          valor_parcela: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          duracao?: string | null
          id?: string
          nome: string
          parcelas_cartao?: number | null
          responsavel?: string | null
          tipo: string
          updated_at?: string
          valor?: number | null
          valor_parcela?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          duracao?: string | null
          id?: string
          nome?: string
          parcelas_cartao?: number | null
          responsavel?: string | null
          tipo?: string
          updated_at?: string
          valor?: number | null
          valor_parcela?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          comercial_id: string | null
          created_at: string
          email: string
          id: string
          nome: string
          profissional_id: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comercial_id?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          profissional_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comercial_id?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          profissional_id?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_comercial_id_fkey"
            columns: ["comercial_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      profissionais: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          chave_pix: string | null
          chave_pix_tipo: string | null
          cnpj: string | null
          conta: string | null
          cpf: string | null
          created_at: string
          data_entrada: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          especialidade: string | null
          id: string
          nome: string
          telefone: string | null
          tipo_vinculo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          chave_pix?: string | null
          chave_pix_tipo?: string | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_entrada?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          chave_pix?: string | null
          chave_pix_tipo?: string | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          data_entrada?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
        }
        Relationships: []
      }
      receitas_avulsas: {
        Row: {
          categoria: string | null
          conta_bancaria_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_avulsas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      reembolsos: {
        Row: {
          categoria_id: string | null
          comprovante_url: string | null
          comprovantes_urls: Json
          conta_bancaria_id: string | null
          created_at: string
          data_despesa: string
          data_reembolso: string | null
          deleted_at: string | null
          descricao: string
          despesa_id: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          pessoa_id: string | null
          pessoa_nome: string
          pessoa_tipo: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          conta_bancaria_id?: string | null
          created_at?: string
          data_despesa?: string
          data_reembolso?: string | null
          deleted_at?: string | null
          descricao: string
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          pessoa_id?: string | null
          pessoa_nome: string
          pessoa_tipo?: string
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          comprovante_url?: string | null
          comprovantes_urls?: Json
          conta_bancaria_id?: string | null
          created_at?: string
          data_despesa?: string
          data_reembolso?: string | null
          deleted_at?: string | null
          descricao?: string
          despesa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          pessoa_id?: string | null
          pessoa_nome?: string
          pessoa_tipo?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "reembolsos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reembolsos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reembolsos_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_processo: {
        Row: {
          created_at: string | null
          data_hora: string
          deleted_at: string | null
          duracao_minutos: number | null
          id: string
          link_online: string | null
          local: string | null
          numero_sessao: number | null
          observacoes: string | null
          observacoes_pos: string | null
          processo_id: string
          processo_tipo: string
          profissional_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_hora: string
          deleted_at?: string | null
          duracao_minutos?: number | null
          id?: string
          link_online?: string | null
          local?: string | null
          numero_sessao?: number | null
          observacoes?: string | null
          observacoes_pos?: string | null
          processo_id: string
          processo_tipo: string
          profissional_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_hora?: string
          deleted_at?: string | null
          duracao_minutos?: number | null
          id?: string
          link_online?: string | null
          local?: string | null
          numero_sessao?: number | null
          observacoes?: string | null
          observacoes_pos?: string | null
          processo_id?: string
          processo_tipo?: string
          profissional_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_processo_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          aluno_id: string | null
          area: string | null
          checklist_item_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          data_vencimento: string | null
          descricao: string | null
          encontro_id: string | null
          evento_id: string | null
          fase_evento: string | null
          hora: string | null
          id: string
          lead_id: string | null
          origem_tarefa: string
          prioridade: string
          processo_id: string | null
          recorrencia: string
          responsavel_id: string
          status: string
          tipo: string
          titulo: string
          turma_id: string | null
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          area?: string | null
          checklist_item_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          encontro_id?: string | null
          evento_id?: string | null
          fase_evento?: string | null
          hora?: string | null
          id?: string
          lead_id?: string | null
          origem_tarefa?: string
          prioridade?: string
          processo_id?: string | null
          recorrencia?: string
          responsavel_id: string
          status?: string
          tipo?: string
          titulo: string
          turma_id?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          area?: string | null
          checklist_item_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          encontro_id?: string | null
          evento_id?: string | null
          fase_evento?: string | null
          hora?: string | null
          id?: string
          lead_id?: string | null
          origem_tarefa?: string
          prioridade?: string
          processo_id?: string | null
          recorrencia?: string
          responsavel_id?: string
          status?: string
          tipo?: string
          titulo?: string
          turma_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_encontro_id_fkey"
            columns: ["encontro_id"]
            isOneToOne: false
            referencedRelation: "encontros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas_sistema: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          percentual: number
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          percentual?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          percentual?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      transferencias_entre_contas: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string | null
          id: string
          valor: number
        }
        Insert: {
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          valor: number
        }
        Update: {
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_entre_contas_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_entre_contas_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          checklist_template_id: string | null
          checklist_template_versao: number | null
          cidade: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          id: string
          modalidade: string
          nome: string
          produto_id: string | null
          responsavel: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          cidade: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          id?: string
          modalidade: string
          nome: string
          produto_id?: string | null
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          cidade?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          id?: string
          modalidade?: string
          nome?: string
          produto_id?: string | null
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          page_key: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          page_key: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          page_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_mensagens: {
        Row: {
          created_at: string
          entidade_id: string | null
          entidade_nome: string | null
          entidade_tipo: string | null
          erro: string | null
          id: string
          mensagem: string
          status: string
          telefone: string
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entidade_id?: string | null
          entidade_nome?: string | null
          entidade_tipo?: string | null
          erro?: string | null
          id?: string
          mensagem: string
          status?: string
          telefone: string
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entidade_id?: string | null
          entidade_nome?: string | null
          entidade_tipo?: string | null
          erro?: string | null
          id?: string
          mensagem?: string
          status?: string
          telefone?: string
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          categoria: string
          created_at: string
          id: string
          mensagem: string
          nome: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          id?: string
          mensagem: string
          nome: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          mensagem?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atualizar_metas_ativas: { Args: never; Returns: Json }
      can_access_by_comercial: {
        Args: { _comercial_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_by_responsavel: {
        Args: { _responsavel: string; _user_id: string }
        Returns: boolean
      }
      dashboard_metrics: { Args: { _ano: number; _mes: number }; Returns: Json }
      get_user_comercial_id: { Args: { _user_id: string }; Returns: string }
      get_user_profissional_id: { Args: { _user_id: string }; Returns: string }
      get_user_profissional_nome: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_gestor: { Args: { _user_id: string }; Returns: boolean }
      relatorios_data: {
        Args: { _data_fim?: string; _data_inicio?: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "admin"
        | "comercial"
        | "financeiro"
        | "suporte"
        | "profissional"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "comercial", "financeiro", "suporte", "profissional"],
    },
  },
} as const
