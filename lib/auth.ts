import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

type SessionPayload = {
  role: "admin";
  exp: number;
};

export function verifyAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || !candidate) return false;

  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createAdminSessionValue(now = Date.now()): Promise<string> {
  const payload: SessionPayload = {
    role: "admin",
    exp: now + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await sign(encoded);
  return `${encoded}.${signature}`;
}

export async function verifyAdminSessionValue(value: string, now = Date.now()): Promise<boolean> {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return false;

  const expected = await sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    return payload.role === "admin" && typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

export async function requireAdmin(request: Request): Promise<void> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = readCookie(cookieHeader, ADMIN_COOKIE);
  if (!token || !(await verifyAdminSessionValue(token))) {
    throw new AuthError("Unauthorized", 401);
  }
}

export function adminCookieOptions(token: string): { name: string; value: string; options: {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} } {
  return {
    name: ADMIN_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    },
  };
}

async function sign(encodedPayload: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");

  // Prefer Web Crypto when available; fall back to Node crypto for Vitest/Node.
  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await globalThis.crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(encodedPayload),
    );
    return Buffer.from(signature).toString("base64url");
  }

  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function readCookie(header: string, name: string): string | undefined {
  const parts = header.split(";").map((part) => part.trim());
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index) === name) return part.slice(index + 1);
  }
  return undefined;
}
