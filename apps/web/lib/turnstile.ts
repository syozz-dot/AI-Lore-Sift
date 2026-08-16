interface TurnstileResponse {
  success?: boolean;
  "error-codes"?: string[];
}

export function isTurnstileConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() &&
    process.env.TURNSTILE_SECRET_KEY?.trim(),
  );
}

export async function verifyTurnstileToken(token: unknown) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;
  if (typeof token !== "string" || !token.trim()) return false;

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token.trim());
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return false;
  const body = (await response.json()) as TurnstileResponse;
  return body.success === true;
}
