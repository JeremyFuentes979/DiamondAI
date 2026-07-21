import { sql } from "~/db";

/**
 * Runs database migrations idempotently (all use IF NOT EXISTS).
 * Called on app startup. Gracefully handles missing DATABASE_URL.
 */
export async function runMigrations(): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, error: "DATABASE_URL not set — skipping migrations" };
  }

  try {
    const db = sql();

    await db`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        filename TEXT NOT NULL,
        sport_type TEXT NOT NULL,
        action_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        file_path TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id UUID REFERENCES videos(id) NOT NULL,
        user_id UUID REFERENCES users(id) NOT NULL,
        summary TEXT,
        detailed_feedback JSONB,
        score INTEGER,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
        tier TEXT NOT NULL DEFAULT 'free',
        stripe_session_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        analyses_used_this_month INTEGER DEFAULT 0,
        current_month TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS waitlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Add current_month column if it doesn't exist (for existing DBs)
    await db`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_month TEXT
    `;

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
