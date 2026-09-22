import { execSync } from "node:child_process";

function git(command: string): string {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Prints which Recipe PWA checkout is under test so Vitest's own version
 * line is not mistaken for the app/branch identity.
 */
export default function globalSetup(): void {
  const branch = git("git branch --show-current") || "(detached)";
  const sha = git("git rev-parse --short HEAD");
  const subject = git("git log -1 --format=%s");
  const ticket =
    process.env.KANDEV_TASK_TITLE?.trim() ||
    process.env.KANDEV_TASK_ID?.trim() ||
    "(set KANDEV_TASK_TITLE to label the ticket)";

  console.log(
    [
      "",
      "════════════════════════════════════════════════════════════",
      " Recipe PWA — test run context",
      ` ticket : ${ticket}`,
      ` branch : ${branch}`,
      ` commit : ${sha} ${subject}`,
      ` cwd    : ${process.cwd()}`,
      "════════════════════════════════════════════════════════════",
      "",
    ].join("\n"),
  );
}
