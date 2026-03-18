import { authenticate, json, corsHeaders, resolveName, logApiCall } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const { supabase, organization_id, key_id } = auth;

    // ── Validate ──
    if (!body.title) return json({ error: "title is required" }, 400);
    if (!body.body) return json({ error: "body is required" }, 400);
    if (!body.created_by_name && !body.created_by_id) {
      return json({ error: "created_by_name or created_by_id is required" }, 400);
    }

    const validTargetTypes = ["all", "by_class", "individual"];
    const targetType = body.target_type || "all";
    if (!validTargetTypes.includes(targetType)) {
      return json({ error: `target_type must be one of: ${validTargetTypes.join(", ")}` }, 400);
    }

    if (targetType === "by_class" && (!body.target_class_ids || body.target_class_ids.length === 0)) {
      return json({ error: "target_class_ids required when target_type is 'by_class'" }, 400);
    }
    if (targetType === "individual" && (!body.target_parent_ids || body.target_parent_ids.length === 0)) {
      return json({ error: "target_parent_ids required when target_type is 'individual'" }, 400);
    }

    const validPriorities = ["normal", "urgent"];
    const priority = body.priority || "normal";
    if (!validPriorities.includes(priority)) {
      return json({ error: `priority must be 'normal' or 'urgent'` }, 400);
    }

    // ── Resolve creator ──
    const staff = await resolveName(
      supabase, "staff", organization_id,
      body.created_by_id || body.created_by_name
    );
    if (!staff) {
      return json({ error: `Staff "${body.created_by_name || body.created_by_id}" not found` }, 400);
    }

    // ── Validate class IDs belong to org ──
    if (targetType === "by_class") {
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("organization_id", organization_id)
        .in("id", body.target_class_ids);

      if (!classes || classes.length !== body.target_class_ids.length) {
        return json({ error: "One or more target_class_ids not found in this organization" }, 400);
      }
    }

    // ── Insert announcement ──
    const { data: ann, error: insertError } = await supabase
      .from("announcements")
      .insert({
        organization_id,
        title: body.title,
        body: body.body,
        created_by: staff.id,
        target_type: targetType,
        target_class_ids: body.target_class_ids || [],
        target_parent_ids: body.target_parent_ids || [],
        priority,
        media_urls: body.media_urls || [],
        response_options: body.response_options || null,
        allow_free_text: body.allow_free_text || false,
      })
      .select("id")
      .single();

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    // ── Populate recipients ──
    const { error: rpcError } = await supabase.rpc("populate_announcement_recipients", {
      p_announcement_id: ann.id,
    });

    if (rpcError) {
      console.error("populate_announcement_recipients error:", rpcError);
    }

    // Count recipients
    const { count } = await supabase
      .from("announcement_recipients")
      .select("id", { count: "exact", head: true })
      .eq("announcement_id", ann.id);

    const duration = Date.now() - start;
    await logApiCall(supabase, {
      key_id,
      organization_id,
      endpoint: "agent-send-announcement",
      request_body: { title: body.title, target_type: targetType },
      response_status: 200,
      response_summary: `announcement_id: ${ann.id}, recipients: ${count}`,
      duration_ms: duration,
    });

    return json({
      announcement_id: ann.id,
      recipients_count: count || 0,
    });
  } catch (err) {
    console.error("agent-send-announcement error:", err);
    return json({ error: String(err) }, 500);
  }
});
