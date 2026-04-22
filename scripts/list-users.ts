/**
 * List all auth users + their staff/parent records.
 *
 * Usage:
 *   1. Add SUPABASE_SERVICE_KEY to .env (get it from
 *      https://supabase.com/dashboard/project/<project>/settings/api).
 *   2. Run: npm run list-users
 *
 * Reads SUPABASE_URL from EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY
 * from .env. The service key is NOT committed — it stays in .env only.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): { supabaseUrl: string; supabaseKey: string } {
  const envPath = path.join(import.meta.dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env not found at project root");
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const supabaseUrl =
    content.match(/(?:EXPO_PUBLIC_)?SUPABASE_URL=(.+)/)?.[1]?.trim() || "";
  const supabaseKey =
    content.match(/SUPABASE_SERVICE_KEY=(.+)/)?.[1]?.trim() || "";

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL in .env");
  if (!supabaseKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_KEY in .env\n" +
        "  Get it from: https://supabase.com/dashboard/project/_/settings/api\n" +
        "  Then add: SUPABASE_SERVICE_KEY=eyJ... to .env"
    );
  }
  return { supabaseUrl, supabaseKey };
}

async function main() {
  const { supabaseUrl, supabaseKey } = loadEnv();
  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(`→ Querying ${supabaseUrl}\n`);

  const { data, error } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;

  if (data.users.length === 0) {
    console.log("No auth users found. You'll need to create one first.");
    return;
  }

  console.log(`Found ${data.users.length} auth user(s):\n`);

  for (const user of data.users) {
    const { data: staff } = await sb
      .from("staff")
      .select("full_name, role, is_active, organization_id")
      .eq("supabase_user_id", user.id)
      .maybeSingle();

    const { data: parent } = await sb
      .from("parents")
      .select("full_name, organization_id")
      .eq("supabase_user_id", user.id)
      .maybeSingle();

    const profileType = staff ? "staff" : parent ? "parent" : "none";
    const profileName = staff?.full_name ?? parent?.full_name ?? "—";
    const role = staff?.role ?? (parent ? "parent" : "—");
    const isActive = staff?.is_active ?? (parent ? true : false);

    console.log(`  ${user.email ?? "(no email)"}`);
    console.log(`    id:       ${user.id}`);
    console.log(`    profile:  ${profileType} (${profileName})`);
    console.log(`    role:     ${role}${isActive ? "" : "  [INACTIVE]"}`);
    console.log(
      `    created:  ${user.created_at?.split("T")[0] ?? "?"}   last sign-in: ${
        user.last_sign_in_at?.split("T")[0] ?? "never"
      }`
    );
    console.log("");
  }

  console.log(`\nTo reset a password, use:`);
  console.log(`  https://supabase.com/dashboard/project/_/auth/users`);
}

main().catch((err) => {
  console.error("✗ " + err.message);
  process.exit(1);
});
