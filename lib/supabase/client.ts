import { createClient } from "@supabase/supabase-js";

type LearnerProgressRow = { user_id: string; save_key: string; payload: string; revision: number };
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
