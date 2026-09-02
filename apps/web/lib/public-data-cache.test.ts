import { afterEach, describe, expect, it, vi } from "vitest";

import { cachePublicData, clearPublicDataCache } from "./public-data-cache";

describe("public data cache", () => {
  afterEach(() => {
    clearPublicDataCache();
    vi.restoreAllMocks();
  });

  it("deduplicates public reads within the configured lifetime", async () => {
    const loader = vi.fn(async () => ({ total: 1 }));

    await expect(cachePublicData("feed", loader)).resolves.toEqual({
      total: 1,
    });
    await expect(cachePublicData("feed", loader)).resolves.toEqual({
      total: 1,
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads expired entries", async () => {
    const now = vi.spyOn(Date, "now");
    const loader = vi.fn(async () => loader.mock.calls.length);
    now.mockReturnValueOnce(1_000);
    await expect(cachePublicData("feed", loader, 100)).resolves.toBe(1);
    now.mockReturnValueOnce(1_101);
    await expect(cachePublicData("feed", loader, 100)).resolves.toBe(2);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not retain failed reads", async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ready");

    await expect(cachePublicData("feed", loader)).rejects.toThrow("temporary");
    await expect(cachePublicData("feed", loader)).resolves.toBe("ready");
  });
});
