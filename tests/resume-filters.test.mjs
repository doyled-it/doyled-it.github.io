import { test } from "node:test";
import assert from "node:assert/strict";
import { dateRange, yearOf } from "../lib/resume-filters.mjs";

test("dateRange formats start + end", () => {
  assert.equal(dateRange("2020-01", "2022-06"), "Jan 2020 — Jun 2022");
});

test("dateRange treats missing end as present", () => {
  assert.equal(dateRange("2023-03", undefined), "Mar 2023 — present");
});

test("dateRange handles missing start gracefully", () => {
  assert.equal(dateRange(undefined, "2022-06"), "— Jun 2022");
});

test("yearOf extracts YYYY", () => {
  assert.equal(yearOf("2021-09-15"), "2021");
  assert.equal(yearOf("2019"), "2019");
  assert.equal(yearOf(undefined), "");
});
