import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useRef, useCallback } from "react";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";

const UPLOAD_DIR = "/home/team/shared/uploads";

const uploadVideo = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as {
      sportType?: string;
      actionType?: string;
      fileName?: string;
      fileData?: string; // base64 encoded
    };
    if (!d.sportType || !["baseball", "softball"].includes(d.sportType)) {
      throw new Error("Please select a valid sport.");
    }
    if (!d.actionType || !["swing", "pitch", "catch"].includes(d.actionType)) {
      throw new Error("Please select a valid action type.");
    }
    if (!d.fileName || !d.fileData) {
      throw new Error("Please select a video file.");
    }
    return {
      sportType: d.sportType as "baseball" | "softball",
      actionType: d.actionType as "swing" | "pitch" | "catch",
      fileName: d.fileName,
      fileData: d.fileData,
    };
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("You must be logged in to upload.");

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const ext = data.fileName.split(".").pop() || "mp4";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = join(UPLOAD_DIR, uniqueName);

    // Decode base64 and write file
    const buffer = Buffer.from(data.fileData, "base64");
    await writeFile(filePath, buffer);

    // Create DB record
    const db = sql();
    const rows = await db`
      INSERT INTO videos (user_id, filename, sport_type, action_type, status, file_path)
      VALUES (${user.id}, ${data.fileName}, ${data.sportType}, ${data.actionType}, 'pending', ${filePath})
      RETURNING id, user_id, filename, sport_type, action_type, status, file_path, created_at
    `;

    const video = rows[0];
    return {
      id: video.id,
      filename: video.filename,
      sport_type: video.sport_type,
      action_type: video.action_type,
      status: video.status,
      created_at: String(video.created_at),
    };
  });

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const valid = [".mp4", ".mov", ".webm"];
      const ext = "." + dropped.name.split(".").pop()?.toLowerCase();
      if (valid.includes(ext)) {
        setFile(dropped);
        setError("");
      } else {
        setError("Please upload an MP4, MOV, or WebM video file.");
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError("");
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:...;base64, prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 80)); // 0-80% for reading
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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

    setUploading(true);
    setProgress(0);

    try {
      const fileData = await readFileAsBase64(file);
      setProgress(90);

      const result = await uploadVideo({
        data: {
          sportType,
          actionType,
          fileName: file.name,
          fileData,
        },
      });

      setProgress(100);
      navigate({ to: `/app/analysis/${result.id}` });
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
      setProgress(0);
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
                    ? "border-blue-500/50 bg-blue-500/10 text-white shadow-lg shadow-blue-500/10"
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
                    ? "border-blue-500/50 bg-blue-500/10 text-white shadow-lg shadow-blue-500/10"
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
                ? "border-blue-500/50 bg-blue-500/5"
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
                {progress < 90 ? "Reading file..." : "Saving..."}
              </span>
              <span className="text-blue-400">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading}
          className="w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload & Analyze"}
        </button>
      </form>
    </main>
  );
}
