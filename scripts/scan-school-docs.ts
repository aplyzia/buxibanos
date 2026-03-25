/**
 * School Document Scanner — Google Drive → AI Extraction → Onboarding Sheet
 *
 * Scans a school's Google Drive folder, extracts text from all documents
 * (Google Docs, Google Sheets, PDF, DOCX, XLSX), uses Claude Sonnet to
 * identify staff/classes/students/parents/policies, and writes results
 * to AI-* tabs in the onboarding spreadsheet for human review.
 *
 * Usage:
 *   npm run scan-docs <drive-folder-id> <spreadsheet-id>
 *
 * Example:
 *   npm run scan-docs 1Abc...xyz 1BxC...abc
 *
 * Prerequisites:
 *   - Run onboard-school.ts first (creates folder + spreadsheet + OAuth token)
 *   - .google-token.json must exist
 *   - ANTHROPIC_API_KEY in Cram-n8n/.env (or local .env)
 */

import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN_PATH = path.join(import.meta.dirname, "..", ".google-token.json");
const MODEL = "claude-sonnet-4-6";
const MAX_CHARS_PER_DOC = 50_000;
const MAX_CONCURRENT_CLASSIFY = 5;

const SUPPORTED_MIME_TYPES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

// ─── Env Loading ────────────────────────────────────────────────────────────

function loadEnv(): { clientId: string; clientSecret: string; anthropicKey: string } {
  const envPaths = [
    path.join(import.meta.dirname, "..", ".env"),
    path.join(import.meta.dirname, "..", "..", "Cram-n8n", ".env"),
  ];

  let clientId = "", clientSecret = "", anthropicKey = "";

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf-8");

    if (!clientId) clientId = content.match(/GOOGLE_DRIVE_CLIENT_ID=(.+)/)?.[1]?.trim() || "";
    if (!clientSecret) clientSecret = content.match(/GOOGLE_DRIVE_CLIENT_SECRET=(.+)/)?.[1]?.trim() || "";
    if (!anthropicKey) anthropicKey = content.match(/(?:EXPO_PUBLIC_)?ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim() || "";
  }

  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET in .env");
  if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY in .env");

  return { clientId, clientSecret, anthropicKey };
}

function getGoogleAuth(clientId: string, clientSecret: string) {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error("No .google-token.json found. Run 'npm run onboard-school' first to authorize.");
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:3456/callback");
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  oauth2.setCredentials(tokens);
  return oauth2;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type DriveService = ReturnType<typeof google.drive>;
type SheetsService = ReturnType<typeof google.sheets>;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface ExtractedDocument {
  fileId: string;
  fileName: string;
  mimeType: string;
  text: string;
  method: string;
}

type DocCategory =
  | "student_list"
  | "parent_contacts"
  | "staff_roster"
  | "class_schedule"
  | "fee_structure"
  | "school_policy"
  | "curriculum"
  | "other";

interface ClassifiedDocument extends ExtractedDocument {
  category: DocCategory;
  confidence: string;
  summary: string;
}

interface ExtractionResult {
  schoolInfo: Record<string, string>;
  staff: Record<string, string>[];
  classes: Record<string, string>[];
  students: Record<string, string>[];
  parents: Record<string, string>[];
}

// ─── Step 1: List Files ────────────────────────────────────────────────────

async function listFolderFiles(drive: DriveService, folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      pageToken,
    });
    const files = (res.data.files || []) as DriveFile[];
    allFiles.push(...files);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  // Recurse into subfolders
  const subfolders = allFiles.filter(f => f.mimeType === "application/vnd.google-apps.folder");
  for (const folder of subfolders) {
    const subFiles = await listFolderFiles(drive, folder.id);
    allFiles.push(...subFiles);
  }

  // Return only processable files (exclude folders and the onboarding spreadsheet)
  return allFiles.filter(f => SUPPORTED_MIME_TYPES.has(f.mimeType));
}

// ─── Step 2: Extract Text ──────────────────────────────────────────────────

