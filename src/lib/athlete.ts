import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";

// --- Types ---

export interface AthleteProfile {
  id: string;
  userId: string;
  sportType: string;
  position: string | null;
  skillLevel: string;
  ageGroup: string | null;
  goals: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressSummary {
  totalAnalyses: number;
  latestScore: number | null;
  scoreTrend: { date: string; score: number }[];
  averageScore: number | null;
  bestScore: number | null;
  milestones: { id: string; title: string; description: string | null; unlockedAt: string }[];
}

// --- Server Functions ---

export const getOrCreateProfile = createServerFn({ method: "GET" }).handler(
  async (): Promise<AthleteProfile | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const db = sql();

    const rows = await db`
      SELECT id, user_id, sport_type, position, skill_level, age_group, goals, created_at, updated_at
      FROM athlete_profiles WHERE user_id = ${user.id}
    `;

    if (rows.length > 0) {
      const p = rows[0];
      return {
        id: p.id,
        userId: p.user_id,
        sportType: p.sport_type,
        position: p.position,
        skillLevel: p.skill_level,
        ageGroup: p.age_group,
        goals: p.goals,
        createdAt: String(p.created_at),
        updatedAt: String(p.updated_at),
      };
    }

    // Create default profile
    const inserted = await db`
      INSERT INTO athlete_profiles (user_id)
      VALUES (${user.id})
      RETURNING id, user_id, sport_type, position, skill_level, age_group, goals, created_at, updated_at
    `;

    const p = inserted[0];
    return {
      id: p.id,
      userId: p.user_id,
      sportType: p.sport_type,
      position: p.position,
      skillLevel: p.skill_level,
      ageGroup: p.age_group,
      goals: p.goals,
      createdAt: String(p.created_at),
      updatedAt: String(p.updated_at),
    };
  },
);

export const updateProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as {
      sport_type?: string;
      position?: string | null;
      skill_level?: string;
      age_group?: string | null;
      goals?: string | null;
    };
    return d;
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("You must be logged in.");

    const db = sql();

    // Ensure profile exists
    await db`
      INSERT INTO athlete_profiles (user_id) VALUES (${user.id})
      ON CONFLICT (user_id) DO NOTHING
    `;

    // Update each field individually using tagged templates
    if (data.sport_type !== undefined) {
      await db`UPDATE athlete_profiles SET sport_type = ${data.sport_type}, updated_at = now() WHERE user_id = ${user.id}`;
    }
    if (data.position !== undefined) {
      await db`UPDATE athlete_profiles SET position = ${data.position}, updated_at = now() WHERE user_id = ${user.id}`;
    }
    if (data.skill_level !== undefined) {
      await db`UPDATE athlete_profiles SET skill_level = ${data.skill_level}, updated_at = now() WHERE user_id = ${user.id}`;
    }
    if (data.age_group !== undefined) {
      await db`UPDATE athlete_profiles SET age_group = ${data.age_group}, updated_at = now() WHERE user_id = ${user.id}`;
    }
    if (data.goals !== undefined) {
      await db`UPDATE athlete_profiles SET goals = ${data.goals}, updated_at = now() WHERE user_id = ${user.id}`;
    }

    return { success: true };
  });

