import { readFileSync, writeFileSync } from "fs";
import { render } from "jsonresume-theme-stackoverflow";
import puppeteer from "puppeteer";

const resume = JSON.parse(readFileSync("./assets/json/resume.json", "utf-8"));
let html = await render(resume);

// Replace orange color (#F36C21) with green (#4CAF50)
html = html.replace(/#F36C21/g, "#4CAF50");
html = html.replace(/#f36c21/g, "#4CAF50");

// Add company names and hide URL for work experience (dynamically)
if (resume.work) {
  resume.work.forEach((job) => {
    if (job.url && job.name) {
      const escapedUrl = job.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
      const workRegex = new RegExp(
        `<div class="company"></div>\\s*</header>\\s*<span class="url">\\s*<span class="fa-solid fa-up-right-from-square"></span>\\s*<a[^>]*href="${escapedUrl}"[^>]*>${escapedUrl}</a>\\s*</span>`,
        "g"
      );
      html = html.replace(
        workRegex,
        `<div class="company">at <a href="${job.url}" style="color: inherit; text-decoration: none;">${job.name}</a></div></header><span class="url" style="display: none;"></span>`
      );
    }
  });
}

// Add GitHub icon next to each project title and move dates inline (dynamically)
if (resume.projects) {
  resume.projects.forEach((project) => {
    if (project.name && project.url) {
      const escapedName = project.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const projectRegex = new RegExp(
        `<div class="position">(${escapedName})</div>\\s*<div class="date">\\s*<span class="startDate">([^<]+)</span>\\s*<span class="endDate">([^<]+)</span>\\s*</div>`,
        "g"
      );
      html = html.replace(
        projectRegex,
        `<div class="position">$1 <a href="${project.url}" style="text-decoration: none; margin-left: 0.25rem;" title="View on GitHub"><span class="fa-brands fa-github github social" style="color: #000; font-size: 0.9em;"></span></a> <span style="color: #666; margin-left: 0.5rem;">• $2$3</span></div>`
      );
    }
  });
}

// Add hyperlinks to education institutions (dynamically)
if (resume.education) {
  resume.education.forEach((edu) => {
    if (edu.url && edu.institution) {
      const escapedInstitution = edu.institution.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const institutionRegex = new RegExp(`<div class="institution">\\s*${escapedInstitution}\\s*</div>`, "g");
      html = html.replace(
        institutionRegex,
        `<div class="institution"><a href="${edu.url}" style="color: inherit; text-decoration: none;">${edu.institution}</a></div>`
      );
    }
  });
}

// Make publication titles clickable and replace summaries with authors (programmatically)
if (resume.publications) {
  resume.publications.forEach((pub) => {
    // Escape special regex characters in title
    const escapedTitle = pub.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Make title a clickable link (with bold for better visibility)
    const titleRegex = new RegExp(`<span class="name">\\s*${escapedTitle}\\s*</span>`, "g");
    html = html.replace(
      titleRegex,
      `<span class="name"><a href="${pub.url}" style="color: inherit; text-decoration: none; font-weight: 600;">${pub.name}</a></span>`
    );

    // Create authors string with Michael Doyle bolded - truncate if too many authors
    if (pub.authors) {
      let authorsHtml;
      const myIndex = pub.authors.indexOf("Michael Doyle");

      if (pub.authors.length > 7) {
        // Truncate long author lists
        const firstAuthors = pub.authors.slice(0, 2).map((author) => (author === "Michael Doyle" ? "<strong>Michael Doyle</strong>" : author));
        const lastAuthor = pub.authors[pub.authors.length - 1];

        if (myIndex <= 1) {
          // I'm in the first 2 authors
          authorsHtml = `${firstAuthors.join(", ")}, et al.`;
        } else if (myIndex >= pub.authors.length - 1) {
          // I'm the last author
          authorsHtml = `${firstAuthors.join(", ")}, ... <strong>Michael Doyle</strong>`;
        } else {
          // I'm somewhere in the middle
          authorsHtml = `${firstAuthors.join(", ")}, ... <strong>Michael Doyle</strong>, ... ${lastAuthor}`;
        }
      } else {
        // Keep full author list for shorter lists
        authorsHtml = pub.authors.map((author) => (author === "Michael Doyle" ? "<strong>Michael Doyle</strong>" : author)).join(", ");
      }

      // Replace summary with authors
      const summaryRegex = new RegExp(`(<span class="name">.*?${escapedTitle.substring(0, 30)}.*?</a></span>.*?)<div class="summary">.*?</div>`, "s");
      html = html.replace(
        summaryRegex,
        `$1<div class="authors" style="font-style: italic; color: #666; font-size: 0.9em; margin-top: 0.25rem;">${authorsHtml}</div>`
      );
    }
  });
}

// Add CSS to prevent page breaks inside sections and make skills one row
const pageBreakCSS = `
<style>
  section, .section, .work-item, .publication-item, .project-item, .education-item {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  h2, h3 {
    page-break-after: avoid;
    break-after: avoid;
  }
  /* Make skills section single row */
  #skills .row {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 1.5rem !important;
  }
  #skills .col-sm-6 {
    flex: 1 1 auto !important;
    width: auto !important;
  }
  #skills h4 {
    display: inline !important;
    margin-right: 0.5rem !important;
    font-size: 0.82rem !important;
    font-weight: 600 !important;
  }
  #skills .keywords {
    display: inline !important;
    font-size: 0.82rem !important;
  }
  #skills {
    font-size: 0.82rem !important;
  }
  /* Hide project website URL section */
  .project-item .website {
    display: none !important;
  }
  /* Hide original date div in projects since we moved it inline */
  .project-item .date {
    display: none !important;
  }
  /* Make project header inline */
  .project-item header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
  .project-item .position {
    display: inline;
  }
  /* Hide "Major courses:" label in education section */
  .courses::before {
    content: "" !important;
  }
  /* Improve publications section readability */
  .publication-item {
    margin-bottom: 1.5rem !important;
    padding-bottom: 1rem !important;
    border-bottom: 1px solid #e0e0e0 !important;
  }
  .publication-item:last-child {
    border-bottom: none !important;
  }
  .publication-item .publisher {
    font-size: 0.85em !important;
    color: #888 !important;
    margin-top: 0.2rem !important;
  }
  .publication-item .name {
    line-height: 1.4 !important;
  }
</style>
`;
html = html.replace("</head>", pageBreakCSS + "</head>");

// Save HTML for debugging
writeFileSync("resume.html", html);

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({
  path: "assets/pdf/resume.pdf",
  format: "Letter",
  printBackground: true,
  margin: {
    top: "0.5in",
    right: "0.5in",
    bottom: "0.5in",
    left: "0.5in",
  },
});

await browser.close();
console.log("Resume generated: assets/pdf/resume.pdf");
