import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

import sanitizeHtml from "sanitize-html";

const MAX_SOURCE_BYTES = 2_500_000;
const MAX_SOURCE_CHARACTERS = 80_000;
const MAX_REDIRECTS = 4;
const DEFAULT_READER_BASE_URL = "https://r.jina.ai";
const WECHAT_READ_ERROR =
  "微信公众号限制了本次正文读取。系统已尝试专用通道，请稍后重试；若仍失败，再直接粘贴正文。";

export interface PreparedDistillSource {
  sourceType: "url" | "text";
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  rawText: string;
  paragraphs: string[];
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part)))
    return true;
  const [first, second] = parts as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateIp(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

async function assertPublicUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("只支持 http 或 https 网页链接。");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("不支持访问本地或内网地址。");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateIp(address))
  ) {
    throw new Error("该链接解析到了不可访问的网络地址。");
  }
}

async function readLimitedText(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("网页正文过大，请粘贴需要脱水的正文片段。");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

async function fetchPublicHtml(inputUrl: string) {
  let current = new URL(inputUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        Accept: "text/html, text/plain;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (compatible; AI-News-Navigator-Distill/1.0; +https://github.com/syozz-dot/ai-news-navigator)",
      },
      signal: AbortSignal.timeout(18_000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("网页返回了无效跳转。");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      throw new Error(`网页读取失败，状态码 ${response.status}。`);
    }
    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error("当前链接不是可直接读取的网页正文。");
    }

    return {
      html: await readLimitedText(response),
      finalUrl: current.toString(),
      contentType,
    };
  }

  throw new Error("网页跳转次数过多。");
}

function isWechatArticleUrl(url: URL) {
  return url.hostname.toLowerCase() === "mp.weixin.qq.com";
}

function readerEndpoint(inputUrl: string) {
  const baseUrl = (
    process.env.DISTILL_READER_BASE_URL ?? DEFAULT_READER_BASE_URL
  ).replace(/\/+$/, "");
  const endpoint = new URL(`${baseUrl}/${inputUrl}`);
  if (endpoint.protocol !== "https:") {
    throw new Error("正文读取服务必须使用 HTTPS。");
  }
  return endpoint;
}

interface ReaderDocument {
  title: string | null;
  author: string | null;
  content: string;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseReaderDocument(payload: unknown): ReaderDocument {
  if (!payload || typeof payload !== "object") {
    throw new Error("正文读取服务返回了无效内容。");
  }

  const root = payload as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const content =
    stringValue(nested.content) ??
    stringValue(nested.markdown) ??
    stringValue(root.content);

  if (!content) throw new Error("正文读取服务没有返回文章内容。");

  return {
    title: stringValue(nested.title) ?? stringValue(root.title),
    author:
      stringValue(nested.author) ??
      stringValue(nested.byline) ??
      stringValue(root.author),
    content,
  };
}

function normalizeReaderText(markdown: string) {
  const withoutMarkdownMedia = markdown
    .replace(/!\[[^\]]*]\([^)\n]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)\n]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""),
    );

  return sanitizeHtml(withoutMarkdownMedia, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SOURCE_CHARACTERS);
}

async function fetchReaderDocument(inputUrl: string) {
  const endpoint = readerEndpoint(inputUrl);
  await assertPublicUrl(endpoint);
  const authorization = process.env.JINA_API_KEY?.trim();
  const response = await fetch(endpoint, {
    redirect: "error",
    headers: {
      Accept: "application/json",
      ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
    },
    signal: AbortSignal.timeout(22_000),
  });

  if (!response.ok) {
    throw new Error(`正文读取服务失败，状态码 ${response.status}。`);
  }

  const body = await readLimitedText(response);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return {
      title: null,
      author: null,
      content: body,
    } satisfies ReaderDocument;
  }

  try {
    return parseReaderDocument(JSON.parse(body));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("正文读取服务返回了无法解析的内容。");
    }
    throw error;
  }
}

function firstMetaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["'][^>]*>`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern)?.[1];
      if (match) return decodeText(match);
    }
  }
  return null;
}

function decodeText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  const title =
    firstMetaContent(html, ["og:title", "twitter:title"]) ??
    decodeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return title || null;
}

