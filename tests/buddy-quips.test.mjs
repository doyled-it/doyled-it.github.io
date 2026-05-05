import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPredicate, fillSlots, pickQuip } from "../lib/buddy-quips.mjs";

test("matchPredicate: wildcard matches anything", () => {
  assert.equal(matchPredicate("*", {}), true);
  assert.equal(matchPredicate("*", { foo: "bar" }), true);
});

test("matchPredicate: exact-match key passes when equal", () => {
  assert.equal(matchPredicate({ via: "card" }, { via: "card" }), true);
  assert.equal(matchPredicate({ via: "card" }, { via: "other" }), false);
  assert.equal(matchPredicate({ via: "card" }, {}), false);
});

test("matchPredicate: multiple keys must all match (AND)", () => {
  const p = { cf_country: "US", cf_city: "San Diego" };
  assert.equal(matchPredicate(p, { cf_country: "US", cf_city: "San Diego" }), true);
  assert.equal(matchPredicate(p, { cf_country: "US", cf_city: "Boston" }), false);
});

test("matchPredicate: _gte / _lt suffix compares numerically", () => {
  assert.equal(matchPredicate({ tz_hour_gte: 22 }, { tz_hour: 23 }), true);
  assert.equal(matchPredicate({ tz_hour_gte: 22 }, { tz_hour: 21 }), false);
  assert.equal(matchPredicate({ tz_hour_lt: 5 }, { tz_hour: 3 }), true);
  assert.equal(matchPredicate({ tz_hour_lt: 5 }, { tz_hour: 5 }), false);
});

test("matchPredicate: _starts suffix tests prefix", () => {
  assert.equal(matchPredicate({ lang_starts: "es" }, { lang: "es-MX" }), true);
  assert.equal(matchPredicate({ lang_starts: "es" }, { lang: "en-US" }), false);
});

test("matchPredicate: _contains suffix tests substring", () => {
  assert.equal(
    matchPredicate({ referer_host_contains: "twitter" }, { referer_host: "mobile.twitter.com" }),
    true,
  );
  assert.equal(
    matchPredicate({ referer_host_contains: "twitter" }, { referer_host: "google.com" }),
    false,
  );
});

test("matchPredicate: _not suffix negates equality", () => {
  assert.equal(matchPredicate({ cf_country_not: "US" }, { cf_country: "DE" }), true);
  assert.equal(matchPredicate({ cf_country_not: "US" }, { cf_country: "US" }), false);
});

test("matchPredicate: _len_gte tests array length", () => {
  assert.equal(matchPredicate({ session_paths_len_gte: 3 }, { session_paths: ["a","b","c"] }), true);
  assert.equal(matchPredicate({ session_paths_len_gte: 3 }, { session_paths: ["a","b"] }), false);
});

test("fillSlots: replaces {{key}} with signal value", () => {
  assert.equal(fillSlots("hi {{city}}", { city: "Berlin" }), "hi Berlin");
});

test("fillSlots: missing slot becomes 'there'", () => {
  assert.equal(fillSlots("hi {{city}}", {}), "hi there");
});

test("fillSlots: leaves unknown sigils alone", () => {
  assert.equal(fillSlots("hi {city}", { city: "Berlin" }), "hi {city}");
});

test("pickQuip: prefers most-specific match", () => {
  const bank = [
    { trigger: "*", template: "hey." },
    { trigger: { via: "card" }, template: "qr." },
  ];
  assert.equal(pickQuip(bank, { via: "card" }, () => 0).template, "qr.");
});

test("pickQuip: falls back to wildcard when nothing else matches", () => {
  const bank = [
    { trigger: { via: "card" }, template: "qr." },
    { trigger: "*", template: "hey." },
  ];
  assert.equal(pickQuip(bank, {}, () => 0).template, "hey.");
});

test("pickQuip: ties broken by rng", () => {
  const bank = [
    { trigger: "*", template: "a" },
    { trigger: "*", template: "b" },
    { trigger: "*", template: "c" },
  ];
  assert.equal(pickQuip(bank, {}, () => 0).template, "a");
  assert.equal(pickQuip(bank, {}, () => 0.5).template, "b");
  assert.equal(pickQuip(bank, {}, () => 0.99).template, "c");
});

test("pickQuip: returns filled string ready to display", () => {
  const bank = [{ trigger: { cf_country: "DE" }, template: "guten tag, {{city}}" }];
  assert.equal(pickQuip(bank, { cf_country: "DE", city: "Berlin" }, () => 0).text, "guten tag, Berlin");
});
