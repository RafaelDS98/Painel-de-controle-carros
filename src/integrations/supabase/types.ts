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
          contact: string
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
          manager_edit_used: boolean
          model: string
          note: string
          operator: string
          original_deadline: string | null
          plate: string
          priority_urgent: boolean
          registered_at: string | null
          rework_of: string | null
          rework_reason: string | null
          sgloc_reference: string | null
          sheet_id: string
          status: string
          store: string
          time: string
          workshop: string
        }
        Insert: {
          contact?: string
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
          manager_edit_used?: boolean
          model?: string
          note?: string
          operator?: string
          original_deadline?: string | null
          plate?: string
          priority_urgent?: boolean
          registered_at?: string | null
          rework_of?: string | null
          rework_reason?: string | null
          sgloc_reference?: string | null
          sheet_id?: string
          status?: string
          store?: string
          time?: string
          workshop?: string
        }
        Update: {
          contact?: string
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
          manager_edit_used?: boolean
          model?: string
          note?: string
          operator?: string
          original_deadline?: string | null
          plate?: string
          priority_urgent?: boolean
          registered_at?: string | null
          rework_of?: string | null
          rework_reason?: string | null
          sgloc_reference?: string | null
          sheet_id?: string
          status?: string
          store?: string
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
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_access: { Args: { _user_id: string }; Returns: boolean }
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
