import { randomBytes } from "node:crypto";

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const generated = randomBytes(32).toString("hex");
  console.warn(
    "[SwingSense] SESSION_SECRET not set — generated a random one for this process. " +
      "Set SESSION_SECRET in environment for persistent sessions across restarts.",
  );
  return generated;
}

export const SESSION_SECRET = getSessionSecret();
