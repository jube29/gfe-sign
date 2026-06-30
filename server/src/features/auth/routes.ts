import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { signInSchema, signUpSchema } from "shared/schemas/auth";
import { db } from "../../db";
import { sessions, users } from "../../db/schema";
import { requireAuth } from "../../middleware/requireAuth";
import {
  clearSessionCookie,
  createSession,
  hashToken,
  SESSION_COOKIE,
  setSessionCookie,
} from "./session";

const BCRYPT_COST = 12;

// A valid throwaway hash so /signin spends ~the same time whether or not the
// email exists — closes a timing oracle that would leak which emails are real.
const DUMMY_HASH = bcrypt.hashSync("no-such-user", BCRYPT_COST);

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const parsed = signUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) {
    res.status(409).json({ error: "Account already exists. Sign in instead?" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = db
    .insert(users)
    .values({ email, passwordHash })
    .returning({ id: users.id, email: users.email })
    .get();

  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(201).json({ user });
});

authRouter.post("/signin", async (req, res) => {
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const user = db.select().from(users).where(eq(users.email, email)).get();
  // Always run a compare (against the dummy hash if no user) for constant-ish timing.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }

  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(200).json({ user: { id: user.id, email: user.email } });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ email: req.user?.email });
});

authRouter.post("/signout", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    db.delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
      .run();
  }
  clearSessionCookie(res);
  res.status(204).end();
});
