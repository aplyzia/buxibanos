import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";
import type { Page, ConsoleMessage } from "playwright";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = "http://localhost:8081";
const OUT_DIR = path.join(os.tmpdir(), "buxibanos-ui-check");
const CREDENTIALS = {
  email: "director@xiong-buxiban.com",
  password: "DevPass123!",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ConsoleEntry = { level: string; text: string };

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function screenshotPath(name: string) {
  return path.join(OUT_DIR, `${name}.png`);
}

async function snap(page: Page, name: string, waitMs = 1000) {
  await page.waitForTimeout(waitMs);
  const file = screenshotPath(name);
  await page.screenshot({ type: "png", path: file });
  return file;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const route = args.find((a) => !a.startsWith("--")) || "";
  const noLogin = args.includes("--no-login");
  const fullPage = args.includes("--full-page");

  ensureOutDir();

  const logs: ConsoleEntry[] = [];
  const pageErrors: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await context.newPage();

  page.on("console", (msg: ConsoleMessage) => {
    logs.push({ level: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // Navigate to the app
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2000);

  // ── Login ──
  if (!noLogin) {
    const emailInput = page.locator('input[type="email"], input[placeholder="Enter your email"]');
    const found = await emailInput.count();

    if (found > 0) {
      await emailInput.fill(CREDENTIALS.email);
      await page.locator('input[type="password"], input[placeholder="Enter your password"]').fill(CREDENTIALS.password);
      await page.locator('text=Sign In').click();
      await page.waitForTimeout(4000);
    }
  }

  // ── Navigate to route (if specified) ──
  if (route) {
    if (route.startsWith("click:")) {
      const target = route.slice(6);
      await page.locator(`text=${target}`).first().click();
      await page.waitForTimeout(2000);
    } else {
      const targetUrl = route.startsWith("http") ? route : `${BASE}${route}`;
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(2000);
    }
  }

  // ── Final screenshot ──
  const finalFile = await snap(page, "final", fullPage ? 500 : 0);

  // ── Health checks ──
  const title = await page.title();
  const finalUrl = page.url();
  const body = (await page.textContent("body")) || "";
  const isBlank = body.trim().length < 10;
  const hasErrorBoundary = /something went wrong|error boundary|application error/i.test(body);
  const hasOverlay =
    (await page.$('[data-testid="error-overlay"]')) !== null ||
    (await page.$(".expo-error-overlay")) !== null;

  await browser.close();

  // ── Build report ──
  const errors = logs.filter((l) => l.level === "error");
  const warnings = logs.filter((l) => l.level === "warning" || l.level === "warn");
  const hasProblems = isBlank || hasErrorBoundary || hasOverlay || pageErrors.length > 0 || errors.length > 0;

  let r = `URL: ${BASE} → ${finalUrl}\n`;
  r += `Title: "${title}"\n`;
  r += `Blank: ${isBlank ? "YES" : "no"} | Error boundary: ${hasErrorBoundary ? "YES" : "no"} | Overlay: ${hasOverlay ? "YES" : "no"}\n`;
  r += `Console: ${errors.length} errors, ${warnings.length} warnings, ${pageErrors.length} uncaught\n`;
  r += `Verdict: ${hasProblems ? "ISSUES" : "HEALTHY"}\n`;

  if (pageErrors.length > 0) {
    r += `\nUncaught errors:\n`;
    pageErrors.forEach((e, i) => { r += `  ${i + 1}. ${e}\n`; });
  }
  if (errors.length > 0) {
    r += `\nConsole errors:\n`;
    errors.slice(0, 20).forEach((e, i) => { r += `  ${i + 1}. ${e.text}\n`; });
  }
  if (warnings.length > 0) {
    r += `\nConsole warnings:\n`;
    warnings.slice(0, 10).forEach((w, i) => { r += `  ${i + 1}. ${w.text}\n`; });
  }

  r += `\nScreenshot: ${finalFile}\n`;

  const reportFile = path.join(OUT_DIR, "report.txt");
  fs.writeFileSync(reportFile, r);

  process.stdout.write(r);
  process.stdout.write(`\nReport: ${reportFile}\n`);
}

main().catch((err) => {
  process.stderr.write(`check-ui failed: ${err.message}\n`);
  process.exit(1);
});
