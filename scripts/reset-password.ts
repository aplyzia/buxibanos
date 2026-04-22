/**
 * Admin password reset for a Supabase auth user.
 *
 * Usage:
 *   npm run reset-password <email> <new-password>
 *
 * Requires SUPABASE_SERVICE_KEY in .env.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): { supabaseUrl: string; supabaseKey: string } {
  const envPath = path.join(import.meta.dirname, "..", ".env");
  const content = fs.readFileSync(envPath, "utf-8");
  const supabaseUrl =
    content.match(/(?:EXPO_PUBLIC_)?SUPABASE_URL=(.+)/)?.[1]?.trim() || "";
  const supabaseKey =
    content.match(/SUPABASE_SERVICE_KEY=(.+)/)?.[1]?.trim() || "";
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  }
  return { supabaseUrl, supabaseKey };
}

async function main() {
  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    throw new Error(
      "Usage: npm run reset-password <email> <new-password>"
    );
  }

  const { supabaseUrl, supabaseKey } = loadEnv();
  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: list, error: listErr } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No auth user found with email ${email}`);

  const { error: updateErr } = await sb.auth.admin.updateUserById(user.id, {
    password: newPassword,
    email_confirm: true,
  });
  if (updateErr) throw updateErr;

  console.log(`✓ Password reset for ${email}`);
  console.log(`  id: ${user.id}`);
  console.log(`  new password: ${newPassword}`);
}

main().catch((err) => {
  console.error("✗ " + err.message);
  process.exit(1);
});
