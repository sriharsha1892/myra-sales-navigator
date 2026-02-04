import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getCached,
  setCached,
  clearCache,
  deleteCached,
  normalizeDomain,
  hashFilters,
  CacheKeys,
} from "@/lib/cache";

describe("getCached / setCached", () => {
  beforeEach(async () => {
    await clearCache();
  });

  it("returns null for missing key", async () => {
    expect(await getCached("nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", async () => {
    await setCached("key1", { foo: "bar" }, 60);
    expect(await getCached("key1")).toEqual({ foo: "bar" });
  });

  it("stores and retrieves a string", async () => {
    await setCached("str", "hello", 10);
    expect(await getCached("str")).toBe("hello");
  });

  it("stores and retrieves an array", async () => {
    await setCached("arr", [1, 2, 3], 10);
    expect(await getCached("arr")).toEqual([1, 2, 3]);
  });

  it("overwrites existing key", async () => {
    await setCached("k", "old", 10);
    await setCached("k", "new", 10);
    expect(await getCached("k")).toBe("new");
  });
});

describe("TTL expiry", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await clearCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns value before TTL expires", async () => {
    await setCached("ttl", "alive", 1); // 1 minute
    vi.advanceTimersByTime(59_000);
    expect(await getCached("ttl")).toBe("alive");
  });

  it("returns null after TTL expires", async () => {
    await setCached("ttl", "alive", 1); // 1 minute
    vi.advanceTimersByTime(61_000);
    expect(await getCached("ttl")).toBeNull();
  });

  it("returns null exactly at expiry boundary", async () => {
    await setCached("ttl", "alive", 1);
    vi.advanceTimersByTime(60_001);
    expect(await getCached("ttl")).toBeNull();
  });
});

describe("clearCache / deleteCached", () => {
  beforeEach(async () => {
    await clearCache();
  });

  it("clearCache removes all entries", async () => {
    await setCached("a", 1, 60);
    await setCached("b", 2, 60);
    await clearCache();
    expect(await getCached("a")).toBeNull();
    expect(await getCached("b")).toBeNull();
  });

  it("deleteCached removes single entry", async () => {
    await setCached("a", 1, 60);
    await setCached("b", 2, 60);
    await deleteCached("a");
    expect(await getCached("a")).toBeNull();
    expect(await getCached("b")).toBe(2);
  });

  it("deleteCached on missing key is no-op", async () => {
    await deleteCached("nonexistent");
    // no error thrown
  });
});

describe("normalizeDomain", () => {
  it("lowercases domain", () => {
    expect(normalizeDomain("WWW.EXAMPLE.COM")).toBe("example.com");
  });

  it("removes www. prefix", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeDomain(" example.com ")).toBe("example.com");
  });

  it("handles www. prefix only once", () => {
    expect(normalizeDomain("www.www.x.com")).toBe("www.x.com");
  });

  it("handles already-clean domain", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
  });
});

describe("hashFilters", () => {
  it("same keys in different order produce same hash", () => {
    const h1 = hashFilters({ a: 1, b: 2 });
    const h2 = hashFilters({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });

  it("different values produce different hash", () => {
    const h1 = hashFilters({ a: 1 });
    const h2 = hashFilters({ a: 2 });
    expect(h1).not.toBe(h2);
  });

  it("empty object produces consistent hash", () => {
    const h1 = hashFilters({});
    const h2 = hashFilters({});
    expect(h1).toBe(h2);
  });

  it("returns a string", () => {
    expect(typeof hashFilters({ x: "y" })).toBe("string");
  });
});

describe("CacheKeys builders", () => {
  it("search key format", () => {
    expect(CacheKeys.search("abc")).toBe("search:abc");
  });

  it("company key normalizes domain", () => {
    expect(CacheKeys.company("WWW.Example.com")).toBe("company:example.com");
  });

  it("contacts key normalizes domain", () => {
    expect(CacheKeys.contacts("www.Test.COM")).toBe("contacts:test.com");
  });

  it("signals key normalizes domain", () => {
    expect(CacheKeys.signals("Foo.com")).toBe("signals:foo.com");
  });

  it("email key lowercases and trims", () => {
    expect(CacheKeys.email(" JOE@Test.com ")).toBe("email:joe@test.com");
  });

  it("hubspot key normalizes domain", () => {
    expect(CacheKeys.hubspot("www.HUBSPOT.com")).toBe("hubspot:hubspot.com");
  });
});
