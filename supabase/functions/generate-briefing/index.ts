import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BriefingSection {
  type: "urgent" | "fees" | "tasks" | "insights";
  title: string;
  items: { text: string; detail?: string }[];
}

interface BriefingContent {
  summary: string;
  sections: BriefingSection[];
  generatedAt: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for DB writes, user client for auth check
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user and role
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: staffRow, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("organization_id, role")
      .eq("supabase_user_id", user.id)
      .eq("is_active", true)
      .single();

    if (staffError || !staffRow || !["director", "admin"].includes(staffRow.role)) {
      return new Response(JSON.stringify({ error: "Access denied. Director or admin role required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = staffRow.organization_id;
    const { type = "morning", force = false } = await req.json().catch(() => ({}));

    // Determine brief_date
    const now = new Date();
    let briefDate: string;
    if (type === "weekly") {
      // Start of current week (Monday)
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      briefDate = new Date(now.setDate(diff)).toISOString().split("T")[0];
    } else {
      briefDate = new Date().toISOString().split("T")[0];
    }

    // Check cache
    if (!force) {
      const { data: cached } = await supabaseAdmin
        .from("briefings")
        .select("content, generated_at")
        .eq("organization_id", organizationId)
        .eq("type", type)
        .eq("brief_date", briefDate)
        .single();

      if (cached) {
        return new Response(JSON.stringify({ content: cached.content, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Gather data ──────────────────────────────────────────────────────────

    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let dataContext = "";

    if (type === "morning") {
      // Unanswered messages (last 48h)
      const { data: unanswerered } = await supabaseAdmin
        .from("messages")
        .select("priority, message_type, summary, original_content, created_at, sender_name")
        .eq("organization_id", organizationId)
        .eq("staff_responded", false)
        .gte("created_at", cutoff48h)
        .order("priority", { ascending: true })
        .limit(20);

      // Overdue fees
      const { data: overdueFees } = await supabaseAdmin
        .from("fee_records")
        .select("amount_ntd, due_date, period, students(full_name)")
        .eq("organization_id", organizationId)
        .eq("status", "overdue")
        .limit(20);

      // Pending/overdue tasks
      const { data: pendingTasks } = await supabaseAdmin
        .from("tasks")
        .select("title, due_date, priority, assigned_to_name")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "overdue"])
        .limit(20);

      dataContext = `
UNANSWERED MESSAGES (last 48 hours, ${unanswerered?.length ?? 0} total):
${(unanswerered ?? []).map((m) =>
  `- [${m.priority?.toUpperCase()}] ${m.sender_name}: ${m.summary || m.original_content?.slice(0, 100)} (${new Date(m.created_at).toLocaleString()})`
).join("\n") || "None"}

OVERDUE FEES (${overdueFees?.length ?? 0} total):
${(overdueFees ?? []).map((f) => {
  const student = (f.students as any)?.full_name ?? "Unknown";
  return `- ${student}: NT$${f.amount_ntd} due ${f.due_date} (${f.period})`;
}).join("\n") || "None"}

PENDING/OVERDUE TASKS (${pendingTasks?.length ?? 0} total):
${(pendingTasks ?? []).map((t) =>
  `- ${t.title} | Assigned: ${t.assigned_to_name ?? "Unassigned"} | Due: ${t.due_date ?? "No date"} | Priority: ${t.priority}`
).join("\n") || "None"}`;

    } else {
      // Weekly report data
      const { data: weekMessages } = await supabaseAdmin
        .from("messages")
        .select("priority, message_type, staff_responded, created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", cutoff7d);

      const { data: weekFees } = await supabaseAdmin
        .from("fee_records")
        .select("status, amount_ntd")
        .eq("organization_id", organizationId);

      const { data: weekTasks } = await supabaseAdmin
        .from("tasks")
        .select("status, created_at, completed_at")
        .eq("organization_id", organizationId)
        .gte("created_at", cutoff7d);

      const totalMessages = weekMessages?.length ?? 0;
      const respondedMessages = weekMessages?.filter((m) => m.staff_responded).length ?? 0;
      const responseRate = totalMessages > 0 ? Math.round((respondedMessages / totalMessages) * 100) : 0;

      const typeBreakdown = (weekMessages ?? []).reduce<Record<string, number>>((acc, m) => {
        acc[m.message_type] = (acc[m.message_type] ?? 0) + 1;
        return acc;
      }, {});

      const feeBreakdown = (weekFees ?? []).reduce<Record<string, number>>((acc, f) => {
        acc[f.status] = (acc[f.status] ?? 0) + 1;
        return acc;
      }, {});

      const completedTasks = weekTasks?.filter((t) => t.status === "completed").length ?? 0;
      const totalTasks = weekTasks?.length ?? 0;

      dataContext = `
WEEKLY MESSAGE STATS (last 7 days):
- Total messages received: ${totalMessages}
- Staff responded: ${respondedMessages} (${responseRate}% response rate)
- Message type breakdown: ${JSON.stringify(typeBreakdown)}

FEE COLLECTION STATUS (all time):
${Object.entries(feeBreakdown).map(([status, count]) => `- ${status}: ${count}`).join("\n") || "No fee records"}

TASK COMPLETION (last 7 days):
- Completed: ${completedTasks} / ${totalTasks} tasks`;
    }

    // ── Call Claude ──────────────────────────────────────────────────────────

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const systemPrompt = type === "morning"
      ? `You are an AI assistant for a Taiwan cram school management app. Generate a concise morning briefing for the school director. Be direct, actionable, and professional. Focus only on items that need attention today. If there is nothing urgent, say so clearly and positively.`
      : `You are an AI assistant for a Taiwan cram school management app. Generate a concise weekly summary report for the school director. Highlight trends, improvements, and areas needing attention.`;

    const userPrompt = `Here is the current school data:

${dataContext}

Generate a briefing in JSON format with this exact structure:
{
  "summary": "2-3 sentence overview of the most important things",
  "sections": [
    {
      "type": "urgent" | "fees" | "tasks" | "insights",
      "title": "Section title",
      "items": [
        { "text": "Main item text", "detail": "Optional detail" }
      ]
    }
  ]
}

Rules:
- Only include sections that have actual items (skip empty sections)
- For morning brief: sections should be urgent (unanswered messages), fees (overdue), tasks (pending)
- For weekly: sections should be insights (key observations), fees (collection status), tasks (completion)
- Keep items concise — max 2 lines each
- If everything is fine, include one insights section with a positive summary
- Return valid JSON only, no markdown code blocks`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      throw new Error(`Anthropic API error: ${anthropicRes.status}`);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text ?? "{}";

    let parsed: Omit<BriefingContent, "generatedAt">;
    try {
      // Strip markdown code blocks if present
      const cleaned = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        summary: "Briefing generated. Please review the school data.",
        sections: [{ type: "insights", title: "Note", items: [{ text: rawText.slice(0, 200) }] }],
      };
    }

    const content: BriefingContent = {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };

    // ── Store result ─────────────────────────────────────────────────────────

    await supabaseAdmin
      .from("briefings")
      .upsert(
        {
          organization_id: organizationId,
          type,
          brief_date: briefDate,
          content,
          generated_at: new Date().toISOString(),
          generated_by: "claude-sonnet-4-6",
        },
        { onConflict: "organization_id,type,brief_date" }
      );

    return new Response(JSON.stringify({ content, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-briefing error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
