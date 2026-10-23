import { NextResponse } from "next/server";
import { HeadBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { HttpError, readJson, route } from "@/lib/api";
import { getConnectionConfig, parseConnectionInput } from "@/lib/connections";
import { createClient } from "@/lib/s3";

/**
 * Test a connection from the form. When editing, `id` lets an empty
 * secret fall back to the stored one.
 */
export const POST = route(async (req) => {
  const body = await readJson(req);
  const id = typeof body.id === "number" ? body.id : null;
  const input = parseConnectionInput(body, id === null);

  let secret = input.secretAccessKey;
  if (!secret && id !== null) {
    const stored = getConnectionConfig(id);
    if (!stored) throw new HttpError(404, "Koneksi tidak ditemukan");
    secret = stored.secretAccessKey;
  }

  const client = createClient({
    endpoint: input.endpoint,
    region: input.region,
    accessKeyId: input.accessKeyId,
    secretAccessKey: secret ?? "",
    forcePathStyle: input.forcePathStyle,
  });

  if (input.bucket) {
    await client.send(new HeadBucketCommand({ Bucket: input.bucket }));
    return NextResponse.json({ ok: true, message: `Terhubung ke bucket "${input.bucket}"` });
  }
  const res = await client.send(new ListBucketsCommand({}));
  const n = res.Buckets?.length ?? 0;
  return NextResponse.json({ ok: true, message: `Terhubung — ${n} bucket ditemukan` });
});
