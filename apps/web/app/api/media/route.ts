import {
  isAllowedMediaUrl,
  verifyMediaProxyRequest,
} from "../../../lib/media-proxy";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

async function fetchAllowedImage(url: string): Promise<Response> {
  let current = url;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (!isAllowedMediaUrl(current)) {
      throw new Error("Media host is not allowed");
    }
    const response = await fetch(current, {
      headers: {
        accept:
          "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5",
        "user-agent":
          "AI-News-Navigator/0.1 (+https://github.com/syozz-dot/ai-news-navigator)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Media redirect is missing a location");
    current = new URL(location, current).href;
  }
  throw new Error("Media request exceeded the redirect limit");
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const url = requestUrl.searchParams.get("u") ?? "";
  const expiresAt = Number(requestUrl.searchParams.get("exp"));
  const suppliedSignature = requestUrl.searchParams.get("sig") ?? "";
  if (
    !Number.isSafeInteger(expiresAt) ||
    !verifyMediaProxyRequest({ url, expiresAt, suppliedSignature })
  ) {
    return new Response("Invalid media signature", { status: 403 });
  }

  try {
    const upstream = await fetchAllowedImage(url);
    if (!upstream.ok) {
      return new Response("Media unavailable", { status: upstream.status });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    const contentLength = Number(upstream.headers.get("content-length") ?? 0);
    if (!contentType.startsWith("image/") || contentLength > MAX_BYTES) {
      return new Response("Unsupported media", { status: 415 });
    }
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return new Response("Media is too large", { status: 413 });
    }
    return new Response(body, {
      headers: {
        "cache-control":
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "content-type": contentType,
        "content-length": String(body.byteLength),
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Media unavailable", { status: 502 });
  }
}
