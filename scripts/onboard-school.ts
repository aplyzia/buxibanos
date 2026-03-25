/**
 * School Onboarding Script — Google Drive Setup
 *
 * Creates the standard folder structure and uploads sample template files
 * for a new school onboarding onto EddyFlow.
 *
 * Usage:
 *   npm run onboard-school "熊補習班"
 *   npm run onboard-school "Bear Academy"
 *
 * First run: opens browser for Google OAuth consent, saves refresh token.
 * Subsequent runs: reuses saved token automatically.
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { google } from "googleapis";
import open from "open";

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN_PATH = path.join(import.meta.dirname, "..", ".google-token.json");
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

// Read credentials from Cram-n8n .env or local .env
function loadCredentials(): { clientId: string; clientSecret: string } {
  const envPaths = [
    path.join(import.meta.dirname, "..", ".env"),
    path.join(import.meta.dirname, "..", "..", "Cram-n8n", ".env"),
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf-8");
    const clientId = content.match(/GOOGLE_DRIVE_CLIENT_ID=(.+)/)?.[1]?.trim();
    const clientSecret = content.match(/GOOGLE_DRIVE_CLIENT_SECRET=(.+)/)?.[1]?.trim();
    if (clientId && clientSecret) return { clientId, clientSecret };
  }

  throw new Error(
    "Missing GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET in .env"
  );
}

// ─── OAuth2 ─────────────────────────────────────────────────────────────────

function createOAuth2Client(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(clientId, clientSecret, "http://localhost:3456/callback");
}

async function getAuthenticatedClient(clientId: string, clientSecret: string) {
  const oauth2 = createOAuth2Client(clientId, clientSecret);

  // Reuse saved token
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    oauth2.setCredentials(tokens);
    return oauth2;
  }

  // Interactive OAuth flow
  const authUrl = oauth2.generateAuthUrl({ access_type: "offline", scope: SCOPES });
  console.log("\nAuthorize in your browser. If it didn't open automatically, visit:\n");
  console.log(authUrl);
  console.log("");

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:3456`);
      const code = url.searchParams.get("code");
      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authorized! You can close this tab.</h2>");
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end("Missing code");
      }
    });
    server.listen(3456, () => {
      open(authUrl).catch(() => {});
    });
    server.on("error", reject);
    setTimeout(() => { server.close(); reject(new Error("OAuth timeout — run again and authorize within 3 min")); }, 180_000);
  });

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("Token saved for future runs.");
  return oauth2;
}

// ─── Drive Helpers ──────────────────────────────────────────────────────────

type DriveService = ReturnType<typeof google.drive>;

async function createFolder(drive: DriveService, name: string, parentId?: string): Promise<string> {
  const requestBody: any = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) requestBody.parents = [parentId];
  const res = await drive.files.create({ requestBody, fields: "id" });
  return res.data.id!;
}

async function uploadDoc(drive: DriveService, name: string, content: string, parentId: string) {
  await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
      mimeType: "application/vnd.google-apps.document",
    },
    media: {
      mimeType: "text/plain",
      body: content,
    },
    fields: "id",
  });
}

// ─── Google Sheet Template ──────────────────────────────────────────────────

type SheetsService = ReturnType<typeof google.sheets>;

async function createOnboardingSheet(
  sheets: SheetsService,
  drive: DriveService,
  schoolName: string,
  parentFolderId: string,
): Promise<string> {
  // Create the spreadsheet
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `${schoolName} — 入學資料 (Onboarding Data)` },
      sheets: [
        { properties: { sheetId: 0, title: "School Info", index: 0 } },
        { properties: { sheetId: 1, title: "Staff", index: 1 } },
        { properties: { sheetId: 2, title: "Classes", index: 2 } },
        { properties: { sheetId: 3, title: "Students", index: 3 } },
        { properties: { sheetId: 4, title: "Parents", index: 4 } },
      ],
    },
  });

  const spreadsheetId = res.data.spreadsheetId!;

  // Move to school folder
  const fileRes = await drive.files.get({ fileId: spreadsheetId, fields: "parents" });
  const prevParents = (fileRes.data.parents || []).join(",");
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: parentFolderId,
    removeParents: prevParents,
  });

  // Populate headers + sample data
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        {
          range: "School Info!A1:B12",
          values: [
            ["欄位 Field", "內容 Value"],
            ["school_name_zh", schoolName],
            ["school_name_en", ""],
            ["operating_hours", "週一至週五 14:00-21:00，週六 09:00-17:00"],
            ["late_policy", "遲到超過15分鐘視為缺席；需上課前1小時通知請假"],
            ["absence_policy", "連續缺席三次未請假，主動聯繫家長"],
            ["fee_due_day", "每月25日前繳交下月學費"],
            ["refund_policy", "開課前全額退費；開課1/3內退2/3；超過2/3不退費"],
            ["communication_guidelines", "稱呼家長為「○○爸爸/媽媽」；回覆語氣親切專業；重要事項需電話確認"],
            ["academic_calendar", "清明連假 3/28-4/4 停課；期中考 4/14-4/25；暑假 7/1-8/31"],
            ["special_rules", "教室禁帶零食飲料（白開水除外）；手機須靜音"],
            ["pickup_rules", "下課後30分鐘內接送；超時收取臨時托管費"],
          ],
        },
        {
          range: "Staff!A1:E4",
          values: [
            ["full_name", "role", "email", "password", "subjects"],
            ["王老師", "director", "wang@example.com", "EddyFlow2026!", "english,math"],
            ["李美玲", "teacher", "li@example.com", "EddyFlow2026!", "english"],
            ["陳建志", "teacher", "chen@example.com", "EddyFlow2026!", "math,science"],
          ],
        },
        {
          range: "Classes!A1:G4",
          values: [
            ["name", "subject", "teacher_name", "schedule_days", "schedule_time", "duration_minutes", "max_students"],
            ["英文初級班", "english", "李美玲", "monday,wednesday", "16:00", "90", "25"],
            ["數學A班", "math", "陳建志", "tuesday,thursday", "16:00", "90", "30"],
            ["自然科學班", "science", "陳建志", "friday", "14:00", "120", "20"],
          ],
        },
        {
          range: "Students!A1:I6",
          values: [
            ["full_name", "display_name", "nicknames", "grade_level", "class_names", "teacher_name", "enrollment_date", "special_needs", "notes"],
            ["林小明", "小明", "明明,小明仔", "國小三年級", "英文初級班,數學A班", "李美玲", "2026-03-01", "", ""],
            ["王美美", "美美", "", "國小四年級", "英文初級班", "李美玲", "2026-03-01", "", ""],
            ["張大偉", "大偉", "偉偉", "國中一年級", "數學A班,自然科學班", "陳建志", "2026-02-15", "", ""],
            ["陳小華", "小華", "華華", "國小三年級", "英文初級班,數學A班", "李美玲", "2026-03-01", "花生過敏", "有過敏體質"],
            ["吳小芳", "小芳", "", "國中一年級", "自然科學班", "陳建志", "2026-01-10", "", ""],
          ],
        },
        {
          range: "Parents!A1:F5",
          values: [
            ["full_name", "email", "phone", "children", "preferred_language", "communication_notes"],
            ["林大偉", "lin.parent@example.com", "0912345678", "林小明", "zh-TW", "偏好用文字溝通，工作時間無法接電話"],
            ["王媽媽", "wang.parent@example.com", "0923456789", "王美美", "zh-TW", ""],
            ["張先生", "zhang.parent@example.com", "0934567890", "張大偉", "zh-TW", "關心數學成績，希望每週回報進度"],
            ["陳美麗", "chen.parent@example.com", "0945678901", "陳小華,吳小芳", "zh-TW", "小華有花生過敏，需特別注意點心"],
          ],
        },
      ],
    },
  });

  // Format headers + add data validation
  const headerFormat = {
    backgroundColor: { red: 0.2, green: 0.47, blue: 0.85 },
    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
  };

  const requests: any[] = [];

  // Format header rows for all 5 sheets
  for (const sheetId of [0, 1, 2, 3, 4]) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: headerFormat },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    });
    // Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    });
    // Auto-resize columns
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 10 },
      },
    });
  }

  // Data validation: Staff role dropdown (sheet 1, column B)
  requests.push({
    setDataValidation: {
      range: { sheetId: 1, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 1, endColumnIndex: 2 },
      rule: {
        condition: { type: "ONE_OF_LIST", values: [
          { userEnteredValue: "director" }, { userEnteredValue: "teacher" },
          { userEnteredValue: "admin" }, { userEnteredValue: "front_desk" },
        ]},
        showCustomUi: true, strict: true,
      },
    },
  });

  // Data validation: Classes subject dropdown (sheet 2, column B)
  requests.push({
    setDataValidation: {
      range: { sheetId: 2, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 1, endColumnIndex: 2 },
      rule: {
        condition: { type: "ONE_OF_LIST", values: [
          { userEnteredValue: "math" }, { userEnteredValue: "english" },
          { userEnteredValue: "science" }, { userEnteredValue: "chinese" },
          { userEnteredValue: "other" },
        ]},
        showCustomUi: true, strict: true,
      },
    },
  });

  // Data validation: Parents preferred_language dropdown (sheet 4, column E)
  requests.push({
    setDataValidation: {
      range: { sheetId: 4, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 4, endColumnIndex: 5 },
      rule: {
        condition: { type: "ONE_OF_LIST", values: [
          { userEnteredValue: "zh-TW" }, { userEnteredValue: "en" },
        ]},
        showCustomUi: true, strict: true,
      },
    },
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

  return spreadsheetId;
}

// ─── Sample Content Templates ───────────────────────────────────────────────

function getSampleFiles(schoolName: string) {
  return {
    curriculum: [
      {
        name: "國小三年級數學課程大綱.doc",
        content: `${schoolName} — 國小三年級數學課程大綱

學期：114學年度 第一學期
授課教師：___________

【課程目標】
1. 掌握三位數加減法的直式計算
2. 理解乘法概念與九九乘法表
3. 認識基本幾何圖形（三角形、四邊形、圓形）
4. 學會使用公分、公尺等長度單位
5. 培養邏輯思維與解題能力

【每週進度】
第 1-4 週：三位數加減法複習與進階
第 5-8 週：乘法概念導入、九九乘法表（2-5）
第 9-12 週：九九乘法表（6-9）、除法概念
第 13-16 週：長度測量與單位換算
第 17-20 週：基本幾何圖形與面積概念

【評量方式】
- 隨堂小考（每週）：30%
- 月考（每月）：40%
- 作業與課堂表現：30%

【教材】
- 主教材：康軒版國小數學第五冊
- 補充教材：本班自編講義
`,
      },
      {
        name: "國中英文Level 2課程大綱.doc",
        content: `${schoolName} — 國中英文 Level 2 課程大綱

學期：114學年度 第一學期
授課教師：___________
適合對象：國中一年級（具基礎英文能力）

【課程目標】
1. 掌握現在式、過去式、未來式基本句型
2. 累積字彙量達 800-1000 字
3. 能進行簡單日常英語對話
4. 閱讀理解短文（200字以內）
5. 書寫簡短段落（50字以上）

【每週進度】
第 1-4 週：現在簡單式複習 + 日常對話
第 5-8 週：過去式（規則/不規則動詞）
第 9-12 週：未來式（will / be going to）
第 13-16 週：閱讀理解策略 + 短文練習
第 17-20 週：寫作入門 + 學期總複習

【評量方式】
- 單字小考（每週）：20%
- 聽力測驗（每月）：20%
- 期中/期末考：40%
- 課堂參與與作業：20%

【教材】
- 主教材：翰林版國中英語第一冊
- 補充：English Grammar in Use (Basic)
- 線上資源：Quizlet 單字卡
`,
      },
      {
        name: "國小四年級自然科課程大綱.doc",
        content: `${schoolName} — 國小四年級自然科課程大綱

學期：114學年度 第一學期
授課教師：___________

【課程目標】
1. 認識植物的構造與生長過程
2. 了解水的三態變化與日常應用
3. 學習簡單電路與磁鐵原理
4. 培養觀察記錄與科學實驗能力
5. 建立科學探究的基本態度

【每週進度】
第 1-5 週：植物的根莖葉與光合作用
第 6-10 週：水的三態變化（實驗觀察）
第 11-15 週：簡單電路、導體與絕緣體
第 16-20 週：磁鐵的性質與應用

【評量方式】
- 實驗報告（每單元）：30%
- 月考：40%
- 課堂觀察筆記：30%
`,
      },
    ],
    handouts: [
      {
        name: "三月份家長通知.doc",
        content: `${schoolName} — 三月份家長通知

親愛的家長您好：

以下為本月重要事項通知：

【上課時間調整】
3/28（五）～ 4/4（五）清明連假，停課一週。
4/7（一）正常上課。

【期中考準備】
國小部：4/14（一）～ 4/18（五）
國中部：4/21（一）～ 4/25（五）
請督促孩子提前複習，如需額外輔導時段請與櫃台聯繫。

【繳費提醒】
四月份學費繳費期限：3/25（二）～ 3/31（一）
繳費方式：
1. 銀行轉帳（帳號請參考繳費單）
2. 現場繳費（週一至週五 14:00-21:00）

【親師座談會】
日期：3/22（六）上午 10:00
地點：本班二樓教室
歡迎家長踴躍參加，了解孩子學習狀況。

如有任何問題，歡迎來電或透過 EddyFlow 聯繫。

${schoolName} 敬上
`,
      },
      {
        name: "數學週考試卷 Week1.doc",
        content: `${schoolName} — 數學隨堂小考

班級：三年級A班
日期：___/___/___
姓名：___________
滿分：100分

一、計算題（每題10分，共50分）

1. 356 + 278 =

2. 803 - 467 =

3. 5 × 7 =

4. 9 × 6 =

5. 124 + 389 - 256 =

二、應用題（每題10分，共30分）

6. 小明有 356 元，媽媽又給他 278 元，小明現在有多少元？

7. 教室裡有 8 排座位，每排有 6 個座位，教室裡共有幾個座位？

8. 一盒巧克力有 9 顆，老師買了 4 盒，共有幾顆巧克力？

三、填充題（每題10分，共20分）

9. 7 × ___ = 56

10. ___ × 9 = 72
`,
      },
    ],
    policies: [
      {
        name: "補習班規章制度.doc",
        content: `${schoolName} — 補習班規章制度

【上課規定】
1. 上課時間：週一至週五，依各班級課表
2. 請假須於上課前一小時透過 EddyFlow 或電話通知
3. 遲到超過 15 分鐘視為缺席
4. 連續缺席三次未請假，將主動聯繫家長

【教室規範】
1. 手機須調為靜音或關機
2. 禁止攜帶零食飲料進入教室（白開水除外）
3. 愛護教室設備，損壞需照價賠償
4. 保持教室整潔，下課後清理個人座位

【安全規定】
1. 學生不得擅自離開補習班
2. 接送時間：下課後 30 分鐘內
3. 緊急聯絡人資料請務必保持更新
4. 如有身體不適請立即告知老師

【退費規定】
1. 開課前退費：全額退費
2. 開課後 1/3 內退費：退還 2/3 學費
3. 開課後 1/3 至 2/3 內退費：退還 1/3 學費
4. 超過 2/3 課程：不予退費

本規章經家長簽署後生效。
`,
      },
      {
        name: "收費標準表.doc",
        content: `${schoolName} — 114學年度收費標準

【國小部】
| 科目 | 堂數/月 | 月費（NT$）|
|------|---------|-----------|
| 數學 | 8 堂    | 3,600     |
| 英文 | 8 堂    | 3,600     |
| 自然 | 4 堂    | 2,000     |
| 國語 | 8 堂    | 3,600     |
| 全科班 | 28 堂 | 10,800    |

【國中部】
| 科目 | 堂數/月 | 月費（NT$）|
|------|---------|-----------|
| 數學 | 8 堂    | 4,200     |
| 英文 | 8 堂    | 4,200     |
| 理化 | 8 堂    | 4,200     |
| 國文 | 8 堂    | 4,200     |
| 全科班 | 32 堂 | 14,000    |

【優惠方案】
- 兄弟姐妹同時就讀：第二位起享 9 折
- 一次繳清一學期：享 95 折
- 早鳥優惠（開課前一個月報名）：減免 NT$500

【其他費用】
- 教材費：每學期 NT$800-1,200（依科目）
- 報名費：NT$500（新生，含學生證製作）

以上費用如有調整，將提前一個月通知。
`,
      },
    ],
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const schoolName = process.argv[2];
  if (!schoolName) {
    console.error('Usage: npm run onboard-school "學校名稱"');
    process.exit(1);
  }

  console.log(`\nOnboarding: ${schoolName}`);
  console.log("=".repeat(50));

  // Auth
  const { clientId, clientSecret } = loadCredentials();
  const auth = await getAuthenticatedClient(clientId, clientSecret);
  const drive = google.drive({ version: "v3", auth });

  // Create folder structure
  console.log("\nCreating folder structure...");
  const rootId = await createFolder(drive, `${schoolName} — EddyFlow`);
  console.log(`  Root: ${schoolName} — EddyFlow`);

  const folders: Record<string, string> = {};
  for (const name of ["Reports", "Curriculum", "Handouts", "Policies"]) {
    folders[name] = await createFolder(drive, name, rootId);
    console.log(`  └── ${name}`);
  }

  // Upload sample files
  const samples = getSampleFiles(schoolName);
  console.log("\nUploading sample files...");

  for (const file of samples.curriculum) {
    await uploadDoc(drive, file.name, file.content, folders["Curriculum"]);
    console.log(`  Curriculum/${file.name}`);
  }
  for (const file of samples.handouts) {
    await uploadDoc(drive, file.name, file.content, folders["Handouts"]);
    console.log(`  Handouts/${file.name}`);
  }
  for (const file of samples.policies) {
    await uploadDoc(drive, file.name, file.content, folders["Policies"]);
    console.log(`  Policies/${file.name}`);
  }

  // Create onboarding spreadsheet
  console.log("\nCreating onboarding spreadsheet...");
  const sheetsApi = google.sheets({ version: "v4", auth });
  const sheetId = await createOnboardingSheet(sheetsApi, drive, schoolName, rootId);
  console.log(`  Spreadsheet created: ${sheetId}`);

  // Output summary
  console.log("\n" + "=".repeat(50));
  console.log("Done! IDs (save for n8n config):\n");
  console.log(`  Root folder:  ${rootId}`);
  for (const [name, id] of Object.entries(folders)) {
    console.log(`  ${name.padEnd(12)}  ${id}`);
  }
  console.log(`  Spreadsheet:  ${sheetId}`);
  console.log(`\nDrive:  https://drive.google.com/drive/folders/${rootId}`);
  console.log(`Sheet:  https://docs.google.com/spreadsheets/d/${sheetId}`);
  console.log(`\nNext: fill in the spreadsheet, then run:`);
  console.log(`  npm run import-school ${sheetId} <org-slug>`);
}

main().catch((err) => {
  console.error(`Onboarding failed: ${err.message}`);
  process.exit(1);
});