async function extractText(
  drive: DriveService,
  sheets: SheetsService,
  file: DriveFile,
): Promise<ExtractedDocument> {
  const base = { fileId: file.id, fileName: file.name, mimeType: file.mimeType };

  // Google Docs → export as plain text
  if (file.mimeType === "application/vnd.google-apps.document") {
    const res = await drive.files.export(
      { fileId: file.id, mimeType: "text/plain" },
      { responseType: "text" },
    );
    return { ...base, text: String(res.data).slice(0, MAX_CHARS_PER_DOC), method: "drive-export" };
  }

  // Google Sheets → read all tabs via Sheets API
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: file.id });
    const sheetNames = meta.data.sheets?.map(s => s.properties?.title).filter(Boolean) as string[];
    const ranges = sheetNames.map(name => `'${name}'!A1:Z1000`);

    if (ranges.length === 0) return { ...base, text: "(empty spreadsheet)", method: "sheets-api" };

    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: file.id,
      ranges,
    });

    const allText = (res.data.valueRanges || []).map((vr, i) => {
      const rows = (vr.values || []).map(row => row.join("\t")).join("\n");
      return `[Sheet: ${sheetNames[i]}]\n${rows}`;
    }).join("\n\n");

    return { ...base, text: allText.slice(0, MAX_CHARS_PER_DOC), method: "sheets-api" };
  }

  // Binary files: download buffer
  const res = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "arraybuffer" },
  );
  const buffer = Buffer.from(res.data as ArrayBuffer);

  // PDF
  if (file.mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    if (!parsed.text.trim()) {
      return { ...base, text: "(scanned PDF — no text layer detected)", method: "pdf-parse-empty" };
    }
    return { ...base, text: parsed.text.slice(0, MAX_CHARS_PER_DOC), method: "pdf-parse" };
  }

  // DOCX
  if (file.mimeType.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { ...base, text: result.value.slice(0, MAX_CHARS_PER_DOC), method: "mammoth" };
  }

  // Legacy .doc — mammoth doesn't support it
  if (file.mimeType === "application/msword") {
    return { ...base, text: "(legacy .doc format — please convert to .docx or upload as Google Doc)", method: "unsupported" };
  }

  // XLSX / XLS
  if (file.mimeType.includes("spreadsheetml") || file.mimeType.includes("ms-excel")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const allText = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      return `[Sheet: ${name}]\n${XLSX.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
    return { ...base, text: allText.slice(0, MAX_CHARS_PER_DOC), method: "xlsx" };
  }

  return { ...base, text: "(unsupported format)", method: "unsupported" };
}

// ─── Step 3: Classify Documents (Pass 1) ───────────────────────────────────

async function classifyDocument(
  claude: Anthropic,
  doc: ExtractedDocument,
): Promise<ClassifiedDocument> {
  const preview = doc.text.slice(0, 2000);

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `You are a document classifier for Taiwan cram school (補習班) onboarding.

Classify this document into ONE category:
- student_list: student names, grades, enrollment info
- parent_contacts: parent names, phone numbers, emails
- staff_roster: teacher/staff names, roles, contact info
- class_schedule: class names, times, days, rooms
- fee_structure: tuition amounts, payment schedules, pricing
- school_policy: school rules, attendance policies, refund policies
- curriculum: course outlines, teaching plans, syllabi
- other: does not fit any above

Document name: "${doc.fileName}"
Content preview:
"""
${preview}
"""

Respond JSON only: {"category":"...","confidence":"high|medium|low","summary":"1 sentence English"}`,
    }],
  });

  const text = res.content[0].type === "text" ? res.content[0].text : "";
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      ...doc,
      category: parsed.category || "other",
      confidence: parsed.confidence || "low",
      summary: parsed.summary || "",
    };
  } catch {
    return { ...doc, category: "other", confidence: "low", summary: "Classification failed" };
  }
}

async function classifyAll(
  claude: Anthropic,
  docs: ExtractedDocument[],
): Promise<ClassifiedDocument[]> {
  const results: ClassifiedDocument[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < docs.length; i += MAX_CONCURRENT_CLASSIFY) {
    const batch = docs.slice(i, i + MAX_CONCURRENT_CLASSIFY);
    const batchResults = await Promise.allSettled(
      batch.map(doc => classifyDocument(claude, doc)),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}

// ─── Step 4: Extract Entities (Pass 2) ──────────────────────────────────────

function buildExtractionPrompt(category: DocCategory, docsText: string): string {
  const prompts: Record<string, string> = {
    student_list: `Extract ALL students from these Taiwan cram school documents.

Documents:
"""
${docsText}
"""

For each student, return a JSON object:
{"full_name":"Chinese full name","display_name":"nickname/short name","nicknames":"comma-separated alternatives","grade_level":"Taiwan format e.g. 國小三年級","class_names":"comma-separated class names","teacher_name":"primary teacher if mentioned","enrollment_date":"YYYY-MM-DD or empty","special_needs":"allergies, medical, disabilities","notes":"other notes"}

Rules:
- Keep Traditional Chinese as-is
- Grade levels: 國小一~六年級, 國中一~三年級, 高中一~三年級
- Empty string for unknown fields
- Deduplicate by full_name

Return JSON array only.`,

    parent_contacts: `Extract ALL parents/guardians from these Taiwan cram school documents.

Documents:
"""
${docsText}
"""

For each parent, return:
{"full_name":"Chinese name","email":"email or empty","phone":"phone or empty","children":"comma-separated child names","preferred_language":"zh-TW","communication_notes":"known preferences or concerns"}

Return JSON array only.`,

    staff_roster: `Extract ALL staff/teachers from these Taiwan cram school documents.

Documents:
"""
${docsText}
"""

For each staff member, return:
{"full_name":"Chinese name","role":"director|teacher|admin|front_desk","email":"email or empty","subjects":"comma-separated: math,english,science,chinese,other"}

Return JSON array only.`,

    class_schedule: `Extract ALL classes from these Taiwan cram school documents.

Documents:
"""
${docsText}
"""

For each class, return:
{"name":"Chinese class name","subject":"math|english|science|chinese|other","teacher_name":"teacher name or empty","schedule_days":"comma-separated: monday,tuesday,etc","schedule_time":"HH:MM format","duration_minutes":"number","max_students":"number or empty"}

Return JSON array only.`,

    fee_structure: `Extract school fee/tuition information from these Taiwan cram school documents.

Documents:
"""
${docsText}
"""

Return a JSON object with these fields (use the exact field names):
{"fee_due_day":"payment deadline info","refund_policy":"refund rules","fee_details":"summary of fee structure, amounts, discounts"}

Return JSON object only.`,

    school_policy: `Extract school policies and rules from these Taiwan cram school documents.

Documents:
"""
${docsText}
"""

Return a JSON object with these fields:
{"operating_hours":"hours of operation","late_policy":"lateness rules","absence_policy":"absence/leave rules","communication_guidelines":"how staff should communicate with parents","special_rules":"classroom rules, phone policies, food rules","pickup_rules":"student pickup/dismissal rules","academic_calendar":"holidays, exam periods, breaks"}

Use Traditional Chinese. Empty string for fields not found. Return JSON object only.`,

    curriculum: `Extract class/course information from these Taiwan cram school curriculum documents.

Documents:
"""
${docsText}
"""

For each class/course found, return:
{"name":"course name","subject":"math|english|science|chinese|other","teacher_name":"teacher if mentioned","schedule_days":"","schedule_time":"","duration_minutes":"","max_students":""}

Also extract any teacher names mentioned. Return JSON array only.`,
  };

  return prompts[category] || `Summarize this document:\n"""${docsText}"""\nReturn JSON: {"summary":"..."}`;
}

async function extractEntities(
  claude: Anthropic,
  classified: ClassifiedDocument[],
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    schoolInfo: {},
    staff: [],
    classes: [],
    students: [],
    parents: [],
  };

  // Group by category
  const groups = new Map<DocCategory, ClassifiedDocument[]>();
  for (const doc of classified) {
    if (doc.category === "other") continue;
    const existing = groups.get(doc.category) || [];
    existing.push(doc);
    groups.set(doc.category, existing);
  }

  for (const [category, docs] of groups) {
    const combinedText = docs.map(d => `--- ${d.fileName} ---\n${d.text}`).join("\n\n");
    const prompt = buildExtractionPrompt(category, combinedText);

    console.log(`  Extracting from ${docs.length} ${category} doc(s)...`);

    try {
      const res = await claude.messages.create({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      });

      const text = res.content[0].type === "text" ? res.content[0].text : "";
      const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      switch (category) {
        case "student_list":
          result.students.push(...(Array.isArray(parsed) ? parsed : []));
          break;
        case "parent_contacts":
          result.parents.push(...(Array.isArray(parsed) ? parsed : []));
          break;
        case "staff_roster":
          result.staff.push(...(Array.isArray(parsed) ? parsed : []));
          break;
        case "class_schedule":
        case "curriculum":
          result.classes.push(...(Array.isArray(parsed) ? parsed : []));
          break;
        case "fee_structure":
          if (parsed.fee_due_day) result.schoolInfo.fee_due_day = parsed.fee_due_day;
          if (parsed.refund_policy) result.schoolInfo.refund_policy = parsed.refund_policy;
          break;
        case "school_policy":
          for (const [key, value] of Object.entries(parsed)) {
            if (value && typeof value === "string") result.schoolInfo[key] = value;
          }
          break;
      }
    } catch (err) {
      console.warn(`  WARN: Extraction failed for ${category}: ${(err as Error).message}`);
    }
  }

  // Deduplicate by full_name
  result.students = deduplicateByName(result.students);
  result.staff = deduplicateByName(result.staff);
  result.parents = deduplicateByName(result.parents);
  result.classes = deduplicateByName(result.classes, "name");

  return result;
}

function deduplicateByName<T extends Record<string, string>>(
  items: T[],
  nameField: string = "full_name",
): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const name = item[nameField];
    if (!name) continue;
    if (seen.has(name)) {
      // Merge: keep non-empty fields from both records
      const existing = seen.get(name)!;
      for (const [key, value] of Object.entries(item)) {
        if (value && !existing[key]) {
          (existing as any)[key] = value;
        }
      }
    } else {
      seen.set(name, { ...item });
    }
  }
  return [...seen.values()];
}

// ─── Step 5: Write AI Tabs ────────────────────────────────────────────────

async function writeAITabs(
  sheets: SheetsService,
  spreadsheetId: string,
  data: ExtractionResult,
): Promise<void> {
  // Get existing sheet metadata
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets || [];
  const existingNames = existingSheets.map(s => s.properties?.title);

  const aiTabs = ["AI-School Info", "AI-Staff", "AI-Classes", "AI-Students", "AI-Parents"];

  // Create or clear AI tabs
  const requests: any[] = [];
  for (const tabName of aiTabs) {
    if (existingNames.includes(tabName)) {
      const sheet = existingSheets.find(s => s.properties?.title === tabName);
      if (sheet?.properties?.sheetId != null) {
        requests.push({
          updateCells: {
            range: { sheetId: sheet.properties.sheetId },
            fields: "userEnteredValue",
          },
        });
      }
    } else {
      requests.push({
        addSheet: { properties: { title: tabName } },
      });
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  // Build data for each tab
  const staffRows = data.staff.map(s => [
    s.full_name || "", s.role || "", s.email || "", "", s.subjects || "",
  ]);
  const classRows = data.classes.map(c => [
    c.name || "", c.subject || "", c.teacher_name || "",
    c.schedule_days || "", c.schedule_time || "", c.duration_minutes || "", c.max_students || "",
  ]);
  const studentRows = data.students.map(s => [
    s.full_name || "", s.display_name || "", s.nicknames || "", s.grade_level || "",
    s.class_names || "", s.teacher_name || "", s.enrollment_date || "",
    s.special_needs || "", s.notes || "",
  ]);
  const parentRows = data.parents.map(p => [
    p.full_name || "", p.email || "", p.phone || "",
    p.children || "", p.preferred_language || "zh-TW", p.communication_notes || "",
  ]);
  const schoolInfoRows = Object.entries(data.schoolInfo).map(([k, v]) => [k, v]);

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        {
          range: "AI-School Info!A1:B50",
          values: [["欄位 Field", "AI-Extracted Value"], ...schoolInfoRows],
        },
        {
          range: "AI-Staff!A1:E100",
          values: [["full_name", "role", "email", "password", "subjects"], ...staffRows],
        },
        {
          range: "AI-Classes!A1:G100",
          values: [["name", "subject", "teacher_name", "schedule_days", "schedule_time", "duration_minutes", "max_students"], ...classRows],
        },
        {
          range: "AI-Students!A1:I200",
          values: [["full_name", "display_name", "nicknames", "grade_level", "class_names", "teacher_name", "enrollment_date", "special_needs", "notes"], ...studentRows],
        },
        {
          range: "AI-Parents!A1:F200",
          values: [["full_name", "email", "phone", "children", "preferred_language", "communication_notes"], ...parentRows],
        },
      ],
    },
  });

  // Format AI tab headers (orange to distinguish from blue real tabs)
  const refreshed = await sheets.spreadsheets.get({ spreadsheetId });
  const formatRequests: any[] = [];

  for (const tabName of aiTabs) {
    const sheet = refreshed.data.sheets?.find(s => s.properties?.title === tabName);
    if (!sheet?.properties?.sheetId) continue;
    const sheetId = sheet.properties.sheetId;

    formatRequests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.55, blue: 0.15 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    });
    formatRequests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
    formatRequests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 10 },
      },
    });
  }

  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: formatRequests } });
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const folderId = process.argv[2];
  const spreadsheetId = process.argv[3];

  if (!folderId || !spreadsheetId) {
    console.error("Usage: npm run scan-docs <drive-folder-id> <spreadsheet-id>");
    console.error("\nBoth IDs are printed by 'npm run onboard-school' at the end.");
    process.exit(1);
  }

  console.log("\nEddyFlow Document Scanner");
  console.log("=".repeat(50));

  // Auth
  const { clientId, clientSecret, anthropicKey } = loadEnv();
  const auth = getGoogleAuth(clientId, clientSecret);
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });
  const claude = new Anthropic({ apiKey: anthropicKey });

  // Step 1: List files
  console.log("\n1. Scanning Google Drive folder...");
  const files = await listFolderFiles(drive, folderId);

  if (files.length === 0) {
    console.log("   No processable documents found in the folder.");
    console.log("   Supported: Google Docs, Google Sheets, PDF, DOCX, XLSX");
    process.exit(0);
  }

  console.log(`   Found ${files.length} document(s):`);
  for (const f of files) {
    const type = f.mimeType.includes("google-apps.document") ? "Google Doc"
      : f.mimeType.includes("google-apps.spreadsheet") ? "Google Sheet"
      : f.mimeType.includes("pdf") ? "PDF"
      : f.mimeType.includes("wordprocessingml") ? "DOCX"
      : f.mimeType.includes("msword") ? "DOC"
      : f.mimeType.includes("spreadsheetml") || f.mimeType.includes("ms-excel") ? "Excel"
      : f.mimeType;
    console.log(`   - ${f.name} (${type})`);
  }

  // Step 2: Extract text
  console.log("\n2. Extracting text...");
  const documents: ExtractedDocument[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    try {
      const doc = await extractText(drive, sheets, file);
      if (doc.method === "unsupported" || doc.method === "pdf-parse-empty") {
        console.log(`   SKIP: ${file.name} — ${doc.text}`);
        skipped.push(file.name);
      } else {
        console.log(`   OK: ${file.name} (${doc.text.length} chars via ${doc.method})`);
        documents.push(doc);
      }
    } catch (err) {
      console.warn(`   FAIL: ${file.name} — ${(err as Error).message}`);
      skipped.push(file.name);
    }
  }

  if (documents.length === 0) {
    console.log("\n   No text could be extracted from any document.");
    process.exit(0);
  }

  // Step 3: Classify
  console.log(`\n3. Classifying ${documents.length} document(s) with Claude...`);
  const classified = await classifyAll(claude, documents);

  for (const doc of classified) {
    console.log(`   ${doc.fileName} → ${doc.category} (${doc.confidence}) — ${doc.summary}`);
  }

  // Step 4: Extract entities
  console.log("\n4. Extracting structured data with Claude...");
  const extracted = await extractEntities(claude, classified);

  // Step 5: Write to Google Sheet
  console.log("\n5. Writing AI tabs to spreadsheet...");
  await writeAITabs(sheets, spreadsheetId, extracted);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Scan complete!\n");
  console.log(`  Documents scanned: ${documents.length}`);
  if (skipped.length > 0) console.log(`  Skipped:           ${skipped.length}`);
  console.log(`  School Info:       ${Object.keys(extracted.schoolInfo).length} fields`);
  console.log(`  Staff:             ${extracted.staff.length}`);
  console.log(`  Classes:           ${extracted.classes.length}`);
  console.log(`  Students:          ${extracted.students.length}`);
  console.log(`  Parents:           ${extracted.parents.length}`);
  console.log(`\nSheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log("\nReview the AI-* tabs (orange headers), then copy approved rows to the main tabs.");
  console.log("When ready: npm run import-school " + spreadsheetId + " <org-slug>");
}

main().catch((err) => {
  console.error(`\nScan failed: ${err.message}`);
  process.exit(1);
});
