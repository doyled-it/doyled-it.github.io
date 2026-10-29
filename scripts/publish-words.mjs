// Usage: node scripts/publish-words.mjs <srcDir> <destDir>
// Copies published post folders from the words repo into the site.
import path from "node:path";
import { publishWords } from "../lib/words.mjs";

const [src, dest] = process.argv.slice(2);
if (!src || !dest) {
  console.error("usage: publish-words.mjs <srcDir> <destDir>");
  process.exit(1);
}
const { published, removed } = await publishWords(path.resolve(src), path.resolve(dest));
console.log(`published: ${published.join(", ")}`);
console.log(`removed: ${removed.join(", ")}`);
