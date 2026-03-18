import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface AuthContext {
  organization_id: string;
  key_id: string | null;
  actor_label: string;
  supabase: SupabaseClient;
}

async function hashKey(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function authenticate(
  req: Request
): Promise<AuthContext | Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Try API key first ──
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const keyHash = await hashKey(apiKey);

    const { data: result, error } = await supabase.rpc("validate_api_key", {
      p_key_hash: keyHash,
    });

    if (error || !result?.valid) {
      const msg = result?.error ?? error?.message ?? "Invalid API key";
      const status = msg === "Rate limit exceeded" ? 429 : 401;
      return json({ error: msg }, status);
    }

    return {
      organization_id: result.organization_id,
      key_id: result.key_id,
      actor_label: `api:${result.label}`,
      supabase,
    };
  }

  // ── Fall back to Bearer token ──
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Look up staff record
    const { data: staff } = await supabase
      .from("staff")
      .select("organization_id, full_name, role")
      .eq("supabase_user_id", user.id)
      .eq("is_active", true)
      .single();

    if (staff) {
      return {
        organization_id: staff.organization_id,
        key_id: null,
        actor_label: `staff:${staff.full_name}`,
        supabase,
      };
    }

    return json({ error: "No staff record found for user" }, 403);
  }

  return json(
    { error: "Missing x-api-key header or Authorization Bearer token" },
    401
  );
}

export { hashKey };

export async function logApiCall(
  supabase: SupabaseClient,
  params: {
    key_id: string | null;
    organization_id: string;
    endpoint: string;
    request_body?: unknown;
    response_status: number;
    response_summary: string;
    duration_ms: number;
  }
) {
  await supabase.from("agent_api_log").insert({
    key_id: params.key_id,
    organization_id: params.organization_id,
    endpoint: params.endpoint,
    request_body: params.request_body,
    response_status: params.response_status,
    response_summary: params.response_summary,
    duration_ms: params.duration_ms,
  });
}

/** Resolve a name to a record, supporting both `_name` and `_id` inputs. */
export async function resolveName(
  supabase: SupabaseClient,
  table: string,
  orgId: string,
  nameOrId: string,
  nameColumn = "full_name"
): Promise<{ id: string; full_name: string } | null> {
  // Try UUID first
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(nameOrId)) {
    const { data } = await supabase
      .from(table)
      .select("id, full_name")
      .eq("id", nameOrId)
      .eq("organization_id", orgId)
      .single();
    return data;
  }

  // Fall back to name lookup
  const { data } = await supabase
    .from(table)
    .select("id, full_name")
    .eq(nameColumn, nameOrId)
    .eq("organization_id", orgId);

  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    throw new Error(
      `Ambiguous name "${nameOrId}" — ${data.length} matches in ${table}. Use an ID instead.`
    );
  }
  return data[0];
}
