// Auto-generate with: supabase gen types typescript --local > src/types/database.ts
// This file is a starter based on Tech Spec v1 schema

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          settings: Json;
          google_drive_folder_id: string | null;
          notification_config: Json;
          subscription_tier: "starter" | "standard" | "premium";
          school_policies: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["organizations"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          display_name: string | null;
          nicknames: string[];
          grade_level: string;
          class_ids: string[];
          assigned_teacher_id: string;
          enrollment_status: "active" | "paused" | "withdrawn";
          enrollment_date: string;
          marketing_consent: boolean;
          grade_records: Json;
          special_needs: string | null;
          communication_notes: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["students"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["students"]["Row"]>;
        Relationships: [];
      };
      parents: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          app_user_id: string | null;       // Line user ID (OAuth) or Supabase UUID
          invite_code: string | null;
          supabase_user_id: string | null;
          push_token: string | null;
          student_ids: string[];
          notification_pref: "all" | "urgent_only" | "urgent_and_digest" | "digest_only";
          preferred_language: string;
          marketing_consent: boolean | null;
          last_active_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["parents"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["parents"]["Row"]>;
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          role: "director" | "teacher" | "admin" | "front_desk";
          supabase_user_id: string;
          push_token: string | null;
          notification_pref: "all" | "urgent_only" | "urgent_and_digest" | "digest_only";
          is_active: boolean;
          subjects: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["staff"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["staff"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          organization_id: string;
          thread_id: string | null;
          sender_name: string;
          sender_type: "parent" | "teacher" | "student" | "admin";
          sender_user_id: string | null;
          receiver_name: string;
          receiver_type: "parent" | "teacher" | "student" | "admin";
          primary_student: string | null;
          additional_students: string[];
          message_type: "attendance" | "payment" | "schedule" | "complaint" | "inquiry" | "emergency" | "general";
          priority: "high" | "medium" | "low";
          action_required: boolean;
          summary: string | null;
          context: string | null;
          original_content: string;
          media_urls: Json;
          confidence: "high" | "medium" | "low" | null;
          reasoning: string | null;
          staff_responded: boolean;
          response_at: string | null;
          processed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["messages"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          category: "handout" | "policy" | "form" | "report" | "other";
          summary: string | null;
          tags: string[];
          file_url: string;
          drive_file_id: string | null;
          mime_type: string;
          extracted_text: string | null;
          embedding: number[] | null;
          uploaded_by: string;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["documents"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
        Relationships: [];
      };
      fee_records: {
        Row: {
          id: string;
          organization_id: string;
          student_id: string;
          period: string;
          amount_ntd: number;
          status: "pending" | "paid" | "overdue" | "waived";
          due_date: string;
          paid_date: string | null;
          payment_method: "cash" | "bank_transfer" | "other" | null;
          notes: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["fee_records"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["fee_records"]["Row"]>;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          organization_id: string;
          student_id: string;
          class_id: string;
          date: string;
          status: "present" | "absent" | "tardy" | "excused";
          recorded_by: string;
          parent_notified: boolean;
          notes: string | null;
          source: "manual" | "auto_message";
          source_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["attendance"]["Row"],
          "id" | "created_at" | "updated_at" | "source"
        > & { source?: "manual" | "auto_message" };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Row"]>;
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          subject: "math" | "english" | "science" | "chinese" | "other";
          teacher_id: string;
          schedule: Json;
          max_students: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["classes"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["classes"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          source_type: "ai_detected" | "manual" | "system";
          source_message_id: string | null;
          source_student_id: string | null;
          priority: "high" | "medium" | "low";
          status: "pending" | "completed" | "dismissed";
          assigned_to: string | null;
          completed_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tasks"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          body: string;
          media_urls: Json;
          target_type: "all" | "by_class" | "individual";
          target_class_ids: string[];
          target_parent_ids: string[];
          response_options: Json | null;
          allow_free_text: boolean;
          expires_at: string | null;
          priority: "normal" | "urgent";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["announcements"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "media_urls"
          | "target_type"
          | "target_class_ids"
          | "target_parent_ids"
          | "response_options"
          | "allow_free_text"
          | "expires_at"
          | "priority"
        > & {
          media_urls?: Json;
          target_type?: "all" | "by_class" | "individual";
          target_class_ids?: string[];
          target_parent_ids?: string[];
          response_options?: Json | null;
          allow_free_text?: boolean;
          expires_at?: string | null;
          priority?: "normal" | "urgent";
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Row"]>;
        Relationships: [];
      };
      announcement_recipients: {
        Row: {
          id: string;
          announcement_id: string;
          parent_id: string;
          status: "sent" | "viewed" | "responded" | "dismissed";
          response_value: string | null;
          free_text_value: string | null;
          viewed_at: string | null;
          responded_at: string | null;
          dismissed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["announcement_recipients"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "response_value"
          | "free_text_value"
          | "viewed_at"
          | "responded_at"
          | "dismissed_at"
        > & {
          status?: "sent" | "viewed" | "responded" | "dismissed";
          response_value?: string | null;
          free_text_value?: string | null;
          viewed_at?: string | null;
          responded_at?: string | null;
          dismissed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["announcement_recipients"]["Row"]>;
        Relationships: [];
      };
      channels: {
        Row: {
          id: string;
          organization_id: string;
          name: string | null;
          type: "direct" | "group";
          created_by: string;
          priority: "high" | "medium" | "low";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["channels"]["Row"],
          "id" | "created_at" | "updated_at" | "priority"
        > & { priority?: "high" | "medium" | "low" };
        Update: Partial<Database["public"]["Tables"]["channels"]["Row"]>;
        Relationships: [];
      };
      channel_members: {
        Row: {
          id: string;
          channel_id: string;
          staff_id: string;
          last_read_at: string;
          joined_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["channel_members"]["Row"],
          "id" | "joined_at" | "last_read_at"
        >;
        Update: Partial<Database["public"]["Tables"]["channel_members"]["Row"]>;
        Relationships: [];
      };
      channel_messages: {
        Row: {
          id: string;
          channel_id: string;
          sender_id: string;
          content: string;
          media_urls: Json;
          reply_to_id: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["channel_messages"]["Row"],
          "id" | "created_at" | "reply_to_id" | "deleted_at"
        > & { reply_to_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["channel_messages"]["Row"]> & { deleted_at?: string | null };
        Relationships: [];
      };
      channel_tasks: {
        Row: {
          id: string;
          channel_id: string;
          title: string;
          assigned_to: string | null;
          created_by: string;
          is_completed: boolean;
          completed_by: string | null;
          completed_at: string | null;
          is_pinned: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["channel_tasks"]["Row"],
          "id" | "created_at" | "is_completed" | "is_pinned"
        >;
        Update: Partial<Database["public"]["Tables"]["channel_tasks"]["Row"]>;
        Relationships: [];
      };
      channel_events: {
        Row: {
          id: string;
          channel_id: string;
          title: string;
          event_at: string;
          created_by: string;
          is_pinned: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["channel_events"]["Row"],
          "id" | "created_at" | "is_pinned"
        >;
        Update: Partial<Database["public"]["Tables"]["channel_events"]["Row"]>;
        Relationships: [];
      };
      briefings: {
        Row: {
          id: string;
          organization_id: string;
          type: "morning" | "weekly";
          brief_date: string;
          content: Json;
          generated_at: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["briefings"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["briefings"]["Row"]>;
        Relationships: [];
      };
      photo_media: {
        Row: {
          id: string;
          organization_id: string;
          event_name: string | null;
          file_url: string;
          uploaded_by: string;
          marketing_consent_verified: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["photo_media"]["Row"],
          "id" | "created_at" | "marketing_consent_verified"
        >;
        Update: Partial<Database["public"]["Tables"]["photo_media"]["Row"]>;
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          organization_id: string;
          key_hash: string;
          key_prefix: string;
          label: string;
          scopes: string[];
          is_active: boolean;
          rate_limit_per_minute: number;
          created_at: string;
          expires_at: string | null;
          last_used_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["api_keys"]["Row"],
          "id" | "created_at" | "is_active" | "rate_limit_per_minute" | "scopes"
        >;
        Update: Partial<Database["public"]["Tables"]["api_keys"]["Row"]>;
        Relationships: [];
      };
      api_key_usage: {
        Row: {
          key_id: string;
          window_start: string;
          request_count: number;
        };
        Insert: Database["public"]["Tables"]["api_key_usage"]["Row"];
        Update: Partial<Database["public"]["Tables"]["api_key_usage"]["Row"]>;
        Relationships: [];
      };
      agent_api_log: {
        Row: {
          id: string;
          key_id: string | null;
          organization_id: string;
          endpoint: string;
          method: string;
          request_body: Json | null;
          response_status: number | null;
          response_summary: string | null;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["agent_api_log"]["Row"],
          "id" | "created_at" | "method"
        >;
        Update: Partial<Database["public"]["Tables"]["agent_api_log"]["Row"]>;
        Relationships: [];
      };
      workflow_errors: {
        Row: {
          id: string;
          organization_id: string;
          workflow_name: string;
          error_message: string | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["workflow_errors"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["workflow_errors"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_channel_with_members: {
        Args: {
          p_organization_id: string;
          p_name: string | null;
          p_type: "direct" | "group";
          p_created_by: string;
          p_member_ids: string[];
        };
        Returns: string;
      };
      populate_announcement_recipients: {
        Args: { p_announcement_id: string };
        Returns: undefined;
      };
      get_announcement_analytics: {
        Args: { p_announcement_id: string };
        Returns: Json;
      };
      get_user_organization_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      validate_api_key: {
        Args: { p_key_hash: string };
        Returns: Json;
      };
      upsert_attendance_by_name: {
        Args: { p_org_id: string; p_records: Json };
        Returns: Json;
      };
    };
  };
}

// Convenience types
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Student = Database["public"]["Tables"]["students"]["Row"];
export type Parent = Database["public"]["Tables"]["parents"]["Row"];
export type Staff = Database["public"]["Tables"]["staff"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type FeeRecord = Database["public"]["Tables"]["fee_records"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
export type Class = Database["public"]["Tables"]["classes"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
export type AnnouncementRecipient = Database["public"]["Tables"]["announcement_recipients"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type ChannelMember = Database["public"]["Tables"]["channel_members"]["Row"];
export type ChannelMessage = Database["public"]["Tables"]["channel_messages"]["Row"];
export type ChannelTask = Database["public"]["Tables"]["channel_tasks"]["Row"];
export type ChannelEvent = Database["public"]["Tables"]["channel_events"]["Row"];
export type Briefing = Database["public"]["Tables"]["briefings"]["Row"];
export type ApiKey = Database["public"]["Tables"]["api_keys"]["Row"];
export type AgentApiLog = Database["public"]["Tables"]["agent_api_log"]["Row"];
export type WorkflowError = Database["public"]["Tables"]["workflow_errors"]["Row"];
