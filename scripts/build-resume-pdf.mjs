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
// Canonical (committed) PDF lives in src/. Eleventy's passthrough copies it
// into _site/ on every build, so deploys (CF Workers, etc.) don't need
// Puppeteer/Chrome installed in the build env.
const committedPdf = path.join(projectRoot, "src", "resume.pdf");
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

  // --no-sandbox is required on GitHub Actions runners (Ubuntu disables
  // unprivileged user namespaces so Chrome's default sandbox fails at
  // startup). Safe here because we're only loading our own generated HTML.
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${tmpHtml}`, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0.4in", right: "0.5in", bottom: "0.4in", left: "0.5in" },
    });
    fs.writeFileSync(committedPdf, pdfBuffer);
    fs.writeFileSync(outputPdf, pdfBuffer);
    console.log(`wrote ${committedPdf} and ${outputPdf}`);
  } finally {
    await browser.close();
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
