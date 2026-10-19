/**
 * Supabase schema types for the Aegis project.
 *
 * Regenerate with `pnpm db:types` after changing `supabase/migrations`. The file
 * is trimmed to the tables, enums and RPCs this application uses; the shape is
 * compatible with `supabase gen types typescript`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Relationships = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}[];

export type RiskLevelDb = "low" | "medium" | "high" | "critical";
export type UserRoleDb = "admin" | "analyst" | "viewer";

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          organization_id: string;
          external_ref: string;
          entity_id: string;
          country: string;
          currency: string;
          status: "active" | "frozen" | "closed";
          opened_at: string;
          risk_tier: RiskLevelDb;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          external_ref: string;
          entity_id: string;
          country: string;
          currency: string;
          status?: "active" | "frozen" | "closed";
          opened_at?: string;
          risk_tier?: RiskLevelDb;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: Relationships;
      };
      alert_events: {
        Row: {
          id: string;
          alert_id: string;
          actor_id: string | null;
          event_type: "created" | "assigned" | "status_changed" | "note_added" | "escalated" | "exported";
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          alert_id: string;
          actor_id?: string | null;
          event_type: Database["public"]["Tables"]["alert_events"]["Row"]["event_type"];
          payload?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alert_events"]["Insert"]>;
        Relationships: Relationships;
      };
      alerts: {
        Row: {
          id: string;
          organization_id: string;
          transaction_id: string;
          rule_id: string | null;
          title: string;
          severity: RiskLevelDb;
          status: "new" | "investigating" | "escalated" | "resolved" | "false_positive";
          assignee_id: string | null;
          due_at: string | null;
          first_seen_at: string;
          resolved_at: string | null;
          resolution_note: string | null;
          summary: string;
          score_snapshot: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          transaction_id: string;
          rule_id?: string | null;
          title: string;
          severity: RiskLevelDb;
          status?: Database["public"]["Tables"]["alerts"]["Row"]["status"];
          assignee_id?: string | null;
          due_at?: string | null;
          first_seen_at?: string;
          resolved_at?: string | null;
          resolution_note?: string | null;
          summary?: string;
          score_snapshot?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
        Relationships: Relationships;
      };
      api_idempotency: {
        Row: {
          organization_id: string;
          idempotency_key: string;
          endpoint: string;
          created_by: string | null;
          response: Json;
          status_code: number;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          organization_id: string;
          idempotency_key: string;
          endpoint: string;
          created_by?: string | null;
          response: Json;
          status_code?: number;
          created_at?: string;
          expires_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["api_idempotency"]["Insert"]>;
        Relationships: Relationships;
      };
      api_keys: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          prefix: string;
          key_hash: string;
          scopes: string[];
          created_by: string | null;
          last_used_at: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          prefix: string;
          key_hash: string;
          scopes?: string[];
          created_by?: string | null;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["api_keys"]["Insert"]>;
        Relationships: Relationships;
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Json;
          ip: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          metadata?: Json;
          ip?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: Relationships;
      };
      case_alerts: {
        Row: { case_id: string; alert_id: string; created_at: string };
        Insert: { case_id: string; alert_id: string; created_at?: string };
        Update: { case_id?: string; alert_id?: string; created_at?: string };
        Relationships: Relationships;
      };
      case_attachments: {
        Row: {
          id: string;
          case_id: string;
          storage_path: string;
          filename: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          storage_path: string;
          filename: string;
          mime_type: string;
          size_bytes: number;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["case_attachments"]["Insert"]>;
        Relationships: Relationships;
      };
      case_entities: {
        Row: { case_id: string; entity_id: string; created_at: string };
        Insert: { case_id: string; entity_id: string; created_at?: string };
        Update: { case_id?: string; entity_id?: string; created_at?: string };
        Relationships: Relationships;
      };
      case_notes: {
        Row: {
          id: string;
          case_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["case_notes"]["Insert"]>;
        Relationships: Relationships;
      };
      cases: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          status: "open" | "in_review" | "closed";
          priority: "low" | "medium" | "high" | "critical";
          owner_id: string | null;
          summary: string;
          created_from_alert_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          status?: "open" | "in_review" | "closed";
          priority?: "low" | "medium" | "high" | "critical";
          owner_id?: string | null;
          summary?: string;
          created_from_alert_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cases"]["Insert"]>;
        Relationships: Relationships;
      };
      contact_requests: {
        Row: {
          id: string;
          name: string;
          email: string;
          company: string;
          message: string;
          intent: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          company?: string;
          message: string;
          intent?: string;
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_requests"]["Insert"]>;
        Relationships: Relationships;
      };
      entities: {
        Row: {
          id: string;
          organization_id: string;
          kind: "individual" | "company" | "intermediary";
          legal_name: string;
          country: string;
          incorporated_on: string | null;
          registration_number: string | null;
          pep_flag: boolean;
          nominee_director_name: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: "individual" | "company" | "intermediary";
          legal_name: string;
          country: string;
          incorporated_on?: string | null;
          registration_number?: string | null;
          pep_flag?: boolean;
          nominee_director_name?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["entities"]["Insert"]>;
        Relationships: Relationships;
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          type:
            | "alert_assigned"
            | "alert_escalated"
            | "case_mention"
            | "case_assigned"
            | "report_ready"
            | "digest"
            | "system";
          title: string;
          body: string;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          type: Database["public"]["Tables"]["notifications"]["Row"]["type"];
          title: string;
          body?: string;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: Relationships;
      };
      organization_invites: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: UserRoleDb;
          token_hash: string;
          expires_at: string;
          accepted_at: string | null;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: UserRoleDb;
          token_hash: string;
          expires_at: string;
          accepted_at?: string | null;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_invites"]["Insert"]>;
        Relationships: Relationships;
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["newsletter_subscribers"]["Insert"]>;
        Relationships: Relationships;
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          timezone: string;
          base_currency: string;
          require_mfa: boolean;
          plan: string;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          base_currency?: string;
          require_mfa?: boolean;
          plan?: string;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: Relationships;
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          email: string;
          role: UserRoleDb;
          full_name: string;
          avatar_url: string | null;
          timezone: string;
          language: string;
          notification_prefs: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          email: string;
          role?: UserRoleDb;
          full_name?: string;
          avatar_url?: string | null;
          timezone?: string;
          language?: string;
          notification_prefs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: Relationships;
      };
      report_schedules: {
        Row: {
          id: string;
          organization_id: string;
          kind: "sar_summary" | "daily_digest" | "audit_log";
          format: "csv" | "pdf";
          send_at: string;
          timezone: string;
          recipients: string[];
          enabled: boolean;
          last_run_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind?: "sar_summary" | "daily_digest" | "audit_log";
          format?: "csv" | "pdf";
          send_at?: string;
          timezone?: string;
          recipients?: string[];
          enabled?: boolean;
          last_run_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["report_schedules"]["Insert"]>;
        Relationships: Relationships;
      };
      reports: {
        Row: {
          id: string;
          organization_id: string;
          kind: "sar_summary" | "daily_digest" | "audit_log";
          date_from: string;
          date_to: string;
          status: "queued" | "running" | "ready" | "failed";
          storage_path: string | null;
          format: "csv" | "pdf";
          requested_by: string | null;
          params: Json;
          row_count: number | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: "sar_summary" | "daily_digest" | "audit_log";
          date_from: string;
          date_to: string;
          status?: "queued" | "running" | "ready" | "failed";
          storage_path?: string | null;
          format?: "csv" | "pdf";
          requested_by?: string | null;
          params?: Json;
          row_count?: number | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: Relationships;
      };
      rule_versions: {
        Row: {
          id: string;
          rule_id: string;
          version: number;
          definition: Json;
          definition_hash: string;
          is_draft: boolean;
          published_at: string | null;
          published_by: string | null;
          change_note: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rule_id: string;
          version: number;
          definition: Json;
          definition_hash: string;
          is_draft?: boolean;
          published_at?: string | null;
          published_by?: string | null;
          change_note?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rule_versions"]["Insert"]>;
        Relationships: Relationships;
      };
      rules: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string;
          status: "draft" | "active" | "disabled";
          current_version_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string;
          status?: "draft" | "active" | "disabled";
          current_version_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rules"]["Insert"]>;
        Relationships: Relationships;
      };
      transactions: {
        Row: {
          id: string;
          organization_id: string;
          external_id: string;
          sender_account_id: string;
          receiver_account_id: string;
          sender_name: string;
          receiver_name: string;
          amount: number;
          currency: string;
          amount_base: number;
          sender_country: string;
          receiver_country: string;
          corridor: string | null;
          channel: string;
          purpose_code: string | null;
          status: "settled" | "pending" | "blocked" | "review";
          risk_score: number | null;
          risk_level: RiskLevelDb | null;
          score_ms: number | null;
          risk_factors: Json;
          scored_at: string | null;
          model_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          external_id: string;
          sender_account_id: string;
          receiver_account_id: string;
          sender_name?: string;
          receiver_name?: string;
          amount: number;
          currency: string;
          amount_base: number;
          sender_country: string;
          receiver_country: string;
          channel?: string;
          purpose_code?: string | null;
          status?: "settled" | "pending" | "blocked" | "review";
          risk_score?: number | null;
          risk_level?: RiskLevelDb | null;
          score_ms?: number | null;
          risk_factors?: Json;
          scored_at?: string | null;
          model_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: Relationships;
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_timezone?: string; p_base_currency?: string };
        Returns: string;
      };
      accept_invite: { Args: { p_token: string }; Returns: string };
      publish_rule: { Args: { p_rule_id: string; p_change_note?: string }; Returns: string };
      restore_rule_version: { Args: { p_version_id: string }; Returns: string };
      update_own_profile: {
        Args: {
          p_full_name: string;
          p_timezone: string;
          p_language: string;
          p_notification_prefs?: Json;
        };
        Returns: undefined;
      };
      notify_case_mention: {
        Args: { p_case_id: string; p_user_id: string; p_body: string };
        Returns: undefined;
      };
      verify_api_key: {
        Args: { p_hash: string };
        Returns: { key_id: string; organization_id: string; created_by: string; scopes: string[] }[];
      };
      write_audit: {
        Args: { p_action: string; p_target_type: string; p_target_id?: string; p_metadata?: Json };
        Returns: string;
      };
      alert_status_transition_allowed: {
        Args: {
          p_from: Database["public"]["Tables"]["alerts"]["Row"]["status"];
          p_to: Database["public"]["Tables"]["alerts"]["Row"]["status"];
        };
        Returns: boolean;
      };
      current_org_id: { Args: never; Returns: string | null };
      current_role: { Args: never; Returns: UserRoleDb | null };
    };
    Enums: {
      account_status: "active" | "frozen" | "closed";
      alert_event_type: "created" | "assigned" | "status_changed" | "note_added" | "escalated" | "exported";
      alert_status: "new" | "investigating" | "escalated" | "resolved" | "false_positive";
      case_priority: "low" | "medium" | "high" | "critical";
      case_status: "open" | "in_review" | "closed";
      entity_kind: "individual" | "company" | "intermediary";
      notification_type:
        | "alert_assigned"
        | "alert_escalated"
        | "case_mention"
        | "case_assigned"
        | "report_ready"
        | "digest"
        | "system";
      report_format: "csv" | "pdf";
      report_kind: "sar_summary" | "daily_digest" | "audit_log";
      report_status: "queued" | "running" | "ready" | "failed";
      risk_level: RiskLevelDb;
      rule_status: "draft" | "active" | "disabled";
      transaction_status: "settled" | "pending" | "blocked" | "review";
      user_role: UserRoleDb;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
