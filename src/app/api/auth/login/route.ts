import { NextResponse } from "next/server";
import { authEnabled, checkPassword, SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  if (!authEnabled()) return NextResponse.json({ ok: true });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !checkPassword(password)) {
    return NextResponse.json({ error: "Password salah" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && req.url.startsWith("https:"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
