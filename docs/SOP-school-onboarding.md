# SOP: School Onboarding — EddyFlow

Standard Operating Procedure for onboarding a new cram school onto the EddyFlow platform.

---

## Overview

| Step | What | Who | Time |
|------|------|-----|------|
| 1 | Create Google Drive folder + spreadsheet | EddyFlow operator | 2 min |
| 2 | School uploads existing documents | School admin | 1-2 days |
| 3 | AI scans documents and pre-fills data | EddyFlow operator | 5 min |
| 4 | School reviews and corrects extracted data | School admin | 30-60 min |
| 5 | Import approved data to Eddy | EddyFlow operator | 2 min |
| 6 | Distribute login credentials | EddyFlow operator | 10 min |

Total hands-on time for EddyFlow operator: ~20 minutes per school.

---

## Prerequisites

Before starting, ensure:

- [ ] Node.js installed on operator's computer
- [ ] Project cloned: `Cram-claude/` directory
- [ ] Google OAuth configured (Client ID + Secret in `Cram-n8n/.env`)
- [ ] Anthropic API key configured in `Cram-n8n/.env`
- [ ] First-time only: run `npm run onboard-school "Test"` to complete Google OAuth consent in browser

---

## Step 1: Create School Workspace

Open a terminal in the `Cram-claude/` project directory.

```bash
npm run onboard-school "學校名稱"
```

Replace `"學校名稱"` with the school's Chinese name (e.g., `"熊補習班"`).

**What this creates:**
- Google Drive folder: `學校名稱 — EddyFlow/`
  - `Reports/` — for weekly AI-generated reports
  - `Curriculum/` — sample curriculum outlines (3 docs)
  - `Handouts/` — sample parent notices + test papers (2 docs)
  - `Policies/` — school rules + fee schedule (2 docs)
- Google Sheet: `學校名稱 — 入學資料 (Onboarding Data)`
  - 5 tabs: School Info, Staff, Classes, Students, Parents
  - Pre-filled with sample data showing expected format

**Save the output — you'll need these two IDs:**
```
Root folder:  1Abc...xyz     ← Drive folder ID
Spreadsheet:  1BxC...abc     ← Spreadsheet ID
```

**Share the Drive folder** with the school contact (Google account → Share → Editor access).

---

## Step 2: School Uploads Documents

Send the school admin the following message (template below). They upload their existing documents into the shared Google Drive folder.

### Message Template (Chinese)

```
您好，歡迎加入 EddyFlow！

為了幫您快速建立系統資料，請將以下文件上傳到我們共享的 Google Drive 資料夾：

📁 Google Drive 連結：[貼上 Drive 連結]

請上傳：
1. 學生名冊（Excel 或 PDF）— 包含學生姓名、年級、班別
2. 家長聯絡資料（Excel 或 PDF）— 包含家長姓名、電話、Email、對應學生
3. 教職員名單 — 包含老師姓名、職務、Email
4. 課程時間表 — 包含班別名稱、科目、上課時間、老師
5. 收費標準表 — 學費金額、繳費期限
6. 補習班規章制度 — 請假規定、遲到規定、退費辦法

支援格式：PDF、Word (.docx)、Excel (.xlsx)、Google 文件、Google 試算表

上傳完成後請通知我們，我們會用 AI 自動整理資料，再請您確認。

謝謝！
```

### Accepted File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Google Docs | — | Created directly in Drive |
| Google Sheets | — | Created directly in Drive |
| PDF | .pdf | Text-based PDFs only (not scanned images) |
| Word | .docx | Recommended over .doc |
| Word (legacy) | .doc | Limited support — suggest converting to .docx |
| Excel | .xlsx, .xls | All sheets are read |

---

## Step 3: AI Document Scan

Once the school has uploaded their documents:

```bash
npm run scan-docs <drive-folder-id> <spreadsheet-id>
```

Example:
```bash
npm run scan-docs 1Abc...xyz 1BxC...abc
```

**What this does:**
1. Reads every document in the Drive folder (including subfolders)
2. Extracts text from each file
3. Uses Claude AI to classify each document (student list? policy? fee schedule?)
4. Extracts structured data (names, grades, phone numbers, etc.)
5. Writes results to **AI-* tabs** in the spreadsheet (orange headers)

**Expected output:**
```
Scan complete!

  Documents scanned: 12
  School Info:       7 fields
  Staff:             3
  Classes:           5
  Students:          28
  Parents:           22
```

**Cost:** ~$0.45 per school (paid via Anthropic API).

**If the scan misses data:** The school may have scanned PDF images (no text layer) or legacy .doc files. Ask them to re-upload as .docx or type directly into Google Sheets.

---

## Step 4: School Reviews Data

The spreadsheet now has two sets of tabs:

| Tab Color | Tabs | Purpose |
|-----------|------|---------|
| **Blue** (main) | School Info, Staff, Classes, Students, Parents | Final data for import |
| **Orange** (AI) | AI-School Info, AI-Staff, AI-Classes, AI-Students, AI-Parents | AI-extracted draft |

Send the school admin the spreadsheet link and ask them to:

