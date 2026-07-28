export type RateLimitResult = {
  allowed: boolean;
};

/**
 * Optional short-lived duplicate-submit / abuse protection.
 * When Upstash env vars are absent, always allows the request.
 * Capacity correctness never depends on this helper.
 */
export async function limitBookingRequest(request: Request): Promise<RateLimitResult> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!baseUrl || !token) return { allowed: true };

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "anonymous";
  const key = `booking:rl:${ip}`;

  try {
    const increment = await redisCommand(baseUrl, token, ["INCR", key]);
    if (increment === 1) {
      await redisCommand(baseUrl, token, ["EXPIRE", key, "60"]);
    }
    return { allowed: typeof increment === "number" ? increment <= 20 : true };
  } catch {
    return { allowed: true };
  }
}

async function redisCommand(baseUrl: string, token: string, command: string[]): Promise<unknown> {
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Upstash command failed: ${response.status}`);
  const payload = (await response.json()) as { result?: unknown };
  return payload.result;
}
