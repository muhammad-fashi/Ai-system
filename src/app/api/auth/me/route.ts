import { getSession } from "@/lib/auth";
import { json } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return json({ user: null });
  return json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}
