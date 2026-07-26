export const DEFAULT_X_MONITORED_ACCOUNTS = [
  "OpenAI",
  "AnthropicAI",
  "GoogleDeepMind",
  "MistralAI",
  "huggingface",
  "NVIDIAAI",
  "xai",
  "AIatMeta",
] as const;

export const DEFAULT_WECHAT_MONITORED_ACCOUNTS = [
  "机器之心",
  "量子位",
  "新智元",
  "Founder Park",
  "极客公园",
  "差评X.PIN",
  "AI科技评论",
  "PaperWeekly",
] as const;

export function parseMonitoredAccounts(
  value: string | undefined,
  fallback: readonly string[],
): string[] {
  const configured = value
    ?.split(",")
    .map((account) => account.trim().replace(/^@/, ""))
    .filter(Boolean);
  return configured?.length ? [...new Set(configured)] : [...fallback];
}
