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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          brand: string
          check_in_at: string | null
          check_in_by: string | null
          check_in_note: string | null
          check_in_photo_url: string | null
          check_out_at: string | null
          check_out_by: string | null
          check_out_note: string | null
          check_out_photo_url: string | null
          client_id: number | null
          contact: string
          contact_number: string
          created_at: string
          created_by: string | null
          creator_edits_allowed: number
          creator_edits_used: number
          current_deadline: string | null
          custom_fields: Json
          date: string | null
          deadline_changes_allowed: number
          deadline_changes_used: number
          external_order: string
          forwarded_at: string | null
          forwarded_by: string | null
          forwarded_workshop_id: string | null
          id: string
          issue: string
          km_scheduled: number | null
          manager_edit_used: boolean
          manager_edits_used: number
          model: string
          note: string
          operator: string
          operator_id: number | null
          original_deadline: string | null
          os_number: number | null
          plate: string
          priority_urgent: boolean
          registered_at: string | null
          rework_of: string | null
          rework_reason: string | null
          schedule_type: string
          sgloc_confirmed: string | null
          sgloc_last_error: string | null
          sgloc_missing_count: number
          sgloc_performed: string | null
          sgloc_reference: string | null
          sgloc_sync_state: string
          sgloc_synced_at: string | null
          sheet_id: string
          status: string
          store: string
          store_id: number | null
          supplier_id: number | null
          time: string
          workshop: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          brand?: string
          check_in_at?: string | null
          check_in_by?: string | null
          check_in_note?: string | null
          check_in_photo_url?: string | null
          check_out_at?: string | null
          check_out_by?: string | null
          check_out_note?: string | null
          check_out_photo_url?: string | null
          client_id?: number | null
          contact?: string
          contact_number?: string
          created_at?: string
          created_by?: string | null
          creator_edits_allowed?: number
          creator_edits_used?: number
          current_deadline?: string | null
          custom_fields?: Json
          date?: string | null
          deadline_changes_allowed?: number
          deadline_changes_used?: number
          external_order?: string
          forwarded_at?: string | null
          forwarded_by?: string | null
          forwarded_workshop_id?: string | null
          id?: string
          issue?: string
          km_scheduled?: number | null
          manager_edit_used?: boolean
          manager_edits_used?: number
          model?: string
          note?: string
          operator?: string
          operator_id?: number | null
          original_deadline?: string | null
          os_number?: number | null
          plate?: string
          priority_urgent?: boolean
          registered_at?: string | null
          rework_of?: string | null
          rework_reason?: string | null
          schedule_type?: string
          sgloc_confirmed?: string | null
          sgloc_last_error?: string | null
          sgloc_missing_count?: number
          sgloc_performed?: string | null
          sgloc_reference?: string | null
          sgloc_sync_state?: string
          sgloc_synced_at?: string | null
          sheet_id?: string
          status?: string
          store?: string
          store_id?: number | null
          supplier_id?: number | null
          time?: string
          workshop?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          brand?: string
          check_in_at?: string | null
          check_in_by?: string | null
          check_in_note?: string | null
          check_in_photo_url?: string | null
          check_out_at?: string | null
          check_out_by?: string | null
          check_out_note?: string | null
          check_out_photo_url?: string | null
          client_id?: number | null
          contact?: string
          contact_number?: string
          created_at?: string
          created_by?: string | null
          creator_edits_allowed?: number
          creator_edits_used?: number
          current_deadline?: string | null
          custom_fields?: Json
          date?: string | null
          deadline_changes_allowed?: number
          deadline_changes_used?: number
          external_order?: string
          forwarded_at?: string | null
          forwarded_by?: string | null
          forwarded_workshop_id?: string | null
          id?: string
          issue?: string
          km_scheduled?: number | null
          manager_edit_used?: boolean
          manager_edits_used?: number
          model?: string
          note?: string
          operator?: string
          operator_id?: number | null
          original_deadline?: string | null
          os_number?: number | null
          plate?: string
          priority_urgent?: boolean
          registered_at?: string | null
          rework_of?: string | null
          rework_reason?: string | null
          schedule_type?: string
          sgloc_confirmed?: string | null
          sgloc_last_error?: string | null
          sgloc_missing_count?: number
          sgloc_performed?: string | null
          sgloc_reference?: string | null
          sgloc_sync_state?: string
          sgloc_synced_at?: string | null
          sheet_id?: string
          status?: string
          store?: string
          store_id?: number | null
          supplier_id?: number | null
          time?: string
          workshop?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_check_in_by_fkey"
            columns: ["check_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_check_out_by_fkey"
            columns: ["check_out_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_forwarded_workshop_id_fkey"
            columns: ["forwarded_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rework_of_fkey"
            columns: ["rework_of"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          name_key: string | null
          sgloc_id: number | null
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name: string
          name_key?: string | null
          sgloc_id?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          name_key?: string | null
          sgloc_id?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_log: {
        Row: {
          action: string
          actor_id: string | null
          changed_at: string
          detail: string
          id: string
          item_name: string
          kind: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_at?: string
          detail?: string
          id?: string
          item_name: string
          kind: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_at?: string
          detail?: string
          id?: string
          item_name?: string
          kind?: string
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          name_key: string | null
          sgloc_id: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          name_key?: string | null
          sgloc_id?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          name_key?: string | null
          sgloc_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      check_in_records: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          note: string | null
          occurred_at: string
          os_number: number | null
          performed_by: string | null
          photo_url: string | null
          plate: string | null
          type: string
          workshop_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          os_number?: number | null
          performed_by?: string | null
          photo_url?: string | null
          plate?: string | null
          type: string
          workshop_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          os_number?: number | null
          performed_by?: string | null
          photo_url?: string | null
          plate?: string | null
          type?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_in_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_records_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      classificacoes_servico: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          name_key: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          name_key?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          name_key?: string | null
        }
        Relationships: []
      }
      contact_log: {
        Row: {
          appointment_id: string
          contact_at: string
          contact_type: Database["public"]["Enums"]["contact_type"]
          id: string
          note: string | null
          registered_by: string | null
        }
        Insert: {
          appointment_id: string
          contact_at?: string
          contact_type: Database["public"]["Enums"]["contact_type"]
          id?: string
          note?: string | null
          registered_by?: string | null
        }
        Update: {
          appointment_id?: string
          contact_at?: string
          contact_type?: Database["public"]["Enums"]["contact_type"]
          id?: string
          note?: string | null
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_log_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_orcamentarias: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          required: boolean
          select_options: Json | null
          sort_order: number
          storage: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          label: string
          required?: boolean
          select_options?: Json | null
          sort_order?: number
          storage: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          required?: boolean
          select_options?: Json | null
          sort_order?: number
          storage?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      edit_limit_defaults: {
        Row: {
          max_edits: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          max_edits: number
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          max_edits?: number
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      edit_limit_overrides: {
        Row: {
          max_edits: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          max_edits: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          max_edits?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      edit_log: {
        Row: {
          appointment_id: string
          changed_at: string
          changed_by: string | null
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          appointment_id: string
          changed_at?: string
          changed_by?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          appointment_id?: string
          changed_at?: string
          changed_by?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edit_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          appointment_id: string | null
          archived_at: string | null
          archived_by: string | null
          autorizacao: string | null
          autorizado_cliente: string | null
          centro_custo_id: string | null
          cliente: string | null
          closed_at: string | null
          condutor_contato: string | null
          condutor_nome: string | null
          contrato_id: number | null
          contrato_ref: string | null
          created_at: string
          created_by: string | null
          executado: string | null
          externa_ref: string | null
          gnv_final: string | null
          gnv_inicial: string | null
          hora: string | null
          id: string
          km: number | null
          km_final: number | null
          modelo: string | null
          montadora: string | null
          nf: string | null
          numero: number
          obs1: string | null
          obs2: string | null
          opened_at: string
          operador: string | null
          origem: string
          pagamento_metodo: string | null
          pagamento_status: string | null
          pendencia: boolean
          pendencia_desc: string | null
          plate: string
          posicao_final: string | null
          posicao_inicial: string | null
          previsao_conclusao: string | null
          recuperado: boolean | null
          solicitante: string | null
          status_id: number
          store_id: number | null
          tanque_final: string | null
          tanque_inicial: string | null
          tipo_atendimento: string
          tipo_id: number
          total_compras: number
          total_estoque: number
          total_os: number
          total_servico: number
          updated_at: string
          vehicle_id: string | null
          workshop_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          autorizacao?: string | null
          autorizado_cliente?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          closed_at?: string | null
          condutor_contato?: string | null
          condutor_nome?: string | null
          contrato_id?: number | null
          contrato_ref?: string | null
          created_at?: string
          created_by?: string | null
          executado?: string | null
          externa_ref?: string | null
          gnv_final?: string | null
          gnv_inicial?: string | null
          hora?: string | null
          id?: string
          km?: number | null
          km_final?: number | null
          modelo?: string | null
          montadora?: string | null
          nf?: string | null
          numero: number
          obs1?: string | null
          obs2?: string | null
          opened_at?: string
          operador?: string | null
          origem?: string
          pagamento_metodo?: string | null
          pagamento_status?: string | null
          pendencia?: boolean
          pendencia_desc?: string | null
          plate: string
          posicao_final?: string | null
          posicao_inicial?: string | null
          previsao_conclusao?: string | null
          recuperado?: boolean | null
          solicitante?: string | null
          status_id?: number
          store_id?: number | null
          tanque_final?: string | null
          tanque_inicial?: string | null
          tipo_atendimento?: string
          tipo_id: number
          total_compras?: number
          total_estoque?: number
          total_os?: number
          total_servico?: number
          updated_at?: string
          vehicle_id?: string | null
          workshop_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          autorizacao?: string | null
          autorizado_cliente?: string | null
          centro_custo_id?: string | null
          cliente?: string | null
          closed_at?: string | null
          condutor_contato?: string | null
          condutor_nome?: string | null
          contrato_id?: number | null
          contrato_ref?: string | null
          created_at?: string
          created_by?: string | null
          executado?: string | null
          externa_ref?: string | null
          gnv_final?: string | null
          gnv_inicial?: string | null
          hora?: string | null
          id?: string
          km?: number | null
          km_final?: number | null
          modelo?: string | null
          montadora?: string | null
          nf?: string | null
          numero?: number
          obs1?: string | null
          obs2?: string | null
          opened_at?: string
          operador?: string | null
          origem?: string
          pagamento_metodo?: string | null
          pagamento_status?: string | null
          pendencia?: boolean
          pendencia_desc?: string | null
          plate?: string
          posicao_final?: string | null
          posicao_inicial?: string | null
          previsao_conclusao?: string | null
          recuperado?: boolean | null
          solicitante?: string | null
          status_id?: number
          store_id?: number | null
          tanque_final?: string | null
          tanque_inicial?: string | null
          tipo_atendimento?: string
          tipo_id?: number
          total_compras?: number
          total_estoque?: number
          total_os?: number
          total_servico?: number
          updated_at?: string
          vehicle_id?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "os_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "sgloc_stores"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "ordens_servico_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "os_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      os_anexos: {
        Row: {
          filename: string
          id: string
          os_id: string
          uploaded_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          filename: string
          id?: string
          os_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          filename?: string
          id?: string
          os_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_anexos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_autorizadores: {
        Row: {
          created_at: string
          is_default: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          is_default?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          is_default?: boolean
          user_id?: string
        }
        Relationships: []
      }
      os_compras: {
        Row: {
          created_at: string
          id: string
          numero_compra: string
          os_id: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          numero_compra: string
          os_id: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          numero_compra?: string
          os_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_compras_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_cotacoes: {
        Row: {
          created_at: string
          fornecedor: string
          id: string
          os_item_id: string
          prazo_pagamento: string | null
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          fornecedor: string
          id?: string
          os_item_id: string
          prazo_pagamento?: string | null
          valor_unitario?: number
        }
        Update: {
          created_at?: string
          fornecedor?: string
          id?: string
          os_item_id?: string
          prazo_pagamento?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_cotacoes_os_item_id_fkey"
            columns: ["os_item_id"]
            isOneToOne: false
            referencedRelation: "os_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      os_edit_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          os_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          os_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          os_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_edit_log_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_itens: {
        Row: {
          approval: string
          authorizer: string | null
          budget_account: string | null
          classification: string | null
          created_at: string
          description: string
          id: string
          item_type: string
          mechanic_name: string | null
          movement_date: string | null
          observation: string | null
          os_id: string
          part_code: string | null
          qty: number
          requester: string | null
          service_code: string | null
          total: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          approval?: string
          authorizer?: string | null
          budget_account?: string | null
          classification?: string | null
          created_at?: string
          description: string
          id?: string
          item_type: string
          mechanic_name?: string | null
          movement_date?: string | null
          observation?: string | null
          os_id: string
          part_code?: string | null
          qty?: number
          requester?: string | null
          service_code?: string | null
          total?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          approval?: string
          authorizer?: string | null
          budget_account?: string | null
          classification?: string | null
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          mechanic_name?: string | null
          movement_date?: string | null
          observation?: string | null
          os_id?: string
          part_code?: string | null
          qty?: number
          requester?: string | null
          service_code?: string | null
          total?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_itens_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_observacoes_cliente: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          os_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          os_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          os_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_observacoes_cliente_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_pagamentos: {
        Row: {
          aceito: boolean | null
          aceito_at: string | null
          aceito_por: string | null
          conta_orcamentaria_id: string | null
          created_at: string
          dia_pagamento: number | null
          documento: string | null
          emissao: string | null
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          intervalo_dias: number | null
          os_id: string
          primeiro_vencimento: string | null
          qtd_parcelas: number | null
          status_pagamento: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          aceito?: boolean | null
          aceito_at?: string | null
          aceito_por?: string | null
          conta_orcamentaria_id?: string | null
          created_at?: string
          dia_pagamento?: number | null
          documento?: string | null
          emissao?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          intervalo_dias?: number | null
          os_id: string
          primeiro_vencimento?: string | null
          qtd_parcelas?: number | null
          status_pagamento?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          aceito?: boolean | null
          aceito_at?: string | null
          aceito_por?: string | null
          conta_orcamentaria_id?: string | null
          created_at?: string
          dia_pagamento?: number | null
          documento?: string | null
          emissao?: string | null
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          intervalo_dias?: number | null
          os_id?: string
          primeiro_vencimento?: string | null
          qtd_parcelas?: number | null
          status_pagamento?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_pagamentos_conta_orcamentaria_id_fkey"
            columns: ["conta_orcamentaria_id"]
            isOneToOne: false
            referencedRelation: "contas_orcamentarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_pagamentos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_status: {
        Row: {
          allows_finalize: boolean
          code: string
          color: string
          created_at: string
          id: number
          label: string
          sort_order: number
        }
        Insert: {
          allows_finalize?: boolean
          code: string
          color?: string
          created_at?: string
          id: number
          label: string
          sort_order?: number
        }
        Update: {
          allows_finalize?: boolean
          code?: string
          color?: string
          created_at?: string
          id?: number
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      os_tipos: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: number
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id: number
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: number
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      posicoes_operacionais: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          is_final: boolean
          is_initial: boolean
          label: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          is_final?: boolean
          is_initial?: boolean
          label: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          is_final?: boolean
          is_initial?: boolean
          label?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          sector: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          sector?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          sector?: string | null
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          modules: string[]
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          modules?: string[]
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          modules?: string[]
          name?: string
        }
        Relationships: []
      }
      sgloc_accounts: {
        Row: {
          sgloc_email: string
          sgloc_user_code: string | null
          token: string
          token_encrypted: boolean
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          sgloc_email: string
          sgloc_user_code?: string | null
          token: string
          token_encrypted?: boolean
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          sgloc_email?: string
          sgloc_user_code?: string | null
          token?: string
          token_encrypted?: boolean
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sgloc_probe_runs: {
        Row: {
          error: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          ok: boolean
          run_at: string
          run_by: string | null
          step: string
          summary: Json
        }
        Insert: {
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          run_at?: string
          run_by?: string | null
          step: string
          summary?: Json
        }
        Update: {
          error?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          ok?: boolean
          run_at?: string
          run_by?: string | null
          step?: string
          summary?: Json
        }
        Relationships: []
      }
      sgloc_settings: {
        Row: {
          auto_sync_enabled: boolean
          base_url: string | null
          enabled: boolean
          id: boolean
          interval_minutes: number
          request_timeout_seconds: number
          sync_live: boolean
          sync_user_id: string | null
          updated_at: string | null
          updated_by: string | null
          window_days_ahead: number
          window_days_back: number
          write_enabled: boolean
        }
        Insert: {
          auto_sync_enabled?: boolean
          base_url?: string | null
          enabled?: boolean
          id?: boolean
          interval_minutes?: number
          request_timeout_seconds?: number
          sync_live?: boolean
          sync_user_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          window_days_ahead?: number
          window_days_back?: number
          write_enabled?: boolean
        }
        Update: {
          auto_sync_enabled?: boolean
          base_url?: string | null
          enabled?: boolean
          id?: boolean
          interval_minutes?: number
          request_timeout_seconds?: number
          sync_live?: boolean
          sync_user_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          window_days_ahead?: number
          window_days_back?: number
          write_enabled?: boolean
        }
        Relationships: []
      }
      sgloc_stores: {
        Row: {
          code: string
          label: string
          store_id: number
          updated_at: string | null
        }
        Insert: {
          code: string
          label?: string
          store_id: number
          updated_at?: string | null
        }
        Update: {
          code?: string
          label?: string
          store_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      sgloc_suppliers: {
        Row: {
          name: string
          supplier_id: number
          updated_at: string | null
        }
        Insert: {
          name?: string
          supplier_id: number
          updated_at?: string | null
        }
        Update: {
          name?: string
          supplier_id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      sgloc_sync_runs: {
        Row: {
          ambiguous: number
          created_by: string | null
          dry_run: boolean
          error_detail: Json
          errors: number
          fetched: number
          finished_at: string | null
          id: string
          inserted: number
          linked: number
          not_returned: number
          protected: number
          sample: Json
          skipped: number
          started_at: string | null
          status: string
          trigger_source: string
          updated: number
        }
        Insert: {
          ambiguous?: number
          created_by?: string | null
          dry_run?: boolean
          error_detail?: Json
          errors?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          linked?: number
          not_returned?: number
          protected?: number
          sample?: Json
          skipped?: number
          started_at?: string | null
          status?: string
          trigger_source?: string
          updated?: number
        }
        Update: {
          ambiguous?: number
          created_by?: string | null
          dry_run?: boolean
          error_detail?: Json
          errors?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          linked?: number
          not_returned?: number
          protected?: number
          sample?: Json
          skipped?: number
          started_at?: string | null
          status?: string
          trigger_source?: string
          updated?: number
        }
        Relationships: []
      }
      status_options: {
        Row: {
          color_token: string
          created_at: string
          id: string
          is_completion: boolean
          label: string
          show_external: boolean
          show_in_yard: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_token: string
          created_at?: string
          id?: string
          is_completion?: boolean
          label: string
          show_external?: boolean
          show_in_yard?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_token?: string
          created_at?: string
          id?: string
          is_completion?: boolean
          label?: string
          show_external?: boolean
          show_in_yard?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_admin_log: {
        Row: {
          action: string
          actor_id: string | null
          changed_at: string
          detail: string
          id: string
          target_id: string | null
          target_label: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          changed_at?: string
          detail?: string
          id?: string
          target_id?: string | null
          target_label?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          changed_at?: string
          detail?: string
          id?: string
          target_id?: string | null
          target_label?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sectors: {
        Row: {
          sector_id: string
          user_id: string
        }
        Insert: {
          sector_id: string
          user_id: string
        }
        Update: {
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_screen_access: {
        Row: {
          allowed: boolean
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          allowed?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          allowed?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_screen_access_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          ano: number | null
          ano_modelo: number | null
          categoria: string | null
          chassi: string | null
          cor: string | null
          created_at: string
          extra_data: Json
          fabricante: string | null
          grupo: string | null
          id: string
          km_atual: number | null
          loja_op: string | null
          modelo: string | null
          plate: string
          pos_operacional: string | null
          prefixo: string | null
          renavam: string | null
          sgloc_id: number | null
          status: string | null
          tanque: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          ano?: number | null
          ano_modelo?: number | null
          categoria?: string | null
          chassi?: string | null
          cor?: string | null
          created_at?: string
          extra_data?: Json
          fabricante?: string | null
          grupo?: string | null
          id?: string
          km_atual?: number | null
          loja_op?: string | null
          modelo?: string | null
          plate: string
          pos_operacional?: string | null
          prefixo?: string | null
          renavam?: string | null
          sgloc_id?: number | null
          status?: string | null
          tanque?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          ano?: number | null
          ano_modelo?: number | null
          categoria?: string | null
          chassi?: string | null
          cor?: string | null
          created_at?: string
          extra_data?: Json
          fabricante?: string | null
          grupo?: string | null
          id?: string
          km_atual?: number | null
          loja_op?: string | null
          modelo?: string | null
          plate?: string
          pos_operacional?: string | null
          prefixo?: string | null
          renavam?: string | null
          sgloc_id?: number | null
          status?: string | null
          tanque?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      workshop_movements: {
        Row: {
          actor_id: string | null
          appointment_id: string
          entered_at: string
          id: string
          left_at: string | null
          os_id: string
          workshop_id: string
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          entered_at?: string
          id?: string
          left_at?: string | null
          os_id: string
          workshop_id: string
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          entered_at?: string
          id?: string
          left_at?: string | null
          os_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_movements_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_movements_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_movements_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_users: {
        Row: {
          user_id: string
          workshop_id: string
        }
        Insert: {
          user_id: string
          workshop_id: string
        }
        Update: {
          user_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_users_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          is_own_yard: boolean
          name: string
          source: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_own_yard?: boolean
          name: string
          source?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_own_yard?: boolean
          name?: string
          source?: string
        }
        Relationships: []
      }
      yard_group_members: {
        Row: {
          group_id: string
          workshop_id: string
        }
        Insert: {
          group_id: string
          workshop_id: string
        }
        Update: {
          group_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "yard_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "yard_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yard_group_members_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      yard_groups: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      yard_settings: {
        Row: {
          check_in_required: boolean | null
          check_out_required: boolean | null
          editable_fields: Json | null
          id: number
          new_highlight_minutes: number | null
          notification_sound_enabled: boolean | null
          photo_capture_enabled: boolean | null
          photo_max_mb: number | null
          photo_upload_enabled: boolean | null
          polling_seconds: number | null
          timer_green_hours: number | null
          timer_yellow_hours: number | null
          toast_duration_ms: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          check_in_required?: boolean | null
          check_out_required?: boolean | null
          editable_fields?: Json | null
          id?: number
          new_highlight_minutes?: number | null
          notification_sound_enabled?: boolean | null
          photo_capture_enabled?: boolean | null
          photo_max_mb?: number | null
          photo_upload_enabled?: boolean | null
          polling_seconds?: number | null
          timer_green_hours?: number | null
          timer_yellow_hours?: number | null
          toast_duration_ms?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          check_in_required?: boolean | null
          check_out_required?: boolean | null
          editable_fields?: Json | null
          id?: number
          new_highlight_minutes?: number | null
          notification_sound_enabled?: boolean | null
          photo_capture_enabled?: boolean | null
          photo_max_mb?: number | null
          photo_upload_enabled?: boolean | null
          polling_seconds?: number | null
          timer_green_hours?: number | null
          timer_yellow_hours?: number | null
          toast_duration_ms?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yard_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      appointment_creator_sectors: {
        Args: never
        Returns: {
          sector: string
          user_id: string
        }[]
      }
      can_view_vehicles: { Args: { _uid: string }; Returns: boolean }
      catalog_add: {
        Args: {
          _kind: string
          _name: string
          _sgloc_id?: number
          _source?: string
        }
        Returns: Json
      }
      catalog_delete: { Args: { _id: string; _kind: string }; Returns: number }
      catalog_update: {
        Args: {
          _active: boolean
          _id: string
          _kind: string
          _name: string
          _sgloc_id: number
        }
        Returns: number
      }
      catalog_usage: { Args: { _id: string; _kind: string }; Returns: number }
      edit_limit_for: { Args: { _uid: string }; Returns: number }
      existing_sgloc_references: {
        Args: { _refs: string[] }
        Returns: string[]
      }
      get_my_edit_limit: { Args: never; Returns: number }
      get_my_modules: { Args: never; Returns: string[] }
      get_my_sgloc_status: {
        Args: never
        Returns: {
          connected: boolean
          sgloc_email: string
          token_expires_at: string
        }[]
      }
      has_access: { Args: { _user_id: string }; Returns: boolean }
      has_module: { Args: { _module: string; _uid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_sgloc_connected_users: {
        Args: never
        Returns: {
          full_name: string
          sgloc_email: string
          token_expires_at: string
          user_id: string
        }[]
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      norm_name: { Args: { _v: string }; Returns: string }
      norm_plate: { Args: { _v: string }; Returns: string }
      os_archive: { Args: { _os_id: string }; Returns: undefined }
      os_config_list: { Args: never; Returns: Json }
      os_contrato_match: {
        Args: {
          _os: Database["public"]["Tables"]["ordens_servico"]["Row"]
          _q: string
        }
        Returns: boolean
      }
      os_create: {
        Args: {
          _appointment_id?: string
          _autorizacao?: string
          _autorizado_cliente?: string
          _centro_custo_id: string
          _condutor_contato?: string
          _condutor_nome?: string
          _contrato_id?: number
          _executado?: string
          _externa_ref?: string
          _gnv_inicial?: string
          _hora?: string
          _km: number
          _nf?: string
          _obs1?: string
          _obs2?: string
          _pagamento_metodo?: string
          _pendencia?: boolean
          _pendencia_desc?: string
          _plate: string
          _posicao_inicial?: string
          _previsao_conclusao?: string
          _recuperado?: boolean
          _solicitante?: string
          _store_id: number
          _tanque_inicial?: string
          _tipo_atendimento?: string
          _tipo_id: number
          _workshop_id: string
        }
        Returns: Json
      }
      os_finalize: {
        Args: {
          _gnv_final: string
          _km_final: number
          _os_id: string
          _posicao_final: string
          _tanque_final: string
        }
        Returns: Json
      }
      os_forward_appointment: {
        Args: {
          _appointment_id: string
          _centro_custo_id: string
          _km: number
          _store_id: number
          _tipo_id: number
          _workshop_id: string
        }
        Returns: Json
      }
      os_get_detail: { Args: { _os_id: string }; Returns: Json }
      os_item_add: {
        Args: {
          _authorizer?: string
          _budget_account?: string
          _classification?: string
          _description: string
          _item_type: string
          _mechanic_name?: string
          _movement_date?: string
          _observation?: string
          _os_id: string
          _part_code?: string
          _qty: number
          _requester?: string
          _service_code?: string
          _unit_price: number
        }
        Returns: Json
      }
      os_item_delete: { Args: { _item_id: string }; Returns: undefined }
      os_item_update: {
        Args: { _changes: Json; _item_id: string }
        Returns: Json
      }
      os_items_batch_approve: {
        Args: { _approval: string; _os_id: string }
        Returns: undefined
      }
      os_transition_status: {
        Args: { _new_status_id: number; _os_id: string }
        Returns: Json
      }
      os_update: { Args: { _changes: Json; _os_id: string }; Returns: Json }
      record_workshop_movement: {
        Args: { _appointment: string; _os: string; _workshop: string }
        Returns: undefined
      }
      revoke_user_sessions: { Args: { _user_id: string }; Returns: undefined }
      search_ordens_servico: {
        Args: { _filters?: Json; _page?: number; _page_size?: number }
        Returns: Json
      }
      search_vehicle_movements: {
        Args: {
          _from?: string
          _include_archived?: boolean
          _mechanic?: string
          _page?: number
          _page_size?: number
          _plate?: string
          _rework?: boolean
          _sector?: string
          _service?: string
          _status?: string
          _store?: string
          _to?: string
          _urgent?: boolean
          _workshop?: string
        }
        Returns: Json
      }
      service_category: { Args: { _issue: string }; Returns: string }
      set_edit_limit_default: {
        Args: { _max: number; _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      set_edit_limit_override: {
        Args: { _max: number; _user_id: string }
        Returns: undefined
      }
      set_own_yard: { Args: { _workshop_id: string }; Returns: undefined }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      user_modules: { Args: { _uid: string }; Returns: string[] }
      vehicle_workflow_lookup: {
        Args: never
        Returns: {
          ano: number
          categoria: string
          fabricante: string
          km_atual: number
          loja_op: string
          modelo: string
          plate: string
        }[]
      }
      yard_status_durations: {
        Args: never
        Returns: {
          appointment_id: string
          last_status_change_at: string
        }[]
      }
    }
    Enums: {
      app_role: "atendimento" | "gerente" | "master" | "oficina"
      contact_type: "ligação" | "mensagem"
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
  public: {
    Enums: {
      app_role: ["atendimento", "gerente", "master", "oficina"],
      contact_type: ["ligação", "mensagem"],
    },
  },
} as const