export const getProgressSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProgressSummary | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const db = sql();

    // Total analyses
    const countRows = await db`
      SELECT COUNT(*) as cnt FROM analyses WHERE user_id = ${user.id}
    `;
    const totalAnalyses = Number(countRows[0]?.cnt || 0);

    // Latest score
    const latestRows = await db`
      SELECT score, created_at FROM analyses
      WHERE user_id = ${user.id} AND score IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    const latestScore = latestRows.length > 0 ? Number(latestRows[0].score) : null;

    // Score trend (last 5 scores)
    const trendRows = await db`
      SELECT score, created_at FROM analyses
      WHERE user_id = ${user.id} AND score IS NOT NULL
      ORDER BY created_at DESC LIMIT 5
    `;
    const scoreTrend = trendRows
      .reverse()
      .map((r: any) => ({
        date: String(r.created_at),
        score: Number(r.score),
      }));

    // Average and best score
    const statRows = await db`
      SELECT AVG(score) as avg_score, MAX(score) as max_score
      FROM analyses
      WHERE user_id = ${user.id} AND score IS NOT NULL
    `;
    const averageScore = statRows[0]?.avg_score != null ? Math.round(Number(statRows[0].avg_score)) : null;
    const bestScore = statRows[0]?.max_score != null ? Number(statRows[0].max_score) : null;

    // Milestones
    const milestoneRows = await db`
      SELECT id, title, description, unlocked_at FROM milestones
      WHERE user_id = ${user.id}
      ORDER BY unlocked_at DESC
    `;
    const milestones = milestoneRows.map((m: any) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      unlockedAt: String(m.unlocked_at),
    }));

    return {
      totalAnalyses,
      latestScore,
      scoreTrend,
      averageScore,
      bestScore,
      milestones,
    };
  },
);

export const checkMilestones = createServerFn({ method: "POST" })
  .handler(async () => {
    const user = await getCurrentUser();
    if (!user) return { unlocked: [] as string[] };

    const db = sql();

    // Count analyses
    const countRows = await db`
      SELECT COUNT(*) as cnt FROM analyses WHERE user_id = ${user.id}
    `;
    const totalAnalyses = Number(countRows[0]?.cnt || 0);

    // Get all scores
    const scoreRows = await db`
      SELECT score FROM analyses
      WHERE user_id = ${user.id} AND score IS NOT NULL
      ORDER BY created_at DESC
    `;
    const scores = scoreRows.map((r: any) => Number(r.score));

    // Get existing milestones
    const existingRows = await db`
      SELECT title FROM milestones WHERE user_id = ${user.id}
    `;
    const existingTitles = new Set(existingRows.map((r: any) => r.title));

    const unlocked: string[] = [];

    const milestoneDefinitions: { title: string; description: string; check: () => boolean }[] = [
      {
        title: "Welcome to SwingSense!",
        description: "Completed your first video analysis.",
        check: () => totalAnalyses >= 1,
      },
      {
        title: "Getting the Hang of It",
        description: "Completed 5 analyses.",
        check: () => totalAnalyses >= 5,
      },
      {
        title: "Consistent Hitter",
        description: "Completed 25 analyses.",
        check: () => totalAnalyses >= 25,
      },
      {
        title: "Road to 100",
        description: "Completed 100 analyses.",
        check: () => totalAnalyses >= 100,
      },
      {
        title: "Breaking 70",
        description: "Achieved a score of 70 or above.",
        check: () => scores.some((s) => s >= 70),
      },
      {
        title: "Breaking 85",
        description: "Achieved a score of 85 or above.",
        check: () => scores.some((s) => s >= 85),
      },
      {
        title: "Elite Status",
        description: "Achieved a score of 95 or above.",
        check: () => scores.some((s) => s >= 95),
      },
    ];

    for (const milestone of milestoneDefinitions) {
      if (!existingTitles.has(milestone.title) && milestone.check()) {
        await db`
          INSERT INTO milestones (user_id, title, description)
          VALUES (${user.id}, ${milestone.title}, ${milestone.description})
        `;
        unlocked.push(milestone.title);
      }
    }

    return { unlocked };
  });

export const logMetric = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as {
      metric_name: string;
      metric_value: number;
      analysis_id?: string;
    };
    if (!d.metric_name || typeof d.metric_value !== "number") {
      throw new Error("metric_name and metric_value are required.");
    }
    return d;
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("You must be logged in.");

    const db = sql();

    await db`
      INSERT INTO performance_metrics (user_id, analysis_id, metric_name, metric_value)
      VALUES (${user.id}, ${data.analysis_id || null}, ${data.metric_name}, ${data.metric_value})
    `;

    return { success: true };
  });
