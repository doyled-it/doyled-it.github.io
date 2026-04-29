import { dateRange, yearOf } from "./lib/resume-filters.mjs";
import { statColor } from "./lib/baseball-filters.mjs";

export default function (eleventyConfig) {
  eleventyConfig.setInputDirectory("src");
  eleventyConfig.setOutputDirectory("_site");
  eleventyConfig.setIncludesDirectory("_includes");
  eleventyConfig.setDataDirectory("_data");

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy({ "src/resume.pdf": "resume.pdf" });

  eleventyConfig.addWatchTarget("src/_data/baseball.json");
  eleventyConfig.addWatchTarget("src/_data/league.json");

  eleventyConfig.setServerOptions({ port: 8080, showAllHosts: false });

  eleventyConfig.addFilter("readableDate", (d) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      timeZone: "UTC",
    });
  });

  eleventyConfig.addFilter("dateToISOString", (d) => {
    const date = d instanceof Date ? d : new Date(d);
    return date.toISOString();
  });

  eleventyConfig.addFilter("dateRange", dateRange);
  eleventyConfig.addFilter("yearOf", yearOf);
  eleventyConfig.addFilter("statColor", statColor);
  eleventyConfig.addFilter("fmtRate", (v, places = 3) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(places);
  });
  eleventyConfig.addFilter("fmtPct", (v, places = 1) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(places) + "%";
  });

  eleventyConfig.addCollection("words", (collection) =>
    collection
      .getFilteredByGlob("src/words/*.md")
      .sort((a, b) => b.date - a.date)
  );

  return {
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
