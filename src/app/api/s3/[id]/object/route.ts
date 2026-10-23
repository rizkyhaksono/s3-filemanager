import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { clientFor, requireString, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const MAX_TEXT = 1024 * 1024; // 1 MB

/**
 * Returns the start of an object as text, proxied through the server so text
 * previews work without CORS on the bucket.
 */
export const GET = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const sp = new URL(req.url).searchParams;
  const bucket = requireString(sp.get("bucket"), "bucket");
  const key = requireString(sp.get("key"), "key");

  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${MAX_TEXT - 1}` }),
  );
  const text = (await res.Body?.transformToString("utf-8")) ?? "";
  const total = Number(res.ContentRange?.split("/")[1] ?? res.ContentLength ?? text.length);
  return NextResponse.json({ text, truncated: total > MAX_TEXT });
});
