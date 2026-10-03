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
      appointments: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          brand: string
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
          external_order: string
          id: string
          issue: string
          km_scheduled: number | null
          manager_edit_used: boolean
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
          external_order?: string
          id?: string
          issue?: string
          km_scheduled?: number | null
          manager_edit_used?: boolean
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
          external_order?: string
          id?: string
          issue?: string
          km_scheduled?: number | null
          manager_edit_used?: boolean
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
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
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
          base_url: string | null
          enabled: boolean
          id: boolean
          interval_minutes: number
          request_timeout_seconds: number
          updated_at: string | null
          updated_by: string | null
          window_days_ahead: number
          window_days_back: number
        }
        Insert: {
          base_url?: string | null
          enabled?: boolean
          id?: boolean
          interval_minutes?: number
          request_timeout_seconds?: number
          updated_at?: string | null
          updated_by?: string | null
          window_days_ahead?: number
          window_days_back?: number
        }
        Update: {
          base_url?: string | null
          enabled?: boolean
          id?: boolean
          interval_minutes?: number
          request_timeout_seconds?: number
          updated_at?: string | null
          updated_by?: string | null
          window_days_ahead?: number
          window_days_back?: number
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
          created_by: string | null
          error_detail: Json
          errors: number
          fetched: number
          finished_at: string | null
          id: string
          inserted: number
          skipped: number
          started_at: string | null
          status: string
          trigger_source: string
          updated: number
        }
        Insert: {
          created_by?: string | null
          error_detail?: Json
          errors?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          skipped?: number
          started_at?: string | null
          status?: string
          trigger_source?: string
          updated?: number
        }
        Update: {
          created_by?: string | null
          error_detail?: Json
          errors?: number
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
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
          sort_order: number
          updated_at: string
        }
        Insert: {
          color_token: string
          created_at?: string
          id?: string
          is_completion?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color_token?: string
          created_at?: string
          id?: string
          is_completion?: boolean
          label?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      existing_sgloc_references: {
        Args: { _refs: string[] }
        Returns: string[]
      }
      get_my_sgloc_status: {
        Args: never
        Returns: {
          connected: boolean
          sgloc_email: string
          token_expires_at: string
        }[]
      }
      has_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      revoke_user_sessions: { Args: { _user_id: string }; Returns: undefined }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "atendimento" | "gerente" | "master"
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
      app_role: ["atendimento", "gerente", "master"],
      contact_type: ["ligação", "mensagem"],
    },
  },
} as const
