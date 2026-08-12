import { NextResponse } from "next/server";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
} as const;

function expectedOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0];
  if (forwardedHost && forwardedProtocol) {
    return `${forwardedProtocol.trim()}://${forwardedHost.trim()}`;
  }
  return new URL(request.url).origin;
}

export function rejectUntrustedPrivateMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return privateJson({ error: "请求来源无效。" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin(request)) {
    return privateJson({ error: "请求来源无效。" }, { status: 403 });
  }

  return null;
}

export function privateJson(
  body: unknown,
  init: ResponseInit = {},
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      ...Object.fromEntries(new Headers(init.headers).entries()),
    },
  });
}
