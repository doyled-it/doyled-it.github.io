// Post folders in src/words/ are copied from the private doyled-it/words repo
// by its publish workflow. Edits made here get overwritten or deleted.
import { wordsPermalink } from "../../lib/words.mjs";

export default {
  layout: "layouts/post.njk",
  // Post bodies are plain markdown; never run them through Nunjucks.
  templateEngineOverride: "md",
  eleventyComputed: { permalink: wordsPermalink },
};
