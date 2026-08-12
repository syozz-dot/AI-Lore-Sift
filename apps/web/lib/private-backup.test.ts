import { describe, expect, it } from "vitest";

import { decryptPrivateBackup, encryptPrivateBackup } from "./private-backup";
import { createEmptyPrivateProfile } from "./private-workspace";

const PASSPHRASE = "correct horse battery staple";

function sampleBackup() {
  return {
    profile: {
      ...createEmptyPrivateProfile("2026-08-13T00:00:00.000Z"),
      purpose: "筛出值得跟进的 AI 产品变化",
    },
    memories: [
      {
        id: "memory-1",
        statement: "优先保留能落地的产品与工程方法。",
        source: "manual" as const,
        kind: "preference" as const,
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
      },
    ],
    distillRecords: [],
    knowledgeCards: [],
    favorites: [],
    exportedAt: "2026-08-13T00:00:00.000Z",
  };
}

describe("encrypted private workspace backup", () => {
  it("round-trips valid local data without exposing the plaintext", async () => {
    const backup = sampleBackup();
    const encrypted = await encryptPrivateBackup(backup, PASSPHRASE);

    expect(encrypted).not.toContain(backup.profile.purpose);
    expect(encrypted).not.toContain(backup.memories[0]?.statement);
    await expect(decryptPrivateBackup(encrypted, PASSPHRASE)).resolves.toEqual(
      backup,
    );
  });

  it("rejects a wrong password and unsupported short export passwords", async () => {
    const encrypted = await encryptPrivateBackup(sampleBackup(), PASSPHRASE);

    await expect(
      decryptPrivateBackup(encrypted, "wrong password value"),
    ).rejects.toThrow("密码不正确");
    await expect(
      encryptPrivateBackup(sampleBackup(), "too-short"),
    ).rejects.toThrow("至少需要 12 个字符");
  });
});
