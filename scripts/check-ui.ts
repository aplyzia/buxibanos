import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { chromium } from "playwright";
import type { Page, Browser, BrowserContext, ConsoleMessage } from "playwright";

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = 8081;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = path.join(os.tmpdir(), "eddyflow-ui-check");
const CREDENTIALS = {
  email: "director@xiong-buxiban.com",
  password: "DevPass123!",
};

// Map file paths under src/app/ to web routes.
// (group) segments like (staff) are stripped; [param] routes get a placeholder.
const ROUTE_MAP: Record<string, string> = {
  // ── Staff tabs ──
  "src/app/(staff)/(tabs)/dashboard.tsx":       "/dashboard",
  "src/app/(staff)/(tabs)/messages.tsx":        "/messages",
  "src/app/(staff)/(tabs)/tasks.tsx":           "/tasks",
  // ── Staff screens ──
  "src/app/(staff)/analytics/index.tsx":        "/analytics",
  "src/app/(staff)/announcements/index.tsx":    "/announcements",
  "src/app/(staff)/announcements/create/index.tsx": "/announcements/create",
  "src/app/(staff)/attendance/index.tsx":       "/attendance",
  "src/app/(staff)/briefing/index.tsx":         "/briefing",
  "src/app/(staff)/channels/index.tsx":         "/channels",
  "src/app/(staff)/channels/create/index.tsx":  "/channels/create",
  "src/app/(staff)/emergency-call/index.tsx":   "/emergency-call",
  "src/app/(staff)/fees/index.tsx":             "/fees",
  "src/app/(staff)/settings/index.tsx":         "/settings",
  "src/app/(staff)/students/index.tsx":         "/students",
  "src/app/(staff)/tasks/create/index.tsx":     "/tasks/create",
  "src/app/(staff)/messages/parent-select.tsx": "/messages/parent-select",
  // ── Auth ──
  "src/app/(auth)/sign-in/index.tsx":           "/sign-in",
  // ── Parent tabs ──
  "src/app/(parent)/(tabs)/messages.tsx":       "/messages",
  "src/app/(parent)/(tabs)/announcements.tsx":  "/announcements",
  "src/app/(parent)/(tabs)/fees.tsx":           "/fees",
  "src/app/(parent)/(tabs)/schedule.tsx":       "/schedule",
  "src/app/(parent)/(tabs)/documents.tsx":      "/documents",
  "src/app/(parent)/settings/index.tsx":        "/settings",
  // ── Teacher tabs ──
  "src/app/(teacher)/(tabs)/chats.tsx":         "/chats",
  "src/app/(teacher)/(tabs)/attendance.tsx":    "/attendance",
  "src/app/(teacher)/(tabs)/tasks.tsx":         "/tasks",
  "src/app/(teacher)/settings/index.tsx":       "/settings",
  "src/app/(teacher)/channels/create/index.tsx":"/channels/create",
};

// Files that aren't screens but affect rendering — map to the dashboard for a smoke test.
const INFRA_PATTERNS = [
  "src/app/_layout.tsx",
  "src/components/",
  "src/theme/",
  "src/stores/",
  "src/i18n/",
  "src/lib/",
  "src/hooks/",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ConsoleEntry = { level: string; text: string };

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function screenshotPath(name: string) {
  return path.join(OUT_DIR, `${name}.png`);
}

async function snap(page: Page, context: BrowserContext, name: string, waitMs = 1000) {
  await page.waitForTimeout(waitMs);
  const file = screenshotPath(name);
  try {
    await page.screenshot({ type: "png", path: file, timeout: 10_000 });
  } catch {
    const cdp = await context.newCDPSession(page);
    const result = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  }
  return file;
}

// ─── Dev Server Management ──────────────────────────────────────────────────

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.connect(port, "127.0.0.1");
  });
}