1. **Review each orange AI tab** for accuracy
2. **Copy correct rows** from AI tabs → main (blue) tabs
3. **Fix any errors** — wrong names, missing data, incorrect grade levels
4. **Add missing data** — anything the AI couldn't find in the documents
5. **Fill in required fields** the AI can't know:
   - Staff tab: `email` and `password` for each staff member
   - Parents tab: `email` for each parent
6. **Delete the sample data rows** in the blue tabs (the example 王老師, 李美玲, etc.)

### Review Message Template (Chinese)

```
您好，

AI 已經從您上傳的文件中提取了資料，請檢查以下試算表：

📊 試算表連結：[貼上 Sheet 連結]

請您：
1. 查看橘色標籤（AI-Staff, AI-Students 等）的 AI 提取結果
2. 將正確的資料複製到藍色標籤（Staff, Students 等）
3. 修正任何錯誤（姓名、年級、班別等）
4. 補充 AI 無法提取的資訊：
   - Staff 標籤：每位老師的 email 和 password
   - Parents 標籤：每位家長的 email
5. 刪除藍色標籤中的範例資料（王老師、李美玲等）

完成後請通知我們，我們就會將資料匯入系統。

謝謝！
```

### Data Validation Rules

The spreadsheet enforces these via dropdown menus:

| Field | Valid Values |
|-------|-------------|
| Staff → role | `director`, `teacher`, `admin`, `front_desk` |
| Classes → subject | `math`, `english`, `science`, `chinese`, `other` |
| Parents → preferred_language | `zh-TW`, `en` |
| Students → grade_level | Free text, but use Taiwan format: `國小一~六年級`, `國中一~三年級` |

---

## Step 5: Import to EddyFlow

Once the school confirms the data is correct:

```bash
npm run import-school <spreadsheet-id> <org-slug>
```

The `<org-slug>` is a URL-safe identifier for the school (lowercase, hyphens, no spaces).

Example:
```bash
npm run import-school 1BxC...abc xiong-buxiban
```

**What this does:**
1. Reads the blue (main) tabs from the spreadsheet
2. Validates all data (name references, required fields, duplicate emails)
3. Creates the organization in Supabase
4. Creates auth accounts for all staff and parents
5. Inserts staff → classes → students → parents (in order)
6. Generates invite codes for parents
7. Saves school policies to the organization record

**Expected output:**
```
Import complete!

  Organization: abc-123-def
  Staff:        3
  Classes:      5
  Students:     28
  Parents:      22

Parent invite codes:
  -------------------------------------------------------
  Name              Email                     Code
  -------------------------------------------------------
  林大偉            lin@gmail.com             A1B2C3D4
  王媽媽            wang@gmail.com            E5F6G7H8
```

**If validation fails:** The script will print specific errors (e.g., "Student 林小明: class 英文初級班 not found in Classes tab"). Fix the data in the spreadsheet and re-run.

**Safe to re-run:** The import skips records that already exist (matched by name/email), so you can run it multiple times without duplicating data.

---

## Step 6: Distribute Credentials

After import, send login credentials to the school.

### Staff Credentials

Staff log in with their email + password from the spreadsheet.

```
您好 [老師名字]，

您的 EddyFlow 帳號已建立：
📧 Email: [email from sheet]
🔑 密碼: [password from sheet]

請下載 EddyFlow App 並使用以上資訊登入。
首次登入後建議修改密碼。
```

### Parent Credentials

Parents log in with their email + default password `EddyFlow2026!`.

```
親愛的家長您好，

歡迎使用 EddyFlow！您的帳號已建立：
📧 Email: [email]
🔑 密碼: EddyFlow2026!
🎟️ 邀請碼: [invite code]

請下載 EddyFlow App 並使用以上資訊登入。
首次登入後請修改密碼。
```

---

## Troubleshooting

### "No .google-token.json found"

Run `npm run onboard-school "Test"` first to complete Google OAuth in your browser. This creates the token file.

### "OAuth redirect_uri_mismatch"

Ensure `http://localhost:3456/callback` is listed as an authorized redirect URI in your Google Cloud Console → OAuth 2.0 Client.

### "Scanned PDF — no text layer detected"

The PDF is an image scan. Ask the school to either:
- Re-upload as a Google Doc (Drive can OCR when uploading)
- Provide the data as an Excel file instead

### "Legacy .doc format"

Ask the school to open the file in Word and Save As → .docx, then re-upload.

### Validation errors during import

Common issues:
- **"teacher X not found in Staff tab"** — The teacher name in Classes/Students doesn't exactly match a name in the Staff tab. Fix the spelling.
- **"class X not found in Classes tab"** — Same issue with class names. Must be exact match.
- **"Duplicate email"** — Two records share the same email address. Each person needs a unique email.

### Re-running after fixing errors

Both `scan-docs` and `import-school` are safe to re-run:
- `scan-docs` clears and rewrites AI tabs each time
- `import-school` skips existing records (matched by name/email)

---

## Quick Reference

```bash
# Full onboarding pipeline:

# 1. Create workspace
npm run onboard-school "學校名稱"

# 2. (School uploads docs to Drive folder)

# 3. AI scan
npm run scan-docs <folder-id> <sheet-id>

# 4. (School reviews spreadsheet)

# 5. Import
npm run import-school <sheet-id> <org-slug>
```

---

*Last updated: 2026-03-14*
