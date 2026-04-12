import { execSync } from "node:child_process";
import puppeteer from "puppeteer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, "");
const resumeJson = path.join(projectRoot, "src", "_data", "resume.json");
const themeDir = path.join(projectRoot, "node_modules", "jsonresume-theme-full-of-it");
const siteDir = path.join(projectRoot, "_site");
const outputPdf = path.join(siteDir, "resume.pdf");

if (!fs.existsSync(resumeJson)) {
  console.error(`error: ${resumeJson} not found.`);
  process.exit(1);
}
if (!fs.existsSync(themeDir)) {
  console.error(`error: ${themeDir} not found. Run 'npm install' first.`);
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-"));
const tmpHtml = path.join(tmpDir, "resume.html");

try {
  execSync(
    `npx hackmyresume build "${resumeJson}" TO "${tmpHtml}" -t "${themeDir}"`,
    { stdio: "inherit" }
  );

  if (!fs.existsSync(tmpHtml)) {
    throw new Error(`hackmyresume did not produce ${tmpHtml}`);
  }

  fs.mkdirSync(siteDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${tmpHtml}`, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outputPdf,
      format: "letter",
      printBackground: true,
      margin: { top: "0.4in", right: "0.5in", bottom: "0.4in", left: "0.5in" },
    });
    console.log(`wrote ${outputPdf}`);
  } finally {
    await browser.close();
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
