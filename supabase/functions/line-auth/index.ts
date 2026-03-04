import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { code, redirect_uri, invite_code } = await req.json();

    if (!code || !redirect_uri) {
      return json({ error: "code and redirect_uri are required" }, 400);
    }

    const LINE_CHANNEL_ID = Deno.env.get("LINE_CHANNEL_ID")!;
    const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET")!;

    // ── Step 1: Exchange authorization code for LINE access token ────────
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("LINE token exchange failed:", tokenData);
      return json({ error: "Failed to exchange LINE authorization code" }, 400);
    }

    // ── Step 2: Get LINE user profile ────────────────────────────────────
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const lineUserId: string = profile.userId;
    const displayName: string = profile.displayName ?? "";

    if (!lineUserId) {
      return json({ error: "Failed to get LINE user profile" }, 400);
    }

    // ── Step 3: Find parent by LINE user ID ──────────────────────────────
    let { data: parent } = await supabaseAdmin
      .from("parents")
      .select("*")
      .eq("app_user_id", lineUserId)
      .maybeSingle();

    // ── Step 4: If not found, try linking via invite code ─────────────────
    if (!parent && invite_code) {
      const { data: inviteParent } = await supabaseAdmin
        .from("parents")
        .select("*")
        .eq("invite_code", invite_code.trim().toUpperCase())
        .maybeSingle();

      if (!inviteParent) {
        return json({ error: "Invalid invite code. Please check and try again." }, 404);
      }

      // If already registered via email (has supabase_user_id, no LINE ID yet)
      if (inviteParent.supabase_user_id && !inviteParent.app_user_id) {
        return json({
          error: "This account was registered with email. Please sign in with your email address instead.",
        }, 409);
      }

      // Already registered via LINE with same account (shouldn't happen but handle)
      if (inviteParent.supabase_user_id && inviteParent.app_user_id) {
        return json({ error: "This invite has already been used." }, 409);
      }

      // Link LINE ID to parent record (will create Supabase user below)
      parent = inviteParent;
    }

    if (!parent) {
      return json({
        error: "No parent account found for this LINE profile. Please enter your invite code first.",
      }, 404);
    }

    // ── Step 5: Derive deterministic Supabase credentials from LINE ID ───
    const lineEmail = `line_${lineUserId}@line.buxibanos.internal`;
    const linePassword = await derivePassword(LINE_CHANNEL_SECRET, lineUserId);

    // ── Step 6: Create Supabase auth user if not yet registered ──────────
    if (!parent.supabase_user_id) {
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: lineEmail,
        password: linePassword,
        email_confirm: true,
        user_metadata: {
          line_user_id: lineUserId,
          display_name: displayName,
          full_name: parent.full_name,
        },
      });

      if (createError) {
        // User already exists in auth (edge case) — fetch them
        if (!createError.message.includes("already registered")) {
          console.error("createUser error:", createError);
          return json({ error: createError.message }, 500);
        }
      }

      const newUserId = authData?.user?.id;
      if (newUserId) {
        // Link supabase_user_id and app_user_id to parent record
        await supabaseAdmin
          .from("parents")
          .update({ supabase_user_id: newUserId, app_user_id: lineUserId })
          .eq("id", parent.id);
      }
    } else if (!parent.app_user_id) {
      // Existing Supabase user but LINE ID not yet linked
      await supabaseAdmin
        .from("parents")
        .update({ app_user_id: lineUserId })
        .eq("id", parent.id);
    }

    // ── Step 7: Sign in with derived credentials ──────────────────────────
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: lineEmail,
      password: linePassword,
    });

    if (signInError) {
      console.error("signIn error:", signInError);
      return json({ error: "Sign-in failed. Please try again." }, 500);
    }

    return json({
      session: signInData.session,
      parent_name: parent.full_name,
    });

  } catch (err) {
    console.error("line-auth error:", err);
    return json({ error: String(err) }, 500);
  }
});

/** HMAC-SHA256(secret, message) → hex string */
async function derivePassword(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
