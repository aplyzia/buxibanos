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
    if (!body.class_id) {
      return json({ error: "class_id is required" }, 400);
    }
    if (!body.date) {
      return json({ error: "date is required (YYYY-MM-DD)" }, 400);
    }
    if (!body.recorded_by_name && !body.recorded_by_id) {
      return json({ error: "recorded_by_name or recorded_by_id is required" }, 400);
    }
    if (!body.records || !Array.isArray(body.records) || body.records.length === 0) {
      return json({ error: "records must be a non-empty array" }, 400);
    }

    const validStatuses = ["present", "absent", "tardy", "excused"];
    for (const r of body.records) {
      if (!r.student_name) {
        return json({ error: "Each record must have student_name" }, 400);
      }
      if (!validStatuses.includes(r.status)) {
        return json({ error: `Invalid status "${r.status}". Must be: ${validStatuses.join(", ")}` }, 400);
      }
    }

    // ── Validate class belongs to org ──
    const { data: cls } = await supabase
      .from("classes")
      .select("id")
      .eq("id", body.class_id)
      .eq("organization_id", organization_id)
      .single();

    if (!cls) {
      return json({ error: `Class "${body.class_id}" not found in this organization` }, 400);
    }

    // ── Resolve recorded_by ──
    const staff = await resolveName(
      supabase, "staff", organization_id,
      body.recorded_by_id || body.recorded_by_name
    );
    if (!staff) {
      return json({ error: `Staff "${body.recorded_by_name || body.recorded_by_id}" not found` }, 400);
    }

    // ── Call existing RPC ──
    const pRecords = body.records.map((r: { student_name: string; status: string }) => ({
      student_name: r.student_name,
      status: r.status,
      recorded_by: staff.id,
    }));

    const { data: result, error: rpcError } = await supabase.rpc(
      "upsert_attendance_by_name",
      {
        p_organization_id: organization_id,
        p_class_id: body.class_id,
        p_date: body.date,
        p_records: pRecords,
      }
    );

    if (rpcError) {
      return json({ error: rpcError.message }, 500);
    }

    const duration = Date.now() - start;
    await logApiCall(supabase, {
      key_id,
      organization_id,
      endpoint: "agent-record-attendance",
      request_body: { class_id: body.class_id, date: body.date, records_count: body.records.length },
      response_status: 200,
      response_summary: `inserted: ${result?.inserted ?? "?"}, skipped: ${result?.skipped ?? "?"}`,
      duration_ms: duration,
    });

    return json({
      inserted: result?.inserted ?? body.records.length,
      skipped: result?.skipped ?? 0,
    });
  } catch (err) {
    console.error("agent-record-attendance error:", err);
    return json({ error: String(err) }, 500);
  }
});
