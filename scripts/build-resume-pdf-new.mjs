import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const projectRoot = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, "");
const siteDir = path.join(projectRoot, "_site");
const printHtml = path.join(siteDir, "resume-print", "index.html");
const outputPdf = path.join(siteDir, "resume.pdf");

if (!fs.existsSync(printHtml)) {
  console.error(`error: ${printHtml} not found. Run 'npx eleventy' first.`);
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.goto(`file://${printHtml}`, { waitUntil: "networkidle0" });
  await page.pdf({
    path: outputPdf,
    format: "letter",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0.6in", right: "0.7in", bottom: "0.6in", left: "0.7in" },
  });
  console.log(`wrote ${outputPdf}`);
} finally {
  await browser.close();
}
