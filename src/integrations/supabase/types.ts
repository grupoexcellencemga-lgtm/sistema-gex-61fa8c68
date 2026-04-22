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
    PostgrestVersion: "14.4"
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
          created_at: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tipo?: string
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
          conta_bancaria_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          evento_id: string | null
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
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
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao: string
          evento_id?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
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
          conta_bancaria_id?: string | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          evento_id?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
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
      divulgacoes: {
        Row: {
          id: string
          titulo: string
          descricao: string | null
          categoria: string
          status: string
          imagem_url: string | null
          responsavel_iniciais: string | null
          data: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          titulo: string
          descricao?: string | null
          categoria: string
          status?: string
          imagem_url?: string | null
          responsavel_iniciais?: string | null
          data?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          titulo?: string
          descricao?: string | null
          categoria?: string
          status?: string
          imagem_url?: string | null
          responsavel_iniciais?: string | null
          data?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
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
          tipo: string | null
          turma_id: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
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
          tipo?: string | null
          turma_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
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
          etapa: string
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
          etapa?: string
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
          etapa?: string
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
        Relationships: []
      }
      matriculas: {
        Row: {
          aluno_id: string
          comercial_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          desconto: number | null
          id: string
          observacoes: string | null
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
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          desconto?: number | null
          id?: string
          observacoes?: string | null
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
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          desconto?: number | null
          id?: string
          observacoes?: string | null
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
      tarefas: {
        Row: {
          aluno_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          data_vencimento: string | null
          descricao: string | null
          hora: string | null
          id: string
          lead_id: string | null
          prioridade: string
          processo_id: string | null
          recorrencia: string
          responsavel_id: string
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          hora?: string | null
          id?: string
          lead_id?: string | null
          prioridade?: string
          processo_id?: string | null
          recorrencia?: string
          responsavel_id: string
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          hora?: string | null
          id?: string
          lead_id?: string | null
          prioridade?: string
          processo_id?: string | null
          recorrencia?: string
          responsavel_id?: string
          status?: string
          tipo?: string
          titulo?: string
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
            foreignKeyName: "tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      relatorios_data: {
        Args: { _data_fim?: string; _data_inicio?: string }
        Returns: Json
      }
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
