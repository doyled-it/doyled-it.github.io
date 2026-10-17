// Emits the per-round shot geometry as a static JSON file the shot-map script
// fetches at runtime. Keeps the heavy GPS payload out of the golf page HTML.
export default class {
  data() {
    return {
      permalink: "/assets/data/shotmap.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render({ eighteenBirdies }) {
    return JSON.stringify((eighteenBirdies && eighteenBirdies.mapData) || []);
  }
}
