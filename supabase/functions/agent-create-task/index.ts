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
    if (!body.title) {
      return json({ error: "title is required" }, 400);
    }

    const validSourceTypes = ["ai_detected", "manual", "system"];
    const sourceType = body.source_type || "manual";
    if (!validSourceTypes.includes(sourceType)) {
      return json({ error: `source_type must be one of: ${validSourceTypes.join(", ")}` }, 400);
    }

    const validPriorities = ["high", "medium", "low"];
    const priority = body.priority || "medium";
    if (!validPriorities.includes(priority)) {
      return json({ error: `priority must be one of: ${validPriorities.join(", ")}` }, 400);
    }

    // ── Resolve names ──
    let assignedTo: string | null = null;
    if (body.assigned_to_name || body.assigned_to_id) {
      const staff = await resolveName(
        supabase, "staff", organization_id,
        body.assigned_to_id || body.assigned_to_name
      );
      if (!staff) {
        return json({ error: `Staff "${body.assigned_to_name || body.assigned_to_id}" not found` }, 400);
      }
      assignedTo = staff.id;
    }

    let sourceStudentId: string | null = null;
    if (body.source_student_name || body.source_student_id) {
      const student = await resolveName(
        supabase, "students", organization_id,
        body.source_student_id || body.source_student_name
      );
      if (!student) {
        return json({ error: `Student "${body.source_student_name || body.source_student_id}" not found` }, 400);
      }
      sourceStudentId = student.id;
    }

    // ── Insert ──
    const { data: task, error: insertError } = await supabase
      .from("tasks")
      .insert({
        organization_id,
        title: body.title,
        description: body.description || null,
        source_type: sourceType,
        source_message_id: body.source_message_id || null,
        source_student_id: sourceStudentId,
        priority,
        status: "pending",
        assigned_to: assignedTo,
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
      endpoint: "agent-create-task",
      request_body: { title: body.title, priority },
      response_status: 200,
      response_summary: `task_id: ${task.id}`,
      duration_ms: duration,
    });

    return json({ task_id: task.id });
  } catch (err) {
    console.error("agent-create-task error:", err);
    return json({ error: String(err) }, 500);
  }
});