async function waitForServer(port: number, timeoutMs = 90_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Dev server did not start within ${timeoutMs / 1000}s`);
}

function startDevServer(): ChildProcess {
  process.stdout.write("Starting Expo dev server (web)...\n");
  const child = spawn("npx", ["expo", "start", "--web", "--port", String(PORT)], {
    stdio: "ignore",
    detached: false,
    shell: true,
  });
  return child;
}

function stopServer(child: ChildProcess) {
  try {
    if (child.pid) {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", shell: true });
      } else {
        process.kill(-child.pid, "SIGTERM");
      }
    }
  } catch {}
}

// ─── Git-aware route detection ──────────────────────────────────────────────

function getChangedRoutes(): string[] {
  let changedFiles: string[] = [];
  try {
    // Staged + unstaged + untracked files
    const opts = { encoding: "utf-8" as const, stdio: ["pipe", "pipe", "pipe"] as const };
    let diff = "", staged = "", untracked = "";
    try { diff = execSync("git diff --name-only HEAD", opts); } catch {}
    try { staged = execSync("git diff --name-only --cached", opts); } catch {}
    try { untracked = execSync("git ls-files --others --exclude-standard", opts); } catch {}
    changedFiles = [...diff.split("\n"), ...staged.split("\n"), ...untracked.split("\n")]
      .map((f) => f.trim().replace(/\\/g, "/"))
      .filter(Boolean);
    // Dedupe
    changedFiles = [...new Set(changedFiles)];
  } catch {
    return [];
  }

  const routes = new Set<string>();

  for (const file of changedFiles) {
    // Direct screen file match
    if (ROUTE_MAP[file]) {
      routes.add(ROUTE_MAP[file]);
      continue;
    }
    // Infrastructure file — add dashboard as smoke test
    if (INFRA_PATTERNS.some((p) => file.startsWith(p))) {
      routes.add("/dashboard");
    }
  }

  return [...routes];
}

// ─── Check a single route ───────────────────────────────────────────────────

interface CheckResult {
  route: string;
  finalUrl: string;
  title: string;
  isBlank: boolean;
  hasErrorBoundary: boolean;
  hasOverlay: boolean;
  errors: ConsoleEntry[];
  warnings: ConsoleEntry[];
  pageErrors: string[];
  screenshotFile: string;
  healthy: boolean;
}

async function checkRoute(
  browser: Browser,
  route: string,
  noLogin: boolean,
): Promise<CheckResult> {
  const logs: ConsoleEntry[] = [];
  const pageErrors: string[] = [];

  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await context.newPage();

  page.on("console", (msg: ConsoleMessage) => {
    logs.push({ level: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // Navigate to app root first (triggers auth)
  await page.goto(BASE, { waitUntil: "commit", timeout: 60_000 });
  await page.waitForLoadState("load", { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(8000);

  // Login
  if (!noLogin) {
    const emailInput = page.locator('input[type="email"], input[placeholder="Enter your email"]');
    const found = await emailInput.count();
    if (found > 0) {
      await emailInput.fill(CREDENTIALS.email);
      await page.locator('input[type="password"], input[placeholder="Enter your password"]').fill(CREDENTIALS.password);
      await page.locator("text=Sign In").first().click();
      await page.waitForTimeout(4000);
    }
  }

  // Navigate to target route
  if (route && route !== "/dashboard") {
    const targetUrl = `${BASE}${route}`;
    await page.goto(targetUrl, { waitUntil: "commit", timeout: 30_000 });
    await page.waitForTimeout(4000);
  }

  // Screenshot
  const safeName = route.replace(/\//g, "_").replace(/^_/, "") || "root";
  const screenshotFile = await snap(page, context, safeName, 500);

  // Health checks
  const title = await page.title();
  const finalUrl = page.url();
  const body = (await page.textContent("body")) || "";
  const isBlank = body.trim().length < 10;
  const hasErrorBoundary = /something went wrong|error boundary|application error/i.test(body);
  const hasOverlay =
    (await page.$('[data-testid="error-overlay"]')) !== null ||
    (await page.$(".expo-error-overlay")) !== null;

  await context.close();

  const errors = logs.filter((l) => l.level === "error");
  const warnings = logs.filter((l) => l.level === "warning" || l.level === "warn");
  const healthy = !isBlank && !hasErrorBoundary && !hasOverlay && pageErrors.length === 0 && errors.length === 0;

  return { route, finalUrl, title, isBlank, hasErrorBoundary, hasOverlay, errors, warnings, pageErrors, screenshotFile, healthy };
}

// ─── Report ─────────────────────────────────────────────────────────────────

function buildReport(results: CheckResult[]): string {
  let r = `Checked ${results.length} route(s)\n`;
  r += "=".repeat(50) + "\n\n";

  for (const res of results) {
    const verdict = res.healthy ? "HEALTHY" : "ISSUES";
    r += `Route: ${res.route}\n`;
    r += `  URL: ${BASE} → ${res.finalUrl}\n`;
    r += `  Blank: ${res.isBlank ? "YES" : "no"} | Error boundary: ${res.hasErrorBoundary ? "YES" : "no"} | Overlay: ${res.hasOverlay ? "YES" : "no"}\n`;
    r += `  Console: ${res.errors.length} errors, ${res.warnings.length} warnings, ${res.pageErrors.length} uncaught\n`;
    r += `  Verdict: ${verdict}\n`;

    if (res.pageErrors.length > 0) {
      r += `  Uncaught errors:\n`;
      res.pageErrors.forEach((e, i) => { r += `    ${i + 1}. ${e}\n`; });
    }
    if (res.errors.length > 0) {
      r += `  Console errors:\n`;
      res.errors.slice(0, 10).forEach((e, i) => { r += `    ${i + 1}. ${e.text}\n`; });
    }
    if (res.warnings.length > 0) {
      r += `  Console warnings:\n`;
      res.warnings.slice(0, 5).forEach((w, i) => { r += `    ${i + 1}. ${w.text}\n`; });
    }

    r += `  Screenshot: ${res.screenshotFile}\n\n`;
  }

  const allHealthy = results.every((r) => r.healthy);
  r += `Overall: ${allHealthy ? "ALL HEALTHY" : "ISSUES FOUND"}\n`;
  return r;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const noLogin = args.includes("--no-login");
  const autoMode = args.includes("--auto");
  const explicitRoute = args.find((a) => !a.startsWith("--")) || "";

  ensureOutDir();

  // Determine which routes to check
  let routes: string[];
  if (autoMode) {
    routes = getChangedRoutes();
    if (routes.length === 0) {
      process.stdout.write("No changed screens detected in git diff. Checking dashboard.\n");
      routes = ["/dashboard"];
    } else {
      process.stdout.write(`Git detected changes in: ${routes.join(", ")}\n`);
    }
  } else if (explicitRoute) {
    routes = [explicitRoute];
  } else {
    routes = ["/dashboard"];
  }

  // Auto-start dev server if not running
  let serverProcess: ChildProcess | null = null;
  const serverAlreadyRunning = await isPortOpen(PORT);

  if (!serverAlreadyRunning) {
    serverProcess = startDevServer();
    process.stdout.write(`Waiting for dev server on port ${PORT}...\n`);
    await waitForServer(PORT);
    await new Promise((r) => setTimeout(r, 5000));
    process.stdout.write("Dev server ready.\n");
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const results: CheckResult[] = [];

    for (const route of routes) {
      process.stdout.write(`Checking ${route}...\n`);
      const result = await checkRoute(browser, route, noLogin);
      results.push(result);
    }

    await browser.close();

    // Output report
    const report = buildReport(results);
    const reportFile = path.join(OUT_DIR, "report.txt");
    fs.writeFileSync(reportFile, report);

    process.stdout.write("\n" + report);
    process.stdout.write(`Report: ${reportFile}\n`);
  } finally {
    if (serverProcess) {
      process.stdout.write("Stopping dev server...\n");
      stopServer(serverProcess);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`check-ui failed: ${err.message}\n`);
  process.exit(1);
});
