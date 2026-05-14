import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton - avoids module-level throws during build when env vars aren't set
let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
    );
  }
  _client = createClient(url, key);
  return _client;
}

// Named export for convenience in client components
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Service-role client - only use in API routes (server-side only)
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export type Job = {
  id: string;
  chain_job_id: number;
  description: string;
  category: string;
  client_address: string;
  provider_address: string | null;
  created_at: string;
  updated_at: string;
};

export type Evaluation = {
  id: string;
  job_id: string;
  chain_job_id: number;
  decision: "approve" | "reject";
  reasoning: string;
  confidence: number;
  evaluated_at: string;
  evaluator: string;
};

export type Deliverable = {
  id: string;
  job_id: string;
  chain_job_id: number;
  ipfs_cid: string | null;
  deliverable_hash: string;
  content_preview: string | null;
  submitted_at: string;
};
