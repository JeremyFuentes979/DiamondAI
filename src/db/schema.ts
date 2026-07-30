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

    await db`
      CREATE TABLE IF NOT EXISTS athlete_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
        sport_type TEXT NOT NULL DEFAULT 'baseball',
        position TEXT,
        skill_level TEXT DEFAULT 'beginner',
        age_group TEXT,
        goals TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        analysis_id UUID REFERENCES analyses(id),
        metric_name TEXT NOT NULL,
        metric_value NUMERIC NOT NULL,
        recorded_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        unlocked_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    // Backfill performance_metrics from existing analyses (only if metrics table is empty)
    const metricCount = await db`
      SELECT COUNT(*) as cnt FROM performance_metrics
    `;
    if (Number(metricCount[0]?.cnt || 0) === 0) {
      await db`
        INSERT INTO performance_metrics (user_id, analysis_id, metric_name, metric_value, recorded_at)
        SELECT a.user_id, a.id, 'overall_score', a.score::numeric, a.created_at
        FROM analyses a
        WHERE a.score IS NOT NULL
      `;
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
