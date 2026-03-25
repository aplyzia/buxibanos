/**
 * School Data Import — Google Sheet → Supabase
 *
 * Reads the onboarding spreadsheet and imports all data into Supabase:
 *   Staff → Classes → Students → Parents
 *
 * Usage:
 *   npm run import-school <spreadsheet-id> <org-slug>
 *
 * Example:
 *   npm run import-school 1BxC...abc xiong-buxiban
 *
 * Reuses .google-token.json from onboard-school.ts for Google auth.
 * Reads SUPABASE_URL + SUPABASE_SERVICE_KEY from Cram-n8n/.env or local .env.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN_PATH = path.join(import.meta.dirname, "..", ".google-token.json");

function loadEnv(): { supabaseUrl: string; supabaseKey: string; clientId: string; clientSecret: string } {
  const envPaths = [
    path.join(import.meta.dirname, "..", ".env"),
    path.join(import.meta.dirname, "..", "..", "Cram-n8n", ".env"),
  ];

  let supabaseUrl = "", supabaseKey = "", clientId = "", clientSecret = "";

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf-8");

    if (!supabaseUrl) supabaseUrl = content.match(/(?:EXPO_PUBLIC_)?SUPABASE_URL=(.+)/)?.[1]?.trim() || "";
    if (!supabaseKey) supabaseKey = content.match(/SUPABASE_SERVICE_KEY=(.+)/)?.[1]?.trim() || "";
    if (!clientId) clientId = content.match(/GOOGLE_DRIVE_CLIENT_ID=(.+)/)?.[1]?.trim() || "";
    if (!clientSecret) clientSecret = content.match(/GOOGLE_DRIVE_CLIENT_SECRET=(.+)/)?.[1]?.trim() || "";
  }

  if (!supabaseUrl || !supabaseKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET in .env");

  return { supabaseUrl, supabaseKey, clientId, clientSecret };
}

// ─── Google Sheets Auth ─────────────────────────────────────────────────────

function getGoogleAuth(clientId: string, clientSecret: string) {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error("No .google-token.json found. Run 'npm run onboard-school' first to authorize.");
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:3456/callback");
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  oauth2.setCredentials(tokens);
  return oauth2;
}

// ─── Sheet Reading ──────────────────────────────────────────────────────────

interface SchoolInfoRow { field: string; value: string }
interface StaffRow { full_name: string; role: string; email: string; password: string; subjects: string }
interface ClassRow { name: string; subject: string; teacher_name: string; schedule_days: string; schedule_time: string; duration_minutes: string; max_students: string }
interface StudentRow { full_name: string; display_name: string; nicknames: string; grade_level: string; class_names: string; teacher_name: string; enrollment_date: string; special_needs: string; notes: string }
interface ParentRow { full_name: string; email: string; phone: string; children: string; preferred_language: string; communication_notes: string }

function parseSheet<T>(rows: string[][], headers: string[]): T[] {
  if (!rows || rows.length < 2) return [];
  const headerRow = rows[0];
  const colMap: Record<string, number> = {};
  headerRow.forEach((h, i) => { colMap[h.trim()] = i; });

  return rows.slice(1).filter(row => row.some(cell => cell?.trim())).map(row => {
    const obj: any = {};
    for (const h of headers) {
      obj[h] = (row[colMap[h]] || "").trim();
    }
    return obj as T;
  });
}

function parseSchoolInfo(rows: string[][]): Record<string, string> {
  if (!rows || rows.length < 2) return {};
  const info: Record<string, string> = {};
  for (const row of rows.slice(1)) {
    const key = (row[0] || "").trim();
    const value = (row[1] || "").trim();
    if (key && value) info[key] = value;
  }
  return info;
}

async function readAllSheets(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string) {
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["School Info!A1:B100", "Staff!A1:E100", "Classes!A1:G100", "Students!A1:I100", "Parents!A1:F100"],
  });

  const [schoolInfoData, staffData, classData, studentData, parentData] = res.data.valueRanges!;

  const schoolInfo = parseSchoolInfo(schoolInfoData.values as string[][]);
  const staff = parseSheet<StaffRow>(staffData.values as string[][], ["full_name", "role", "email", "password", "subjects"]);
  const classes = parseSheet<ClassRow>(classData.values as string[][], ["name", "subject", "teacher_name", "schedule_days", "schedule_time", "duration_minutes", "max_students"]);
  const students = parseSheet<StudentRow>(studentData.values as string[][], ["full_name", "display_name", "nicknames", "grade_level", "class_names", "teacher_name", "enrollment_date", "special_needs", "notes"]);
  const parents = parseSheet<ParentRow>(parentData.values as string[][], ["full_name", "email", "phone", "children", "preferred_language", "communication_notes"]);

  return { schoolInfo, staff, classes, students, parents };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validate(data: ReturnType<typeof readAllSheets> extends Promise<infer T> ? T : never) {
  const errors: string[] = [];
  const staffNames = new Set(data.staff.map(s => s.full_name));
  const classNames = new Set(data.classes.map(c => c.name));
  const studentNames = new Set(data.students.map(s => s.full_name));

  // Staff validation
  for (const s of data.staff) {
    if (!s.full_name) errors.push("Staff: missing full_name");
    if (!s.email) errors.push(`Staff ${s.full_name}: missing email`);
    if (!["director", "teacher", "admin", "front_desk"].includes(s.role)) {
      errors.push(`Staff ${s.full_name}: invalid role "${s.role}"`);
    }
  }

  // Check duplicate emails
  const emails = [...data.staff.map(s => s.email), ...data.parents.map(p => p.email)].filter(Boolean);
  const seen = new Set<string>();
  for (const e of emails) {
    if (seen.has(e)) errors.push(`Duplicate email: ${e}`);
    seen.add(e);
  }

  // Class validation
  for (const c of data.classes) {
    if (!c.name) errors.push("Classes: missing name");
    if (c.teacher_name && !staffNames.has(c.teacher_name)) {
      errors.push(`Class "${c.name}": teacher "${c.teacher_name}" not found in Staff tab`);
    }
  }

  // Student validation
  for (const s of data.students) {
    if (!s.full_name) errors.push("Students: missing full_name");
    if (!s.grade_level) errors.push(`Student ${s.full_name}: missing grade_level`);
    if (s.teacher_name && !staffNames.has(s.teacher_name)) {
      errors.push(`Student "${s.full_name}": teacher "${s.teacher_name}" not found in Staff tab`);
    }
    if (s.class_names) {
      for (const cn of s.class_names.split(",").map(c => c.trim()).filter(Boolean)) {
        if (!classNames.has(cn)) {
          errors.push(`Student "${s.full_name}": class "${cn}" not found in Classes tab`);
        }
      }
    }
  }

  // Parent validation
  for (const p of data.parents) {
    if (!p.full_name) errors.push("Parents: missing full_name");
    if (!p.email) errors.push(`Parent ${p.full_name}: missing email`);
    if (p.children) {
      for (const ch of p.children.split(",").map(c => c.trim()).filter(Boolean)) {
        if (!studentNames.has(ch)) {
          errors.push(`Parent "${p.full_name}": child "${ch}" not found in Students tab`);
        }
      }
    }
  }

  return errors;
}

// ─── Import ─────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function importToSupabase(
  supabase: ReturnType<typeof createClient>,
  orgSlug: string,
  schoolName: string,
  data: Awaited<ReturnType<typeof readAllSheets>>,
) {
  // 1. Find or create organization + save school policies
  console.log("\n1. Organization...");
  let orgId: string;

  const schoolPolicies: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.schoolInfo)) {
    if (key !== "school_name_zh" && key !== "school_name_en") {
      schoolPolicies[key] = value;
    }
  }

  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();

  if (existingOrg) {
    orgId = existingOrg.id;
    console.log(`   Found existing org: ${orgId}`);
    // Update school policies
    if (Object.keys(schoolPolicies).length > 0) {
      await supabase.from("organizations").update({ school_policies: schoolPolicies }).eq("id", orgId);
      console.log(`   Updated school_policies (${Object.keys(schoolPolicies).length} fields)`);
    }
  } else {
    const orgName = data.schoolInfo.school_name_zh || schoolName;
    const { data: newOrg, error } = await supabase
      .from("organizations")
      .insert({ name: orgName, slug: orgSlug, school_policies: schoolPolicies })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create org: ${error.message}`);
    orgId = newOrg!.id;
    console.log(`   Created org: ${orgId}`);
  }

  // 2. Staff — create auth users + insert staff rows
  console.log("\n2. Staff...");
  const staffMap: Record<string, string> = {}; // name → staff.id

  for (const s of data.staff) {
    // Check if staff already exists by email
    const { data: existingStaff } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("organization_id", orgId)
      .eq("full_name", s.full_name)
      .single();

    if (existingStaff) {
      staffMap[s.full_name] = existingStaff.id;
      console.log(`   Skipped (exists): ${s.full_name}`);
      continue;
    }

    // Create auth user
    const password = s.password || "EddyFlow2026!";
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: s.email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      if (authErr.message.includes("already been registered")) {
        // Find existing auth user
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users.find(u => u.email === s.email);
        if (existing) {
          const { data: staffRow, error: staffErr } = await supabase
            .from("staff")
            .insert({
              organization_id: orgId,
              full_name: s.full_name,
              role: s.role,
              supabase_user_id: existing.id,
              subjects: s.subjects ? s.subjects.split(",").map(x => x.trim()) : [],
            })
            .select("id")
            .single();
          if (staffErr) throw new Error(`Staff insert failed for ${s.full_name}: ${staffErr.message}`);
          staffMap[s.full_name] = staffRow!.id;
          console.log(`   Imported (existing auth): ${s.full_name} (${s.role})`);
          continue;
        }
      }
      throw new Error(`Auth user creation failed for ${s.email}: ${authErr.message}`);
    }

    const { data: staffRow, error: staffErr } = await supabase
      .from("staff")
      .insert({
        organization_id: orgId,
        full_name: s.full_name,
        role: s.role,
        supabase_user_id: authUser.user.id,
        subjects: s.subjects ? s.subjects.split(",").map(x => x.trim()) : [],
      })
      .select("id")
      .single();

    if (staffErr) throw new Error(`Staff insert failed for ${s.full_name}: ${staffErr.message}`);
    staffMap[s.full_name] = staffRow!.id;
    console.log(`   Imported: ${s.full_name} (${s.role}) — ${s.email}`);
  }

  // 3. Classes
  console.log("\n3. Classes...");
  const classMap: Record<string, string> = {}; // name → class.id

  for (const c of data.classes) {
    const { data: existingClass } = await supabase
      .from("classes")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", c.name)
      .single();

    if (existingClass) {
      classMap[c.name] = existingClass.id;
      console.log(`   Skipped (exists): ${c.name}`);
      continue;
    }

    const schedule = {
      days: c.schedule_days ? c.schedule_days.split(",").map(d => d.trim()) : [],
      time: c.schedule_time || "16:00",
      duration_minutes: parseInt(c.duration_minutes) || 90,
    };

    const { data: classRow, error: classErr } = await supabase
      .from("classes")
      .insert({
        organization_id: orgId,
        name: c.name,
        subject: c.subject || "other",
        teacher_id: c.teacher_name ? staffMap[c.teacher_name] : null,
        schedule,
        max_students: parseInt(c.max_students) || 30,
      })
      .select("id")
      .single();

    if (classErr) throw new Error(`Class insert failed for ${c.name}: ${classErr.message}`);
    classMap[c.name] = classRow!.id;
    console.log(`   Imported: ${c.name} (${c.subject})`);
  }

  // 4. Students
  console.log("\n4. Students...");
  const studentMap: Record<string, string> = {}; // name → student.id

  for (const s of data.students) {
    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("organization_id", orgId)
      .eq("full_name", s.full_name)
      .single();

    if (existingStudent) {
      studentMap[s.full_name] = existingStudent.id;
      console.log(`   Skipped (exists): ${s.full_name}`);
      continue;
    }

    const classIds = s.class_names
      ? s.class_names.split(",").map(cn => classMap[cn.trim()]).filter(Boolean)
      : [];

    const nicknames = s.nicknames
      ? s.nicknames.split(",").map(n => n.trim()).filter(Boolean)
      : [];

    const { data: studentRow, error: studentErr } = await supabase
      .from("students")
      .insert({
        organization_id: orgId,
        full_name: s.full_name,
        display_name: s.display_name || null,
        nicknames,
        grade_level: s.grade_level,
        class_ids: classIds,
        assigned_teacher_id: s.teacher_name ? staffMap[s.teacher_name] : null,
        enrollment_date: s.enrollment_date || new Date().toISOString().slice(0, 10),
        special_needs: s.special_needs || null,
        notes: s.notes || null,
      })
      .select("id")
      .single();

    if (studentErr) throw new Error(`Student insert failed for ${s.full_name}: ${studentErr.message}`);
    studentMap[s.full_name] = studentRow!.id;
    console.log(`   Imported: ${s.full_name} (${s.grade_level})`);
  }

  // 5. Parents
  console.log("\n5. Parents...");
  const parentInvites: { name: string; email: string; inviteCode: string }[] = [];

  for (const p of data.parents) {
    const { data: existingParent } = await supabase
      .from("parents")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email", p.email)
      .single();

    if (existingParent) {
      console.log(`   Skipped (exists): ${p.full_name}`);
      continue;
    }

    // Create auth user for parent
    const password = "EddyFlow2026!";
    let authUserId: string;

    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: p.email,
      password,
      email_confirm: true,
    });

    if (authErr) {
      if (authErr.message.includes("already been registered")) {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users.find(u => u.email === p.email);
        if (!existing) throw new Error(`Cannot find existing auth user for ${p.email}`);
        authUserId = existing.id;
      } else {
        throw new Error(`Auth user creation failed for ${p.email}: ${authErr.message}`);
      }
    } else {
      authUserId = authUser.user.id;
    }

    const studentIds = p.children
      ? p.children.split(",").map(ch => studentMap[ch.trim()]).filter(Boolean)
      : [];

    const inviteCode = generateInviteCode();

    const { error: parentErr } = await supabase
      .from("parents")
      .insert({
        organization_id: orgId,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone || null,
        supabase_user_id: authUserId,
        student_ids: studentIds,
        invite_code: inviteCode,
        preferred_language: p.preferred_language || "zh-TW",
        communication_notes: p.communication_notes || null,
      });

    if (parentErr) throw new Error(`Parent insert failed for ${p.full_name}: ${parentErr.message}`);

    parentInvites.push({ name: p.full_name, email: p.email, inviteCode });
    console.log(`   Imported: ${p.full_name} — ${p.email}`);
  }

  return { orgId, staffMap, classMap, studentMap, parentInvites };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const spreadsheetId = process.argv[2];
  const orgSlug = process.argv[3];

  if (!spreadsheetId || !orgSlug) {
    console.error("Usage: npm run import-school <spreadsheet-id> <org-slug>");
    console.error("Example: npm run import-school 1BxC...abc xiong-buxiban");
    process.exit(1);
  }

  console.log(`\nImporting from spreadsheet: ${spreadsheetId}`);
  console.log(`Organization slug: ${orgSlug}`);
  console.log("=".repeat(50));

  // Load env + auth
  const { supabaseUrl, supabaseKey, clientId, clientSecret } = loadEnv();
  const auth = getGoogleAuth(clientId, clientSecret);
  const sheets = google.sheets({ version: "v4", auth });
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Read spreadsheet
  console.log("\nReading spreadsheet...");
  const data = await readAllSheets(sheets, spreadsheetId);
  console.log(`  School Info: ${Object.keys(data.schoolInfo).length} fields`);
  console.log(`  Staff: ${data.staff.length} rows`);
  console.log(`  Classes: ${data.classes.length} rows`);
  console.log(`  Students: ${data.students.length} rows`);
  console.log(`  Parents: ${data.parents.length} rows`);

  // Validate
  console.log("\nValidating...");
  const errors = validate(data);
  if (errors.length > 0) {
    console.error("\nValidation errors:");
    errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
    process.exit(1);
  }
  console.log("  All valid!");

  // Derive school name from first director or slug
  const director = data.staff.find(s => s.role === "director");
  const schoolName = orgSlug.replace(/-/g, " ");

  // Import
  const result = await importToSupabase(supabase, orgSlug, schoolName, data);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Import complete!\n");
  console.log(`  Organization: ${result.orgId}`);
  console.log(`  Staff:        ${Object.keys(result.staffMap).length}`);
  console.log(`  Classes:      ${Object.keys(result.classMap).length}`);
  console.log(`  Students:     ${Object.keys(result.studentMap).length}`);
  console.log(`  Parents:      ${result.parentInvites.length}`);

  if (result.parentInvites.length > 0) {
    console.log("\nParent invite codes:");
    console.log("  " + "-".repeat(60));
    console.log("  Name              Email                     Code");
    console.log("  " + "-".repeat(60));
    for (const inv of result.parentInvites) {
      console.log(`  ${inv.name.padEnd(18)} ${inv.email.padEnd(25)} ${inv.inviteCode}`);
    }
  }

  console.log("\nStaff can log in with their email + password from the sheet.");
  console.log("Parents can log in with their email + password: EddyFlow2026!");
}

main().catch((err) => {
  console.error(`\nImport failed: ${err.message}`);
  process.exit(1);
});
