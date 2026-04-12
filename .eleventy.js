import { dateRange, yearOf } from "./lib/resume-filters.mjs";

export default function (eleventyConfig) {
  eleventyConfig.setInputDirectory("src");
  eleventyConfig.setOutputDirectory("_site");
  eleventyConfig.setIncludesDirectory("_includes");
  eleventyConfig.setDataDirectory("_data");

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

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
