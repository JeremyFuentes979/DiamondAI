import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { runAnalysis } from "~/lib/analysis";
import { checkAndIncrementAnalysisLimit } from "~/lib/subscription";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export const Route = createFileRoute("/app/upload")({
  component: UploadPage,
});

function UploadPage() {
  const [sportType, setSportType] = useState<"baseball" | "softball" | null>(
    null,
  );
  const [actionType, setActionType] = useState<
    "swing" | "pitch" | "catch" | null
  >(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const valid = [".mp4", ".mov", ".webm"];
      const ext = "." + dropped.name.split(".").pop()?.toLowerCase();
      if (!valid.includes(ext)) {
        setError("Please upload an MP4, MOV, or WebM video file.");
        return;
      }
      if (dropped.size > MAX_FILE_SIZE) {
        setError(
          `File is too large (${(dropped.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 500 MB.`,
        );
        return;
      }
      setFile(dropped);
      setError("");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > MAX_FILE_SIZE) {
        setError(
          `File is too large (${(selected.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 500 MB.`,
        );
        return;
      }
      setFile(selected);
      setError("");
    }
  };

  const uploadFile = (
    formData: FormData,
  ): Promise<{
    id: string;
    filename: string;
    sport_type: string;
    action_type: string;
    status: string;
    created_at: string;
  }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 90)); // 0-90% for upload
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          } catch {
            reject(new Error("Invalid response from server."));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || `Upload failed (${xhr.status}).`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status}).`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error. Please check your connection."));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload was cancelled."));
      });

      xhr.open("POST", "/api/upload");
      // Don't set Content-Type — browser sets it automatically with boundary
      xhr.send(formData);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatusText("");

    if (!sportType) {
      setError("Please select a sport.");
      return;
    }
    if (!actionType) {
      setError("Please select an action type.");
      return;
    }
    if (!file) {
      setError("Please select a video file.");
      return;
    }

    // Client-side size validation (double-check)
    if (file.size > MAX_FILE_SIZE) {
      setError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 500 MB.`,
      );
      return;
    }

    setUploading(true);
    setProgress(0);
    setStatusText("Uploading...");

    try {
      // Check analysis limit before uploading
      const limitCheck = await checkAndIncrementAnalysisLimit();
      if (!limitCheck.allowed) {
        setError(limitCheck.message || "You've reached your free limit.");
        setUploading(false);
        return;
      }

      // Build FormData and upload via multipart/form-data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sportType", sportType);
      formData.append("actionType", actionType);

      const result = await uploadFile(formData);
      setProgress(100);
      setStatusText("Analyzing...");

      // Trigger AI analysis
      try {
        const analysisResult = await runAnalysis({
          data: { videoId: result.id },
        });
        if (analysisResult.success) {
          setStatusText("Complete!");
          setTimeout(() => {
            navigate({ to: `/app/analysis/${result.id}` });
          }, 600);
          return;
        }
      } catch (analysisErr: any) {
        // Analysis failed but upload succeeded — still navigate
        navigate({ to: `/app/analysis/${result.id}` });
        return;
      }

      navigate({ to: `/app/analysis/${result.id}` });
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
      setProgress(0);
      setStatusText("");
    } finally {
      setUploading(false);
    }
  };

  const sportOptions = [
    { value: "baseball" as const, label: "Baseball", icon: "⚾" },
    { value: "softball" as const, label: "Softball", icon: "🥎" },
  ];

  const actionOptions = [
    { value: "swing" as const, label: "Swing", desc: "Batting analysis" },
    { value: "pitch" as const, label: "Pitch", desc: "Pitching mechanics" },
    { value: "catch" as const, label: "Catch", desc: "Fielding analysis" },
  ];

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
        New Analysis
      </h1>
      <p className="mt-2 text-slate-400">
        Upload a video to get AI-powered technique feedback.
      </p>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Sport Type */}
        <div>
          <label className="mb-3 block text-sm font-medium text-slate-300">
            Sport Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {sportOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSportType(opt.value)}
                className={`rounded-xl border px-4 py-4 text-center transition-all ${
                  sportType === opt.value
                    ? "border-amber-500/50 bg-amber-500/10 text-white shadow-lg shadow-amber-500/10"
                    : "border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/10 hover:text-white"
                }`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <p className="mt-1 font-medium">{opt.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Action Type */}
        <div>
          <label className="mb-3 block text-sm font-medium text-slate-300">
            Action Type
          </label>
          <div className="grid grid-cols-3 gap-3">
            {actionOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setActionType(opt.value)}
                className={`rounded-xl border px-3 py-4 text-center transition-all ${
                  actionType === opt.value
                    ? "border-amber-500/50 bg-amber-500/10 text-white shadow-lg shadow-amber-500/10"
                    : "border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/10 hover:text-white"
                }`}
              >
                <p className="font-medium">{opt.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="mb-3 block text-sm font-medium text-slate-300">
            Video File
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
              dragOver
                ? "border-amber-500/50 bg-amber-500/5"
                : file
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-white/10 bg-slate-900/40 hover:border-white/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mov,.webm"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div>
                <svg
                  className="mx-auto h-10 w-10 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                  />
                </svg>
                <p className="mt-2 font-medium text-white">{file.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB — Click to change
                </p>
              </div>
            ) : (
              <div>
                <svg
                  className="mx-auto h-10 w-10 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                  />
                </svg>
                <p className="mt-2 text-sm font-medium text-slate-300">
                  Drag and drop your video here, or click to browse
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  MP4, MOV, or WebM up to 500 MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {statusText || (progress < 90 ? "Uploading..." : "Saving...")}
              </span>
              <span className="text-amber-400">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading}
          className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload & Analyze"}
        </button>
      </form>
    </main>
  );
}
