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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agenda_item_checks: {
        Row: {
          concluido_em: string | null
          concluido_por: string | null
          data: string
          id: string
          item_id: string
        }
        Insert: {
          concluido_em?: string | null
          concluido_por?: string | null
          data: string
          id?: string
          item_id: string
        }
        Update: {
          concluido_em?: string | null
          concluido_por?: string | null
          data?: string
          id?: string
          item_id?: string
        }
        Relationships: []
      }
      agentes_bot: {
        Row: {
          ativo: boolean
          ativo_24h: boolean
          canais_ids: string[]
          created_at: string
          dias_semana: number[]
          empresa_id: string
          followup_ativo: boolean | null
          followup_intervalo_horas: number | null
          followup_max_tentativas: number | null
          followup_mensagens: string[] | null
          horario_fim: string
          horario_inicio: string
          id: string
          instrucao: string
          max_mensagens_contexto: number
          modelo: string
          modo: string
          nome: string
          tempo_espera_minutos: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          ativo_24h?: boolean
          canais_ids?: string[]
          created_at?: string
          dias_semana?: number[]
          empresa_id: string
          followup_ativo?: boolean | null
          followup_intervalo_horas?: number | null
          followup_max_tentativas?: number | null
          followup_mensagens?: string[] | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          instrucao?: string
          max_mensagens_contexto?: number
          modelo?: string
          modo?: string
          nome: string
          tempo_espera_minutos?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          ativo_24h?: boolean
          canais_ids?: string[]
          created_at?: string
          dias_semana?: number[]
          empresa_id?: string
          followup_ativo?: boolean | null
          followup_intervalo_horas?: number | null
          followup_max_tentativas?: number | null
          followup_mensagens?: string[] | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          instrucao?: string
          max_mensagens_contexto?: number
          modelo?: string
          modo?: string
          nome?: string
          tempo_espera_minutos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agentes_bot_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          asaas_customer_id: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string
          id: string
          nome: string
          sexo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          nome: string
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          sexo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alunos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
      base_conhecimento: {
        Row: {
          agente_id: string | null
          categoria: string | null
          conteudo: string
          created_at: string
          deleted_at: string | null
          embedding: string | null
          empresa_id: string
          id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          agente_id?: string | null
          categoria?: string | null
          conteudo: string
          created_at?: string
          deleted_at?: string | null
          embedding?: string | null
          empresa_id: string
          id?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          agente_id?: string | null
          categoria?: string | null
          conteudo?: string
          created_at?: string
          deleted_at?: string | null
          embedding?: string | null
          empresa_id?: string
          id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimento_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_bot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_conhecimento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      canais_crm: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          empresa_id: string | null
          evolution_instancia: string | null
          evolution_token: string | null
          evolution_url: string | null
          id: string
          identificador: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          evolution_instancia?: string | null
          evolution_token?: string | null
          evolution_url?: string | null
          id?: string
          identificador: string
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          evolution_instancia?: string | null
          evolution_token?: string | null
          evolution_url?: string | null
          id?: string
          identificador?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "canais_crm_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_despesas: {
        Row: {
          ativo: boolean | null
          created_at: string
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chaves_pix: {
        Row: {
          ativo: boolean
          chave: string
          created_at: string
          deleted_at: string | null
          descricao: string
          empresa_id: string
          id: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          created_at?: string
          deleted_at?: string | null
          descricao: string
          empresa_id: string
          id?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaves_pix_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_area_responsaveis: {
        Row: {
          area: string
          responsavel_id: string | null
          updated_at: string
        }
        Insert: {
          area: string
          responsavel_id?: string | null
          updated_at?: string
        }
        Update: {
          area?: string
          responsavel_id?: string | null
          updated_at?: string
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
          empresa_id: string
          id: string
          nome: string
          tipo_evento: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          tipo_evento: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tipo_evento?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
          id?: string
          nome?: string
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comerciais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      consorcios_contratos: {
        Row: {
          comissao_data_pagamento: string | null
          comissao_paga: boolean
          comissao_pct: number
          comissao_valor: number | null
          created_at: string
          data_inicio: string
          deleted_at: string | null
          empresa_id: string
          id: string
          lead_id: string
          observacoes: string | null
          prazo: number
          responsavel_id: string | null
          status: string
          taxa_admin: number
          updated_at: string
          valor_credito: number
          valor_parcela: number
        }
        Insert: {
          comissao_data_pagamento?: string | null
          comissao_paga?: boolean
          comissao_pct?: number
          comissao_valor?: number | null
          created_at?: string
          data_inicio?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          lead_id: string
          observacoes?: string | null
          prazo: number
          responsavel_id?: string | null
          status?: string
          taxa_admin?: number
          updated_at?: string
          valor_credito: number
          valor_parcela: number
        }
        Update: {
          comissao_data_pagamento?: string | null
          comissao_paga?: boolean
          comissao_pct?: number
          comissao_valor?: number | null
          created_at?: string
          data_inicio?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          lead_id?: string
          observacoes?: string | null
          prazo?: number
          responsavel_id?: string | null
          status?: string
          taxa_admin?: number
          updated_at?: string
          valor_credito?: number
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "consorcios_contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcios_contratos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consorcios_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcios_contratos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcios_interacoes: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string
          id: string
          lead_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao: string
          id?: string
          lead_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string
          id?: string
          lead_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consorcios_interacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consorcios_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcios_leads: {
        Row: {
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          empresa_id: string
          etapa: string | null
          etapa_id: string | null
          id: string
          indicado_por: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          prazo: number | null
          responsavel_id: string | null
          segmento: string
          telefone: string | null
          updated_at: string
          valor_credito: number | null
        }
        Insert: {
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          empresa_id: string
          etapa?: string | null
          etapa_id?: string | null
          id?: string
          indicado_por?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          prazo?: number | null
          responsavel_id?: string | null
          segmento?: string
          telefone?: string | null
          updated_at?: string
          valor_credito?: number | null
        }
        Update: {
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string
          etapa?: string | null
          etapa_id?: string | null
          id?: string
          indicado_por?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          prazo?: number | null
          responsavel_id?: string | null
          segmento?: string
          telefone?: string | null
          updated_at?: string
          valor_credito?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consorcios_leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcios_leads_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "funil_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcios_leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "comerciais"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcios_parcelas: {
        Row: {
          contrato_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          empresa_id: string
          forma_pagamento: string | null
          id: string
          lead_id: string
          numero_parcela: number
          observacoes: string | null
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          empresa_id: string
          forma_pagamento?: string | null
          id?: string
          lead_id: string
          numero_parcela: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          empresa_id?: string
          forma_pagamento?: string | null
          id?: string
          lead_id?: string
          numero_parcela?: number
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consorcios_parcelas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "consorcios_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcios_parcelas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcios_parcelas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "consorcios_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_a_pagar: {
        Row: {
          categoria: string | null
          comprovante_url: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          deleted_at: string | null
          descricao: string
          empresa_id: string
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
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          deleted_at?: string | null
          descricao: string
          empresa_id: string
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
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string
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
          {
            foreignKeyName: "contas_a_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
          id?: string
          nome?: string
          numero_conta?: string | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas_ia: {
        Row: {
          agente_id: string | null
          created_at: string
          deleted_at: string | null
          empresa_id: string
          finalizado_em: string | null
          houve_handoff: boolean
          id: string
          iniciado_em: string
          lead_id: string
          motivo_fim: string | null
          protocolo_id: string | null
          resumo: string | null
          score_final: number | null
          score_inicial: number | null
          total_iteracoes: number
          total_mensagens: number
        }
        Insert: {
          agente_id?: string | null
          created_at?: string
          deleted_at?: string | null
          empresa_id: string
          finalizado_em?: string | null
          houve_handoff?: boolean
          id?: string
          iniciado_em?: string
          lead_id: string
          motivo_fim?: string | null
          protocolo_id?: string | null
          resumo?: string | null
          score_final?: number | null
          score_inicial?: number | null
          total_iteracoes?: number
          total_mensagens?: number
        }
        Update: {
          agente_id?: string | null
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string
          finalizado_em?: string | null
          houve_handoff?: boolean
          id?: string
          iniciado_em?: string
          lead_id?: string
          motivo_fim?: string | null
          protocolo_id?: string | null
          resumo?: string | null
          score_final?: number | null
          score_inicial?: number | null
          total_iteracoes?: number
          total_mensagens?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversas_ia_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_bot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_ia_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_ia_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos_atendimento"
            referencedColumns: ["id"]
          },
        ]
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
          id: string
          nome: string
          ordem: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "divulgacao_quadros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
          variaveis?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
      empresas: {
        Row: {
          ativo: boolean
          cor_primaria: string
          created_at: string
          id: string
          logo_url: string | null
          modulos: string[]
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor_primaria?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          modulos?: string[]
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor_primaria?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          modulos?: string[]
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      encontros: {
        Row: {
          created_at: string
          data: string | null
          descricao: string | null
          empresa_id: string
          id: string
          sessao_numero: number
          turma_id: string
        }
        Insert: {
          created_at?: string
          data?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          sessao_numero: number
          turma_id: string
        }
        Update: {
          created_at?: string
          data?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          sessao_numero?: number
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encontros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
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
          asaas_link_pagamento: string | null
          banner_url: string | null
          checklist_template_id: string | null
          checklist_template_versao: number | null
          comunidade: boolean
          created_at: string
          data: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          limite_participantes: number | null
          link_pagamento: string | null
          local: string | null
          nome: string
          pagina_publica_ativa: boolean
          pagina_secoes: Json
          pago: boolean
          pergunta_inscricao: string | null
          pix_chave: string | null
          produto_id: string | null
          responsavel: string | null
          slug: string | null
          status: string
          tipo: string | null
          turma_id: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          asaas_link_pagamento?: string | null
          banner_url?: string | null
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          comunidade?: boolean
          created_at?: string
          data?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          limite_participantes?: number | null
          link_pagamento?: string | null
          local?: string | null
          nome: string
          pagina_publica_ativa?: boolean
          pagina_secoes?: Json
          pago?: boolean
          pergunta_inscricao?: string | null
          pix_chave?: string | null
          produto_id?: string | null
          responsavel?: string | null
          slug?: string | null
          status?: string
          tipo?: string | null
          turma_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          asaas_link_pagamento?: string | null
          banner_url?: string | null
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          comunidade?: boolean
          created_at?: string
          data?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          limite_participantes?: number | null
          link_pagamento?: string | null
          local?: string | null
          nome?: string
          pagina_publica_ativa?: boolean
          pagina_secoes?: Json
          pago?: boolean
          pergunta_inscricao?: string | null
          pix_chave?: string | null
          produto_id?: string | null
          responsavel?: string | null
          slug?: string | null
          status?: string
          tipo?: string | null
          turma_id?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
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
      eventos_responsaveis: {
        Row: {
          created_at: string
          evento_id: string
          profissional_id: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          profissional_id: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_responsaveis_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_responsaveis_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_mensais: {
        Row: {
          ano: number
          conta_bancaria_id: string
          created_at: string
          empresa_id: string
          id: string
          mes: number
          saldo_fechamento: number
        }
        Insert: {
          ano: number
          conta_bancaria_id: string
          created_at?: string
          empresa_id: string
          id?: string
          mes: number
          saldo_fechamento?: number
        }
        Update: {
          ano?: number
          conta_bancaria_id?: string
          created_at?: string
          empresa_id?: string
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
          {
            foreignKeyName: "fechamentos_mensais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fluxo_sessoes: {
        Row: {
          contexto: Json
          created_at: string
          current_node_id: string
          empresa_id: string
          fluxo_id: string
          id: string
          lead_id: string
          status: string
          updated_at: string
          wait_until: string | null
        }
        Insert: {
          contexto?: Json
          created_at?: string
          current_node_id: string
          empresa_id: string
          fluxo_id: string
          id?: string
          lead_id: string
          status?: string
          updated_at?: string
          wait_until?: string | null
        }
        Update: {
          contexto?: Json
          created_at?: string
          current_node_id?: string
          empresa_id?: string
          fluxo_id?: string
          id?: string
          lead_id?: string
          status?: string
          updated_at?: string
          wait_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fluxo_sessoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluxo_sessoes_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "fluxos_bot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluxo_sessoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      fluxos_bot: {
        Row: {
          ativo: boolean
          canal_ids: string[]
          created_at: string
          empresa_id: string
          fluxo_json: Json
          id: string
          nome: string
          palavra_chave: string | null
          pasta_funil_id: string | null
          texto_inicio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal_ids?: string[]
          created_at?: string
          empresa_id: string
          fluxo_json?: Json
          id?: string
          nome: string
          palavra_chave?: string | null
          pasta_funil_id?: string | null
          texto_inicio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal_ids?: string[]
          created_at?: string
          empresa_id?: string
          fluxo_json?: Json
          id?: string
          nome?: string
          palavra_chave?: string | null
          pasta_funil_id?: string | null
          texto_inicio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fluxos_bot_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluxos_bot_pasta_funil_id_fkey"
            columns: ["pasta_funil_id"]
            isOneToOne: false
            referencedRelation: "funil_pastas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      funil_cards: {
        Row: {
          atualizado_em: string
          criado_em: string
          empresa_id: string
          etapa_id: string
          id: string
          lead_id: string
          quadro_id: string
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          empresa_id: string
          etapa_id: string
          id?: string
          lead_id: string
          quadro_id: string
          status?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          empresa_id?: string
          etapa_id?: string
          id?: string
          lead_id?: string
          quadro_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "funil_cards_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "funil_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funil_cards_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funil_cards_quadro_id_fkey"
            columns: ["quadro_id"]
            isOneToOne: false
            referencedRelation: "funil_quadros"
            referencedColumns: ["id"]
          },
        ]
      }
      funil_etapas: {
        Row: {
          cor: string
          created_at: string
          empresa_id: string
          id: string
          meta_valor: number | null
          nome: string
          observacoes: string | null
          ordem: number
          quadro_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          meta_valor?: number | null
          nome: string
          observacoes?: string | null
          ordem?: number
          quadro_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          meta_valor?: number | null
          nome?: string
          observacoes?: string | null
          ordem?: number
          quadro_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funil_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funil_etapas_quadro_id_fkey"
            columns: ["quadro_id"]
            isOneToOne: false
            referencedRelation: "funil_quadros"
            referencedColumns: ["id"]
          },
        ]
      }
      funil_pastas: {
        Row: {
          created_at: string
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funil_pastas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      funil_quadros: {
        Row: {
          canal: string | null
          created_at: string | null
          deleted_at: string | null
          empresa_id: string
          favorito: boolean
          fixo: boolean
          id: string
          nome: string
          ordem: number | null
          ordem_na_pasta: number
          pasta_id: string | null
          recebe_novos_leads: boolean
          status_ciclo: string
        }
        Insert: {
          canal?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id: string
          favorito?: boolean
          fixo?: boolean
          id?: string
          nome: string
          ordem?: number | null
          ordem_na_pasta?: number
          pasta_id?: string | null
          recebe_novos_leads?: boolean
          status_ciclo?: string
        }
        Update: {
          canal?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id?: string
          favorito?: boolean
          fixo?: boolean
          id?: string
          nome?: string
          ordem?: number | null
          ordem_na_pasta?: number
          pasta_id?: string | null
          recebe_novos_leads?: boolean
          status_ciclo?: string
        }
        Relationships: [
          {
            foreignKeyName: "funil_quadros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funil_quadros_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "funil_pastas"
            referencedColumns: ["id"]
          },
        ]
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
          hora?: string | null
          id?: string
          titulo?: string
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_agenda_eventos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      inscricoes_turmas: {
        Row: {
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          turma_id: string
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          turma_id: string
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          turma_id?: string
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_turmas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          lead_id: string
          tag_id: string
        }
        Insert: {
          lead_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          atendente_id: string | null
          atribuido_em: string | null
          bot_ativo: boolean
          canal_id: string | null
          cargo: string | null
          cidade: string | null
          contato_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          empresa_id: string
          empresa_nome: string | null
          etapa_id: string
          followup_count: number | null
          foto_perfil: string | null
          id: string
          lead_score: number | null
          mensagens_nao_lidas: number
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          perfil_lead: string | null
          produto_interesse: string | null
          responsavel_id: string | null
          sla_alertado_em: string | null
          sla_minutos: number | null
          status_atendimento: string
          telefone: string | null
          tem_mensagem_nova: boolean | null
          tipo_contato: string
          ultima_mensagem_direcao: string | null
          ultima_mensagem_em: string | null
          ultima_mensagem_texto: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          atendente_id?: string | null
          atribuido_em?: string | null
          bot_ativo?: boolean
          canal_id?: string | null
          cargo?: string | null
          cidade?: string | null
          contato_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          empresa_id: string
          empresa_nome?: string | null
          etapa_id: string
          followup_count?: number | null
          foto_perfil?: string | null
          id?: string
          lead_score?: number | null
          mensagens_nao_lidas?: number
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          perfil_lead?: string | null
          produto_interesse?: string | null
          responsavel_id?: string | null
          sla_alertado_em?: string | null
          sla_minutos?: number | null
          status_atendimento?: string
          telefone?: string | null
          tem_mensagem_nova?: boolean | null
          tipo_contato?: string
          ultima_mensagem_direcao?: string | null
          ultima_mensagem_em?: string | null
          ultima_mensagem_texto?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          atendente_id?: string | null
          atribuido_em?: string | null
          bot_ativo?: boolean
          canal_id?: string | null
          cargo?: string | null
          cidade?: string | null
          contato_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string
          empresa_nome?: string | null
          etapa_id?: string
          followup_count?: number | null
          foto_perfil?: string | null
          id?: string
          lead_score?: number | null
          mensagens_nao_lidas?: number
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          perfil_lead?: string | null
          produto_interesse?: string | null
          responsavel_id?: string | null
          sla_alertado_em?: string | null
          sla_minutos?: number | null
          status_atendimento?: string
          telefone?: string | null
          tem_mensagem_nova?: boolean | null
          tipo_contato?: string
          ultima_mensagem_direcao?: string | null
          ultima_mensagem_em?: string | null
          ultima_mensagem_texto?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
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
      leads_ficha_ia: {
        Row: {
          ate_mensagem_em: string | null
          atualizada_em: string
          empresa_id: string
          ficha: Json
          lead_id: string
          modelo: string | null
          tokens_entrada: number | null
          tokens_saida: number | null
        }
        Insert: {
          ate_mensagem_em?: string | null
          atualizada_em?: string
          empresa_id: string
          ficha: Json
          lead_id: string
          modelo?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Update: {
          ate_mensagem_em?: string | null
          atualizada_em?: string
          empresa_id?: string
          ficha?: Json
          lead_id?: string
          modelo?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_ficha_ia_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "matriculas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      mensagens_crm: {
        Row: {
          agente_bot_id: string | null
          bot_respondido: boolean
          canal: string
          conteudo: string
          created_at: string
          direcao: string
          empresa_id: string | null
          id: string
          is_nota_interna: boolean
          lead_id: string
          lido: boolean
          media_mime: string | null
          media_nome: string | null
          media_url: string | null
          protocolo_id: string | null
          quoted_conteudo: string | null
          quoted_message_id: string | null
          quoted_tipo: string | null
          tipo: string
        }
        Insert: {
          agente_bot_id?: string | null
          bot_respondido?: boolean
          canal: string
          conteudo: string
          created_at?: string
          direcao: string
          empresa_id?: string | null
          id?: string
          is_nota_interna?: boolean
          lead_id: string
          lido?: boolean
          media_mime?: string | null
          media_nome?: string | null
          media_url?: string | null
          protocolo_id?: string | null
          quoted_conteudo?: string | null
          quoted_message_id?: string | null
          quoted_tipo?: string | null
          tipo?: string
        }
        Update: {
          agente_bot_id?: string | null
          bot_respondido?: boolean
          canal?: string
          conteudo?: string
          created_at?: string
          direcao?: string
          empresa_id?: string | null
          id?: string
          is_nota_interna?: boolean
          lead_id?: string
          lido?: boolean
          media_mime?: string | null
          media_nome?: string | null
          media_url?: string | null
          protocolo_id?: string | null
          quoted_conteudo?: string | null
          quoted_message_id?: string | null
          quoted_tipo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_crm_agente_bot_id_fkey"
            columns: ["agente_bot_id"]
            isOneToOne: false
            referencedRelation: "agentes_bot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_crm_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_crm_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_crm_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_crm_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "mensagens_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          created_at: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
        Relationships: [
          {
            foreignKeyName: "metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      mindmaps: {
        Row: {
          agenda: Json | null
          created_at: string
          deleted_at: string | null
          edges: Json
          empresa_id: string
          id: string
          nodes: Json
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agenda?: Json | null
          created_at?: string
          deleted_at?: string | null
          edges?: Json
          empresa_id: string
          id?: string
          nodes?: Json
          nome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agenda?: Json | null
          created_at?: string
          deleted_at?: string | null
          edges?: Json
          empresa_id?: string
          id?: string
          nodes?: Json
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mindmaps_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_contas: {
        Row: {
          conta_bancaria_id: string | null
          conta_origem_id: string
          conta_origem_tipo: string
          created_at: string
          data: string
          deleted_at: string | null
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
          {
            foreignKeyName: "movimentacoes_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tarefa_id: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tarefa_id?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tarefa_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          aluno_id: string
          asaas_payment_id: string | null
          conta_bancaria_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          deleted_at: string | null
          empresa_id: string
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
          taxa_absorvida_por: string | null
          taxa_cartao: number | null
          taxa_valor: number | null
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          aluno_id: string
          asaas_payment_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          empresa_id: string
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
          taxa_absorvida_por?: string | null
          taxa_cartao?: number | null
          taxa_valor?: number | null
          updated_at?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          aluno_id?: string
          asaas_payment_id?: string | null
          conta_bancaria_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          empresa_id?: string
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
          taxa_absorvida_por?: string | null
          taxa_cartao?: number | null
          taxa_valor?: number | null
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
            foreignKeyName: "pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "pagamentos_processo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "pagamentos_processo_empresarial_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "pagamentos_profissional_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          utm_source: string | null
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
          utm_source?: string | null
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
          utm_source?: string | null
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "processos_empresariais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
            foreignKeyName: "processos_individuais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
          id?: string
          nome?: string
          parcelas_cartao?: number | null
          responsavel?: string | null
          tipo?: string
          updated_at?: string
          valor?: number | null
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          comercial_id: string | null
          created_at: string
          email: string
          id: string
          nome: string
          profissional_id: string | null
          sobrenome: string | null
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
          sobrenome?: string | null
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
          sobrenome?: string | null
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
          especialidade?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          tipo_vinculo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos_atendimento: {
        Row: {
          atendente_id: string | null
          created_at: string
          empresa_id: string
          finalizado_em: string | null
          id: string
          iniciado_em: string
          lead_id: string
          numero_protocolo: string
          status: string
        }
        Insert: {
          atendente_id?: string | null
          created_at?: string
          empresa_id: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          lead_id: string
          numero_protocolo: string
          status?: string
        }
        Update: {
          atendente_id?: string | null
          created_at?: string
          empresa_id?: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          lead_id?: string
          numero_protocolo?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_atendimento_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          empresa_id: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          empresa_id: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          empresa_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas_avulsas: {
        Row: {
          categoria: string | null
          conta_bancaria_id: string | null
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
          {
            foreignKeyName: "receitas_avulsas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
          {
            foreignKeyName: "reembolsos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_rapidas: {
        Row: {
          atalho: string | null
          conteudo: string
          created_at: string
          empresa_id: string
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          atalho?: string | null
          conteudo: string
          created_at?: string
          empresa_id: string
          id?: string
          ordem?: number
          titulo: string
        }
        Update: {
          atalho?: string | null
          conteudo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_rapidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_sombra: {
        Row: {
          agente_id: string | null
          avaliacao: string | null
          avaliacao_nota: string | null
          avaliado_em: string | null
          avaliado_por: string | null
          created_at: string
          empresa_id: string
          ferramentas: Json
          id: string
          lead_id: string
          mensagem_entrada: string | null
          mensagem_entrada_id: string | null
          modelo: string | null
          resposta_ia: string
          tokens_entrada: number | null
          tokens_saida: number | null
        }
        Insert: {
          agente_id?: string | null
          avaliacao?: string | null
          avaliacao_nota?: string | null
          avaliado_em?: string | null
          avaliado_por?: string | null
          created_at?: string
          empresa_id: string
          ferramentas?: Json
          id?: string
          lead_id: string
          mensagem_entrada?: string | null
          mensagem_entrada_id?: string | null
          modelo?: string | null
          resposta_ia: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Update: {
          agente_id?: string | null
          avaliacao?: string | null
          avaliacao_nota?: string | null
          avaliado_em?: string | null
          avaliado_por?: string | null
          created_at?: string
          empresa_id?: string
          ferramentas?: Json
          id?: string
          lead_id?: string
          mensagem_entrada?: string | null
          mensagem_entrada_id?: string | null
          modelo?: string | null
          resposta_ia?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Relationships: []
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
      tags_crm: {
        Row: {
          cor: string
          created_at: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_crm_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_itens: {
        Row: {
          concluido: boolean
          created_at: string | null
          id: string
          ordem: number
          tarefa_id: string
          titulo: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string | null
          id?: string
          ordem?: number
          tarefa_id: string
          titulo: string
        }
        Update: {
          concluido?: boolean
          created_at?: string | null
          id?: string
          ordem?: number
          tarefa_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_itens_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
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
          empresa_id: string
          encontro_id: string | null
          escopo: string
          evento_id: string | null
          fase_evento: string | null
          hora: string | null
          id: string
          lead_id: string | null
          origem_tarefa: string
          prioridade: string
          processo_id: string | null
          recorrencia: string
          responsavel_id: string | null
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
          empresa_id: string
          encontro_id?: string | null
          escopo?: string
          evento_id?: string | null
          fase_evento?: string | null
          hora?: string | null
          id?: string
          lead_id?: string | null
          origem_tarefa?: string
          prioridade?: string
          processo_id?: string | null
          recorrencia?: string
          responsavel_id?: string | null
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
          empresa_id?: string
          encontro_id?: string | null
          escopo?: string
          evento_id?: string | null
          fase_evento?: string | null
          hora?: string | null
          id?: string
          lead_id?: string | null
          origem_tarefa?: string
          prioridade?: string
          processo_id?: string | null
          recorrencia?: string
          responsavel_id?: string | null
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
            foreignKeyName: "tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      tarefas_responsaveis: {
        Row: {
          created_at: string
          tarefa_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tarefa_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tarefa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_responsaveis_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
          {
            foreignKeyName: "transferencias_entre_contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          asaas_link_pagamento: string | null
          checklist_template_id: string | null
          checklist_template_versao: number | null
          cidade: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          modalidade: string
          nome: string
          pergunta_inscricao: string | null
          pix_chave: string | null
          produto_id: string | null
          responsavel: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asaas_link_pagamento?: string | null
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          cidade: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          modalidade: string
          nome: string
          pergunta_inscricao?: string | null
          pix_chave?: string | null
          produto_id?: string | null
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asaas_link_pagamento?: string | null
          checklist_template_id?: string | null
          checklist_template_versao?: number | null
          cidade?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          modalidade?: string
          nome?: string
          pergunta_inscricao?: string | null
          pix_chave?: string | null
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
            foreignKeyName: "turmas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      turmas_responsaveis: {
        Row: {
          created_at: string
          profissional_id: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          profissional_id: string
          turma_id: string
        }
        Update: {
          created_at?: string
          profissional_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_responsaveis_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_responsaveis_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_empresa: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_empresa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      v_respostas_sombra_revisao: {
        Row: {
          agente_id: string | null
          agente_nome: string | null
          avaliacao: string | null
          avaliacao_nota: string | null
          avaliado_em: string | null
          avaliado_por: string | null
          created_at: string | null
          empresa_id: string | null
          entrada_em: string | null
          ferramentas: Json | null
          id: string | null
          lead_id: string | null
          lead_nome: string | null
          mensagem_entrada: string | null
          modelo: string | null
          resposta_humana: string | null
          resposta_humana_em: string | null
          resposta_ia: string | null
          tokens_entrada: number | null
          tokens_saida: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ativar_funil_recebedor: {
        Args: { p_quadro_id: string }
        Returns: {
          canal: string | null
          created_at: string | null
          deleted_at: string | null
          empresa_id: string
          favorito: boolean
          fixo: boolean
          id: string
          nome: string
          ordem: number | null
          ordem_na_pasta: number
          pasta_id: string | null
          recebe_novos_leads: boolean
          status_ciclo: string
        }
        SetofOptions: {
          from: "*"
          to: "funil_quadros"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      atualizar_metas_ativas: { Args: never; Returns: Json }
      auto_close_conversas_ia: { Args: never; Returns: undefined }
      buscar_conhecimento: {
        Args: {
          p_agente_id: string
          p_embedding: string
          p_empresa_id: string
          p_limiar?: number
          p_limite?: number
        }
        Returns: {
          categoria: string
          conteudo: string
          similaridade: number
          titulo: string
        }[]
      }
      can_access_by_comercial: {
        Args: { _comercial_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_by_responsavel: {
        Args: { _responsavel: string; _user_id: string }
        Returns: boolean
      }
      can_access_mindmap: { Args: { _user_id: string }; Returns: boolean }
      criar_protocolo: {
        Args: {
          p_atendente_id: string
          p_empresa_id: string
          p_lead_id: string
        }
        Returns: Json
      }
      crm_mensagens_por_dia: {
        Args: { p_dias?: number; p_empresa_id: string }
        Returns: {
          dia: string
          total: number
        }[]
      }
      crm_tempo_medio_resposta: {
        Args: { p_empresa_id: string }
        Returns: number
      }
      current_user_is_admin_master: { Args: never; Returns: boolean }
      current_user_is_empresa_admin: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      dashboard_metrics: { Args: { _ano: number; _mes: number }; Returns: Json }
      finalizar_protocolo: { Args: { p_lead_id: string }; Returns: undefined }
      garantir_oportunidade_funil_ativo: {
        Args: { p_empresa_id: string; p_lead_id: string; p_pasta_id: string }
        Returns: {
          card_id: string
          etapa_id: string
          quadro_id: string
        }[]
      }
      gerar_numero_protocolo: { Args: never; Returns: string }
      get_user_comercial_id: { Args: { _user_id: string }; Returns: string }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_user_profissional_id: { Args: { _user_id: string }; Returns: string }
      get_user_profissional_nome: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      get_users_by_ids: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      incrementar_mensagens_nao_lidas: {
        Args: { lead_id_param: string }
        Returns: undefined
      }
      is_gestor: { Args: { _user_id: string }; Returns: boolean }
      leads_para_ficha: {
        Args: { p_limite?: number }
        Returns: {
          lead_id: string
        }[]
      }
      marcar_bot_respondido: { Args: { p_lead_id: string }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "comercial", "financeiro", "suporte", "profissional"],
    },
  },
} as const
