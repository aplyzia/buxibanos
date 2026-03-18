import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, hashKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    if (!action || !["create", "list", "revoke"].includes(action)) {
      return json({ error: "action must be 'create', 'list', or 'revoke'" }, 400);
    }

    // Bearer token auth only — must be director or admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Bearer token required (director/admin only)" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: staff } = await supabase
      .from("staff")
      .select("id, organization_id, full_name, role")
      .eq("supabase_user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!staff || !["director", "admin"].includes(staff.role)) {
      return json({ error: "Director or admin role required" }, 403);
    }

    const orgId = staff.organization_id;

    // ── CREATE ──
    if (action === "create") {
      const label = body.label || "default";
      const rateLimitPerMinute = body.rate_limit_per_minute || 60;

      // Generate key: eddy_ + 32 random hex chars
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const hex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const rawKey = `eddy_${hex}`;
      const keyPrefix = rawKey.substring(0, 12);
      const keyHash = await hashKey(rawKey);

      const { data: inserted, error: insertError } = await supabase
        .from("api_keys")
        .insert({
          organization_id: orgId,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          label,
          rate_limit_per_minute: rateLimitPerMinute,
        })
        .select("id, key_prefix, label, created_at")
        .single();

      if (insertError) {
        return json({ error: insertError.message }, 500);
      }

      // Return the raw key exactly once — it cannot be retrieved again
      return json({
        api_key: rawKey,
        key_id: inserted.id,
        key_prefix: inserted.key_prefix,
        label: inserted.label,
        created_at: inserted.created_at,
        warning: "Save this key now — it cannot be retrieved again.",
      });
    }

    // ── LIST ──
    if (action === "list") {
      const { data: keys } = await supabase
        .from("api_keys")
        .select("id, key_prefix, label, is_active, rate_limit_per_minute, created_at, expires_at, last_used_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      return json({ keys: keys || [] });
    }

    // ── REVOKE ──
    if (action === "revoke") {
      const keyId = body.key_id;
      if (!keyId) {
        return json({ error: "key_id required" }, 400);
      }

      const { error: updateError } = await supabase
        .from("api_keys")
        .update({ is_active: false })
        .eq("id", keyId)
        .eq("organization_id", orgId);

      if (updateError) {
        return json({ error: updateError.message }, 500);
      }

      return json({ revoked: true, key_id: keyId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("agent-manage-keys error:", err);
    return json({ error: String(err) }, 500);
  }
});
