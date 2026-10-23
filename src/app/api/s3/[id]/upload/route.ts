import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { Upload } from "@aws-sdk/lib-storage";
import { clientFor, HttpError, requireString, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Streams the raw request body to S3. Large files are sent as a multipart
 * upload automatically, so nothing is buffered fully in memory and the
 * bucket doesn't need any CORS configuration.
 */
export const PUT = route<Ctx>(async (req, { params }) => {
  const client = await clientFor(params);
  const sp = new URL(req.url).searchParams;
  const bucket = requireString(sp.get("bucket"), "bucket");
  const key = requireString(sp.get("key"), "key");
  if (!req.body) throw new HttpError(400, "Body kosong");

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: Readable.fromWeb(req.body as unknown as NodeWebStream),
      ContentType: req.headers.get("content-type") || "application/octet-stream",
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
  });
  await upload.done();
  return NextResponse.json({ ok: true, key }, { status: 201 });
});
