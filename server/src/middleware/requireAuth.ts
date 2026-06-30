import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { hashToken, SESSION_COOKIE } from "../features/auth/session";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Single round-trip: join session -> user, fetch only safe fields (no passwordHash).
  const row = db
    .select({
      id: users.id,
      email: users.email,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .get();

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.user = { id: row.id, email: row.email };
  next();
}
