import { createHmac } from "node:crypto";
import { sql } from "~/db";
import { createServerFn } from "@tanstack/react-start";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "diamond-ai-dev-secret-change-in-prod";
const COOKIE_NAME = "diamond_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// --- Crypto helpers ---

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

function createSessionToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  return `${payload}:${sign(payload)}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split(":");
  if (parts.length < 3) return null;
  const sig = parts.pop()!;
  const payload = parts.join(":");
  if (sign(payload) !== sig) return null;

  const [userId, ts] = payload.split(":");
  const age = Date.now() - parseInt(ts, 10);
  if (age > SESSION_MAX_AGE_MS) return null;

  return userId;
}

function getSessionTokenFromRequest(): string | null {
  // In TanStack Start server functions, we can access the web Request
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getWebRequest } = require("@tanstack/react-start/server");
    const req = getWebRequest();
    if (!req) return null;
    const cookie = req.headers.get("cookie") || "";
    const match = cookie.match(
      new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

// --- Auth server functions ---

export const signup = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string; password?: string };
    if (!d.email || typeof d.email !== "string" || !d.email.includes("@")) {
      throw new Error("Valid email is required.");
    }
    if (!d.password || typeof d.password !== "string" || d.password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    return { email: d.email.trim().toLowerCase(), password: d.password };
  })
  .handler(async ({ data }) => {
    const db = sql();
    const hash = await Bun.password.hash(data.password);

    // Check existing user
    const existing = await db`SELECT id FROM users WHERE email = ${data.email}`;
    if (existing.length > 0) {
      throw new Error("An account with this email already exists.");
    }

    const rows = await db`
      INSERT INTO users (email, password_hash)
      VALUES (${data.email}, ${hash})
      RETURNING id, email, created_at
    `;
    const user = rows[0];
    const token = createSessionToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: String(user.created_at),
      },
    };
  });

export const login = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string; password?: string };
    if (!d.email || typeof d.email !== "string") {
      throw new Error("Email is required.");
    }
    if (!d.password || typeof d.password !== "string") {
      throw new Error("Password is required.");
    }
    return { email: d.email.trim().toLowerCase(), password: d.password };
  })
  .handler(async ({ data }) => {
    const db = sql();

    const rows = await db`
      SELECT id, email, password_hash, created_at
      FROM users WHERE email = ${data.email}
    `;
    if (rows.length === 0) {
      throw new Error("Invalid email or password.");
    }

    const user = rows[0];
    const valid = await Bun.password.verify(data.password, user.password_hash);
    if (!valid) {
      throw new Error("Invalid email or password.");
    }

    const token = createSessionToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        created_at: String(user.created_at),
      },
    };
  });

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const token = getSessionTokenFromRequest();
    if (!token) return null;

    const userId = verifySessionToken(token);
    if (!userId) return null;

    try {
      const db = sql();
      const rows = await db`
        SELECT id, email, created_at FROM users WHERE id = ${userId}
      `;
      if (rows.length === 0) return null;
      const u = rows[0];
      return {
        id: u.id,
        email: u.email,
        created_at: String(u.created_at),
      };
    } catch {
      return null;
    }
  },
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  // Logout is handled client-side by clearing the cookie.
  // This server fn exists for symmetry and future server-side session invalidation.
  return { success: true };
});

// --- Client helpers ---

export function setSessionCookie(token: string): void {
  if (typeof document === "undefined") return;
  const maxAge = SESSION_MAX_AGE_MS / 1000;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

export function getSessionCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
