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
    if (!body.message_id) return json({ error: "message_id is required" }, 400);
    if (!body.reply_content) return json({ error: "reply_content is required" }, 400);
    if (!body.responder_name && !body.responder_id) {
      return json({ error: "responder_name or responder_id is required" }, 400);
    }

    // ── Verify original message exists in org ──
    const { data: original } = await supabase
      .from("messages")
      .select("id, sender_name, sender_type, receiver_name, primary_student, thread_id, organization_id")
      .eq("id", body.message_id)
      .single();

    if (!original || original.organization_id !== organization_id) {
      return json({ error: `Message "${body.message_id}" not found in this organization` }, 404);
    }

    // ── Resolve responder ──
    const staff = await resolveName(
      supabase, "staff", organization_id,
      body.responder_id || body.responder_name
    );
    if (!staff) {
      return json({ error: `Staff "${body.responder_name || body.responder_id}" not found` }, 400);
    }

    // ── Mark original as responded ──
    await supabase
      .from("messages")
      .update({ staff_responded: true, response_at: new Date().toISOString() })
      .eq("id", body.message_id);

    // ── Insert reply message ──
    const threadId = original.thread_id || original.id;

    const { data: reply, error: insertError } = await supabase
      .from("messages")
      .insert({
        organization_id,
        thread_id: threadId,
        sender_name: staff.full_name,
        sender_type: "admin",
        receiver_name: original.sender_name,
        receiver_type: original.sender_type,
        primary_student: original.primary_student,
        message_type: "general",
        priority: "medium",
        action_required: false,
        original_content: body.reply_content,
        summary: body.reply_content.substring(0, 50),
        confidence: "high",
        staff_responded: false,
        additional_students: "{}",
        media_urls: body.media_urls || "[]",
      })
      .select("id")
      .single();

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    const duration = Date.now() - start;
    await logApiCall(supabase, {
      key_id,
      organization_id,
      endpoint: "agent-reply-to-parent",
      request_body: { message_id: body.message_id, responder: staff.full_name },
      response_status: 200,
      response_summary: `reply_id: ${reply.id}`,
      duration_ms: duration,
    });

    return json({
      reply_message_id: reply.id,
      original_message_id: body.message_id,
      thread_id: threadId,
    });
  } catch (err) {
    console.error("agent-reply-to-parent error:", err);
    return json({ error: String(err) }, 500);
  }
});
