import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";

const getVideo = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as { videoId?: string };
    if (!d.videoId) throw new Error("Video ID is required.");
    return { videoId: d.videoId };
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("You must be logged in.");

    const db = sql();
    const rows = await db`
      SELECT id, user_id, filename, sport_type, action_type, status, created_at
      FROM videos
      WHERE id = ${data.videoId} AND user_id = ${user.id}
    `;

    if (rows.length === 0) throw new Error("Video not found.");

    const v = rows[0];

    // Fetch analysis if exists
    let analysis = null;
    const analysisRows = await db`
      SELECT id, summary, detailed_feedback, score, created_at
      FROM analyses
      WHERE video_id = ${data.videoId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (analysisRows.length > 0) {
      const a = analysisRows[0];
      analysis = {
        id: a.id,
        summary: a.summary,
        detailed_feedback: a.detailed_feedback,
        score: a.score,
        created_at: String(a.created_at),
      };
    }

    return {
      id: v.id,
      filename: v.filename,
      sport_type: v.sport_type,
      action_type: v.action_type,
      status: v.status,
      created_at: String(v.created_at),
      analysis,
    };
  });

export const Route = createFileRoute("/app/analysis/")({
  component: AnalysisPage,
});

function AnalysisPage() {
  const { id } = Route.useParams();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getVideo({ data: { videoId: id } })
      .then(setVideo)
      .catch((err: any) => setError(err.message || "Failed to load video."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-sm text-slate-400">Loading analysis...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-10">
          <p className="text-red-400">{error}</p>
          <Link
            to="/app"
            className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!video) return null;

  const actionLabels: Record<string, string> = {
    swing: "Swing",
    pitch: "Pitch",
    catch: "Catch",
  };

  const sportLabels: Record<string, string> = {
    baseball: "Baseball",
    softball: "Softball",
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        to="/app"
        className="mb-6 inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-white"
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
        Analysis Results
      </h1>

      {/* Video Info Card */}
      <div className="mt-6 rounded-2xl border border-white/5 bg-slate-900/60 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
            {sportLabels[video.sport_type] || video.sport_type}
          </span>
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
            {actionLabels[video.action_type] || video.action_type}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              video.status === "completed"
                ? "bg-emerald-500/10 text-emerald-400"
                : video.status === "failed"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-yellow-500/10 text-yellow-400"
            }`}
          >
            {video.status === "completed"
              ? "Completed"
              : video.status === "failed"
                ? "Failed"
                : video.status === "processing"
                  ? "Processing"
                  : "Pending"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-400">
          <p>
            <span className="text-slate-500">File:</span> {video.filename}
          </p>
          <p>
            <span className="text-slate-500">Uploaded:</span>{" "}
            {new Date(video.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Analysis Status / Results */}
      <div className="mt-6 rounded-2xl border border-white/5 bg-slate-900/60 p-6">
        {video.analysis ? (
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">
                AI Analysis
              </h2>
              {video.analysis.score != null && (
                <span className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1 text-sm font-bold text-white">
                  {video.analysis.score}/100
                </span>
              )}
            </div>
            {video.analysis.summary && (
              <p className="mt-4 leading-relaxed text-slate-300">
                {video.analysis.summary}
              </p>
            )}
            {video.analysis.detailed_feedback && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-400">
                  DETAILED FEEDBACK
                </h3>
                {Array.isArray(video.analysis.detailed_feedback) ? (
                  <ul className="space-y-3">
                    {video.analysis.detailed_feedback.map(
                      (item: any, i: number) => (
                        <li
                          key={i}
                          className="rounded-lg border border-white/5 bg-slate-800/50 p-4"
                        >
                          {typeof item === "string" ? (
                            <p className="text-sm text-slate-300">{item}</p>
                          ) : (
                            <div>
                              {item.category && (
                                <p className="text-xs font-semibold text-blue-400 uppercase">
                                  {item.category}
                                </p>
                              )}
                              {item.feedback && (
                                <p className="mt-1 text-sm text-slate-300">
                                  {item.feedback}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">
                    Feedback format unavailable
                  </p>
                )}
              </div>
            )}
          </div>
        ) : video.status === "pending" || video.status === "processing" ? (
          <div className="py-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <h2 className="mt-6 text-lg font-semibold text-white">
              {video.status === "processing"
                ? "Analysis in Progress"
                : "Analysis Pending"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {video.status === "processing"
                ? "Our AI is analyzing your technique. This usually takes under 60 seconds."
                : "Your video is queued for analysis. We'll start processing it shortly."}
            </p>
            <p className="mt-6 text-sm text-slate-500">
              Detailed feedback will appear here once the analysis is complete.
            </p>
          </div>
        ) : (
          <div className="py-10 text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <h2 className="mt-4 text-lg font-semibold text-white">
              Analysis Failed
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Something went wrong during analysis. Please try uploading again.
            </p>
            <Link
              to="/app/upload"
              className="mt-4 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Upload Again
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
