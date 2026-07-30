import { createHmac } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { sql } from "../db.ts";
import { SESSION_SECRET } from "./session-secret.ts";

const UPLOAD_DIR = "/home/team/shared/uploads";
const COOKIE_NAME = "diamond_session";
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

function verifySessionToken(token: string): string | null {
  const parts = token.split(":");
  if (parts.length < 3) return null;
  const sig = parts.pop()!;
  const payload = parts.join(":");
  if (sign(payload) !== sig) return null;

  const [, ts] = payload.split(":");
  const age = Date.now() - parseInt(ts, 10);
  if (age > SESSION_MAX_AGE_MS) return null;

  return parts[0]; // userId
}

export async function handleUpload(request: Request): Promise<Response> {
  // --- Auth check ---
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`),
  );
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) {
    return Response.json(
      { error: "You must be logged in to upload." },
      { status: 401 },
    );
  }

  const userId = verifySessionToken(token);
  if (!userId) {
    return Response.json(
      { error: "Session expired. Please log in again." },
      { status: 401 },
    );
  }

  // --- Parse multipart form data ---
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Invalid form data. Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;
  const sportType = formData.get("sportType") as string | null;
  const actionType = formData.get("actionType") as string | null;

  // --- Validate fields ---
  if (!file || typeof file === "string") {
    return Response.json(
      { error: "Please select a video file." },
      { status: 400 },
    );
  }
  if (!sportType || !["baseball", "softball"].includes(sportType)) {
    return Response.json(
      { error: "Please select a valid sport." },
      { status: 400 },
    );
  }
  if (!actionType || !["swing", "pitch", "catch"].includes(actionType)) {
    return Response.json(
      { error: "Please select a valid action type." },
      { status: 400 },
    );
  }

  // --- Server-side file size validation ---
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      {
        error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 500 MB.`,
      },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return Response.json(
      { error: "The selected file is empty." },
      { status: 400 },
    );
  }

  // --- Save file to disk ---
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = join(UPLOAD_DIR, uniqueName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // --- Create DB record ---
  const db = sql();
  const rows = await db`
    INSERT INTO videos (user_id, filename, sport_type, action_type, status, file_path)
    VALUES (${userId}, ${file.name}, ${sportType}, ${actionType}, 'pending', ${filePath})
    RETURNING id, user_id, filename, sport_type, action_type, status, file_path, created_at
  `;

  const video = rows[0];
  return Response.json({
    id: video.id,
    filename: video.filename,
    sport_type: video.sport_type,
    action_type: video.action_type,
    status: video.status,
    created_at: String(video.created_at),
  });
}
