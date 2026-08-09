import { apiAuth, json } from "@/lib/api";
import { testConnection } from "@/lib/retell";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const result = await testConnection();
  return json(result);
}
