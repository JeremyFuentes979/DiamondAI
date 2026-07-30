import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";
import { getOrCreateProfile, updateProfile, getProgressSummary } from "~/lib/athlete";
import type { AthleteProfile, ProgressSummary } from "~/lib/athlete";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

// --- Server function for recent analyses ---

const getRecentAnalyses = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) return [];

  const db = sql();

  const rows = await db`
    SELECT v.id, v.filename, v.sport_type, v.action_type, v.status, v.created_at,
           a.score, a.summary
    FROM videos v
    LEFT JOIN analyses a ON a.video_id = v.id
    WHERE v.user_id = ${user.id}
    ORDER BY v.created_at DESC
    LIMIT 5
  `;

  return rows.map((r: any) => ({
    id: r.id,
    filename: r.filename,
    sport_type: r.sport_type,
    action_type: r.action_type,
    status: r.status,
    score: r.score,
    summary: r.summary,
    created_at: String(r.created_at),
  }));
});

// --- Page Component ---

const ALL_MILESTONES = [
  { title: "Welcome to SwingSense!", description: "Completed your first video analysis.", icon: "🎉", threshold: "1 analysis" },
  { title: "Getting the Hang of It", description: "Completed 5 analyses.", icon: "🔥", threshold: "5 analyses" },
  { title: "Consistent Hitter", description: "Completed 25 analyses.", icon: "⚾", threshold: "25 analyses" },
  { title: "Road to 100", description: "Completed 100 analyses.", icon: "🏆", threshold: "100 analyses" },
  { title: "Breaking 70", description: "Achieved a score of 70 or above.", icon: "⭐", threshold: "Score 70+" },
  { title: "Breaking 85", description: "Achieved a score of 85 or above.", icon: "🌟", threshold: "Score 85+" },
  { title: "Elite Status", description: "Achieved a score of 95 or above.", icon: "💎", threshold: "Score 95+" },
];

const SPORT_OPTIONS = [
  { value: "baseball", label: "Baseball" },
  { value: "softball", label: "Softball" },
];

const POSITION_OPTIONS = [
  { value: "pitcher", label: "Pitcher" },
  { value: "catcher", label: "Catcher" },
  { value: "infield", label: "Infield" },
  { value: "outfield", label: "Outfield" },
  { value: "hitter", label: "Hitter" },
  { value: "utility", label: "Utility" },
];

const SKILL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "elite", label: "Elite" },
];

const AGE_OPTIONS = [
  { value: "8-10", label: "Ages 8–10" },
  { value: "11-13", label: "Ages 11–13" },
  { value: "14-16", label: "Ages 14–16" },
  { value: "17-18", label: "Ages 17–18" },
];

const actionLabels: Record<string, string> = {
  swing: "Swing",
  pitch: "Pitch",
  catch: "Catch",
};
const sportLabels: Record<string, string> = {
  baseball: "Baseball",
  softball: "Softball",
};

