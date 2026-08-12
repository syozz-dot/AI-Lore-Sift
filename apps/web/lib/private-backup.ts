import type {
  PrivateDistillRecord,
  PrivateKnowledgeCard,
  PrivateMemory,
  PrivateProfile,
  PrivateWorkspaceSnapshot,
} from "./private-workspace";
import { isFavoriteStory, type FavoriteStory } from "./favorites";

export const PRIVATE_BACKUP_FORMAT = "ai-news-navigator-private-backup";
export const PRIVATE_BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;

export interface PrivateBackupContents extends PrivateWorkspaceSnapshot {
  favorites: FavoriteStory[];
  exportedAt: string;
}

interface EncryptedPrivateBackup {
  format: typeof PRIVATE_BACKUP_FORMAT;
  version: typeof PRIVATE_BACKUP_VERSION;
  encryption: {
    algorithm: "AES-GCM";
    keyDerivation: "PBKDF2-SHA-256";
    iterations: number;
    salt: string;
    iv: string;
  };
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32_768;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveBackupKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function isProfile(value: unknown): value is PrivateProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<PrivateProfile>;
  return (
    profile.id === "primary" &&
    typeof profile.purpose === "string" &&
    typeof profile.directions === "string" &&
    typeof profile.currentContext === "string" &&
    typeof profile.preferredHelp === "string" &&
    typeof profile.boundaries === "string" &&
    typeof profile.createdAt === "string" &&
    typeof profile.updatedAt === "string"
  );
}

function isMemory(value: unknown): value is PrivateMemory {
  if (!value || typeof value !== "object") return false;
  const memory = value as Partial<PrivateMemory>;
  return (
    typeof memory.id === "string" &&
    typeof memory.statement === "string" &&
    ["manual", "favorite", "question"].includes(memory.source ?? "") &&
    (memory.kind === undefined ||
      ["preference", "context", "knowledge"].includes(memory.kind)) &&
    typeof memory.createdAt === "string" &&
    typeof memory.updatedAt === "string"
  );
}

function hasIdentityAndDates(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const item = value as {
    id?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isPersonalizedInsight(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const insight = value as {
    title?: unknown;
    detail?: unknown;
    basis?: unknown;
    evidenceParagraphs?: unknown;
    knowledgeReferences?: unknown;
  };
  return (
    typeof insight.title === "string" &&
    typeof insight.detail === "string" &&
    ["profile", "memory", "knowledge", "both", "mixed"].includes(
      String(insight.basis),
    ) &&
    Array.isArray(insight.evidenceParagraphs) &&
    insight.evidenceParagraphs.every(
      (paragraph) => Number.isInteger(paragraph) && Number(paragraph) > 0,
    ) &&
    (insight.knowledgeReferences === undefined ||
      (Array.isArray(insight.knowledgeReferences) &&
        insight.knowledgeReferences.every((reference) => {
          if (!reference || typeof reference !== "object") return false;
          const item = reference as Record<string, unknown>;
          return (
            typeof item.id === "string" &&
            (item.kind === "card" || item.kind === "document") &&
            typeof item.title === "string" &&
            typeof item.sourceDocumentId === "string"
          );
        })))
  );
}

function isDistillRecord(value: unknown): value is PrivateDistillRecord {
  if (!hasIdentityAndDates(value)) return false;
  const record = value as Partial<PrivateDistillRecord>;
  return (
    (record.sourceType === "url" || record.sourceType === "text") &&
    (record.sourceUrl === null || typeof record.sourceUrl === "string") &&
    (record.sourceTitle === null || typeof record.sourceTitle === "string") &&
    (record.sourceAuthor === null || typeof record.sourceAuthor === "string") &&
    (record.rawText === null || typeof record.rawText === "string") &&
    Boolean(record.analysis) &&
    typeof record.analysis === "object" &&
    Array.isArray(record.messages) &&
    (record.personalizedInsights === undefined ||
      (Array.isArray(record.personalizedInsights) &&
        record.personalizedInsights.every(isPersonalizedInsight))) &&
    (record.personalizationRequested === undefined ||
      typeof record.personalizationRequested === "boolean") &&
    (record.personalizationError === undefined ||
      record.personalizationError === null ||
      typeof record.personalizationError === "string")
  );
}

function isKnowledgeCard(value: unknown): value is PrivateKnowledgeCard {
  if (!hasIdentityAndDates(value)) return false;
  const card = value as Partial<PrivateKnowledgeCard>;
  return (
    typeof card.title === "string" &&
    typeof card.content === "string" &&
    (card.sourceDocumentId === null ||
      typeof card.sourceDocumentId === "string") &&
    (card.sourceTitle === null || typeof card.sourceTitle === "string") &&
    (card.sourceUrl === null || typeof card.sourceUrl === "string")
  );
}

function parseBackupContents(value: unknown): PrivateBackupContents {
  if (!value || typeof value !== "object") throw new Error("备份内容无效。");
  const contents = value as Partial<PrivateBackupContents>;
  if (
    !isProfile(contents.profile) ||
    !Array.isArray(contents.memories) ||
    !contents.memories.every(isMemory) ||
    !Array.isArray(contents.distillRecords) ||
    !contents.distillRecords.every(isDistillRecord) ||
    !Array.isArray(contents.knowledgeCards) ||
    !contents.knowledgeCards.every(isKnowledgeCard) ||
    !Array.isArray(contents.favorites) ||
    !contents.favorites.every(isFavoriteStory) ||
    typeof contents.exportedAt !== "string"
  ) {
    throw new Error("备份结构不受支持。");
  }
  return contents as PrivateBackupContents;
}

export async function encryptPrivateBackup(
  contents: PrivateBackupContents,
  passphrase: string,
) {
  if (passphrase.length < 12) throw new Error("备份密码至少需要 12 个字符。");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(contents)),
  );
  return JSON.stringify(
    {
      format: PRIVATE_BACKUP_FORMAT,
      version: PRIVATE_BACKUP_VERSION,
      encryption: {
        algorithm: "AES-GCM",
        keyDerivation: "PBKDF2-SHA-256",
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
      },
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    } satisfies EncryptedPrivateBackup,
    null,
    2,
  );
}

export async function decryptPrivateBackup(
  serialized: string,
  passphrase: string,
) {
  let envelope: Partial<EncryptedPrivateBackup>;
  try {
    envelope = JSON.parse(serialized) as Partial<EncryptedPrivateBackup>;
  } catch {
    throw new Error("这不是有效的备份文件。");
  }
  if (
    envelope.format !== PRIVATE_BACKUP_FORMAT ||
    envelope.version !== PRIVATE_BACKUP_VERSION ||
    envelope.encryption?.algorithm !== "AES-GCM" ||
    envelope.encryption.keyDerivation !== "PBKDF2-SHA-256" ||
    envelope.encryption.iterations !== PBKDF2_ITERATIONS ||
    typeof envelope.encryption.salt !== "string" ||
    typeof envelope.encryption.iv !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("备份版本或加密方式不受支持。");
  }
  try {
    const salt = base64ToBytes(envelope.encryption.salt);
    const iv = base64ToBytes(envelope.encryption.iv);
    const key = await deriveBackupKey(passphrase, salt, PBKDF2_ITERATIONS);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return parseBackupContents(
      JSON.parse(new TextDecoder().decode(plaintext)) as unknown,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("备份")) throw error;
    throw new Error("备份密码不正确，或文件已损坏。");
  }
}
