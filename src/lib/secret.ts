import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let cached: Buffer | null = null;

/** 32-byte key from APP_SECRET, or an auto-generated one persisted in data/.secret */
export function getSecretKey(): Buffer {
  if (cached) return cached;
  let raw = process.env.APP_SECRET;
  if (!raw) {
    const file = path.join(process.cwd(), "data", ".secret");
    if (fs.existsSync(file)) {
      raw = fs.readFileSync(file, "utf8").trim();
    } else {
      raw = crypto.randomBytes(32).toString("hex");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, raw, { mode: 0o600 });
    }
  }
  cached = crypto.createHash("sha256").update(raw).digest();
  return cached;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, enc] = payload.split(":");
  if (v !== "v1") throw new Error("Unknown secret format");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getSecretKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
