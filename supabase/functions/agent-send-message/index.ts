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

    // ── Validate required fields ──
    const required = ["sender_name", "sender_type", "receiver_name", "receiver_type", "original_content"];
    for (const field of required) {
      if (!body[field]) {
        return json({ error: `${field} is required` }, 400);
      }
    }

    const validSenderTypes = ["parent", "teacher", "student", "admin"];
    if (!validSenderTypes.includes(body.sender_type)) {
      return json({ error: `sender_type must be one of: ${validSenderTypes.join(", ")}` }, 400);
    }

    const validMessageTypes = ["attendance", "payment", "schedule", "complaint", "inquiry", "emergency", "general"];
    const messageType = body.message_type || "general";
    if (!validMessageTypes.includes(messageType)) {
      return json({ error: `message_type must be one of: ${validMessageTypes.join(", ")}` }, 400);
    }

    const validPriorities = ["high", "medium", "low"];
    const priority = body.priority || "medium";
    if (!validPriorities.includes(priority)) {
      return json({ error: `priority must be one of: ${validPriorities.join(", ")}` }, 400);
    }

    // ── Validate sender exists in org ──
    if (body.sender_type === "parent") {
      const parent = await resolveName(supabase, "parents", organization_id, body.sender_name);
      if (!parent) {
        return json({ error: `Parent "${body.sender_name}" not found in this organization` }, 400);
      }
    } else if (["teacher", "admin"].includes(body.sender_type)) {
      const staff = await resolveName(supabase, "staff", organization_id, body.sender_name);
      if (!staff) {
        return json({ error: `Staff "${body.sender_name}" not found in this organization` }, 400);
      }
    }

    // ── Validate student if provided ──
    if (body.primary_student) {
      const student = await resolveName(supabase, "students", organization_id, body.primary_student);
      if (!student) {
        return json({ error: `Student "${body.primary_student}" not found in this organization` }, 400);
      }
    }

    // ── Insert message ──
    const { data: msg, error: insertError } = await supabase
      .from("messages")
      .insert({
        organization_id,
        sender_name: body.sender_name,
        sender_type: body.sender_type,
        receiver_name: body.receiver_name,
        receiver_type: body.receiver_type,
        primary_student: body.primary_student || null,
        additional_students: body.additional_students || "{}",
        message_type: messageType,
        priority,
        action_required: body.action_required ?? false,
        original_content: body.original_content,
        summary: body.summary || body.original_content.substring(0, 50),
        confidence: body.confidence || "high",
        staff_responded: false,
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
      endpoint: "agent-send-message",
      request_body: { sender_name: body.sender_name, message_type: messageType },
      response_status: 200,
      response_summary: `message_id: ${msg.id}`,
      duration_ms: duration,
    });

    return json({
      message_id: msg.id,
      wf1_triggered: true,
    });
  } catch (err) {
    console.error("agent-send-message error:", err);
    return json({ error: String(err) }, 500);
  }
});
