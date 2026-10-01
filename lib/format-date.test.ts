import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatReadingDate } from "./format-date.ts";

describe("reading dates", () => {
  it("shows a readable date and time and says which clock it is", () => {
    assert.equal(formatReadingDate("2026-10-01T18:34:28.432Z"), "1 Oct 2026, 18:34 UTC");
  });

  it("does not depend on the machine's timezone", () => {
    assert.equal(formatReadingDate("2026-01-05T00:05:00.000Z"), "5 Jan 2026, 00:05 UTC");
  });

  it("returns nothing for a value that is not a date, so a page never prints 'Invalid Date'", () => {
    assert.equal(formatReadingDate("not a date"), "");
    assert.equal(formatReadingDate(""), "");
  });
});
