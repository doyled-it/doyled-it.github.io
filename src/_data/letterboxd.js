import path from "node:path";
import { buildMovieData } from "../../lib/letterboxd-core.mjs";

const LETTERBOXD_USER = "doyled_it";

export default async function () {
  const cachePath = path.resolve(".cache/letterboxd.json");
  return buildMovieData({ user: LETTERBOXD_USER, cachePath });
}
