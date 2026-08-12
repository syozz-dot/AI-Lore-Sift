export const PRIVATE_WORKSPACE_DATABASE = "ann-private-workspace";
export const PRIVATE_WORKSPACE_VERSION = 2;
export const PRIVATE_PROFILE_ID = "primary";

const PROFILE_STORE = "profile";
const MEMORY_STORE = "memories";
const DISTILL_STORE = "distill-records";
const KNOWLEDGE_STORE = "knowledge-cards";

export interface PrivateProfile {
  id: typeof PRIVATE_PROFILE_ID;
  purpose: string;
  directions: string;
  currentContext: string;
  preferredHelp: string;
  boundaries: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateMemory {
  id: string;
  statement: string;
  source: "manual" | "favorite" | "question";
  kind?: "preference" | "context" | "knowledge";
  createdAt: string;
  updatedAt: string;
}

export interface PrivateDistillMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface PrivateDistillRecord {
  id: string;
  sourceType: "url" | "text";
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  rawText: string | null;
  analysis: Record<string, unknown>;
  messages: PrivateDistillMessage[];
  personalizedInsights?: PrivatePersonalizedInsight[];
  personalizationRequested?: boolean;
  personalizationError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivatePersonalizedInsight {
  title: string;
  detail: string;
  basis: "profile" | "memory" | "knowledge" | "both" | "mixed";
  evidenceParagraphs: number[];
  knowledgeReferences?: Array<{
    id: string;
    kind: "card" | "document";
    title: string;
    sourceDocumentId: string;
  }>;
}

export async function savePrivatePersonalizedInsights(
  documentId: string,
  insights: PrivatePersonalizedInsight[],
  error: string | null = null,
) {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(DISTILL_STORE, "readwrite");
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(DISTILL_STORE);
    const existing = (await requestResult(
      store.get(documentId) as IDBRequest<PrivateDistillRecord | undefined>,
    )) ?? {
      id: documentId,
      sourceType: "text" as const,
      sourceUrl: null,
      sourceTitle: null,
      sourceAuthor: null,
      rawText: null,
      analysis: {},
      messages: [],
      personalizedInsights: [],
      personalizationRequested: true,
      personalizationError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.put({
      ...existing,
      personalizedInsights: insights,
      personalizationRequested: true,
      personalizationError: error,
      updatedAt: new Date().toISOString(),
    });
    await completion;
  } finally {
    database.close();
  }
}

export async function readPrivatePersonalization(documentId: string) {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(DISTILL_STORE, "readonly");
    const completion = transactionComplete(transaction);
    const record = await requestResult(
      transaction.objectStore(DISTILL_STORE).get(documentId) as IDBRequest<
        PrivateDistillRecord | undefined
      >,
    );
    await completion;
    return {
      requested: record?.personalizationRequested ?? false,
      insights: record?.personalizedInsights ?? [],
      error: record?.personalizationError ?? null,
    };
  } finally {
    database.close();
  }
}

export interface PrivateKnowledgeCard {
  id: string;
  title: string;
  content: string;
  sourceDocumentId: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateWorkspaceSnapshot {
  profile: PrivateProfile;
  memories: PrivateMemory[];
  distillRecords: PrivateDistillRecord[];
  knowledgeCards: PrivateKnowledgeCard[];
}

export function createEmptyPrivateProfile(now = new Date().toISOString()) {
  return {
    id: PRIVATE_PROFILE_ID,
    purpose: "",
    directions: "",
    currentContext: "",
    preferredHelp: "",
    boundaries: "",
    createdAt: now,
    updatedAt: now,
  } satisfies PrivateProfile;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("本机存储读取失败。"));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("本机存储写入失败。"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("本机存储写入已取消。"));
  });
}

function openPrivateWorkspace() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(
      PRIVATE_WORKSPACE_DATABASE,
      PRIVATE_WORKSPACE_VERSION,
    );
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROFILE_STORE)) {
        database.createObjectStore(PROFILE_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(MEMORY_STORE)) {
        const store = database.createObjectStore(MEMORY_STORE, {
          keyPath: "id",
        });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(DISTILL_STORE)) {
        const store = database.createObjectStore(DISTILL_STORE, {
          keyPath: "id",
        });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(KNOWLEDGE_STORE)) {
        const store = database.createObjectStore(KNOWLEDGE_STORE, {
          keyPath: "id",
        });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("无法打开本机私人数据。"));
    request.onblocked = () => reject(new Error("本机存储正在被其他页面占用。"));
  });
}

