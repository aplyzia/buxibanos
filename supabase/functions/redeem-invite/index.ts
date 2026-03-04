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
    const { invite_code, password, action } = await req.json();

    if (!invite_code) {
      return json({ error: "invite_code required" }, 400);
    }

    // Look up parent by invite code
    const { data: parent, error: lookupError } = await supabaseAdmin
      .from("parents")
      .select("id, full_name, email, supabase_user_id, student_ids, organization_id, marketing_consent")
      .eq("invite_code", invite_code.trim().toUpperCase())
      .single();

    if (lookupError || !parent) {
      return json({ error: "Invalid invite code. Please check and try again." }, 404);
    }

    // ── action: "lookup" — just validate code and return info ────────────
    if (action === "lookup") {
      // Fetch student names
      const studentNames: string[] = [];
      if (parent.student_ids?.length > 0) {
        const { data: students } = await supabaseAdmin
          .from("students")
          .select("full_name")
          .in("id", parent.student_ids);
        studentNames.push(...(students ?? []).map((s: any) => s.full_name));
      }

      return json({
        parent_name: parent.full_name,
        email: parent.email,
        student_names: studentNames,
        already_registered: !!parent.supabase_user_id,
      });
    }

    // ── action: "register" — create auth account + return session ────────
    if (action === "register") {
      if (!password || password.length < 8) {
        return json({ error: "Password must be at least 8 characters." }, 400);
      }

      if (parent.supabase_user_id) {
        return json({ error: "This invite has already been used. Please sign in with your email." }, 409);
      }

      // Create Supabase auth user
      const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: parent.email,
        password,
        email_confirm: true, // skip email verification for invite-based flow
      });

      if (createError) {
        // User might already exist in auth but not linked
        if (createError.message.includes("already registered")) {
          return json({ error: "An account with this email already exists. Please sign in." }, 409);
        }
        return json({ error: createError.message }, 500);
      }

      // Link supabase_user_id to parent record
      await supabaseAdmin
        .from("parents")
        .update({ supabase_user_id: authData.user.id })
        .eq("id", parent.id);

      // Sign in to get a session
      const supabaseAnon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
        email: parent.email,
        password,
      });

      if (signInError) {
        return json({ error: "Account created but sign-in failed. Please sign in manually." }, 500);
      }

      return json({
        session: signInData.session,
        parent_name: parent.full_name,
        needs_consent: parent.marketing_consent === null,
      });
    }

    return json({ error: "Invalid action" }, 400);

  } catch (err) {
    console.error("redeem-invite error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
