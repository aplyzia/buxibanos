/**
 * WF6 — Emergency Room Creator
 *
 * Called by n8n WF6 (or directly by the app) when an emergency message is detected.
 * 1. Creates a LiveKit room
 * 2. Generates JWT tokens for wave-1 staff
 * 3. Sends Expo push notifications to their devices
 * 4. Returns { room_name, token } for the triggering caller to join immediately
 *
 * Required Supabase secrets:
 *   LIVEKIT_URL       — e.g. https://my-livekit.example.com
 *   LIVEKIT_API_KEY   — LiveKit API key
 *   LIVEKIT_API_SECRET — LiveKit API secret
 *
 * Called with service-role key (n8n) or from the app with auth token.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") ?? "";
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") ?? "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") ?? "";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ── JWT helpers ───────────────────────────────────────────────────────────────

function b64url(data: string | Uint8Array): string {
  const str =
    typeof data === "string" ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function jsonB64(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

async function signJwt(
  header: unknown,
  payload: unknown,
  secret: string
): Promise<string> {
  const msg = `${jsonB64(header)}.${jsonB64(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return `${msg}.${b64url(new Uint8Array(sig))}`;
}

/**
 * Generate a LiveKit access token.
 * identity: unique participant ID (e.g. staff UUID)
 * name: display name
 * grants: { roomJoin, room, canPublish, canSubscribe } or { roomCreate, roomAdmin }
 */
async function livekitToken(
  identity: string,
  name: string,
  grants: Record<string, unknown>
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { alg: "HS256", typ: "JWT" },
    {
      iss: LIVEKIT_API_KEY,
      sub: identity,
      iat: now,
      exp: now + 3600, // 1 hour
      nbf: 0,
      video: grants,
      name,
    },
    LIVEKIT_API_SECRET
  );
}

// ── LiveKit room creation ─────────────────────────────────────────────────────

async function createLivekitRoom(roomName: string): Promise<void> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return; // stub if not configured

  const adminToken = await livekitToken("admin", "EddyFlow Admin", {
    roomCreate: true,
    roomAdmin: true,
  });

  const res = await fetch(
    `${LIVEKIT_URL}/twirp/livekit.RoomService/CreateRoom`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        empty_timeout: 600, // 10 min
        max_participants: 20,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    console.warn("LiveKit room creation warning:", res.status, text);
    // Non-fatal — room may already exist
  }
}

// ── Expo push ─────────────────────────────────────────────────────────────────

async function sendPushNotifications(
  pushTokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  if (pushTokens.length === 0) return;

  const messages = pushTokens.map((token) => ({
    to: token,
    title,
    body,
    data,
    priority: "high",
    sound: "default",
    channelId: "emergency",
  }));

  // Expo push API accepts up to 100 messages per request
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsH = {
    "Access-Control-Allow-Origin": Deno.env.get("CORS_ALLOWED_ORIGIN") ?? "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsH });
  }

  try {
    // ── Auth: require valid Supabase JWT or service-role key ──
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsH } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // If not service-role, verify the JWT belongs to an active staff member
    const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`;
    let authedOrgId: string | null = null;

    if (!isServiceRole) {
      const anonClient = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data: { user }, error: authErr } = await anonClient.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsH } }
        );
      }
      // Look up staff org
      const { data: staffRow } = await sb
        .from("staff")
        .select("organization_id")
        .eq("supabase_user_id", user.id)
        .maybeSingle();
      if (!staffRow) {
        return new Response(
          JSON.stringify({ error: "Not authorized — staff only" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsH } }
        );
      }
      authedOrgId = staffRow.organization_id;
    }

    const {
      message_id,
      organization_id,
      caller_name,
      student_name,
      wave = 1,
    } = await req.json() as {
      message_id: string;
      organization_id: string;
      caller_name?: string;
      student_name?: string;
      wave?: number;
    };

    if (!message_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "message_id and organization_id required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsH } }
      );
    }

    // Enforce org match for non-service-role callers
    if (authedOrgId && authedOrgId !== organization_id) {
      return new Response(
        JSON.stringify({ error: "Organization mismatch" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsH } }
      );
    }

    // ── Room name: deterministic so repeated calls don't create new rooms ──
    const roomName = `emergency-${message_id}`;

    // ── Create LiveKit room ──
    await createLivekitRoom(roomName);

    // ── Get staff to notify based on wave ──
    // Wave 1 requires assigned_teacher_id; look it up from the message's primary student
    let rpcParams: Record<string, unknown> = { p_organization_id: organization_id };

    if (wave === 1) {
      // Find the assigned teacher for the student linked to this message
      const { data: msg } = await sb
        .from("messages")
        .select("primary_student_id")
        .eq("id", message_id)
        .maybeSingle();

      let teacherId: string | null = null;
      if (msg?.primary_student_id) {
        const { data: student } = await sb
          .from("students")
          .select("assigned_teacher_id")
          .eq("id", msg.primary_student_id)
          .maybeSingle();
        teacherId = student?.assigned_teacher_id ?? null;
      }

      rpcParams = {
        p_organization_id: organization_id,
        p_assigned_teacher_id: teacherId,
      };
    }

    const rpcName =
      wave === 1
        ? "get_emergency_wave1_staff"
        : wave === 2
        ? "get_emergency_wave2_staff"
        : "get_emergency_wave3_staff";

    const { data: staffRaw } = await sb.rpc(rpcName, rpcParams);
    // RPC returns objects with `id` (not `staff_id`), `full_name`, `push_token`
    const staffList: { id: string; full_name: string; push_token: string | null }[] =
      Array.isArray(staffRaw) ? staffRaw : [];

    // ── Generate tokens + collect push tokens ──
    const pushTokens: string[] = [];
    const participantTokens: Record<string, string> = {};

    for (const staff of staffList) {
      const token = await livekitToken(
        staff.id,
        staff.full_name,
        {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
        }
      );
      participantTokens[staff.id] = token;
      if (staff.push_token) pushTokens.push(staff.push_token);
    }

    // ── Also generate a generic "join" token for immediate use ──
    const joinToken = await livekitToken(
      `staff-${Date.now()}`,
      caller_name ?? "Staff",
      {
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      }
    );

    // ── Send push notifications ──
    const callerDisplay = caller_name ?? "A parent";
    const studentDisplay = student_name ?? "a student";
    await sendPushNotifications(
      pushTokens,
      "🚨 Emergency",
      `${callerDisplay} needs urgent help — ${studentDisplay}`,
      {
        voipRoomName: roomName,
        voipToken: joinToken,
        callerName: callerDisplay,
        studentName: studentDisplay,
        messageId: message_id,
      }
    );

    // ── Store room info in DB for reference ──
    await sb.from("workflow_errors").insert({
      organization_id,
      workflow_name: "WF6_emergency_room",
      error_message: null,
      payload: {
        room_name: roomName,
        message_id,
        wave,
        staff_notified: staffList.length,
        push_sent: pushTokens.length,
      },
    });

    return new Response(
      JSON.stringify({
        room_name: roomName,
        token: joinToken,
        staff_notified: staffList.length,
        push_sent: pushTokens.length,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": Deno.env.get("CORS_ALLOWED_ORIGIN") ?? "*",
        },
      }
    );
  } catch (err) {
    console.error("create-emergency-room error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
