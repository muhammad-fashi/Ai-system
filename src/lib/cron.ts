import "server-only";

/**
 * Authorize a cron request. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is configured.
 * Also allow an admin session (so the dashboard can trigger a manual run).
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured: only allow in non-production to avoid open access.
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
