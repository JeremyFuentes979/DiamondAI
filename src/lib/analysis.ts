import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function extractFrames(videoPath: string, frameCount: number = 7): string[] {
  const tmpDir = join(tmpdir(), `swingsense-frames-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Get video duration
  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
    { encoding: "utf-8" }
  ).trim();
  const duration = parseFloat(durationStr);
  if (isNaN(duration) || duration <= 0) {
    throw new Error("Cannot determine video duration");
  }

  // Extract frames at evenly spaced intervals, skipping first/last 10%
  const startPercent = 0.1;
  const endPercent = 0.9;
  const range = duration * (endPercent - startPercent);
  const interval = range / (frameCount - 1);

  const frames: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const seekTime = duration * startPercent + interval * i;
    const framePath = join(tmpDir, `frame_${i + 1}.jpg`);

    execSync(
      `ffmpeg -ss ${seekTime.toFixed(2)} -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}" -y 2>/dev/null`,
      { encoding: "utf-8" }
    );

    if (existsSync(framePath)) {
      const buf = readFileSync(framePath);
      frames.push(buf.toString("base64"));
    }
  }

  return frames;
}

export const runAnalysis = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { videoId?: string };
    if (!d.videoId || typeof d.videoId !== "string") {
      throw new Error("Video ID is required.");
    }
    return { videoId: d.videoId };
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("You must be logged in.");

    const db = sql();

    // Fetch video record
    const videos = await db`
      SELECT id, user_id, filename, sport_type, action_type, status, file_path
      FROM videos WHERE id = ${data.videoId} AND user_id = ${user.id}
    `;
    if (videos.length === 0) throw new Error("Video not found.");

    const video = videos[0];

    // Update status to processing
    await db`
      UPDATE videos SET status = 'processing' WHERE id = ${video.id}
    `;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await db`
        UPDATE videos SET status = 'failed' WHERE id = ${video.id}
      `;
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    try {
      // Check if file exists
      if (!existsSync(video.file_path)) {
        throw new Error(`Video file not found at ${video.file_path}`);
      }

      // Extract frames
      let framesBase64: string[];
      try {
        framesBase64 = extractFrames(video.file_path, 7);
        if (framesBase64.length < 3) {
          throw new Error(`Only extracted ${framesBase64.length} frames — need at least 3`);
        }
      } catch (frameErr: any) {
        await db`
          UPDATE videos SET status = 'failed' WHERE id = ${video.id}
        `;
        throw new Error(`Frame extraction failed: ${frameErr.message}`);
      }

      // Build the OpenAI prompt
      const sportLabel = video.sport_type === "baseball" ? "Baseball" : "Softball";
      const actionLabel =
        video.action_type === "swing"
          ? "batting swing"
          : video.action_type === "pitch"
            ? "pitching motion"
            : "fielding/catching";

      const systemPrompt = `You are an expert ${sportLabel} coach and biomechanics analyst. Analyze the provided video frames of a ${sportLabel} player performing a ${actionLabel}. 

Respond with ONLY a valid JSON object in exactly this format — no markdown, no extra text, no code fences:

{
  "score": <number 1-100>,
  "summary": "<2-3 sentence overall assessment>",
  "whatsGood": "<bullet points on strengths, max 3>",
  "whatsNeedsWork": "<bullet points on areas to improve, max 3>",
  "detailedFeedback": [
    { "category": "Stance / Setup", "feedback": "<detailed feedback>" },
    { "category": "Hips / Lower Body", "feedback": "<detailed feedback>" },
    { "category": "Arms / Hands", "feedback": "<detailed feedback>" },
    { "category": "Follow-Through", "feedback": "<detailed feedback>" },
    { "category": "Timing / Rhythm", "feedback": "<detailed feedback>" }
  ]
}`;

      const userMessage = `Analyze this ${sportLabel} ${actionLabel}. These are ${framesBase64.length} key frames extracted from the video at evenly spaced intervals.`;

      // Build messages with frames as images
      const content: any[] = [{ type: "text", text: userMessage }];
      for (const b64 of framesBase64) {
        content.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "low" },
        });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
          max_tokens: 2000,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText.slice(0, 300)}`);
      }

      const json: any = await response.json();
      const aiContent = json.choices?.[0]?.message?.content;
      if (!aiContent) {
        throw new Error("No content returned from OpenAI");
      }

      // Parse the AI response
      let parsed: any;
      try {
        // Strip possible markdown code fences
        const cleaned = aiContent
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error(`Failed to parse AI response as JSON. Raw: ${aiContent.slice(0, 500)}`);
      }

      const score = Math.max(1, Math.min(100, Math.round(Number(parsed.score)) || 50));
      const summary = String(parsed.summary || parsed.whatsGood || "Analysis complete.");

      // Build structured detailed feedback
      const detailedFeedback = Array.isArray(parsed.detailedFeedback)
        ? parsed.detailedFeedback
        : [
            {
              category: "Overall",
              feedback:
                typeof parsed === "object"
                  ? JSON.stringify(parsed).slice(0, 1000)
                  : "Analysis data unavailable",
            },
          ];

      // Add strengths and weaknesses as part of the feedback
      if (parsed.whatsGood) {
        detailedFeedback.unshift({ category: "Strengths", feedback: String(parsed.whatsGood) });
      }
      if (parsed.whatsNeedsWork) {
        detailedFeedback.push({ category: "Areas to Improve", feedback: String(parsed.whatsNeedsWork) });
      }

      // Save analysis to DB
      await db`
        INSERT INTO analyses (video_id, user_id, summary, detailed_feedback, score)
        VALUES (${video.id}, ${user.id}, ${summary}, ${JSON.stringify(detailedFeedback)}, ${score})
      `;

      // Update video status
      await db`
        UPDATE videos SET status = 'completed' WHERE id = ${video.id}
      `;

      return {
        success: true,
        videoId: video.id,
        score,
        summary,
        detailedFeedback,
      };
    } catch (err: any) {
      // Set status to failed on any error
      try {
        await db`
          UPDATE videos SET status = 'failed' WHERE id = ${video.id}
        `;
      } catch {}

      throw new Error(`Analysis failed: ${err.message}`);
    }
  });