function getScoreColor(score: number | null) {
  if (score == null) return "text-slate-500";
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function getScoreBg(score: number | null) {
  if (score == null) return "bg-slate-700/30 border-slate-600/20";
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 60) return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function ProfilePage() {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editSport, setEditSport] = useState("baseball");
  const [editPosition, setEditPosition] = useState("");
  const [editSkill, setEditSkill] = useState("beginner");
  const [editAge, setEditAge] = useState("");
  const [editGoals, setEditGoals] = useState("");

  useEffect(() => {
    Promise.all([
      getOrCreateProfile(),
      getProgressSummary(),
      getRecentAnalyses(),
    ])
      .then(([p, ps, ra]) => {
        setProfile(p);
        setProgress(ps);
        setRecentAnalyses(ra);
        if (p) {
          setEditSport(p.sportType);
          setEditPosition(p.position || "");
          setEditSkill(p.skillLevel);
          setEditAge(p.ageGroup || "");
          setEditGoals(p.goals || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        sport_type: editSport,
        position: editPosition || null,
        skill_level: editSkill,
        age_group: editAge || null,
        goals: editGoals || null,
      });
      // Refresh profile
      const p = await getOrCreateProfile();
      setProfile(p);
      if (p) {
        setEditSport(p.sportType);
        setEditPosition(p.position || "");
        setEditSkill(p.skillLevel);
        setEditAge(p.ageGroup || "");
        setEditGoals(p.goals || "");
      }
      setEditing(false);
    } catch (err: any) {
      alert(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const unlockedTitles = new Set(
    (progress?.milestones || []).map((m) => m.title),
  );

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  // Sparkline bars
  const maxTrendScore = Math.max(
    ...(progress?.scoreTrend || []).map((t) => t.score),
    1,
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/app"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Athlete Profile
        </h1>
        <p className="mt-2 text-slate-400">
          Track your progress, achievements, and development over time.
        </p>
      </div>

      {/* Profile Card */}
      <div className="mb-8 rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Your Profile</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/20 hover:text-white"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-full bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Sport
              </label>
              <select
                value={editSport}
                onChange={(e) => setEditSport(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {SPORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Position
              </label>
              <select
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Select position...</option>
                {POSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Skill Level
              </label>
              <select
                value={editSkill}
                onChange={(e) => setEditSkill(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {SKILL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Age Group
              </label>
              <select
                value={editAge}
                onChange={(e) => setEditAge(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Select age group...</option>
                {AGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Goals
              </label>
              <textarea
                value={editGoals}
                onChange={(e) => setEditGoals(e.target.value)}
                placeholder="e.g. Improve my batting average, make the varsity team..."
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-slate-800/40 p-4">
              <span className="text-xl">🏟️</span>
              <div>
                <p className="text-xs text-slate-400">Sport</p>
                <p className="text-sm font-medium text-white">
                  {profile?.sportType === "baseball" ? "Baseball" : "Softball"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-800/40 p-4">
              <span className="text-xl">🧢</span>
              <div>
                <p className="text-xs text-slate-400">Position</p>
                <p className="text-sm font-medium text-white">
                  {profile?.position
                    ? profile.position.charAt(0).toUpperCase() +
                      profile.position.slice(1)
                    : "Not set"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-800/40 p-4">
              <span className="text-xl">📊</span>
              <div>
                <p className="text-xs text-slate-400">Skill Level</p>
                <p className="text-sm font-medium text-white capitalize">
                  {profile?.skillLevel || "Beginner"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-800/40 p-4">
              <span className="text-xl">👤</span>
              <div>
                <p className="text-xs text-slate-400">Age Group</p>
                <p className="text-sm font-medium text-white">
                  {profile?.ageGroup
                    ? `Ages ${profile.ageGroup}`
                    : "Not set"}
                </p>
              </div>
            </div>
            {profile?.goals && (
              <div className="flex items-start gap-3 rounded-xl bg-slate-800/40 p-4 sm:col-span-2">
                <span className="text-xl mt-0.5">🎯</span>
                <div>
                  <p className="text-xs text-slate-400">Goals</p>
                  <p className="text-sm font-medium text-white">
                    {profile.goals}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
          <p className="text-sm font-medium text-slate-400">Total Analyses</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {progress?.totalAnalyses ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
          <p className="text-sm font-medium text-slate-400">Latest Score</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {progress?.latestScore != null
              ? `${progress.latestScore}/100`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
          <p className="text-sm font-medium text-slate-400">Average</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {progress?.averageScore != null
              ? `${progress.averageScore}/100`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
          <p className="text-sm font-medium text-slate-400">Best Score</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {progress?.bestScore != null ? `${progress.bestScore}/100` : "—"}
          </p>
        </div>
      </div>

      {/* Score Trend */}
      {progress?.scoreTrend && progress.scoreTrend.length > 0 && (
        <div className="mb-8 rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8">
          <h3 className="mb-4 text-lg font-semibold text-white">
            Score Trend
          </h3>
          <div className="flex items-end gap-1.5 h-24">
            {progress.scoreTrend.map((t, i) => {
              const heightPercent = (t.score / 100) * 100;
              const date = new Date(t.date);
              const dateLabel = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="flex w-full items-end justify-center">
                    <div
                      className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-amber-500 to-orange-400 transition-all"
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{dateLabel}</span>
                  <span className="text-xs font-medium text-white">
                    {t.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="mb-8 rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8">
        <h3 className="mb-4 text-lg font-semibold text-white">Milestones</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_MILESTONES.map((ms) => {
            const unlocked = unlockedTitles.has(ms.title);
            return (
              <div
                key={ms.title}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
                  unlocked
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-white/5 bg-slate-800/20 opacity-50"
                }`}
              >
                <span className="text-xl">{ms.icon}</span>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      unlocked ? "text-amber-400" : "text-slate-500"
                    }`}
                  >
                    {ms.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {unlocked ? ms.description : ms.threshold}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Analyses */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8">
        <h3 className="mb-4 text-lg font-semibold text-white">
          Recent Analyses
        </h3>
        {recentAnalyses.length > 0 ? (
          <div className="space-y-3">
            {recentAnalyses.map((analysis: any) => (
              <Link
                key={analysis.id}
                to={`/app/analysis/${analysis.id}`}
                className="flex items-center gap-4 rounded-xl border border-white/5 bg-slate-800/40 p-4 transition-all hover:border-white/10 hover:bg-slate-800/60"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${getScoreBg(analysis.score)}`}
                >
                  <span
                    className={`text-lg font-bold ${getScoreColor(analysis.score)}`}
                  >
                    {analysis.score != null ? analysis.score : "—"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {analysis.filename}
                  </p>
                  <div className="mt-0.5 flex gap-2 text-xs text-slate-500">
                    <span>
                      {sportLabels[analysis.sport_type] || analysis.sport_type}
                    </span>
                    <span>•</span>
                    <span>
                      {actionLabels[analysis.action_type] || analysis.action_type}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {analysis.status === "completed" ? (
                    <span className="text-xs font-medium text-emerald-400">
                      Complete
                    </span>
                  ) : analysis.status === "processing" ? (
                    <span className="text-xs font-medium text-amber-400">
                      Processing
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-red-400">
                      Failed
                    </span>
                  )}
                </div>
                <svg
                  className="h-4 w-4 shrink-0 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 bg-slate-800/20 p-8 text-center">
            <p className="text-sm text-slate-500">
              No analyses yet. Upload your first video to get started!
            </p>
            <Link
              to="/app/upload"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:brightness-110"
            >
              Upload Video
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