export async function readPrivateWorkspace(): Promise<PrivateWorkspaceSnapshot> {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(
      [PROFILE_STORE, MEMORY_STORE, DISTILL_STORE, KNOWLEDGE_STORE],
      "readonly",
    );
    const profileRequest = transaction
      .objectStore(PROFILE_STORE)
      .get(PRIVATE_PROFILE_ID) as IDBRequest<PrivateProfile | undefined>;
    const memoriesRequest = transaction
      .objectStore(MEMORY_STORE)
      .getAll() as IDBRequest<PrivateMemory[]>;
    const distillRequest = transaction
      .objectStore(DISTILL_STORE)
      .getAll() as IDBRequest<PrivateDistillRecord[]>;
    const knowledgeRequest = transaction
      .objectStore(KNOWLEDGE_STORE)
      .getAll() as IDBRequest<PrivateKnowledgeCard[]>;
    const [profile, memories, distillRecords, knowledgeCards] =
      await Promise.all([
        requestResult(profileRequest),
        requestResult(memoriesRequest),
        requestResult(distillRequest),
        requestResult(knowledgeRequest),
        transactionComplete(transaction),
      ]);
    return {
      profile: profile ?? createEmptyPrivateProfile(),
      memories: memories.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
      distillRecords: distillRecords.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
      knowledgeCards: knowledgeCards.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    };
  } finally {
    database.close();
  }
}

export async function hasPrivateMemory(id: string) {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(MEMORY_STORE, "readonly");
    const completion = transactionComplete(transaction);
    const result = await requestResult(
      transaction.objectStore(MEMORY_STORE).getKey(id),
    );
    await completion;
    return result !== undefined;
  } finally {
    database.close();
  }
}

export async function savePrivateProfile(profile: PrivateProfile) {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(PROFILE_STORE, "readwrite");
    transaction.objectStore(PROFILE_STORE).put(profile);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function savePrivateMemory(memory: PrivateMemory) {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(MEMORY_STORE, "readwrite");
    transaction.objectStore(MEMORY_STORE).put(memory);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function deletePrivateMemory(id: string) {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(MEMORY_STORE, "readwrite");
    transaction.objectStore(MEMORY_STORE).delete(id);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function replacePrivateWorkspace(
  snapshot: PrivateWorkspaceSnapshot,
) {
  const database = await openPrivateWorkspace();
  try {
    const transaction = database.transaction(
      [PROFILE_STORE, MEMORY_STORE, DISTILL_STORE, KNOWLEDGE_STORE],
      "readwrite",
    );
    const profileStore = transaction.objectStore(PROFILE_STORE);
    const memoryStore = transaction.objectStore(MEMORY_STORE);
    const distillStore = transaction.objectStore(DISTILL_STORE);
    const knowledgeStore = transaction.objectStore(KNOWLEDGE_STORE);
    profileStore.clear();
    memoryStore.clear();
    distillStore.clear();
    knowledgeStore.clear();
    profileStore.put(snapshot.profile);
    for (const memory of snapshot.memories) memoryStore.put(memory);
    for (const record of snapshot.distillRecords) distillStore.put(record);
    for (const card of snapshot.knowledgeCards) knowledgeStore.put(card);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function clearPrivateWorkspace() {
  await replacePrivateWorkspace({
    profile: createEmptyPrivateProfile(),
    memories: [],
    distillRecords: [],
    knowledgeCards: [],
  });
}

export type StoragePersistence = "granted" | "best-effort" | "unsupported";

export async function privateStoragePersistence(): Promise<StoragePersistence> {
  if (!navigator.storage?.persisted) return "unsupported";
  return (await navigator.storage.persisted()) ? "granted" : "best-effort";
}

export async function requestPrivateStoragePersistence() {
  if (!navigator.storage?.persist) return "unsupported" as const;
  return (await navigator.storage.persist())
    ? ("granted" as const)
    : ("best-effort" as const);
}
