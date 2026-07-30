import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";
import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ffmpegPath from "ffmpeg-static";

// --- Milestone check helper (runs inside the analysis server function) ---

async function checkAndUnlockMilestones(db: ReturnType<typeof sql>, userId: string) {
  // Count analyses
  const countRows = await db`
    SELECT COUNT(*) as cnt FROM analyses WHERE user_id = ${userId}
  `;
  const totalAnalyses = Number(countRows[0]?.cnt || 0);

  // Get all scores
  const scoreRows = await db`
    SELECT score FROM analyses
    WHERE user_id = ${userId} AND score IS NOT NULL
  `;
  const scores = scoreRows.map((r: any) => Number(r.score));

  // Get existing milestones
  const existingRows = await db`
    SELECT title FROM milestones WHERE user_id = ${userId}
  `;
  const existingTitles = new Set(existingRows.map((r: any) => r.title));

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
        VALUES (${userId}, ${milestone.title}, ${milestone.description})
      `;
    }
  }
}

function getDuration(videoPath: string): number {
  const output = execSync(
    `"${ffmpegPath}" -i "${videoPath}" 2>&1 | grep Duration`,
    { encoding: "utf-8" }
  );
  // Parse "Duration: 00:00:05.00" → seconds
  const match = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!match) throw new Error("Cannot determine video duration");
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
}

function extractFrames(videoPath: string, frameCount: number = 7): string[] {
  const tmpDir = join(tmpdir(), `swingsense-frames-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const duration = getDuration(videoPath);

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
      `"${ffmpegPath}" -ss ${seekTime.toFixed(2)} -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}" -y 2>/dev/null`,
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
      const analysisRows = await db`
        INSERT INTO analyses (video_id, user_id, summary, detailed_feedback, score)
        VALUES (${video.id}, ${user.id}, ${summary}, ${JSON.stringify(detailedFeedback)}, ${score})
        RETURNING id
      `;
      const analysisId = analysisRows[0]?.id;

      // Log performance metric
      if (analysisId) {
        await db`
          INSERT INTO performance_metrics (user_id, analysis_id, metric_name, metric_value)
          VALUES (${user.id}, ${analysisId}, 'overall_score', ${score})
        `;
      }

      // Check and unlock milestones
      await checkAndUnlockMilestones(db, user.id);

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
