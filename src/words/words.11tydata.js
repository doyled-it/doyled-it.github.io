import { wordsPermalink } from "../../lib/words.mjs";

export default {
  layout: "layouts/post.njk",
  eleventyComputed: { permalink: wordsPermalink },
};
