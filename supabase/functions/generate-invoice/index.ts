import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Accept token from Authorization header OR ?token= query param (for browser direct open)
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    const authHeader = req.headers.get("Authorization") ?? (queryToken ? `Bearer ${queryToken}` : null);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept fee_record_id from query param (GET) or request body (POST)
    let fee_record_id = url.searchParams.get("fee_record_id");
    if (!fee_record_id && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      fee_record_id = body.fee_record_id ?? null;
    }
    if (!fee_record_id) {
      return new Response(JSON.stringify({ error: "fee_record_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch fee record with student and org info
    const { data: fee, error: feeError } = await supabaseAdmin
      .from("fee_records")
      .select("*, students(full_name, organization_id), organizations(name)")
      .eq("id", fee_record_id)
      .single();

    if (feeError || !fee) {
      return new Response(JSON.stringify({ error: "Fee record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = fee.organization_id;

    // Verify caller has access (staff of same org, or parent of the student)
    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("supabase_user_id", user.id)
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .single();

    const { data: parentRow } = await supabaseAdmin
      .from("parents")
      .select("student_ids")
      .eq("supabase_user_id", user.id)
      .single();

    const isStaff = !!staffRow;
    const isParent = parentRow?.student_ids?.includes(fee.student_id);

    if (!isStaff && !isParent) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schoolName = (fee.organizations as any)?.name ?? "School";
    const studentName = (fee.students as any)?.full_name ?? "Student";
    const invoiceNo = `INV-${fee.id.slice(0, 8).toUpperCase()}`;
    const issuedDate = new Date().toLocaleDateString("zh-TW");
    const statusLabel: Record<string, string> = {
      paid: "已繳清 Paid",
      pending: "待繳 Pending",
      overdue: "逾期 Overdue",
      waived: "免繳 Waived",
    };

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, "PingFang TC", "Noto Sans TC", sans-serif; background: #f8f5f2; color: #44312A; padding: 24px; }
    .card { background: #fff; border-radius: 16px; max-width: 480px; margin: 0 auto; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { text-align: center; margin-bottom: 28px; }
    .school { font-size: 20px; font-weight: 700; color: #44312A; }
    .invoice-label { font-size: 13px; color: #A89484; margin-top: 4px; letter-spacing: 0.05em; text-transform: uppercase; }
    .divider { height: 1px; background: #EDE4DC; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .label { font-size: 13px; color: #8C7464; }
    .value { font-size: 13px; font-weight: 500; color: #44312A; }
    .amount-section { background: #F5EBE0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center; }
    .amount-label { font-size: 12px; color: #8C7464; margin-bottom: 4px; }
    .amount { font-size: 28px; font-weight: 700; color: #44312A; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-paid { background: #DCFCE7; color: #15803D; }
    .badge-pending { background: #FEF9C3; color: #A16207; }
    .badge-overdue { background: #FEE2E2; color: #B91C1C; }
    .badge-waived { background: #F3F4F6; color: #6B7280; }
    .footer { text-align: center; font-size: 11px; color: #A89484; margin-top: 24px; }
    @media print { body { background: white; padding: 0; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="school">${schoolName}</div>
      <div class="invoice-label">Fee Receipt / 繳費收據</div>
    </div>

    <div class="row">
      <span class="label">Invoice No.</span>
      <span class="value">${invoiceNo}</span>
    </div>
    <div class="row">
      <span class="label">Issued / 開立日期</span>
      <span class="value">${issuedDate}</span>
    </div>

    <div class="divider"></div>

    <div class="row">
      <span class="label">Student / 學生</span>
      <span class="value">${studentName}</span>
    </div>
    <div class="row">
      <span class="label">Period / 期間</span>
      <span class="value">${fee.period}</span>
    </div>
    <div class="row">
      <span class="label">Due Date / 到期日</span>
      <span class="value">${fee.due_date}</span>
    </div>
    ${fee.paid_date ? `<div class="row"><span class="label">Paid Date / 繳費日</span><span class="value">${fee.paid_date}</span></div>` : ""}
    ${fee.payment_method ? `<div class="row"><span class="label">Method / 方式</span><span class="value">${fee.payment_method === "cash" ? "現金 Cash" : "銀行轉帳 Bank Transfer"}</span></div>` : ""}

    <div class="amount-section">
      <div class="amount-label">Amount / 金額</div>
      <div class="amount">NT$ ${fee.amount_ntd.toLocaleString()}</div>
    </div>

    <div style="text-align:center">
      <span class="badge badge-${fee.status}">${statusLabel[fee.status] ?? fee.status}</span>
    </div>

    <div class="divider"></div>
    <div class="footer">
      ${schoolName} &nbsp;·&nbsp; BuxibanOS<br>
      ${fee.notes ? `Notes: ${fee.notes}` : "Thank you / 感謝您"}
    </div>
  </div>
  <script>
    // Auto-trigger print dialog on mobile if ?print=1
    if (new URLSearchParams(window.location.search).get('print') === '1') {
      window.onload = () => window.print();
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

  } catch (err) {
    console.error("generate-invoice error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
