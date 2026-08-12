"use client";

import {
  ArrowClockwise,
  CheckCircle,
  DownloadSimple,
  HardDrives,
  LockKey,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  notifyFavoritesChanged,
  readFavorites,
  writeFavorites,
} from "../lib/favorites";
import {
  decryptPrivateBackup,
  encryptPrivateBackup,
  type PrivateBackupContents,
} from "../lib/private-backup";
import {
  createEmptyPrivateProfile,
  deletePrivateMemory,
  privateStoragePersistence,
  readPrivateWorkspace,
  replacePrivateWorkspace,
  requestPrivateStoragePersistence,
  savePrivateMemory,
  savePrivateProfile,
  type PrivateMemory,
  type PrivateProfile,
  type PrivateWorkspaceSnapshot,
  type StoragePersistence,
} from "../lib/private-workspace";

type Notice = { kind: "success" | "error" | "info"; message: string } | null;

const SOURCE_LABELS: Record<PrivateMemory["source"], string> = {
  manual: "主动添加",
  favorite: "来自收藏",
  question: "来自提问",
};

const KIND_LABELS: Record<NonNullable<PrivateMemory["kind"]>, string> = {
  preference: "偏好与边界",
  context: "当前事项",
  knowledge: "可复用知识",
};

function downloadTextFile(contents: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function persistenceLabel(status: StoragePersistence) {
  if (status === "granted") return "浏览器已尽量保留";
  if (status === "unsupported") return "当前浏览器不支持申请";
  return "仍可能被浏览器清理";
}

export function PrivateWorkspaceSettings() {
  const [snapshot, setSnapshot] = useState<PrivateWorkspaceSnapshot | null>(
    null,
  );
  const [profile, setProfile] = useState<PrivateProfile>(
    createEmptyPrivateProfile(),
  );
  const [memoryDraft, setMemoryDraft] = useState("");
  const [persistence, setPersistence] =
    useState<StoragePersistence>("best-effort");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportConfirmation, setExportConfirmation] = useState("");
  const [includeRawText, setIncludeRawText] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pendingImport, setPendingImport] =
    useState<PrivateBackupContents | null>(null);

  async function refresh() {
    const [nextSnapshot, nextPersistence] = await Promise.all([
      readPrivateWorkspace(),
      privateStoragePersistence(),
    ]);
    setSnapshot(nextSnapshot);
    setProfile(nextSnapshot.profile);
    setPersistence(nextPersistence);
  }

  useEffect(() => {
    refresh().catch(() => {
      setNotice({ kind: "error", message: "无法读取当前浏览器中的私人数据。" });
    });
  }, []);

  const completedProfileFields = useMemo(
    () =>
      [
        profile.purpose,
        profile.directions,
        profile.currentContext,
        profile.preferredHelp,
        profile.boundaries,
      ].filter((value) => value.trim()).length,
    [profile],
  );

  function updateProfile(field: keyof PrivateProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function handleProfileSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const now = new Date().toISOString();
      const nextProfile = {
        ...profile,
        purpose: profile.purpose.trim(),
        directions: profile.directions.trim(),
        currentContext: profile.currentContext.trim(),
        preferredHelp: profile.preferredHelp.trim(),
        boundaries: profile.boundaries.trim(),
        createdAt: snapshot?.profile.createdAt ?? now,
        updatedAt: now,
      };
      await savePrivateProfile(nextProfile);
      setProfile(nextProfile);
      setSnapshot((current) => current && { ...current, profile: nextProfile });
      setNotice({
        kind: "success",
        message: "画像已保存到当前浏览器，尚未发送给模型。",
      });
    } catch {
      setNotice({
        kind: "error",
        message: "画像保存失败，请检查浏览器存储权限。",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleMemoryAdd(event: FormEvent) {
    event.preventDefault();
    const statement = memoryDraft.trim();
    if (!statement) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const memory: PrivateMemory = {
        id: crypto.randomUUID(),
        statement,
        source: "manual",
        kind: "context",
        createdAt: now,
        updatedAt: now,
      };
      await savePrivateMemory(memory);
      setSnapshot((current) =>
        current
          ? { ...current, memories: [memory, ...current.memories] }
          : current,
      );
      setMemoryDraft("");
      setNotice({
        kind: "success",
        message: "已加入个人记忆。之后仍可逐条撤回。",
      });
    } catch {
      setNotice({ kind: "error", message: "记忆保存失败。" });
    } finally {
      setBusy(false);
    }
  }

  async function handleMemoryDelete(id: string) {
    setBusy(true);
    try {
      await deletePrivateMemory(id);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              memories: current.memories.filter((memory) => memory.id !== id),
            }
          : current,
      );
      setNotice({ kind: "info", message: "这条记忆已从当前浏览器撤回。" });
    } catch {
      setNotice({ kind: "error", message: "记忆删除失败。" });
    } finally {
      setBusy(false);
    }
  }

  async function handlePersistenceRequest() {
    setBusy(true);
    try {
      const status = await requestPrivateStoragePersistence();
      setPersistence(status);
      setNotice({
        kind: status === "granted" ? "success" : "info",
        message:
          status === "granted"
            ? "浏览器已接受持久化申请。加密备份仍然必要。"
            : "浏览器没有保证保留数据，请定期导出加密备份。",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(event: FormEvent) {
    event.preventDefault();
    if (!snapshot) return;
    if (exportPassphrase !== exportConfirmation) {
      setNotice({ kind: "error", message: "两次输入的备份密码不一致。" });
      return;
    }
    setBusy(true);
    try {
      const exportSnapshot = {
        ...snapshot,
        distillRecords: snapshot.distillRecords.map((record) => ({
          ...record,
          rawText: includeRawText ? record.rawText : null,
        })),
      };
      const encrypted = await encryptPrivateBackup(
        {
          ...exportSnapshot,
          favorites: readFavorites(window.localStorage),
          exportedAt: new Date().toISOString(),
        },
        exportPassphrase,
      );
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(
        encrypted,
        `ai-news-private-workspace-${date}.annbackup`,
      );
      setExportPassphrase("");
      setExportConfirmation("");
      setNotice({
        kind: "success",
        message: "加密备份已生成。密码无法找回，请分开保管。",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "备份生成失败。",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setPendingImport(null);
  }

  async function handleImportInspect(event: FormEvent) {
    event.preventDefault();
    if (!importFile) {
      setNotice({ kind: "error", message: "请先选择一个加密备份文件。" });
      return;
    }
    if (importFile.size > 10 * 1024 * 1024) {
      setNotice({ kind: "error", message: "备份文件超过 10 MB，未进行读取。" });
      return;
    }
    setBusy(true);
    try {
      const contents = await decryptPrivateBackup(
        await importFile.text(),
        importPassphrase,
      );
      setPendingImport(contents);
      setNotice({
        kind: "info",
        message: "备份已解密。确认数量后再覆盖当前本机数据。",
      });
    } catch (error) {
      setPendingImport(null);
      setNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "备份读取失败。",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleImportConfirm() {
    if (!pendingImport) return;
    setBusy(true);
    try {
      await replacePrivateWorkspace(pendingImport);
      writeFavorites(window.localStorage, pendingImport.favorites);
      notifyFavoritesChanged();
      setPendingImport(null);
      setImportFile(null);
      setImportPassphrase("");
      await refresh();
      setNotice({
        kind: "success",
        message: "备份已导入，当前浏览器数据已替换。",
      });
    } catch {
      setNotice({ kind: "error", message: "导入失败，当前数据未被完整替换。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="privateSettingsLayout">
      <div className="privateSettingsMain">
        {notice ? (
          <div className={`privateNotice ${notice.kind}`} role="status">
            {notice.kind === "success" ? (
              <CheckCircle aria-hidden="true" size={18} />
            ) : null}
            <span>{notice.message}</span>
          </div>
        ) : null}

        <section
          className="privateSettingsSection"
          aria-labelledby="profile-title"
        >
          <div className="privateSectionHeading">
            <div>
              <span>01</span>
              <h2 id="profile-title">我的阅读画像</h2>
            </div>
            <p>{completedProfileFields}/5 已补充</p>
          </div>
          <form className="privateProfileForm" onSubmit={handleProfileSave}>
            <label>
              <span>你来这里主要想解决什么？</span>
              <textarea
                value={profile.purpose}
                maxLength={2000}
                onChange={(event) =>
                  updateProfile("purpose", event.target.value)
                }
                placeholder="例如：更快筛出值得跟进的 AI 产品变化，并形成可复用的判断。"
              />
            </label>
            <label>
              <span>你长期关注哪些方向？</span>
              <textarea
                value={profile.directions}
                maxLength={2000}
                onChange={(event) =>
                  updateProfile("directions", event.target.value)
                }
                placeholder="例如：Agent 工作流、AI 编程、产品国际化。"
              />
            </label>
            <label>
              <span>你最近正在做什么？</span>
              <textarea
                value={profile.currentContext}
                maxLength={2000}
                onChange={(event) =>
                  updateProfile("currentContext", event.target.value)
                }
                placeholder="写真实项目、业务场景或当前卡点，不必写岗位名称。"
              />
            </label>
            <label>
              <span>你希望平台怎样帮助你？</span>
              <textarea
                value={profile.preferredHelp}
                maxLength={2000}
                onChange={(event) =>
                  updateProfile("preferredHelp", event.target.value)
                }
                placeholder="例如：先判断值不值得读，再标出对当前项目可直接复用的做法。"
              />
            </label>
            <label>
              <span>哪些边界必须遵守？</span>
              <textarea
                value={profile.boundaries}
                maxLength={2000}
                onChange={(event) =>
                  updateProfile("boundaries", event.target.value)
                }
                placeholder="例如：不把推测写成事实；没有证据时明确说不知道。"
              />
            </label>
            <div className="privateFormAction">
              <p>
                只保存到 IndexedDB；每次脱水默认关闭，只有你勾选后才会发送。
              </p>
              <button type="submit" disabled={busy}>
                保存画像
              </button>
            </div>
          </form>
        </section>

        <section
          className="privateSettingsSection"
          aria-labelledby="memory-title"
        >
          <div className="privateSectionHeading">
            <div>
              <span>02</span>
              <h2 id="memory-title">我允许平台记住的事</h2>
            </div>
            <p>{snapshot?.memories.length ?? 0} 条</p>
          </div>
          <p className="privateSectionLead">
            收藏与提问以后只会生成“候选记忆”；你确认后才会出现在这里，并可随时撤回。
          </p>
          <form className="privateMemoryComposer" onSubmit={handleMemoryAdd}>
            <textarea
              value={memoryDraft}
              maxLength={600}
              onChange={(event) => setMemoryDraft(event.target.value)}
              placeholder="先手动添加一条，例如：我更关注能落地的产品与工程做法，不需要泛泛趋势判断。"
            />
            <button type="submit" disabled={busy || !memoryDraft.trim()}>
              <Plus aria-hidden="true" size={17} />
              加入记忆
            </button>
          </form>
          <div className="privateMemoryList">
            {snapshot?.memories.length ? (
              snapshot.memories.map((memory) => (
                <article key={memory.id}>
                  <div>
                    <span>{SOURCE_LABELS[memory.source]}</span>
                    <span>{KIND_LABELS[memory.kind ?? "context"]}</span>
                    <time dateTime={memory.updatedAt}>
                      {new Date(memory.updatedAt).toLocaleDateString("zh-CN")}
                    </time>
                  </div>
                  <p>{memory.statement}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMemoryDelete(memory.id)}
                    aria-label={`撤回记忆：${memory.statement}`}
                  >
                    <Trash aria-hidden="true" size={16} />
                    撤回
                  </button>
                </article>
              ))
            ) : (
              <p className="privateEmptyState">
                还没有主动确认的记忆。平台不会从你的行为里静默推断并写入。
              </p>
            )}
          </div>
        </section>
      </div>

      <aside className="privateSettingsRail">
        <section>
          <div className="privateRailHeading">
            <HardDrives aria-hidden="true" size={20} />
            <h2>本机保存</h2>
          </div>
          <p>
            画像、确认记忆和后续迁入的脱水记录会保存在这个浏览器。它不是云端账号，也不是可靠备份。
          </p>
          <div className="privateStorageStatus">
            <span>保留状态</span>
            <strong>{persistenceLabel(persistence)}</strong>
          </div>
          <button
            type="button"
            className="privateSecondaryButton"
            onClick={handlePersistenceRequest}
            disabled={busy || persistence === "granted"}
          >
            <ArrowClockwise aria-hidden="true" size={16} />
            申请尽量保留
          </button>
        </section>

        <section>
          <div className="privateRailHeading">
            <LockKey aria-hidden="true" size={20} />
            <h2>加密导出</h2>
          </div>
          <p>
            备份在浏览器中使用 AES-GCM
            加密后下载，不上传到本站。密码遗失无法恢复。
          </p>
          <form className="privateBackupForm" onSubmit={handleExport}>
            <label>
              <span>备份密码</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={exportPassphrase}
                onChange={(event) => setExportPassphrase(event.target.value)}
              />
            </label>
            <label>
              <span>再次输入</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={exportConfirmation}
                onChange={(event) => setExportConfirmation(event.target.value)}
              />
            </label>
            <label className="privateCheckbox">
              <input
                type="checkbox"
                checked={includeRawText}
                onChange={(event) => setIncludeRawText(event.target.checked)}
              />
              <span>备份脱水原文（默认不包含）</span>
            </label>
            <button type="submit" disabled={busy || !snapshot}>
              <DownloadSimple aria-hidden="true" size={17} />
              生成加密备份
            </button>
          </form>
        </section>

        <section>
          <div className="privateRailHeading">
            <UploadSimple aria-hidden="true" size={20} />
            <h2>从备份恢复</h2>
          </div>
          <p>先解密核对数量，再明确确认覆盖。文件只在当前页面内读取。</p>
          <form className="privateBackupForm" onSubmit={handleImportInspect}>
            <label>
              <span>备份文件</span>
              <input
                type="file"
                accept=".annbackup,application/json"
                onChange={handleImportFile}
              />
            </label>
            <label>
              <span>备份密码</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={importPassphrase}
                onChange={(event) => setImportPassphrase(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="privateSecondaryButton"
              disabled={busy}
            >
              <UploadSimple aria-hidden="true" size={17} />
              解密并检查
            </button>
          </form>
          {pendingImport ? (
            <div className="privateImportConfirm">
              <p>
                将导入 {pendingImport.memories.length} 条记忆、
                {pendingImport.favorites.length} 条收藏、
                {pendingImport.distillRecords.length} 份脱水记录和{" "}
                {pendingImport.knowledgeCards.length} 张知识卡。
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleImportConfirm}
              >
                确认覆盖当前本机数据
              </button>
            </div>
          ) : null}
        </section>

        <p className="privateSecurityNote">
          提醒：本机存储不是端到端加密；同源页面脚本可读取。不要在不受信任设备使用，敏感内容仍需自行判断是否提交给模型提供方。
        </p>
      </aside>
    </div>
  );
}
