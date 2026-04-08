import { describe, expect, it } from "vitest";
import { RequestDedupeCache } from "../src/dedupe";

describe("Request dedupe cache", () => {
  it("marks first request as new and duplicate after", () => {
    const cache = new RequestDedupeCache(5_000);
    const now = 1_000;

    expect(cache.markIfNew("req-1", now)).toBe(true);
    expect(cache.markIfNew("req-1", now + 10)).toBe(false);
  });

  it("expires request IDs after TTL", () => {
    const cache = new RequestDedupeCache(100);
    const now = 2_000;

    expect(cache.markIfNew("req-2", now)).toBe(true);
    expect(cache.markIfNew("req-2", now + 50)).toBe(false);
    expect(cache.markIfNew("req-2", now + 101)).toBe(true);
  });
});
