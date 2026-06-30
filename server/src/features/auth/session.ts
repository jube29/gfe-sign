import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import { db } from "../../db";
import { sessions } from "../../db/schema";

export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

// SHA-256 of the raw cookie token. The token is high-entropy (randomBytes),
// so a fast hash is fine — we only need irreversibility, not slow hashing.
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createSession(userId: number): {
  token: string;
  expiresAt: Date;
} {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.insert(sessions)
    .values({ userId, tokenHash: hashToken(token), expiresAt })
    .run();
  return { token, expiresAt };
}

function baseCookieOptions() {
  return {
    httpOnly: true, // invisible to document.cookie -> XSS can't read it
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod (localhost is http)
    sameSite: "strict" as const, // not sent on cross-site requests -> CSRF defense
    path: "/",
  };
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookieOptions(),
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  // Must match the attributes the cookie was set with, or the browser won't clear it.
  res.clearCookie(SESSION_COOKIE, baseCookieOptions());
}
