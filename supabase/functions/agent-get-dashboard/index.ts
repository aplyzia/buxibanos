import { authenticate, json, corsHeaders, logApiCall } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { supabase, organization_id, key_id } = auth;

    const days = Math.min(Math.max(body.days || 7, 1), 90);
    const include: string[] = body.include || [
      "stats",
      "unanswered_messages",
      "pending_tasks",
      "overdue_fees",
    ];

    const dashboard: Record<string, unknown> = { organization_id, days };

    // ── Stats (weekly aggregates) ──
    if (include.includes("stats")) {
      const { data: stats } = await supabase.rpc("get_weekly_stats", {
        p_organization_id: organization_id,
        p_days: days,
      });
      dashboard.stats = stats;
    }

    // ── Unanswered messages ──
    if (include.includes("unanswered_messages")) {
      const { data: messages } = await supabase
        .from("messages")
        .select(
          "id, sender_name, sender_type, primary_student, message_type, priority, summary, created_at"
        )
        .eq("organization_id", organization_id)
        .eq("staff_responded", false)
        .eq("action_required", true)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(20);

      dashboard.unanswered_messages = messages || [];
    }

    // ── Pending tasks ──
    if (include.includes("pending_tasks")) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select(
          "id, title, priority, status, assigned_to, source_type, created_at"
        )
        .eq("organization_id", organization_id)
        .eq("status", "pending")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(20);

      dashboard.pending_tasks = tasks || [];
    }

    // ── Overdue fees ──
    if (include.includes("overdue_fees")) {
      const { data: fees } = await supabase
        .from("fee_records")
        .select(
          "id, student_id, period, amount_ntd, status, due_date"
        )
        .eq("organization_id", organization_id)
        .in("status", ["overdue", "pending"])
        .order("due_date", { ascending: true })
        .limit(30);

      dashboard.overdue_fees = fees || [];
    }

    const duration = Date.now() - start;
    await logApiCall(supabase, {
      key_id,
      organization_id,
      endpoint: "agent-get-dashboard",
      request_body: { days, include },
      response_status: 200,
      response_summary: `sections: ${include.join(", ")}`,
      duration_ms: duration,
    });

    return json(dashboard);
  } catch (err) {
    console.error("agent-get-dashboard error:", err);
    return json({ error: String(err) }, 500);
  }
});
