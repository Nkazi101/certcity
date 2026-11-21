import { createClient } from "@supabase/supabase-js";

type LearnerProgressRow = { user_id: string; save_key: string; payload: string; revision: number };
type ItemReportInsert = { id: string; track_id: string; guide: string; item_id: string; form: string | null; content_revision: string | null; report_type: string; details: string };
type HealthEventInsert = { event_type: string; release: string; surface: string; elapsed_ms: number | null };
type Database = {
  public: {
    Tables: {
      learner_progress: {
        Row: LearnerProgressRow;
        Insert: Omit<LearnerProgressRow, "revision">;
        Update: Partial<Pick<LearnerProgressRow, "payload" | "revision">>;
        Relationships: [];
      };
      simulation_runs: {
        Row: { id: string; user_id: string; track_id: string; mission_id: string; policy: unknown; passed: boolean; committed_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      practice_item_reports: {
        Row: ItemReportInsert & { user_id: string; created_at: string };
        Insert: ItemReportInsert;
        Update: never;
        Relationships: [];
      };
      study_email_preferences: {
        Row: { user_id: string; enabled_at: string };
        Insert: { user_id: string };
        Update: never;
        Relationships: [];
      };
      client_health_events: {
        Row: HealthEventInsert & { user_id: string; event_day: string };
        Insert: HealthEventInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabase() {
  if (typeof window === "undefined" || !url || !key) return null;
  client ??= createClient<Database>(url, key, { auth: { flowType: "pkce" } });
  return client;
}
