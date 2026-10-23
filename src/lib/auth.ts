import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getSecretKey } from "./secret";

export const SESSION_COOKIE = "s3fm_session";

export function authEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function sessionToken() {
  return crypto
    .createHmac("sha256", getSecretKey())
    .update(`session:${process.env.ADMIN_PASSWORD ?? ""}`)
    .digest("hex");
}

export function checkPassword(input: string) {
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD ?? "").digest();
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthenticated() {
  if (!authEnabled()) return true;
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return false;
  const expected = sessionToken();
  return (
    value.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