function extractReadableText(html: string) {
  const withoutNoise = html
    .replace(
      /<(script|style|noscript|svg|canvas|form|nav|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<!--[\s\S]*?-->/g, " ");
  const primary =
    withoutNoise.match(
      /<[^>]+(?:id=["']js_content["']|class=["'][^"']*rich_media_content[^"']*["'])[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
    )?.[1] ??
    withoutNoise.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    withoutNoise;
  const withBreaks = primary
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(p|div|section|article|main|li|blockquote|h[1-6]|tr)>/gi,
      "\n\n",
    );

  return sanitizeHtml(withBreaks, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SOURCE_CHARACTERS);
}

export function splitDistillParagraphs(text: string) {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter((paragraph) => paragraph.length >= 8);

  if (paragraphs.length < 3 && normalized.length > 360) {
    const sentences = normalized.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [
      normalized,
    ];
    paragraphs = sentences
      .reduce<string[]>((chunks, sentence) => {
        const current = chunks.at(-1);
        if (current && current.length < 420) {
          chunks[chunks.length - 1] = `${current} ${sentence}`.trim();
        } else {
          chunks.push(sentence.trim());
        }
        return chunks;
      }, [])
      .filter((paragraph) => paragraph.length >= 8);
  }

  return paragraphs.slice(0, 180);
}

function looksLikeSingleUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function looksLikeWechatChallenge(html: string, rawText: string) {
  const challengeSignals = [
    "环境异常",
    "访问过于频繁",
    "请在微信客户端打开",
    "完成验证",
    "verify",
    "security verification",
  ];
  const normalized = `${html.slice(0, 40_000)} ${rawText}`.toLowerCase();
  return (
    (!html.includes('id="js_content"') &&
      !html.includes("rich_media_content")) ||
    challengeSignals.some((signal) => normalized.includes(signal.toLowerCase()))
  );
}

function finalizeUrlSource(options: {
  sourceUrl: string;
  sourceTitle: string | null;
  sourceAuthor: string | null;
  rawText: string;
}) {
  const paragraphs = splitDistillParagraphs(options.rawText);
  if (options.rawText.length < 120 || paragraphs.length === 0) {
    throw new Error(
      "未能从该网页提取足够正文。可以复制正文后直接粘贴，或稍后重试。",
    );
  }

  return {
    sourceType: "url",
    sourceUrl: options.sourceUrl,
    sourceTitle: options.sourceTitle,
    sourceAuthor: options.sourceAuthor,
    rawText: options.rawText,
    paragraphs,
  } satisfies PreparedDistillSource;
}

export async function prepareDistillSource(
  input: string,
): Promise<PreparedDistillSource> {
  const normalizedInput = input.trim();
  if (normalizedInput.length < 30 && !looksLikeSingleUrl(normalizedInput)) {
    throw new Error("请粘贴完整网页链接，或至少 30 个字的正文。");
  }

  if (!looksLikeSingleUrl(normalizedInput)) {
    const rawText = normalizedInput.slice(0, MAX_SOURCE_CHARACTERS);
    const paragraphs = splitDistillParagraphs(rawText);
    if (paragraphs.length === 0) throw new Error("没有识别到可分析的正文。");
    return {
      sourceType: "text",
      sourceUrl: null,
      sourceTitle: null,
      sourceAuthor: null,
      rawText,
      paragraphs,
    };
  }

  const sourceUrl = new URL(normalizedInput);
  await assertPublicUrl(sourceUrl);

  if (isWechatArticleUrl(sourceUrl)) {
    try {
      const readerDocument = await fetchReaderDocument(sourceUrl.toString());
      return finalizeUrlSource({
        sourceUrl: sourceUrl.toString(),
        sourceTitle: readerDocument.title,
        sourceAuthor: readerDocument.author,
        rawText: normalizeReaderText(readerDocument.content),
      });
    } catch {
      try {
        const { html, finalUrl, contentType } = await fetchPublicHtml(
          sourceUrl.toString(),
        );
        const rawText = contentType.includes("text/plain")
          ? html.slice(0, MAX_SOURCE_CHARACTERS).trim()
          : extractReadableText(html);
        if (looksLikeWechatChallenge(html, rawText)) {
          throw new Error(WECHAT_READ_ERROR);
        }
        return finalizeUrlSource({
          sourceUrl: finalUrl,
          sourceTitle: extractTitle(html),
          sourceAuthor: firstMetaContent(html, [
            "author",
            "article:author",
            "byl",
          ]),
          rawText,
        });
      } catch {
        throw new Error(WECHAT_READ_ERROR);
      }
    }
  }

  const { html, finalUrl, contentType } =
    await fetchPublicHtml(normalizedInput);
  const rawText = contentType.includes("text/plain")
    ? html.slice(0, MAX_SOURCE_CHARACTERS).trim()
    : extractReadableText(html);
  return finalizeUrlSource({
    sourceUrl: finalUrl,
    sourceTitle: extractTitle(html),
    sourceAuthor: firstMetaContent(html, ["author", "article:author", "byl"]),
    rawText,
  });
}
