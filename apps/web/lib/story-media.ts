export interface StoryMediaAsset {
  type: "image" | "video" | "audio";
  url: string;
  previewUrl?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface PresentableStoryMedia extends StoryMediaAsset {
  imageUrl: string;
}

const visualFirstContentTypes = new Set(["product", "model", "post"]);
const visualSourcePattern =
  /(?:aihot|\bx\b|twitter|tweet|微信|公众号|wechat|product\s*hunt)/i;
const unsuitableMediaPattern =
  /(?:avatar|profile|head(?:er|shot)?|logo|icon|emoji|sprite|badge|qrcode|qr[-_ ]?code|tracking|pixel)/i;

function canonicalMediaUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ].forEach((key) => url.searchParams.delete(key));
    return url.toString();
  } catch {
    return value;
  }
}

function isLargeEnough(asset: StoryMediaAsset): boolean {
  if (asset.width && asset.width < 480) return false;
  if (asset.height && asset.height < 240) return false;
  return true;
}

function isSuitableVisual(asset: StoryMediaAsset, imageUrl: string): boolean {
  if (!isLargeEnough(asset)) return false;
  const searchable = `${imageUrl} ${asset.alt ?? ""}`;
  if (unsuitableMediaPattern.test(searchable)) return false;

  try {
    const hostname = new URL(imageUrl).hostname.toLowerCase();
    if (hostname === "mmbiz.qlogo.cn" || hostname.endsWith(".qlogo.cn"))
      return false;
  } catch {
    return false;
  }

  return true;
}

export function selectPromotedStoryMedia(
  assets: StoryMediaAsset[],
  options: {
    contentType?: string | null;
    sourceName?: string | null;
    max?: number;
  },
): PresentableStoryMedia[] {
  const contentType = options.contentType?.toLowerCase() ?? "";
  const sourceName = options.sourceName ?? "";
  const shouldPromote =
    visualFirstContentTypes.has(contentType) ||
    visualSourcePattern.test(sourceName);

  if (!shouldPromote) return [];

  const seen = new Set<string>();
  const selected: PresentableStoryMedia[] = [];

  for (const asset of assets) {
    const imageUrl = asset.type === "image" ? asset.url : asset.previewUrl;
    if (!imageUrl || !isSuitableVisual(asset, imageUrl)) continue;

    const canonicalUrl = canonicalMediaUrl(imageUrl);
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);

    selected.push({ ...asset, imageUrl });
    if (selected.length >= (options.max ?? 3)) break;
  }

  return selected;
}
